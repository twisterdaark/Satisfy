'use strict';
// The Legendary Blacksmith's Patience and Eyes (v1.12). Patience can't be cast: it wakes when a blacksmith holds on in a
// fight below 30% health or keeps at the anvil, and triples Stamina, Dexterity and defense for an hour, once a day.
// The Eyes see a monster's named item, more lines the closer you stand; at skill Lv 5 they are the Legendary Eyes.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('Patience wakes when a blacksmith perseveres, triples the stats for an hour, once a day', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(3);
    // a warrior has no Patience; a level 15 blacksmith does
    const w = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'warrior'; S.lv = 20; return window.__GBS.patTry(); });
    assert.equal(w, false);
    const a = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBS; S.cls = 'smith'; S.lv = 20; G.P.x = 90 * 16; G.P.y = 60 * 16;
      const sta0 = window.__GSET.stat('sta'), dex0 = window.__GSET.stat('dex'), def0 = G.eqx.defV();
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } const m = G.spawnMon('wolf', G.P.x + 30, G.P.y); m.eng = 4; m.max = m.hp = 1e9;
      G.P.hp = Math.floor(window.__GSET.maxHP() * .2); B.reset(); for (let i = 0; i < 30; i++) { m.eng = 4; B.tick(.1); } const half = B.patOn(); for (let i = 0; i < 40; i++) { m.eng = 4; B.tick(.1); }
      return { half, on: B.patOn(), sta: window.__GSET.stat('sta') / sta0, dex: window.__GSET.stat('dex') / dex0, def: G.eqx.defV() / Math.max(1, def0), left: (S.pat1 - Date.now()) / 60000, again: B.patTry() }; });
    assert.equal(a.half, false);
    assert.equal(a.on, true);
    assert.ok(Math.abs(a.sta - 3) < .05 && Math.abs(a.dex - 3) < .05, JSON.stringify(a));
    assert.ok(a.def > 2.5, JSON.stringify(a));
    assert.ok(a.left > 59 && a.left <= 60, JSON.stringify(a));
    assert.equal(a.again, false, 'once a day');
    assert.match(await g.eval(() => document.getElementById('anntext').textContent), /Legendary Blacksmith's Patience skill has been activated/);
    // it wears off after the hour
    await g.eval(() => { window.__G.S.pat1 = Date.now() - 1; window.__GBS.tick(.1); });
    assert.equal(await g.eval(() => window.__GBS.patOn()), false);
    assert.match(await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | ')), /Patience has worn off/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Eyes see a named item a line at a time by distance; the Legendary Eyes see it all and help understanding', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBS; S.cls = 'smith'; S.lv = 20; S.skx = {}; G.P.x = 90 * 16; G.P.y = 60 * 16;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } const m = G.spawnMon('bknight', G.P.x + 140, G.P.y); m.max = m.hp = 1e9; m.eng = 0; m.agg = 0; m.tmp = 0;
      B.reset(); for (let i = 0; i < 52; i++) B.eyTick(.1); const far = { shown: !document.getElementById('eyesW').hidden, txt: document.getElementById('eyesW').textContent, eyes: { ...(S.eyes || {}) } };
      return { far, lines: B.lines('dains').length }; });
    assert.equal(r.far.shown, true);
    assert.match(r.far.txt, /Blacksmith's Eyes \(Lv\. 1\) has seen through the target's item/);
    assert.match(r.far.txt, /explored the function of the .+ that Braham's Death Knight is wearing/);
    assert.match(r.far.txt, /\?\?\?/);
    assert.deepEqual(r.far.eyes, { dains: 1 });
    assert.ok(r.lines >= 2);
    // closer, more lines and understanding; a step away stops the look
    const c = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBS, m = G.mons().find((m) => m.type === 'bknight' && !m.dead); m.x = G.P.x + 40; m.y = G.P.y;
      for (let i = 0; i < 60; i++) B.eyTick(.1); return { eyes: S.eyes.dains, und: window.__GSV.undOf('dains') }; });
    assert.ok(c.eyes >= 2, JSON.stringify(c));
    assert.equal(c.und, Math.min(50, c.eyes * 10));
    // the Legendary Eyes (skill Lv 5): every line in three seconds
    const l = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBS; S.skx.beyes = 1e4; S.eyes = {}; const m = G.spawnMon('fochief', G.P.x + 180, G.P.y); m.max = m.hp = 1e9; m.tmp = 0;
      for (const o of G.mons()) if (o !== m) { o.dead = true; o.rt = 1e9; } B.reset(); for (let i = 0; i < 31; i++) B.eyTick(.1);
      return { leg: B.leg(), txt: document.getElementById('eyesW').textContent, eyes: S.eyes, n: B.lines('ochelm').length }; });
    assert.equal(l.leg, true);
    assert.match(l.txt, /\[Legendary Blacksmith's Eyes\]/);
    assert.doesNotMatch(l.txt, /\?\?\?/);
    assert.equal(l.eyes.ochelm, l.n);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
