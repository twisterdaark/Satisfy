'use strict';
// Plan U045 and U284 (v3.67): the balance record's new fields, through the real rules: duels and PvP kills no more than the
// wins, losses and PvP deaths no more than the losses, the gear band 0–4, the round trip up to 60 s, pieces by rating, the
// account id's shape; the record is still only its owner's to write and the admins' to read.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV, T0 = 1767600000000;
const base = { wk: 'w2930', cls: 'mage', lv: 80, n: 3, s: 12.5, w: 2, l: 1, t: SV };
const w = (uid, v) => E.write(R, { admins: { boss: true } }, { ['balance/' + uid]: v }, { auth: { uid }, now: T0 }).ok;

test('the balance record takes the PvP and crafting tallies, within their bounds', () => {
  assert.equal(w('bob', base), true, 'as before');
  assert.equal(w('bob', { ...base, dw: 1, dl: 1, pn: 1, pk: 3.2, pd: 1, ps: 4.2, gb: 2, rt: 300, c0: 1, c2: 1, c4: 1, h: 'Bassem' }), true, 'everything');
  assert.equal(w('bob', { ...base, dw: 3 }), false, 'more duels won than wins');
  assert.equal(w('bob', { ...base, pn: 3 }), false, 'more PvP kills than wins');
  assert.equal(w('bob', { ...base, pd: 2 }), false, 'more PvP deaths than losses');
  assert.equal(w('bob', { ...base, gb: 5 }), false, 'a gear band past legendary');
  assert.equal(w('bob', { ...base, rt: 60001 }), false, 'a round trip past a minute');
  assert.equal(w('bob', { ...base, c3: -1 }), false, 'a negative count');
  assert.equal(w('bob', { ...base, c1: 1.5 }), false, 'not a whole count');
  assert.equal(w('bob', { ...base, h: 'no spaces allowed' }), false, 'not an account id');
  assert.equal(w('bob', { ...base, x: 1 }), false, 'a field it does not have');
  assert.equal(E.write(R, {}, { 'balance/ann': base }, { auth: { uid: 'bob' }, now: T0 }).ok, false, 'someone else\'s');
  assert.equal(E.read(R, { admins: { boss: true } }, 'balance', { auth: { uid: 'bob' }, now: T0 }), false, 'players don\'t read it');
  assert.equal(E.read(R, { admins: { boss: true } }, 'balance', { auth: { uid: 'boss' }, now: T0 }), true, 'admins do');
});
