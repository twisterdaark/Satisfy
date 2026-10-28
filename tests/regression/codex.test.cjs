'use strict';
// U298 Library codex (SAT-ONLINE-188; plan: "lore pages unlocked by region/quests", check: "spoiler flags obey unlock"):
//   - the Monster Book's Lore tab lists every landmark and shelf book; what you haven't read is "???" with no words;
//   - a page you have read shows its words and where it stands; the search looks only through what you have found;
//   - everything read: the title Keeper of Lore.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the codex: unread pages stay ???, read ones show their words, all of them is Keeper of Lore', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const info = await g.eval(() => { const L = window.__GCDX.list(); return { n: L.length, lm: L.filter((e) => e.k === 'cdxLm').length, ids: L.map((e) => e.id), first: L[0], book: L.find((e) => e.k === 'cdxBk') }; });
    assert.ok(info.lm >= 10 && info.n === info.lm + 6, JSON.stringify([info.n, info.lm]));
    // open the Monster Book, the Lore tab
    await g.eval(() => { window.__G.S.books = {}; });
    await g.eval(() => window.__GMB.open()); await g.step(2);
    assert.ok(await g.eval(() => !document.getElementById('mbW').hidden), 'the Monster Book is open');
    await g.page.click('#mbF [data-mbf="lore"]'); await g.step(2);
    let w = await g.eval(() => ({ sum: document.getElementById('mbSum').textContent, grid: document.getElementById('mbG').innerText, html: document.getElementById('mbW').innerHTML, cells: document.querySelectorAll('#mbG .mbc').length }));
    assert.match(w.sum, new RegExp('Lore found: 0 of ' + info.n));
    assert.equal(w.cells, info.n);
    assert.ok(!w.html.includes(info.first.n) && !w.html.includes(info.first.tx[0].slice(1, 30)), 'no spoiler: an unread page shows nothing of itself');
    assert.equal((w.grid.match(/\?\?\?/g) || []).length, info.n);
    // a landmark read
    await g.eval((id) => { window.__G.S.books[id] = 1; window.__GCDX.draw(); }, info.first.id);
    await g.page.click(`#mbG [data-cdx="${info.first.id}"]`); await g.step(2);
    w = await g.eval(() => ({ sum: document.getElementById('mbSum').textContent, det: document.getElementById('mbD').innerText }));
    assert.match(w.sum, new RegExp('Lore found: 1 of ' + info.n));
    assert.ok(w.det.includes(info.first.n) && w.det.includes(info.first.tx[0].slice(1, 30)), 'its words: ' + w.det.slice(0, 120));
    // the search: only what you have found
    const sq = async (q) => { await g.page.fill('#mbQ', q); await g.page.dispatchEvent('#mbQ', 'input'); await g.step(1); return g.eval(() => document.querySelectorAll('#mbG .mbc').length); };
    assert.equal(await sq(info.first.n.slice(0, 6)), 1);
    assert.equal(await sq(info.book.tx[0].slice(1, 12)), 0, 'an unread book is not found by its words');
    await sq('');
    // everything read: Keeper of Lore
    assert.equal(await g.eval(() => !!window.__G.S.tl.lorek), false);
    await g.eval((ids) => { for (const id of ids) window.__G.S.books[id] = 1; window.__GCDX.check(); }, info.ids);
    assert.equal(await g.eval(() => !!window.__G.S.tl.lorek), true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
