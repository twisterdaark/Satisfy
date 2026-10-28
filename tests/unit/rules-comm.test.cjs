'use strict';
// Plan U219 crafting commissions: backend/database.rules.json itself, through the rules evaluator.
//   - commOrders/{oid} {by, n, rc, fee, t}: posted by its owner only, never changed; taken off by its owner while no smith's
//     claim holds it (a claim holds 10 minutes), or by the claiming smith in the update that delivers the piece;
//   - commClaim/{oid} {s, t, t0}: a smith's, not on their own order, while no other claim holds it (10 minutes); t0 is the
//     first claim's time, kept by the claims after it: the owner takes the order off 20 minutes after it whatever the claims;
//   - commDone/{owner}/{oid} {rc, json, by, sn, fee, t}: written by the claiming smith only with the order's removal, its
//     recipe and fee, the piece's json beginning with that recipe's id, 600 characters at most; the owner removes it;
//   - commPaid/{smith}/{oid} {g, t}: the order's fee, by the claiming smith in the same update, collected once.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV, T0 = 1767600000000;
const OID = 'c_ann_k1', ORD = { by: 'ann', n: 'Ann', rc: 'isword', fee: 600, t: SV };
const piece = (rc = 'isword') => JSON.stringify({ id: rc, slot: 'w', r: 2, atk: 66, by: 'Bob' });
const deliver = (smith = 'bob', o = {}) => Object.assign({
  ['commOrders/' + OID]: null, ['commClaim/' + OID]: null,
  ['commDone/ann/' + OID]: { rc: 'isword', json: piece(), by: smith, sn: 'Bob', fee: 600, t: SV },
  ['commPaid/' + smith + '/' + OID]: { g: 600, t: SV },
}, o);

function db() {
  let st = {};
  const w = (uid, u, now = T0) => { const r = E.write(R, st, u, { auth: uid ? { uid } : null, now }); if (r.ok) st = r.after; return r.ok ? 'ok' : 'no'; };
  return { w, get st() { return st; } };
}

test('a commission: posted by its owner, claimed by a smith, delivered with the pay in one update', () => {
  const D = db();
  assert.equal(D.w('bob', { ['commOrders/' + OID]: ORD }), 'no', 'posted as someone else');
  assert.equal(D.w('ann', { ['commOrders/' + OID]: { ...ORD, fee: 0 } }), 'no', 'no fee');
  assert.equal(D.w('ann', { ['commOrders/' + OID]: { ...ORD, rc: 'Bad Id' } }), 'no', 'not a recipe id');
  assert.equal(D.w('ann', { ['commOrders/' + OID]: { ...ORD, s: 'bob' } }), 'no', 'a field it does not have');
  assert.equal(D.w('ann', { ['commOrders/x_ann']: ORD }), 'no', 'not an order id');
  assert.equal(D.w('ann', { ['commOrders/' + OID]: ORD }), 'ok', 'posted');
  assert.equal(D.w('ann', { ['commOrders/' + OID]: { ...ORD, fee: 9 } }), 'no', 'never changed');
  assert.equal(D.w('bob', deliver()), 'no', 'delivered without a claim');
  assert.equal(D.w('ann', { ['commClaim/' + OID]: { s: 'ann', t: SV, t0: SV } }), 'no', 'claimed by its owner');
  assert.equal(D.w('bob', { ['commClaim/' + OID]: { s: 'cat', t: SV, t0: SV } }), 'no', 'claimed for someone else');
  assert.equal(D.w('bob', { ['commClaim/c_none']: { s: 'bob', t: SV, t0: SV } }), 'no', 'a claim on no order');
  assert.equal(D.w('bob', { ['commClaim/' + OID]: { s: 'bob', t: SV, t0: SV } }), 'ok', 'Bob claims it');
  assert.equal(D.w('cat', { ['commClaim/' + OID]: { s: 'cat', t: SV, t0: SV } }, T0 + 60000), 'no', 'nobody else while it holds');
  assert.equal(D.w('ann', { ['commOrders/' + OID]: null, ['commClaim/' + OID]: null }, T0 + 60000), 'no', 'its owner can\'t take it off while Bob works');
  assert.equal(D.w('cat', deliver('cat'), T0 + 60000), 'no', 'delivered by someone without the claim');
  assert.equal(D.w('bob', deliver('bob', { ['commPaid/bob/' + OID]: { g: 6000, t: SV } }), T0 + 60000), 'no', 'paid another fee');
  assert.equal(D.w('bob', deliver('bob', { ['commDone/ann/' + OID]: { rc: 'isword', json: piece('larmor'), by: 'bob', sn: 'Bob', fee: 600, t: SV } }), T0 + 60000), 'no', 'another piece');
  assert.equal(D.w('bob', deliver('bob', { ['commDone/ann/' + OID]: { rc: 'isword', json: piece() + ' '.repeat(600), by: 'bob', sn: 'Bob', fee: 600, t: SV } }), T0 + 60000), 'no', 'over 600 characters');
  const keep = deliver(); delete keep['commOrders/' + OID];
  assert.equal(D.w('bob', keep, T0 + 60000), 'no', 'delivered with the order left up');
  const nopay = deliver(); delete nopay['commDone/ann/' + OID];
  assert.equal(D.w('bob', nopay, T0 + 60000), 'no', 'paid without giving the piece');
  assert.equal(D.w('bob', deliver(), T0 + 60000), 'ok', 'Bob delivers: the order and claim go, the piece to Ann, the fee to him');
  assert.equal(E.read(R, D.st, 'commDone/ann', { auth: { uid: 'bob' }, now: T0 }), false, 'only Ann reads her pieces');
  assert.equal(E.read(R, D.st, 'commDone/ann', { auth: { uid: 'ann' }, now: T0 }), true);
  assert.equal(D.w('bob', { ['commPaid/bob/' + OID]: { g: 600, t: SV } }, T0 + 61000), 'no', 'paid twice');
  assert.equal(D.w('ann', { ['commPaid/bob/' + OID]: null }, T0 + 61000), 'no', 'collected by someone else');
  assert.equal(D.w('bob', { ['commPaid/bob/' + OID]: null }, T0 + 61000), 'ok', 'Bob collects');
  assert.equal(D.w('bob', { ['commDone/ann/' + OID]: null }, T0 + 61000), 'no', 'the piece removed by someone else');
  assert.equal(D.w('ann', { ['commDone/ann/' + OID]: null }, T0 + 61000), 'ok', 'Ann takes it');
});

test('a commission taken off: by its owner when no claim holds it, a stale claim given up, and taken again', () => {
  const D = db();
  assert.equal(D.w('ann', { ['commOrders/' + OID]: ORD }), 'ok');
  assert.equal(D.w('bob', { ['commOrders/' + OID]: null }), 'no', 'by someone else');
  assert.equal(D.w('bob', { ['commClaim/' + OID]: { s: 'bob', t: SV, t0: SV } }), 'ok');
  assert.equal(D.w('cat', { ['commClaim/' + OID]: { s: 'cat', t: SV, t0: SV } }, T0 + 601000), 'no', 'a later claim keeps the first one\'s time');
  assert.equal(D.w('cat', { ['commClaim/' + OID]: { s: 'cat', t: SV, t0: T0 } }, T0 + 601000), 'ok', 'Bob\'s claim lapsed after 10 minutes: Cat claims it');
  assert.equal(D.w('bob', deliver('bob'), T0 + 602000), 'no', 'Bob\'s lapsed claim delivers nothing');
  assert.equal(D.w('ann', { ['commOrders/' + OID]: null, ['commClaim/' + OID]: null }, T0 + 1202000), 'ok', 'Cat\'s lapsed too: Ann takes it off, claim and all');
  assert.equal(D.w('ann', { ['commOrders/c_ann_k2']: { ...ORD } }, T0 + 1300000), 'ok');
  assert.equal(D.w('ann', { ['commOrders/c_ann_k2']: null, ['commClaim/c_ann_k2']: null }, T0 + 1300000), 'ok', 'no claim on it: taken off at once');
});

test('claims one after another hold an order 20 minutes at most; a piece begins with its recipe', () => {
  const D = db();
  assert.equal(D.w('ann', { ['commOrders/' + OID]: ORD }), 'ok');
  assert.equal(D.w('mal', { ['commClaim/' + OID]: { s: 'mal', t: SV, t0: SV } }), 'ok', 'Mallory claims it, and never forges');
  for (const m of [1, 2]) {
    assert.equal(D.w('mal', { ['commClaim/' + OID]: { s: 'mal', t: SV, t0: T0 } }, T0 + m * 600001), 'ok', 'and claims it again as hers lapses');
    assert.equal(D.w('ann', { ['commOrders/' + OID]: null, ['commClaim/' + OID]: null }, T0 + m * 600001 + 50), m === 1 ? 'no' : 'ok', m === 1 ? 'held: 10 minutes after the first claim' : 'but 20 minutes after the first claim Ann takes it off');
  }
  assert.equal(D.w('ann', { ['commOrders/' + OID]: ORD }, T0 + 1300000), 'ok');
  assert.equal(D.w('bob', { ['commClaim/' + OID]: { s: 'bob', t: SV, t0: SV } }, T0 + 1300000), 'ok');
  const bad = (json) => D.w('bob', deliver('bob', { ['commDone/ann/' + OID]: { rc: 'isword', json, by: 'bob', sn: 'Bob', fee: 600, t: SV } }), T0 + 1310000);
  assert.equal(bad('{"x":1,"id":"isword"}'), 'no', 'the recipe\'s id not first');
  assert.equal(bad('{"id":"iswordx","r":1}'), 'no', 'another id that begins the same');
  assert.equal(bad(piece()), 'ok', 'the piece as the client sends it');
});
