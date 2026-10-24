'use strict';
// SAT-ONLINE-186 (owner 2026-10-24: "the lag grew a lot, many frame drops, many things freeze the game"). The map copies
// were painted in quarter- to full-second blocks during play; now they're painted in thin strips in idle time:
//   - the HUD map's pieces round the player are painted ahead, before the HUD needs them;
//   - a piece painted in strips is the same pixels as one painted in one go;
//   - the world map zoomed out draws at once and fills in while it's open (it used to paint the whole 2 px copy first);
//   - a monster that comes back after dying is the same object, made new (its old fields gone), without `delete`.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function until(g, fn, ms, arg) {
  const end = Date.now() + ms;
  for (;;) { if (await g.eval(fn, arg)) return; if (Date.now() > end) throw new Error('timed out: ' + fn); await g.page.waitForTimeout(100); }
}

test('the HUD map is painted ahead; strips join exactly; the world map does not wait', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(30); // the HUD map has drawn (five times a second) and asked for what's round it
    // the pieces round the player (what the HUD shows and 48 tiles more) come in idle time
    await until(g, () => window.__G.pj().every(([k, p]) => k[0] !== 'm' || p >= 2), 60000);
    const around = await g.eval(() => { const G = window.__G, P = G.P, ox = P.x / 16 - 32, oy = P.y / 16 - 22 + 172, out = [];
      for (let j = Math.max(0, Math.floor((oy - 48) / 128)); j * 128 < oy + 44 + 48; j++) for (let i = Math.max(0, Math.floor((ox - 48) / 128)); i * 128 < ox + 64 + 48; i++) out.push([i, j, G.miniHas(i, j)]); return out; });
    assert.ok(around.length >= 2 && around.every((x) => x[2]), 'painted ahead: ' + JSON.stringify(around));
    // a piece far away, asked for: painted in strips in idle time, the same pixels as in one go
    assert.equal(await g.eval(() => window.__G.miniHas(10, 2)), false);
    await g.eval(() => window.__G.miniQ(10, 2));
    await until(g, () => window.__G.miniHas(10, 2), 60000);
    const diff = await g.eval(() => { const G = window.__G, i = 10, j = 2, cw = 128, rh = 128, xa = i * 128 - 2, xb = i * 128 + cw + 2, ya = j * 128 - 2, yb = j * 128 + rh + 2;
      const one = document.createElement('canvas'); one.width = cw * 4; one.height = rh * 4; const og = one.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
      og.drawImage(G.mmo({ x0: xa, cols: xb - xa, y0: ya, rows: yb - ya }), (xa - i * 128) * 4, (ya - j * 128) * 4, (xb - xa) * 4, (yb - ya) * 4);
      const q = G.miniP(i, j), A = q.getContext('2d').getImageData(0, 0, q.width, q.height).data, B = og.getImageData(0, 0, one.width, one.height).data;
      let d = 0; for (let k = 0; k < A.length; k++) if (A[k] !== B[k]) d++; return d; });
    assert.equal(diff, 0, 'strips join exactly');
    // the world map zoomed out: drawn at once from what's ready (nothing painted while it draws), then filled in while open
    await g.page.keyboard.press('KeyM'); await g.step(2);
    const [a, b] = await g.eval(() => { const G = window.__G, a = G.miniLeft(); G.MV.z = 1; G.mapDraw(); return [a, G.miniLeft()]; });
    if (a > 0) assert.equal(b, a, 'drawing the map painted nothing at once');
    await until(g, () => window.__G.miniLeft() === 0, 90000);
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a monster that comes back is the same one, made new', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => { const G = window.__G, P = G.P, M = G.mons(); let m = null;
      for (const x of M) if (!x.dead && !x.boss && Math.hypot(x.sx - P.x, x.sy - P.y) > 400 && Math.hypot(x.sx - P.x, x.sy - P.y) < 800) { m = x; break; }
      window.__mm = m; m.dead = true; m.rt = 0; m.hp = 0; m.bl = { t: 2, n: 0 }; m.oldOnly = 7; return m.type; });
    await g.step(3);
    const after = await g.eval(() => { const m = window.__mm; return { same: window.__G.mons().includes(m), dead: m.dead, full: m.hp === m.max && m.hp > 0, bl: m.bl, old: m.oldOnly, type: m.type }; });
    assert.deepEqual(after, { same: true, dead: false, full: true, bl: undefined, old: undefined, type: r });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
