'use strict';
// A legend's finished quests stay finished (owner 2026-10-26: "every quest I had done came back and I could repeat it"): no giver
// offers a finished quest again; the Quest Book alone offers a legend one replay of it, chosen on purpose
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test("a legend's finished quests are not offered again, but can be replayed once from the Quest Book", async () => {
  const g = await H.openGame({ storage: { satisfy_lang: 'en' } });
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, Q = window.__GQM, id = 'kh1', q = G.QD[id];
      S.mats.wood = 99; G.acceptQ(id); S.qs[id].c = (q.obj && q.obj.n) || 1; G.completeQ(id); S.cls = 'pagma';
      const avail = Q.avail(id), can = Q.can(id), tags = Q.tags(id);
      Q.start(id); const rp = !!(S.qs[id] && S.qs[id].rp); S.qs[id].c = (q.obj && q.obj.n) || 1; G.completeQ(id); const again = Q.can(id);
      return { avail, can, done: tags.includes('done'), rp, again }; });
    assert.ok(!r.avail, 'no giver offers it');
    assert.equal(r.can, true, 'the Quest Book offers the replay');
    assert.equal(r.done, true);
    assert.deepEqual([r.rp, r.again], [true, false], 'one replay, then done for good');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
