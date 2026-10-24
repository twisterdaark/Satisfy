'use strict';
// U265 Arabic RTL audit (SAT-ONLINE-184): what read the wrong way in Arabic.
//   - the bag fills from the reading side: in Arabic its first slot is on the right, in English on the left;
//   - so does the equipment window's ring row;
//   - the log's time keeps its gap from an Arabic line (it sat glued to it).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

for (const lang of ['ar', 'en']) {
  test('the bag, the rings and the log in ' + lang, async () => {
    const g = await H.openGame({ storage: { satisfy_lang: lang } });
    try {
      await H.newGame(g);
      await g.page.keyboard.press('KeyI'); await g.step(3);
      const bag = await g.eval(() => { const c = [...document.querySelectorAll('#igrid > *')]; const a = c[0].getBoundingClientRect(), b = c[1].getBoundingClientRect(); return { a: a.left, b: b.left }; });
      if (lang === 'ar') assert.ok(bag.a > bag.b, 'the first slot on the right: ' + JSON.stringify(bag));
      else assert.ok(bag.a < bag.b, 'the first slot on the left: ' + JSON.stringify(bag));
      await g.page.keyboard.press('Escape'); await g.step(2);
      await g.page.keyboard.press('KeyU'); await g.step(3);
      const rings = await g.eval(() => { const c = [...document.querySelectorAll('.eqrings > *')]; if (c.length < 2) return null; return { a: c[0].getBoundingClientRect().left, b: c[1].getBoundingClientRect().left }; });
      if (rings) { if (lang === 'ar') assert.ok(rings.a > rings.b, 'rings from the right'); else assert.ok(rings.a < rings.b, 'rings from the left'); }
      await g.page.keyboard.press('Escape'); await g.step(2);
      await g.page.keyboard.press('KeyL'); await g.step(3);
      const gap = await g.eval(() => { const s = document.querySelector('#logL small'); if (!s) return null; const cs = getComputedStyle(s); return { l: parseFloat(cs.marginLeft), r: parseFloat(cs.marginRight) }; });
      assert.ok(gap, 'a log line with its time');
      if (lang === 'ar') assert.ok(gap.l > 0 && gap.r === 0, 'the gap on the line\'s side: ' + JSON.stringify(gap));
      else assert.ok(gap.r > 0, JSON.stringify(gap));
      assert.deepEqual(g.errors, []);
    } finally { await g.close(); }
  });
}
