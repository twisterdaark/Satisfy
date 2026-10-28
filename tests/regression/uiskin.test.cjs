'use strict';
// Manhwa system windows (v3.66, owner 2026-10-27: "closer to the manhwa"; designed in Figma from the Yen Press preview pages):
// the big windows are deep indigo lit from the centre, framed by the double-rod bar and the winged crest, and the status
// window's sections are split by glowing rules instead of a flat border.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the status window and the bag wear the manhwa indigo, rod bars and crest', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    for (const [key, id] of [['KeyC', 'statusW'], ['KeyI', 'inv']]) {
      await g.page.keyboard.press(key); await g.step(3);
      const st = await g.eval((id) => {
        const e = document.getElementById(id), c = getComputedStyle(e), b = getComputedStyle(e, '::before');
        const sec = e.querySelector('.ssec'), sc = sec && getComputedStyle(sec);
        return { open: !e.hidden, bg: c.backgroundImage, before: b.backgroundImage, rim: c.boxShadow, sec: sc && [sc.borderTopStyle, sc.backgroundImage] };
      }, id);
      assert.ok(st.open, id + ' opens');
      assert.match(st.bg, /^radial-gradient\(.*rgba\(62, 64, 102/, id + ': indigo body lit from the centre');
      assert.match(st.rim, /inset/, id + ': a dark rim inside');
      assert.match(st.before, /data:image\/svg\+xml.*M117 66/, id + ': the redrawn crest');
      assert.match(st.before, /linear-gradient\(rgb\(201, 207, 238\)/, id + ': the double-rod bar');
      if (st.sec) { assert.equal(st.sec[0], 'none'); assert.match(st.sec[1], /linear-gradient\(90deg/, 'glowing section rule'); }
      await g.page.keyboard.press('Escape'); await g.step(3);
    }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("an item's tooltip is the manhwa item card, and notices and titles lose the whole-line brackets", async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const X = window.__G.eqx, it = X.mkItem('isword', 2), d = document.createElement('div');
      d.innerHTML = window.__G.isk.itemTip(it);
      return { head: d.querySelector('.ichd') && d.querySelector('.ichd').textContent, img: !!d.querySelector('.icard .icimg.rb2 img'), name: d.querySelector('.icard b.rt') && d.querySelector('.icard b.rt').textContent, cls: /Class: /.test(d.textContent), title: window.__G.lines().en.statusT };
    });
    assert.equal(r.head, 'Item');
    assert.ok(r.img, 'a framed picture in the rarity colour');
    assert.match(r.name, /^\[.+\]$/, 'the name in brackets');
    assert.ok(r.cls, 'the class (rarity) line');
    assert.equal(r.title, 'Status Window');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
