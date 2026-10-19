/* Satisfy — party (SAT-ONLINE-003). Runs on top of a Satisfy.presence client; no server yet.
 *
 * A party belongs to its leader: id = 'p_' + leaderUid. The leader invites (party.invite), the invitee
 * answers (party.accept / party.decline), the leader can remove someone (party.kick). Every message is
 * addressed with payload.to = recipient uid and ignored by everyone else. Membership is published in
 * PlayerPublic.party, so the game draws party members from presence.
 *
 * Trust model until Server Authority: the leader counts only players who accepted its invite;
 * members follow the leader and leave when the leader disappears. A party grants nothing yet
 * (no shared XP or loot), so a modified client gains nothing by faking membership.
 *
 * Pings (SAT-ONLINE-021, doc §35 U052): party.ping {to, party, k: x, n: y} marks a map spot for every other
 * member for 3 s, at most one per member every PING_MS.
 *
 * Rejoin (SAT-ONLINE-023, doc §35 U065): with `store` (the tab's sessionStorage) a party survives a reload or a
 * short disconnect. The party is kept in the store; a member who comes back auto-accepts its old leader's invite
 * for the same party within REJOIN_MS, and a leader who comes back (or sees a member drop out) invites the
 * dropped members back for REJOIN_MS. Leaving on purpose tells the leader (party.decline) and forgets it.
 *
 * Leader election (SAT-ONLINE-024, doc §35 U049): when the leader has been gone LEAD_MS and at least two members
 * remain, every member picks the same new leader, the remaining member with the lowest uid, and the party moves to
 * that leader's id. A leader that comes back to find its members in another party drops its own and takes that
 * party's invite back. A member left alone still dissolves after GRACE_MS, as before.
 *
 * Exposes `Satisfy.party.create({ presence, uid, now?, max?, blocked?, store?, wall? })`.
 */
(function (root) {
  'use strict';

  var MAX = 5;
  var INVITE_MS = 30000;  // an unanswered invite expires
  var GRACE_MS = 5000;    // presence may lag; a member/leader missing this long has left
  var PING_MS = 1500;     // pings: at most one per member this often (sent and received)
  var REJOIN_MS = 60000;  // a dropped member or a reloaded tab can come back this long (wall clock)
  var LEAD_MS = 15000;    // a leader gone this long (longer than a reload) is replaced by the remaining members
  var KEY = 'satisfy_party';

  function idFor(uid) { return 'p_' + String(uid).slice(0, 38); }

  function create(o) {
    var P = o.presence, self = o.uid, now = o.now || function () { return Date.now(); }, max = o.max || MAX;
    var blocked = o.blocked || function () { return false; }; // SAT-ONLINE-016: invites from them are dropped silently
    var id = null, leader = null;
    var accepted = new Map();   // leader: uid -> last time presence showed them in the party
    var outgoing = new Map();   // leader: uid -> invite time
    var invites = new Map();    // invitee: partyId -> {party, from, sid, handle, t}
    var leaderOk = 0, listeners = [], pingOut = -1e9, pingIn = new Map();
    var store = o.store || null, wall = o.wall || function () { return Date.now(); };
    var recent = new Map(); // leader: uid -> wall time they dropped out; invited back until REJOIN_MS
    var memo = null;        // member: {id, leader, t}: auto-accept that leader's invite to that party
    var savedSig = '', savedAt = -1e15;
    var mates = [];         // member: the other members seen while the leader was there (the electorate)
    function save() {
      if (!store || !id) return;
      var s = JSON.stringify({ id: id, leader: leader, members: leader === self ? Array.from(accepted.keys()).concat(Array.from(recent.keys())) : [] });
      // rewritten when it changes and every few seconds anyway: its time says how recently we were in the party
      if (s === savedSig && wall() - savedAt < 5000) return;
      savedSig = s; savedAt = wall();
      try { var v = JSON.parse(s); v.t = wall(); store.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage full or blocked: no rejoin */ }
    }
    function forget() { memo = null; savedSig = ''; if (store) try { store.removeItem(KEY); } catch (e) { /* ignore */ } }
    (function restore() {
      if (!store) return;
      var s = null;
      try { s = JSON.parse(store.getItem(KEY) || 'null'); } catch (e) { s = null; }
      if (!s || typeof s.id !== 'string' || typeof s.leader !== 'string' || !(wall() - s.t < REJOIN_MS)) { forget(); return; }
      if (s.leader === self && s.id === idFor(self)) {
        if (!(Array.isArray(s.members) && s.members.length)) { forget(); return; } // only invites out: nothing to come back to
        id = s.id; leader = self;
        (Array.isArray(s.members) ? s.members : []).forEach(function (u) { if (typeof u === 'string' && u !== self) recent.set(u, s.t); });
      } else memo = { id: s.id, leader: s.leader, t: s.t };
    })();

    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function byUid(uid) { var hit = null; P.remotes().forEach(function (r) { if (r.uid === uid) hit = r; }); return hit; }
    function clear() { id = null; leader = null; accepted.clear(); outgoing.clear(); recent.clear(); leaderOk = 0; savedSig = ''; mates = []; }
    function send(type, to) { P.send(type, { to: to, party: id }); }

    P.on(function (ev) {
      if (ev.type !== 'message') return;
      var env = ev.env, pl = env.payload || {};
      if (pl.to !== self || typeof pl.party !== 'string') return;
      var from = P.get(ev.sid);
      if (!from || !from.uid) return;
      switch (env.type) {
        case 'party.invite':
          if (pl.party !== idFor(from.uid)) return;           // only a leader invites, and only to its own party
          if (blocked(from.uid)) return;                       // no answer: their invite just expires
          if (id) { P.send('party.decline', { to: from.uid, party: pl.party }); return; }
          invites.set(pl.party, { party: pl.party, from: from.uid, sid: ev.sid, handle: from.handle, t: now() });
          if (memo && memo.id === pl.party && memo.leader === from.uid && wall() - memo.t < REJOIN_MS) {
            memo = null; api.accept(pl.party, true); emit({ type: 'rejoined', handle: from.handle }); return; // our party, back after a reload
          }
          emit({ type: 'invite', party: pl.party, handle: from.handle });
          break;
        case 'party.accept':
          if (!id || leader !== self || pl.party !== id || !outgoing.has(from.uid)) return;
          outgoing.delete(from.uid);
          if (accepted.size + 1 >= max) { P.send('party.kick', { to: from.uid, party: id }); emit({ type: 'full', handle: from.handle }); return; }
          accepted.set(from.uid, now());
          emit({ type: 'joined', uid: from.uid, handle: from.handle });
          break;
        case 'party.decline':
          if (outgoing.delete(from.uid)) emit({ type: 'declined', handle: from.handle });
          else if (id && leader === self && pl.party === id && accepted.delete(from.uid)) { recent.delete(from.uid); emit({ type: 'memberLeft', uid: from.uid, handle: from.handle }); }
          break;
        case 'party.ping': {
          if (!id || pl.party !== id || !api.members().some(function (m) { return !m.self && m.uid === from.uid; })) return;
          var px = Math.round(+pl.k), py = Math.round(+pl.n), last = pingIn.get(from.uid);
          if (!(px >= 0 && py >= -4096 && px < 16384 && py < 4096)) return; // the north is at negative y
          if (last != null && now() - last < PING_MS) return;
          pingIn.set(from.uid, now());
          emit({ type: 'ping', uid: from.uid, handle: from.handle, x: px, y: py, self: false });
          break;
        }
        case 'party.kick':
          if (id && pl.party === id && leader === from.uid) { clear(); forget(); emit({ type: 'kicked', handle: from.handle }); }
          break;
      }
    });

    var api = {
      id: function () { return id; },
      leader: function () { return leader; },
      isLeader: function () { return !!id && leader === self; },
      /** Leader (or a player not in a party) invites a remote player. Returns 'sent' or a reason. */
      invite: function (remote) {
        if (!remote || !remote.uid || remote.uid === self) return 'bad';
        if (id && leader !== self) return 'notLeader';
        if (remote.party && remote.party === id) return 'already';
        if (remote.party) return 'busy';
        if (id && accepted.size + 1 + outgoing.size >= max) return 'full';
        if (!id) { id = idFor(self); leader = self; }
        outgoing.set(remote.uid, now());
        send('party.invite', remote.uid);
        return 'sent';
      },
      /** The newest unanswered invite, or null. */
      pendingInvite: function () {
        var best = null;
        invites.forEach(function (v) { if (!best || v.t > best.t) best = v; });
        return best;
      },
      accept: function (pid, quiet) {
        var inv = invites.get(pid);
        if (!inv || id) return false;
        invites.clear();
        id = pid; leader = inv.from; leaderOk = now(); memo = null;
        send('party.accept', inv.from);
        save();
        if (!quiet) emit({ type: 'youJoined', handle: inv.handle });
        return true;
      },
      decline: function (pid) {
        var inv = invites.get(pid);
        if (!inv) return false;
        invites.delete(pid);
        P.send('party.decline', { to: inv.from, party: pid });
        return true;
      },
      leave: function () {
        if (!id) return false;
        if (leader === self) accepted.forEach(function (t, uid) { send('party.kick', uid); });
        else send('party.decline', leader); // a member leaving on purpose: the leader drops us now, no invite back
        clear();
        forget();
        emit({ type: 'left' });
        return true;
      },
      /** Mark a map spot (pixels) for the other members. Returns 'sent', 'noParty' or 'tooFast'. */
      ping: function (x, y) {
        var to = api.members().filter(function (m) { return !m.self; });
        if (!id || !to.length) return 'noParty';
        if (now() - pingOut < PING_MS) return 'tooFast';
        pingOut = now();
        x = Math.max(0, Math.min(16383, Math.round(x))); y = Math.max(-4096, Math.min(4095, Math.round(y)));
        to.forEach(function (m) { P.send('party.ping', { to: m.uid, party: id, k: x, n: y }); });
        emit({ type: 'ping', uid: self, handle: null, x: x, y: y, self: true });
        return 'sent';
      },
      kick: function (uid) {
        if (!id || leader !== self || !accepted.has(uid)) return false;
        send('party.kick', uid);
        accepted.delete(uid);
        return true;
      },
      /** Members as seen now: self first, then remotes in the same party (leader view: accepted only). */
      members: function () {
        if (!id) return [];
        var out = [{ uid: self, self: true, leader: leader === self }];
        P.remotes().forEach(function (r) {
          if (r.party !== id) return;
          if (leader === self ? !accepted.has(r.uid) : false) return;
          out.push({ uid: r.uid, handle: r.handle, lv: r.lv, leader: r.uid === leader, hp: typeof r.hp === 'number' ? r.hp : null });
        });
        return out;
      },
      /** Expire invites and notice members or a leader who are gone. Call about once per frame. */
      tick: function () {
        var t = now();
        invites.forEach(function (v, k) { if (t - v.t > INVITE_MS) invites.delete(k); });
        outgoing.forEach(function (v, k) { if (t - v > INVITE_MS) outgoing.delete(k); });
        if (!id) return;
        if (leader === self) {
          accepted.forEach(function (seen, uid) {
            var r = byUid(uid);
            if (r && r.party === id) { accepted.set(uid, t); return; }
            if (t - seen > GRACE_MS) { accepted.delete(uid); if (store) recent.set(uid, wall()); emit({ type: 'memberLeft', uid: uid, handle: r ? r.handle : '' }); }
          });
          // invite dropped members back while they may still be reloading
          var stop = false;
          recent.forEach(function (t0, uid) {
            if (stop) return;
            if (accepted.has(uid) || wall() - t0 > REJOIN_MS) { recent.delete(uid); return; }
            var r = byUid(uid);
            if (r && r.party === id) { recent.delete(uid); accepted.set(uid, t); return; } // still with us (we were the one reloading)
            if (r && r.party && r.party !== id && uid !== self && recent.size && !accepted.size) {
              // our members moved on to a new leader while we were away: join them instead of holding an empty party
              var pid = r.party; clear(); forget();
              if (store) memo = { id: pid, leader: pid.slice(2), t: wall() };
              emit({ type: 'replaced' });
              stop = true;
            }
            if (r && !r.party && !outgoing.has(uid) && accepted.size + 1 + outgoing.size < max) { outgoing.set(uid, t); send('party.invite', uid); }
          });
          if (stop) return;
          if (!accepted.size && !outgoing.size && !recent.size) { clear(); forget(); emit({ type: 'dissolved' }); return; }
          save();
        } else {
          var L = byUid(leader);
          if (L && L.party === id) {
            leaderOk = t;
            mates = api.members().filter(function (m) { return !m.self && !m.leader; }).map(function (m) { return m.uid; });
            save();
          }
          // who is still around from the party: a mate may already have moved on to the elected leader's id
          var ids = mates.concat([self]).map(idFor);
          var rest = mates.filter(function (u) { var r = byUid(u); return r && (r.party === id || ids.indexOf(r.party) >= 0); }).concat([self]);
          if (L && L.party === id) { /* the leader is here */ }
          else if (rest.length >= 2 && t - leaderOk > LEAD_MS) {
            // elect: everyone left computes the same leader (lowest uid), so the party moves as one
            var old = leader, next = rest.sort()[0];
            id = idFor(next); leader = next; leaderOk = t; accepted.clear(); outgoing.clear(); mates = rest.filter(function (u) { return u !== self && u !== next; });
            if (next === self) {
              rest.forEach(function (u) { if (u !== self) accepted.set(u, t); });
              if (store) recent.set(old, wall()); // invite the old leader back if it returns
            }
            emit({ type: 'newLeader', uid: next, self: next === self, handle: next === self ? null : (byUid(next) || {}).handle });
            save();
          } else if (rest.length < 2 && t - leaderOk > GRACE_MS) {
            var was = { id: id, leader: leader };
            clear();
            if (store) memo = { id: was.id, leader: was.leader, t: wall() }; // the leader may be reloading: take its invite back
            emit({ type: 'dissolved' });
          }
        }
      },
      on: function (fn) { listeners.push(fn); },
    };
    return api;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.party = Object.freeze({ create: create, idFor: idFor, MAX: MAX, INVITE_MS: INVITE_MS, GRACE_MS: GRACE_MS, PING_MS: PING_MS, REJOIN_MS: REJOIN_MS, LEAD_MS: LEAD_MS, KEY: KEY });
})(typeof window !== 'undefined' ? window : globalThis);
