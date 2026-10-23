'use strict';
// SAT-ONLINE-154 (plan U045): the balance figures' new fields in the real rules (rules-eval): each optional, numbers in
// their bounds, your own only; an entry without them still passes (older pages).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(), A = 'gAhmed1', B = 'gBassem2';
const as = (uid) => ({ auth: { uid }, now: 1793000000000 });
const base = { wk: 'w2900', cls: 'warrior', lv: 12, n: 1, s: 2, w: 1, l: 0, gi: 0, go: 0, t: E.SV };
const put = (v, uid = A, who = A) => E.write(R, {}, { ['balance/' + uid]: v }, as(who)).ok;

test('the new figures: optional, in their bounds, yours only', () => {
  assert.equal(put(base), true, 'without them, as older pages write');
  const all = Object.assign({}, base, { dw: 3, dl: 2, ds: 40.5, pk: 1, pd: 0, pt: 6.2, gb: 2, lp: 180 });
  assert.equal(put(all), true, 'with them');
  for (const [k, bad] of [['dw', -1], ['dl', 1.5], ['ds', -2], ['pk', 2e6], ['pd', 'x'], ['pt', 2e8], ['gb', 10], ['gb', 1.5], ['lp', 70000], ['lp', -5]])
    assert.equal(put(Object.assign({}, all, { [k]: bad })), false, k + ' = ' + bad);
  assert.equal(put(Object.assign({}, all, { zz: 1 })), false, 'nothing else');
  assert.equal(put(all, B, A), false, "not someone else's");
});
