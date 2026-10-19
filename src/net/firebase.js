/* Satisfy — Firebase adapter (SAT-ONLINE-004): Google sign-in and a Realtime Database transport.
 *
 * Classic script, exposes `Satisfy.firebase`. Nothing is downloaded until load() is called, which
 * happens only when the player asks for online play. The SDK (modular, pinned) comes from gstatic
 * via dynamic import(). Tests replace it with window.__SATISFY_FIREBASE_LOADER__.
 *
 * Database layout (rules: backend/database.rules.json):
 *   presence/{world}/{shard}/{uid} = PlayerPublic (nulls omitted) + seq, t = server time
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
      var app = m.app.initializeApp(cfg, 'satisfy');
      return { m: m, app: app, auth: m.auth.getAuth(app), db: m.database.getDatabase(app, cfg.databaseURL) };
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
    var handler = null, offs = [], lastSeq = {}, closed = false;
    function deliver(env) { if (handler && env && !closed) handler(env); }
    function fromSnap(s) {
      if (s.key === o.uid) return null;
      var v = s.val();
      if (!v || typeof v !== 'object') return null;
      var pp = {};
      for (var k in v) if (k !== 'seq') pp[k] = v[k];
      if (pp.room === undefined) pp.room = null;
      if (pp.party === undefined) pp.party = null;
      if (typeof pp.t !== 'number') pp.t = 0;
      return { v: 1, type: 'presence.state', requestId: null, sessionId: pp.sid, seq: +v.seq || 0, tick: 0, payload: pp };
    }
    function onState(s) { var e = fromSnap(s); if (e) { lastSeq[s.key] = e.seq; deliver(e); } }
    offs.push(D.onChildAdded(list, onState));
    offs.push(D.onChildChanged(list, onState));
    offs.push(D.onChildRemoved(list, function (s) {
      if (s.key === o.uid) return;
      var v = s.val() || {};
      deliver({ v: 1, type: 'presence.leave', requestId: null, sessionId: v.sid, seq: (lastSeq[s.key] || 0) + 1, tick: 0, payload: {} });
      delete lastSeq[s.key];
    }));
    offs.push(D.onValue(D.ref(db, '.info/connected'), function (s) {
      var up = !!s.val();
      // re-armed on every reconnect: the server deletes our node if this client vanishes
      if (up) D.onDisconnect(mine).remove().catch(function () { /* ignore */ });
      if (o.onConnection) o.onConnection(up);
    }));
    function fail(e) { if (o.onError) o.onError(e); }
    return {
      kind: 'firebase',
      send: function (env) {
        if (closed || !env) return;
        if (env.type === 'presence.state') {
          var p = env.payload, v = {};
          for (var k in p) if (p[k] !== null && p[k] !== undefined && k !== 't') v[k] = p[k];
          v.seq = env.seq;
          v.t = D.serverTimestamp();
          D.set(mine, v).catch(fail);
        } else if (env.type === 'presence.leave') {
          D.remove(mine).catch(fail);
        }
        // other envelope types travel on their own paths (party: SAT-ONLINE-003)
      },
      onmessage: function (fn) { handler = fn; },
      close: function () {
        if (closed) return;
        closed = true;
        offs.forEach(function (off) { try { off(); } catch (e) { /* ignore */ } });
        D.remove(mine).catch(function () { /* ignore */ });
        handler = null;
      },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.firebase = Object.freeze({
    SDK_VERSION: SDK_VERSION,
    load: load,
    currentUser: currentUser,
    signIn: signIn,
    signOut: signOut,
    transport: transport,
  });
})(typeof window !== 'undefined' ? window : globalThis);
