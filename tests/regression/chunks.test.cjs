'use strict';
// SAT-ONLINE-135 (plan U310 "renderer batching: draw calls per visible chunk; no color regression", U316 "asset loader: lazy
// chunks with a cache; memory footprint bounded"). The ground and the overlay are drawn in 512 px chunks when the camera
// needs them (chunkLayer, B's v0.60 work), each replaying the draw calls recorded on its layer. Touring the whole map keeps
// at most 36 chunks a layer drawn and the pool of spare canvases no larger; a chunk dropped on the way and drawn again
// later has exactly the same pixels as the first time.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('world chunks: drawn when needed, at most 36 a layer, the same pixels when drawn again', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.step(5);
    const home = await g.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));
    const hash = () => g.eval((h) => { const L = window.__G.chunkLayers(); return [L.gg.hash(h.x, h.y), L.og.hash(h.x, h.y)]; }, home);
    const h0 = await hash();
    assert.ok(h0[0] !== 0x811c9dc5, 'the ground there has pixels');

    // the towns, and a grid over the land between them
    const pts = await g.eval(() => {
      const T = window.__GU.TOWNS.map((t) => [t.rx * 16 + 64, t.ry * 16 + 64]), xs = T.map((p) => p[0]), ys = T.map((p) => p[1]), o = T.slice();
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      for (let x = x0; x <= x1; x += 1200) for (let y = y0; y <= y1; y += 900) o.push([x, y]);
      return o;
    });
    assert.ok(pts.length > 20, 'a tour of ' + pts.length + ' places');
    let most = { g: 0, o: 0, pool: 0 }, dropped = false;
    for (const [x, y] of pts) {
      await g.eval(([a, b]) => { const P = window.__G.P; P.x = a; P.y = b; P.inv = 1e9; }, [x, y]);
      await g.step(3);
      const c = await g.eval(() => window.__G.chunks());
      most = { g: Math.max(most.g, c.g.live), o: Math.max(most.o, c.o.live), pool: Math.max(most.pool, c.g.pool, c.o.pool) };
      assert.ok(c.g.live <= c.g.lim && c.o.live <= c.o.lim, 'at most ' + c.g.lim + ' a layer: ' + JSON.stringify(c));
      if (!dropped) dropped = !(await g.eval((h) => window.__G.chunkLayers().gg.has(h.x, h.y), home));
    }
    assert.ok(most.g > 4, 'the tour drew chunks: ' + JSON.stringify(most));
    assert.ok(most.pool <= 36, 'spare canvases bounded: ' + most.pool);
    assert.ok(dropped, 'the first chunk was dropped on the way');

    // back home: drawn again from its recorded calls, the same pixels
    await g.eval((h) => { const P = window.__G.P; P.x = h.x; P.y = h.y; }, home);
    await g.step(3);
    assert.deepEqual(await hash(), h0, 'no color change when a chunk is drawn again');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// SAT-ONLINE-198 (owner 2026-10-24: "many things freeze the game"): with 36 chunks live, the ones next to the view are still
// warmed in idle time (before, none was warmed again once 36 were live: after a few minutes of walking each chunk that
// came into view was painted in one go, 30-75 ms a frame)
test('world chunks: still warmed ahead after 36 are live', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { const P = window.__G.P; P.inv = 1e9; P.x = 130 * 16; P.y = 60 * 16; });
    await g.step(5);
    const walk = async (n) => { for (let i = 0; i < n; i++) { await g.eval(() => { window.__G.P.x += 96; }); await g.step(6); await g.page.waitForTimeout(60); } };
    // east until both layers hold 36
    for (let k = 0; k < 40 && (await g.eval(() => window.__G.chunks().g.live)) < 36; k++) await walk(6);
    const a = await g.eval(() => window.__G.chunks());
    assert.equal(a.g.live, 36, 'the ground holds 36: ' + JSON.stringify(a.g));
    await walk(60); // about 11 chunks further east
    const b = await g.eval(() => window.__G.chunks());
    const made = b.g.made - a.g.made, warmed = b.g.warmed - a.g.warmed;
    assert.ok(warmed >= 8, 'chunks warmed ahead after 36: ' + JSON.stringify({ made, warmed }));
    assert.ok(made <= warmed / 2, 'few painted in one go: ' + JSON.stringify({ made, warmed }));
    assert.ok(b.g.live <= b.g.lim && b.o.live <= b.o.lim, 'still at most 36: ' + JSON.stringify(b));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
