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
      if (pp.gd === undefined) pp.gd = null;
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
      // SAT-ONLINE-089 seller history (plan U215): after a trade each side writes its own record, tradeLog/{uid}/{tid}
      // {o, on, gg, gi, ig, ii, t} (with whom, gold given and got as the trade's sides hold them, how many items; yours only)
      // and tradeRep/{uid}/{tid} {o, t} (public: the count of trades and of partners). Only for a trade done between the two.
      record: function (id, uid, v) {
        var u = {}; u['tradeLog/' + uid + '/' + id] = { o: v.o, on: String(v.on || '?').slice(0, 24), gg: v.gg, gi: v.gi, ig: v.ig, ii: v.ii, t: D.serverTimestamp() };
        u['tradeRep/' + uid + '/' + id] = { o: v.o, t: D.serverTimestamp() }; return D.update(D.ref(db), u);
      },
      history: function (uid) { return D.get(at('tradeLog/' + uid)).then(function (s) { return s.val() || {}; }); },
      rep: function (uid) { return D.get(at('tradeRep/' + uid)).then(function (s) { return s.val() || {}; }); },
      commit: function (id, by, a, b, A, B) {
        var u = {};
        u['tradeDone/' + id] = { by: by, t: D.serverTimestamp() };
        Object.keys((A && A.it) || {}).forEach(function (iid) { u['tradedItems/' + iid] = { o: b, t: id, at: D.serverTimestamp() }; });
        Object.keys((B && B.it) || {}).forEach(function (iid) { u['tradedItems/' + iid] = { o: a, t: id, at: D.serverTimestamp() }; });
        return D.update(D.ref(db), u);
      },
    };
  }

  // SAT-ONLINE-046: guilds (src/net/guild.js has the flow and the paths). Every write is one update at the root, so a new
  // guild and its name, or a join and the used-up invitation, go in together or not at all.
  function guildStore(sdk) {
    var D = sdk.m.database, db = sdk.db, SV = function () { return D.serverTimestamp(); };
    var at = function (p) { return D.ref(db, p); };
    var up = function (u) { return D.update(D.ref(db), u); };
    var watch = function (p, cb) { var off = D.onValue(at(p), function (s) { cb(s.val()); }, function () { cb(null); }); return function () { try { off(); } catch (e) { /* ignore */ } }; };
    var member = function (m) { return { rk: m.rk, n: String(m.n || '').slice(0, 24), c: Math.max(0, Math.floor(+m.c || 0)), on: SV() }; };
    return {
      watchInv: function (uid, cb) { return watch('guildInv/' + uid, cb); },
      watchGuild: function (gid, cb) { return watch('guilds/' + gid, cb); },
      watchMembers: function (gid, cb) { return watch('guildMembers/' + gid, cb); },
      create: function (gid, uid, g, m) {
        var u = {};
        u['guilds/' + gid] = { name: g.name, nk: g.nk, master: uid, col: g.col, t: SV() };
        u['guildNames/' + g.nk] = gid;
        u['guildMembers/' + gid + '/' + uid] = member(m);
        return up(u);
      },
      invite: function (uid, gid, v) { var u = {}; u['guildInv/' + uid + '/' + gid] = { n: v.n, by: v.by, byN: String(v.byN || '').slice(0, 24), t: SV() }; return up(u); },
      uninvite: function (uid, gid) { return D.remove(at('guildInv/' + uid + '/' + gid)); },
      join: function (gid, uid, m) { var u = {}; u['guildMembers/' + gid + '/' + uid] = member(m); u['guildInv/' + uid + '/' + gid] = null; return up(u); },
      leave: function (gid, uid) { return D.remove(at('guildMembers/' + gid + '/' + uid)); },
      kick: function (gid, uid) { return D.remove(at('guildMembers/' + gid + '/' + uid)); },
      // the whole entry as it is, with the new rank (the rules let the master change only the rank)
      setRank: function (gid, uid, rk) {
        return D.get(at('guildMembers/' + gid + '/' + uid)).then(function (s) {
          var v = s.val(); if (!v) throw new Error('gone');
          var u = {}; u['guildMembers/' + gid + '/' + uid] = { rk: rk, n: v.n, c: v.c, on: v.on }; return up(u);
        });
      },
      // the heartbeat rewrites the entry with the rank as this client knows it (a stale one is refused; the next beat has it)
      beat: function (gid, uid, p) { var u = {}; u['guildMembers/' + gid + '/' + uid] = member(p); return up(u); },
      disband: function (gid, nk) { var u = {}; u['guilds/' + gid] = null; u['guildNames/' + nk] = null; u['guildMembers/' + gid] = null; u['guildChat/' + gid] = null; u['guildVault/' + gid] = null; u['guildVaultTaken/' + gid] = null; u['guildBank/' + gid] = null; u['guildBuild/' + gid] = null; u['guildLog/' + gid] = null; u['guildNote/' + gid] = null; u['guildRecruit/' + gid] = null; u['guildApply/' + gid] = null; u['guildRej/' + gid] = null; u['guildEvents/' + gid] = null; u['guildEventSign/' + gid] = null; u['guildWeek/' + gid] = null; u['guildWeekPaid/' + gid] = null; u['guildAlly/' + gid] = null; u['guildAllyAsk/' + gid] = null; u['guildDiplo/' + gid] = null; u['guildWar/' + gid] = null; u['guildWarAsk/' + gid] = null; u['guildWarKill/' + gid] = null; return up(u); },
      // SAT-ONLINE-081 the weekly goal: guildWeek/{gid}/{wk}/{uid} {n, k, t}: each member's own kills this week (only upward,
      // at most 1,500); guildWeekPaid/{gid}/{wk}/{uid}/{tier} {t}: a tier's reward, taken once
      watchWeek: function (gid, wk, cb) { return watch('guildWeek/' + gid + '/' + wk, cb); },
      weekPut: function (gid, wk, uid, v) { var u = {}; u['guildWeek/' + gid + '/' + wk + '/' + uid] = { n: String(v.n || '?').slice(0, 24), k: v.k, t: SV() }; return up(u); },
      weekPaid: function (gid, wk, uid) { return D.get(at('guildWeekPaid/' + gid + '/' + wk + '/' + uid)).then(function (s) { return s.val() || {}; }); },
      weekClaim: function (gid, wk, uid, tier) { var u = {}; u['guildWeekPaid/' + gid + '/' + wk + '/' + uid + '/' + tier] = { t: SV() }; return up(u); },
      // SAT-ONLINE-080 guild events: guildEvents/{gid}/{eid} {title, at, by, n, t} (the master or an officer adds or cancels
      // one; members read them), guildEventSign/{gid}/{eid}/{uid} {n, t} (a member's own "going"; cancelling clears them)
      watchEvents: function (gid, cb) { return watch('guildEvents/' + gid, cb); },
      watchSigns: function (gid, cb) { return watch('guildEventSign/' + gid, cb); },
      addEvent: function (gid, eid, v) { var u = {}; u['guildEvents/' + gid + '/' + eid] = { title: String(v.title).slice(0, 60), at: v.at, by: v.by, n: String(v.n || '?').slice(0, 24), t: SV() }; return up(u); },
      cancelEvent: function (gid, eid) { var u = {}; u['guildEvents/' + gid + '/' + eid] = null; u['guildEventSign/' + gid + '/' + eid] = null; return up(u); },
      sign: function (gid, eid, uid, n) { var u = {}; u['guildEventSign/' + gid + '/' + eid + '/' + uid] = { n: String(n || '?').slice(0, 24), t: SV() }; return up(u); },
      unsign: function (gid, eid, uid) { return D.remove(at('guildEventSign/' + gid + '/' + eid + '/' + uid)); },
      // SAT-ONLINE-078 recruiting: guildRecruit/{gid} {n, msg, m, by, t} (posted by the master or an officer, read by all);
      // guildApply/{gid}/{uid} {n, lv, t} (the player's own, only while the guild recruits and not refused in the last week;
      // read by the master and officers); guildRej/{gid}/{uid} {by, t}: a refusal, written with the application's removal
      recruitList: function () { return D.get(at('guildRecruit')).then(function (s) { return s.val() || {}; }); },
      recruitPut: function (gid, v) { var u = {}; u['guildRecruit/' + gid] = { n: v.n, msg: v.msg, m: v.m, by: v.by, t: SV() }; return up(u); },
      recruitOff: function (gid) { return D.remove(at('guildRecruit/' + gid)); },
      apply: function (gid, uid, v) { var u = {}; u['guildApply/' + gid + '/' + uid] = { n: v.n, lv: v.lv, t: SV() }; return up(u); },
      unapply: function (gid, uid) { return D.remove(at('guildApply/' + gid + '/' + uid)); },
      myApply: function (gid, uid) { return Promise.all([D.get(at('guildApply/' + gid + '/' + uid)), D.get(at('guildRej/' + gid + '/' + uid))]).then(function (r) { return { app: r[0].val(), rej: r[1].val() }; }); },
      watchApps: function (gid, cb) { return watch('guildApply/' + gid, cb); },
      refuse: function (gid, uid, by) { var u = {}; u['guildApply/' + gid + '/' + uid] = null; u['guildRej/' + gid + '/' + uid] = { by: by, t: SV() }; return up(u); },
      // SAT-ONLINE-076: the master moves to `to` (an officer), who becomes 'm' while `from` becomes 'o', in one update; the
      // master writes it, or the officer when the master has been away AWAY_MS (the rules check both). Ranks only change:
      // each entry keeps its name, contribution and last seen.
      handover: function (gid, from, to) {
        return Promise.all([D.get(at('guildMembers/' + gid + '/' + from)), D.get(at('guildMembers/' + gid + '/' + to)), D.get(at('guilds/' + gid))]).then(function (r) {
          var a = r[0].val(), b = r[1].val(), g = r[2].val(); if (!a || !b || !g) throw new Error('gone');
          var u = {};
          u['guilds/' + gid] = { name: g.name, nk: g.nk, master: to, col: g.col, t: g.t };
          if (typeof g.emb === 'number') u['guilds/' + gid].emb = g.emb; // the banner stays (SAT-ONLINE-084)
          u['guildMembers/' + gid + '/' + to] = { rk: 'm', n: b.n, c: b.c, on: b.on };
          u['guildMembers/' + gid + '/' + from] = { rk: 'o', n: a.n, c: a.c, on: a.on };
          return up(u);
        });
      },
      // SAT-ONLINE-084: the banner, guilds/{gid}/emb (an index into Satisfy.guild.C.EMBLEMS), set by the master: the guild as
      // it is with the new emblem (the rules let only the master write the guild)
      setEmblem: function (gid, i) {
        return D.get(at('guilds/' + gid)).then(function (s) {
          var g = s.val(); if (!g) throw new Error('gone');
          var u = {}; u['guilds/' + gid] = { name: g.name, nk: g.nk, master: g.master, col: g.col, t: g.t, emb: i }; return up(u);
        });
      },
      // SAT-ONLINE-085 alliances (plan U238/U245). guildAllyAsk/{to}/{from} {n, by, t}: a proposal from the master or an
      // officer of `from` (n: its name), read by both sides' masters and officers; guildAlly/{g}/{o} {n, until, t}: g's side
      // of an alliance with o (n: o's name), both sides written at once by whoever takes the other's proposal (from the last
      // week); either side ends it, removing both; guildAllyCd/{g}/{o} {t}: g broke it (no proposal either way for a day);
      // guildDiplo/{gid}/{id} {k, o, n, by, t}: the guild's diplomacy log (k: ask, ally, decline, break, end; o, n: the
      // other guild), members read it; the other side writes the answer, the break or the end into it too.
      watchAllies: function (gid, cb) { return watch('guildAlly/' + gid, cb); },
      watchAllyAsks: function (gid, cb) { return watch('guildAllyAsk/' + gid, cb); },
      watchDiplo: function (gid, cb) { var ref = at('guildDiplo/' + gid), q = D.limitToLast ? D.query(ref, D.limitToLast(12)) : ref; var off = D.onValue(q, function (s) { cb(s.val()); }, function () { cb(null); }); return function () { try { off(); } catch (e) { /* ignore */ } }; },
      findGuild: function (nk) { return D.get(at('guildNames/' + nk)).then(function (s) { var gid = s.val(); return typeof gid === 'string' ? D.get(at('guilds/' + gid)).then(function (g) { return g.val() ? { gid: gid, g: g.val() } : null; }) : null; }); },
      allyCd: function (a, b) { return Promise.all([D.get(at('guildAllyCd/' + a + '/' + b)), D.get(at('guildAllyCd/' + b + '/' + a))]).then(function (r) { return Math.max(+((r[0].val() || {}).t) || 0, +((r[1].val() || {}).t) || 0); }); },
      allyAsk: function (me, meN, o, oN, uid, id) {
        var u = {}; u['guildAllyAsk/' + o + '/' + me] = { n: meN, by: uid, t: SV() };
        u['guildDiplo/' + me + '/' + id] = { k: 'ask', o: o, n: oN, by: uid, t: SV() }; return up(u);
      },
      allyAccept: function (me, meN, o, oN, uid, until, id) {
        var u = {}; u['guildAlly/' + me + '/' + o] = { n: oN, until: until, t: SV() }; u['guildAlly/' + o + '/' + me] = { n: meN, until: until, t: SV() };
        u['guildAllyAsk/' + me + '/' + o] = null; u['guildAllyAsk/' + o + '/' + me] = null;
        u['guildDiplo/' + me + '/' + id + 'a'] = { k: 'ally', o: o, n: oN, by: uid, t: SV() }; u['guildDiplo/' + o + '/' + id + 'b'] = { k: 'ally', o: me, n: meN, by: uid, t: SV() };
        return up(u);
      },
      allyDecline: function (me, meN, o, oN, uid, id) {
        var u = {}; u['guildAllyAsk/' + me + '/' + o] = null;
        u['guildDiplo/' + me + '/' + id + 'a'] = { k: 'decline', o: o, n: oN, by: uid, t: SV() }; u['guildDiplo/' + o + '/' + id + 'b'] = { k: 'decline', o: me, n: meN, by: uid, t: SV() };
        return up(u);
      },
      // end an alliance: k 'break' (before it runs out: a day before either side may propose again) or 'end' (it ran out, or
      // the guild is closing). The other side's entry and log only while it still has them (a closed guild has neither).
      allyEnd: function (me, meN, o, oN, uid, k, id) {
        return D.get(at('guildAlly/' + o + '/' + me)).then(function (s) {
          var u = {}; u['guildAlly/' + me + '/' + o] = null; u['guildAllyAsk/' + me + '/' + o] = null; u['guildAllyAsk/' + o + '/' + me] = null;
          u['guildDiplo/' + me + '/' + id + 'a'] = { k: k, o: o, n: oN, by: uid, t: SV() };
          if (s.val()) { u['guildAlly/' + o + '/' + me] = null; u['guildDiplo/' + o + '/' + id + 'b'] = { k: k, o: me, n: meN, by: uid, t: SV() }; }
          if (k === 'break') u['guildAllyCd/' + me + '/' + o] = { t: SV() };
          return up(u);
        });
      },
      // SAT-ONLINE-086 guild wars (plan U239). guildWarAsk/{to}/{from} {n, at, by, t}: `from` declares a war for the hour
      // starting at `at` (on the hour, 30 min to 7 days ahead; not on an ally); guildWar/{g}/{o} {n, at, t}: g's side, both
      // written by whoever accepts with the same `at`; called off up to 10 minutes before, cleared after it ends, never during;
      // guildWarKill/{g}/{o}/{uid} {n, k, at, t}: a member's own kills of o's members in the war at `at`, only during it,
      // only upward (a new war starts again), at most 200. The log (guildDiplo) gets warask, war and warno entries.
      watchWars: function (gid, cb) { return watch('guildWar/' + gid, cb); },
      watchWarAsks: function (gid, cb) { return watch('guildWarAsk/' + gid, cb); },
      watchWarKills: function (g, o, cb) { return watch('guildWarKill/' + g + '/' + o, cb); },
      warAsk: function (me, meN, o, oN, uid, at, id) {
        var u = {}; u['guildWarAsk/' + o + '/' + me] = { n: meN, at: at, by: uid, t: SV() };
        u['guildDiplo/' + me + '/' + id] = { k: 'warask', o: o, n: oN, by: uid, at: at, t: SV() }; return up(u);
      },
      warAccept: function (me, meN, o, oN, uid, at, id) {
        var u = {}; u['guildWar/' + me + '/' + o] = { n: oN, at: at, t: SV() }; u['guildWar/' + o + '/' + me] = { n: meN, at: at, t: SV() };
        u['guildWarAsk/' + me + '/' + o] = null; u['guildWarAsk/' + o + '/' + me] = null;
        u['guildDiplo/' + me + '/' + id + 'a'] = { k: 'war', o: o, n: oN, by: uid, at: at, t: SV() }; u['guildDiplo/' + o + '/' + id + 'b'] = { k: 'war', o: me, n: meN, by: uid, at: at, t: SV() };
        return up(u);
      },
      warDecline: function (me, meN, o, oN, uid, at, id) {
        var u = {}; u['guildWarAsk/' + me + '/' + o] = null;
        u['guildDiplo/' + me + '/' + id + 'a'] = { k: 'warno', o: o, n: oN, by: uid, at: at, t: SV() }; u['guildDiplo/' + o + '/' + id + 'b'] = { k: 'warno', o: me, n: meN, by: uid, at: at, t: SV() };
        return up(u);
      },
      // call a war off (more than 10 minutes before it) or clear one that is over: both sides, each while it is there
      warOff: function (me, o) {
        return Promise.all([D.get(at('guildWar/' + me + '/' + o)), D.get(at('guildWar/' + o + '/' + me))]).then(function (r) {
          var u = {}; if (r[0].val()) u['guildWar/' + me + '/' + o] = null; if (r[1].val()) u['guildWar/' + o + '/' + me] = null;
          return Object.keys(u).length ? up(u) : null;
        });
      },
      warKill: function (me, o, uid, v) { var u = {}; u['guildWarKill/' + me + '/' + o + '/' + uid] = { n: String(v.n || '?').slice(0, 24), k: v.k, at: v.at, t: SV() }; return up(u); },
      // guildNote/{gid} = {s, by, n, v, t}: the notice; members read it, the master and officers write the next version
      watchNote: function (gid, cb) { return watch('guildNote/' + gid, cb); },
      setNote: function (gid, n) { var u = {}; u['guildNote/' + gid] = { s: n.s, by: n.by, n: n.n, v: n.v, t: SV() }; return up(u); },
      // SAT-ONLINE-076: every guild and its members, for the guild rankings (read once when the board opens)
      readAll: function () { return Promise.all([D.get(at('guilds')), D.get(at('guildMembers'))]).then(function (r) { return { guilds: r[0].val() || {}, members: r[1].val() || {} }; }); },
      // SAT-ONLINE-065: the treasury guildBank/{gid} = {in, s, lb, lg, t} (in: all gold given, s: all spent on buildings; lb,
      // lg: the last gift's giver and amount, which the rules add to in), the buildings guildBuild/{gid}/{b} = level and
      // guildLog/{gid}/{id} = {by, n, k, g, b?, l?, t}. A gift or a build reads the treasury and writes it back with the
      // change: one written meanwhile makes the rules refuse it (the caller tries again).
      watchBank: function (gid, cb) { return watch('guildBank/' + gid, cb); },
      watchBuild: function (gid, cb) { return watch('guildBuild/' + gid, cb); },
      watchLog: function (gid, cb) { var ref = at('guildLog/' + gid), q = D.limitToLast ? D.query(ref, D.limitToLast(8)) : ref; var off = D.onValue(q, function (s) { cb(s.val()); }, function () { cb(null); }); return function () { try { off(); } catch (e) { /* ignore */ } }; },
      give: function (gid, uid, n, g, lid) {
        return D.get(at('guildBank/' + gid)).then(function (s) {
          var v = s.val() || {}, u = {};
          u['guildBank/' + gid] = { in: (+v.in || 0) + g, s: +v.s || 0, lb: uid, lg: g, t: SV() };
          u['guildLog/' + gid + '/' + lid] = { by: uid, n: String(n || '?').slice(0, 24), k: 'give', g: g, t: SV() };
          return up(u);
        });
      },
      build: function (gid, uid, n, b, l, cost, lid) {
        return D.get(at('guildBank/' + gid)).then(function (s) {
          var v = s.val(); if (!v) throw new Error('empty');
          var u = {};
          u['guildBank/' + gid] = { in: +v.in || 0, s: (+v.s || 0) + cost, lb: v.lb, lg: v.lg, t: SV() };
          u['guildBuild/' + gid + '/' + b] = l;
          u['guildLog/' + gid + '/' + lid] = { by: uid, n: String(n || '?').slice(0, 24), k: 'build', g: cost, b: b, l: l, t: SV() };
          return up(u);
        });
      },
      readGuild: function (gid) { return D.get(at('guilds/' + gid)).then(function (s) { return s.val(); }); },
      readMember: function (gid, uid) { return D.get(at('guildMembers/' + gid + '/' + uid)).then(function (s) { return !!s.val(); }); },
      // SAT-ONLINE-050: the vault; taking writes guildVaultTaken once in the same update, so one player gets a thing
      watchVault: function (gid, cb) { return watch('guildVault/' + gid, cb); },
      deposit: function (gid, vid, e) {
        var u = {}, v = { k: e.k, n: e.n, r: e.r, by: e.by, byN: e.byN, t: SV() }; if (e.it) v.it = e.it;
        u['guildVault/' + gid + '/' + vid] = v; return up(u);
      },
      withdraw: function (gid, vid, uid) { var u = {}; u['guildVault/' + gid + '/' + vid] = null; u['guildVaultTaken/' + gid + '/' + vid] = { by: uid, t: SV() }; return up(u); },
      // SAT-ONLINE-049: guildChat/{gid}/{id} = {from, h, text, t}; members only. chatOn gets new lines (and those of the
      // last 5 min); chatSay also clears up to 10 lines older than a day
      chatOn: function (gid, fn, offset) {
        var ref = at('guildChat/' + gid), q = D.limitToLast ? D.query(ref, D.limitToLast(20)) : ref;
        var off = D.onChildAdded(q, function (s) { var m = s.val(); if (!m || typeof m !== 'object' || typeof m.from !== 'string') return; if (typeof m.t === 'number' && Date.now() + (offset ? offset() : 0) - m.t > 300000) return; fn(m); }, function () { /* not a member (any more) */ });
        return function () { try { off(); } catch (e) { /* ignore */ } };
      },
      chatSay: function (gid, m, offset) {
        var ref = at('guildChat/' + gid);
        var p = D.push(ref, { from: m.from, h: String(m.h || '').slice(0, 24), text: String(m.text || '').slice(0, 120), t: D.serverTimestamp() });
        if (D.limitToFirst) D.get(D.query(ref, D.orderByChild('t'), D.endAt(Date.now() + (offset ? offset() : 0) - 86400000), D.limitToFirst(10))).then(function (s) {
          s.forEach(function (c) { D.remove(at('guildChat/' + gid + '/' + c.key)).catch(function () { /* ignore */ }); });
        }).catch(function () { /* ignore */ });
        return p;
      },
    };
  }

  // SAT-ONLINE-048: things dropped on the ground, for 60 s: drops/{did} (the dropper writes it) and dropClaims/{did} (the
  // first to step on it writes it once; the rules take one claim per drop, so a drop goes to one player only)
  function dropStore(sdk) {
    var D = sdk.m.database, db = sdk.db, at = function (p) { return D.ref(db, p); };
    var up = function (u) { return D.update(D.ref(db), u); };
    return {
      put: function (did, v) { var u = {}, o = { o: v.o, x: Math.round(v.x), y: Math.round(v.y), k: v.k, n: v.n, r: v.r, t: D.serverTimestamp() }; if (v.it) o.it = v.it; u['drops/' + did] = o; return up(u); },
      claim: function (did, uid) { var u = {}; u['dropClaims/' + did] = { by: uid, t: D.serverTimestamp() }; return up(u); },
      remove: function (did) { return D.remove(at('drops/' + did)); },
      unclaim: function (did) { return D.remove(at('dropClaims/' + did)); },
      watch: function (add, gone) {
        var a = D.onChildAdded(at('drops'), function (s) { add(s.key, s.val()); }), b = D.onChildRemoved(at('drops'), function (s) { gone(s.key); });
        return function () { try { a(); b(); } catch (e) { /* ignore */ } };
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

  // SAT-ONLINE-053: ranked arena seasons, arena/{season}/{uid} = {r, w, l, n, t}
  function arenaStore(sdk) {
    var D = sdk.m.database, db = sdk.db, at = function (p) { return D.ref(db, p); };
    return {
      get: function (season, uid) { return D.get(at('arena/' + season + '/' + uid)).then(function (s) { return s.val(); }); },
      put: function (season, uid, v) { var u = {}; u['arena/' + season + '/' + uid] = { r: v.r, w: v.w, l: v.l, n: String(v.n || '').slice(0, 24), t: D.serverTimestamp() }; return D.update(D.ref(db), u); },
      // the top `n` by rating (the fake has no limitToLast: then everything, sorted here)
      top: function (season, n) {
        var ref = at('arena/' + season), q = D.limitToLast && D.orderByChild ? D.query(ref, D.orderByChild('r'), D.limitToLast(n)) : ref;
        return D.get(q).then(function (s) { var v = s.val() || {}, a = []; for (var k in v) if (v[k] && typeof v[k].r === 'number') a.push({ uid: k, r: v[k].r, w: v[k].w | 0, l: v[k].l | 0, n: String(v[k].n || '?') }); a.sort(function (x, y) { return y.r - x.r; }); return a.slice(0, n); });
      },
    };
  }

  // SAT-ONLINE-064: the National Competition, nat/{id}/{uid} = {h, c, d, s, n, t} and natPaid/{id}/{uid} = {g, t}
  function natStore(sdk) {
    var D = sdk.m.database, db = sdk.db, at = function (p) { return D.ref(db, p); }, up = function (u) { return D.update(D.ref(db), u); };
    return {
      get: function (id, uid) { return D.get(at('nat/' + id + '/' + uid)).then(function (s) { return s.val(); }); },
      put: function (id, uid, v) { var u = {}; u['nat/' + id + '/' + uid] = { h: v.h, c: v.c, d: v.d, s: v.h + v.c + v.d, n: String(v.n || '?').slice(0, 24), t: D.serverTimestamp() }; return up(u); },
      // the top `n` by total (the fake has no limitToLast: then everything, sorted here)
      top: function (id, n) {
        var ref = at('nat/' + id), q = D.limitToLast && D.orderByChild ? D.query(ref, D.orderByChild('s'), D.limitToLast(n)) : ref;
        return D.get(q).then(function (s) { var v = s.val() || {}, a = []; for (var k in v) if (v[k] && typeof v[k].s === 'number') a.push({ uid: k, s: v[k].s, h: v[k].h | 0, c: v[k].c | 0, d: v[k].d | 0, n: String(v[k].n || '?') }); a.sort(function (x, y) { return y.s - x.s || (x.uid < y.uid ? -1 : 1); }); return a.slice(0, n); });
      },
      paid: function (id, uid) { return D.get(at('natPaid/' + id + '/' + uid)).then(function (s) { return s.val(); }); },
      pay: function (id, uid, g) { var u = {}; u['natPaid/' + id + '/' + uid] = { g: g, t: D.serverTimestamp() }; return up(u); },
    };
  }

  // SAT-ONLINE-067: friends. friendReq/{to}/{from} = {n, t} asks; friends/{uid}/{f} = {n, t} on both sides once the
  // asked one accepts (in one update that also clears the ask); either side removes both
  function friendStore(sdk) {
    var D = sdk.m.database, db = sdk.db, at = function (p) { return D.ref(db, p); }, up = function (u) { return D.update(D.ref(db), u); };
    var watch = function (p, cb) { var off = D.onValue(at(p), function (s) { cb(s.val()); }, function () { cb(null); }); return function () { try { off(); } catch (e) { /* ignore */ } }; };
    var ent = function (n) { return { n: String(n || '?').slice(0, 24), t: D.serverTimestamp() }; };
    return {
      watchList: function (uid, cb) { return watch('friends/' + uid, cb); },
      watchAsks: function (uid, cb) { return watch('friendReq/' + uid, cb); },
      watchPresence: function (world, uid, cb) { return watch('presence/' + world + '/main/' + uid, cb); },
      ask: function (to, from, n) { var u = {}; u['friendReq/' + to + '/' + from] = ent(n); return up(u); },
      accept: function (me, f, nMe, nF) { var u = {}; u['friends/' + me + '/' + f] = ent(nF); u['friends/' + f + '/' + me] = ent(nMe); u['friendReq/' + me + '/' + f] = null; return up(u); },
      decline: function (me, f) { var u = {}; u['friendReq/' + me + '/' + f] = null; return up(u); },
      remove: function (me, f) { var u = {}; u['friends/' + me + '/' + f] = null; u['friends/' + f + '/' + me] = null; return up(u); },
      // SAT-ONLINE-070: whispers, whisper/{to}/{id} = {from, h, text, t}; the rules take them only from a friend, and only
      // `to` reads them. whisperOn gets new lines (and those of the last 5 min); whisperClean drops ours older than a day
      whisperOn: function (me, fn, offset) {
        var ref = at('whisper/' + me), q = D.limitToLast ? D.query(ref, D.limitToLast(20)) : ref;
        var off = D.onChildAdded(q, function (s) { var m = s.val(); if (!m || typeof m !== 'object' || typeof m.from !== 'string') return; if (typeof m.t === 'number' && Date.now() + (offset ? offset() : 0) - m.t > 300000) return; fn(m); }, function () { /* ignore */ });
        return function () { try { off(); } catch (e) { /* ignore */ } };
      },
      whisper: function (to, m) { return D.push(at('whisper/' + to), { from: m.from, h: String(m.h || '?').slice(0, 24), text: String(m.text || '').slice(0, 120), t: D.serverTimestamp() }); },
      whisperClean: function (me, offset) {
        if (!D.limitToFirst) return Promise.resolve();
        var ref = at('whisper/' + me);
        return D.get(D.query(ref, D.orderByChild('t'), D.endAt(Date.now() + (offset ? offset() : 0) - 86400000), D.limitToFirst(10))).then(function (s) {
          s.forEach(function (c) { D.remove(at('whisper/' + me + '/' + c.key)).catch(function () { /* ignore */ }); });
        }).catch(function () { /* ignore */ });
      },
    };
  }

  // SAT-ONLINE-071: reports/{id} = {by, byN, about, aboutN, why, said, t}: written once by the reporter, read by nobody
  // in the game (the owner reads them in the Firebase console)
  function reportStore(sdk) {
    var D = sdk.m.database, db = sdk.db;
    return {
      report: function (v) {
        return D.push(D.ref(db, 'reports'), { by: v.by, byN: String(v.byN || '?').slice(0, 24), about: v.about, aboutN: String(v.aboutN || '?').slice(0, 24), why: v.why, said: String(v.said || '').slice(0, 360), t: D.serverTimestamp() });
      },
    };
  }

  // SAT-ONLINE-079: announcements from the game's owner. admins/{uid} = true is set by the owner in the Firebase console
  // (the rules let nobody write it); announce/{id} = {k: 'msg' | 'maint', ar, en, at? (maintenance time), by, t}, written only
  // by an admin, read by every signed-in player
  function announceStore(sdk) {
    var D = sdk.m.database, db = sdk.db, at = function (p) { return D.ref(db, p); };
    return {
      isAdmin: function (uid) { return D.get(at('admins/' + uid)).then(function (s) { return s.val() === true; }, function () { return false; }); },
      watch: function (cb) {
        var ref = at('announce'), q = D.limitToLast ? D.query(ref, D.limitToLast(5)) : ref;
        var off = D.onValue(q, function (s) { cb(s.val() || {}); }, function () { cb({}); });
        return function () { try { off(); } catch (e) { /* ignore */ } };
      },
      post: function (v) {
        var e = { k: v.k, ar: String(v.ar).slice(0, 200), en: String(v.en).slice(0, 200), by: v.by, t: D.serverTimestamp() };
        if (v.k === 'maint') e.at = v.at;
        return D.push(at('announce'), e);
      },
    };
  }

  // SAT-ONLINE-082 moderation and crash reports: crashes/{id} {m, s, v, z?, by, t} (anyone signed in writes one, admins read);
  // reports (071) readable by admins; reportDone/{id} {a: 'ok' | 'mute', by, t}; mutes/{uid} {until, why?, by, t}: written by an
  // admin, read by everyone; the rules keep a muted player out of the world chat until `until`
  function modStore(sdk) {
    var D = sdk.m.database, db = sdk.db, at = function (p) { return D.ref(db, p); };
    var all = function (p) { return D.get(at(p)).then(function (s) { return s.val() || {}; }); };
    return {
      crash: function (v) { var e = { m: String(v.m).slice(0, 200) || '?', s: String(v.s || '').slice(0, 800), v: String(v.v || '').slice(0, 16), by: v.by, t: D.serverTimestamp() }; if (v.z) e.z = String(v.z).slice(0, 24); return D.push(at('crashes'), e); },
      crashes: function () { return all('crashes'); },
      reports: function () { return Promise.all([all('reports'), all('reportDone')]).then(function (r) { return { reports: r[0], done: r[1] }; }); },
      resolve: function (id, a, by) { var u = {}; u['reportDone/' + id] = { a: a, by: by, t: D.serverTimestamp() }; return D.update(D.ref(db), u); },
      mute: function (uid, until, why, by) { var u = {}; u['mutes/' + uid] = { until: until, why: String(why || '').slice(0, 60), by: by, t: D.serverTimestamp() }; return D.update(D.ref(db), u); },
      unmute: function (uid) { return D.remove(at('mutes/' + uid)); },
      watchMute: function (uid, cb) { var off = D.onValue(at('mutes/' + uid), function (s) { cb(s.val()); }, function () { cb(null); }); return function () { try { off(); } catch (e) { /* ignore */ } }; },
      // SAT-ONLINE-087 appeals (plan U340): appeals/{uid} {mt, why, n, t}: a muted player's own, once a mute (mt: the mute's
      // t, the moderation event it answers); appealDone/{uid} {mt, a, by, t}: the owner's answer (lift also removes the mute).
      // Only admins and the player read them.
      appeal: function (uid, v) { var u = {}; u['appeals/' + uid] = { mt: v.mt, why: String(v.why).slice(0, 300), n: String(v.n || '?').slice(0, 24), t: D.serverTimestamp() }; return D.update(D.ref(db), u); },
      myAppeal: function (uid) { return D.get(at('appeals/' + uid)).then(function (s) { return s.val(); }); },
      appeals: function () { return Promise.all([all('appeals'), all('appealDone')]).then(function (r) { return { appeals: r[0], done: r[1] }; }); },
      muteOf: function (uid) { return D.get(at('mutes/' + uid)).then(function (s) { return s.val(); }); },
      decide: function (uid, mt, a, by) { var u = {}; u['appealDone/' + uid] = { mt: mt, a: a, by: by, t: D.serverTimestamp() }; if (a === 'lift') u['mutes/' + uid] = null; return D.update(D.ref(db), u); },
      watchAppealDone: function (uid, cb) { var off = D.onValue(at('appealDone/' + uid), function (s) { cb(s.val()); }, function () { cb(null); }); return function () { try { off(); } catch (e) { /* ignore */ } }; },
      uidOf: function (id) { return D.get(at('handles/' + String(id).toLowerCase())).then(function (s) { return typeof s.val() === 'string' ? s.val() : null; }); },
      // SAT-ONLINE-088: every player's numbers for this week, balance/{uid} {wk, cls, lv, n, s, w, l, t} (admins read them)
      balance: function () { return all('balance'); },
      ranks: function () { return Promise.all([all('ranks/gold'), all('ranks/lv')]).then(function (r) { return { gold: r[0], lv: r[1] }; }); },
    };
  }

  // SAT-ONLINE-073: the group finder, lfg/{uid} = {n, lv, cls, k, z, t}: yours only, gone when you leave (onDisconnect)
  function lfgStore(sdk) {
    var D = sdk.m.database, db = sdk.db, at = function (p) { return D.ref(db, p); };
    return {
      list: function () { return D.get(at('lfg')).then(function (s) { return s.val() || {}; }); },
      put: function (uid, v) {
        var r = at('lfg/' + uid);
        if (D.onDisconnect) D.onDisconnect(r).remove().catch(function () { /* ignore */ });
        var u = {}; u['lfg/' + uid] = { n: String(v.n || '?').slice(0, 24), lv: v.lv | 0, cls: String(v.cls || '').slice(0, 16), r: v.r || '', k: v.k, z: String(v.z || '').slice(0, 24), t: D.serverTimestamp() };
        return D.update(D.ref(db), u);
      },
      off: function (uid) { return D.remove(at('lfg/' + uid)); },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.firebase = Object.freeze({
    tradeStore: tradeStore,
    guildStore: guildStore,
    dropStore: dropStore,
    bountyStore: bountyStore,
    arenaStore: arenaStore,
    friendStore: friendStore,
    reportStore: reportStore,
    lfgStore: lfgStore,
    announceStore: announceStore,
    modStore: modStore,
    natStore: natStore,
    SDK_VERSION: SDK_VERSION,
    load: load,
    lease: lease,
    currentUser: currentUser,
    signIn: signIn,
    signOut: signOut,
    transport: transport,
  });
})(typeof window !== 'undefined' ? window : globalThis);
