/* Satisfy — WebSocket combat transport (SAT-ONLINE-148, plan U025 "world shard migration": the instance logic can move to
 * a WebSocket server without touching what is drawn). Needs src/net/transport-local.js first.
 *
 *   Satisfy.transports.ws(url, opts)        a transport over a WebSocket relay (backend/ws-relay.cjs), one room per shard
 *   Satisfy.transports.split(social, combat) one transport out of two: duels, open PvP and raid hits (COMBAT) go through
 *                                            `combat`; presence, parties, chat, trades and everything else stay on `social`
 *
 * Both are transports like the others ({ kind, send(envelope), onmessage(fn), close() }): best-effort, never an echo back to
 * the sender, every message a copy of its own; the same contract tests run over the in-memory hub and over the relay
 * (tests/unit/transport-ws.test.cjs). Everything received is still untrusted: presence, duel, pvp and raid check it as before.
 *
 * ws(url, opts): opts.token() → Promise<Firebase ID token> proves the account to a relay that checks it (--project); a relay
 * on this computer only takes opts.uid as it is. opts.bind: a remote session is known by uid + session id, as the Firebase transport
 * does (the uid is the one the relay proved), so nobody can send as another account. Messages sent before the relay has
 * accepted the hello wait (at most QUEUE_MAX, for QUEUE_MS); a dropped connection is tried again (250 ms doubling to 5 s),
 * unless a newer connection of the same account replaced it or the relay refused the account. opts.onConnection(up) on
 * each change.
 */
(function (root) {
  'use strict';

  var COMBAT = /^(duel|pvp|raid)\./;
  var QUEUE_MAX = 64, QUEUE_MS = 2000, RETRY_MS = 250, RETRY_MAX_MS = 5000;

  function ws(url, o) {
    o = o || {};
    var WS = o.WebSocket || root.WebSocket;
    if (typeof WS !== 'function') throw new Error('no WebSocket here');
    var handler = null, sock = null, up = false, closed = false, ended = null, q = [], tries = 0, timer = null;
    var stats = { sent: 0, recv: 0, dropped: 0, reconnects: 0 };

    function hello() {
      return Promise.resolve(o.token ? o.token() : null).then(function (tk) {
        return tk ? { t: 'hello', token: String(tk), uid: o.uid || null } : { t: 'hello', uid: o.uid || null };
      });
    }
    function connect() {
      if (closed) return;
      var s;
      try { s = new WS(url); } catch (e) { retry(); return; }
      sock = s;
      s.onopen = function () {
        hello().then(function (h) { if (sock === s && s.readyState === 1) s.send(JSON.stringify(h)); }, function () { try { s.close(); } catch (e) { /* ignore */ } });
      };
      s.onmessage = function (ev) {
        if (sock !== s) return;
        var m;
        try { m = typeof ev.data === 'string' ? JSON.parse(ev.data) : null; } catch (e) { return; }
        if (!m || typeof m !== 'object') return;
        if (m.t === 'ok') { up = true; tries = 0; flush(); if (o.onConnection) o.onConnection(true); return; }
        if (m.t !== 'm' || !up) return;
        var env = m.e;
        if (!env || typeof env !== 'object' || typeof env.sessionId !== 'string') return;
        if (o.bind) { if (typeof m.f !== 'string' || !m.f) return; env.sessionId = m.f + '.' + env.sessionId; }
        stats.recv++;
        if (handler) handler(env);
      };
      // a browser follows an error with a close; Node's WebSocket may not when the connection never opened. The close (with
      // its code) goes first when there is one; else the error stands for it
      s.onerror = function () { setTimeout(function () { down(s, null); }, 50); };
      s.onclose = function (ev) { down(s, ev); };
    }
    function down(s, ev) {
      if (sock !== s) return;
      sock = null;
      var was = up; up = false;
      // replaced by a newer connection of the same account (another tab took over), or the account refused: not tried again
      var code = ev && ev.code;
      if (code === 4000 || code === 4001) { ended = code === 4000 ? 'replaced' : 'refused'; closed = true; q = []; }
      if (was && o.onConnection) o.onConnection(false);
      try { s.onopen = s.onmessage = s.onerror = s.onclose = null; if (s.readyState < 2) s.close(); } catch (e) { /* ignore */ }
      retry();
    }
    function retry() {
      if (closed || timer) return;
      var ms = Math.min(RETRY_MAX_MS, RETRY_MS * Math.pow(2, tries++));
      stats.reconnects++;
      timer = setTimeout(function () { timer = null; connect(); }, ms);
    }
    function flush() {
      var t = Date.now();
      while (q.length && up && sock) {
        var x = q.shift();
        if (t - x.t > QUEUE_MS) { stats.dropped++; continue; } // a hit from seconds ago is not sent late
        try { sock.send(x.s); } catch (e) { stats.dropped++; }
      }
    }
    connect();
    return {
      kind: 'ws',
      send: function (env) {
        if (closed || !env) return;
        var s;
        try { s = JSON.stringify(env); } catch (e) { return; }
        stats.sent++;
        if (up && sock) { try { sock.send(s); } catch (e) { stats.dropped++; } return; }
        q.push({ t: Date.now(), s: s });
        if (q.length > QUEUE_MAX) { q.shift(); stats.dropped++; }
      },
      onmessage: function (fn) { handler = fn; },
      /** 'connecting' (or trying again), 'open' (the relay accepted the hello), 'closed', 'replaced' or 'refused' */
      state: function () { return ended || (closed ? 'closed' : up ? 'open' : 'connecting'); },
      wsStats: function () { return { sent: stats.sent, recv: stats.recv, dropped: stats.dropped, reconnects: stats.reconnects, queued: q.length }; },
      close: function () {
        if (closed) return;
        closed = true; handler = null; q = [];
        if (timer) { clearTimeout(timer); timer = null; }
        var s = sock; sock = null; up = false;
        if (s) { try { s.close(1000); } catch (e) { /* ignore */ } }
      },
    };
  }

  // The social transport's own extras (world feeds, the interest queries, serverOffset, netStats...) stay reachable as they
  // were, and `kind` stays the social one, so the game treats it as it did. A combat message is taken only from the combat
  // path: the shard's combat is on the relay or in the database, not both (a rollback turns the relay off for everyone).
  // chanOf: presence keeps the order per path, so a remote's combat messages are counted apart from its other ones.
  function split(social, combat, isCombat) {
    var isC = isCombat || function (type) { return COMBAT.test(type); };
    var handler = null, out = {};
    for (var k in social) if (typeof social[k] === 'function' && k !== 'send' && k !== 'onmessage' && k !== 'close') out[k] = social[k].bind(social);
    social.onmessage(function (env) { if (!handler || !env || typeof env.type !== 'string' || isC(env.type)) return; handler(env); });
    combat.onmessage(function (env) { if (!handler || !env || typeof env.type !== 'string' || !isC(env.type)) return; handler(env); });
    out.kind = social.kind;
    out.via = combat.kind;
    out.combat = combat;
    out.send = function (env) { if (!env || typeof env.type !== 'string') return; (isC(env.type) ? combat : social).send(env); };
    out.onmessage = function (fn) { handler = fn; };
    out.chanOf = function (type) { return /^presence\./.test(type) ? 'seq' : isC(type) ? 'cseq' : 'mseq'; };
    out.close = function () { handler = null; try { combat.close(); } catch (e) { /* ignore */ } try { social.close(); } catch (e) { /* ignore */ } };
    // another tab took the account over (the Firebase transport's release): the relay connection goes too
    if (typeof social.release === 'function') out.release = function () { try { combat.close(); } catch (e) { /* ignore */ } return social.release.apply(social, arguments); };
    return out;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  var t = {};
  for (var n in ns.transports || {}) t[n] = ns.transports[n];
  t.ws = ws; t.split = split; t.COMBAT = COMBAT;
  ns.transports = Object.freeze(t);
})(typeof window !== 'undefined' ? window : globalThis);
