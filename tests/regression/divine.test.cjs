'use strict';
// The Four Divine Beasts (second ten, major 5): a world boss at each end of the East Continent (SAT-ONLINE-159; they were in the West). Each shows where its breath
// will land and then breathes its element; killed, it stays dead for an hour (the shared world-boss timer) and drops its
// breath, which takes 30% off damage of that element while carried.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const beast = (g, k) => g.eval((k) => { const m = window.__G.mons().find((x) => x.type === k); return m && { lv: m.lv, dead: !!m.dead, rt: m.rt || 0, tx: Math.floor(m.x / 16), ty: Math.floor(m.y / 16), zone: window.__G.zoneAt(m.x, m.y) }; }, k);

test('four beasts at the four ends, each with its own breath and the breath that guards against it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const at = {};
    for (const k of ['sdrag', 'stiger', 'sbird', 'stort']) at[k] = await beast(g, k);
    assert.deepEqual(Object.fromEntries(Object.entries(at).map(([k, v]) => [k, [v.lv, v.dead, v.zone]])),
      { sdrag: [350, false, 'zEaDrag'], stiger: [330, false, 'zEaWTig'], sbird: [320, false, 'zEaPhx'], stort: [360, false, 'zEaTort'] });   // on the East Continent (SAT-ONLINE-159)
    assert.deepEqual(await g.eval(() => window.__G.monNames().filter(([k]) => /^s(drag|tiger|bird|tort)$/.test(k)).map(([, n]) => n)), ['Blue Dragon', 'White Tiger', 'Red Phoenix', 'Black Tortoise']);
    // a breath in the bag takes 30% off its element; the hunter's title 10% more; other damage is untouched
    const h = await g.eval(() => { const S = window.__G.S, f = window.__GDB.hurt, r = []; r.push(f(1000, { type: 'sbird' }), f(1000, { type: 'golem' }), f(1000, { type: 'wolf' }));
      S.mats.brphx = 1; r.push(f(1000, { type: 'sbird' }), f(1000, { type: 'salamander' }), f(1000, { type: 'stiger' })); S.tl.dbeast = 1; S.title = 'dbeast'; /* a title works while worn (SAT-ONLINE-161) */ r.push(f(1000, { type: 'trauka' }), f(1000, { type: 'stort' }), f(1000, { type: 'wolf' })); return r; });
    assert.deepEqual(h, [1000, 1000, 1000, 700, 700, 1000, 630, 900, 1000]);
    // the Red Phoenix shows its cone, then breathes fire into it
    const r = await g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'sbird'); G.P.x = m.x - 90; G.P.y = m.y; G.P.inv = 0; G.S.mats.brphx = 0; G.S.tl.dbeast = 0; m.eng = 5; m.brc = 0; return 1; });
    assert.equal(r, 1);
    await g.step(2);
    const tele = await g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'sbird'); return { br: m.br, inside: window.__GDB.inArea(m, G.P.x, G.P.y), away: window.__GDB.inArea(m, G.P.x - 400, G.P.y) }; });
    assert.ok(tele.br > 0, 'breath winding up');
    assert.deepEqual([tele.inside, tele.away], [true, false]);
    const hp0 = await g.eval(() => { const G = window.__G; G.P.hp = 1e9; return G.P.hp; });
    await g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'sbird'); m.br = 0.01; G.P.inv = 0; });
    await g.step(2);
    assert.ok(await g.eval((h0) => window.__G.P.hp < h0, hp0), 'the flame burns');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a beast down: an hour on the shared timer, its breath, the title and, for all four, the achievement', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'sdrag'); G.P.x = m.x - 300; G.P.y = m.y; m.hp = 0; window.__GB2.kill(m); });
    await g.page.waitForTimeout(1200);
    await g.step(2);
    const d = await beast(g, 'sdrag');
    assert.equal(d.dead, true);
    assert.ok(d.rt > 3590, 'an hour: ' + d.rt);
    const s = await g.eval(() => { const S = window.__G.S, W = window.__GU.WS; return { br: S.mats.brdrg, tl: !!S.tl.dbeast, wb: (W.wb.sdrag - Date.now()) / 1000 }; });
    assert.equal(s.br, 1); assert.equal(s.tl, true); assert.ok(s.wb > 3590 && s.wb <= 3600);
    const txt = await g.eval(() => window.__GDB.log());
    assert.match(txt, /\[You have acquired Blue Dragon's Breath\.\]/);
    assert.match(txt, /brought down the Blue Dragon of the east!/);
    // the breath in the bag, with what it does
    await g.page.keyboard.press('KeyI');
    await g.step(1);
    const tip = await g.eval(() => (window.__G.bag().INVS.find((x) => x.k === 'brdrg') || {}).tip || '');
    assert.match(tip, /Lightning resistance 30% while carried/);
    // the other three: the achievement and its title
    await g.eval(() => { const G = window.__G; for (const k of ['stiger', 'sbird', 'stort']) { const m = G.mons().find((x) => x.type === k); m.hp = 0; window.__GB2.kill(m); } });
    // (one achievement a tick: the level the kills gave comes with others ahead of it)
    for (let i = 0; i < 40 && !(await g.eval(() => window.__G.S.tl.four)); i++) await g.step(130);
    assert.match(await g.eval(() => window.__GDB.log()), /The Four Directions/);
    assert.equal(await g.eval(() => !!window.__G.S.tl.four), true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('each beast is drawn in its own colours', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    for (const k of ['sdrag', 'stiger', 'sbird', 'stort']) {
      await g.eval((k) => { const G = window.__G, m = G.mons().find((x) => x.type === k); G.P.x = m.x - 110; G.P.y = m.y + 20; m.eng = 0; }, k);
      for (let i = 0; i < 4; i++) { await g.eval(() => { window.__G.P.inv = 9; }); await g.step(20); }
      const px = await g.eval((k) => { const s = window.__GDB.sheet(k); return s && s.canvas.width > 0 && s.scale > 0; }, k);
      assert.equal(px, true, k);
      if (process.env.SHOT) await g.page.screenshot({ path: process.env.SHOT + '-' + k + '.png' });
    }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
