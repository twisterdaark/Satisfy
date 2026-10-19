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
 * Exposes `Satisfy.party.create({ presence, uid, now?, max? })`.
 */
(function (root) {
  'use strict';

  var MAX = 5;
  var INVITE_MS = 30000;  // an unanswered invite expires
  var GRACE_MS = 5000;    // presence may lag; a member/leader missing this long has left

  function idFor(uid) { return 'p_' + String(uid).slice(0, 38); }

  function create(o) {
    var P = o.presence, self = o.uid, now = o.now || function () { return Date.now(); }, max = o.max || MAX;
    var blocked = o.blocked || function () { return false; }; // SAT-ONLINE-016: invites from them are dropped silently
    var id = null, leader = null;
    var accepted = new Map();   // leader: uid -> last time presence showed them in the party
    var outgoing = new Map();   // leader: uid -> invite time
    var invites = new Map();    // invitee: partyId -> {party, from, sid, handle, t}
    var leaderOk = 0, listeners = [];

    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function byUid(uid) { var hit = null; P.remotes().forEach(function (r) { if (r.uid === uid) hit = r; }); return hit; }
    function clear() { id = null; leader = null; accepted.clear(); outgoing.clear(); leaderOk = 0; }
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
          break;
        case 'party.kick':
          if (id && pl.party === id && leader === from.uid) { clear(); emit({ type: 'kicked', handle: from.handle }); }
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
      accept: function (pid) {
        var inv = invites.get(pid);
        if (!inv || id) return false;
        invites.clear();
        id = pid; leader = inv.from; leaderOk = now();
        send('party.accept', inv.from);
        emit({ type: 'youJoined', handle: inv.handle });
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
        clear();
        emit({ type: 'left' });
        return true;
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
          out.push({ uid: r.uid, handle: r.handle, lv: r.lv, leader: r.uid === leader });
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
            if (t - seen > GRACE_MS) { accepted.delete(uid); emit({ type: 'memberLeft', uid: uid, handle: r ? r.handle : '' }); }
          });
          if (!accepted.size && !outgoing.size) { clear(); emit({ type: 'dissolved' }); }
        } else {
          var L = byUid(leader);
          if (L && L.party === id) leaderOk = t;
          else if (t - leaderOk > GRACE_MS) { clear(); emit({ type: 'dissolved' }); }
        }
      },
      on: function (fn) { listeners.push(fn); },
    };
    return api;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.party = Object.freeze({ create: create, idFor: idFor, MAX: MAX, INVITE_MS: INVITE_MS, GRACE_MS: GRACE_MS });
})(typeof window !== 'undefined' ? window : globalThis);
