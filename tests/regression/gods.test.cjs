'use strict';
// Gods and churches (major 11): a statue of each god stands by its people (Rebecca by Cassus, Hexetia by Khan, Garion by
// the Patrian farmer, Debirion by the hunter, Venice by the auction house, Dominion by the knights, Judar by the Tower of
// Wisdom). Praying gives that god's blessing for 20 minutes, one at a time, each god once a day; a Paladin of the god's
// church (or a Priest for Rebecca) gets it at half again the strength.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('seven statues by their people; E at one and Pray gives the blessing; once a day; a new god replaces the old', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const L = await g.eval(() => { const D = window.__GDV, G = window.__G; return D.list().filter((o) => !o.vat).map((o) => { const id = D.GODS.find((x) => x[0] === o.g)[1], n = G.npcs.find((n) => n.id === id); return { g: o.g, d: Math.hypot(n.tx * 16 + 8 - o.x, n.ty * 16 + 12 - o.y) }; }); });
    assert.deepEqual(L.map((o) => o.g).sort(), ['debirion', 'dominion', 'garion', 'hexetia', 'judar', 'rebecca', 'venice']);
    assert.ok(L.every((o) => o.d < 16 * 7), JSON.stringify(L));
    // v3.11: and two more of Rebecca on the Vatican's square, by her cathedral
    assert.deepEqual(await g.eval(() => window.__GDV.list().filter((o) => o.vat).map((o) => o.g)), ['rebecca', 'rebecca']);
    // walk up to Judar's statue and press E
    await g.eval(() => { const G = window.__G, o = window.__GDV.list().find((o) => o.g === 'judar'); for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } G.P.x = o.x; G.P.y = o.y + 10; G.P.dir = 1; });
    await g.step(2);
    for (let n = 0; n < 6 && !(await g.eval(() => !!(window.__G.DL && window.__G.DL.optOn))); n++) { await g.page.keyboard.press('KeyE'); await g.step(2); }
    await g.eval(() => window.__G.pickOpt(0));
    await g.step(2);
    const a = await g.eval(() => { const D = window.__GDV; return { g: D.s().g, left: Math.round((D.s().until - Date.now()) / 60000), xp: D.b('xp'), gold: D.b('gold') }; });
    assert.deepEqual(a, { g: 'judar', left: 20, xp: 0.1, gold: 0 });
    // experience from a monster is 10% higher
    const xp = await g.eval(() => { const G = window.__G, D = window.__GDV; const kill = () => { const m = G.spawnMon('wolf', G.P.x + 400, G.P.y); const x0 = G.S.xp, l0 = G.S.lv; m.hp = 1; D.hit(m, 1); return [G.S.xp - x0, G.S.lv - l0]; };
      const on = kill(); const s = D.s(), u = s.until; s.until = 0; const off = kill(); s.until = u; return { on, off }; });
    if (!xp.on[1] && !xp.off[1] && xp.off[0] > 0) assert.ok(xp.on[0] > xp.off[0], JSON.stringify(xp));
    // the same god again today: no prayer offered
    const again = await g.eval(() => { const D = window.__GDV, G = window.__G; D.s().until = 0; D.tick(0.1); const o = D.list().find((o) => o.g === 'judar'); D.act(o); return !!(G.DL && G.DL.optOn); });
    assert.equal(again, false);
    // another god: Dominion's blessing replaces any other
    const d = await g.eval(() => { const D = window.__GDV, G = window.__G; D.pray('garion'); D.pray('dominion'); const m = G.spawnMon('wolf', G.P.x + 400, G.P.y); return { g: D.s().g, atk: D.atk(m), hurt: D.hurt(100, m) }; });
    assert.deepEqual(d, { g: 'dominion', atk: 1.08, hurt: 100 });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('each blessing in its own domain; a church Paladin gets half again; Rebecca heals; it fades after 20 minutes', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const D = window.__GDV, G = window.__G, S = G.S, wolf = G.spawnMon('wolf', G.P.x + 400, G.P.y), gob = G.spawnMon(D.other(), G.P.x + 420, G.P.y);
      const o = {};
      D.pray('garion'); o.garion = [D.hurt(100, wolf), D.hurt(100, null)];
      D.pray('debirion'); o.debirion = [D.atk(wolf), D.atk(gob)];
      D.pray('hexetia'); o.hexetia = D.b('smith');
      D.pray('venice'); o.venice = D.b('gold');
      S.cls = 'paladin'; S.church = 'dominion'; D.pray('dominion'); o.dominion = Math.round(D.atk(wolf) * 1000) / 1000;
      S.church = 'judar'; D.pray('judar'); o.judar = Math.round(D.b('xp') * 1000) / 1000;
      S.church = 'rebecca'; D.pray('rebecca'); const mh = D.maxHP(); G.P.hp = 10; for (let i = 0; i < 10; i++) D.tick(0.25); o.heal = G.P.hp - 10; o.healK = Math.round(mh * 0.015);
      D.s().until = Date.now() - 1; D.tick(0.1); o.after = [D.s().g, D.atk(wolf), D.b('xp')];
      return o;
    });
    assert.deepEqual(r.garion, [92, 100]);
    assert.deepEqual(r.debirion, [1.15, 1]);
    assert.equal(r.hexetia, 0.15); assert.equal(r.venice, 0.1);
    assert.equal(r.dominion, 1.12); assert.equal(r.judar, 0.15);
    assert.equal(r.heal, r.healK, 'one tick of 1.5% after two seconds');
    assert.deepEqual(r.after, [null, 1, 0]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
