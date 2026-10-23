'use strict';
// The novel's production classes as specializations (legends/wiki-production-classes.md): each trainer offers its own (the
// foreman four of them), one is learned at a time, and each bonus works where the novel puts its work.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('production specializations: offered by their trainers, learned one at a time, each bonus at work', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const o = await g.eval(() => { const X = window.__GSEC, out = {};
      for (const k of X.keys()) { const by = X.by(k); out[k] = X.npc(by).some((l) => l.includes(window.__G.S && window.__GCP.t('sec_' + k))); }
      out.foreman = X.opts('foreman').length; out.stylist = X.opts('stylist').length; return out; });
    for (const [k, v] of Object.entries(o)) if (typeof v === 'boolean') assert.equal(v, true, k + ' at its trainer');
    assert.equal(o.foreman, 4, 'miner, builder, construction worker, architect');
    assert.equal(o.stylist, 2, 'the tailor and the painter');
    const r = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GSEC, out = {};
      S.gold = 5000; X.take('scholarRh', 0); out.sec = S.sec; out.gold = S.gold;
      const xp0 = S.xp; S.lv = 300; G.gainXP(1000); out.xp = S.xp - xp0;
      X.take('foreman', 0); out.sec2 = S.sec; out.gold2 = S.gold; out.ore = X.b('ore');
      for (const k of ['xp', 'ore', 'buy', 'sell', 'rep', 'labor', 'gb', 'pot', 'aff', 'acc', 'q', 'wear', 'pet', 'drop', 'fish']) {
        let n = 0; for (const s of X.keys()) { S.sec = s; if (X.b(k) > 0) n++; } out['k_' + k] = n; }
      return out; });
    assert.equal(r.sec, 'scholar'); assert.equal(r.gold, 5000, 'the first one is free');
    assert.ok(r.xp >= 1049 && r.xp <= 1300, 'scholar +5% experience: ' + r.xp);
    assert.equal(r.sec2, 'miner'); assert.equal(r.gold2, 3000, 'switching costs 2000'); assert.equal(r.ore, 1);
    for (const k of Object.keys(r).filter((x) => x.startsWith('k_'))) assert.ok(r[k] >= 1, k + ' has a class');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
