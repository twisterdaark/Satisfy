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
 * that leader's id. The electorate is the roster the leader publishes (PlayerPublic.rs), so a stranger who writes
 * the party id into its own presence can't vote; members also follow every id the party could move to
 * (follow()), so members far apart don't lose each other mid-election (review #55).
 * A leader that comes back to find its members in another party drops its own and takes that
 * party's invite back. A member left alone still dissolves after GRACE_MS, as before.
 *
 * Raids (SAT-ONLINE-060, Claude-B #13 item 24, doc ch 40): the leader turns the party into a raid of up to RAID_MAX
 * (setRaid) and back when it is small enough again. The leader publishes it (PlayerPublic.rd = 1), members read it from
 * the leader's presence, an elected leader keeps it, and a reloaded leader gets it back from the store.
 *
 * Exposes `Satisfy.party.create({ presence, uid, now?, max?, blocked?, store?, wall?, gap? })`; gap: a tick this many ms after
 * the last one is this client's own pause (a hidden window), and the time it slept doesn't count against the others.
 */
(function (root) {
  'use strict';

  var MAX = 5;
  var RAID_MAX = 10;      // a raid (SAT-ONLINE-060)
  var INVITE_MS = 30000;  // an unanswered invite expires
  var ASKED_MS = 120000;  // a late accept from someone we invited is still answered for this long
  var GRACE_MS = 10000;   // presence may lag; a member/leader missing this long has left (a closed tab leaves presence at once)
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
    // leader: uid -> when we last invited them (kept past the invite and the party, ASKED_MS): only they are answered when an
    // accept can't be taken; a forged accept from anyone else gets nothing back (Claude-B's note on #162)
    var asked = new Map();
    var invites = new Map();    // invitee: partyId -> {party, from, sid, handle, t}
    var leaderOk = 0, lastTick = 0, listeners = [], pingOut = -1e9, pingIn = new Map();
    var store = o.store || null, wall = o.wall || function () { return Date.now(); };
    var recent = new Map(); // leader: uid -> wall time they dropped out; invited back until REJOIN_MS
    // member: {id, leader, t, sid?}: auto-accept that leader's invite to that party. Only after a real reload: our own
    // (restored from the tab's store, any sid) or the leader's (sid: the session we last saw; a new one means it reloaded).
    // A leader that was only out of sight (same session) must be answered with Y again (owner feedback #14).
    var memo = null;
    var leaderSid = null;   // member: the leader's session as we last saw it
    var savedSig = '', savedAt = -1e15;
    var mates = [];         // member: the other members, from the leader's published roster (the electorate)
    var mateSeen = new Map(); // member: uid -> when we last saw that mate with us (out of sight a moment still counts)
    var names = new Map();  // uid -> last handle seen, so a member who drops out is still named (not "?")
    var raid = false;       // leader: the party is a raid (up to RAID_MAX)
    var raidSeen = false;   // member: the leader's presence says it is a raid
    function cap() { return raid ? RAID_MAX : max; }
    function wasAsked(uid) { var t = asked.get(uid); return t !== undefined && now() - t <= ASKED_MS; }
    function save() {
      if (!store || !id) return;
      var s = JSON.stringify({ id: id, leader: leader, members: leader === self ? Array.from(accepted.keys()).concat(Array.from(recent.keys())) : [], raid: leader === self && raid ? 1 : 0 });
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
        id = s.id; leader = self; raid = s.raid === 1;
        (Array.isArray(s.members) ? s.members : []).forEach(function (u) { if (typeof u === 'string' && u !== self) recent.set(u, s.t); });
      } else memo = { id: s.id, leader: s.leader, t: s.t };
    })();

    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function byUid(uid) { var hit = null; P.remotes().forEach(function (r) { if (r.uid === uid) hit = r; if (r.uid && r.handle) names.set(r.uid, r.handle); }); return hit; }
    function clear() { id = null; leader = null; accepted.clear(); outgoing.clear(); recent.clear(); leaderOk = 0; savedSig = ''; mates = []; mateSeen.clear(); raid = false; raidSeen = false; }
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
          if (memo && memo.id === pl.party && memo.leader === from.uid && wall() - memo.t < REJOIN_MS && !(memo.sid && memo.sid === ev.sid)) {
            memo = null; api.accept(pl.party, true); emit({ type: 'rejoined', handle: from.handle }); return; // our party, back after a reload
          }
          emit({ type: 'invite', party: pl.party, handle: from.handle });
          break;
        case 'party.accept':
          // SAT-ONLINE-126 (plan U048): the leader alone decides who is in, one accept at a time, so the party never passes
          // its cap however many accept at once. An accept it can't take (the invite ran out on its side first, or the party
          // is full or gone) is answered at once with k = 2, so that player isn't left believing it joined.
          if (pl.party !== idFor(self) || accepted.has(from.uid)) return;
          if (!id || leader !== self || pl.party !== id || !outgoing.has(from.uid)) { if (wasAsked(from.uid)) { asked.delete(from.uid); P.send('party.kick', { to: from.uid, party: pl.party, k: 2 }); } return; }
          outgoing.delete(from.uid); asked.delete(from.uid);
          if (accepted.size + 1 >= cap()) { P.send('party.kick', { to: from.uid, party: id, k: 2 }); emit({ type: 'full', handle: from.handle }); return; }
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
          if (!(px >= 0 && py >= -4096 && px < 16384 && py < 8192)) return; // north rows are y < 0
          if (last != null && now() - last < PING_MS) return;
          pingIn.set(from.uid, now());
          emit({ type: 'ping', uid: from.uid, handle: from.handle, x: px, y: py, self: false });
          break;
        }
        case 'party.kick':
          // k === 1: the leader removed us (SAT-ONLINE-037); without it the leader left and the party is over. Either way the
          // rejoin memo goes, so nothing brings us back to that party by itself; a fresh invite needs Y.
          // k === 2: our accept came too late or the party was full (SAT-ONLINE-126): we never joined.
          if (id && pl.party === id && leader === from.uid) { clear(); forget(); emit({ type: pl.k === 1 ? 'kicked' : pl.k === 2 ? 'notJoined' : 'leaderLeft', handle: from.handle }); }
          else if (pl.k === 1 && memo && memo.id === pl.party && memo.leader === from.uid) { forget(); emit({ type: 'kicked', handle: from.handle }); } // kicked while we were out of sight
          break;
      }
    });

    var api = {
      id: function () { return id; },
      leader: function () { return leader; },
      isLeader: function () { return !!id && leader === self; },
      /** Leader: the members it accepted, as PlayerPublic.rs (members vote only from this list), or null. */
      roster: function () { return id && leader === self && accepted.size ? Array.from(accepted.keys()).sort().join(' ') : null; },
      /**
       * The party ids whose members to follow (transport.party): ours, and for a member also every id an election
       * could move the party to, so members who only see each other through the party keep doing so (review #55).
       */
      follow: function () {
        if (!id) return [];
        if (leader === self) return [id];
        return [id].concat(mates.concat([self]).sort().map(idFor)).filter(function (x, i, a) { return a.indexOf(x) === i; });
      },
      /** A raid (SAT-ONLINE-060): the leader's own flag, or for a member what the leader's presence says. */
      isRaid: function () { return !!id && (leader === self ? raid : raidSeen); },
      /** How many the party can hold now (the leader's view). */
      max: function () { return cap(); },
      /**
       * Leader only: make the party a raid of up to RAID_MAX, or a party again. Returns 'ok', 'notLeader' (also with
       * no party yet) or 'big' (too many members, accepted or invited, to be a party again).
       */
      setRaid: function (on) {
        if (!id || leader !== self) return 'notLeader';
        if (!on && accepted.size + 1 + outgoing.size > max) return 'big';
        if (raid === !!on) return 'ok';
        raid = !!on; savedSig = ''; save();
        emit({ type: 'raid', on: raid, self: true });
        return 'ok';
      },
      /** Leader (or a player not in a party) invites a remote player. Returns 'sent' or a reason. */
      invite: function (remote) {
        if (!remote || !remote.uid || remote.uid === self) return 'bad';
        if (id && leader !== self) return 'notLeader';
        if (remote.party && remote.party === id) return 'already';
        if (remote.party) return 'busy';
        if (id && accepted.size + 1 + outgoing.size >= cap()) return 'full';
        if (!id) { id = idFor(self); leader = self; }
        outgoing.set(remote.uid, now()); asked.set(remote.uid, now());
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
        id = pid; leader = inv.from; leaderOk = now(); memo = null; leaderSid = inv.sid || null;
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
        x = Math.max(0, Math.round(x)); y = Math.max(-4096, Math.round(y));
        to.forEach(function (m) { P.send('party.ping', { to: m.uid, party: id, k: x, n: y }); });
        emit({ type: 'ping', uid: self, handle: null, x: x, y: y, self: true });
        return 'sent';
      },
      /** Leader only: remove a member. They get a notice and are never invited back by the rejoin logic. */
      kick: function (uid) {
        if (!id || leader !== self || !accepted.has(uid)) return false;
        P.send('party.kick', { to: uid, party: id, k: 1 });
        accepted.delete(uid); recent.delete(uid); outgoing.delete(uid);
        savedSig = ''; save();
        return true;
      },
      /** Members as seen now: self first, then remotes in the same party (leader view: accepted only). */
      members: function () {
        if (!id) return [];
        var out = [{ uid: self, self: true, leader: leader === self }];
        P.remotes().forEach(function (r) {
          if (r.party !== id) return;
          if (leader === self ? !accepted.has(r.uid) : false) return;
          out.push({ uid: r.uid, handle: r.handle, lv: r.lv, leader: r.uid === leader, hp: typeof r.hp === 'number' ? r.hp : null, role: r.role || null });
        });
        return out;
      },
      /** Expire invites and notice members or a leader who are gone. Call about once per frame. */
      tick: function () {
        var t = now();
        // our own pause (a hidden or minimised window stops the game's frames) is not the others leaving: move every
        // "last seen" forward by the gap, so the party doesn't fall apart the moment the window comes back (Twister 2026-10-19)
        if (o.gap && lastTick && t - lastTick > o.gap) {
          var gap = t - lastTick;
          leaderOk += gap;
          accepted.forEach(function (v, k) { accepted.set(k, v + gap); });
          mateSeen.forEach(function (v, k) { mateSeen.set(k, v + gap); });
        }
        lastTick = t;
        invites.forEach(function (v, k) { if (t - v.t > INVITE_MS) invites.delete(k); });
        outgoing.forEach(function (v, k) { if (t - v > INVITE_MS) outgoing.delete(k); });
        asked.forEach(function (v, k) { if (t - v > ASKED_MS) asked.delete(k); });
        if (!id) return;
        if (leader === self) {
          accepted.forEach(function (seen, uid) {
            var r = byUid(uid);
            if (r && r.party === id) { accepted.set(uid, t); return; }
            if (t - seen > GRACE_MS) { accepted.delete(uid); if (store) recent.set(uid, wall()); emit({ type: 'memberLeft', uid: uid, handle: r ? r.handle : names.get(uid) || '' }); }
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
            if (r && !r.party && !outgoing.has(uid) && accepted.size + 1 + outgoing.size < cap()) { outgoing.set(uid, t); asked.set(uid, t); send('party.invite', uid); }
          });
          if (stop) return;
          if (!accepted.size && !outgoing.size && !recent.size) { clear(); forget(); emit({ type: 'dissolved' }); return; }
          save();
        } else {
          var L = byUid(leader);
          if (L && L.party === id) {
            leaderOk = t; leaderSid = L.sid || leaderSid;
            // the electorate is the leader's own roster, not whoever writes our party id into their presence (#55)
            mates = (typeof L.rs === 'string' && L.rs ? L.rs.split(' ') : []).filter(function (u) { return u !== self; });
            if (raidSeen !== (L.rd === 1)) { raidSeen = L.rd === 1; emit({ type: 'raid', on: raidSeen, self: false }); }
            save();
          }
          // who is still around from the party: a mate may already have moved on to the elected leader's id (we follow
          // those ids too), and one we lost sight of a moment ago (a blip, a re-centred query) still counts for LEAD_MS
          var ids = mates.concat([self]).map(idFor);
          var rest = mates.filter(function (u) {
            var r = byUid(u);
            if (r) { if (r.party === id || ids.indexOf(r.party) >= 0) { mateSeen.set(u, t); return true; } return false; }
            return mateSeen.has(u) && t - mateSeen.get(u) < LEAD_MS;
          }).concat([self]);
          if (L && L.party === id) { /* the leader is here */ }
          else if (rest.length >= 2 && t - leaderOk > LEAD_MS) {
            // elect: everyone left computes the same leader (lowest uid), so the party moves as one
            var old = leader, next = rest.sort()[0];
            id = idFor(next); leader = next; leaderOk = t; accepted.clear(); outgoing.clear(); mates = rest.filter(function (u) { return u !== self && u !== next; });
            if (next === self) {
              raid = raidSeen || rest.length > max; // the raid stays a raid under its new leader
              rest.forEach(function (u) { if (u !== self) accepted.set(u, t); });
              if (store) recent.set(old, wall()); // invite the old leader back if it returns
            }
            emit({ type: 'newLeader', uid: next, self: next === self, handle: next === self ? null : (byUid(next) || {}).handle });
            save();
          } else if (rest.length < 2 && t - leaderOk > GRACE_MS) {
            var was = { id: id, leader: leader };
            clear();
            // the leader may be reloading: take its invite back, but only from a new session (a reload), not the same one
            if (store) memo = { id: was.id, leader: was.leader, t: wall(), sid: leaderSid };
            emit({ type: 'dissolved' });
          }
        }
      },
      on: function (fn) { listeners.push(fn); },
    };
    return api;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.party = Object.freeze({ create: create, idFor: idFor, MAX: MAX, RAID_MAX: RAID_MAX, INVITE_MS: INVITE_MS, GRACE_MS: GRACE_MS, PING_MS: PING_MS, REJOIN_MS: REJOIN_MS, LEAD_MS: LEAD_MS, KEY: KEY });
})(typeof window !== 'undefined' ? window : globalThis);
