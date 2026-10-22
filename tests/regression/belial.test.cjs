'use strict';
// The 32nd Great Demon Belial (second ten, major 7): a world boss at the gate of hell on the Fourth Ridge. Her hell field
// (no regeneration, no potions, attack speed -20%, a burn up close), the Mirror Shield (30% lands, 70% comes back), the
// succubi she calls, the fake health gauge and her final form, meteors, and pay by the damage each player dealt.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

// stand beside her, engaged, and keep the player alive through the test's own checks
const near = (g, dx = 120) => g.eval((dx) => { const G = window.__G, m = window.__GBL.of(); G.P.x = m.x - dx; G.P.y = m.y; m.eng = 5; return m.lv; }, dx);

test('the gate of hell: her field, the fake gauge, the Mirror Shield, succubi and her final form', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const at = await g.eval(() => { const m = window.__GBL.of(); return { lv: m.lv, z: window.__G.zoneAt(m.x, m.y), boss: window.__G.mons().filter((x) => x.type === 'belial').length }; });
    assert.deepEqual(at, { lv: 480, z: 'zChaos4', boss: 1 });
    assert.deepEqual(await g.eval(() => window.__G.monNames().filter(([k]) => k === 'belial' || k === 'succ').map(([, n]) => n)), ['32nd Great Demon Belial', 'Succubus']);
    await g.eval(() => { const G = window.__G; G.S.lv = 450; G.S.hpot = 3; });
    await near(g);
    await g.step(2);
    // level 450 makes this character the first at 400: the Pioneer title's dialog opens, and keys wait for it to close
    for (let i = 0; i < 6 && await g.eval(() => window.__G.mode === 'dialog'); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
    assert.equal(await g.eval(() => window.__G.mode), 'play');
    // the hell field: potions do nothing, attacks are slower
    const cd0 = await g.eval(() => { const m = window.__GBL.of(); m.eng = 0; return window.__G.eqx.atkCD(); });
    const f = await g.eval(() => { const G = window.__G, m = window.__GBL.of(); m.eng = 5; G.P.hp = 10; const r = { near: window.__GBL.near(), cd: G.eqx.atkCD() }; return r; });
    assert.equal(f.near, true);
    assert.ok(Math.abs(f.cd / cd0 - 1.25) < 1e-6, 'attack speed -20%');
    await g.page.keyboard.press('KeyQ');
    await g.step(1);
    assert.equal(await g.eval(() => window.__G.S.hpot), 3, 'no potion used');
    assert.match(await g.eval(() => window.__GDB.log()), /Potions do not work in the hell field\./);
    const log = await g.eval(() => window.__GDB.log());
    assert.match(log, /The 32nd Great Demon Belial waits at the gate of hell/);
    assert.match(log, /You have entered the hell field: no health or mana regeneration, no potions/);
    // the fake gauge: empty just above a quarter of her health, then the true quarter shows
    const gz = await g.eval(() => { const B = window.__GBL, m = B.of(), M = m.max, r = []; for (const f of [1, 0.625, 0.2501, 0.1]) { m.hp = M * f; r.push(+B.gauge(m).toFixed(3)); } m.hp = M; return r; });
    assert.deepEqual(gz, [1, 0.5, 0, 0.1]);
    // the Mirror Shield at 85%: 30% of a hit lands, the rest comes back; what lands counts for the raid
    await g.eval(() => { const G = window.__G, m = window.__GBL.of(); m.hp = m.max * 0.84; G.P.hp = 1e9; G.P.inv = 0; });
    await g.step(1);
    const mr = await g.eval(() => { const G = window.__G, B = window.__GBL, m = B.of(), h = G.P.hp; const d = B.refl(m, 1000); return { on: B.mir(m), d, hurt: G.P.hp < h, my: m.blMy }; });
    assert.deepEqual(mr, { on: true, d: 300, hurt: true, my: 300 });
    assert.match(await g.eval(() => window.__GDB.log()), /\[Mirror Shield\] Only 30% of your hits will land/);
    // 75%: two succubi (Lv 320) come to this screen
    const s0 = await g.eval(() => window.__G.mons().filter((x) => x.type === 'succ' && !x.dead).length);
    await g.eval(() => { const m = window.__GBL.of(); m.hp = m.max * 0.7; });
    await g.step(1);
    const s1 = await g.eval(() => window.__G.mons().filter((x) => x.type === 'succ' && !x.dead).map((x) => x.lv));
    assert.deepEqual([s0, s1], [0, [320, 320]]);
    // a quarter: the gauge was fake, and her final form
    await g.eval(() => { const m = window.__GBL.of(); m.hp = m.max * 0.2; });
    await g.step(1);
    assert.equal(await g.eval(() => window.__GBL.form(window.__GBL.of())), true);
    await g.page.waitForTimeout(900);
    assert.match(await g.eval(() => window.__GDB.log()), /Belial's health gauge was fake![\s\S]*final form/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('her meteor falls where you stand; the raid pays by your part, and her succubi go with her', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { window.__G.S.lv = 450; });
    await near(g, 100);
    await g.eval(() => { const G = window.__G, m = window.__GBL.of(); m.blc = 0; G.P.hp = 1e9; G.P.inv = 0; });
    await g.step(2);
    const met = await g.eval(() => { const G = window.__G, m = window.__GBL.of(); return { br: +m.br.toFixed(1), k: m.blK, at: Math.hypot(m.blMx - G.P.x, m.blMy2 - G.P.y) < 8 }; });
    assert.equal(met.k, 1); assert.ok(met.br > 1.2, 'meteor winding up'); assert.equal(met.at, true);
    const h0 = await g.eval(() => window.__G.P.hp);
    await g.eval(() => { window.__GBL.of().br = 0.01; window.__G.P.inv = 0; });
    await g.step(2);
    assert.ok(await g.eval((h) => window.__G.P.hp < h, h0), 'the meteor hits');
    // the raid: 10% of her health is yours (the player sits it out untouchable from here)
    await g.eval(() => { const G = window.__G, m = window.__GBL.of(); G.P.inv = 1e9; m.hp = m.max * 0.7; });
    await g.step(1);
    await g.eval(() => { const G = window.__G, m = window.__GBL.of(); m.blMy = m.max * 0.1; G.P.x = m.x - 300; m.hp = 0; window.__GB2.kill(m); });
    await g.page.waitForTimeout(2600);
    await g.step(2);
    const r = await g.eval(() => { const G = window.__G, S = G.S, W = window.__GU.WS; return { dead: window.__GBL.of().dead, wb: Math.round((W.wb.belial - Date.now()) / 60000), tl: !!S.tl.blslay, jewel: S.mats.bljewel || 0, horn: S.mats.blhorn || 0, succ: G.mons().filter((x) => x.type === 'succ' && !x.dead).length }; });
    assert.deepEqual(r, { dead: true, wb: 120, tl: true, jewel: 1, horn: 0, succ: 0 });
    const log = await g.eval(() => window.__GDB.log());
    assert.match(log, /\[The soul of the 32nd Great Demon Belial has been destroyed\.\.\.\]/);
    assert.match(log, /Your part in the raid: 10% of her health\./);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('she is drawn on her chariot, and small and winged in her final form', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { window.__G.S.lv = 450; });
    for (const [f, k] of [[0.5, 'a'], [0.2, 'b']]) {
      await g.eval((f) => { const G = window.__G, m = window.__GBL.of(); m.hp = m.max * f; m.eng = 5; m.blc = 99; G.P.x = m.x - 110; G.P.y = m.y + 10; G.P.inv = 1e9; }, f);
      for (let i = 0; i < 4; i++) await g.step(15);
      await g.eval(() => { const G = window.__G; while (G.mode === 'dialog') G.advance(); document.querySelectorAll('#toasts > *, #announce').forEach((e) => { e.hidden = true; }); });
      await g.step(2);
      assert.equal(await g.eval(() => window.__G.mode), 'play');
      if (process.env.SHOT) await g.page.screenshot({ path: process.env.SHOT + '-belial-' + k + '.png' });
    }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
