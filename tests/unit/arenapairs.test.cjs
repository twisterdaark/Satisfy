'use strict';
// SAT-ONLINE-153 (plan U040 "PvP rank season: Elo/MMR, duels apart from the open world, no farming the same opponent").
// The real rules (backend/database.rules.json, evaluated by tests/harness/rules-eval): every arena rating write names its
// duel's opponent (o) and counts one more rated duel against it this season (arenaPairs/{season}/{uid}/{o}), in the same
// update; at most 5 a season against the same opponent; the count goes up only with a rating against that opponent, one at
// a time, and only for yourself; a rating without its count, or a count without a rating, is refused.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(), SE = 's202610', A = 'gAhmed1', B = 'gBassem2', C = 'gCarim3', NOW = 1793000000000;
let tick = 0; const as = (uid) => ({ auth: { uid }, now: NOW + 1000 * ++tick }); // each write a second after the last
const rating = (r, w, l, o) => ({ r, w, l, n: 'Ahmed', t: E.SV, o });
const put = (state, uid, v, n, foe = v && v.o) => { const u = {}; if (v !== undefined) u['arena/' + SE + '/' + uid] = v; if (n !== undefined) u['arenaPairs/' + SE + '/' + uid + '/' + foe] = n; return E.write(R, state, u, as(uid)); };

test('a rating names its opponent and counts one more duel against it, in the same update', () => {
  let st = {};
  let w = put(st, A, rating(1016, 1, 0, B), 1);
  assert.equal(w.ok, true, w.why);
  st = w.after;
  for (let i = 2; i <= 5; i++) { w = put(st, A, rating(1016 + i, i, 0, B), i); assert.equal(w.ok, true, i + ': ' + w.why); st = w.after; }
  assert.equal(put(st, A, rating(1030, 6, 0, B), 6).ok, false, 'a sixth rated duel against the same opponent this season: refused');
  assert.equal(put(st, A, rating(1030, 6, 0, C), 1).ok, true, 'another opponent: counts');
  // next season: counts again
  const u = {}; u['arena/s202611/' + A] = rating(1016, 1, 0, B); u['arenaPairs/s202611/' + A + '/' + B] = 1;
  assert.equal(E.write(R, st, u, as(A)).ok, true);
});

test('no rating without its count, no count without its rating, no skipping, no one else, no yourself', () => {
  const st = put({}, A, rating(1016, 1, 0, B), 1).after;
  assert.equal(put(st, A, rating(1030, 2, 0, B), undefined).ok, false, 'a rating without the count');
  assert.equal(put(st, A, rating(1030, 2, 0, B), 3).ok, false, 'the count skipping one');
  assert.equal(put(st, A, rating(1030, 2, 0, B), 1).ok, false, 'the count not going up');
  assert.equal(put(st, A, undefined, 2, B).ok, false, 'a count without a rating against that opponent, now');
  assert.equal(put(st, A, { r: 1030, w: 2, l: 0, n: 'Ahmed', t: E.SV }, 2, B).ok, false, 'a rating without its opponent');
  assert.equal(put({}, A, rating(1016, 1, 0, A), 1, A).ok, false, 'yourself as the opponent');
  const u = {}; u['arena/' + SE + '/' + B] = rating(1016, 1, 0, A); u['arenaPairs/' + SE + '/' + B + '/' + A] = 1;
  assert.equal(E.write(R, {}, u, as(A)).ok, false, "someone else's rating and count");
  // the earlier rules still hold: one result a write, at most 64 points
  assert.equal(put(st, A, rating(1100, 2, 0, B), 2).ok, false, 'more than 64 points');
  assert.equal(put(st, A, rating(1030, 3, 0, B), 2).ok, false, 'two wins in one write');
});

test('your counts are yours to read, and deleting your online data takes them', () => {
  const st = put({}, A, rating(1016, 1, 0, B), 1).after;
  assert.equal(E.read(R, st, 'arenaPairs/' + SE + '/' + A, as(A)), true);
  assert.equal(E.read(R, st, 'arenaPairs/' + SE + '/' + A, as(B)), false, "not someone else's");
  const u = {}; u['arenaPairs/' + SE + '/' + A] = null; u['arena/' + SE + '/' + A] = null;
  assert.equal(E.write(R, st, u, as(A)).ok, true, 'removed by their owner');
});
