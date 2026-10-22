'use strict';
// SAT-ONLINE-123 (plan U245, "faction standings"): the standing between two guilds from the diplomacy log both keep and
// what is in force, by the formula G -> Diplomacy -> Standings shows.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const { diplo: D } = loadModules('src/net/diplo.js');
const DAY = 86400000, NOW = 1790000000000;
const e = (k, daysAgo, o = 'g_W', n = 'Wolves') => ({ k, o, n, by: 'u1', t: NOW - daysAgo * DAY });

test('each kind of event counts as the formula says; ask and warask count nothing', () => {
  const pts = (log, live) => D.standing(log, NOW, live).pts;
  assert.equal(pts([e('ally', 1)]), 20);
  assert.equal(pts([e('end', 1)]), 10);
  assert.equal(pts([e('break', 1)]), -50);
  assert.equal(pts([e('decline', 1)]), -5);
  assert.equal(pts([e('war', 1)]), -30);
  assert.equal(pts([e('warno', 1)]), -10);
  assert.equal(pts([e('ask', 1), e('warask', 1), { k: 'zzz', t: NOW }]), 0);
  assert.equal(pts([], { ally: true }), 50, 'an alliance in force');
  assert.equal(pts([], { gone: true }), 10, 'one that ran out counts as ended in order');
  assert.deepEqual(D.standing([e('ally', 2), e('break', 1), e('ally', 3)], NOW).why, { ally: 2, break: 1 });
});

test('the labels: allied and at war whatever the points; 25 and up friendly, -25 and down hostile', () => {
  const k = (log, live) => D.standing(log, NOW, live).k;
  assert.equal(k([e('ally', 1)], { ally: true }), 'ally');
  assert.equal(k([e('ally', 1), e('end', 0)]), 'friendly', '+30 after an alliance ended in order');
  assert.equal(k([e('ally', 1)], { gone: true }), 'friendly', 'or ran out');
  assert.equal(k([e('ally', 1)]), 'neutral', '+20');
  assert.equal(k([e('ally', 2), e('break', 1)]), 'hostile', 'a broken alliance: -30');
  assert.equal(k([e('war', 1)]), 'hostile', 'a war fought');
  assert.equal(k([e('decline', 1), e('warno', 1)]), 'neutral', '-15');
  assert.equal(k([e('ally', 1), e('end', 1), e('ally', 1)], { war: true }), 'war');
  assert.equal(D.standing([], NOW).k, 'neutral');
});

test('only the last 30 days count, the sum is held to -100..100, a time far ahead is ignored', () => {
  assert.equal(D.standing([e('war', 29.9)], NOW).pts, -30);
  assert.equal(D.standing([e('war', 30.1)], NOW).pts, 0, 'over 30 days ago');
  assert.equal(D.standing([e('war', -1)], NOW).pts, 0, 'a day ahead of the clock');
  assert.equal(D.standing([{ k: 'war', t: 'x' }, { k: 'war' }, null], NOW).pts, 0);
  assert.equal(D.standing(Array.from({ length: 5 }, () => e('break', 1)), NOW).pts, -100);
  assert.equal(D.standing(Array.from({ length: 9 }, () => e('ally', 1)), NOW, { ally: true }).pts, 100);
});

test('standings: one per guild in the log, in force or at war, named by the latest entry; both sides agree', () => {
  const log = { d_a1: e('ask', 5, 'g_W', 'Wolfs'), d_a2a: e('ally', 4), d_a3a: e('break', 1), d_b1: e('decline', 2, 'g_R', 'Ravens'), d_c1: e('war', 40, 'g_O', 'Old'), d_x: { k: 'war', o: 'bad/key', t: NOW } };
  const v = D.standings(log, NOW, { g_A: { n: 'Allies', until: NOW + DAY } }, { g_X: { n: 'Enemies', end: NOW + 3600000 }, g_P: { n: 'Past', end: NOW - 1 } });
  assert.deepEqual(Object.keys(v).sort(), ['g_A', 'g_R', 'g_W', 'g_X'], 'a guild only in old entries, or a war over and nothing else, is not listed');
  assert.deepEqual(v.g_W, { k: 'hostile', pts: -30, why: { ally: 1, break: 1 }, n: 'Wolves' });
  assert.deepEqual(v.g_R, { k: 'neutral', pts: -5, why: { decline: 1 }, n: 'Ravens' });
  assert.deepEqual(v.g_A, { k: 'ally', pts: 50, why: { live: 1 }, n: 'Allies' });
  assert.equal(v.g_X.k, 'war');
  // the other guild's log has the same events (its own 'b' copies) without the ask: the same standing
  const theirs = { d_a2b: e('ally', 4, 'g_H', 'Hunters'), d_a3b: e('break', 1, 'g_H', 'Hunters') };
  assert.deepEqual(D.standings(theirs, NOW).g_H, { k: 'hostile', pts: -30, why: { ally: 1, break: 1 }, n: 'Hunters' });
  assert.deepEqual(D.standings(null, NOW, null, null), {});
});
