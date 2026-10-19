'use strict';
// Save/load behaviour of the build under test (index.html in the working tree, or $SATISFY_HTML).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');
const F = require('../harness/fixtures.cjs');

test.after(() => H.closeBrowser());

const PTS_LV = 10;
// Where a fresh character starts (Winston); the map layout can move it, so ask the game.
async function spawnPoint() {
  const g = await H.openGame();
  try { await H.newGame(g); return await g.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y })); } finally { await g.close(); }
}
const AUTOSAVE_STEPS = 21 * 20; // 21 s of 50 ms frames, past the 20 s autosave

// Every value stored under the save key or any key derived from it (backups),
// so a test can ask "is this data still recoverable?".
async function savedBlobs(g) {
  const st = await g.storage();
  return Object.entries(st).filter(([k]) => k.startsWith(H.LEGACY_KEY)).map(([, v]) => v);
}

test('new game writes a save and enables Continue after reload', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    assert.ok((await savedBlobs(g)).length > 0, 'a save exists');
    await g.reload();
    assert.equal(await g.eval(() => document.getElementById('contBtn').disabled), false);
  } finally { await g.close(); }
});

test('round trip: progress survives quit + reload + continue', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.eval(() => { const G = window.__G; G.gainXP(800); G.S.gold = 777; G.S.mats.ore = 9; });
    const before = await H.snapshot(g);
    await g.eval(() => window.__G.act('quit'));
    await g.waitMode('title');
    await g.reload();
    await H.continueGame(g);
    const after = await H.snapshot(g);
    assert.deepEqual(after.S, before.S);
    assert.equal(after.P.x, before.P.x);
    assert.equal(after.P.y, before.P.y);
    assert.equal(after.P.hp, before.P.hp);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('legacy v4 save migrates to v5 and keeps progress', async () => {
  const g = await H.openGame({ storage: { [H.LEGACY_KEY]: JSON.stringify(F.LEGACY_V4) } });
  try {
    await H.continueGame(g);
    const { S, P } = await H.snapshot(g);
    const spawn = await spawnPoint();
    assert.equal(S.v, 5);
    assert.deepEqual(S.st, { str: 10, sta: 10, agi: 10, int: 10, dex: 10 });
    assert.equal(S.pts, (F.LEGACY_V4.S.lv - 1) * PTS_LV);
    assert.equal(S.lv, 6);
    assert.equal(S.gold, 345);
    assert.deepEqual(S.qs, { kh1: { st: 2, c: 0 } });
    assert.deepEqual(S.kills, { rabbit: 12, boar: 3 });
    assert.equal(P.x, spawn.x);
    assert.equal(P.y, spawn.y);
    assert.equal(S.wv, 3, 'spawned on the current map (wv 3 since the south expansion), not shifted again');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('legacy v4 save is kept recoverable after the migrated game autosaves', async () => {
  const raw = JSON.stringify(F.LEGACY_V4);
  const g = await H.openGame({ storage: { [H.LEGACY_KEY]: raw } });
  try {
    await H.continueGame(g);
    await g.step(AUTOSAVE_STEPS, 50);
    assert.ok((await savedBlobs(g)).includes(raw), 'original v4 save still stored somewhere');
  } finally { await g.close(); }
});

test('corrupt save is not overwritten by the fresh game that replaces it', async () => {
  const g = await H.openGame({ storage: { [H.LEGACY_KEY]: F.CORRUPT_RAW } });
  try {
    await H.continueGame(g);
    await g.step(AUTOSAVE_STEPS, 50);
    assert.ok((await savedBlobs(g)).includes(F.CORRUPT_RAW), 'corrupt save still stored for recovery');
  } finally { await g.close(); }
});

test('save from a newer build is backed up before this build writes over it', async () => {
  const raw = JSON.stringify(F.NEWER_V6);
  const g = await H.openGame({ storage: { [H.LEGACY_KEY]: raw } });
  try {
    await H.continueGame(g);
    await g.step(AUTOSAVE_STEPS, 50);
    assert.ok((await savedBlobs(g)).includes(raw), 'newer save still stored');
  } finally { await g.close(); }
});
