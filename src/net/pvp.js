/* Satisfy — open PvP outside towns (SAT-ONLINE-038, owner 2026-10-19). Runs on a Satisfy.presence client.
 *
 * Any two players can hurt each other outside safe zones, the same way duels work, with no challenge first:
 *   pvp.hit   attacker → victim: k = damage in per-mille of the victim's max HP (MIN_HIT..MAX_HIT), n = hit number
 *   pvp.kill  victim → attacker: that hit killed me (k = 0); the attacker is an outlaw for OUTLAW_MS
 * Every message carries payload.to (recipient uid).
 *
 * Rules: no fighting in towns or in a place the world doesn't define (zonePolicy safe / known:false), on either side;
 * no friendly fire inside a party or between allied guilds (SAT-ONLINE-085: o.ally(r) says r is in a guild allied with
 * ours); nobody in a duel is part of open PvP (the duel has its own hits); a dead player
 * takes no hits. Damage is capped: each hit is MIN_HIT..MAX_HIT per mille of the victim's max HP whatever the levels,
 * so nobody dies to one blow. Dying to a player costs the normal death penalty only (the game's die()); nothing
 * changes hands.
 *
 * Trust model (no server yet, as for duels): the victim applies the hits it receives after checking the rate (at
 * most HITS_PER_S in any second), the range (attacker within HIT_RANGE of the victim's real position), the zones and
 * the party. The victim's own zone is the one that counts for it (U026/U027: inside a town no hit is taken, whatever a
 * modified attacker sends or says about itself), and with o.zoneAt the attacker's reported spot is checked on the
 * victim's own map too, so one standing in a town can't hit out by naming another zone. The outlaw mark is set by the killer's own client when the victim reports the kill, and only for a
 * player it really hit in the last KILL_MS. A modified client could ignore hits or hide its mark; Trusted Combat on a
 * server (R5) closes that later.
 *
 * Exposes `Satisfy.pvp.create({ presence, uid, now?, pos, zone, room?, party, ally?, busy?, alive?, policy?, zoneAt? })`.
 *   pos(): {x, y} of the local player; zone(): its zone id; room(): its house interior id or null; party(): its party id or null;
 *   ally(r): true when remote r is in a guild allied with ours; busy(): true while in a duel; alive(): false while dead.
 *   zoneAt(x, y) (optional): the zone id at a world position, from the local map (the game's netZone).
 */
(function (root) {
  'use strict';

  var C = Object.freeze({
    MIN_HIT: 30, MAX_HIT: 90, HITS_PER_S: 4, HIT_RANGE: 200, KILL_MS: 8000, OUTLAW_MS: 10 * 60 * 1000,
  });
  var TYPES = ['pvp.hit', 'pvp.kill'];

  function create(o) {
    var P = o.presence, self = o.uid, now = o.now || function () { return Date.now(); };
    var pos = o.pos, zone = o.zone, party = o.party || function () { return null; }, room = o.room || function () { return null; };
    var busy = o.busy || function () { return false; }, alive = o.alive || function () { return true; };
    var zoneAt = typeof o.zoneAt === 'function' ? o.zoneAt : null;
    var ally = o.ally || function () { return false; };
    var policy = o.policy || (root.Satisfy && root.Satisfy.net && root.Satisfy.net.zonePolicy) || function () { return { safe: false }; };
    var listeners = [], hitsIn = new Map(), hitsOut = [], hitN = 0;
    var struck = new Map(); // uid -> last time we hit them (a kill report only counts for those)

    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function noFight(z) { var p = policy(z) || {}; return !!p.safe || p.known === false; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function mate(r) { var id = party(); return !!id && r.party === id; }
    // why a hit between us and remote r can't happen, or null
    function why(r) {
      if (!r || !r.uid || r.uid === self) return 'bad';
      if ((r.room || null) !== (room() || null)) return 'room';
      if (noFight(zone()) || noFight(r.zone)) return 'safe';
      if (zoneAt && typeof r.x === 'number' && typeof r.y === 'number' && noFight(zoneAt(r.x, r.y))) return 'safe'; // where it really is, on our map
      if (mate(r)) return 'mate';
      if (ally(r)) return 'ally';
      if (busy() || r.duel) return 'duel';
      if (!alive() || r.anim === 'dead') return 'dead';
      return null;
    }

    P.on(function (ev) {
      if (ev.type !== 'message') return;
      var env = ev.env, pl = env.payload || {};
      if (TYPES.indexOf(env.type) < 0 || pl.to !== self) return;
      var from = P.get(ev.sid);
      if (!from || !from.uid) return;
      var t = now();
      if (env.type === 'pvp.hit') {
        var k = +pl.k;
        if (!(k >= 1)) return;
        var no = why(from);
        if (no) { emit({ type: 'rejected', why: no }); return; }
        if (dist(pos(), from) > C.HIT_RANGE) { emit({ type: 'rejected', why: 'range' }); return; }
        var list = (hitsIn.get(from.uid) || []).filter(function (x) { return t - x < 1000; });
        if (list.length >= C.HITS_PER_S) { emit({ type: 'rejected', why: 'rate' }); return; }
        list.push(t); hitsIn.set(from.uid, list);
        k = Math.min(C.MAX_HIT, Math.max(C.MIN_HIT, Math.round(k)));
        emit({ type: 'hurt', pm: k, uid: from.uid, handle: from.handle || '' });
      } else if (env.type === 'pvp.kill') {
        var at = struck.get(from.uid);
        if (at == null || t - at > C.KILL_MS) return; // we didn't hit them: not our kill
        struck.delete(from.uid);
        emit({ type: 'kill', uid: from.uid, handle: from.handle || '' });
      }
    });

    var api = {
      /** Can the local player hit remote r right now? Returns null, or why not: bad, room, safe, mate, ally, duel, dead. */
      why: why,
      /** Send one hit of power pow (game units). Returns the per-mille sent (0 when it can't land or is too fast). */
      hit: function (r, pow) {
        if (why(r)) return 0;
        var t = now();
        hitsOut = hitsOut.filter(function (x) { return t - x < 1000; });
        if (hitsOut.length >= C.HITS_PER_S) return 0;
        hitsOut.push(t);
        var k = Math.min(C.MAX_HIT, Math.max(C.MIN_HIT, Math.round(pow * 4)));
        struck.set(r.uid, t);
        P.send('pvp.hit', { to: r.uid, k: k, n: ++hitN });
        return k;
      },
      /** The local player died to a hit from uid: tell them (they turn outlaw). */
      died: function (uid) { if (uid && uid !== self) P.send('pvp.kill', { to: uid, k: 0 }); },
      on: function (fn) { listeners.push(fn); },
    };
    return api;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.pvp = Object.freeze({ create: create, C: C, TYPES: TYPES });
})(typeof window !== 'undefined' ? window : globalThis);
