'use strict';
// Trainers and statues in their novel towns (owner 2026-10-21, v1.11): the magic instructor in Reidan, the knight trainer
// in Titan, Cassus in Rolling, the hooded man in Reinhardt; Rebecca's statue in Rolling and Hexetia's, Garion's and
// Debirion's in Reinhardt. A coach in each of those towns runs to the others; a novice with no class rides free.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('trainers and statues stand in their towns, and the coaches take you there', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const z = await g.eval(() => { const G = window.__G, at = (id) => { const n = G.npcs.find((n) => n.id === id); return G.zoneAt(n.x, n.y); };
      const st = Object.fromEntries(window.__GDV.list().map((o) => [o.g, G.zoneAt(o.x, o.y)]));
      return { tm: at('tm'), tk: at('tk'), cassus: at('cassus'), hood: at('hood'), st }; });
    assert.deepEqual([z.tm, z.tk, z.cassus, z.hood], ['zReid', 'zTitan', 'zRolling', 'zRein']);
    assert.equal(z.st.rebecca, 'zRolling');
    for (const k of ['hexetia', 'garion', 'debirion']) assert.equal(z.st[k], 'zRein', k);
    // a novice rides free from Winston to Reidan, and the Winston coachman says where the trainers are
    await g.eval(() => { const G = window.__G; G.S.gold = 0; G.DL = null; G.talkNPC('coachW'); });
    await g.step(2);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && G.DL && !G.DL.optOn; i++) G.advance(); });
    await g.step(1);
    const opts = await g.eval(() => [...document.querySelectorAll('#dopts [data-opt]')].map((o) => o.textContent));
    assert.ok(opts.some((o) => /Travel to Reidan \(free: you have no class yet\)/.test(o)), opts.join(' | '));
    assert.ok(opts.some((o) => /Where are the trainers\?/.test(o)), opts.join(' | '));
    await g.eval(() => { const G = window.__G; G.pickOpt(G.DL.opts.findIndex((o) => /Reidan/.test(o.l))); });
    await g.page.waitForTimeout(600);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, c = G.npcs.find((n) => n.id === 'coachR'); return { z: G.zoneAt(G.P.x, G.P.y), d: Math.hypot(G.P.x - c.x, G.P.y - c.y), gold: G.S.gold, solid: G.eqx.solid(Math.floor(G.P.x / 16), Math.floor(G.P.y / 16)) }; });
    assert.equal(r.z, 'zReid'); assert.ok(r.d < 30, JSON.stringify(r)); assert.equal(r.gold, 0); assert.equal(r.solid, false);
    // with a class the ride costs more the further it goes, and every new coach lists the other towns
    const f = await g.eval(() => { const G = window.__G; G.S.cls = 'mage'; G.S.gold = 0; G.DL = null; G.talkNPC('coachR'); for (let i = 0; i < 6 && G.DL && !G.DL.optOn; i++) G.advance();
      return G.DL.opts.map((o) => o.l).filter((l) => /^Travel to/.test(l)); });
    assert.equal(f.length, 5, f.join(' | '));
    const gold = (re) => +f.find((o) => re.test(o)).match(/\((\d+) gold\)/)[1];
    assert.ok(gold(/Rein/) < gold(/Titan/), f.join(' | '));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
