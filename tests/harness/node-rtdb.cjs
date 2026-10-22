'use strict';
// SAT-ONLINE-113 (plan U372): an in-process Realtime Database for node, with the part of the Firebase database SDK the
// presence transport uses (src/net/firebase.js transport()): ref, query with orderByChild + startAt/endAt/equalTo,
// child added/changed/removed and value listeners, set, update, remove, push, get, onDisconnect, serverTimestamp.
// Many clients share one database; each counts the bytes the server would send it, so a load test can run 100 real
// transports in one process and compare what they download with tools/cost-model.cjs. No rules: tests/harness/
// fake-firebase.js is the one that checks them, in the browser.
//
//   const db = rtdb({ now: () => t });
//   const c = db.client('uid1');  // c.sdk is what Satisfy.firebase.transport(sdk, o) takes
//   c.down -> bytes this client downloaded; c.events -> how many child events it got; c.drop() runs its onDisconnects
//
// Bytes, as the model counts them: a child that enters a listener (or is listed when the listener starts) costs its whole
// JSON; a change costs the fields written; a removal costs nothing but the path. Each costs path + FRAMING on top. A client
// pays once for a write even when two of its queries see it (the SDK keeps one copy of a location).

const FRAMING = 45; // the same constant as tools/cost-model.cjs
const SV = { '.sv': 'timestamp' };

function parentOf(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function keyOf(p) { return p.slice(p.lastIndexOf('/') + 1); }
const clone = (v) => (v === undefined || v === null ? null : JSON.parse(JSON.stringify(v)));
const size = (v) => (v === undefined || v === null ? 0 : JSON.stringify(v).length);

function rtdb(o = {}) {
  const now = o.now || (() => Date.now());
  const data = new Map(); // a node's path -> its value (objects are stored whole at the node that was written)
  const listeners = []; // { c, type: 'added'|'changed'|'removed', parent, match, cb }
  const clients = [];
  let pushN = 0;

  function matcher(q) {
    if (!q || !q.child) return () => true;
    if ('eq' in q) return (v) => !!v && typeof v === 'object' && v[q.child] === q.eq;
    return (v) => { const x = v && typeof v === 'object' ? v[q.child] : undefined; return typeof x === 'number' && (q.lo == null || x >= q.lo) && (q.hi == null || x <= q.hi); };
  }
  function resolve(v) {
    if (v && typeof v === 'object' && v['.sv'] === 'timestamp') return now();
    if (v && typeof v === 'object') { const out = Array.isArray(v) ? [] : {}; for (const k in v) out[k] = resolve(v[k]); return out; }
    return v;
  }
  const snap = (p, v) => ({ key: keyOf(p), val: () => clone(v), exists: () => v !== undefined && v !== null });

  // one node changed from `old` to `now` by a write of `delta`: tell each listener on its parent, and bill each client once
  function changed(p, old, nv, delta) {
    const par = parentOf(p), bill = new Map();
    for (const l of listeners.slice()) {
      if (l.parent !== par) continue;
      const was = old !== undefined && l.match(old), is = nv !== undefined && l.match(nv);
      let kind = null;
      if (!was && is && l.type === 'added') kind = 'added';
      else if (was && is && l.type === 'changed') kind = 'changed';
      else if (was && !is && l.type === 'removed') kind = 'removed';
      if (!kind) continue;
      const cost = kind === 'added' ? size(nv) : kind === 'changed' ? size(delta) : 0;
      bill.set(l.c, Math.max(bill.get(l.c) || 0, cost + p.length + FRAMING));
      l.c.events++;
      l.cb(snap(p, kind === 'removed' ? old : nv));
    }
    for (const [c, b] of bill) c.down += b;
  }
  function write(p, nv, delta) {
    const old = data.get(p);
    if (nv === undefined || nv === null) { if (old === undefined) return; data.delete(p); changed(p, old, undefined, null); return; }
    data.set(p, nv);
    changed(p, old, nv, delta === undefined ? nv : delta);
  }

  function client(uid) {
    const c = { uid, down: 0, events: 0, discon: new Set(), offs: 0, connected: true, valueCbs: [] };
    const listen = (type) => (r, cb) => {
      const l = { c, type, parent: r.path, match: matcher(r.q), cb };
      listeners.push(l);
      if (type === 'added') for (const [p, v] of [...data]) if (parentOf(p) === r.path && l.match(v)) { c.down += size(v) + p.length + FRAMING; c.events++; cb(snap(p, v)); }
      return () => { const i = listeners.indexOf(l); if (i >= 0) { listeners.splice(i, 1); c.offs++; } };
    };
    const D = {
      ref: (db, path) => ({ path: path || '', key: path ? keyOf(path) : null }),
      query: (r, ...cs) => ({ path: r.path, key: r.key, q: Object.assign({}, r.q, ...cs) }),
      orderByChild: (child) => ({ child }),
      startAt: (lo) => ({ lo }),
      endAt: (hi) => ({ hi }),
      equalTo: (eq) => ({ eq }),
      limitToFirst: () => ({}),
      limitToLast: () => ({}),
      serverTimestamp: () => SV,
      onChildAdded: listen('added'),
      onChildChanged: listen('changed'),
      onChildRemoved: listen('removed'),
      onValue: (r, cb) => {
        if (r.path === '.info/connected') { const e = { cb }; c.valueCbs.push(e); cb(snap(r.path, c.connected)); return () => { const i = c.valueCbs.indexOf(e); if (i >= 0) c.valueCbs.splice(i, 1); }; }
        if (r.path === '.info/serverTimeOffset') { cb(snap(r.path, 0)); return () => {}; }
        cb(snap(r.path, data.get(r.path)));
        return () => {};
      },
      get: (r) => Promise.resolve(snap(r.path, data.get(r.path))),
      set: (r, v) => { write(r.path, resolve(v)); return Promise.resolve(); },
      update: (r, v) => {
        const old = data.get(r.path), nv = Object.assign({}, old && typeof old === 'object' ? old : {}), delta = resolve(v);
        for (const k in delta) { if (delta[k] === null) delete nv[k]; else nv[k] = delta[k]; }
        write(r.path, Object.keys(nv).length ? nv : null, delta);
        return Promise.resolve();
      },
      remove: (r) => { write(r.path, null); return Promise.resolve(); },
      push: (r, v) => { const k = 'k' + String(++pushN).padStart(8, '0'), p = r.path + '/' + k; write(p, resolve(v)); return Object.assign(Promise.resolve({ key: k }), { key: k, path: p }); },
      onDisconnect: (r) => ({ remove: () => { c.discon.add(r.path); return Promise.resolve(); }, cancel: () => { c.discon.delete(r.path); return Promise.resolve(); } }),
    };
    c.sdk = { m: { database: D }, db: c };
    c.drop = () => { for (const p of c.discon) write(p, null); c.discon.clear(); c.connected = false; for (const e of c.valueCbs) e.cb(snap('.info/connected', false)); };
    c.listening = () => listeners.filter((l) => l.c === c).length;
    clients.push(c);
    return c;
  }

  return { client, clients, data, listeners, FRAMING };
}

module.exports = { rtdb, FRAMING };
