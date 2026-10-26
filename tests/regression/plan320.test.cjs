'use strict';
// v3.20 The plan's updates, batch 1: U122 a troll's regeneration stops while it burns or is stunned, U165 Pedro Harbor
// safe, U200 a heal is a part in the fight, U208 the Index's journal of finished quests, U274 no insults in an item's
// name, U282 what you forge carries your mark (your character's id, kept through a rename).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the plan, batch 1', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, L = window.__GLG3, o = {};
      P.inv = 1e9;
      o.safe = window.Satisfy.net.SAFE_ZONES.includes('zHarbor');
      for (const q of G.mons()) { q.dead = true; q.rt = 1e9; }
      // U200: a heal on a mate in the last 30 s is a part in the fight
      const m = G.spawnMon('wolf', P.x + 20, P.y); m.myd = 0; m.myT = null; m.eng = 4; m.noLoot = 0;
      P.healT = null; window.__GPXP.earn(m); o.noPart = m.noLoot === 1;
      m.noLoot = 0; P.healT = L.now(); window.__GPXP.earn(m); o.healPart = m.noLoot !== 1;
      m.dead = true;
      // U122: the troll
      const tr = G.spawnMon('troll', P.x + 60, P.y); tr.max = 1e7; tr.hp = 5e6; tr.stun = 0; tr.rgOffU = 0; tr.lv = 1; window.__tr = tr;
      // U274
      o.badName = !!(window.Satisfy.chat && window.Satisfy.chat.badName && window.Satisfy.chat.badName('fuck'));
      return o;
    });
    assert.equal(r.safe, true, 'U165: Pedro Harbor is a safe zone');
    assert.equal(r.noPart, true, 'no part, no loot'); assert.equal(r.healPart, true, 'U200: a heal is a part in the fight');
    assert.equal(r.badName, true, 'the insult filter knows the word');
    // U122: it regenerates, but not while burning or stunned
    await g.step(30);
    const a = await g.eval(() => { const tr = window.__tr; const h = tr.hp; tr.rgOffU = 1e12; return h; });
    const b0 = await g.eval(() => window.__tr.hp); await g.step(30); const b1 = await g.eval(() => window.__tr.hp);
    await g.eval(() => { const tr = window.__tr; tr.rgOffU = 0; tr.stun = 99; }); const c0 = await g.eval(() => window.__tr.hp); await g.step(30); const c1 = await g.eval(() => window.__tr.hp);
    assert.ok(a > 5e6, 'a troll closes its wounds: ' + a); assert.equal(b1, b0, 'not while it burns'); assert.equal(c1, c0, 'nor while it is stunned');
    // U208: the journal tab
    const j = await g.eval(() => { const G = window.__G, S = G.S; const id = Object.keys(G.defs().QD || {})[0]; if (!id) return null; S.qs[id] = { st: 2, c: 1 };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN', bubbles: true }));
      const b = document.querySelector('#ixTabs [data-ixt="qst"]'); if (!b) return { tab: false }; b.click(); return { tab: true, has: document.getElementById('ixG').textContent.length > 0 }; });
    assert.ok(j && j.tab, 'U208: the Index has the journal tab'); assert.equal(j.has, true, 'and the finished quest is in it');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
