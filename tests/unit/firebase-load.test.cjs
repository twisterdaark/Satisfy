'use strict';
// SAT-ONLINE-034: the Firebase load keeps the sign-in in local persistence (owner #4); the online switch is on only on the
// GitHub Pages host unless set before the config loads (owner #3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadModules } = require('../harness/load-module.cjs');

function sdk(log, opts = {}) {
  const auth = { name: 'auth' };
  return {
    app: { initializeApp: (cfg, name) => ({ cfg, name }) },
    auth: Object.assign({ getAuth: () => auth }, opts.noPersistence ? {} : {
      browserLocalPersistence: 'LOCAL',
      setPersistence: (a, p) => { log.push([a === auth, p]); return opts.reject ? Promise.reject(new Error('blocked')) : Promise.resolve(); },
    }),
    database: { getDatabase: (app, url) => ({ app, url }) },
  };
}

async function loadWith(m) {
  globalThis.__SATISFY_FIREBASE_LOADER__ = () => Promise.resolve(m);
  try {
    const S = loadModules('src/net/firebase-config.js', 'src/net/firebase.js');
    return { S, r: await S.firebase.load(S.firebaseConfig) };
  } finally { delete globalThis.__SATISFY_FIREBASE_LOADER__; }
}

test('load sets local persistence before handing out auth', async () => {
  const log = [];
  const { S, r } = await loadWith(sdk(log));
  assert.deepEqual(log, [[true, 'LOCAL']]);
  assert.equal(r.auth.name, 'auth');
  assert.equal(r.db.url, S.firebaseConfig.databaseURL);
  assert.equal(S.netOnlineOnly, false, 'no location (or a local file): offline by default');
});

test('a refused or missing setPersistence keeps the default and still loads', async () => {
  const log = [];
  const { r } = await loadWith(sdk(log, { reject: true }));
  assert.equal(log.length, 1);
  assert.equal(r.auth.name, 'auth');
  const { r: r2 } = await loadWith(sdk([], { noPersistence: true }));
  assert.equal(r2.auth.name, 'auth');
});

test('a flag set before the config loads is kept', () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'Satisfy'), prev = globalThis.Satisfy;
  globalThis.Satisfy = { netOnlineOnly: true };
  try {
    const file = path.join(__dirname, '..', '..', 'src/net/firebase-config.js');
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    assert.equal(globalThis.Satisfy.netOnlineOnly, true);
    assert.ok(globalThis.Satisfy.firebaseConfig.databaseURL);
  } finally { if (had) globalThis.Satisfy = prev; else delete globalThis.Satisfy; }
});

test('the switch is on by default on the GitHub Pages host only', () => {
  const file = path.join(__dirname, '..', '..', 'src/net/firebase-config.js');
  const src = fs.readFileSync(file, 'utf8');
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'Satisfy'), prev = globalThis.Satisfy;
  const hadLoc = Object.prototype.hasOwnProperty.call(globalThis, 'location'), prevLoc = globalThis.location;
  const on = (hostname) => {
    globalThis.Satisfy = {};
    globalThis.location = { hostname };
    vm.runInThisContext(src, { filename: file });
    return globalThis.Satisfy.netOnlineOnly;
  };
  try {
    assert.equal(on('twisterdaark.github.io'), true);
    assert.equal(on(''), false, 'file://');
    assert.equal(on('localhost'), false);
    assert.equal(on('github.io.example.com'), false);
  } finally {
    if (had) globalThis.Satisfy = prev; else delete globalThis.Satisfy;
    if (hadLoc) globalThis.location = prevLoc; else delete globalThis.location;
  }
});

// SAT-ONLINE-120 (plan U022): ?emu points online play at the local emulators, only on a page served from this computer
function configAt(hostname, search) {
  const file = path.join(__dirname, '..', '..', 'src/net/firebase-config.js');
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'Satisfy'), prev = globalThis.Satisfy;
  const hadLoc = Object.prototype.hasOwnProperty.call(globalThis, 'location'), prevLoc = globalThis.location;
  try {
    globalThis.Satisfy = {};
    globalThis.location = { hostname, search };
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    return globalThis.Satisfy;
  } finally {
    if (had) globalThis.Satisfy = prev; else delete globalThis.Satisfy;
    if (hadLoc) globalThis.location = prevLoc; else delete globalThis.location;
  }
}

test('the emulator switch: only ?emu on a local page; the public site never points at a test database', () => {
  assert.deepEqual({ ...configAt('localhost', '?net=online&emu').firebaseEmulator }, { host: '127.0.0.1', dbPort: 9000, authUrl: 'http://127.0.0.1:9099' });
  assert.equal(configAt('127.0.0.1', '?emu=1').firebaseEmulator.host, '127.0.0.1');
  assert.equal(configAt('localhost', '?emu=devbox.local&net=online').firebaseEmulator.authUrl, 'http://devbox.local:9099');
  assert.equal(configAt('localhost', '?net=online').firebaseEmulator, null, 'not asked for');
  for (const h of ['twisterdaark.github.io', 'example.com', 'localhost.evil.com', '192.168.1.5', '']) assert.equal(configAt(h, '?net=online&emu').firebaseEmulator, null, h || 'file://');
  assert.equal(configAt('localhost', '?emu=a/b').firebaseEmulator, null, 'a host name only');
  const C = configAt('twisterdaark.github.io', '').firebaseConfig;
  assert.match(C.databaseURL, /^https:\/\/satisfy-online-8yjeix-default-rtdb\.[a-z0-9-]+\.firebasedatabase\.app$/, 'the real project');
  assert.equal(JSON.stringify(C).match(/localhost|127\.0\.0\.1|demo-|emulator/i), null, 'nothing local in the shipped config');
});

test('load() connects to the emulators when the switch says so, and only then', async () => {
  const calls = [];
  const sdkE = () => {
    const s = sdk([]);
    s.database.connectDatabaseEmulator = (db, host, port) => calls.push(['db', host, port]);
    s.auth.connectAuthEmulator = (a, url, o) => calls.push(['auth', url, !!(o && o.disableWarnings)]);
    return s;
  };
  globalThis.__SATISFY_FIREBASE_LOADER__ = () => Promise.resolve(sdkE());
  try {
    const S = loadModules('src/net/firebase-config.js', 'src/net/firebase.js');
    const r = await S.firebase.load(S.firebaseConfig);
    assert.deepEqual(calls, [], 'no switch: the real project');
    assert.equal(r.emulator, false);
    const S2 = loadModules('src/net/firebase-config.js', 'src/net/firebase.js');
    S2.firebaseEmulator = { host: '127.0.0.1', dbPort: 9000, authUrl: 'http://127.0.0.1:9099' };
    const prev = globalThis.Satisfy; globalThis.Satisfy = S2;
    try {
      const r2 = await S2.firebase.load(S2.firebaseConfig);
      assert.deepEqual(calls, [['db', '127.0.0.1', 9000], ['auth', 'http://127.0.0.1:9099', true]]);
      assert.equal(r2.emulator, true);
    } finally { if (prev === undefined) delete globalThis.Satisfy; else globalThis.Satisfy = prev; }
  } finally { delete globalThis.__SATISFY_FIREBASE_LOADER__; }
});
