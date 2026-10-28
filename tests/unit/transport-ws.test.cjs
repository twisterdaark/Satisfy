'use strict';
// SAT-ONLINE-148 (plan U025 "world shard migration: the instance logic can move to a Cloud Run WebSocket without changing
// what is drawn"; acceptance: "an RTDB social prototype, then WS combat, under the same contract test"). The transport
// contract runs over the in-memory hub, over the WebSocket relay (backend/ws-relay.cjs) and over the two together (social on
// the hub standing in for the database, combat on the relay). Then the same duel and PvP fight runs over the hub alone and
// over hub + relay and must come out the same. With it: the order kept per path, a replay dropped, nobody sending as another
// account, a dropped connection coming back, 20 rooms without cross talk (plan U348), and the relay's own checks.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { loadModules } = require('../harness/load-module.cjs');
const { createRelay, firebaseVerifier } = require('../../backend/ws-relay.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/transport-ws.js', 'src/net/duel.js', 'src/net/pvp.js');
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000, what = '') {
  const end = Date.now() + ms;
  while (!fn()) { if (Date.now() > end) throw new Error('timed out: ' + (what || fn)); await sleep(5); }
}

let relay, PORT;
test.before(async () => { relay = createRelay(); PORT = await relay.listen(0); });
test.after(() => relay.close());
const url = (room = 'main') => 'ws://127.0.0.1:' + PORT + '/w/satisfy/' + room;

// every message the WebSocket transports sent has reached the relay, and every one it sent on has arrived
function drainer(list) {
  return async () => {
    for (let i = 0; i < 400; i++) {
      const sent = list.reduce((n, t) => n + t.wsStats().sent, 0), recv = list.reduce((n, t) => n + t.wsStats().recv, 0), s = relay.stats();
      if (sent === s.in && recv === s.out) { await sleep(2); const s2 = relay.stats(); if (s2.in === s.in && s2.out === s.out) return; }
      await sleep(3);
    }
    throw new Error('the relay did not settle');
  };
}
// the relay counts every connection since it started: a fresh start for each test that uses drain()
async function freshRelay() { await relay.close(); relay = createRelay(); PORT = await relay.listen(PORT); }

// ---- the transport contract, the same over each ----
const KINDS = {
  hub: () => { const h = SN.transports.hub(); return { open: () => h.connect(), list: [] }; },
  ws: () => { const list = []; return { open: (uid) => { const t = SN.transports.ws(url(), { uid }); list.push(t); return t; }, list }; },
  split: () => { const h = SN.transports.hub(), list = []; return { open: (uid) => { const w = SN.transports.ws(url(), { uid }); list.push(w); return SN.transports.split(h.connect(), w); }, list }; },
};
const env = (type, n, sid = 's') => SN.net.envelope(type, { to: null, duel: 'd1', k: n }, { sessionId: sid, seq: n });

for (const kind of Object.keys(KINDS)) {
  test(`[${kind}] the contract: to every other peer, never an echo, each a copy of its own, in order; closed is closed`, async () => {
    await freshRelay();
    const K = KINDS[kind](), drain = drainer(K.list);
    const peers = ['u0', 'u1', 'u2'].map((uid) => { const t = K.open(uid), got = []; t.onmessage((e) => got.push(e)); return { t, got }; });
    await until(() => K.list.every((w) => w.state() === 'open'), 4000, 'all open');
    const [a, b, c] = peers;
    for (let n = 1; n <= 5; n++) a.t.send(env('duel.hit', n, 'sa'));
    await drain();
    assert.deepEqual(a.got, [], 'never back to the sender');
    for (const p of [b, c]) assert.deepEqual(p.got.map((e) => e.payload.k), [1, 2, 3, 4, 5], 'all of them, in order');
    b.got[0].payload.k = 99;
    assert.equal(c.got[0].payload.k, 1, "one receiver's copy is not another's");
    // a later handler replaces the earlier one
    const late = [];
    c.t.onmessage((e) => late.push(e));
    b.t.send(env('pvp.hit', 6, 'sb'));
    await drain();
    assert.equal(c.got.length, 5); assert.deepEqual(late.map((e) => e.type), ['pvp.hit']);
    // closed: it neither sends nor gets anything; the others go on
    b.t.close();
    await sleep(kind === 'hub' ? 0 : 30);
    b.t.send(env('duel.hit', 7, 'sb'));
    a.t.send(env('raid.hit', 8, 'sa'));
    await drain();
    assert.deepEqual(late.map((e) => e.type), ['pvp.hit', 'raid.hit']);
    assert.equal(b.got.length, 5);
    for (const p of peers) p.t.close();
  });
}

test('split: combat goes through the relay only, everything else through the social path only', async () => {
  await freshRelay();
  const hub = SN.transports.hub(), list = [], viaHub = [];
  const mk = (uid) => {
    const h = hub.connect(), send = h.send; h.send = (e) => { viaHub.push(e.type); send(e); };
    const w = SN.transports.ws(url(), { uid }); list.push(w);
    const t = SN.transports.split(h, w), got = []; t.onmessage((e) => got.push(e.type));
    return { t, got, h, w };
  };
  const a = mk('u0'), b = mk('u1'), drain = drainer(list);
  await until(() => list.every((w) => w.state() === 'open'));
  for (const [i, ty] of ['presence.state', 'party.ping', 'duel.hit', 'chat.say', 'pvp.hit', 'trade.ask', 'raid.state'].entries()) a.t.send(env(ty, i + 1, 'sa'));
  await drain();
  assert.deepEqual(viaHub, ['presence.state', 'party.ping', 'chat.say', 'trade.ask']);
  assert.deepEqual(relay.stats().byType, { 'duel.hit': 1, 'pvp.hit': 1, 'raid.state': 1 });
  assert.deepEqual(b.got.sort(), ['chat.say', 'duel.hit', 'party.ping', 'presence.state', 'pvp.hit', 'raid.state', 'trade.ask']);
  // a combat message on the social path (the shard's combat is on the relay) is not taken
  a.h.send(env('duel.hit', 9, 'sa'));
  await drain();
  assert.equal(b.got.filter((x) => x === 'duel.hit').length, 1);
  assert.equal(a.t.kind, 'memory', "the social transport's kind, so the game treats it as before");
  assert.equal(a.t.via, 'ws');
  a.t.close(); b.t.close();
});

// ---- the same fight over the hub alone and over hub (social) + relay (combat) ----
// A social path that knows a session by uid + session id, as the Firebase transport does (fromSnap/sidOf)
function boundHub() {
  const hub = SN.transports.hub();
  return (uid) => {
    const h = hub.connect();
    return {
      kind: 'firebase-like',
      send: (e) => h.send({ f: uid, e }),
      onmessage: (fn) => h.onmessage((m) => {
        const e = m.e; e.sessionId = m.f + '.' + e.sessionId;
        if (e.type === 'presence.state' && e.payload) e.payload.sid = m.f + '.' + e.payload.sid;
        fn(e);
      }),
      close: () => h.close(),
    };
  };
}
async function world(mode, n, o = {}) {
  if (mode !== 'hub') await freshRelay();
  const social = boundHub(), list = [];
  let t = 1000; const now = () => t;
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + i;
    const p = { uid, name: 'P' + i, x: 4000 + i * (o.gap || 30), y: 1500, zone: 'zPlains', room: null, party: null, events: [], msgs: [] };
    let tr = social(uid);
    if (mode !== 'hub') { const w = SN.transports.ws(url(), { uid, bind: true }); list.push(w); p.ws = w; tr = SN.transports.split(tr, w); }
    p.tr = tr;
    p.pres = SN.presence.create({ transport: tr, now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    p.duel = SN.duel.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, policy: SN.net.zonePolicy });
    p.pvp = SN.pvp.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, room: () => p.room, party: () => p.party, ally: () => false, busy: () => p.duel.locked(), alive: () => true, policy: SN.net.zonePolicy });
    p.duel.on((e) => p.events.push('duel:' + e.type + (e.result ? ':' + e.result : '') + (e.why ? ':' + e.why : '')));
    p.pvp.on((e) => p.events.push('pvp:' + e.type + (e.pm != null ? ':' + e.pm : '') + (e.why ? ':' + e.why : '')));
    p.pres.on((e) => { if (e.type === 'message') p.msgs.push(e.env.type + '#' + e.env.seq); });
    players.push(p);
  }
  if (list.length) await until(() => list.every((w) => w.state() === 'open'));
  const drain = list.length ? drainer(list) : async () => {};
  const sync = () => {
    for (const p of players) {
      const pp = SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: p.x, y: p.y, dir: 0 },
        { zone: p.zone, room: p.room, uid: p.uid, sid: p.pres.sid, party: p.party });
      p.pres.publish(pp, true);
    }
    for (const p of players) { p.pres.tick(); p.duel.tick(); }
  };
  const advance = async (ms, step = 100) => { for (let k = 0; k < ms; k += step) { t += Math.min(step, ms - k); sync(); await drain(); } };
  sync(); await advance(300);
  const remote = (from, to) => from.pres.remotes().find((r) => r.uid === to.uid);
  const close = () => { for (const p of players) p.pres.close(); };
  return { players, advance, drain, remote, close };
}

// the duel and PvP steps of unit/duel and unit/pvp, one after the other; returns what each side saw
async function fight(mode) {
  const C = SN.duel.C, V = SN.pvp.C;
  const w = await world(mode, 2), [a, b] = w.players;
  try {
    // PvP outside town: capped hits that reach the victim, a forged huge one capped too; none into a town
    assert.equal(a.pvp.hit(w.remote(a, b), 10), 40);
    assert.equal(a.pvp.hit(w.remote(a, b), 1000), V.MAX_HIT);
    await w.drain();
    a.pres.send('pvp.hit', { to: 'u1', k: 999999, n: 9 });
    await w.drain();
    b.zone = 'zWin'; await w.advance(200);
    assert.equal(a.pvp.why(w.remote(a, b)), 'safe');
    b.zone = 'zPlains'; await w.advance(200);
    // a duel: challenge, accept, both ready, the countdown, capped hits, a burst over the rate, HP 0 ends it
    assert.equal(a.duel.challenge(w.remote(a, b)), 'sent');
    await w.drain();
    const inv = b.duel.pendingChallenge();
    assert.ok(inv, 'the challenge arrived');
    assert.ok(b.duel.accept(inv.duel));
    await w.drain();
    a.duel.ready(); b.duel.ready();
    await w.advance(100);
    await w.advance(C.COUNTDOWN_MS + 100);
    assert.equal(a.duel.state().phase, 'fight'); assert.equal(b.duel.state().phase, 'fight');
    assert.equal(a.duel.hit(999), C.MAX_HIT, 'capped');
    await w.advance(300);
    assert.equal(b.duel.state().hp, C.HP - C.MAX_HIT);
    assert.equal(a.duel.state().foeHp, C.HP - C.MAX_HIT, 'the reply came back');
    await w.advance(1100);
    for (let i = 0; i < C.HITS_PER_S + 2; i++) a.duel.hit(5);
    await w.advance(100);
    assert.equal(b.duel.state().hp, C.HP - C.MAX_HIT - 5 * C.HITS_PER_S, 'only HITS_PER_S of the burst');
    while (b.duel.state().phase === 'fight') { a.duel.hit(C.MAX_HIT); await w.advance(300); }
    assert.deepEqual([b.duel.state().last.result, a.duel.state().last.result, a.duel.state().last.why], ['lose', 'win', 'hp']);
    return { a: a.events, b: b.events, hurt: b.events.filter((e) => /^pvp:hurt/.test(e)) };
  } finally { w.close(); }
}

test('the same duel and PvP fight over the hub alone and over hub (social) + relay (combat): the same outcome', async () => {
  const hub = await fight('hub');
  const viaWs = await fight('split');
  assert.deepEqual(hub.hurt, ['pvp:hurt:40', 'pvp:hurt:' + SN.pvp.C.MAX_HIT, 'pvp:hurt:' + SN.pvp.C.MAX_HIT]);
  assert.deepEqual(viaWs.a, hub.a, "A's side the same");
  assert.deepEqual(viaWs.b, hub.b, "B's side the same");
  const s = relay.stats();
  for (const ty of ['duel.challenge', 'duel.accept', 'duel.ready', 'duel.hit', 'duel.hp', 'pvp.hit']) assert.ok(s.byType[ty] > 0, ty + ' went through the relay');
});

test('the order is kept per path: a combat message that comes later than a newer social one still counts; a replay does not', async () => {
  const w = await world('split', 2), [a, b] = w.players;
  try {
    // the relay slower than the database: A's hit (seq n) arrives after A's party ping (seq n+1)
    const hold = []; const send = a.ws.send; a.ws.send = (e) => hold.push(e);
    a.pvp.hit(w.remote(a, b), 10);
    a.pres.send('party.ping', { to: 'u1', party: 'p1', k: 1, n: 1 });
    await w.drain();
    assert.ok(b.msgs.some((m) => /^party\.ping/.test(m)), 'the ping came');
    a.ws.send = send; for (const e of hold) send(e);
    await w.drain();
    assert.deepEqual(b.events.filter((e) => /^pvp:hurt/.test(e)), ['pvp:hurt:40'], 'the hit counts');
    // the same hit again (a replay on the relay): dropped
    const d0 = b.pres.stats().dropped;
    send(hold[0]);
    await w.drain();
    assert.deepEqual(b.events.filter((e) => /^pvp:hurt/.test(e)), ['pvp:hurt:40']);
    assert.equal(b.pres.stats().dropped, d0 + 1);
  } finally { w.close(); }
});

test('nobody sends as another account: the relay names the sender, and that session must be one the player can see', async () => {
  const w = await world('split', 3, { gap: 20 }), [a, b, m] = w.players;
  try {
    // M (u2) copies A's session id, as it is and as B knows it (uid.sid), on a hit to B: each comes as u2's, which is not A's
    m.ws.send(SN.net.envelope('pvp.hit', { to: 'u1', k: 300 }, { sessionId: a.pres.sid, seq: 1e9 }));
    m.ws.send(SN.net.envelope('pvp.hit', { to: 'u1', k: 300 }, { sessionId: 'u0.' + a.pres.sid, seq: 1e9 + 1 }));
    await w.drain();
    assert.deepEqual(b.events.filter((e) => /^pvp:hurt/.test(e)), [], 'not taken as A');
    assert.equal(a.pvp.hit(w.remote(a, b), 10), 40);
    await w.drain();
    const h = b.events.filter((e) => /^pvp:hurt/.test(e));
    assert.deepEqual(h, ['pvp:hurt:40']);
    // a hit for B does not reach M (to = B's account only)
    assert.ok(!m.events.some((e) => /^pvp:hurt/.test(e)));
  } finally { w.close(); }
});

test('a dropped connection comes back by itself; what was sent meanwhile goes, a hit from seconds ago does not', async () => {
  const w = await world('split', 2), [a, b] = w.players;
  try {
    const ups = [];
    relay.cut('u0');
    await until(() => a.ws.state() === 'connecting', 2000, 'noticed');
    a.pvp.hit(w.remote(a, b), 10); // waits while A is away
    assert.equal(a.ws.wsStats().queued, 1);
    await until(() => a.ws.state() === 'open', 4000, 'back');
    ups.push(a.ws.wsStats().reconnects >= 1);
    await until(() => b.events.some((e) => /^pvp:hurt/.test(e)), 3000, 'the waiting hit');
    await w.drain();
    assert.deepEqual(b.events.filter((e) => /^pvp:hurt/.test(e)), ['pvp:hurt:40'], 'once');
    assert.deepEqual(ups, [true]);
    assert.deepEqual(relay.rooms(), { 'satisfy/main': ['u0', 'u1'] }, 'each in the room once');
  } finally { w.close(); }
  // the relay not there yet when the page starts: tried again until it is
  await relay.close();
  const early = SN.transports.ws(url(), { uid: 'u5' });
  await sleep(600);
  assert.equal(early.state(), 'connecting');
  relay = createRelay(); await relay.listen(PORT);
  await until(() => early.state() === 'open', 8000, 'in once the relay is up');
  early.close();
  // queued longer than QUEUE_MS (the relay away for seconds): dropped, not sent late
  const real = Date.now;
  class FakeWS { constructor() { FakeWS.last = this; this.readyState = 0; this.sent = []; } send(x) { this.sent.push(JSON.parse(x)); } close() { this.readyState = 3; } }
  const t = SN.transports.ws('ws://relay/w/satisfy/main', { uid: 'x', WebSocket: FakeWS });
  t.send(env('duel.hit', 1));
  assert.equal(t.wsStats().queued, 1);
  try {
    Date.now = () => real() + 3000;
    const s = FakeWS.last; s.readyState = 1; s.onopen(); await sleep(5);
    s.onmessage({ data: JSON.stringify({ t: 'ok', uid: 'x' }) });
    assert.deepEqual(s.sent.map((m) => m.t || m.type), ['hello'], 'only the hello');
    assert.equal(t.wsStats().dropped, 1);
    t.send(env('duel.hit', 2));
    assert.deepEqual(s.sent.map((m) => m.t || m.type), ['hello', 'duel.hit'], 'a new one goes at once');
  } finally { Date.now = real; t.close(); }
  assert.equal(t.state(), 'closed');
});

test('20 rooms (shards) at once: nothing crosses from one to another (plan U348)', async () => {
  await freshRelay();
  const rooms = Array.from({ length: 20 }, (_, i) => 'r' + i), all = [];
  for (const r of rooms) for (const u of ['a', 'b']) { const t = SN.transports.ws(url(r), { uid: r + u }), got = []; t.onmessage((e) => got.push(e.payload.raid)); all.push({ r, t, got }); }
  await until(() => all.every((x) => x.t.state() === 'open'), 6000);
  for (const x of all) x.t.send(SN.net.envelope('raid.state', { raid: x.r, k: 0 }, { sessionId: 's' + x.r, seq: 1 }));
  await drainer(all.map((x) => x.t))();
  for (const x of all) assert.deepEqual(x.got, [x.r], x.r + ' got only its own room');
  assert.equal(Object.keys(relay.rooms()).length, 20);
  for (const x of all) x.t.close();
});

test('the relay: combat types only, a well-formed envelope, a size and rate limit, a newer connection replaces an older one', async () => {
  await freshRelay();
  const a = SN.transports.ws(url(), { uid: 'u0' }), b = SN.transports.ws(url(), { uid: 'u1' }), got = [];
  b.onmessage((e) => got.push(e.type + ':' + e.seq));
  await until(() => a.state() === 'open' && b.state() === 'open');
  for (const e of [env('chat.say', 1), env('trade.ask', 2), { v: 2, type: 'duel.hit', sessionId: 's', seq: 3 }, { v: 1, type: 'duel.hit', sessionId: 's', seq: 'x' },
    { v: 1, type: 'duel.hit', sessionId: 'x'.repeat(81), seq: 5 }, env('duel.hit', 6)]) a.send(e);
  await drainer([a, b])();
  assert.deepEqual(got, ['duel.hit:6'], 'only the well-formed combat one');
  assert.equal(relay.stats().dropped, 5);
  // flooding: past PER_SEC a second the rest is dropped
  await sleep(1050);
  for (let i = 0; i < 80; i++) a.send(env('pvp.hit', 100 + i));
  await drainer([a, b])();
  assert.equal(got.length, 1 + 60, 'PER_SEC (60) in a second');
  // too big: the connection is closed (and comes back)
  a.send({ v: 1, type: 'duel.hit', sessionId: 's', seq: 999, payload: { to: 'u1', pad: 'x'.repeat(20000) } }); // (contracts' envelope() would refuse it already)
  await until(() => a.state() === 'connecting', 2000, 'closed for the size');
  await until(() => a.state() === 'open', 4000, 'back');
  // the same account again in the room (another tab): the newer one stays, the older one is not tried again
  const a2 = SN.transports.ws(url(), { uid: 'u0' });
  await until(() => a2.state() === 'open');
  await until(() => a.state() === 'replaced', 2000, 'replaced');
  await sleep(400);
  assert.equal(a2.state(), 'open');
  assert.deepEqual(relay.rooms()['satisfy/main'], ['u0', 'u1']);
  for (const t of [a, a2, b]) t.close();
});

// ---- Firebase ID tokens ----
test('the relay with a Firebase project: only a valid ID token of that project gets in, as its own account', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const P = 'satisfy-test-1', T0 = 1800000000;
  const certs = async () => ({ k1: publicKey.export({ type: 'spki', format: 'pem' }) });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tok = (claims = {}, o = {}) => {
    const h = b64({ alg: o.alg || 'RS256', kid: o.kid || 'k1', typ: 'JWT' });
    const p = b64(Object.assign({ aud: P, iss: 'https://securetoken.google.com/' + P, sub: 'gUser1', iat: T0 - 10, auth_time: T0 - 100, exp: T0 + 3600 }, claims));
    const sig = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), o.key || privateKey).toString('base64url');
    return h + '.' + p + '.' + sig;
  };
  const verify = firebaseVerifier(P, { certs, now: () => T0 * 1000 });
  assert.equal(await verify({ token: tok() }), 'gUser1');
  for (const [why, t] of [
    ['expired', tok({ exp: T0 - 1 })], ['another project', tok({ aud: 'someone-else' })], ['another issuer', tok({ iss: 'https://evil.example/' + P })],
    ['issued in the future', tok({ iat: T0 + 600 })], ['signed by another key', tok({}, { key: other })], ['an unknown key', tok({}, { kid: 'k9' })],
    ['no account', tok({ sub: '' })], ['not RS256', tok({}, { alg: 'HS256' })], ['not a token', 'abc'], ['none', undefined],
  ]) assert.equal(await verify({ token: t }), null, why);
  assert.equal(await verify({ uid: 'gUser1' }), null, 'a uid without a token is not enough');
  // over the wire: the token's account, whatever the hello says
  const r = createRelay({ verify }), port = await r.listen(0);
  try {
    const good = SN.transports.ws('ws://127.0.0.1:' + port + '/w/satisfy/main', { uid: 'gSomeoneElse', token: () => Promise.resolve(tok()) });
    await until(() => good.state() === 'open');
    assert.deepEqual(r.rooms(), { 'satisfy/main': ['gUser1'] });
    const ups = [];
    const bad = SN.transports.ws('ws://127.0.0.1:' + port + '/w/satisfy/main', { uid: 'gUser1', onConnection: (u) => ups.push(u) });
    await until(() => bad.state() === 'refused', 3000, 'refused');
    assert.deepEqual(ups, [], 'never in');
    assert.equal(r.stats().refused, 1, 'and not tried again');
    good.close(); bad.close();
  } finally { await r.close(); }
});

// ---- the relay's own frames, byte by byte ----
test('the relay speaks WebSocket itself: a health check, a message in fragments, a ping, and a client frame without a mask refused', async () => {
  await freshRelay();
  const net = require('node:net');
  assert.equal(await (await fetch('http://127.0.0.1:' + PORT + '/healthz')).text(), 'ok');
  const bad = new WebSocket('ws://127.0.0.1:' + PORT + '/not/a/room');
  await new Promise((r) => { bad.onerror = r; });
  assert.notEqual(bad.readyState, 1, 'no room, no connection');
  // a raw client: the handshake, then frames written by hand
  const raw = () => new Promise((res) => {
    const s = net.connect(PORT, '127.0.0.1'), key = crypto.randomBytes(16).toString('base64');
    let buf = Buffer.alloc(0), shook = false;
    s.frames = [];
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (!shook) { const i = buf.indexOf('\r\n\r\n'); if (i < 0) return; assert.match(buf.subarray(0, i).toString(), /^HTTP\/1\.1 101/); buf = buf.subarray(i + 4); shook = true; res(s); }
      while (buf.length >= 2) { const n = buf[1] & 0x7f, off = n === 126 ? 4 : 2, len = n === 126 ? buf.readUInt16BE(2) : n; if (buf.length < off + len) break; s.frames.push({ op: buf[0] & 15, data: buf.subarray(off, off + len) }); buf = buf.subarray(off + len); }
    });
    s.write('GET /w/satisfy/main HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
  });
  const out = (op, text, fin = true, mask = true) => {
    const d = Buffer.from(text), k = crypto.randomBytes(4), h = Buffer.from([(fin ? 0x80 : 0) | op, (mask ? 0x80 : 0) | d.length]);
    if (!mask) return Buffer.concat([h, d]);
    const m = Buffer.from(d); for (let i = 0; i < m.length; i++) m[i] ^= k[i & 3];
    return Buffer.concat([h, k, m]);
  };
  const b = SN.transports.ws(url(), { uid: 'u1' }), got = [];
  b.onmessage((e) => got.push(e.payload.k));
  const s = await raw();
  s.write(out(1, JSON.stringify({ t: 'hello', uid: 'u0' })));
  await until(() => s.frames.some((f) => f.op === 1 && /"ok"/.test(f.data)) && b.state() === 'open');
  // one message in three pieces
  const msg = JSON.stringify(SN.net.envelope('duel.hit', { to: 'u1', duel: 'd', k: 7 }, { sessionId: 's', seq: 1 }));
  s.write(Buffer.concat([out(1, msg.slice(0, 10), false), out(9, 'hi'), out(0, msg.slice(10, 30), false), out(0, msg.slice(30))]));
  await until(() => got.length === 1);
  assert.deepEqual(got, [7]);
  assert.ok(s.frames.some((f) => f.op === 0xA && f.data.toString() === 'hi'), 'the ping answered in between');
  // a continuation with nothing to continue, or a frame without a mask: closed
  s.write(out(1, 'x', true, false));
  await until(() => s.frames.some((f) => f.op === 8));
  assert.equal(s.frames.find((f) => f.op === 8).data.readUInt16BE(0), 1002);
  s.destroy(); b.close();
});
