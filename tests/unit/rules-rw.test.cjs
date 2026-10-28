'use strict';
// U365 Restoring the West together (v3.24): backend/database.rules.json itself, through the rules evaluator.
//   - world/satisfy/rw/{uid} {n, t}: your own count of giant worms and nests put down in the Western Sands;
//   - it only grows, by at most 50 a write (the first write too), at most every 30 s, never past 1,000,000, whole numbers;
//   - nobody removes one, and everyone signed in reads them all (the world's total is their sum).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV, T0 = 1767600000000;

test('the world restoration count: yours, only up, 50 at most a write, every 30 s at most', () => {
  let st = {};
  const w = (uid, path, v, now) => { const r = E.write(R, st, { [path]: v }, { auth: uid ? { uid } : null, now }); if (r.ok) st = r.after; return r.ok ? 'ok' : 'no'; };
  const p = (u) => 'world/satisfy/rw/' + u;
  assert.equal(w(null, p('ann'), { n: 5, t: SV }, T0), 'no', 'signed out');
  assert.equal(w('ann', p('bob'), { n: 5, t: SV }, T0), 'no', 'as someone else');
  assert.equal(w('ann', p('ann'), { n: 51, t: SV }, T0), 'no', 'more than 50 at once');
  assert.equal(w('ann', p('ann'), { n: 2.5, t: SV }, T0), 'no', 'not a whole number');
  assert.equal(w('ann', p('ann'), { n: 5, t: SV, x: 1 }, T0), 'no', 'a field it does not have');
  assert.equal(w('ann', p('ann'), { n: 50, t: SV }, T0), 'ok', 'a first 50');
  assert.equal(w('ann', p('ann'), { n: 60, t: SV }, T0 + 21000), 'no', 'again within 30 s');
  assert.equal(w('ann', p('ann'), { n: 49, t: SV }, T0 + 31000), 'no', 'down');
  assert.equal(w('ann', p('ann'), { n: 101, t: SV }, T0 + 31000), 'no', 'more than 50 more');
  assert.equal(w('ann', p('ann'), { n: 100, t: SV }, T0 + 31000), 'ok', '50 more');
  assert.equal(w('ann', p('ann'), null, T0 + 60000), 'no', 'never removed');
  assert.equal(E.read(R, st, 'world/satisfy/rw', { auth: { uid: 'bob' }, now: T0 }), true, 'everyone signed in reads them');
  assert.equal(E.read(R, st, 'world/satisfy/rw', { auth: null, now: T0 }), false);
});
