'use strict';
// Underwear from the novel (owner 2026-10-23): a hidden gear slot. Tailors and Pagma's Successor sew Clean Underwear
// (+agility) and Northern Underwear (warm against the cold, but agility and lower body skills drop); the first high-grade
// pair of each kind is the "first item" bonus; Beriache's Underclothing drops from Marie Rose. Underwear is never drawn.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('underwear: slot, stats, first-pair bonus, cold, dodge, drop and who can sew', async () => {
  const ctx = await H.newContext();
  try {
    const g = await H.openGame({ ctx });
    await H.newGame(g, { n: 'Grid', hair: 3, hc: 0, skin: 1, top: 1 });
    const r = await g.eval(() => {
      const G = window.__G, X = G.eqx, S = G.S, U = window.__GUND, o = {};
      o.agi0 = U.stat('agi'); o.def0 = X.defV(); o.look0 = JSON.stringify(window.__GLK.mine());
      const c = X.mkItem('cunder', 3); S.items.push(c); X.equip(c); U.first(c);
      o.slot = X.eqIt('u') && X.eqIt('u').id; o.agi1 = U.stat('agi'); o.def1 = X.defV(); o.str1 = U.stat('str');
      o.look1 = JSON.stringify(window.__GLK.mine());
      U.first(c); o.str2 = U.stat('str');                     // only once per kind
      const n = X.mkItem('nunder', 0); S.items.push(n); X.equip(n);
      o.slot2 = X.eqIt('u').id; o.agi2 = U.stat('agi');
      U.P.dash = 0; U.P.dcd = 0; U.P.st = 999; U.dodge(); o.dash = U.P.dash;
      o.vm = U.NDROP.vmrose.map((x) => x[0]);
      o.sew0 = U.sewOk(); S.cls = 'pagma'; o.sew1 = U.sewOk();
      return o;
    });
    assert.equal(r.slot, 'cunder');
    assert.ok(r.agi1 > r.agi0, 'Clean Underwear raises agility ' + JSON.stringify(r));
    assert.ok(r.def1 > r.def0, 'and defense');
    assert.equal(r.str2, r.str1, 'the first-pair bonus is given once');
    assert.equal(r.look1, r.look0, 'underwear is never drawn');
    assert.equal(r.slot2, 'nunder');
    assert.ok(r.agi2 < r.agi1, 'Northern Underwear lowers agility');
    assert.ok(Math.abs(r.dash - 0.18 * 0.9) < 1e-6, 'and shortens the dodge: ' + r.dash);
    assert.equal(r.vm[0], 'bunder', 'Beriache\'s Underclothing drops from Marie Rose');
    assert.equal(r.sew0, false); assert.equal(r.sew1, true, 'Pagma\'s Successor can sew');
    // the cold north (y<0) hurts less in Northern Underwear
    const d = await g.eval(() => {
      const G = window.__G, U = window.__GUND, P = U.P, S = G.S;
      const hit = () => { P.inv = 0; P.dash = 0; P.hp = 1e6; const h = P.hp; U.hurt(500, S.lv); return h - P.hp; };
      const y0 = P.y; P.y = -200; const cold = hit();
      const n = G.S.items.find((i) => i.id === 'cunder'); G.eqx.equip(n); const plain = hit(); P.y = y0;
      return { cold, plain };
    });
    assert.ok(d.cold < d.plain, 'warm in the north: ' + JSON.stringify(d));
  } finally { await ctx.close(); }
});
