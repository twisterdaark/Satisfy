/* Satisfy — Firebase adapter (SAT-ONLINE-004): Google sign-in and a Realtime Database transport.
 *
 * Classic script, exposes `Satisfy.firebase`. Nothing is downloaded until load() is called, which
 * happens only when the player asks for online play. The SDK (modular, pinned) comes from gstatic
 * via dynamic import(). Tests replace it with window.__SATISFY_FIREBASE_LOADER__.
 *
 * Database layout (rules: backend/database.rules.json):
 *   presence/{world}/{shard}/{uid} = PlayerPublic (nulls omitted) + seq, t = server time; written in full
 *                                    once per connection, then update() with only the changed fields
 *   inbox/{uid}/{pushId}           = {from, sid, seq, type: party.* | duel.* | raid.* | chat.say, payload, t}
 *                                    payload {to, party} (party.ping: + k = x, n = y), {to, duel, k?, n?}, {to, raid, k?, n?} or
 *                                    {to, party, text}; read and deleted by the
 *                                    recipient only; older than 60 s is dropped
 *   profiles/{uid}, cloudIndex/{uid}/{pid}, cloudSaves/{uid}/{pid}: see src/net/cloud.js
 *   sessions/{uid}                 = {sid, t}: the account's active session (lease)
 * The transport turns child added/changed/removed under presence/{world}/{shard} into the same
 * envelopes Satisfy.presence gets from the local transport.
 */
(function (root) {
  'use strict';

  var SDK_VERSION = '12.19.0';
  var cache = null;

  function defaultLoader(ver) {
    var base = 'https://www.gstatic.com/firebasejs/' + ver + '/';
    return Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-database.js')])
      .then(function (m) { return { app: m[0], auth: m[1], database: m[2] }; });
  }

  /** Download (once) and initialize the SDK. Resolves to {m, app, auth, db}. */
  function load(cfg) {
    if (cache) return cache;
    var loader = root.__SATISFY_FIREBASE_LOADER__ || defaultLoader;
    cache = Promise.resolve().then(function () { return loader(SDK_VERSION); }).then(function (m) {
      var app = m.app.initializeApp(cfg, 'satisfy'), auth = m.auth.getAuth(app);
      // keep the Google sign-in across reloads (owner feedback #4). It is getAuth's default, but set it explicitly so a
      // browser or SDK change can't quietly make every F5 ask again.
      var keep = m.auth.setPersistence && m.auth.browserLocalPersistence ? m.auth.setPersistence(auth, m.auth.browserLocalPersistence).catch(function () { /* the default stays */ }) : null;
      return Promise.resolve(keep).then(function () { return { m: m, app: app, auth: auth, db: m.database.getDatabase(app, cfg.databaseURL) }; });
    });
    cache.catch(function () { cache = null; });
    return cache;
  }

  /** Resolves with the signed-in user or null, once Auth has restored any saved session. */
  function currentUser(sdk) {
    return new Promise(function (resolve) {
      var off = sdk.m.auth.onAuthStateChanged(sdk.auth, function (u) { if (off) off(); resolve(u || null); });
    });
  }

  /** Google sign-in from a click. Popup first; redirect where popups are blocked (resolves null, page reloads). */
  function signIn(sdk) {
    var A = sdk.m.auth, provider = new A.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' }); // always show the account chooser, so a second Google account can play
    return A.signInWithPopup(sdk.auth, provider).then(function (r) { return r.user; }, function (e) {
      var code = e && e.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        return A.signInWithRedirect(sdk.auth, provider).then(function () { return null; });
      }
      throw e;
    });
  }

  function signOut(sdk) { return sdk.m.auth.signOut(sdk.auth); }

  /**
   * Realtime Database transport with the shape of Satisfy.transports.local.
   * @param {{m:object, db:object}} sdk
   * @param {{uid:string, world:string, shard:string, onConnection?:function(boolean), onError?:function(Error)}} o
   */
  function transport(sdk, o) {
    var D = sdk.m.database, db = sdk.db;
    var base = 'presence/' + o.world + '/' + o.shard;
    var mine = D.ref(db, base + '/' + o.uid), list = D.ref(db, base);
    var inbox = D.ref(db, 'inbox/' + o.uid);
    var handler = null, offs = [], lastSeq = {}, closed = false, offset = 0;
    var MOB_FULL_MS = 5000;
    var mobs = { offs: null, all: {}, zone: null, last: null, fullT: 0 }; // shared monsters (SAT-ONLINE-026)
    // The node as the server last stored it, or null when it must be written in full (first send,
    // after a reconnect: onDisconnect may have removed it). Later sends update only what changed,
    // so a step sends {x, y, dir, anim, seq, t} instead of the whole public profile (COST_MODEL.md).
    var sent = null;
    // Round trip (doc U015): how long the server takes to acknowledge a presence write, smoothed.
    var rtt = null, writes = 0, fails = 0;
    function acked(t0) { return function () { var ms = Date.now() - t0; rtt = rtt == null ? ms : Math.round(rtt * 0.8 + ms * 0.2); }; }
    var DIRECTED = /^(party\.(invite|accept|decline|kick|ping)|duel\.(challenge|accept|decline|ready|hit|hp|yield|end)|raid\.(hit|state|kill)|chat\.(say)|pvp\.(hit|kill)|trade\.(ask|accept|decline|cancel))$/;
    // exactly the fields the inbox rules accept: party {to, party}, duel {to, duel, k?, n?}, raid {to, raid, k?, n?},
    // chat {to, party, text}
    function directedPayload(type, p) {
      var o = { to: p.to };
      if (type.indexOf('party.') === 0) {
        o.party = String(p.party || '');
        if (type === 'party.ping') { o.k = Math.max(0, Math.min(1000000000, Math.round(+p.k || 0))); o.n = Math.max(-4096, Math.min(1000000000, Math.round(+p.n || 0))); }
        if (type === 'party.kick' && p.k === 1) o.k = 1; // a kick by the leader, not the leader leaving (SAT-ONLINE-037)
        return o;
      }
      if (type.indexOf('chat.') === 0) { o.party = String(p.party || ''); o.text = String(p.text || ''); return o; }
      if (type.indexOf('pvp.') === 0) { // SAT-ONLINE-038: only to, k and n
        o.k = Math.max(0, Math.min(1000000000, Math.round(+p.k || 0)));
        if (typeof p.n === 'number' && p.n >= 0 && p.n <= 1000000000) o.n = Math.round(p.n);
        return o;
      }
      if (type.indexOf('trade.') === 0) { o.trade = String(p.trade || ''); return o; } // SAT-ONLINE-039
      if (type.indexOf('raid.') === 0) o.raid = String(p.raid || ''); else o.duel = String(p.duel || '');
      if (typeof p.k === 'number' && p.k >= 0 && p.k <= 1000000000) o.k = Math.round(p.k);
      if (typeof p.n === 'number' && p.n >= 0 && p.n <= 1000000000) o.n = Math.round(p.n);
      return o;
    }
    function deliver(env) { if (handler && env && !closed) handler(env); }
    // Session ids are chosen by the writer and readable by everyone, so a remote session is known by
    // uid + sid: the uid is the node key (or the inbox `from`), which the rules verify. Another account
    // that copies someone's sid is then just another session, never theirs (review #12, #15).
    function sidOf(uid, sid) { return uid + '.' + sid; }
    function fromSnap(s) {
      if (s.key === o.uid) return null;
      var v = s.val();
      if (!v || typeof v !== 'object' || v.uid !== s.key || typeof v.sid !== 'string') return null;
      var pp = {};
      for (var k in v) if (k !== 'seq') pp[k] = v[k];
      pp.sid = sidOf(s.key, v.sid);
      if (pp.room === undefined) pp.room = null;
      if (pp.party === undefined) pp.party = null;
      if (pp.duel === undefined) pp.duel = null;
      if (pp.mv === undefined) pp.mv = null;
      if (pp.hp === undefined) pp.hp = null;
      if (pp.em === undefined) pp.em = null;
      if (pp.role === undefined) pp.role = null;
      if (pp.rs === undefined) pp.rs = null;
      if (pp.ol === undefined) pp.ol = null;
      if (typeof pp.t !== 'number') pp.t = 0;
      return { v: 1, type: 'presence.state', requestId: null, sessionId: pp.sid, seq: +v.seq || 0, tick: 0, payload: pp };
    }
    var lastX = {}, lastSid = {};
    function onState(s) {
      var e = fromSnap(s);
      if (!e) return;
      // a re-centred query lists everyone in range again: don't hand presence a replay it would count as dropped
      if (lastSid[s.key] === e.sessionId && e.seq <= lastSeq[s.key]) return;
      lastSeq[s.key] = e.seq; lastX[s.key] = e.payload.x; lastSid[s.key] = e.sessionId;
      deliver(e);
    }
    function leave(key, v) {
      if (lastSeq[key] == null) return;
      deliver({ v: 1, type: 'presence.leave', requestId: null, sessionId: lastSid[key] || ((v || {}).sid ? sidOf(key, v.sid) : null), seq: lastSeq[key] + 1, tick: 0, payload: {} });
      delete lastSeq[key]; delete lastX[key]; delete lastSid[key];
    }
    // Interest management (doc U009): with o.interest.radius, listen only to players whose x is within
    // radius of ours (an RTDB range query, indexed on x), re-centred after moving `step` px. A second
    // query follows our party (orderByChild('party').equalTo(id), see party()), so every member sees
    // every other member wherever they are, including one they never met. A player we walk away from
    // is left behind at once; one who walks out of range (or out of the party) is removed by its query.
    // Someone in both queries arrives twice; onState drops the second copy.
    var R = (o.interest && o.interest.radius) || 0, STEP = (o.interest && o.interest.step) || Math.round(R / 2);
    // gone: nodes the range query has removed while the party query still listed them (it decides, see below)
    var cx = null, qOffs = [], pq = { ids: [], offs: [], keys: {} }, gone = {};
    function off(f) { try { f(); } catch (e) { /* ignore */ } }
    function outside(key) { return R && cx !== null && !pq.keys[key] && !(Math.abs(lastX[key] - cx) <= R); }
    function listen(x) {
      qOffs.forEach(off);
      qOffs = [];
      cx = x;
      Object.keys(lastSeq).forEach(function (k) { if (outside(k)) leave(k, null); });
      var q = R ? D.query(list, D.orderByChild('x'), D.startAt(Math.max(0, x - R)), D.endAt(x + R)) : list;
      function inR(s) { delete gone[s.key]; onState(s); }
      qOffs.push(D.onChildAdded(q, inR));
      qOffs.push(D.onChildChanged(q, inR));
      qOffs.push(D.onChildRemoved(q, function (s) { if (s.key === o.uid) return; if (pq.keys[s.key]) gone[s.key] = 1; else leave(s.key, s.val()); }));
    }
    function partyQuery(ids) {
      // one equalTo query per id: the party's own, and for a member also the ids a new leader could take (see
      // party.follow()), so members far apart keep seeing each other while an election moves them (review #55)
      ids = (Array.isArray(ids) ? ids : [ids]).filter(function (x, i, a) { return typeof x === 'string' && x && a.indexOf(x) === i; }).slice(0, 6);
      if (!R || closed || ids.join(' ') === pq.ids.join(' ')) return;
      pq.offs.forEach(off);
      var had = pq.keys;
      pq = { ids: ids, offs: [], keys: {} };
      Object.keys(had).forEach(function (k) { if (outside(k)) leave(k, null); }); // ex-members far away
      ids.forEach(function (pid) {
        var q = D.query(list, D.orderByChild('party'), D.equalTo(pid));
        function inP(s) { if (s.key === o.uid) return; (pq.keys[s.key] = pq.keys[s.key] || {})[pid] = 1; onState(s); }
        pq.offs.push(D.onChildAdded(q, inP));
        pq.offs.push(D.onChildChanged(q, inP));
        pq.offs.push(D.onChildRemoved(q, function (s) {
          var m = pq.keys[s.key];
          if (m) { delete m[pid]; if (Object.keys(m).length) return; delete pq.keys[s.key]; } // moved to another id we follow
          // the range query may have seen the node go first (a closed tab): then nobody lists it any more
          if (gone[s.key] || outside(s.key)) { delete gone[s.key]; leave(s.key, s.val()); }
        }));
      });
    }
    if (!R) listen(0); // whole shard, as before
    offs.push(D.onValue(D.ref(db, '.info/serverTimeOffset'), function (s) { offset = +s.val() || 0; }));
    offs.push(D.onChildAdded(inbox, function (s) {
      var m = s.val();
      D.remove(D.ref(db, 'inbox/' + o.uid + '/' + s.key)).catch(function () { /* ignore */ });
      if (!m || typeof m !== 'object' || !DIRECTED.test(m.type)) return;
      // the rules only prove `from`; the session id is the writer's own claim. Accept it only when it is the session that
      // uid's presence shows (sessions are uid-bound: sidOf), so nobody can send as another player's session (#12/#15/#23).
      if (typeof m.from !== 'string' || typeof m.sid !== 'string' || lastSid[m.from] !== sidOf(m.from, m.sid)) return;
      if (typeof m.t === 'number' && Date.now() + offset - m.t > 60000) return; // stale while offline
      deliver({ v: 1, type: m.type, requestId: null, sessionId: sidOf(m.from, m.sid), seq: +m.seq || 0, tick: 0, payload: m.payload || {} });
    }));
    offs.push(D.onValue(D.ref(db, '.info/connected'), function (s) {
      var up = !!s.val();
      // re-armed on every reconnect: the server deletes our node if this client vanishes
      if (up) D.onDisconnect(mine).remove().catch(function () { /* ignore */ });
      sent = null;
      if (o.onConnection) o.onConnection(up);
    }));
    function fail(e) { if (o.onError) o.onError(e); }
    return {
      kind: 'firebase',
      /** {rtt: smoothed ms for the server to acknowledge a presence write (null until the first), writes, fails} */
      netStats: function () { return { rtt: rtt, writes: writes, fails: fails }; },
      send: function (env) {
        if (closed || !env) return;
        if (env.type === 'presence.state') {
          var p = env.payload, v = {};
          for (var k in p) if (p[k] !== null && p[k] !== undefined && k !== 't') v[k] = p[k];
          v.seq = env.seq;
          var out = {}, f, t0 = Date.now(), onFail = function (e) { sent = null; fails++; fail(e); };
          writes++;
          if (!sent) { for (f in v) out[f] = v[f]; out.t = D.serverTimestamp(); D.set(mine, out).then(acked(t0), onFail); }
          else {
            for (f in v) if (JSON.stringify(v[f]) !== JSON.stringify(sent[f])) out[f] = v[f];
            for (f in sent) if (!(f in v)) out[f] = null; // e.g. left the party: remove the field
            out.t = D.serverTimestamp();
            D.update(mine, out).then(acked(t0), onFail);
          }
          sent = v;
          if (R && (cx === null || Math.abs(v.x - cx) > STEP)) listen(v.x);
        } else if (env.type === 'presence.leave') {
          sent = null;
          D.remove(mine).catch(fail);
        } else if (DIRECTED.test(env.type) && env.payload && typeof env.payload.to === 'string') {
          D.push(D.ref(db, 'inbox/' + env.payload.to), {
            from: o.uid, sid: env.sessionId, seq: env.seq, type: env.type,
            payload: directedPayload(env.type, env.payload), t: D.serverTimestamp(),
          }).catch(fail);
        }
      },
      onmessage: function (fn) { handler = fn; },
      /**
       * {radius, centre, party, watched}: what the interest queries cover now (radius 0 = the whole
       * shard); watched = the other players the party query shows.
       */
      /** Server time minus this device's clock (ms), from .info/serverTimeOffset: world events use it so every client agrees. */
      serverOffset: function () { return offset; },
      interest: function () { return { radius: R, centre: cx, party: pq.ids[0] || null, parties: pq.ids.slice(), watched: Object.keys(pq.keys) }; },
      /** Follow everyone whose presence is in party `id` (or any of an array of ids; null or []: stop), on top of the range query. */
      party: partyQuery,
      /**
       * World feeds (SAT-ONLINE-026): chat/{world} (world chat: {from, h, text, t}) and news/{world} (world
       * announcements: {from, h, k, p?, t}). The rules check from = auth uid and h = the account ID. feedOn(kind, fn)
       * gets the last lines and every new one (older than 5 min skipped); feedSay also deletes up to 10 lines older
       * than 10 min so each list stays short.
       */
      feedOn: function (kind, fn) {
        var ref = D.ref(db, kind + '/' + o.world), q = D.limitToLast ? D.query(ref, D.limitToLast(20)) : ref;
        offs.push(D.onChildAdded(q, function (s) {
          var m = s.val();
          if (!m || typeof m !== 'object' || typeof m.from !== 'string') return;
          if (typeof m.t === 'number' && Date.now() + offset - m.t > 300000) return;
          fn(m);
        }));
      },
      feedSay: function (kind, m) {
        if (closed) return;
        var ref = D.ref(db, kind + '/' + o.world), v = { from: o.uid, t: D.serverTimestamp() };
        for (var k in m) if (k !== 'from' && k !== 't') v[k] = m[k];
        D.push(ref, v).catch(fail);
        if (D.limitToFirst) D.get(D.query(ref, D.orderByChild('t'), D.endAt(Date.now() + offset - 600000), D.limitToFirst(10))).then(function (s) {
          s.forEach(function (c) { D.remove(D.ref(db, kind + '/' + o.world + '/' + c.key)).catch(function () { /* ignore */ }); });
        }).catch(function () { /* ignore */ });
      },
      world: function (fn) { this.feedOn('chat', fn); },
      sayWorld: function (m) { this.feedSay('chat', { h: String(m.h || ''), text: String(m.text || '').slice(0, 120) }); },
      /**
       * Shared monsters (SAT-ONLINE-026): mobs/{world}/{zone}/{host uid} = {t, m: {"<type>@<sx>,<sy>": "x,y,hp,flags,lv"}}.
       * The zone's host writes its monsters near players; the others follow them. mobsOn(zone, fn) calls fn with
       * {hostUid: {t, m}} on every change (null zone: stop); mobsPut(zone, m) writes this client's node (null m: remove it).
       */
      mobsOn: function (zone, fn) {
        if (mobs.offs) mobs.offs.forEach(off);
        mobs.offs = null; mobs.all = {};
        if (!zone || closed) return;
        var ref = D.ref(db, 'mobs/' + o.world + '/' + zone), all = mobs.all;
        function put(s) { if (s.key === o.uid) return; var v = s.val(); if (v && typeof v === 'object' && v.m && typeof v.m === 'object') all[s.key] = v; else delete all[s.key]; fn(all); }
        mobs.offs = [D.onChildAdded(ref, put), D.onChildChanged(ref, put), D.onChildRemoved(ref, function (s) { delete all[s.key]; fn(all); })];
      },
      mobsPut: function (zone, m) {
        if (closed) return;
        if (mobs.zone && (mobs.zone !== zone || !m)) { D.remove(D.ref(db, 'mobs/' + o.world + '/' + mobs.zone + '/' + o.uid)).catch(function () { /* ignore */ }); mobs.zone = null; }
        if (!zone || !m) { mobs.last = null; return; }
        var ref = D.ref(db, 'mobs/' + o.world + '/' + zone + '/' + o.uid), t = Date.now(), keys = Object.keys(m);
        if (mobs.zone !== zone) { mobs.zone = zone; mobs.last = null; D.onDisconnect(ref).remove().catch(function () { /* ignore */ }); }
        // SAT-ONLINE-042: only the monsters that changed since the last write (and nulls for those that left the list), so
        // sending at once on every new attack doesn't multiply the download; the whole list again every MOB_FULL_MS
        if (!keys.length) { if (mobs.last && Object.keys(mobs.last).length) D.remove(ref).catch(fail); mobs.last = {}; return; }
        if (!mobs.last || !Object.keys(mobs.last).length || t - mobs.fullT > MOB_FULL_MS) { mobs.fullT = t; mobs.last = Object.assign({}, m); D.set(ref, { t: D.serverTimestamp(), m: m }).catch(fail); return; }
        var u = { t: D.serverTimestamp() }, n = 0, k;
        for (k in m) if (mobs.last[k] !== m[k]) { u['m/' + k] = m[k]; n++; }
        for (k in mobs.last) if (!(k in m)) { u['m/' + k] = null; n++; }
        mobs.last = Object.assign({}, m);
        if (n) D.update(ref, u).catch(fail);
      },
      close: function () {
        if (closed) return;
        closed = true;
        qOffs.concat(pq.offs, offs, mobs.offs || []).forEach(off);
        D.remove(mine).catch(function () { /* ignore */ });
        if (mobs.zone) D.remove(D.ref(db, 'mobs/' + o.world + '/' + mobs.zone + '/' + o.uid)).catch(function () { /* ignore */ });
        handler = null;
      },
      /**
       * Stop without touching the shared presence node or inbox: another tab or device signed in
       * with the same account owns them now (see lease). Cancels this client's onDisconnect too,
       * so closing this tab later can't delete the other session's node.
       */
      release: function () {
        if (closed) return;
        closed = true;
        qOffs.concat(pq.offs, offs, mobs.offs || []).forEach(off);
        try { D.onDisconnect(mine).cancel().catch(function () { /* ignore */ }); } catch (e) { /* ignore */ }
        handler = null;
      },
    };
  }

  /**
   * Session lease (doc U006 / T07): one active session per account. This client claims
   * sessions/{uid} = {sid, t}; the newest claim wins, and every other session of the account is told
   * through onLost(otherSid) so it can step aside (stop sending presence and reading the inbox).
   * @returns {{off:function()}}
   */
  function lease(sdk, uid, sid, onLost) {
    var D = sdk.m.database, ref = D.ref(sdk.db, 'sessions/' + uid), lost = false;
    D.set(ref, { sid: sid, t: D.serverTimestamp() }).catch(function () { /* the rules or the network: presence still works */ });
    var off = D.onValue(ref, function (s) {
      var v = s.val();
      if (!lost && v && typeof v.sid === 'string' && v.sid !== sid) { lost = true; onLost(v.sid); }
    });
    return { off: function () { try { off(); } catch (e) { /* ignore */ } } };
  }

  /**
   * SAT-ONLINE-039: the trade store for Satisfy.trade over this database. trades/{id} = {a, b, t} (the asker writes it once),
   * tradeSides/{id}/{uid} = each side's offer (its owner only, until the swap), tradeDone/{id} plus tradedItems/{iid} =
   * the swap, written together in one multi-path update the rules check (backend/database.rules.json).
   */
  function tradeStore(sdk) {
    var D = sdk.m.database, db = sdk.db;
    var at = function (p) { return D.ref(db, p); };
    return {
      create: function (id, a, b) { return D.set(at('trades/' + id), { a: a, b: b, t: D.serverTimestamp() }); },
      side: function (id, uid, o) {
        var v = { g: o.g, rev: o.rev, acc: o.acc, conf: o.conf, t: D.serverTimestamp() };
        if (o.it && Object.keys(o.it).length) v.it = o.it;
        return D.set(at('tradeSides/' + id + '/' + uid), v);
      },
      watch: function (id, uid, cb) { var off = D.onValue(at('tradeSides/' + id + '/' + uid), function (s) { cb(s.val()); }, function () {}); return function () { try { off(); } catch (e) { /* ignore */ } }; },
      read: function (id, uid) { return D.get(at('tradeSides/' + id + '/' + uid)).then(function (s) { return s.val(); }); },
      watchDone: function (id, cb) { var off = D.onValue(at('tradeDone/' + id), function (s) { cb(s.val()); }, function () {}); return function () { try { off(); } catch (e) { /* ignore */ } }; },
      commit: function (id, by, a, b, A, B) {
        var u = {};
        u['tradeDone/' + id] = { by: by, t: D.serverTimestamp() };
        Object.keys((A && A.it) || {}).forEach(function (iid) { u['tradedItems/' + iid] = { o: b, t: id, at: D.serverTimestamp() }; });
        Object.keys((B && B.it) || {}).forEach(function (iid) { u['tradedItems/' + iid] = { o: a, t: id, at: D.serverTimestamp() }; });
        return D.update(D.ref(db), u);
      },
    };
  }

  // SAT-ONLINE-051: bounties on outlaws. bounties/{bid} {by, byN, tu, tN, g, t}; a player killed in open PvP writes
  // kills/{victim}/{kid} {k: killer, t}; the killer claims with bountyPaid/{bid} {by, kid, g, t}, written once and only
  // for a kill its target reported after the bounty was set, in the same update that removes the bounty
  function bountyStore(sdk) {
    var D = sdk.m.database, db = sdk.db, at = function (p) { return D.ref(db, p); }, SV = function () { return D.serverTimestamp(); };
    var up = function (u) { return D.update(D.ref(db), u); };
    return {
      watch: function (cb) { var off = D.onValue(at('bounties'), function (s) { cb(s.val() || {}); }, function () { cb({}); }); return function () { try { off(); } catch (e) { /* ignore */ } }; },
      post: function (bid, v) { var u = {}; u['bounties/' + bid] = { by: v.by, byN: String(v.byN || '').slice(0, 24), tu: v.tu, tN: String(v.tN || '').slice(0, 24), g: v.g, t: SV() }; return up(u); },
      cancel: function (bid) { return D.remove(at('bounties/' + bid)); },
      killed: function (victim, kid, killer) { var u = {}; u['kills/' + victim + '/' + kid] = { k: killer, t: SV() }; return up(u); },
      kills: function (victim) { return D.get(at('kills/' + victim)).then(function (s) { return s.val() || {}; }); },
      claim: function (bid, kid, g, uid) { var u = {}; u['bountyPaid/' + bid] = { by: uid, kid: kid, g: g, t: SV() }; u['bounties/' + bid] = null; return up(u); },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.firebase = Object.freeze({
    tradeStore: tradeStore,
    bountyStore: bountyStore,
    SDK_VERSION: SDK_VERSION,
    load: load,
    lease: lease,
    currentUser: currentUser,
    signIn: signIn,
    signOut: signOut,
    transport: transport,
  });
})(typeof window !== 'undefined' ? window : globalThis);
