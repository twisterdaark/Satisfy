'use strict';
// Plan U207 guild supply orders: backend/database.rules.json itself, through the rules evaluator.
//   - guildSupply/{gid}/{s0|s1|s2} {k, n, p, d, id, by, at}: posted and taken off by whoever may spend the treasury;
//     nothing in it changes but d;
//   - a member's delivery raises d, in one write with the pieces in the vault as v_{slot}_{id}_{uid} (theirs, that
//     material, that many) and the pay taken from the treasury (q × p, nothing else bought or paid in it); once a member,
//     while that vault entry stands; never past n;
//   - a disband clears the orders, and so does the next founding of a guild of the same id.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV, T0 = 1767600000000;
const ORD = { k: 'ore', n: 100, p: 5, d: 0, id: 'abc123xy', by: 'ann', at: SV };

function guild() {
  let st = {
    guilds: { g_one: { master: 'ann' } },
    guildMembers: { g_one: { ann: { rk: 'm' }, rob: { rk: 'r' }, sue: { rk: 'r' } } },
    guildBank: { g_one: { in: 1000000, s: 0, lb: 'ann', lg: 1000000, t: T0 - 1000 } },
  };
  const w = (uid, u, now = T0) => { const r = E.write(R, st, u, { auth: { uid }, now }); if (r.ok) st = r.after; return r.ok ? 'ok' : 'no'; };
  // a delivery as the client sends it, with what to change
  const give = (uid, q, x = {}) => {
    const o = st.guildSupply.g_one.s0, b = st.guildBank.g_one;
    return w(uid, Object.assign({
      'guildBank/g_one': { in: b.in, s: b.s + q * o.p, lb: b.lb, lg: b.lg, t: SV },
      'guildSupply/g_one/s0': { ...o, d: o.d + q },
      ['guildVault/g_one/v_s0_' + o.id + '_' + uid]: { k: o.k, n: q, r: 0, by: uid, byN: uid, t: SV },
    }, x));
  };
  return { w, give, get st() { return st; } };
}

test('supply orders: posted by those who may spend, delivered by members into the vault, paid from the treasury', () => {
  const G = guild();
  assert.equal(G.w('rob', { 'guildSupply/g_one/s0': ORD }), 'no', 'a member can\'t post');
  assert.equal(G.w('ann', { 'guildSupply/g_one/s3': ORD }), 'no', 'three slots');
  assert.equal(G.w('ann', { 'guildSupply/g_one/s0': { ...ORD, d: 5 } }), 'no', 'delivered from the start');
  assert.equal(G.w('ann', { 'guildSupply/g_one/s0': { ...ORD, p: 0 } }), 'no', 'for nothing');
  assert.equal(G.w('ann', { 'guildSupply/g_one/s0': ORD }), 'ok', 'Ann posts: 100 ore at 5 gold');
  assert.equal(G.give('rob', 30, { 'guildBank/g_one': { in: 1000000, s: 100, lb: 'ann', lg: 1000000, t: SV } }), 'no', 'paid more than 30 × 5');
  assert.equal(G.give('rob', 30, { ['guildVault/g_one/v_s0_abc123xy_rob']: { k: 'ore', n: 20, r: 0, by: 'rob', byN: 'rob', t: SV } }), 'no', 'fewer in the vault');
  assert.equal(G.give('rob', 30, { ['guildVault/g_one/v_s0_abc123xy_rob']: { k: 'wood', n: 30, r: 0, by: 'rob', byN: 'rob', t: SV } }), 'no', 'another material');
  assert.equal(G.give('rob', 30, { ['guildVault/g_one/v_s0_abc123xy_rob']: null }), 'no', 'nothing in the vault');
  assert.equal(G.give('rob', 30, { 'guildSupply/g_one/s0': { ...G.st.guildSupply.g_one.s0, d: 30, p: 1 } }), 'no', 'the order changed');
  assert.equal(G.give('rob', 30, { 'guildBuild/g_one/forge': 1 }), 'no', 'a building in the same write');
  assert.equal(G.give('rob', 30), 'ok', 'Rob delivers 30: in the vault, 150 from the treasury');
  assert.equal(G.st.guildBank.g_one.s, 150); assert.equal(G.st.guildSupply.g_one.s0.d, 30);
  assert.equal(G.give('rob', 10), 'no', 'once a member, while his delivery is in the vault');
  assert.equal(G.give('sue', 71), 'no', 'past what is asked');
  assert.equal(G.give('sue', 70), 'ok', 'Sue fills it');
  assert.equal(G.w('rob', { 'guildSupply/g_one/s0': null }), 'no', 'a member can\'t take it off');
  assert.equal(G.w('ann', { 'guildSupply/g_one/s0': null }), 'ok', 'Ann does');
  assert.equal(E.read(R, G.st, 'guildSupply/g_one', { auth: { uid: 'sue' }, now: T0 }), true, 'members read them');
  assert.equal(E.read(R, G.st, 'guildSupply/g_one', { auth: { uid: 'eve' }, now: T0 }), false, 'others don\'t');
});

test('the treasury can\'t pay what it doesn\'t hold; a research node and a delivery don\'t share a payment', () => {
  const G = guild();
  G.st.guildBank.g_one.in = 100; G.st.guildBank.g_one.lg = 100;
  assert.equal(G.w('ann', { 'guildSupply/g_one/s0': ORD }), 'ok');
  assert.equal(G.give('rob', 30), 'no', '150 from a treasury of 100');
  assert.equal(G.give('rob', 20), 'ok', '100 it can');
  const H = guild();
  assert.equal(H.w('ann', { 'guildSupply/g_one/s0': { ...ORD, p: 100000, n: 9999 } }), 'ok');
  assert.equal(H.give('ann', 1, { 'guildResearch/g_one': 1 }), 'no', 'a node and a delivery for one price');
});
