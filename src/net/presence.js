/* Satisfy — presence client (SAT-ONLINE-002). Transport-agnostic; needs src/net/contracts.js first.
 *
 * Publishes the local PlayerPublic at a limited rate and keeps a table of remote players with
 * interpolated positions. It knows nothing about the network: a transport only has
 *   send(envelope) · onmessage(fn) · close()
 * (local BroadcastChannel today, Firebase RTDB in SAT-ONLINE-004). Everything received is
 * untrusted: invalid, oversized, replayed or too-frequent messages are dropped.
 *
 * Exposes `Satisfy.presence.create(opts)`.
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    moveHz: 10,       // send rate while position/dir/anim changes
    idleHz: 1,        // heartbeat while standing still
    expireMs: 5000,   // drop a remote player not heard from for this long
    interpMs: 100,    // draw remotes this far in the past, between two snapshots
    snapPx: 64,       // a jump larger than this (door, teleport) is not interpolated
    maxPerSec: 30,    // per-sender message budget
    maxRemotes: 64,
    bufLen: 8,
  };

  function randomId() {
    var b = new Uint8Array(12);
    var c = root.crypto;
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (var i = 0; i < b.length; i++) b[i] = (Math.random() * 256) | 0;
    return Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
  }

  function sample(buf, t, snapPx) {
    var last = buf[buf.length - 1];
    if (t >= last.t) return last;
    if (t <= buf[0].t) return buf[0];
    for (var i = buf.length - 1; i > 0; i--) {
      var a = buf[i - 1], b = buf[i];
      if (t >= a.t && t <= b.t) {
        if (Math.abs(b.x - a.x) > snapPx || Math.abs(b.y - a.y) > snapPx) return b;
        var k = (t - a.t) / ((b.t - a.t) || 1);
        return { t: t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return last;
  }

  /**
   * @param {{transport:object, net?:object, now?:function():number, sid?:string, uid?:string,
   *          world?:object, config?:object}} opts
   */
  function create(opts) {
    var NET = opts.net || (root.Satisfy && root.Satisfy.net);
    if (!NET) throw new Error('Satisfy.net (src/net/contracts.js) must load first');
    var transport = opts.transport;
    var now = opts.now || function () { return Date.now(); };
    var cfg = {};
    for (var k in DEFAULTS) cfg[k] = (opts.config && opts.config[k] != null) ? opts.config[k] : DEFAULTS[k];
    var sid = opts.sid || randomId();
    var uid = opts.uid || ('local:' + sid);
    var remotes = new Map();
    var listeners = [];
    var stats = { sent: 0, recv: 0, dropped: 0 };
    var seq = 0, lastSent = -Infinity, lastPP = null, closed = false;

    function emit(ev) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](ev); } catch (e) { /* listener bug must not stop presence */ } } }
    function drop() { stats.dropped++; }

    function onMessage(env) {
      if (closed) return;
      if (!env || typeof env !== 'object' || env.v !== NET.PROTOCOL_VERSION || typeof env.sessionId !== 'string') return drop();
      if (env.sessionId === sid) return;
      var t = now();
      var r = remotes.get(env.sessionId);
      // presence and directed messages may travel different paths (Firebase: presence node vs inbox),
      // so order is only guaranteed within a channel; replay checks are per channel
      var chan = (env.type === 'presence.state' || env.type === 'presence.leave') ? 'seq' : 'mseq';
      if (r) {
        r.win = r.win.filter(function (x) { return t - x < 1000; });
        if (r.win.length >= cfg.maxPerSec) return drop();
        if (!(env.seq > r[chan])) return drop(); // replay or out of order
      }
      if (env.type === 'presence.leave') {
        if (r) { remotes.delete(env.sessionId); emit({ type: 'leave', sid: env.sessionId, reason: 'left' }); }
        return;
      }
      if (env.type !== 'presence.state') {
        if (!r) return drop(); // other messages only from players we can see
        r.win.push(t); r.mseq = env.seq;
        emit({ type: 'message', sid: env.sessionId, env: env });
        return;
      }
      var pp = env.payload;
      if (!NET.validatePlayerPublic(pp, { world: opts.world }).ok || pp.sid !== env.sessionId) return drop();
      var fresh = !r;
      if (fresh) {
        if (remotes.size >= cfg.maxRemotes) return drop();
        r = { sid: env.sessionId, buf: [], win: [], seq: -1, mseq: -1 };
        remotes.set(env.sessionId, r);
      }
      r.win.push(t);
      r.seq = env.seq;
      if (r.pp && r.pp.room !== pp.room) r.buf = [];
      r.pp = pp;
      r.seen = t;
      r.buf.push({ t: t, x: pp.x, y: pp.y });
      if (r.buf.length > cfg.bufLen) r.buf.shift();
      stats.recv++;
      if (fresh) emit({ type: 'join', sid: env.sessionId, player: pp });
    }

    transport.onmessage(onMessage);

    function sendEnv(type, payload) {
      seq++;
      transport.send(NET.envelope(type, payload, { sessionId: sid, seq: seq }));
      stats.sent++;
    }

    return {
      sid: sid,
      uid: uid,
      /** Offer the latest local state; sends only when the rate limit allows. Returns true if sent. */
      publish: function (pp, force) {
        if (closed || !pp) return false;
        var t = now();
        var changed = !lastPP || pp.x !== lastPP.x || pp.y !== lastPP.y || pp.dir !== lastPP.dir || pp.anim !== lastPP.anim || pp.hp !== lastPP.hp || pp.fx !== lastPP.fx;
        var meta = !lastPP || pp.room !== lastPP.room || pp.zone !== lastPP.zone || pp.lv !== lastPP.lv ||
          pp.handle !== lastPP.handle || pp.arm !== lastPP.arm || pp.party !== lastPP.party || pp.duel !== lastPP.duel || pp.mv !== lastPP.mv || pp.em !== lastPP.em || pp.role !== lastPP.role || pp.rs !== lastPP.rs || JSON.stringify(pp.look) !== JSON.stringify(lastPP.look);
        var gap = 1000 / (changed ? cfg.moveHz : cfg.idleHz);
        if (!force && !meta && t - lastSent < gap) return false;
        sendEnv('presence.state', pp);
        lastSent = t;
        lastPP = pp;
        return true;
      },
      /** Send any other envelope type (party.*, later chat) to everyone on the transport. */
      send: function (type, payload) { if (!closed) sendEnv(type, payload); },
      /** Expire silent players. Call once per frame or so. */
      tick: function () {
        var t = now();
        remotes.forEach(function (r, id) {
          if (t - r.seen > cfg.expireMs) { remotes.delete(id); emit({ type: 'leave', sid: id, reason: 'timeout' }); }
        });
      },
      /** Remote players with interpolated x/y (copies; safe to keep). */
      remotes: function () {
        var t = now() - cfg.interpMs, out = [];
        remotes.forEach(function (r) {
          var p = sample(r.buf, t, cfg.snapPx), o = {};
          for (var f in r.pp) o[f] = r.pp[f];
          o.x = p.x; o.y = p.y;
          out.push(o);
        });
        return out;
      },
      get: function (id) { var r = remotes.get(id); return r ? r.pp : null; },
      count: function () { return remotes.size; },
      on: function (fn) { listeners.push(fn); },
      stats: function () { return { sent: stats.sent, recv: stats.recv, dropped: stats.dropped }; },
      close: function () {
        if (closed) return;
        try { sendEnv('presence.leave', {}); } catch (e) { /* ignore */ }
        closed = true;
        remotes.clear();
        try { transport.close(); } catch (e) { /* ignore */ }
      },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.presence = Object.freeze({ create: create, DEFAULTS: Object.freeze(DEFAULTS), randomId: randomId });
})(typeof window !== 'undefined' ? window : globalThis);
