/* Satisfy — party raid with one shared boss (SAT-ONLINE-009, doc §10 R6). Runs on presence + party.
 *
 * Every client still simulates its own monsters. For a boss, the party leader is the *host*: its copy
 * of the boss is the one that counts.
 *   raid.hit    member → host: k = damage, n = hit number          (the member undoes it locally)
 *   raid.state  host → members: k = boss HP, n = boss max HP       (≤ 4/s while it changes)
 *   raid.kill   host → each member who hit it: raid = "<boss>~<encounter>"
 * payload.raid is the boss key ("<type>@<spawn x>,<spawn y>", the same on every client) or, for a
 * kill, the boss key plus the encounter id. Members show the host's HP as a share of their own
 * copy's max (levels are rolled per client), and their copy dies only when raid.kill arrives.
 * Each member then gets the normal kill rewards from its own game, once per encounter: the game
 * keeps the encounter ids it has claimed in the save, so a duplicate message or a reload can't
 * pay twice (doc §10: exactly-once from the game's point of view, by idempotency, not delivery).
 *
 * Trust: the host is a player, not a server. A modified host could lie about HP; nothing of
 * value moves between players, and each reward is still computed by the receiver's own game.
 * When the host leaves, the party dissolves and every client fights its own boss again.
 *
 * Exposes `Satisfy.raid.create({ presence, party, uid, now?, local })`, where local is the game:
 *   local.boss(key) -> {hp, max} | null    a live boss with that key
 *   local.setHp(key, ratio)                member: show the host's HP
 *   local.kill(key)                        member: kill the local copy with normal rewards
 *   local.claimed(enc) -> bool, local.claim(enc)    the saved list of paid encounters
 */
(function (root) {
  'use strict';

  // HIT_MAX: late-game hits pass 5000 (review of #29). CONFIRM_MS: a member hands its hits to the host only while the host
  // has sent raid.state for that boss this recently, i.e. it has that boss alive (SAT-ONLINE-032)
  var C = Object.freeze({ STATE_MS: 250, HIT_MAX: 1e12, ENC_TTL_MS: 300000, CONFIRM_MS: 1500 }); // SAT-ONLINE-214: late-game hits pass 1,000,000 (bosses of 60,000,000 HP)
  var TYPES = ['raid.hit', 'raid.state', 'raid.kill'];

  function create(o) {
    var P = o.presence, party = o.party, self = o.uid, L = o.local, now = o.now || function () { return Date.now(); };
    var encs = new Map();   // host: boss key -> {enc, hitters:Set, dirty, sent, t}
    var seq = 0, listeners = [];
    var conf = new Map();   // member: boss key -> when the host last sent its HP

    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function inParty() { return !!(party.id() && party.members().length >= 2); }
    function isHost() { return inParty() && party.isLeader(); }
    function isMember() { return inParty() && !party.isLeader() && !!party.leader(); }
    function enc(key) {
      var e = encs.get(key);
      if (!e) { e = { enc: (now() | 0).toString(36) + (++seq).toString(36), hitters: new Set(), dirty: false, sent: 0, t: now() }; encs.set(key, e); }
      e.t = now();
      return e;
    }
    function members() { return party.members().filter(function (m) { return !m.self; }).map(function (m) { return m.uid; }); }

    P.on(function (ev) {
      if (ev.type !== 'message') return;
      var env = ev.env, pl = env.payload || {};
      if (TYPES.indexOf(env.type) < 0 || pl.to !== self || typeof pl.raid !== 'string') return;
      var from = P.get(ev.sid);
      if (!from || !from.uid) return;
      switch (env.type) {
        case 'raid.hit': {
          // only the host takes hits, and only from members of its own party
          if (!isHost() || members().indexOf(from.uid) < 0) return;
          var k = Math.round(+pl.k);
          if (!(k >= 1 && k <= C.HIT_MAX)) return;
          var b = L.boss(pl.raid);
          if (!b) return;
          var e = enc(pl.raid);
          e.hitters.add(from.uid);
          e.dirty = true;
          emit({ type: 'hit', boss: pl.raid, from: from.uid, k: k });
          if (L.damage) L.damage(pl.raid, k); // the game applies it to its copy (and kills it at 0)
          break;
        }
        case 'raid.state': {
          if (!isMember() || from.uid !== party.leader()) return;
          var hp = +pl.k, max = +pl.n;
          if (!(max > 0) || !(hp >= 0)) return;
          conf.set(pl.raid, now());
          if (L.boss(pl.raid)) L.setHp(pl.raid, Math.max(0, Math.min(1, hp / max)));
          break;
        }
        case 'raid.kill': {
          if (from.uid !== party.leader()) return;
          var cut = pl.raid.lastIndexOf('~');
          if (cut <= 0) return;
          var key = pl.raid.slice(0, cut), id = pl.raid.slice(cut + 1), encId = from.uid + ':' + id;
          if (L.claimed(encId)) { emit({ type: 'duplicate', boss: key }); return; }
          L.claim(encId);
          if (L.boss(key)) L.kill(key);
          emit({ type: 'killed', boss: key, enc: encId });
          break;
        }
      }
    });

    var api = {
      isHost: isHost,
      isMember: isMember,
      /**
       * The local player hit boss `key` for `k`. A member sends it to the host and returns true: the
       * caller must undo the local damage and not kill its copy. The host (or anyone not in a
       * party) returns false and keeps the normal single-player flow.
       */
      hit: function (key, k) {
        if (isMember()) {
          P.send('raid.hit', { to: party.leader(), raid: key, k: Math.max(1, Math.min(C.HIT_MAX, Math.round(k))), n: ++seq });
          // Until the host confirms it has this boss (raid.state), the hit lands on our own copy too: a tower or trial
          // boss only we have, or one the host killed solo and is waiting to respawn, is fought locally (review #29).
          // The host's next raid.state replaces our copy's HP with the shared one.
          return conf.has(key) && now() - conf.get(key) < C.CONFIRM_MS;
        }
        if (isHost()) { var e = enc(key); e.hitters.add(self); e.dirty = true; }
        return false;
      },
      /** Host: its copy of boss `key` died. Tells every member who hit it. */
      killed: function (key) {
        if (!isHost()) return;
        var e = encs.get(key);
        if (!e) return;
        var ms = members();
        e.hitters.forEach(function (uid) { if (uid !== self && ms.indexOf(uid) >= 0) P.send('raid.kill', { to: uid, raid: key + '~' + e.enc }); });
        encs.delete(key);
        emit({ type: 'hostKilled', boss: key, enc: self + ':' + e.enc });
      },
      /** Host: send changed boss HP to the party (throttled); forget old encounters. */
      tick: function () {
        var t = now();
        encs.forEach(function (e, key) {
          if (t - e.t > C.ENC_TTL_MS) { encs.delete(key); return; }
          if (!isHost() || !e.dirty || t - e.sent < C.STATE_MS) return;
          var b = L.boss(key);
          if (!b) return;
          e.dirty = false; e.sent = t;
          members().forEach(function (uid) { P.send('raid.state', { to: uid, raid: key, k: Math.max(0, Math.round(b.hp)), n: Math.max(1, Math.round(b.max)) }); });
        });
      },
      /** Host: mark a boss changed outside raid.hit (its own hits, skills, companions). */
      touch: function (key) { if (isHost() && encs.has(key)) encs.get(key).dirty = true; },
      encounters: function () { var out = {}; encs.forEach(function (e, k) { out[k] = { enc: e.enc, hitters: Array.from(e.hitters) }; }); return out; },
      on: function (fn) { listeners.push(fn); },
    };
    return api;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.raid = Object.freeze({ create: create, C: C, TYPES: Object.freeze(TYPES.slice()) });
})(typeof window !== 'undefined' ? window : globalThis);
