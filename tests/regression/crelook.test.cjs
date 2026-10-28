'use strict';
// The Legendary Smith's creations against the drops (owner 2026-10-24: "a weapon of all these endgame materials is weaker
// than one I found in the vampire city? and give every weapon its own picture and look on the character"): endgame
// materials out-make the drops of their level, older creations are made again on load, and every sword and every creation
// has its own held sprite and icon, also seen by the other players (a "cw:" presence tag).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('endgame creations beat the drops, keep their own look, older ones are remade', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const C = window.__GCR, st = (ty, mats) => C.stats({ ty, mats, L: 50, W: 50, C: 0, sl: 1 });
      return { bilial: st('gs', { blhorn: 1, bljewel: 1, dscale: 6, sess: 2 }).atk, breaths: st('gs', { brphx: 1, brdrg: 1, brtig: 1, brtor: 1 }).atk, ore: st('gs', { ore: 6 }).atk,
        arm: st('ar', { blhorn: 1, bljewel: 1, dscale: 6, sess: 2 }).def };
    });
    // Yetima's greatsword (a vampire earl's drop, Lv 370) is 600: the Bilial and dragon set makes more, the breaths far more
    assert.ok(r.bilial >= 700 && r.bilial <= 850, JSON.stringify(r));
    assert.ok(r.breaths >= 900, JSON.stringify(r));
    assert.equal(r.ore, 100);
    assert.ok(r.arm >= 95 && r.arm <= 130, 'endgame armour beside Totem\'s shell (112): ' + r.arm);

    // forged: the item keeps its look; an older creation in the bag is remade on load with its quality kept
    const it = await g.eval(() => {
      const G = window.__G, S = G.S, C = window.__GCR; S.cls = 'pagma'; S.lv = 300; S.smith = 10;
      const c = { id: 'c1', ty: 'gs', mats: { blhorn: 1, bljewel: 1, dscale: 6, sess: 2 }, L: 70, W: 60, C: 0, sl: 1, nm: 'Abyss', by: 'Grid' };
      S.cre = [c]; S.items.push({ uid: 9901, id: 'gsword', slot: 'w', r: 4, atk: 822, spd: .46, nm: 'Abyss', by: 'Grid', cr: 'c1' });
      C.fix(); const o = S.items.find((i) => i.uid === 9901); return { atk: o.atk, cw: o.cw, key: C.key(o), want: Math.round(C.stats(c).atk * 2.6) };
    });
    assert.equal(it.cw, 'gs.70.60.0.blhorn.bljewel');
    assert.equal(it.key, 'cw|gs.70.60.0.blhorn.bljewel');
    assert.equal(it.atk, it.want);
    assert.ok(it.atk > 1560, 'a legendary creation above legendary Yetima (1560): ' + it.atk);

    // every sword its own held sprite and icon, every creation its own from its blueprint and materials
    const look = await g.eval(() => {
      const W = window.SatArt.weapons, I = window.SatArt.icons, ids = ['rusty', 'isword', 'ssword', 'gsword', 'msword', 'failure', 'dains', 'iyarugt', 'wisdom', 'yetgs', 'dpgs', 'mgsword'];
      const cws = ['cw|gs.70.60.0.blhorn.bljewel', 'cw|gs.70.60.0.brphx.brdrg', 'cw|gs.20.60.0.blhorn.bljewel', 'cw|gs.70.60.80.blhorn.bljewel', 'cw|sp.50.50.0.brdrg', 'cw|bw.50.50.0.brphx', 'cw|st.50.50.0.kpearl', 'cw|hm.50.50.0.dscale'];
      const held = (k) => W.sprite(k, 0).canvas.toDataURL(), ic = (k) => I.iconCanvas(k).toDataURL();
      return { held: new Set(ids.map(held)).size, icons: new Set(ids.map(ic)).size, cheld: new Set(cws.map(held)).size, cicons: new Set(cws.map(ic)).size, n: ids.length, m: cws.length, bad: W.sprite('cw|zz', 0) };
    });
    assert.deepEqual([look.held, look.icons, look.cheld, look.cicons, look.bad], [look.n, look.n, look.m, look.m, null]);

    // the others see it: a cw: tag in the presence fx field when it is in hand
    const tag = await g.eval(() => { const G = window.__G, S = G.S, o = S.items.find((i) => i.uid === 9901); S.eqW = o.uid; S.eq = S.eq || {}; S.eq.w = o.uid; return window.__G.fxPub ? window.__G.fxPub() : null; });
    if (tag) assert.match(tag, /cw:gs\.70\.60\.0\.blhorn\.bljewel/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
