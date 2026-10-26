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
    // (review) a real fire hit stops the regeneration; a ring hits inside its drawn ellipse; a rename follows the maker's mark
    const rv = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, L = window.__GLG3, tr = window.__tr; tr.rgOffU = 0; tr.stun = 0; window.__GU.hitMon(tr, 1, { el: 'fire' }); const burn = tr.rgOffU > L.now();
      const m = { x: P.x, y: P.y }; const x0 = P.x, y0 = P.y; P.y = y0 + 40; const below = L.ringIn(m, 48); P.y = y0; P.x = x0 + 40; const side = L.ringIn(m, 48); P.x = x0;
      const it = G.isk.mkItem('failure', 1, 1); it.by = 'Old'; it.byId = S.pid; S.items.push(it); const n0 = S.look.n; S.look.n = 'NewMaker'; window.__GCR.fix(); const by = it.by; S.look.n = n0; S.items.pop();
      return { burn, below, side, by }; });
    assert.deepEqual(rv, { burn: true, below: false, side: true, by: 'NewMaker' }, 'U122 fire, U123 the ellipse, U282 the rename');
    // U208: the journal tab
    const j = await g.eval(() => { const G = window.__G, S = G.S; const id = Object.keys(G.defs().QD || {})[0]; if (!id) return null; S.qs[id] = { st: 2, c: 1 };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN', bubbles: true }));
      const b = document.querySelector('#ixTabs [data-ixt="qst"]'); if (!b) return { tab: false }; b.click(); return { tab: true, has: document.getElementById('ixG').textContent.length > 0 }; });
    assert.ok(j && j.tab, 'U208: the Index has the journal tab'); assert.equal(j.has, true, 'and the finished quest is in it');
    // U094: pickaxes at Khan's: the next one for sale, and a strike that costs less stamina
    const px = await g.eval(() => { const G = window.__G, S = G.S, K = window.__GCK; S.pick = 0; S.gold = 1e6; const n0 = K.pick().length; K.buy('khan', 'pick', 1);
      return { n0, pick: S.pick, gold: S.gold < 1e6, n1: K.pick().length, c: K.PX[3].c }; });
    assert.deepEqual([px.n0, px.pick, px.gold, px.n1, px.c], [3, 1, true, 2, 0.7], 'U094: pickaxes');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
