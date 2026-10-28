'use strict';
// owner 2026-10-23: a boss drops normal loot on every kill (its materials, several at a time, and often an item); its chest
// comes once a day with better loot (a guaranteed item of a higher rating, all its materials in full); the monster book
// shows the two apart.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a boss drops loot every kill and leaves its better chest once a day', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, mats = () => JSON.stringify(G.S.mats), m = G.mons().find((v) => v.type === 'sanju1');
      G.S.lv = 300; G.P.x = m.x + 30; G.P.y = m.y;
      const before = { mith: G.S.mats.mith || 0, items: G.S.items.length };
      m.hp = 0; U.killMon(m);
      const after1 = { mith: G.S.mats.mith || 0, items: G.S.items.length };
      const ch = window.__G.eqx.DGATES.filter((d) => d.chest && d.b === 'sanju1');
      return { before, after1, chests: ch.length };
    });
    assert.ok(r.after1.mith - r.before.mith >= 2, 'several mithril from one kill: ' + JSON.stringify(r));
    assert.equal(r.chests, 1, 'the boss left its chest');
    const c = await g.eval(() => {
      const G = window.__G, ch = G.eqx.DGATES.find((d) => d.chest && d.b === 'sanju1'), n0 = G.S.items.length, m0 = G.S.mats.mith || 0;
      G.eqx.useGate(ch);
      return new Promise((res) => setTimeout(() => {
        const got = G.S.items.slice(n0), m = window.__G.mons().find((v) => v.type === 'sanju1');
        const r = { items: got.length, best: Math.max(...got.map((i) => i.r || 0)), mith: (G.S.mats.mith || 0) - m0, bch: G.S.bch && G.S.bch.sanju1 };
        // a second kill the same day: drops again, but no chest
        m.dead = false; m.hp = 0; window.__GU.killMon(m); r.second = G.eqx.DGATES.filter((d) => d.chest && d.b === 'sanju1' && !d.open).length;
        res(r);
      }, 300));
    });
    assert.ok(c.items >= 1 && c.best >= 3, 'a guaranteed item of rating 3 or more: ' + JSON.stringify(c));
    assert.ok(c.mith >= 10, 'all its mithril in full: ' + c.mith);
    assert.ok(c.bch, 'the day is remembered');
    assert.equal(c.second, 0, 'no second chest today');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
