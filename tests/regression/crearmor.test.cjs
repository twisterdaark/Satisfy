'use strict';
// Pagma's Successor's created armour (owner 2026-10-26: "the armour and the rest draw like the weapons; fix it and make sure it
// looks right on the character, and take the set effect off, they are made as a piece, not a set"):
//   - a created armour, helmet, gloves or boots has its own icon in its materials' colours (they drew as a spear);
//   - worn, it dresses the character in those colours, and the others see the same (a dotless token in the gear string);
//   - a creation counts toward no set and its tooltip names none.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('created armour has its own icon and look, and no set', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, I = window.SatArt.icons, L = window.__GLK, SE = window.__GSET;
      const ic = (k) => I.iconCanvas(k).toDataURL();
      const sheet = () => { const c = L.sheet(), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
      const out = {};
      const spear = ic('cw|sp.50.50.0.ore');
      out.icons = ['ar', 'hl', 'gl', 'bt'].map((t) => ic('cw|' + t + '.50.50.0.dscale'));
      out.notSpear = out.icons.every((x) => x !== spear);
      out.colours = ic('cw|ar.50.50.0.dscale') !== ic('cw|ar.50.50.0.mith');
      // worn: iron plate against a dragon-scale creation of the same base
      S.eq = {}; S.eqA = null;
      const mk = (id, cw) => { const it = G.eqx.mkItem(id, 1); if (cw) { it.cw = cw; it.cr = 'c' + id; } S.items.push(it); if (it.slot === 'a') S.eqA = it.uid; else S.eq[it.slot] = it.uid; return it; };
      mk('parmor'); mk('ihelm'); mk('igloves'); mk('iboots');
      const iron = sheet(); out.ironSet = SE.tier('iron');
      S.eq = {}; S.eqA = null;
      const a = mk('parmor', 'ar.80.80.0.dscale.mith'); mk('ihelm', 'hl.80.50.0.dscale.mith'); mk('igloves', 'gl.50.50.0.dscale'); mk('iboots', 'bt.80.50.0.dscale');
      out.creLook = sheet() !== iron;
      out.gr = L.gr(); out.grOk = !!L.grOf(out.gr);
      out.creSet = SE.tier('iron'); out.tip = SE.tip(a);
      S.eq = {}; S.eqA = null;
      return out;
    });
    assert.ok(r.notSpear, 'created armour drawn as a spear');
    assert.equal(new Set(r.icons).size, 4, 'armour, helmet, gloves and boots each their own');
    assert.ok(r.colours, 'the materials colour it');
    assert.equal(r.ironSet, 4, 'the iron set still works for the shop pieces');
    assert.ok(r.creLook, 'worn creations look like their materials, not iron');
    assert.ok(r.grOk, 'the others can read the gear string: ' + r.gr);
    assert.equal(r.creSet, 0, 'creations count toward no set');
    assert.equal(r.tip, '');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
