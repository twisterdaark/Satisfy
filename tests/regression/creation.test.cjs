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
    // a level 5 smith cannot yet; at level 10 the skill is there, three creations at smithing level 1
    const lo = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'smith'; S.lv = 5; window.__GCR.open(); return !document.getElementById('creW').hidden; });
    assert.equal(lo, false);
    await g.eval(() => { const G = window.__G, S = G.S; S.lv = 12; S.smith = 1; S.mats.blue = 5; S.mats.ore = 20; S.mats.wood = 5; G.eqx.openForge(); });
    await g.step(1);
    assert.match(await g.eval(() => document.getElementById('rlist').textContent), /Creation \(0\/3\)/);
    await g.page.click('[data-act="fCre"]');
    assert.match(await g.eval(() => document.getElementById('creW').textContent), /\[What item do you want to create\?\]/);
    await g.page.click('#creW [data-cty="gs"]');
    assert.match(await g.eval(() => document.getElementById('creW').textContent), /\[What materials would you like to use\?\]/);
    await g.page.click('#creW [data-cmat="blue"]');
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
    assert.deepEqual([L[0].ty, L[0].mat, L[0].nm, L[0].by], ['gs', 'blue', 'Shark Fin', 'Grid']);
    assert.match(await g.eval(() => document.getElementById('rlist').textContent), /Shark Fin.*Your creation/);
    // forge it: the item has the creation's name, stats by rating and its maker; the materials are spent
    const it = await g.eval(() => { const G = window.__G, S = G.S, b0 = S.mats.blue; window.__GCR.forge(0); G.finishMG()(); const it = S.items[S.items.length - 1]; return { it, spent: b0 - S.mats.blue, mult: [1, 1.25, 1.55, 1.9, 2.6][it.r], tip: window.__G.bag ? null : null }; });
    assert.equal(it.it.id, 'gsword');
    assert.equal(it.it.nm, 'Shark Fin');
    assert.equal(it.it.by, 'Grid');
    assert.equal(it.it.atk, Math.round(s1.atk * it.mult));
    assert.equal(it.spent, 2);
    await g.page.waitForTimeout(1500);
    // the slots: three at smithing level 1
    const full = await g.eval(() => { const S = window.__G.S; S.cre.push({ id: 'x1', ty: 'sw', mat: 'ore', L: 50, W: 50, C: 0, sl: 1, nm: 'A', by: 'Grid' }, { id: 'x2', ty: 'sw', mat: 'ore', L: 50, W: 50, C: 0, sl: 1, nm: 'B', by: 'Grid' }); window.__GCR.open(); return window.__GCR.max(); });
    assert.equal(full, 3);
    assert.match(await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | ')), /You can create 3 items at this smithing level/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
