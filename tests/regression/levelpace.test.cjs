'use strict';
// Leveling pace (owner 2026-10-22). "I went from 1 to 172 in an hour", then "50 hours to 100 is far too long, and take
// the per-kill cap away": one kill gives its whole XP again (at most 1.3 times it from a monster far above you, instead
// of the old 2 times), and the curve asks about 63 thousand XP at level 100 (33 thousand before, 386 thousand in v1.82).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

// owner 2026-10-25 (the encyclopedia §96): from level 100 one kill gives at most a share of the level (2% to 199,
// regression/xpcap); below 100 there is still no cap
test('no per-kill cap below 100: a far higher monster gives 1.3 times its XP; from 100 at most 2%; level 100 needs about 63 thousand', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, U = window.__GU; const one = (L) => { S.lv = L; S.xp = 0;
      const m = G.spawnMon('lizard', G.P.x + 30, G.P.y); m.tmp = 0; m.lv = L + 40; const x0 = S.xp, l0 = S.lv; U.killMon(m);
      const got = S.xp - x0 + (S.lv > l0 ? 1e12 : 0), need = G.xpNeed(); S.xp = 0; return { got, need }; };
      const a = one(90), b = one(100); S.lv = 100; return { xp: G.isk.MT.lizard.xp, got: a.got, got100: b.got, need: b.need }; });
    assert.ok(r.got >= Math.round(r.xp * 1.3), 'a kill 40 levels up at level 90 gave ' + r.got + ' of ' + r.xp);
    assert.equal(r.got100, Math.round(r.need * .02), 'at level 100: the 2% cap');
    assert.ok(r.need > 55000 && r.need < 70000, 'level 100 needs ' + r.need);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-23: "I kill a Lv 340 at 339 and take 20% of a level or more; make it slower"
test('past level 100 the curve climbs: a foe of your level at 339 gives a few percent of a level', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S; const at = (l) => { S.lv = l; return G.xpNeed(); };
      const o = { n100: at(100), n339: at(339), r200: at(201) / at(200), xp: G.isk.MT.hdrac2.xp }; S.lv = 1; return o; });
    assert.ok(r.n100 > 55000 && r.n100 < 70000, 'level 100 is as before: ' + r.n100);
    const pct = r.xp * 1.03 / r.n339 * 100;
    assert.ok(pct < 3, 'a Lv 340 drake man at 339 gives ' + pct.toFixed(2) + '% of a level');
    assert.ok(r.r200 > 1.1, 'the step at an advancement: ' + r.r200);
  } finally { await g.close(); }
});
