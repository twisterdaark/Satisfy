// Test-only stand-in for the Firebase modular SDK (app, auth, database), injected with addInitScript.
// Pages in the same browser context share one fake Realtime Database over a BroadcastChannel.
// set()/remove() are checked against a copy of the presence rules in backend/database.rules.json,
// so a client that writes the wrong path or shape fails here the way it would on the server.
(() => {
  if (window.__fakeRTDB) return;
  const ch = new BroadcastChannel('fake-rtdb');
  const SV = { '.sv': 'timestamp' };
  const data = new Map();
  const listeners = [];
  const mine = new Set();
  const discon = new Set();
  const connCbs = [];
  const pending = new Map();
  let user = null;
  let connected = true;
  const F = (window.__fakeRTDB = { log: [], rejected: [], data, sdkVersion: undefined, nextName: 'Tester', nextUid: null, popupBlocked: false, redirected: false });

  const parentOf = (p) => p.slice(0, p.lastIndexOf('/'));
  const keyOf = (p) => p.slice(p.lastIndexOf('/') + 1);
  const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const snap = (p, v) => ({ key: keyOf(p), val: () => clone(v) });
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b + 256).toString(16).slice(1)).join('');

  function fire(type, p, v) {
    for (const l of listeners) if (l.type === type && l.parent === parentOf(p)) setTimeout(() => l.cb(snap(p, v)), 0);
  }
  function apply(op, p, v) {
    if (op === 'set') { const had = data.has(p); data.set(p, v); fire(had ? 'changed' : 'added', p, v); }
    else if (op === 'remove' && data.has(p)) { const old = data.get(p); data.delete(p); fire('removed', p, old); }
  }
  ch.onmessage = (e) => {
    if (!connected) return;
    const m = e.data;
    if (m.op === 'hello') { for (const p of mine) if (data.has(p)) ch.postMessage({ op: 'set', p, v: data.get(p) }); return; }
    apply(m.op, m.p, m.v);
  };
  function write(op, p, v) { apply(op, p, v); ch.postMessage({ op, p, v }); }

  const FIELDS = ['v', 'uid', 'sid', 'handle', 'look', 'cls', 'lv', 'title', 'zone', 'room', 'x', 'y', 'dir', 'anim', 'arm', 'party', 'seq', 't'];
  const POS_X = 16384, POS_Y = 4096; // = database.rules.json x/y bounds (checked by tests/unit/rules.test.cjs)
  const REQUIRED = ['v', 'uid', 'sid', 'handle', 'look', 'cls', 'lv', 'zone', 'x', 'y', 'dir', 'anim', 'arm', 'seq', 't'];
  function rules(p, v, existing) {
    const seg = p.split('/');
    if (seg[0] === 'inbox') return inboxRules(seg, v, existing);
    if (seg[0] === 'profiles' || seg[0] === 'cloudIndex' || seg[0] === 'cloudSaves') return cloudRules(seg, v);
    if (seg.length !== 4 || seg[0] !== 'presence' || seg[1] !== 'satisfy' || seg[2] !== 'main') return 'PERMISSION_DENIED: path ' + p;
    if (!user || seg[3] !== user.uid) return 'PERMISSION_DENIED: not your node';
    if (v === null) return null;
    for (const k in v) if (!FIELDS.includes(k)) return 'invalid field ' + k;
    for (const k of REQUIRED) if (!(k in v)) return 'missing ' + k;
    for (const k in v) if (v[k] === null) return 'null ' + k;
    if (v.v !== 1 || v.uid !== user.uid) return 'bad v/uid';
    if (JSON.stringify(v.t) !== JSON.stringify(SV)) return 't must be the server timestamp';
    if (typeof v.sid !== 'string' || v.sid.length < 8 || v.sid.length > 64) return 'sid';
    if (typeof v.handle !== 'string' || v.handle.length > 24) return 'handle';
    if (!(v.x >= 0 && v.x < POS_X && v.y >= -POS_Y && v.y < POS_Y)) return 'position';
    if (!/^(idle|walk|attack|dodge|dead)$/.test(v.anim)) return 'anim';
    if (v.arm !== 0 && v.arm !== 1) return 'arm';
    if ('room' in v && (typeof v.room !== 'string' || v.room.length > 16)) return 'room';
    if ('party' in v && (typeof v.party !== 'string' || v.party.length > 40)) return 'party';
    return null;
  }
  // profiles/{uid}, cloudIndex/{uid}/{pid}, cloudSaves/{uid}/{pid} (SAT-ONLINE-007): owner writes only
  const PID = /^[a-z0-9_]{4,40}$/;
  const keysAre = (o, want) => Object.keys(o).sort().join(',') === [...want].sort().join(',');
  const lookOk = (l) => l && keysAre(l, ['hair', 'hc', 'skin', 'top']) && Object.values(l).every((n) => typeof n === 'number' && n >= 0 && n <= 31);
  function cloudRules(seg, v) {
    if (!user || seg[1] !== user.uid) return 'PERMISSION_DENIED: not your ' + seg[0];
    if (v === null) return seg.length === (seg[0] === 'profiles' ? 2 : 3) ? null : 'PERMISSION_DENIED: path';
    if (JSON.stringify(v.t) !== JSON.stringify(SV)) return seg[0] + ' t';
    if (seg[0] === 'profiles') {
      if (seg.length !== 2) return 'PERMISSION_DENIED: path';
      if (!keysAre(v, ['handle', 'look', 'language', 'titleId', 'classId', 'lv', 'revision', 't'])) return 'profile fields';
      if (typeof v.handle !== 'string' || v.handle.length > 24 || !lookOk(v.look) || !['ar', 'en'].includes(v.language)) return 'profile values';
      if (typeof v.titleId !== 'string' || v.titleId.length > 32 || typeof v.classId !== 'string' || v.classId.length > 16) return 'profile values';
      if (!(v.lv >= 1 && v.lv <= 999) || !(v.revision >= 0)) return 'profile values';
      const old = data.get(seg.join('/'));
      if (old && !(v.revision > old.revision)) return 'profile revision must go up';
      return null;
    }
    if (seg.length !== 3 || !PID.test(seg[2])) return 'PERMISSION_DENIED: path';
    if (seg[0] === 'cloudSaves') {
      if (!keysAre(v, ['blob', 'rev', 't'])) return 'cloud save fields';
      return typeof v.blob === 'string' && v.blob.length > 0 && v.blob.length <= 400000 && v.rev >= 0 ? null : 'cloud save values';
    }
    if (!keysAre(v, ['pid', 'handle', 'lv', 'cls', 'schema', 'savedAt', 'rev', 'size', 't'])) return 'cloud index fields';
    if (v.pid !== seg[2] || typeof v.handle !== 'string' || v.handle.length > 24 || typeof v.cls !== 'string' || v.cls.length > 16) return 'cloud index values';
    return v.lv >= 1 && v.lv <= 999 && v.schema >= 1 && v.schema <= 99 && v.savedAt >= 0 && v.rev >= 0 && v.size >= 1 && v.size <= 400000 ? null : 'cloud index values';
  }

  // inbox/{uid}/{msg}: the owner may delete; anyone signed in may create a new message as themselves
  function inboxRules(seg, v, existing) {
    if (seg.length !== 3 || !user) return 'PERMISSION_DENIED: inbox path';
    if (v === null) return seg[1] === user.uid ? null : 'PERMISSION_DENIED: not your inbox';
    if (existing) return 'PERMISSION_DENIED: inbox messages are write-once';
    if (v.from !== user.uid) return 'PERMISSION_DENIED: forged from';
    const keys = Object.keys(v).sort().join(',');
    if (keys !== 'from,payload,seq,sid,t,type') return 'inbox fields ' + keys;
    if (!/^(party\.(invite|accept|decline|kick)|duel\.(challenge|accept|decline|ready|hit|hp|yield|end))$/.test(v.type)) return 'inbox type';
    const pk = Object.keys(v.payload).sort().join(',');
    if (v.payload.to !== seg[1]) return 'inbox payload';
    if (v.type.startsWith('party.')) {
      if (pk !== 'party,to') return 'inbox payload';
      if (typeof v.payload.party !== 'string' || v.payload.party.length > 40) return 'inbox party';
    } else {
      if (!['duel,to', 'duel,k,to', 'duel,k,n,to'].includes(pk)) return 'inbox duel payload ' + pk;
      if (typeof v.payload.duel !== 'string' || v.payload.duel.length > 40) return 'inbox duel';
      if ('k' in v.payload && !(typeof v.payload.k === 'number' && v.payload.k >= 0 && v.payload.k <= 999)) return 'inbox k';
      if ('n' in v.payload && !(typeof v.payload.n === 'number' && v.payload.n >= 0 && v.payload.n <= 100000)) return 'inbox n';
    }
    if (JSON.stringify(v.t) !== JSON.stringify(SV)) return 'inbox t';
    return null;
  }

  function listen(type) {
    return (r, cb) => {
      const l = { type, parent: r.path, cb };
      listeners.push(l);
      if (type === 'added') for (const [p, v] of data) if (parentOf(p) === r.path) setTimeout(() => cb(snap(p, v)), 0);
      return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
    };
  }

  const database = {
    getDatabase: (app, url) => { F.databaseURL = url; return {}; },
    ref: (db, path) => ({ path, key: keyOf(path) }),
    serverTimestamp: () => SV,
    push: (r, v) => {
      const p = r.path + '/-' + Date.now().toString(36) + rid();
      const err = rules(p, v, false);
      F.log.push({ op: 'push', path: p, err });
      if (err) { F.rejected.push(err); return Promise.reject(Object.assign(new Error(err), { code: 'PERMISSION_DENIED' })); }
      const stored = clone(v); stored.t = Date.now();
      if (connected) write('set', p, stored); else pending.set(p, stored);
      return Promise.resolve({ key: keyOf(p) });
    },
    set: (r, v) => {
      const err = rules(r.path, v, false);
      F.log.push({ op: 'set', path: r.path, err });
      if (err) { F.rejected.push(err); return Promise.reject(Object.assign(new Error(err), { code: 'PERMISSION_DENIED' })); }
      const stored = clone(v); stored.t = Date.now();
      mine.add(r.path);
      if (!connected) { pending.set(r.path, stored); return Promise.resolve(); }
      write('set', r.path, stored);
      return Promise.resolve();
    },
    remove: (r) => {
      const err = rules(r.path, null, true);
      F.log.push({ op: 'remove', path: r.path, err });
      if (err) { F.rejected.push(err); return Promise.reject(new Error(err)); }
      mine.delete(r.path); pending.delete(r.path);
      if (connected) write('remove', r.path);
      return Promise.resolve();
    },
    // one-shot read: the exact node, or its direct children as an object (enough for the cloud index)
    get: (r) => {
      const seg = r.path.split('/');
      const readable = seg[0] === 'profiles' ? !!user : ['cloudIndex', 'cloudSaves'].includes(seg[0]) && user && seg[1] === user.uid;
      F.log.push({ op: 'get', path: r.path });
      if (!readable) return Promise.reject(Object.assign(new Error('PERMISSION_DENIED: read ' + r.path), { code: 'PERMISSION_DENIED' }));
      if (data.has(r.path)) return Promise.resolve(snap(r.path, data.get(r.path)));
      const kids = {};
      for (const [p, v] of data) if (parentOf(p) === r.path) kids[keyOf(p)] = v;
      return Promise.resolve(snap(r.path, Object.keys(kids).length ? kids : null));
    },
    onChildAdded: listen('added'),
    onChildChanged: listen('changed'),
    onChildRemoved: listen('removed'),
    onValue: (r, cb) => {
      if (r.path === '.info/serverTimeOffset') { setTimeout(() => cb(snap(r.path, 0)), 0); return () => {}; }
      if (r.path !== '.info/connected') throw new Error('fake onValue supports only .info/connected and serverTimeOffset');
      connCbs.push(cb);
      setTimeout(() => cb(snap(r.path, connected)), 0);
      return () => { const i = connCbs.indexOf(cb); if (i >= 0) connCbs.splice(i, 1); };
    },
    onDisconnect: (r) => ({ remove: () => { discon.add(r.path); return Promise.resolve(); } }),
  };

  // Simulates the network dropping: the "server" runs onDisconnect for this client, the client sees
  // nobody else until it reconnects, and writes made meanwhile are flushed on reconnect.
  F.setConnected = (up) => {
    if (!up && connected) {
      for (const p of discon) ch.postMessage({ op: 'remove', p });
      discon.clear();
      for (const p of [...data.keys()]) if (!mine.has(p)) apply('remove', p);
      connected = false;
    } else if (up && !connected) {
      connected = true;
      for (const [p, v] of pending) write('set', p, v);
      pending.clear();
      ch.postMessage({ op: 'hello' });
    }
    for (const cb of connCbs) setTimeout(() => cb(snap('.info/connected', connected)), 0);
  };
  addEventListener('pagehide', () => { for (const p of discon) ch.postMessage({ op: 'remove', p }); });

  const auth = {
    getAuth: () => ({}),
    GoogleAuthProvider: function GoogleAuthProvider() {},
    onAuthStateChanged: (a, cb) => {
      if (!user) { try { user = JSON.parse(sessionStorage.getItem('fakeFirebaseUser')); } catch (e) { user = null; } }
      setTimeout(() => cb(user), 0);
      return () => {};
    },
    signInWithPopup: () => {
      if (F.popupBlocked) return Promise.reject(Object.assign(new Error('blocked'), { code: 'auth/popup-blocked' }));
      user = { uid: F.nextUid || 'g' + rid(), displayName: F.nextName }; // nextUid: the same Google account on a second device
      sessionStorage.setItem('fakeFirebaseUser', JSON.stringify(user));
      return Promise.resolve({ user });
    },
    signInWithRedirect: () => { F.redirected = true; return Promise.resolve(); },
    signOut: () => { user = null; sessionStorage.removeItem('fakeFirebaseUser'); return Promise.resolve(); },
  };
  const app = { initializeApp: (cfg, name) => { F.config = cfg; return { name }; } };

  window.__SATISFY_FIREBASE_LOADER__ = (ver) => { F.sdkVersion = ver; ch.postMessage({ op: 'hello' }); return Promise.resolve({ app, auth, database }); };
})();
