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
