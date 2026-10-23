'use strict';
// owner 2026-10-22: a ring dragged from the bag onto the main bar goes on the bar with no "throw it away?" question; the
// picture under the pointer is the bag slot itself; letting go over the HUD cancels; only the open game drops it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const center = (g, sel) => g.eval((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);

test('drag a ring from the bag to the bar with the mouse; a window moves from its empty part', async () => {
  const g = await H.openGame({ device: { viewport: { width: 1600, height: 900 } } });
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.eval(() => { const G = window.__G, X = G.eqx, it = X.mkItem('cring', 2); G.S.items.push(it); window.__uid = it.uid; G.S.cls = 'warrior'; G.S.lv = 20; G.S.bar = null; });
    await g.step(3);
    await g.page.keyboard.press('KeyI'); await g.step(3); await g.page.waitForTimeout(300);
    const at = await g.eval(() => { const I = window.__G.bag().INVS; return I.findIndex((s) => s && s.it && s.it.uid === window.__uid); });
    assert.ok(at >= 0, 'the ring is in the bag');
    const a = await center(g, `#igrid [data-inv="${at}"]`), b = await center(g, '#skillbar [data-sk="5"]');
    await g.page.mouse.move(a.x, a.y); await g.page.mouse.down(); await g.page.mouse.move(a.x + 30, a.y + 10, { steps: 4 });
    const img = await g.eval(() => { const i = document.querySelector('.gdrag-img'); const r = i && i.getBoundingClientRect(); return i ? { w: r.width, h: r.height } : null; });
    const cell = await g.eval((at) => { const r = document.querySelector(`#igrid [data-inv="${at}"]`).getBoundingClientRect(); return { w: r.width, h: r.height }; }, at);
    assert.ok(img && Math.abs(img.w - cell.w) < 2 && Math.abs(img.h - cell.h) < 2, 'the drag picture is the slot: ' + JSON.stringify([img, cell]));
    await g.page.mouse.move(b.x, b.y, { steps: 8 }); await g.page.mouse.up(); await g.step(3);
    const r = await g.eval(() => ({ dlg: !document.getElementById('dialog').hidden, bar: window.__G.S.bar && window.__G.S.bar[5], still: window.__G.S.items.some((i) => i.uid === window.__uid) }));
    assert.equal(r.bar, 'g:' + await g.eval(() => window.__uid), 'the ring is on the bar');
    assert.equal(r.dlg, false, 'no throw-away question'); assert.ok(r.still, 'the ring is still yours');
    // owner 2026-10-23: with the bag still open the bar shows the ring at once, and a right click on the slot clears it
    const vis = await g.eval(() => { const b = document.getElementById('skillbar'), s = b.querySelector('[data-sk="5"]'); return { bag: !document.getElementById('inv').hidden, op: +getComputedStyle(b).opacity, pe: getComputedStyle(s).pointerEvents, img: !!s.querySelector('img,canvas') || /url\(/.test(getComputedStyle(s).backgroundImage) || s.innerHTML.length > 20 }; });
    assert.ok(vis.bag && vis.op === 1 && vis.pe !== 'none' && vis.img, 'the bar shows the ring with the bag open: ' + JSON.stringify(vis));
    const b5 = await center(g, '#skillbar [data-sk="5"]');
    await g.page.mouse.click(b5.x, b5.y, { button: 'right' }); await g.step(3);
    const dbg = await g.eval(([x, y]) => { const el = document.elementFromPoint(x, y); return { el: el && (el.id || el.className || el.tagName), bar: window.__G.S.bar }; }, [b5.x, b5.y]);
    assert.ok(!(await g.eval(() => window.__G.S.bar && window.__G.S.bar[5])), 'a right click cleared the slot with the bag open ' + JSON.stringify(dbg));
    assert.equal(await g.eval(() => document.getElementById('inv').hidden), false, 'the bag is still open');
    // letting go over another HUD part cancels
    const q = await center(g, '#skillbar');
    await g.page.mouse.move(a.x, a.y); await g.page.mouse.down(); await g.page.mouse.move(q.x, q.y - 200, { steps: 6 });
    const hud = await g.eval(([x, y]) => { const el = document.elementFromPoint(x, y); return el && el.tagName; }, [q.x, q.y - 200]);
    await g.page.mouse.up(); await g.step(2);
    if (hud !== 'CANVAS') assert.equal(await g.eval(() => document.getElementById('dialog').hidden), true);
    // the bag moves from the empty space at its bottom edge too
    const p0 = await g.eval(() => { const r = document.getElementById('inv').getBoundingClientRect(); return { x: r.left, y: r.top, bx: r.left + 3, by: r.bottom - 3 }; });
    await g.page.mouse.move(p0.bx, p0.by); await g.page.mouse.down(); await g.page.mouse.move(p0.bx + 80, p0.by - 40, { steps: 5 }); await g.page.mouse.up();
    const p1 = await g.eval(() => { const r = document.getElementById('inv').getBoundingClientRect(); return { x: r.left, y: r.top }; });
    assert.ok(Math.abs(p1.x - p0.x - 80) < 3 && Math.abs(p1.y - p0.y + 40) < 3, JSON.stringify([p0, p1]));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
