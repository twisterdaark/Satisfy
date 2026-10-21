/* Satisfy — online guilds (SAT-ONLINE-046, owner 2026-10-19; Claude-B handoff #13 item 21, U060).
 *
 * The guild lives in the database, so every member and every other player sees the same one:
 *   guilds/{gid}               {name, nk, master, col, t}: gid = 'g_' + the founder's uid (one guild per founder);
 *                              nk = the name in lower case, and guildNames/{nk} = gid keeps names unique
 *   guildMembers/{gid}/{uid}   {rk: 'm' master | 'o' officer | 'r' member, n handle, c contribution, on last seen}
 *   guildInv/{uid}/{gid}       {n guild name, by, t}: an invitation, written by the master or an officer; the invited
 *                              player joins by writing its own member entry, which the rules allow only while the
 *                              invitation exists (and only as a member), and deletes the invitation in the same update
 * Ranks: the master invites, kicks anyone, makes officers and disbands; an officer invites and kicks members; everyone
 * may leave (the master disbands instead). The guild's experience is the sum of its members' contributions.
 * A member's `on` is renewed every BEAT_MS while it plays, so the member list shows who is online.
 *
 * The vault (SAT-ONLINE-050): guildVault/{gid}/{vid} {k, n, r, it?, by, byN, t}: any member puts a thing in (an item as
 * plain values, or a stack); the master and officers take anything out, a member takes back its own. Taking writes
 * guildVaultTaken/{gid}/{vid} once in the same update, so two players can't both take one thing.
 *
 * The master and the notice (SAT-ONLINE-076, plan U241/U243): the master hands the guild to an officer in one update
 * (guilds/{gid}/master, the officer's entry to 'm', the old master's to 'o'), and when the master has not been seen for
 * AWAY_MS an officer takes it over the same way. guildNote/{gid} {s, by, n, v, t} is the notice the master and officers
 * write and members read; v counts the versions. The guild id stays 'g_' + the founder's uid after a handover.
 *
 * Not cheat-proof yet: contributions are each member's own number. A game server (D3) owns them later.
 *
 * Exposes `Satisfy.guild.create({ store, uid, handle, now?, serverNow? })` and the helpers `validName`, `nameKey`,
 * `gidOf`, `can`, `C`, `memoryStore`.
 *   store: { watchInv(uid, cb), watchGuild(gid, cb), watchMembers(gid, cb) -> off; create(gid, uid, guild, member),
 *            invite(uid, gid, inv), uninvite(uid, gid), join(gid, uid, member), leave(gid, uid), kick(gid, uid),
 *            setRank(gid, uid, rk), beat(gid, uid, part), disband(gid, nk), readGuild(gid), readMember(gid, uid),
 *            handover(gid, from, to), watchNote(gid, cb), setNote(gid, note) }:
 *          promises; Satisfy.firebase.guildStore(sdk) is the database one.
 */
(function (root) {
  'use strict';

  var C = Object.freeze({ NAME_MIN: 2, NAME_MAX: 18, MAX_MEMBERS: 250, VAULT_MAX: 60, VID_RE: /^v_[A-Za-z0-9_-]{1,80}$/, INV_MS: 7 * 24 * 3600 * 1000, BEAT_MS: 60000, ON_MS: 150000, C_MAX: 1e12, EMBLEMS: ['', '⚔', '🛡', '🐉', '🦅', '🐺', '🔥', '❄', '⚡', '☀', '🌙', '⭐', '👑', '⚒', '🏹', '🌿'], AWAY_MS: 14 * 24 * 3600 * 1000, NOTE_MAX: 240, COLORS: ['#5aa0ff', '#4ab06a', '#d8a840', '#9a6ad8', '#e05a5a', '#3ac8c8', '#e88a3a', '#c8c8d0'] });
  var GID_RE = /^g_[A-Za-z0-9]{1,128}$/, RK = { m: 3, o: 2, r: 1 };

  // a guild name: trimmed, single spaces, NAME_MIN..NAME_MAX characters, none that a database key can't hold
  function validName(s) {
    var n = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    if (n.length < C.NAME_MIN || n.length > C.NAME_MAX || /[.$#\[\]\/]/.test(n)) return null;
    return n;
  }
  function nameKey(n) { return String(n).toLowerCase(); }
  function gidOf(uid) { return /^[A-Za-z0-9]{1,128}$/.test(String(uid)) ? 'g_' + uid : null; }
  // may a member of rank `rk` do `act` (to a member of rank `to`)?
  function can(rk, act, to) {
    var r = RK[rk] || 0, t = RK[to] || 0;
    if (act === 'invite') return r >= 2;
    if (act === 'kick') return r >= 2 && t > 0 && t < r;
    if (act === 'rank') return r === 3 && t > 0 && t < 3;
    if (act === 'disband') return r === 3;
    if (act === 'leave') return r > 0 && r < 3;
    if (act === 'take') return r >= 2;
    if (act === 'handover') return r === 3 && t === 2; // to an officer
    if (act === 'claim') return r === 2; // an officer, when the master is away
    if (act === 'note') return r >= 2;
    if (act === 'emblem') return r === 3; // SAT-ONLINE-084: the master picks the banner
    return false;
  }
  function cleanEntry(v) {
    if (!v || typeof v !== 'object' || typeof v.k !== 'string' || !/^[a-z0-9_]{1,24}$/.test(v.k) || typeof v.by !== 'string') return null;
    var e = { k: v.k, n: Math.max(1, Math.min(99999, Math.floor(+v.n || 1))), r: Math.max(0, Math.min(9, Math.floor(+v.r || 0))), by: v.by, byN: typeof v.byN === 'string' ? v.byN.slice(0, 24) : '?', t: +v.t || 0 };
    if (typeof v.it === 'string' && v.it.length <= 600) e.it = v.it;
    return e;
  }
  function cleanMember(v) {
    if (!v || typeof v !== 'object' || !RK[v.rk]) return null;
    return { rk: v.rk, n: typeof v.n === 'string' ? v.n.slice(0, 24) : '?', c: Math.max(0, Math.min(C.C_MAX, Math.floor(+v.c || 0))), on: +v.on || 0 };
  }
  function cleanNote(v) {
    if (!v || typeof v !== 'object' || typeof v.s !== 'string' || typeof v.by !== 'string') return null;
    return { s: v.s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, C.NOTE_MAX), by: v.by, n: typeof v.n === 'string' ? v.n.slice(0, 24) : '?', v: Math.max(1, Math.floor(+v.v || 1)), t: +v.t || 0 };
  }
  function cleanGuild(v, gid) {
    if (!v || typeof v !== 'object' || typeof v.name !== 'string' || !validName(v.name) || typeof v.master !== 'string') return null;
    if (!/^[A-Za-z0-9]{1,128}$/.test(v.master) || !GID_RE.test(gid)) return null; // the founder's, or the one it was handed to
    var e = Math.floor(+v.emb || 0);
    return { name: v.name, nk: nameKey(v.name), master: v.master, col: /^#[0-9a-fA-F]{6}$/.test(v.col || '') ? v.col : C.COLORS[0], emb: e >= 0 && e < C.EMBLEMS.length ? e : 0 };
  }

  function create(o) {
    var store = o.store, self = o.uid, handle = o.handle || function () { return ''; };
    var now = o.now || function () { return Date.now(); }, serverNow = o.serverNow || function () { return Date.now(); };
    var listeners = [], G = null, invites = {}, offInv = null, beatT = 0, cSent = -1, cMine = 0, joining = null, vseq = 0;
    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function off(f) { try { if (f) f(); } catch (e) { /* ignore */ } }
    function me() { return G && G.members[self] || null; }
    function myRank() { var m = me(); return m ? m.rk : ''; }
    function sum() { var n = 0; for (var k in G.members) n += G.members[k].c; return n; }

    // watch one guild: its node and its members; we are in it while our entry is there
    function follow(gid, why) {
      unfollow();
      G = { gid: gid, guild: null, members: {}, vault: {}, note: null, seen: false, offs: [], why: why || '' };
      var g = G;
      g.offs.push(store.watchGuild(gid, function (v) {
        if (G !== g) return;
        var c = cleanGuild(v, gid);
        if (!c) { if (g.guild) lost(g.ending || 'disbanded'); else if (g.loaded) lost('gone'); g.loaded = true; return; }
        g.guild = c; g.loaded = true; emit({ type: 'changed' });
      }));
      g.offs.push(store.watchMembers(gid, function (v) {
        if (G !== g) return;
        var m = {}, k;
        for (k in (v || {})) { var c = cleanMember(v[k]); if (c) m[k] = c; }
        g.members = m;
        if (!m[self]) { lost(g.ending || (!g.seen ? 'gone' : g.guild ? 'kicked' : 'disbanded')); return; }
        if (!g.seen) {
          g.seen = true; cMine = Math.max(cMine, m[self].c);
          // the vault is for members only: watch it once we know we are one
          if (store.watchVault) g.offs.push(store.watchVault(gid, function (v) { if (G !== g) return; var o = {}, k; for (k in (v || {})) { var e = C.VID_RE.test(k) && cleanEntry(v[k]); if (e) o[k] = e; } g.vault = o; emit({ type: 'vault' }); }));
          // fresh: changed while we watch (not what was there when we came in), by someone else
          if (store.watchNote) g.offs.push(store.watchNote(gid, function (v) { if (G !== g) return; var n = cleanNote(v), first = !g.noteIn; g.noteIn = true; if (JSON.stringify(n) !== JSON.stringify(g.note)) { var was = g.note; g.note = n; emit({ type: 'note', note: n, fresh: !first && !!n && n.by !== self && (!was || n.v > was.v) }); } }));
          emit({ type: 'joined', gid: gid, why: g.why, name: g.guild ? g.guild.name : '' });
        }
        emit({ type: 'changed' });
      }));
    }
    function unfollow() { if (!G) return; G.offs.forEach(off); G = null; }
    function lost(why) { var g = G; unfollow(); cMine = 0; cSent = -1; emit({ type: 'left', why: why, gid: g && g.gid, name: g && g.guild ? g.guild.name : '' }); emit({ type: 'changed' }); }

    var api = {
      /** Start: watch your invitations, and the guild you were in (the save's guild id), if any. */
      start: function (gid) {
        off(offInv);
        offInv = store.watchInv(self, function (v) {
          var next = {}, k, t = serverNow();
          for (k in (v || {})) {
            var x = v[k];
            if (!GID_RE.test(k) || !x || typeof x !== 'object' || typeof x.n !== 'string' || (+x.t && t - x.t > C.INV_MS)) continue;
            next[k] = { gid: k, n: x.n.slice(0, C.NAME_MAX), by: typeof x.by === 'string' ? x.by : '', byN: typeof x.byN === 'string' ? x.byN.slice(0, 24) : '', t: +x.t || 0 };
            if (!invites[k]) emit({ type: 'invited', gid: k, n: next[k].n, byN: next[k].byN });
          }
          invites = next; emit({ type: 'changed' });
        });
        if (gid && GID_RE.test(gid)) follow(gid, 'start');
      },
      stop: function () { off(offInv); offInv = null; unfollow(); },
      state: function () {
        return { gid: G ? G.gid : null, guild: G && G.guild, members: G ? G.members : {}, rank: myRank(), xp: G ? sum() : 0, invites: Object.keys(invites).map(function (k) { return invites[k]; }) };
      },
      /** Is this member online (seen in the last ON_MS)? */
      online: function (m) { return !!m && (m === me() || serverNow() - m.on < C.ON_MS); },
      /** Found a guild: you become its master. Resolves with the gid; rejects 'name' (bad), 'taken', 'busy' (already in one). */
      found: function (name, col) {
        var n = validName(name), gid = gidOf(self);
        if (!n || !gid) return Promise.reject(new Error('name'));
        if (myRank()) return Promise.reject(new Error('busy'));
        var guild = { name: n, nk: nameKey(n), master: self, col: C.COLORS.indexOf(col) >= 0 ? col : C.COLORS[0] };
        return store.create(gid, self, guild, { rk: 'm', n: handle(), c: 0 }).then(function () { follow(gid, 'found'); return gid; }, function (e) {
          throw new Error(/PERMISSION|exists|taken/i.test(String(e && e.message)) ? 'taken' : 'failed');
        });
      },
      /** Invite a player (by uid) into your guild. Returns a promise; rejects 'rank', 'member'. */
      invite: function (uid, nameOfThem) {
        if (!G || !G.guild || !can(myRank(), 'invite')) return Promise.reject(new Error('rank'));
        if (G.members[uid]) return Promise.reject(new Error('member'));
        if (Object.keys(G.members).length >= C.MAX_MEMBERS) return Promise.reject(new Error('full'));
        return store.invite(uid, G.gid, { n: G.guild.name, by: self, byN: String(handle() || '').slice(0, 24) });
      },
      /** Join a guild you were invited to. */
      accept: function (gid) {
        var v = invites[gid];
        if (!v) return Promise.reject(new Error('gone'));
        if (myRank()) return Promise.reject(new Error('busy'));
        joining = gid;
        return store.join(gid, self, { rk: 'r', n: handle(), c: 0 }).then(function () { delete invites[gid]; follow(gid, 'join'); joining = null; }, function (e) { joining = null; throw e; });
      },
      decline: function (gid) { delete invites[gid]; emit({ type: 'changed' }); return store.uninvite(self, gid); },
      leave: function () {
        if (!G || !can(myRank(), 'leave')) return Promise.reject(new Error('rank'));
        var g = G; g.ending = 'left';
        return store.leave(g.gid, self).then(function () { if (G === g) lost('left'); }, function (e) { g.ending = ''; throw e; });
      },
      disband: function () {
        if (!G || !G.guild || !can(myRank(), 'disband')) return Promise.reject(new Error('rank'));
        var g = G; g.ending = 'disbanded';
        return store.disband(g.gid, g.guild.nk).then(function () { if (G === g) lost('disbanded'); }, function (e) { g.ending = ''; throw e; });
      },
      kick: function (uid) {
        var t = G && G.members[uid];
        if (!t || uid === self || !can(myRank(), 'kick', t.rk)) return Promise.reject(new Error('rank'));
        return store.kick(G.gid, uid);
      },
      /** The master makes a member an officer ('o') or back ('r'). */
      setRank: function (uid, rk) {
        var t = G && G.members[uid];
        if (!t || uid === self || (rk !== 'o' && rk !== 'r') || !can(myRank(), 'rank', t.rk)) return Promise.reject(new Error('rank'));
        return store.setRank(G.gid, uid, rk);
      },
      /** The vault: {vid: {k, n, r, it?, by, byN, t}}. */
      vault: function () { return G ? G.vault : {}; },
      /** May you take this vault entry out (the master and officers anything, a member its own)? */
      canTake: function (vid) { var e = G && G.vault[vid]; return !!e && (can(myRank(), 'take') || e.by === self); },
      /** Put a thing in: {k, n, r, it?} (it: the item as plain values). Rejects 'full', 'rank' (not a member). */
      deposit: function (x) {
        if (!G || !me()) return Promise.reject(new Error('rank'));
        if (Object.keys(G.vault).length >= C.VAULT_MAX) return Promise.reject(new Error('full'));
        var e = cleanEntry({ k: x.k, n: x.n, r: x.r, it: x.it, by: self, byN: String(handle() || '').slice(0, 24) });
        if (!e) return Promise.reject(new Error('bad'));
        var vid = 'v_' + String(self).slice(0, 40) + '_' + Math.floor(now()).toString(36) + (++vseq).toString(36);
        return store.deposit(G.gid, vid, e).then(function () { return vid; });
      },
      /** Take a thing out: resolves with the entry once it is yours (one player only). */
      withdraw: function (vid) {
        var e = G && G.vault[vid];
        if (!e || !api.canTake(vid)) return Promise.reject(new Error('rank'));
        return store.withdraw(G.gid, vid, self).then(function () { return e; });
      },
      /** The master hands the guild to an officer: they become master, you an officer. */
      handover: function (uid) {
        var t = G && G.members[uid];
        if (!G || !G.guild || !t || uid === self || !can(myRank(), 'handover', t.rk)) return Promise.reject(new Error('rank'));
        return store.handover(G.gid, self, uid);
      },
      /** SAT-ONLINE-084: the master picks the guild's banner, an index into C.EMBLEMS (0: none). */
      setEmblem: function (i) {
        i = Math.floor(+i);
        if (!G || !G.guild || !can(myRank(), 'emblem') || !(i >= 0 && i < C.EMBLEMS.length)) return Promise.reject(new Error('rank'));
        return store.setEmblem(G.gid, i);
      },
      /** Has the master not been seen for AWAY_MS (so an officer may take the guild over)? */
      masterAway: function () {
        var m = G && G.guild && G.members[G.guild.master];
        return !!G && !!G.guild && G.guild.master !== self && (!m || serverNow() - m.on > C.AWAY_MS);
      },
      /** An officer takes the guild over from a master who has been away AWAY_MS. */
      claim: function () {
        if (!G || !G.guild || !can(myRank(), 'claim') || !api.masterAway()) return Promise.reject(new Error('rank'));
        return store.handover(G.gid, G.guild.master, self);
      },
      /** The guild notice: {s, by, n, v, t} or null. */
      note: function () { return G ? G.note : null; },
      /** The master or an officer writes the notice (the next version). */
      setNote: function (text) {
        if (!G || !can(myRank(), 'note')) return Promise.reject(new Error('rank'));
        var s = String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, C.NOTE_MAX);
        if (!s) return Promise.reject(new Error('empty'));
        return store.setNote(G.gid, { s: s, by: self, n: String(handle() || '').slice(0, 24) || '?', v: (G.note ? G.note.v : 0) + 1 });
      },
      /** Add to your contribution (the guild's experience); written with the next heartbeat. */
      contribute: function (n) { n = Math.floor(+n || 0); if (n > 0 && me()) cMine = Math.min(C.C_MAX, cMine + n); },
      /** Heartbeat (who is online) and pending contributions. Call about once per frame. */
      tick: function () {
        if (!G || !me()) return;
        var t = now(), m = me();
        if (t - beatT >= C.BEAT_MS || (cMine !== m.c && cMine !== cSent && t - beatT >= 5000) || m.n !== String(handle() || m.n).slice(0, 24)) {
          beatT = t; cSent = cMine;
          store.beat(G.gid, self, { rk: m.rk, n: String(handle() || m.n).slice(0, 24), c: Math.max(cMine, m.c) }).catch(function () { /* the next beat tries again */ });
        }
      },
      on: function (fn) { listeners.push(fn); return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    };
    return api;
  }

  // An in-memory database with the rules' checks, for tests: memoryStore().as(uid) is the store one player uses (the
  // acting uid stands in for auth.uid). guildStore in firebase.js has the same shape.
  function memoryStore() {
    var d = { guilds: {}, names: {}, members: {}, inv: {}, vault: {}, taken: {}, notes: {} }, watchers = [], clock = 1;
    function fire() { watchers.slice().forEach(function (w) { try { w(); } catch (e) { /* ignore */ } }); }
    function watch(get, cb) { var last; var w = function () { var v = JSON.stringify(get() || null); if (v !== last) { last = v; cb(JSON.parse(v)); } }; watchers.push(w); w(); return function () { var i = watchers.indexOf(w); if (i >= 0) watchers.splice(i, 1); }; }
    function no(why) { return Promise.reject(new Error('PERMISSION_DENIED: ' + why)); }
    function rk(gid, uid) { var m = (d.members[gid] || {})[uid]; return m ? m.rk : ''; }
    function ok() { fire(); return Promise.resolve(); }
    function as(me) {
      return {
        watchInv: function (uid, cb) { return watch(function () { return uid === me ? d.inv[uid] : null; }, cb); },
        watchGuild: function (gid, cb) { return watch(function () { return d.guilds[gid]; }, cb); },
        watchMembers: function (gid, cb) { return watch(function () { return d.members[gid]; }, cb); },
        create: function (gid, uid, g, m) {
          if (uid !== me || gid !== gidOf(me) || d.guilds[gid] || d.names[g.nk] || g.nk !== g.name.toLowerCase() || g.master !== me) return no('create');
          d.guilds[gid] = { name: g.name, nk: g.nk, master: me, col: g.col, t: clock }; d.names[g.nk] = gid;
          d.members[gid] = {}; d.members[gid][me] = { rk: 'm', n: m.n, c: 0, on: clock }; return ok();
        },
        invite: function (uid, gid, v) {
          if (!d.guilds[gid] || !can(rk(gid, me), 'invite') || v.by !== me) return no('invite');
          (d.inv[uid] = d.inv[uid] || {})[gid] = { n: v.n, by: me, byN: v.byN, t: clock }; return ok();
        },
        uninvite: function (uid, gid) { if (uid !== me && !can(rk(gid, me), 'invite')) return no('uninvite'); if (d.inv[uid]) delete d.inv[uid][gid]; return ok(); },
        join: function (gid, uid, m) {
          if (uid !== me || !d.guilds[gid] || !(d.inv[me] || {})[gid] || (d.members[gid] || {})[me] || m.rk !== 'r') return no('join');
          d.members[gid][me] = { rk: 'r', n: m.n, c: 0, on: clock }; delete d.inv[me][gid]; return ok();
        },
        leave: function (gid, uid) { if (uid !== me || !rk(gid, me) || rk(gid, me) === 'm') return no('leave'); delete d.members[gid][me]; return ok(); },
        kick: function (gid, uid) { if (!can(rk(gid, me), 'kick', rk(gid, uid))) return no('kick'); delete d.members[gid][uid]; return ok(); },
        setRank: function (gid, uid, r) { if (!can(rk(gid, me), 'rank', rk(gid, uid)) || (r !== 'o' && r !== 'r')) return no('rank'); d.members[gid][uid].rk = r; return ok(); },
        beat: function (gid, uid, p) { var m = (d.members[gid] || {})[uid]; if (uid !== me || !m || p.rk !== m.rk) return no('beat'); m.n = p.n; m.c = p.c; m.on = clock; return ok(); },
        disband: function (gid, nk) { if (rk(gid, me) !== 'm' || d.names[nk] !== gid) return no('disband'); delete d.guilds[gid]; delete d.names[nk]; delete d.members[gid]; delete d.vault[gid]; delete d.taken[gid]; delete d.notes[gid]; return ok(); },
        // as the rules: the master to an officer, or an officer from a master away AWAY_MS (`clock` is the server time)
        handover: function (gid, from, to) {
          var g = d.guilds[gid], ms = d.members[gid] || {}, a = ms[from], b = ms[to];
          if (!g || g.master !== from || !a || a.rk !== 'm' || !b || b.rk !== 'o') return no('handover');
          if (!(me === from || (me === to && clock - a.on > C.AWAY_MS))) return no('handover');
          g.master = to; b.rk = 'm'; a.rk = 'o'; return ok();
        },
        setEmblem: function (gid, i) { var g = d.guilds[gid]; if (!g || g.master !== me || !(i >= 0 && i < C.EMBLEMS.length)) return no('emblem'); g.emb = i; return ok(); },
        watchNote: function (gid, cb) { return watch(function () { return rk(gid, me) ? d.notes[gid] : null; }, cb); },
        setNote: function (gid, n) {
          var r = rk(gid, me), old = d.notes[gid];
          if ((r !== 'm' && r !== 'o') || n.by !== me || n.v !== (old ? old.v : 0) + 1 || !n.s || n.s.length > C.NOTE_MAX) return no('note');
          d.notes[gid] = { s: n.s, by: me, n: n.n, v: n.v, t: clock }; return ok();
        },
        watchVault: function (gid, cb) { return watch(function () { return rk(gid, me) ? d.vault[gid] : null; }, cb); },
        deposit: function (gid, vid, v) { if (!rk(gid, me) || v.by !== me || (d.vault[gid] || {})[vid]) return no('deposit'); (d.vault[gid] = d.vault[gid] || {})[vid] = JSON.parse(JSON.stringify(v)); return ok(); },
        withdraw: function (gid, vid, uid) {
          var e = (d.vault[gid] || {})[vid], tk = (d.taken[gid] = d.taken[gid] || {});
          if (uid !== me || !e || tk[vid] || !(can(rk(gid, me), 'take') || e.by === me)) return no('withdraw');
          tk[vid] = { by: me }; delete d.vault[gid][vid]; return ok();
        },
        readGuild: function (gid) { return Promise.resolve(d.guilds[gid] || null); },
        readMember: function (gid, uid) { return Promise.resolve(!!(d.members[gid] || {})[uid]); },
      };
    }
    return { data: d, as: as, setClock: function (t) { clock = t; } };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.guild = Object.freeze({ create: create, memoryStore: memoryStore, validName: validName, nameKey: nameKey, gidOf: gidOf, can: can, cleanGuild: cleanGuild, cleanEntry: cleanEntry, cleanNote: cleanNote, C: C, GID_RE: GID_RE });
})(typeof window !== 'undefined' ? window : globalThis);
