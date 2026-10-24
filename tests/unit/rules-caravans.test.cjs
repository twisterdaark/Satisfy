'use strict';
// U220 Region merchant caravans (SAT-ONLINE-192, check: "route reward requires server proof"): backend/database.rules.json
// itself, through the rules evaluator.
//   - a contract: yours, with an account ID, from one town to another, at the server's time, with a road of at least 20 s;
//   - a delivery: once per contract, only of the contract you hold now, and not before its road's time has passed;
//   - only you read your own.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV;
const T0 = 1790000000000;

test('caravans: the contract, and a delivery only once the road has been travelled', () => {
  let st = { accountIds: { ann: 'Ann', bob: 'Bob' } };
  const w = (uid, path, v, now = T0) => { const r = E.write(R, st, { [path]: v }, { auth: uid ? { uid } : null, now }); if (r.ok) st = r.after; return r.ok ? 'ok' : 'no'; };
  const c = (o = {}) => Object.assign({ f: 'zWin', to: 'zPat', min: 60000, n: 'k3x9a1', t: SV }, o);
  assert.equal(w('cid', 'caravans/cid', c()), 'no', 'no account ID');
  assert.equal(w('ann', 'caravans/bob', c()), 'no', 'someone else\'s');
  assert.equal(w('ann', 'caravans/ann', c({ min: 5000 })), 'no', 'a road under 20 s');
  assert.equal(w('ann', 'caravans/ann', c({ to: 'zWin' })), 'no', 'to the town it left');
  assert.equal(w('ann', 'caravans/ann', c({ t: T0 - 60000 })), 'no', 'a time of its own');
  assert.equal(w('ann', 'caravans/ann', c({ pay: 99 })), 'no', 'a field it does not have');
  assert.equal(w('ann', 'caravans/ann', c()), 'ok', 'Winston to Patrian, a minute\'s road');
  const d = (uid, n, now) => w(uid, 'caravanDone/' + uid + '/' + n, { t: SV }, now);
  assert.equal(d('ann', 'k3x9a1', T0 + 30000), 'no', 'half a minute in: too soon');
  assert.equal(d('ann', 'other1', T0 + 70000), 'no', 'a contract it is not');
  assert.equal(d('bob', 'k3x9a1', T0 + 70000), 'no', 'someone else');
  assert.equal(d('ann', 'k3x9a1', T0 + 70000), 'ok', 'after the road');
  assert.equal(d('ann', 'k3x9a1', T0 + 90000), 'no', 'once');
  const r = (uid, path) => E.read(R, st, path, { auth: uid ? { uid } : null, now: T0 }) ? 'ok' : 'no';
  assert.equal(r('ann', 'caravans/ann'), 'ok');
  assert.equal(r('bob', 'caravans/ann'), 'no');
  assert.equal(r('bob', 'caravanDone/ann'), 'no');
});
