'use strict';
// Horse care (owner 2026-10-22: "any coachman can heal the horse, no travelling to one in particular, and something like
// a herb you can bring and feed it to wake it yourself"): every stable keeper wakes a fallen horse and sells its food;
// feed wakes it at half health, the vitality herb at full, from the bag.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const talk = (g, who) => g.eval((w) => { const G = window.__G; G.DL = null; G.talkNPC(w); for (let i = 0; i < 6 && G.DL && !G.DL.optOn; i++) G.advance();
  return G.DL ? G.DL.opts.map((o) => o.l) : []; }, who);

// open the bag fresh (I) and click the item in it
async function bagUse(g, k) {
  await g.eval(() => { window.__G.DL = null; if (window.__G.mode !== 'play' && window.__G.mode !== 'inv') window.__G.act('resume'); });
  if (await g.eval(() => !document.getElementById('inv').hidden)) await g.page.keyboard.press('KeyI');
  await g.page.keyboard.press('KeyI');
  return g.eval((k) => { const G = window.__G, B = G.bag(), S = G.S; B.invClick(B.INVS.findIndex((s) => s.k === k)); return { dead: !!(S.mdead && S.mdead.horse), hp: S.mhp.horse, n: S.mats[k] || 0 }; }, k);
}

test('a Reidan coachman wakes a fallen horse; feed and the vitality herb wake it from the bag', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const fall = () => g.eval(() => { const S = window.__G.S; S.mounts = { horse: 1 }; S.mount = 'horse'; S.mdead = { horse: 1 }; S.mhp = { horse: 0 }; });
    await fall();
    let o = await talk(g, 'coachR');
    assert.ok(o.some((l) => /Treat/.test(l)), o.join(' | '));
    assert.ok(o.some((l) => /Horse Feed/.test(l)) && o.some((l) => /Vitality Herb/.test(l)), o.join(' | '));
    // buy feed there and feed it from the bag
    await g.eval(() => { const G = window.__G; G.S.gold = 5000; G.pickOpt(G.DL.opts.findIndex((o) => /Horse Feed/.test(o.l))); });
    assert.equal(await g.eval(() => window.__G.S.mats.hfeed), 1);
    const r = await bagUse(g, 'hfeed');
    assert.equal(r.dead, false, 'feed wakes it');
    assert.equal(r.n, 0);
    assert.ok(r.hp > 0, 'at half health: ' + r.hp);
    // the herb: full health
    await fall();
    await g.eval(() => { window.__G.S.mats.vherb = 1; });
    const h = await bagUse(g, 'vherb');
    assert.equal(h.dead, false);
    assert.ok(h.hp >= r.hp * 2 - 1, 'the herb gives full health: ' + h.hp + ' vs ' + r.hp);
    // a horse at full health does not eat
    await g.eval(() => { window.__G.S.mats.hfeed = 1; });
    const f = (await bagUse(g, 'hfeed')).n;
    assert.equal(f, 1);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
