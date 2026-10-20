'use strict';
// Town layout (owner 2026-10-20: Reinhardt had a road waystation's tents inside it and buildings against its walls).
// In every walled town: no tent, no two buildings touching or overlapping, no building against a wall, wells and anvils
// clear of buildings, and every building's door reachable on foot from the town square.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('towns: no tents, no touching buildings, nothing against a wall, every door reachable', async () => {
  const g = await H.openGame();
  const bad = await g.eval(() => {
    const W = window.__G.world(), at = window.__G.at, out = [];
    const WL = 8, SOL = new Set([3, 4, 6, 7, 8, 11, 13]);
    for (const T of W.TOWNS) {
      const inT = (x, y) => x >= T.x0 && x <= T.x1 && y >= T.y0 && y <= T.y1;
      const bs = W.buildings.filter((b) => inT(b.x, b.y + b.h - 1)), nm = (b) => T.k + ' ' + b.k + '@' + b.x + ',' + b.y;
      for (const [x, y] of W.TENTS) if (inT(x, y)) out.push(T.k + ' tent@' + x + ',' + y);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], c = bs[j];
        if (a.x <= c.x + c.w && c.x <= a.x + a.w && a.y <= c.y + c.h && c.y <= a.y + a.h) out.push(nm(a) + ' touches ' + nm(c));
      }
      for (const b of bs) for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++)
        if (at(x, y) === WL) { out.push(nm(b) + ' against a wall at ' + x + ',' + y); y = 1e9; break; }
      for (const [k, x, y] of [...W.WELLS.map((w) => ['well', w.tx, w.ty]), ...W.ANVILS.map((a) => ['anvil', a.tx, a.ty])])
        if (inT(x, y) && bs.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h)) out.push(T.k + ' ' + k + '@' + x + ',' + y + ' on a building');
      const seen = new Set([(T.rx | 0) + ',' + (T.ry | 0)]), q = [[T.rx | 0, T.ry | 0]];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
          if (seen.has(k) || nx < T.x0 - 3 || nx > T.x1 + 3 || ny < T.y0 - 3 || ny > T.y1 + 3 || SOL.has(at(nx, ny))) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      for (const b of bs) { const dx = b.x + (b.w >> 1), dy = b.y + b.h; if (!seen.has(dx + ',' + dy) && !seen.has((dx - 1) + ',' + dy)) out.push(nm(b) + ' door cut off'); }
    }
    return out;
  });
  assert.deepEqual(bad, []);
  assert.deepEqual(g.errors, []);
  await g.close();
});
