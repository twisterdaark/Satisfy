'use strict';
// The Legendary Blacksmith's Creation (v1.14): at the anvil a blacksmith picks a kind of item and a material, shapes it on
// the blueprint, names it, and the new production method forges like any recipe; the item carries its name, its own stats
// and "Made by" its creator, on a base recipe id so a trade still knows it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('create a greatsword of Blue Orichalcum on the blueprint, then forge it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    // an ordinary smith cannot; Pagma's Successor has it from the class change (novel ch2), three creations at smithing level 1
    const lo = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'smith'; S.lv = 12; window.__GCR.open(); return !document.getElementById('creW').hidden; });
    assert.equal(lo, false);
    await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'pagma'; S.lv = 1; S.smith = 1; S.mats.blue = 5; S.mats.ore = 20; S.mats.wood = 5; G.eqx.openForge(); });
    await g.step(1);
    assert.match(await g.eval(() => document.getElementById('rlist').textContent), /Creation \(0\/3\)/);
    await g.page.click('[data-act="fCre"]');
    assert.match(await g.eval(() => document.getElementById('creW').textContent), /\[What item do you want to create\?\]/);
    await g.page.click('#creW [data-cty="gs"]');
    assert.match(await g.eval(() => document.getElementById('creW').textContent), /\[What materials would you like to use\?\]/);
    await g.page.click('#creW [data-cmat="blue"]');
    // the material is picked with its full amount (2 Blue Orichalcum); the preview shows what it makes against your weapon
    assert.match(await g.eval(() => document.querySelector('#creW .cpick').textContent), /Blue Orichalcum−2＋/);
    assert.match(await g.eval(() => document.querySelector('#creW .cst').textContent), /wearing now/);
    await g.page.click('#creW [data-cnext]');
    assert.match(await g.eval(() => document.getElementById('creW').textContent), /\[Please design the item\.\]/);
    // a longer, curved blade: more attack, a little slower, quicker strikes from the curve
    const s0 = await g.eval(() => window.__GCR.stats(window.__GCR.cur));
    await g.eval(() => { const set = (k, v) => { const i = document.querySelector(`#creW [data-csl="${k}"]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }; set('L', 100); set('C', 60); document.getElementById('creNm').value = 'Shark Fin'; });
    const s1 = await g.eval(() => window.__GCR.stats(window.__GCR.cur));
    assert.ok(s1.atk > s0.atk && s1.as > 0, JSON.stringify([s0, s1]));
    assert.match(await g.eval(() => document.getElementById('creS').textContent), new RegExp('ATK ' + s1.atk));
    await g.page.click('#creW [data-cgo]');
    assert.match(await g.eval(() => document.getElementById('cfmT').textContent), /\[Have you decided\?\]/);
    await g.page.click('#cfmY');
    await g.step(1);
    const L = await g.eval(() => window.__GCR.list());
    assert.equal(L.length, 1);
    assert.deepEqual([L[0].ty, L[0].mats, L[0].nm, L[0].by], ['gs', { blue: 2 }, 'Shark Fin', 'Grid']);
    assert.match(await g.eval(() => document.getElementById('rlist').textContent), /Shark Fin.*Your creation/);
    // forge it: the item has the creation's name, stats by rating and its maker; the materials are spent
    const it = await g.eval(() => { const G = window.__G, S = G.S, b0 = S.mats.blue; window.__GCR.forge(0); G.finishMG()(); const it = S.items[S.items.length - 1]; return { it, spent: b0 - S.mats.blue, mult: [1, 1.25, 1.55, 1.9, 2.6][it.r], tip: window.__G.bag ? null : null }; });
    assert.equal(it.it.id, 'gsword');
    assert.equal(it.it.nm, 'Shark Fin');
    assert.equal(it.it.by, 'Grid');
    assert.equal(it.it.atk, Math.round(s1.atk * it.mult));
    assert.equal(it.spent, 2);
    // the level to wear it rises with the material, and the tip says so (owner 2026-10-24): Blue Orichalcum is level 120
    assert.equal(it.it.lvr, 120);
    assert.match(await g.eval(() => window.__G.isk.itemTip(window.__G.S.items[window.__G.S.items.length - 1])), /Level required: 120/);
    // a renamed character: "Made by" follows the new name on the recipe and on the forged piece (owner 2026-10-24)
    const rn = await g.eval(() => { const S = window.__G.S; window.__GNM.rename('Kraugel'); return [S.cre[0].by, S.items[S.items.length - 1].by]; });
    assert.deepEqual(rn, ['Kraugel', 'Kraugel']);
    // an older creation with one material still works the way it did
    // the materials' power to 1.34 (owner 2026-10-24): Blue Orichalcum (2) makes 2^1.34 x 100
    assert.equal(await g.eval(() => window.__GCR.stats({ ty: 'gs', mat: 'blue', L: 50, W: 50, C: 0, sl: 1 }).atk), 253);
    await g.page.waitForTimeout(1500);
    // the slots: three at smithing level 1
    const full = await g.eval(() => { const S = window.__G.S; S.cre.push({ id: 'x1', ty: 'sw', mat: 'ore', L: 50, W: 50, C: 0, sl: 1, nm: 'A', by: 'Grid' }, { id: 'x2', ty: 'sw', mat: 'ore', L: 50, W: 50, C: 0, sl: 1, nm: 'B', by: 'Grid' }); window.__GCR.open(); return window.__GCR.max(); });
    assert.equal(full, 3);
    assert.match(await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | ')), /You can create 3 items at this smithing level/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('mix bag materials: breaths and scales make an endgame weapon with their passives; the weak ones stay weak (owner 2026-10-23)', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S; S.cls = 'pagma'; S.lv = 300; S.smith = 10; Object.assign(S.mats, { ore: 30, brtig: 1, dscale: 3, mith: 6, ruby: 2, wood: 3 });
      const st = (m) => window.__GCR.stats({ ty: 'sw', mats: m, L: 50, W: 50, C: 0, sl: 10 });
      return { ore: st({ ore: 6 }), tig: st({ brtig: 1 }), mix: st({ brtig: 1, mith: 4, ruby: 1 }), half: st({ mith: 2 }), full: st({ mith: 4 }), more: st({ mith: 8 }) };
    });
    assert.ok(r.ore.atk < 100, JSON.stringify(r.ore));
    assert.ok(r.tig.atk >= 600, 'a divine breath sword out-makes the vampire earls drops (600): ' + r.tig.atk);
    assert.deepEqual(r.tig.ip, ['bleed']);
    assert.ok(r.mix.atk > r.tig.atk && r.mix.as > 0 && r.mix.dm > r.tig.dm, JSON.stringify(r.mix));
    assert.ok(r.half.atk < r.full.atk && r.full.atk < r.more.atk && r.more.atk < r.full.atk * 1.1, 'the amount counts, up to a point');
    // the picker: up to four kinds from the bag, materials you lack greyed out
    await g.eval(() => { window.__GCR.open(); });
    await g.page.click('#creW [data-cty="sw"]');
    assert.equal(await g.eval(() => document.querySelector('#creW [data-cmat="brphx"]').disabled), true, 'none in the bag');
    for (const k of ['brtig', 'dscale', 'mith', 'ruby']) await g.page.click(`#creW [data-cmat="${k}"]`);
    assert.equal(await g.eval(() => document.querySelector('#creW [data-cmat="ore"]').disabled), true, 'four kinds at most');
    await g.page.click('#creW [data-cq="mith"][data-d="1"]');
    assert.equal(await g.eval(() => window.__GCR.cur.mats.mith), 5);
    await g.page.click('#creW [data-cnext]');
    await g.page.click('#creW [data-cgo]'); await g.page.click('#cfmY'); await g.step(1);
    const it = await g.eval(() => { const G = window.__G, S = G.S; window.__GCR.forge(0); G.finishMG()(); return S.items[S.items.length - 1]; });
    assert.deepEqual(it.ip, ['bleed']);
    assert.ok(it.atk > 350, JSON.stringify(it));
    assert.equal(await g.eval(() => window.__G.S.mats.brtig), 0, 'the breath is spent');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
