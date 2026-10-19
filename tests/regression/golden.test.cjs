'use strict';
// Golden comparison: the same scripted session on the R0 baseline (main @ BASELINE_SHA)
// and on the build under test must end in the same durable state. Any refactor of
// state/save code that changes gameplay shows up here.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');
const F = require('../harness/fixtures.cjs');

test.after(() => H.closeBrowser());

const baseline = H.baselineHtml();
const r0 = H.baselineHtml(H.R0_SHA); // the characterization tests' baseline (R0)
const skip = baseline ? false : `baseline ${H.BASELINE_SHA.slice(0, 7)} not available in this clone`;

async function scriptedSession(html) {
  const g = await H.openGame({ html });
  try {
    const out = {};
    await H.newGame(g);
    out.fresh = await H.snapshot(g);
    await g.eval(() => {
      const G = window.__G;
      G.gainXP(2500);
      G.S.mats.ore += 7; G.S.mats.wood += 6; G.S.gold += 150;
      G.acceptQ('kh1');
    });
    out.played = await H.snapshot(g);
    await g.eval(() => window.__G.act('quit'));
    await g.waitMode('title');
    await g.reload();
    await H.continueGame(g);
    out.reloaded = await H.snapshot(g);
    out.errors = g.errors;
    return out;
  } finally { await g.close(); }
}

async function migratedSession(html) {
  const g = await H.openGame({ html, storage: { [H.LEGACY_KEY]: JSON.stringify(F.LEGACY_V4) } });
  try {
    await H.continueGame(g);
    return { snap: await H.snapshot(g), errors: g.errors };
  } finally { await g.close(); }
}

test('golden: new game → play → quit → reload → continue matches baseline', { skip }, async () => {
  const want = await scriptedSession(baseline);
  const got = await scriptedSession(H.CURRENT_HTML);
  assert.deepEqual(want.errors, []);
  assert.deepEqual(got.errors, []);
  assert.deepEqual(got.fresh, want.fresh, 'fresh state');
  assert.deepEqual(got.played, want.played, 'state after scripted play');
  assert.deepEqual(got.reloaded, want.reloaded, 'state after reload');
});

test('golden: legacy v4 migration result matches baseline', { skip }, async () => {
  const want = await migratedSession(baseline);
  const got = await migratedSession(H.CURRENT_HTML);
  assert.deepEqual(got.errors, []);
  assert.deepEqual(got.snap, want.snap);
});

// Rollback path: a save written by this build must still load in the baseline build.
test('rollback: a save written by this build loads unchanged in the baseline', { skip }, async () => {
  const g = await H.openGame();
  let written, snap;
  try {
    await H.newGame(g);
    await g.eval(() => { const G = window.__G; G.gainXP(1800); G.S.gold = 4321; });
    snap = await H.snapshot(g);
    await g.eval(() => window.__G.act('quit'));
    await g.waitMode('title');
    written = (await g.storage())[H.LEGACY_KEY];
  } finally { await g.close(); }
  const old = await H.openGame({ html: baseline, storage: { [H.LEGACY_KEY]: written } });
  try {
    await H.continueGame(old);
    const back = await H.snapshot(old);
    assert.deepEqual(back.S, snap.S);
    assert.equal(back.P.x, snap.P.x);
    assert.equal(back.P.y, snap.P.y);
    assert.deepEqual(old.errors, []);
  } finally { await old.close(); }
});

// Documents the R0 bug this work fixes: on the baseline, a save that fails to load
// is silently replaced by a fresh game at the next autosave.
test('characterization: baseline overwrites a corrupt save at autosave', { skip: r0 ? false : 'R0 baseline not available in this clone' }, async () => {
  const g = await H.openGame({ html: r0, storage: { [H.LEGACY_KEY]: F.CORRUPT_RAW } });
  try {
    await H.continueGame(g);
    await g.step(21 * 20, 50);
    const st = await g.storage();
    assert.notEqual(st[H.LEGACY_KEY], F.CORRUPT_RAW);
    assert.equal(Object.values(st).includes(F.CORRUPT_RAW), false);
  } finally { await g.close(); }
});
