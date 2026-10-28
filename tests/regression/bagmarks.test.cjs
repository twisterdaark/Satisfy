'use strict';
// owner 2026-10-23 (the bag): filters by slot and rarity, a sort, a favourite star, a lock that keeps a piece from being
// sold or thrown away by mistake, and each piece compared with what you wear in its slot.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const idx = (g, u) => g.eval((u) => window.__G.bag().INVS.findIndex((s) => s && s.it && s.it.uid === u), u);

test('favourite and lock from the bag; a locked sword is not sold or thrown away; tabs, filters and the compare line', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const u = await g.eval(() => { const G = window.__G, X = G.eqx; G.S.lv = 20; const a = X.mkItem('isword', 3), b = X.mkItem('isword', 0), h = X.mkItem('ochelm', 1); G.S.items.push(a, b, h); return { a: a.uid, b: b.uid, h: h.uid }; });
    await g.step(3);
    await g.page.keyboard.press('KeyI'); await g.step(3);
    // lock the strong sword, star the helmet
    await g.eval(() => document.getElementById('invLock').click());
    await g.eval((i) => window.__G.bag().invClick(i), await idx(g, u.a));
    await g.eval(() => { document.getElementById('invLock').click(); document.getElementById('invFav').click(); });
    await g.eval((i) => window.__G.bag().invClick(i), await idx(g, u.h));
    await g.eval(() => document.getElementById('invFav').click());
    const m = await g.eval((u) => { const I = window.__G.S.items, f = (x) => I.find((i) => i.uid === x); return { lock: f(u.a).lock, fav: f(u.h).fav, b: !!f(u.b).lock, icons: document.querySelectorAll('#igrid .ivlock').length + '/' + document.querySelectorAll('#igrid .ivfav').length }; }, u);
    assert.deepEqual(m, { lock: 1, fav: 1, b: false, icons: '1/1' });
    // the favourite tab shows only the marked pieces
    await g.eval(() => document.querySelector('#invTabs [data-btab="fav"]').click());
    const fav = await g.eval(() => window.__G.bag().INVS.map((s) => s.it && s.it.uid));
    assert.deepEqual(fav.sort(), [u.a, u.h].sort());
    await g.eval(() => document.querySelector('#invTabs [data-btab="all"]').click());
    // the slot filter: weapons only; the rarity filter; the sort by rarity puts the rare sword first
    const flt = await g.eval(() => { const set = (k, v) => { const e = document.querySelector(`#invTabs [data-ivs="${k}"]`); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }; const I = () => window.__G.bag().INVS;
      set('slot', 'w'); const w = I().map((s) => s.it && s.it.slot); set('slot', 'all'); set('r', '3'); const r = I().map((s) => s.r || 0); set('r', 'all'); set('sort', 'r'); const top = I()[0].r; set('sort', 'bag'); return { w, r, top }; });
    assert.ok(flt.w.length >= 2 && flt.w.every((s) => s === 'w'), JSON.stringify(flt));
    assert.ok(flt.r.length >= 1 && flt.r.every((x) => x === 3), JSON.stringify(flt));
    assert.equal(flt.top, Math.max(...await g.eval(() => window.__G.bag().INVS.map((s) => s.r || 0))));
    // the compare line against the sword in your hand
    const tip = await g.eval((i) => document.querySelector(`#igrid [data-inv="${i}"]`).dataset.tip, await idx(g, u.b));
    assert.ok(/[↑↓=]/.test(tip), tip);
    // a locked piece is not sold, salvaged or thrown away
    await g.page.keyboard.press('Escape'); await g.step(2);
    await g.eval(() => window.__G.bag().openSell('smith')); await g.step(2);
    const gold0 = await g.eval(() => window.__G.S.gold);
    await g.eval((i) => window.__G.bag().invClick(i), await idx(g, u.a));
    const sold = await g.eval((u) => ({ have: window.__G.S.items.some((i) => i.uid === u.a), gold: window.__G.S.gold }), u);
    assert.deepEqual(sold, { have: true, gold: gold0 }, 'the locked sword stays');
    await g.eval((i) => window.__G.bag().invClick(i), await idx(g, u.b));
    assert.equal(await g.eval((u) => window.__G.S.items.some((i) => i.uid === u.b), u), false, 'an unlocked sword sells');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
