'use strict';
// The Mage Tower in Reidan (the player Soki through the owner 2026-10-26): the Archmage teaches ten spells to any mage at their
// levels, never to another class, and sells tomes: held like a staff, every skill back a quarter sooner.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the Archmage: spells for mages by level, tomes cut cooldowns', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const S = window.__G.S, M = window.__GMGT;
      const n = M.npc();
      S.cls = 'knight'; S.lv = 400; S.gold = 1e7; M.learn('mtspark'); const knight = M.known('mtspark');
      S.cls = 'warlock'; S.lv = 100; M.learn('mtspark'); M.learn('mtward'); M.learn('mtrain'); M.learn('mtchain');
      const known = M.L.filter((k) => M.known(k)), shown = M.skills().filter((k) => M.L.includes(k));
      const gold = S.gold; S.cls = 'knight'; const asKnight = M.skills().filter((k) => M.L.includes(k)); S.cls = 'warlock';
      // Braham's Successor is a mage legend: its class change keeps no root, and it learns them all the same
      const keep = { cls: S.cls, cbase: S.cbase, croot: S.croot, mgt: S.mgt };
      S.cls = 'braham'; S.cbase = null; S.croot = null; S.mgt = {}; S.lv = 100; M.learn('mtspark'); const braham = M.known('mtspark') && M.skills().includes('mtspark');
      Object.assign(S, keep);
      return { n, knight, known, shown, spent: 1e7 - gold, asKnight, sk: !!S.sk.mtspark, braham }; });
    assert.deepEqual(a.n && [a.n.solid, a.n.reid], [false, true], JSON.stringify(a.n));
    assert.equal(a.knight, false, 'a knight cannot learn them');
    assert.equal(a.braham, true, "Braham's Successor learns them");
    assert.deepEqual(a.known, ['mtspark', 'mtward', 'mtrain'], 'Chain Spark waits for level 120');
    assert.deepEqual(a.shown, ['mtspark', 'mtward', 'mtrain']);
    assert.deepEqual(a.asKnight, [], 'they hide while the class is not a mage');
    assert.equal(a.spent, 2000 + 8000 + 18000); assert.equal(a.sk, true);
    // every spell casts, a tome cuts the cooldowns to three quarters
    const b = await g.eval(() => { const S = window.__G.S, M = window.__GMGT; S.lv = 400; S.gold = 1e7; for (const k of M.L) M.learn(k);
      const r = {}; for (const k of M.L) r[k] = M.cast(k); const before = M.cdM(); const w = M.tome('tome3');
      return { all: M.L.every((k) => M.known(k)), r, before, w, after: M.cdM() }; });
    assert.equal(b.all, true); assert.equal(b.before, 1); assert.equal(b.w, 'tome3'); assert.equal(b.after, 0.75);
    assert.ok(b.r.mtward.mtw > 0, 'Frost Ward wards'); assert.ok(b.r.mtstar.bls > 0, 'Starfall blesses');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
