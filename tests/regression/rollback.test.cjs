'use strict';
// SAT-ONLINE-091 (plan U385): the rollback rehearsal. The site goes back to the previous release (the baseline build) and
// then forward again, and no save is corrupted on the way: a save this build wrote plays on the old build, the old build
// writes it back with everything this build added still in it, and this build loads that copy as it was. A save from a
// newer build than this one is kept as a backup before anything else touches it. docs/online/ROLLBACK.md has the steps.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const baseline = H.baselineHtml();
const skip = baseline ? false : `baseline ${H.BASELINE_SHA.slice(0, 7)} not available in this clone`;

test('rollback and forward again: the save survives the old build and comes back whole', { skip }, async () => {
  // this build: a character with progress, quit (saved)
  const g = await H.openGame();
  let raw1, snap1;
  try {
    await H.newGame(g);
    await g.eval(() => { const G = window.__G; G.gainXP(1800); G.S.gold = 4321; G.S.rollbackMark = { by: 'this build', n: 3 }; });
    snap1 = await H.snapshot(g);
    await g.eval(() => window.__G.act('quit'));
    await g.waitMode('title');
    raw1 = (await g.storage())[H.LEGACY_KEY];
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
  assert.ok(raw1 && /rollbackMark/.test(raw1));

  // the site rolled back: the old build loads it and saves it again
  const old = await H.openGame({ html: baseline, storage: { [H.LEGACY_KEY]: raw1 } });
  let raw2;
  try {
    await H.continueGame(old);
    const there = await H.snapshot(old);
    assert.equal(there.S.gold, 4321);
    assert.equal(there.S.lv, snap1.S.lv);
    await old.step(2);
    await old.eval(() => window.__G.act('quit'));
    await old.waitMode('title');
    raw2 = (await old.storage())[H.LEGACY_KEY];
    assert.deepEqual(old.errors, []);
  } finally { await old.close(); }
  // nothing this build keeps was dropped by the old one
  const S2 = JSON.parse(raw2).S;
  const lost = Object.keys(JSON.parse(raw1).S).filter((k) => !(k in S2));
  assert.deepEqual(lost, [], 'keys the old build dropped');
  assert.deepEqual(S2.rollbackMark, { by: 'this build', n: 3 }, 'a key the old build does not know is kept');

  // forward again: this build loads the old build's copy as it was
  const back = await H.openGame({ storage: { [H.LEGACY_KEY]: raw2 } });
  try {
    await H.continueGame(back);
    const snap3 = await H.snapshot(back);
    // everything it had is as it was (an older build may add its own empty defaults, which this build keeps too)
    const changed = Object.keys(snap1.S).filter((k) => JSON.stringify(snap3.S[k]) !== JSON.stringify(snap1.S[k]));
    assert.deepEqual(changed, [], 'changed on the way: ' + changed.map((k) => k + ' ' + JSON.stringify(snap1.S[k]) + ' -> ' + JSON.stringify(snap3.S[k])).join('; '));
    assert.equal(snap3.P.x, snap1.P.x); assert.equal(snap3.P.y, snap1.P.y);
    const st = await back.storage();
    assert.deepEqual(Object.keys(st).filter((k) => k.startsWith(H.LEGACY_KEY + '.backup.')), [], 'a same-version save needs no backup');
    assert.deepEqual(back.errors, []);
  } finally { await back.close(); }
});

test('a save from a newer build is kept as a backup before this build plays it', async () => {
  const g = await H.openGame();
  let raw;
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.S.gold = 999; });
    await g.eval(() => window.__G.act('quit'));
    await g.waitMode('title');
    const d = JSON.parse((await g.storage())[H.LEGACY_KEY]);
    d.S.v = 99; d.S.fromTheFuture = true;
    raw = JSON.stringify(d);
  } finally { await g.close(); }
  const n = await H.openGame({ storage: { [H.LEGACY_KEY]: raw } });
  try {
    await H.continueGame(n);
    assert.equal(await n.eval(() => window.__G.S.gold), 999);
    assert.equal(await n.eval(() => window.__G.S.fromTheFuture), true, 'what it does not know stays');
    const st = await n.storage();
    assert.equal(st[H.LEGACY_KEY + '.backup.newer-v99'], raw, 'the newer copy as it was');
    assert.deepEqual(n.errors, []);
  } finally { await n.close(); }
});
