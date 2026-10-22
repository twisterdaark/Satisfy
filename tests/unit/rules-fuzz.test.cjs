'use strict';
// SAT-ONLINE-102 (plan U369 rules fuzzing, U021): the real rules file (backend/database.rules.json), evaluated in Node by
// tests/harness/rules-eval.cjs, against random writes and reads:
// - nobody signed out writes anything, anywhere, in any state, also as part of a multi-location update;
// - nobody signed out reads anything;
// - a location only its owner writes (".write" starting "auth != null && auth.uid === $uid") is not written by anyone else,
//   by its own rule or one above it; the same for reads;
// - a time stamped by the server (t === now) can't be chosen by the client;
// and a few of the game's shared records played through as the regression tests play them over the fake (drops and their
// claims, bounties, friend requests), so the fake's copy of the rules and the real file agree where it matters.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV, NOW = 1767606030000; // SATISFY_RULES: another rules file (a PR's)

// a small seeded random (the same trials every run)
function prng(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = prng(0x51a7);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const UIDS = ['uA', 'uB', 'uC'];
const KEYS = ['uA', 'uB', 'g_uA', 'a_uA_0', 'd_1', 'b_1', 'k_1', 'r_uA_1', 'c_uA_1', 'w9', 'zz', 'satisfy', 'castle', 'tCanyon', 'ahmed', 'main'];

// every rule location, as its keys ($names for wildcards), and the rule node there
const LOCS = [];
(function walk(node, at) {
  LOCS.push({ at, node });
  for (const k of Object.keys(node)) if (k[0] !== '.' && node[k] && typeof node[k] === 'object') walk(node[k], at.concat(k));
})(R, []);

// a location filled in: each $name a key (the given ones first)
const fill = (at, bind = {}) => at.map((k) => (k[0] === '$' ? (bind[k] != null ? bind[k] : pick(KEYS)) : k)).join('/');
// a value of any shape; for a rule node, often one with its own children (each a random value, t the server's time)
function value(node, depth = 0) {
  const r = rnd();
  if (r < 0.12) return null;
  if (r < 0.24) return pick([0, 1, -1, 5, 1e9, NOW, 3.5]);
  if (r < 0.36) return pick(['', 'uA', 'uB', 'x', 'ahmed', 'a_uA_0', 'isword', 'tank']);
  if (r < 0.42) return pick([true, false]);
  const o = {}, kids = node ? Object.keys(node).filter((k) => k[0] !== '.') : [];
  for (const k of kids) { if (rnd() < 0.8) o[k[0] === '$' ? pick(KEYS) : k] = k === 't' && rnd() < 0.7 ? SV : depth < 3 ? value(node[k], depth + 1) : pick(['uA', 1]); }
  if (!kids.length || rnd() < 0.2) o[pick(KEYS)] = depth < 3 ? value(null, depth + 1) : 1;
  return o;
}
// a database in which the written locations, their neighbours and the records rules look at may exist
function state(paths) {
  const s = {};
  const put = (p, v) => { const ss = p.split('/'); let o = s; for (let i = 0; i < ss.length - 1; i++) { if (!o[ss[i]] || typeof o[ss[i]] !== 'object') o[ss[i]] = {}; o = o[ss[i]]; } o[ss[ss.length - 1]] = v; };
  for (const p of paths) if (p && rnd() < 0.5) put(p, value(null));
  for (let i = 0; i < 4; i++) { const L = pick(LOCS); if (L.at.length) put(fill(L.at), value(L.node)); }
  for (const k of Object.keys(s)) if (s[k] === null) delete s[k];
  return JSON.parse(JSON.stringify(s));
}

test('rules evaluator: == as ===, regexes and strings left alone', () => {
  assert.equal(E.strictEq("a == b && c != d && e === f && g !== h && x.matches(/^a==b$/) && 'x==y' == z"), "a === b && c !== d && e === f && g !== h && x.matches(/^a==b$/) && 'x==y' === z");
  assert.ok(LOCS.length > 400, 'every rule location: ' + LOCS.length);
});

test('fuzz: nobody signed out writes anything, in any state, also inside a multi-location update', () => {
  const bad = [];
  for (let i = 0; i < 6000; i++) {
    const n = rnd() < 0.3 ? 2 : 1, u = {};
    for (let j = 0; j < n; j++) { const L = pick(LOCS); u[fill(L.at)] = value(L.node); }
    const r = E.write(R, state(Object.keys(u)), u, { auth: null, now: NOW + Math.floor(rnd() * 864e5) });
    if (r.granted) bad.push(JSON.stringify(u).slice(0, 200));
  }
  assert.deepEqual(bad.slice(0, 5), []);
});

test('fuzz: nobody signed out reads anything', () => {
  const bad = [];
  for (const L of LOCS) for (let i = 0; i < 3; i++) { const p = fill(L.at); if (E.read(R, state([p]), p, { auth: null, now: NOW })) bad.push(p); }
  assert.deepEqual(bad, []);
});

test("fuzz: a location only its owner writes or reads is nobody else's, by its own rule or one above it", () => {
  const own = (x) => typeof x === 'string' && /^auth != null && auth\.uid === (\$[A-Za-z0-9_]+)( &&|$)/.exec(x);
  const W = LOCS.filter((L) => own(L.node['.write'])), Rd = LOCS.filter((L) => own(L.node['.read']));
  assert.ok(W.length >= 15 && Rd.length >= 10, 'owner-only locations: ' + W.length + ' written, ' + Rd.length + ' read');
  const bad = [];
  for (const L of W) {
    const v = own(L.node['.write'])[1];
    for (let i = 0; i < 40; i++) {
      const me = pick(UIDS), p = fill(L.at, { [v]: pick(UIDS.filter((u) => u !== me)) }), st = state([p]);
      for (const val of [value(L.node), null]) { const d = E.grantedAbove(R, st, { [p]: val }, p, { auth: { uid: me }, now: NOW }); if (d >= 0) bad.push(p + ' by ' + me + ' (rule at depth ' + d + ')'); }
    }
  }
  for (const L of Rd) {
    const v = own(L.node['.read'])[1];
    for (let i = 0; i < 10; i++) { const me = pick(UIDS), p = fill(L.at, { [v]: pick(UIDS.filter((u) => u !== me)) }); if (E.read(R, state([p]), p, { auth: { uid: me }, now: NOW })) bad.push('read ' + p + ' by ' + me); }
  }
  assert.deepEqual(bad.slice(0, 8), []);
});

test('fuzz: a time the server stamps (t === now) is never one the client chose', () => {
  // every child named t is the server's time, but for these two: a traded item's t is its trade's id, and a guild keeps
  // the time it has (or takes the server's)
  const other = LOCS.filter((L) => L.at[L.at.length - 1] === 't' && L.node['.validate'] !== 'newData.val() === now').map((L) => L.at.join('/'));
  assert.deepEqual(other, ['tradedItems/$iid/t', 'guilds/$gid/t']);
  const T = LOCS.filter((L) => L.at[L.at.length - 1] === 't' && L.node['.validate'] === 'newData.val() === now');
  assert.ok(T.length >= 30, 'server-stamped times: ' + T.length);
  for (const L of T) {
    const p = fill(L.at);
    for (const t of [NOW - 1, NOW + 1, NOW - 864e5, 0, 'now']) {
      const r = E.write(R, {}, { [p]: t }, { auth: { uid: pick(UIDS) }, now: NOW });
      assert.equal(r.ok, false, p + ' = ' + t);
    }
  }
});

// the game's shared records, as the regression tests play them over the fake, here against the real rules
function db() {
  let st = {};
  const w = (uid, u, now = NOW) => { const r = E.write(R, st, u, { auth: uid ? { uid } : null, now }); if (r.ok) st = r.after; return r.ok ? 'ok' : 'no'; };
  return { w, get st() { return st; }, set: (v) => { st = v; } };
}

test('real rules: a drop is its owner\'s for 2 s, then the first claimer\'s for a minute; claimed once', () => {
  const D = db(), drop = { o: 'uA', x: 10, y: 10, k: 'ore', n: 1, r: 0, t: SV };
  assert.equal(D.w('uB', { 'drops/d_1': Object.assign({}, drop) }), 'no', 'not in another player\'s name');
  assert.equal(D.w('uA', { 'drops/d_1': drop }), 'ok');
  assert.equal(D.w('uB', { 'drops/d_1': null }, NOW + 1000), 'no', 'not taken off by another without a claim');
  assert.equal(D.w('uB', { 'dropClaims/d_1': { by: 'uB', t: SV } }, NOW + 1000), 'no', 'its owner\'s for 2 s');
  assert.equal(D.w('uB', { 'dropClaims/d_1': { by: 'uA', t: SV } }, NOW + 3000), 'no', 'a claim is the claimer\'s own');
  assert.equal(D.w('uB', { 'dropClaims/d_1': { by: 'uB', t: SV } }, NOW + 3000), 'ok');
  assert.equal(D.w('uC', { 'dropClaims/d_1': { by: 'uC', t: SV } }, NOW + 3100), 'no', 'claimed once');
  assert.equal(D.w('uB', { 'drops/d_1': null }, NOW + 3200), 'ok', 'off by its claimer');
  assert.equal(D.w('uA', { 'drops/d_2': Object.assign({}, drop, { n: 0 }) }), 'no', 'no empty drop');
});

test('real rules: a bounty is paid only to the killer recorded after it was posted, and once', () => {
  const D = db();
  assert.equal(D.w('uA', { 'bounties/b_1': { by: 'uA', byN: 'Ahmed', tu: 'uA', tN: 'Ahmed', g: 500, t: SV } }), 'no', 'not on yourself');
  assert.equal(D.w('uA', { 'bounties/b_1': { by: 'uA', byN: 'Ahmed', tu: 'uT', tN: 'Tarek', g: 500, t: SV } }), 'ok');
  const paid = { by: 'uB', kid: 'k_1', g: 500, t: SV };
  assert.equal(D.w('uB', { 'bountyPaid/b_1': paid }, NOW + 10), 'no', 'no kill, no pay');
  const st = D.st; st.kills = { uT: { k_1: { k: 'uB', t: NOW + 5 } } }; D.set(st);
  assert.equal(D.w('uB', { 'bountyPaid/b_1': Object.assign({}, paid, { g: 5000 }) }, NOW + 10), 'no', 'its own gold, no more');
  assert.equal(D.w('uC', { 'bountyPaid/b_1': Object.assign({}, paid, { by: 'uC' }) }, NOW + 10), 'no', 'the killer only');
  assert.equal(D.w('uB', { 'bountyPaid/b_1': paid }, NOW + 10), 'ok');
  assert.equal(D.w('uB', { 'bountyPaid/b_1': paid }, NOW + 20), 'no', 'once');
});

test('real rules: a friend request is from its sender, accepted by its receiver only', () => {
  const D = db(), req = { n: 'Ahmed', t: SV };
  assert.equal(D.w('uC', { 'friendReq/uB/uA': req }), 'no', 'not in another\'s name');
  assert.equal(D.w('uA', { 'friendReq/uA/uA': req }), 'no', 'not to yourself');
  assert.equal(D.w('uA', { 'friendReq/uB/uA': req }), 'ok');
  assert.equal(D.w('uC', { 'friends/uB/uA': { n: 'Ahmed', t: SV } }), 'no', 'nobody else accepts it');
  assert.equal(D.w('uA', { 'friends/uA/uB': { n: 'Bassem', t: SV } }), 'no', 'the sender doesn\'t accept their own');
  assert.equal(D.w('uB', { 'friends/uB/uA': { n: 'Ahmed', t: SV }, 'friends/uA/uB': { n: 'Bassem', t: SV }, 'friendReq/uB/uA': null }), 'ok', 'the receiver accepts: both lists and the request gone, in one write');
  assert.equal(E.read(R, D.st, 'friends/uA', { auth: { uid: 'uB' }, now: NOW }), false, "your list is yours");
});
