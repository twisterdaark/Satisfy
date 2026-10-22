'use strict';
/* Satisfy — WebSocket combat relay (SAT-ONLINE-148, plan U025). No dependencies: Node's http and crypto only, so it runs as it
 * is on this computer or in a container (Cloud Run gives it PORT).
 *
 *   node backend/ws-relay.cjs                    on this computer (127.0.0.1:8787); the account is taken as the page says
 *   node backend/ws-relay.cjs --project <id>     accounts proven by Firebase ID tokens of that project (any host)
 *
 * One room per world shard: ws://host:port/w/<world>/<shard>. A client's first message is its hello ({t:'hello', token} or,
 * on this computer only, {t:'hello', uid}); the relay answers {t:'ok', uid} or closes. After that each message is an
 * envelope (src/net/contracts.js) of a combat type only (duel.*, pvp.*, raid.*: chat, trades and the rest stay in the
 * database, under its rules), at most MAX_MSG bytes and PER_SEC a second. It goes to the others in the room as
 * {t:'m', f:<the sender's proven uid>, e:<envelope>}: to the one account in payload.to when there is one, else to all; never
 * back to the sender and never to another room. A newer connection of the same account in a room replaces the older one.
 *
 * It decides nothing (who hit whom, HP, results stay with the duel/pvp/raid code on both sides, as over the database); moving
 * that logic here is the next step this makes possible. Rollback: stop using it (the game falls back to the database).
 */
const http = require('node:http');
const crypto = require('node:crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const LIM = { MAX_MSG: 16384, PER_SEC: 60, ABUSE: 5, ROOM_MAX: 200, HELLO_MS: 5000, PING_MS: 20000 };
const ROOM = /^\/w\/([a-z0-9_-]{1,32})\/([a-z0-9_-]{1,32})\/?$/;
const TYPE = /^[a-z]{2,12}\.[a-zA-Z]{1,24}$/;
const COMBAT = /^(duel|pvp|raid)\./;

/** On this computer only: the account is the one the hello names (a page's own uid, for two-tab tests and trying it out). */
function devVerifier() {
  return (h) => Promise.resolve(h && typeof h.uid === 'string' && /^[A-Za-z0-9_:.-]{1,64}$/.test(h.uid) ? h.uid : null);
}

// Google's public keys for Firebase ID tokens, kept as long as Google says (Cache-Control max-age)
function googleCerts(fetchFn = globalThis.fetch) {
  const URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
  let keys = null, until = 0;
  return async () => {
    if (keys && Date.now() < until) return keys;
    const r = await fetchFn(URL);
    if (!r.ok) throw new Error('certs ' + r.status);
    const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
    keys = await r.json(); until = Date.now() + (m ? +m[1] : 3600) * 1000;
    return keys;
  };
}

/**
 * A Firebase ID token of `projectId` (RS256, signed by one of Google's keys, aud = the project, iss = securetoken, not
 * expired, issued and signed in at a time already past) proves its `sub`, the account's uid. certs() → {kid: PEM}.
 */
function firebaseVerifier(projectId, o = {}) {
  if (!/^[a-z0-9-]{4,40}$/.test(projectId || '')) throw new Error('a Firebase project id is needed');
  const certs = o.certs || googleCerts(), now = o.now || Date.now;
  const json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
  return async (h) => {
    const tok = h && h.token;
    if (typeof tok !== 'string' || tok.length > 4096) return null;
    const p3 = tok.split('.');
    if (p3.length !== 3) return null;
    let hd, pl;
    try { hd = json(p3[0]); pl = json(p3[1]); } catch (e) { return null; }
    if (!hd || hd.alg !== 'RS256' || typeof hd.kid !== 'string' || !pl || typeof pl !== 'object') return null;
    let keys;
    try { keys = await certs(); } catch (e) { return null; }
    const pem = keys && Object.prototype.hasOwnProperty.call(keys, hd.kid) ? keys[hd.kid] : null;
    if (typeof pem !== 'string') return null;
    let ok = false;
    try { ok = crypto.verify('RSA-SHA256', Buffer.from(p3[0] + '.' + p3[1]), crypto.createPublicKey(pem), Buffer.from(p3[2], 'base64url')); } catch (e) { return null; }
    if (!ok) return null;
    const t = Math.floor(now() / 1000);
    if (pl.aud !== projectId || pl.iss !== 'https://securetoken.google.com/' + projectId) return null;
    if (!(typeof pl.exp === 'number' && pl.exp > t) || !(typeof pl.iat === 'number' && pl.iat <= t + 60)) return null;
    if (typeof pl.auth_time === 'number' && pl.auth_time > t + 60) return null;
    if (typeof pl.sub !== 'string' || !pl.sub || pl.sub.length > 128) return null;
    return pl.sub;
  };
}

/** One server frame (unmasked; text 0x1, close 0x8, ping 0x9, pong 0xA). */
function frame(op, data) {
  const b = Buffer.isBuffer(data) ? data : Buffer.from(data || '', 'utf8'), n = b.length;
  const h = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : null;
  if (!h) { const x = Buffer.alloc(10); x[0] = 0x80 | op; x[1] = 127; x.writeBigUInt64BE(BigInt(n), 2); return Buffer.concat([x, b]); }
  return Buffer.concat([h, b]);
}

/**
 * @param {{verify?:function(object):Promise<(string|null)>, types?:RegExp, limits?:object, origins?:string[]}} [opts]
 * verify: the hello → the account's uid, or null (devVerifier() by default). origins: when given, only pages from these.
 */
function createRelay(opts = {}) {
  const verify = opts.verify || devVerifier(), types = opts.types || COMBAT, L = Object.assign({}, LIM, opts.limits || {});
  const rooms = new Map(); // "world/shard" → Set of connections
  const all = new Set(); // every upgraded socket, in a room or not yet
  const stats = { conns: 0, in: 0, out: 0, msgs: 0, dropped: 0, refused: 0, byType: {} }; // in: messages after the hello; out: frames sent on
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
    res.writeHead(404); res.end();
  });

  function send(c, obj) { if (!c.dead) try { c.sock.write(frame(1, JSON.stringify(obj))); } catch (e) { /* closing */ } }
  function bye(c, code, why) {
    if (c.dead) return;
    const r = Buffer.alloc(2); r.writeUInt16BE(code || 1000, 0);
    try { c.sock.write(frame(8, Buffer.concat([r, Buffer.from(why || '')]))); } catch (e) { /* ignore */ }
    gone(c);
    try { c.sock.end(); } catch (e) { /* ignore */ }
    setTimeout(() => { try { c.sock.destroy(); } catch (e) { /* ignore */ } }, 1000).unref();
  }
  function gone(c) {
    if (c.dead) return;
    c.dead = true; clearTimeout(c.helloT); clearInterval(c.pingT);
    const set = rooms.get(c.room);
    if (set) { set.delete(c); if (!set.size) rooms.delete(c.room); }
  }
  function onText(c, s) {
    let m;
    try { m = JSON.parse(s); } catch (e) { stats.dropped++; return; }
    if (!m || typeof m !== 'object' || Array.isArray(m)) { stats.dropped++; return; }
    if (!c.uid) {
      if (c.asked || m.t !== 'hello') return;
      c.asked = true;
      Promise.resolve().then(() => verify(m)).catch(() => null).then((uid) => {
        if (c.dead) return;
        if (typeof uid !== 'string' || !uid) { stats.refused++; bye(c, 4001, 'not signed in'); return; }
        const set = rooms.get(c.room) || new Set();
        for (const o of set) if (o.uid === uid) bye(o, 4000, 'replaced');
        if (set.size >= L.ROOM_MAX) { bye(c, 4029, 'room full'); return; }
        clearTimeout(c.helloT);
        c.uid = uid; set.add(c); rooms.set(c.room, set);
        send(c, { t: 'ok', uid });
      });
      return;
    }
    // a per-connection budget; far over it for long is someone flooding: closed
    stats.in++;
    const t = Date.now();
    if (t - c.winT >= 1000) { c.winT = t; c.win = 0; }
    if (++c.win > L.PER_SEC) { stats.dropped++; if (c.win > L.PER_SEC * L.ABUSE) bye(c, 4008, 'too many'); return; }
    if (m.v !== 1 || typeof m.type !== 'string' || !TYPE.test(m.type) || !types.test(m.type) || typeof m.sessionId !== 'string' || m.sessionId.length > 80 ||
      typeof m.seq !== 'number' || !isFinite(m.seq) || (m.payload != null && (typeof m.payload !== 'object' || Array.isArray(m.payload)))) { stats.dropped++; return; }
    const to = m.payload && typeof m.payload.to === 'string' ? m.payload.to : null;
    const fr = frame(1, JSON.stringify({ t: 'm', f: c.uid, e: m })); // once, whoever it goes to
    stats.msgs++; stats.byType[m.type] = (stats.byType[m.type] || 0) + 1;
    for (const o of rooms.get(c.room) || []) if (o !== c && !o.dead && (!to || o.uid === to)) { try { o.sock.write(fr); stats.out++; } catch (e) { /* closing */ } }
  }
  function onData(c, chunk) {
    c.buf = c.buf.length ? Buffer.concat([c.buf, chunk]) : chunk;
    for (;;) {
      const b = c.buf;
      if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
      let n = b[1] & 0x7f, off = 2;
      if (n === 126) { if (b.length < 4) return; n = b.readUInt16BE(2); off = 4; } else if (n === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > BigInt(L.MAX_MSG)) { bye(c, 1009, 'too big'); return; } n = Number(big); off = 10; }
      if (!masked) { bye(c, 1002, 'unmasked'); return; } // a client's frames are always masked (RFC 6455 §5.1)
      if (n > L.MAX_MSG || c.part.length + n > L.MAX_MSG) { bye(c, 1009, 'too big'); return; }
      if (b.length < off + 4 + n) return;
      const key = b.subarray(off, off + 4), data = Buffer.from(b.subarray(off + 4, off + 4 + n));
      for (let i = 0; i < n; i++) data[i] ^= key[i & 3];
      c.buf = b.subarray(off + 4 + n);
      if (op === 0x8) { bye(c, 1000, ''); return; }
      if (op === 0x9) { try { c.sock.write(frame(0xA, data)); } catch (e) { /* ignore */ } continue; }
      if (op === 0xA) { c.pong = Date.now(); continue; }
      if (op === 0x1 || op === 0x0) {
        if ((op === 0x1) === c.frag) { bye(c, 1002, 'fragments'); return; } // a new message inside one, or a continuation of none
        c.part = c.part.length ? Buffer.concat([c.part, data]) : data;
        if (!fin) { c.frag = true; continue; }
        const s = c.part.toString('utf8'); c.part = Buffer.alloc(0); c.frag = false;
        onText(c, s);
        if (c.dead) return;
        continue;
      }
      bye(c, 1003, 'text only'); return; // binary or unknown
    }
  }

  server.on('upgrade', (req, sock) => {
    const url = String(req.url || '').split('?')[0], m = ROOM.exec(url), key = req.headers['sec-websocket-key'];
    const no = (code) => { try { sock.end('HTTP/1.1 ' + code + '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); } catch (e) { /* ignore */ } setTimeout(() => sock.destroy(), 500).unref(); };
    if (!m || typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key) || String(req.headers.upgrade).toLowerCase() !== 'websocket') return no('400 Bad Request');
    if (req.headers['sec-websocket-version'] !== '13') return no('426 Upgrade Required\r\nSec-WebSocket-Version: 13');
    if (opts.origins && !opts.origins.includes(req.headers.origin)) return no('403 Forbidden');
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    sock.setNoDelay(true);
    const c = { sock, room: m[1] + '/' + m[2], uid: null, asked: false, buf: Buffer.alloc(0), part: Buffer.alloc(0), frag: false, win: 0, winT: 0, pong: Date.now(), dead: false };
    stats.conns++;
    c.helloT = setTimeout(() => bye(c, 4001, 'no hello'), L.HELLO_MS); c.helloT.unref();
    c.pingT = setInterval(() => {
      if (Date.now() - c.pong > L.PING_MS * 2.5) { bye(c, 1001, 'gone quiet'); return; }
      try { sock.write(frame(0x9, '')); } catch (e) { /* ignore */ }
    }, L.PING_MS); c.pingT.unref();
    sock.on('data', (d) => { if (!c.dead) onData(c, d); });
    all.add(sock);
    sock.on('close', () => { all.delete(sock); gone(c); });
    sock.on('error', () => gone(c));
  });

  return {
    server,
    /** → the port it listens on (0: any free one) */
    listen(port = 8787, host = '127.0.0.1') { return new Promise((res, rej) => { server.once('error', rej); server.listen(port, host, () => res(server.address().port)); }); },
    close() {
      for (const set of [...rooms.values()]) for (const c of [...set]) bye(c, 1001, 'relay going down');
      return new Promise((res) => {
        server.close(() => res());
        if (server.closeAllConnections) server.closeAllConnections();
        setTimeout(() => { for (const x of all) try { x.destroy(); } catch (e) { /* ignore */ } }, 200).unref(); // the goodbye had its chance
      });
    },
    /** cut every connection (or the account's) without a goodbye: a lost connection, in tests */
    cut(uid) { for (const set of [...rooms.values()]) for (const c of [...set]) if (!uid || c.uid === uid) { gone(c); try { c.sock.destroy(); } catch (e) { /* ignore */ } } },
    rooms() { const o = {}; for (const [k, set] of rooms) o[k] = [...set].map((c) => c.uid).sort(); return o; },
    stats() { return JSON.parse(JSON.stringify(stats)); },
  };
}

module.exports = { createRelay, devVerifier, firebaseVerifier, googleCerts, frame, LIM, COMBAT };

if (require.main === module) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const project = arg('--project') || process.env.FIREBASE_PROJECT || '';
  const port = +(arg('--port') || process.env.PORT || 8787);
  const host = arg('--host') || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  if (!project && !/^(127\.0\.0\.1|localhost|::1)$/.test(host)) { console.error('Without --project the relay only listens on this computer (127.0.0.1).'); process.exit(2); }
  const relay = createRelay({ verify: project ? firebaseVerifier(project) : devVerifier() });
  relay.listen(port, host).then((p) => console.log('Satisfy combat relay on ws://' + host + ':' + p + '/w/<world>/<shard>' + (project ? ' (Firebase project ' + project + ')' : ' (this computer only, accounts not checked)')));
  const stop = () => relay.close().then(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
