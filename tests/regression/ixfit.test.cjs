'use strict';
// v3.78 (owner 2026-10-28 21:22, a screenshot of Index → Monsters → Bosses: "fix this screen, I can't see and can't
// scroll"). The monster's card grew to its full height and squeezed the list under it into a strip. Now the card stops at
// part of the window and scrolls on its own, as on the Index's other pages, and on every page both the card and the list
// stay inside the window with the list tall enough for a row of cards, on a desktop screen and on a phone held sideways.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

for (const [w, h] of [[1300, 886], [844, 390]]) {
  test(`${w}x${h}: every Index page keeps its card and its list inside the window, both scrolling`, async () => {
    const ctx = await H.newContext({ device: { viewport: { width: w, height: h } } });
    try {
      const g = await H.openGame({ ctx });
      await H.newGame(g, { n: 'Twister', hair: 1, hc: 2, skin: 1, top: 3 });
      await g.eval(() => { window.__GIX.open(); window.__GIX.tab('mon'); });
      await g.step(3);
      // every monster met (long cards, as in the screenshot)
      await g.eval(() => { const S = window.__G.S; S.kills = S.kills || {}; for (const c of document.querySelectorAll('#mbG [data-mb]')) S.kills[c.dataset.mb] = 500; });
      const n = await g.eval(() => document.querySelectorAll('#ixTabs button').length);
      assert.ok(n >= 8, 'the Index tabs: ' + n);
      for (let i = 0; i < n; i++) {
        await g.eval((i) => document.querySelectorAll('#ixTabs button')[i].click(), i);
        await g.step(3);
        if (await g.eval(() => !document.getElementById('mbW').hidden)) {
          await g.eval(() => { const b = [...document.querySelectorAll('#mbF button')].find((x) => /boss/i.test(x.textContent)); if (b) b.click(); });
          await g.step(3);
        }
        await g.eval(() => { const c = [...document.querySelectorAll('#ixG [data-ix], #mbG [data-mb]')].find((e) => e.offsetParent); if (c) c.click(); });
        await g.step(3);
        const r = await g.eval(() => {
          const vis = (id) => { const e = document.getElementById(id); return e && e.offsetParent ? e : null; };
          const D = vis('mbD') || vis('ixD'), G = vis('mbG') || vis('ixG'), W = document.getElementById('ixW').getBoundingClientRect();
          const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(), s = getComputedStyle(e); return { top: b.top, bottom: b.bottom, h: b.height, sh: e.scrollHeight, ch: e.clientHeight, scroll: /auto|scroll/.test(s.overflowY) }; };
          const cell = G && [...G.children].find((e) => e.offsetParent);
          return { tab: (document.querySelector('#ixTabs button.on') || {}).textContent, win: { top: W.top, bottom: W.bottom }, card: box(D), grid: box(G), cell: cell ? cell.getBoundingClientRect().height : 0 };
        });
        const L = r.tab + ' ' + JSON.stringify(r);
        assert.ok(r.grid, 'a list: ' + L);
        assert.ok(r.grid.bottom <= r.win.bottom + 1, 'the list is inside the window: ' + L);
        assert.ok(r.grid.h >= Math.min(r.cell, 80) * 0.85, 'the list shows a row of cards: ' + L);
        if (r.grid.sh > r.grid.ch + 1) assert.ok(r.grid.scroll, 'a longer list scrolls: ' + L);
        if (r.card) {
          assert.ok(r.card.bottom <= r.grid.top + 1, 'the card sits above the list: ' + L);
          assert.ok(r.card.h <= (r.win.bottom - r.win.top) * 0.5, 'the card leaves room for the list: ' + L);
          if (r.card.sh > r.card.ch + 1) assert.ok(r.card.scroll, 'a longer card scrolls on its own: ' + L);
        }
      }
      assert.deepEqual(g.errors, []);
    } finally { await ctx.close(); }
  });
}
