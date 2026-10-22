'use strict';
// SAT-ONLINE-125 (plan U343, "community feedback triage: bug reports tagged actionable and status; duplicates merged with
// provenance"): crash reports with the same message are one group, players' bug reports one each; tags set the status;
// a report tagged as the same as another is merged there and keeps who, build, zone and when; a fixed one that gets a
// new report is open again.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const { triage: T } = loadModules('src/net/triage.js');

const crashes = {
  c1: { m: 'TypeError: x is undefined at line 4021', s: 'TypeError\n at draw (index.html:4021)', v: '1.40', z: 'zWin', by: 'uA', t: 100 },
  c2: { m: 'TypeError: x is undefined at line 4377', s: 'TypeError\n at draw (index.html:4377)', v: '1.41', z: 'zBai', by: 'uB', t: 300 },
  c3: { m: "Cannot read properties of null (reading 'hp')", s: '', v: '1.41', by: 'uC', t: 200 },
  bad: { s: 'no message' },
};
const bugs = {
  b_uA_1: { s: 'The shop window stays open after I die', v: '1.41', z: 'zWin', n: 'Ahmed', by: 'uA', t: 150 },
  b_uB_2: { s: 'shop stays open when dead', v: '1.41', z: 'zPat', n: 'Bassem', by: 'uB', t: 250 },
  b_uC_3: { s: 'my horse is gone', v: '1.40', n: 'Carim', by: 'uC', t: 50 },
  'not a key': { s: 'skipped', by: 'uX', t: 1 },
};

test('crash reports with the same message, numbers aside, are one group; each bug report is its own', () => {
  assert.equal(T.norm('x at line 4021, col 7.5'), 'x at line #, col #');
  assert.equal(T.norm("reading 'hp' of \"a\""), 'reading "…" of "…"');
  assert.equal(T.crashKey('a 1'), T.crashKey('a 22'));
  assert.notEqual(T.crashKey('a 1'), T.crashKey('b 1'));
  assert.match(T.crashKey('anything'), T.KEY_RE);
  const G = T.groups(crashes, bugs, {});
  assert.equal(G.length, 5, 'two crash groups, three bug reports');
  const td = G.find((g) => g.kind === 'crash' && g.n === 2);
  assert.equal(td.key, T.crashKey(crashes.c1.m));
  assert.deepEqual([td.text, td.by, td.v, td.z, td.first, td.last, td.s, td.open], ['TypeError: x is undefined at line #', ['uA', 'uB'], ['1.40', '1.41'], ['zWin', 'zBai'], 100, 300, 'new', true]);
  assert.deepEqual(td.items.map((i) => i.id), ['c1', 'c2'], 'oldest first');
  assert.equal(G[0], td, 'the most reported open group first');
});

test('tags: actionable, fixed, not a bug; a fixed one with a newer report is back', () => {
  const k = T.crashKey(crashes.c1.m);
  const G = T.groups(crashes, bugs, { [k]: { s: 'fixed', by: 'own', t: 200 }, b_uC_3: { s: 'no', by: 'own', t: 60 }, b_uA_1: { s: 'act', by: 'own', t: 160 } });
  const g = (key) => G.find((x) => x.key === key);
  assert.deepEqual([g(k).s, g(k).back, g(k).open], ['fixed', true, true], 'c2 came at 300, after the fix at 200');
  assert.deepEqual([g('b_uC_3').s, g('b_uC_3').open], ['no', false]);
  assert.deepEqual([g('b_uA_1').s, g('b_uA_1').open], ['act', true]);
  assert.equal(G[G.length - 1].key, 'b_uC_3', 'closed ones last');
  const G2 = T.groups(crashes, bugs, { [k]: { s: 'fixed', by: 'own', t: 400 } });
  assert.deepEqual([G2.find((x) => x.key === k).back, G2.find((x) => x.key === k).open], [false, false], 'nothing after the fix');
  assert.equal(T.groups(crashes, bugs, { b_uA_1: { s: 'weird', t: 1 } }).find((x) => x.key === 'b_uA_1').s, 'new');
});

test('the same as another: merged there with every report, who, build, zone and when; chains follow, loops stay apart', () => {
  const G = T.groups(crashes, bugs, { b_uB_2: { s: 'dup', dup: 'b_uA_1', by: 'own', t: 260 } });
  assert.equal(G.length, 4);
  const m = G.find((x) => x.key === 'b_uA_1');
  assert.equal(m.n, 2);
  assert.deepEqual(m.merged, ['b_uB_2']);
  assert.deepEqual(m.items.map((i) => [i.id, i.n, i.v, i.z, i.t]), [['b_uA_1', 'Ahmed', '1.41', 'zWin', 150], ['b_uB_2', 'Bassem', '1.41', 'zPat', 250]]);
  assert.deepEqual([m.by, m.z, m.first, m.last], [['uA', 'uB'], ['zWin', 'zPat'], 150, 250]);
  // a bug report merged into a crash group; then that crash group into the other one: all in the last
  const kA = T.crashKey(crashes.c1.m), kB = T.crashKey(crashes.c3.m);
  const G3 = T.groups(crashes, bugs, { b_uC_3: { s: 'dup', dup: kB, by: 'own', t: 1 }, [kB]: { s: 'dup', dup: kA, by: 'own', t: 1 } });
  const top = G3.find((x) => x.key === kA);
  assert.deepEqual(top.items.map((i) => i.id).sort(), ['b_uC_3', 'c1', 'c2', 'c3']);
  assert.ok(!G3.some((x) => x.key === kB || x.key === 'b_uC_3'));
  // a loop, or a dup of something that isn't there: nothing moves
  const G4 = T.groups(crashes, bugs, { b_uA_1: { s: 'dup', dup: 'b_uB_2' }, b_uB_2: { s: 'dup', dup: 'b_uA_1' }, b_uC_3: { s: 'dup', dup: 'b_gone' } });
  assert.equal(G4.length, 5);
  assert.deepEqual(T.groups(null, null, null), []);
});
