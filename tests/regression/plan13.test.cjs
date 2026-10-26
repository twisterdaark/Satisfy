'use strict';
// Plan batch 13 (owner 2026-10-26 21:35: "keep making updates, don't stop"): U311 one id for each monster on the network,
// kept through respawns and never shared by two live ones; one entity id scheme for monsters, NPCs and players.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const KEYS = `const X = window.__GPB12, live = () => window.__G.mons().filter((m) => !m.tmp && !m.dead),
  dups = () => { const seen = new Set(), d = []; for (const m of live()) { const k = X.mobKey(m); if (seen.has(k)) d.push(k); seen.add(k); } return d; };`;

test('every monster has a key of its own on the network, the same on every screen, through respawns', async () => {
  const g = await H.openGame({});
  const h = await H.openGame({});
  try {
    await H.newGame(g);
    await H.newGame(h);
    const a = await g.eval(new Function(`${KEYS} const all = window.__G.mons().filter((m) => !m.tmp); return { n: all.length, dups: dups(), renamed: all.filter((m) => /~\\d+$/.test(X.mobKey(m))).map((m) => X.mobKey(m)), keys: all.map((m) => X.mobKey(m)).join('|').length, hash: all.map((m) => X.mobKey(m)).join('|') };`));
    const b = await h.eval(new Function(`${KEYS} const all = window.__G.mons().filter((m) => !m.tmp); return all.map((m) => X.mobKey(m)).join('|');`));
    assert.deepEqual(a.dups, [], 'no two live monsters share a key');
    assert.ok(a.renamed.length >= 5, 'the pairs on one tile are told apart: ' + a.renamed.join(', '));
    assert.equal(b, a.hash, 'the same keys on another screen');

    // kill a dozen near the player, step away, let them come back: the same monsters, the same keys, new local ids
    const before = await g.eval(new Function(`${KEYS}
      const P = window.__G.P, Y = window.__GPB11, near = live().filter((m) => !m.boss && !m.band && Math.hypot(m.x - P.x, m.y - P.y) < 600).slice(0, 12);
      window.__U311 = near.map((m) => ({ m, k: X.mobKey(m), id: m.id }));   // kept outside: a respawn clears the monster's own fields (monFresh)
      for (const m of near) { Y.killMon(m); m.rt = 0.05; }
      P.y -= 150; return near.length;`));
    assert.ok(before >= 6, 'monsters to kill: ' + before);
    await g.step(30);
    const after = await g.eval(new Function(`${KEYS}
      const near = window.__U311, ms = window.__G.mons();
      return { back: near.filter((e) => !e.m.dead).length, same: near.every((e) => ms.includes(e.m) && X.mobKey(e.m) === e.k), newIds: near.filter((e) => !e.m.dead).every((e) => e.m.id !== e.id), dups: dups(),
        ids: new Set(ms.map((m) => m.id)).size === ms.length };`));
    assert.ok(after.back >= before - 2, 'they came back: ' + after.back + '/' + before);
    assert.equal(after.same, true, 'each one the same monster with its key');
    assert.equal(after.newIds, true, 'with a new local id: an id is never used twice');
    assert.deepEqual(after.dups, []); assert.equal(after.ids, true);

    // one scheme for what stands in the world
    const e = await g.eval(() => {
      const X = window.__GPB12, G = window.__G, m = G.mons().find((x) => !x.tmp);
      return { mon: X.entId(m) === 'm:' + X.mobKey(m), me: X.entId(G.P), npc: X.entId(X.npcObj('khan')), fake: X.entId({ id: 'khan' }) };
    });
    assert.equal(e.mon, true); assert.equal(e.me, 'p:me', 'offline the player is p:me');
    assert.equal(e.npc, 'n:khan'); assert.equal(e.fake, null, 'only a real NPC gets an NPC id');
    assert.deepEqual(g.errors, []);
    assert.deepEqual(h.errors, []);
  } finally { await g.close(); await h.close(); }
});
