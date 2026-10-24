'use strict';
// U291 Fishing festival (SAT-ONLINE-183): backend/database.rules.json itself, through the rules evaluator.
//   - your heaviest catch of the festival, as yourself with an account ID, only into the 15-minute slot that is running
//     and only while its ten minutes (and one more) last;
//   - a weight only goes up, at most every 15 seconds, and never past what that kind can weigh (Fish 3.2 kg, Snow Fish
//     4.1, Golden Fish 6.6, in tenths), in whole tenths;
//   - everyone signed in reads the board.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV;
const SLOT = 1963000, T0 = SLOT * 900000 + 60000; // a minute into a slot

test('the fishing festival board: yours, this slot, heavier only, no faster than every 15 s, within what a fish weighs', () => {
  let st = { accountIds: { ann: 'Ann', bob: 'Bob' } };
  const w = (uid, path, v, now = T0) => { const r = E.write(R, st, { [path]: v }, { auth: uid ? { uid } : null, now }); if (r.ok) st = r.after; return r.ok ? 'ok' : 'no'; };
  const e = (o = {}) => Object.assign({ s: SLOT, w: 12, k: 'fish', n: 'Ann', t: SV }, o);
  const p = (u, s = SLOT) => 'fishFest/' + s + '/' + u;
  assert.equal(w('cid', p('cid'), e()), 'no', 'no account ID');
  assert.equal(w('ann', p('bob'), e()), 'no', 'as someone else');
  assert.equal(w('ann', p('ann', SLOT - 1), e({ s: SLOT - 1 })), 'no', 'a slot that is over');
  assert.equal(w('ann', p('ann'), e(), SLOT * 900000 + 700000), 'no', 'after the ten minutes');
  assert.equal(w('ann', p('ann'), e({ w: 33 })), 'no', 'a Fish past 3.2 kg');
  assert.equal(w('ann', p('ann'), e({ w: 12.5 })), 'no', 'not whole tenths');
  assert.equal(w('ann', p('ann'), e({ k: 'shark' })), 'no', 'a kind there is not');
  assert.equal(w('ann', p('ann'), e({ x: 1 })), 'no', 'a field it does not have');
  assert.equal(w('ann', p('ann'), e()), 'ok', 'a 1.2 kg Fish');
  assert.equal(w('ann', p('ann'), e({ w: 20 }), T0 + 5000), 'no', 'again within 15 s');
  assert.equal(w('ann', p('ann'), e({ w: 10 }), T0 + 20000), 'no', 'a lighter one');
  assert.equal(w('ann', p('ann'), e({ w: 60, k: 'gfish' }), T0 + 20000), 'ok', 'a 6.0 kg Golden Fish');
  assert.equal(w('ann', p('ann'), e({ w: 67, k: 'gfish' }), T0 + 40000), 'no', 'a Golden Fish past 6.6 kg');
  assert.equal(w('bob', p('bob'), e({ w: 41, k: 'sfish', n: 'Bob' })), 'ok', 'a 4.1 kg Snow Fish');
  assert.equal(st.fishFest[String(SLOT)].ann.w, 60);
  const r = (uid, path) => E.read(R, st, path, { auth: uid ? { uid } : null, now: T0 }) ? 'ok' : 'no';
  assert.equal(r('bob', 'fishFest/' + SLOT), 'ok');
  assert.equal(r(null, 'fishFest/' + SLOT), 'no', 'signed out');
});
