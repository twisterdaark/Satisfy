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

test('rules evaluator: a write is granted on its own path only, never by the rules of the children it changes', () => {
  // as the real Realtime Database does (tests/emulator: a guild master can't delete the whole vault whose items it may take)
  const rules = { '.read': false, '.write': false, a: { $k: { '.write': 'true' } } }, state = { a: { x: 1, y: 2 } };
  assert.equal(E.write(rules, state, { 'a/x': null }).ok, true, 'each child on its own');
  assert.equal(E.write(rules, state, { a: null }).ok, false, 'not the parent, even when every child would be');
  assert.equal(E.write(rules, state, { 'a/x': null, 'a/y': null }).ok, true, 'a multi-location update of the children is');
});

test("rules evaluator: a parent's .validate holds a write to a child (Claude-B's review of #136)", () => {
  const rules = { '.read': false, '.write': false, a: { $k: { '.write': 'true', '.validate': "newData.hasChildren(['x', 'y'])", x: { '.validate': 'newData.isNumber()' }, y: { '.validate': 'newData.isNumber()' } } } };
  assert.equal(E.write(rules, {}, { 'a/k/x': 1 }).ok, false, 'x alone leaves a/k without y');
  assert.equal(E.write(rules, {}, { 'a/k': { x: 1, y: 2 } }).ok, true);
  assert.equal(E.write(rules, { a: { k: { x: 1, y: 2 } } }, { 'a/k/x': 3 }).ok, true, 'a/k still has both');
  assert.equal(E.write(rules, { a: { k: { x: 1, y: 2 } } }, { 'a/k/y': null }).ok, false, 'removing y leaves it without');
  assert.equal(E.write(rules, { a: { k: { x: 1, y: 2 } } }, { 'a/k': null }).ok, true, 'a location left empty is not validated');
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

test('real rules (SAT-ONLINE-104): the ranks\' rights the master sets, and a guild\'s records going only with the guild', () => {
  const D = db(), G = 'g_uA';
  // a guild of three: Ahmed the master, Bassem an officer, Carim a member
  D.set({
    guilds: { [G]: { name: 'Rights', nk: 'rights', master: 'uA', col: '#5aa0ff', t: NOW } }, guildNames: { rights: G },
    guildMembers: { [G]: { uA: { rk: 'm', n: 'Ahmed', c: 0, on: NOW }, uB: { rk: 'o', n: 'Bassem', c: 0, on: NOW }, uC: { rk: 'r', n: 'Carim', c: 0, on: NOW } } },
    guildVault: { [G]: { v_1: { k: 'ore', n: 5, r: 0, by: 'uC', byN: 'Carim', t: NOW } } },
    guildWeekPaid: { [G]: { w100: { uB: { 1: { t: NOW } } } } },
    guildLog: { [G]: { l_1: { by: 'uC', n: 'Carim', k: 'give', g: 100, t: NOW } } },
  });
  const take = (uid) => ({ ['guildVault/' + G + '/v_1']: null, ['guildVaultTaken/' + G + '/v_1']: { by: uid, t: SV } });
  const note = (uid, n, v) => ({ ['guildNote/' + G]: { s: 'Hello', by: uid, n, v, t: SV } });
  const st0 = JSON.parse(JSON.stringify(D.st));
  // the defaults: the officer takes and writes the notice; the member does neither
  assert.equal(E.write(R, st0, take('uB'), { auth: { uid: 'uB' }, now: NOW }).ok, true, 'an officer takes');
  assert.equal(E.write(R, st0, take('uC'), { auth: { uid: 'uC' }, now: NOW }).ok, true, 'a member takes its own');
  const st1 = JSON.parse(JSON.stringify(st0)); st1.guildVault[G].v_1.by = 'uA';
  assert.equal(E.write(R, st1, take('uC'), { auth: { uid: 'uC' }, now: NOW }).ok, false, "a member doesn't take another's");
  assert.equal(E.write(R, st0, note('uC', 'Carim', 1), { auth: { uid: 'uC' }, now: NOW }).ok, false, 'a member writes no notice');
  // only the master sets the rights, booleans of the five
  const perm = { o: { take: false }, r: { note: true } }, g = Object.assign({}, st0.guilds[G], { perm });
  assert.equal(D.w('uB', { ['guilds/' + G]: g }), 'no', 'not an officer');
  assert.equal(D.w('uA', { ['guilds/' + G]: Object.assign({}, g, { perm: { o: { take: 'no' } } }) }), 'no', 'booleans');
  assert.equal(D.w('uA', { ['guilds/' + G]: Object.assign({}, g, { perm: { o: { kick: true } } }) }), 'no', 'the five rights only');
  assert.equal(D.w('uA', { ['guilds/' + G]: Object.assign({}, g, { perm: { m: { take: false } } }) }), 'no', 'nothing for the master');
  assert.equal(D.w('uA', { ['guilds/' + G]: g }), 'ok');
  assert.equal(D.w('uB', take('uB')), 'no', 'the officer without "take" takes nothing of others');
  assert.equal(D.w('uC', note('uC', 'Carim', 1)), 'ok', 'the member with "note" writes the notice');
  assert.equal(D.w('uB', note('uB', 'Bassem', 2)), 'ok', 'and the officer still does');
  // a guild's own records go only with the guild
  assert.equal(D.w('uA', { ['guildWeekPaid/' + G]: null }), 'no', 'the weekly rewards taken stay taken');
  assert.equal(D.w('uA', { ['guildLog/' + G]: null }), 'no', 'the log stays');
  assert.equal(D.w('uA', { ['guilds/' + G]: null, 'guildNames/rights': null, ['guildMembers/' + G]: null, ['guildVault/' + G]: null, ['guildWeekPaid/' + G]: null, ['guildNote/' + G]: null, ['guildLog/' + G]: null }), 'ok', 'all of it with the guild');
});

test('real rules (SAT-ONLINE-105): a research is paid once, in order, exactly its cost; never negative or short', () => {
  const D = db(), G = 'g_uA';
  D.set({
    guilds: { [G]: { name: 'Scholars', nk: 'scholars', master: 'uA', col: '#5aa0ff', t: NOW } }, guildNames: { scholars: G },
    guildMembers: { [G]: { uA: { rk: 'm', n: 'Ahmed', c: 0, on: NOW }, uB: { rk: 'o', n: 'Bassem', c: 0, on: NOW }, uC: { rk: 'r', n: 'Carim', c: 0, on: NOW } } },
    guildBank: { [G]: { in: 900000, s: 0, lb: 'uA', lg: 100000, t: NOW } },
  });
  const go = (uid, node, cost, v = 1) => { const k = D.st.guildBank[G]; return D.w(uid, { ['guildBuild/' + G + '/' + node]: v, ['guildBank/' + G]: { in: k.in, s: k.s + cost, lb: k.lb, lg: k.lg, t: SV } }); };
  assert.equal(go('uB', 'xp2', 120000), 'no', 'not before what it needs');
  assert.equal(go('uB', 'xp1', 29999), 'no', 'not short');
  assert.equal(go('uB', 'xp1', -30000), 'no', 'never negative');
  assert.equal(go('uB', 'xp1', 30001), 'no', 'not more either');
  assert.equal(go('uC', 'xp1', 30000), 'no', 'a member without "spend"');
  assert.equal(go('uB', 'xp1', 30000, 2), 'no', 'one level');
  assert.equal(go('uB', 'zz', 30000), 'no', 'only the seven');
  assert.equal(D.w('uB', { ['guildBuild/' + G + '/xp1']: 1 }), 'no', 'not free');
  assert.equal(go('uB', 'xp1', 30000), 'ok');
  assert.equal(go('uB', 'xp1', 30000), 'no', 'once');
  for (const [n, c] of [['gd1', 30000], ['q1', 30000], ['xp2', 120000], ['gd2', 120000]]) assert.equal(go('uB', n, c), 'ok', n);
  assert.equal(go('uB', 'all', 400000), 'no', 'the top needs all three below it');
  assert.equal(go('uB', 'hp1', 120000), 'ok');
  assert.equal(go('uA', 'all', 400000), 'ok');
  assert.equal(D.st.guildBank[G].s, 850000);
  // the treasury never spends more than was given
  assert.equal(D.w('uA', { ['guildBuild/' + G + '/forge']: 1, ['guildBank/' + G]: { in: 900000, s: 900001, lb: 'uA', lg: 100000, t: SV } }), 'no');
});
