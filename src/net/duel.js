/* Satisfy — consent-based duels (SAT-ONLINE-006, doc §09 R4). Runs on a Satisfy.presence client.
 *
 * Flow: challenge → accept → ready check (both) → 3 s countdown → fight → result.
 *   duel.challenge  A asks B (both outside safe zones, within CHALLENGE_R)
 *   duel.accept / duel.decline
 *   duel.ready      sent by each side when it is ready; the countdown starts when both are
 *   duel.hit        attacker → defender: k = damage (1..MAX_HIT), n = hit number
 *   duel.hp         defender → attacker: k = defender's duel HP after a hit (throttled)
 *   duel.yield      surrender, leaving the arena, a teleport, a real death, a safe zone
 *   duel.end        the defender's duel HP reached 0: k = 0
 * Every message carries payload.to (recipient uid) and payload.duel (duel id).
 *
 * Rules (doc §09): consent first; a countdown and a ready check; an arena (ARENA_R around the
 * midpoint at the start; outside for OUT_MS = yield); a combat lock (a jump of more than
 * TELEPORT_PX in one tick = yield); surrender, leaving and disconnect all end it; the result is
 * only win/loss: no gold, items, materials, durability or quest credit change hands.
 * Damage is normalized: every hit is MIN..MAX_HIT duel HP out of HP, whatever the levels.
 *
 * Trust model (no server yet): each side owns its own duel HP and applies the hits it receives
 * after checking rate (at most HITS_PER_S in any second, so network jitter that bunches two hits
 * together doesn't drop one) and range (attacker within HIT_RANGE of the defender's real
 * position). A modified client could ignore hits, but a duel has no stakes, so it gains nothing.
 * Open PvP with stakes (R5) needs Trusted Combat on a server.
 *
 * Exposes `Satisfy.duel.create({ presence, uid, now?, pos, zone, policy? })`.
 */
(function (root) {
  'use strict';

  var C = Object.freeze({
    HP: 100, MIN_HIT: 4, MAX_HIT: 18, HITS_PER_S: 4,
    CHALLENGE_R: 64, HIT_RANGE: 200, ARENA_R: 220, OUT_MS: 3000, TELEPORT_PX: 120,
    INVITE_MS: 30000, READY_MS: 20000, COUNTDOWN_MS: 3000, GRACE_MS: 6000, HP_MS: 200, OVER_MS: 4000,
  });
  var TYPES = ['duel.challenge', 'duel.accept', 'duel.decline', 'duel.ready', 'duel.hit', 'duel.hp', 'duel.yield', 'duel.end'];

  function create(o) {
    var P = o.presence, self = o.uid, now = o.now || function () { return Date.now(); };
    var pos = o.pos, zone = o.zone, blocked = o.blocked || function () { return false; }; // SAT-ONLINE-016
    var policy = o.policy || (root.Satisfy && root.Satisfy.net && root.Satisfy.net.zonePolicy) || function () { return { safe: false }; };
    var seq = 0, listeners = [];
    var incoming = new Map();   // duel id -> {duel, from, sid, handle, t}
    var d = null;               // the current duel
    var lastResult = null;

    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function byUid(uid) { var hit = null; P.remotes().forEach(function (r) { if (r.uid === uid) hit = r; }); return hit; }
    // a town, or a place the world doesn't define (zonePolicy known:false, SAT-ONLINE-019): no fighting there
    function noFight(z) { var p = policy(z) || {}; return !!p.safe || p.known === false; }
    function safeHere() { return noFight(zone()); }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function send(type, extra) {
      var pl = { to: d.foe, duel: d.id };
      if (extra) for (var k in extra) pl[k] = extra[k];
      P.send(type, pl);
    }
    // only [A-Za-z0-9_-]: the id goes into PlayerPublic.duel as "<id>:<hp>" (contracts DUEL_RE), and a
    // local-transport uid is "local:<hex>"
    function newId() { return 'd_' + String(self).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 20) + '_' + (now() | 0).toString(36) + (++seq).toString(36); }
    function start(id, foe, handle, mine) {
      d = { id: id, foe: foe, handle: handle || '', mine: !!mine, phase: mine ? 'asking' : 'ready',
        since: now(), meReady: false, foeReady: false, hp: C.HP, foeHp: C.HP, seen: now(),
        arena: null, outT: 0, last: null, hitsIn: [], hitN: 0, hpDirty: false, hpSent: 0 };
    }
    function finish(result, why, tell) {
      if (!d || d.phase === 'over') return;
      if (tell) send(tell.type, tell.extra);
      d.phase = 'over'; d.since = now();
      lastResult = { duel: d.id, foe: d.foe, handle: d.handle, result: result, why: why, hp: d.hp, foeHp: d.foeHp };
      emit({ type: 'result', result: result, why: why, handle: d.handle, foe: d.foe });
    }

    P.on(function (ev) {
      if (ev.type !== 'message') return;
      var env = ev.env, pl = env.payload || {};
      if (TYPES.indexOf(env.type) < 0 || pl.to !== self || typeof pl.duel !== 'string') return;
      var from = P.get(ev.sid);
      if (!from || !from.uid) return;
      var mineDuel = d && d.id === pl.duel && d.foe === from.uid;
      switch (env.type) {
        case 'duel.challenge':
          if (blocked(from.uid)) return; // no answer: the challenge just expires
          if (d && d.phase !== 'over') { P.send('duel.decline', { to: from.uid, duel: pl.duel }); return; }
          incoming.set(pl.duel, { duel: pl.duel, from: from.uid, sid: ev.sid, handle: from.handle, t: now() });
          emit({ type: 'challenge', duel: pl.duel, handle: from.handle });
          break;
        case 'duel.accept':
          if (!mineDuel || d.phase !== 'asking') return;
          d.phase = 'ready'; d.since = now();
          emit({ type: 'accepted', handle: d.handle });
          break;
        case 'duel.decline':
          if (!mineDuel || d.phase === 'over') return;
          d = null;
          emit({ type: 'declined', handle: from.handle });
          break;
        case 'duel.ready':
          if (!mineDuel || d.phase !== 'ready') return;
          d.foeReady = true;
          break;
        case 'duel.hit': {
          if (!mineDuel || d.phase !== 'fight') return;
          var t = now(), k = +pl.k;
          if (!(k >= 1)) return;
          d.hitsIn = d.hitsIn.filter(function (x) { return t - x < 1000; });
          if (d.hitsIn.length >= C.HITS_PER_S) { emit({ type: 'rejected', why: 'rate' }); return; }
          var me = pos(), r = byUid(from.uid);
          if (!r || dist(me, r) > C.HIT_RANGE) { emit({ type: 'rejected', why: 'range' }); return; }
          d.hitsIn.push(t);
          k = Math.min(C.MAX_HIT, Math.max(C.MIN_HIT, Math.round(k)));
          d.hp = Math.max(0, d.hp - k);
          emit({ type: 'hurt', dmg: k, hp: d.hp });
          if (d.hp <= 0) finish('lose', 'hp', { type: 'duel.end', extra: { k: 0 } });
          else d.hpDirty = true;
          break;
        }
        case 'duel.hp':
          if (!mineDuel || d.phase !== 'fight') return;
          if (+pl.k >= 0 && +pl.k <= C.HP) d.foeHp = +pl.k;
          break;
        case 'duel.yield':
          if (!mineDuel) { incoming.delete(pl.duel); return; }
          if (d.phase === 'asking' || d.phase === 'ready' || d.phase === 'countdown') { d = null; emit({ type: 'cancelled', handle: from.handle }); return; }
          finish('win', 'yield');
          break;
        case 'duel.end':
          if (!mineDuel || d.phase !== 'fight') return;
          d.foeHp = 0;
          finish('win', 'hp');
          break;
      }
    });

    var api = {
      /** Challenge a remote player. Returns 'sent' or a reason: bad, busy, safe, far. */
      challenge: function (remote) {
        if (!remote || !remote.uid || remote.uid === self) return 'bad';
        if (d && d.phase !== 'over') return 'busy';
        if (safeHere() || noFight(remote.zone)) return 'safe';
        if (dist(pos(), remote) > C.CHALLENGE_R) return 'far';
        start(newId(), remote.uid, remote.handle, true);
        send('duel.challenge');
        return 'sent';
      },
      /** The newest unanswered challenge, or null. */
      pendingChallenge: function () {
        var best = null;
        incoming.forEach(function (v) { if (!best || v.t > best.t) best = v; });
        return best;
      },
      accept: function (id) {
        var inv = incoming.get(id);
        if (!inv || (d && d.phase !== 'over')) return false;
        incoming.clear();
        if (safeHere()) { P.send('duel.decline', { to: inv.from, duel: id }); emit({ type: 'safeHere' }); return false; }
        start(id, inv.from, inv.handle, false);
        send('duel.accept');
        emit({ type: 'accepted', handle: inv.handle });
        return true;
      },
      decline: function (id) {
        var inv = incoming.get(id);
        if (!inv) return false;
        incoming.delete(id);
        P.send('duel.decline', { to: inv.from, duel: id });
        return true;
      },
      /** Ready check: this side is ready. The countdown starts once both are. */
      ready: function () {
        if (!d || d.phase !== 'ready' || d.meReady) return false;
        d.meReady = true;
        send('duel.ready');
        return true;
      },
      /**
       * The local attack reached the opponent (the game decides reach and aim). Sends the hit and
       * returns the damage, or 0 when no fight is on or the opponent is out of hit range.
       * @param {number} power 1..MAX_HIT, from the game's normalized roll
       */
      hit: function (power) {
        if (!d || d.phase !== 'fight') return 0;
        var r = byUid(d.foe);
        if (!r || dist(pos(), r) > C.HIT_RANGE) return 0;
        var k = Math.min(C.MAX_HIT, Math.max(C.MIN_HIT, Math.round(+power || 0)));
        send('duel.hit', { k: k, n: ++d.hitN });
        return k;
      },
      /** Surrender, or cancel before the fight. */
      yield: function (why) {
        if (!d) return false;
        if (d.phase === 'over') return false;
        if (d.phase !== 'fight') { send('duel.yield'); d = null; emit({ type: 'cancelled', why: why || 'yield' }); return true; }
        finish('lose', why || 'yield', { type: 'duel.yield' });
        return true;
      },
      foe: function () { return d && d.phase !== 'over' ? byUid(d.foe) : null; },
      /** For the HUD and tests. */
      state: function () {
        if (!d) return { phase: 'idle', last: lastResult };
        var t = now();
        return { phase: d.phase, duel: d.id, foe: d.foe, handle: d.handle, hp: d.hp, foeHp: d.foeHp,
          meReady: d.meReady, foeReady: d.foeReady, arena: d.arena ? { x: d.arena.x, y: d.arena.y, r: C.ARENA_R } : null,
          countdown: d.phase === 'countdown' ? Math.max(0, C.COUNTDOWN_MS - (t - d.since)) : 0, last: lastResult };
      },
      /** True while a fight or its countdown is running (the game blocks travel and safe zones). */
      locked: function () { return !!d && (d.phase === 'countdown' || d.phase === 'fight'); },
      /** Timers, arena, disconnects, throttled HP replies. Call about once per frame. */
      tick: function () {
        var t = now();
        incoming.forEach(function (v, k) { if (t - v.t > C.INVITE_MS) incoming.delete(k); });
        if (!d) return;
        var r = byUid(d.foe), me = pos();
        if (r) d.seen = t;
        if (d.phase === 'over') { if (t - d.since > C.OVER_MS) d = null; return; }
        if (!r && t - d.seen > C.GRACE_MS) {
          if (d.phase === 'fight' || d.phase === 'countdown') finish('win', 'gone');
          else { d = null; emit({ type: 'cancelled', why: 'gone' }); }
          return;
        }
        if (d.phase === 'asking') { if (t - d.since > C.INVITE_MS) { d = null; emit({ type: 'cancelled', why: 'timeout' }); } return; }
        if (d.phase === 'ready') {
          if (t - d.since > C.READY_MS) { api.yield('timeout'); return; }
          if (d.meReady && d.foeReady) {
            d.phase = 'countdown'; d.since = t;
            d.arena = r ? { x: (me.x + r.x) / 2, y: (me.y + r.y) / 2 } : { x: me.x, y: me.y };
            d.last = { x: me.x, y: me.y };
            emit({ type: 'countdown' });
          }
          return;
        }
        // countdown and fight: combat lock, arena, safe zones
        if (d.last && dist(me, d.last) > C.TELEPORT_PX) { api.yield('teleport'); return; }
        d.last = { x: me.x, y: me.y };
        if (safeHere()) { api.yield('safe'); return; }
        if (dist(me, d.arena) > C.ARENA_R) {
          if (!d.outT) { d.outT = t; emit({ type: 'outside' }); }
          else if (t - d.outT > C.OUT_MS) { api.yield('arena'); return; }
        } else d.outT = 0;
        if (d.phase === 'countdown' && t - d.since >= C.COUNTDOWN_MS) { d.phase = 'fight'; d.since = t; emit({ type: 'fight' }); }
        if (d.phase === 'fight' && d.hpDirty && t - d.hpSent >= C.HP_MS) { d.hpDirty = false; d.hpSent = t; send('duel.hp', { k: d.hp }); }
      },
      on: function (fn) { listeners.push(fn); },
    };
    return api;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.duel = Object.freeze({ create: create, C: C, TYPES: Object.freeze(TYPES.slice()) });
})(typeof window !== 'undefined' ? window : globalThis);
