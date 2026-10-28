'use strict';
// owner 2026-10-23 ("let there be tracking for things like these": Dark Bass, the City 13 lord, the Immortal Kingdom's
// soldiers, the ancient weapon): every quest points somewhere, even with none of its monsters alive anywhere; a story
// quest not taken yet points to its giver; the arrow also works under the world.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every quest has a place to point to; far and dead monsters by where they live; the story giver; under the world', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const none = await g.eval(() => { const G = window.__G, T = window.__GTRK, QD = G.QD, out = []; for (const id in QD) G.S.qs[id] = { st: 1, n: 0 }; for (const id in QD) if (!T.spot(id)) out.push(id); return out; });
    assert.deepEqual(none, [], 'quests with nowhere to point');
    // none of these alive anywhere: still a place (their spawn point, the event, the islands)
    const far = await g.eval(() => { const G = window.__G, T = window.__GTRK, M = T.mons(); for (const m of M) if (['dbus', 'vlord', 'ersol', 'aweapon', 'ogolem', 'dk_madra', 'warlord'].includes(m.type)) m.dead = true;
      return ['gj9', 'vc3', 'rw1', 'gj8', 'gj7', 'gj11', 'br3'].map((id) => { const p = T.spot(id); return p ? [id, Math.round(p.x), Math.round(p.y)] : [id, null]; }); });
    for (const [id, x] of far) assert.ok(x !== null, id + ' has no place: ' + JSON.stringify(far));
    assert.ok(far.every(([, x, y]) => y < 330 && x > 0), 'all on the map: ' + JSON.stringify(far));
    // a story quest not taken: its giver, gold; following it from its window
    const st = await g.eval(() => { const G = window.__G, T = window.__GTRK; delete G.S.qs.gj9; const p = T.spot('gj9'), n = G.npcs.find((n) => n.id === 'piaro'); return { ret: p && p.ret, d: p && n ? Math.hypot(p.x * 16 - n.x, p.y * 16 - n.y) : -1 }; });
    assert.equal(st.ret, 1); assert.ok(st.d >= 0 && st.d < 48, JSON.stringify(st));
    // under the world: the arrow is drawn (no error) in a dungeon while following a quest outside it
    await g.eval(() => { const G = window.__G; for (const id in G.QD) delete G.S.qs[id]; G.S.qs.c2m = { st: 1, n: 0 }; G.S.qTrk = 'c2m'; G.S.qGOff = 0; const T = window.__GTRK; G.P.x = 240 * 16; G.P.y = (T.WMH + 10) * 16; });
    await g.step(10);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
