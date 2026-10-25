'use strict';
// (owner 2026-10-26, a player's report: "it asks me to steal from monsters but doesnt give me the skill to do it") A class
// trial lends the skill it asks for while it is yours: A Light Hand lends Steal to a novice, the thief keeps it after. The
// same review: the Monk's trial (pray eight times) had no way to pray, and two craft-for quests came before their recipe.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('A Light Hand lends Steal while it is yours, and the thief keeps it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, o = {};
      S.lv = 15; S.bar = null;
      const bar = () => window.__GRG.bar();
      o.before = !!(S.sk && S.sk.tsteal) || bar().includes('tsteal');
      G.acceptQ('ct');
      o.lent = [!!S.sk.tsteal, bar().indexOf('tsteal') >= 0];
      // five monsters stolen from, the monster right where you stand
      P.mp = 1e6;
      for (let i = 0; i < 5; i++) { const id = window.__GSKF.dummy(P.x, P.y); const m = G.mons().find((x) => x.id === id); m.stol = 0; P.cd.tsteal = 0; G.useSlot(bar().indexOf('tsteal')); m.dead = true; }
      o.count = S.qs.ct.c;
      return o;
    });
    assert.equal(r.before, false, 'not before the trial');
    assert.deepEqual(r.lent, [true, true], 'on the bar from the moment it is accepted');
    assert.equal(r.count, 5);
    const r2 = await g.eval(() => {
      const G = window.__G, S = G.S; G.completeQ('ct');
      return [S.cls, window.__GRG.bar().includes('tsteal'), S.qs.ct.st];
    });
    assert.deepEqual(r2, ['thief', true, 2]);
    // someone else who drops the trial loses the loan
    const r3 = await g.eval(() => {
      const G = window.__G, S = G.S; S.cls = 'novice'; delete S.qs.ct; S.bar = null; G.acceptQ('cw');
      return { qs: Object.keys(S.qs).includes('ct'), bar: window.__GRG.bar().includes('tsteal') };
    });
    assert.deepEqual(r3, { qs: false, bar: false });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Monk prays with Cassus; the craft-for quests wait for their recipe', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, PH = window.__GPH, o = {};
      S.cls = 'priest'; S.lv = 40; S.qs.cp = { st: 2, c: 5 }; S.qs.cpmonk = { st: 1, c: 0 };
      const pr = PH.casOpts().find((x) => /Pray/.test(x.l)); o.opt = !!pr;
      if (pr) { pr.f(); for (let i = 0; i < 30; i++) PH.tick(.5); }
      o.c = S.qs.cpmonk.c; o.obj = window.__GC2.obj('cpmonk');
      // no prayer to offer once it is done or not yours
      S.qs.cpmonk = { st: 2, c: 8 }; o.after = PH.casOpts().some((x) => /Pray/.test(x.l));
      o.cf = [G.QD.cf1.pre, G.QD.cf2.pre];
      return o;
    });
    assert.equal(r.opt, true, 'the prayer is there for the Monk\'s trial');
    assert.equal(r.c, 1, 'one prayer, still for 12 seconds, counts');
    assert.match(r.obj, /Pray to Boris beside Cassus/);
    assert.equal(r.after, false);
    assert.deepEqual(r.cf, ['kh4', 'kh3'], 'the helmet after the leather armour is taught, the spear after the sword');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('(review) a save from before the fix gets Steal on load; taking the trial again lends it again; the loan is a novice\'s', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // the reporter's case: on the trial already, a bar of their own, Steal never given
    await g.eval(() => { const G = window.__G, S = G.S; S.lv = 15; S.qs.ct = { st: 1, c: 0 }; S.sk = S.sk || {}; delete S.sk.tsteal; S.bar = ['hpot', null, null, null, null, null, null, null]; });
    await g.eval(() => window.__G.act('quit'));
    await g.waitMode('title');
    await g.reload();
    await H.continueGame(g);
    await g.step(3);
    assert.equal(await g.eval(() => window.__GRG.bar().includes('tsteal')), true, 'placed when the save opens');
    // dropped, the bar rewritten, taken again: back on the bar
    const again = await g.eval(() => { const G = window.__G, S = G.S; delete S.qs.ct; S.bar = window.__GRG.bar().slice(0, 8).map((k) => k === 'tsteal' ? null : k); G.acceptQ('ct'); return window.__GRG.bar().includes('tsteal'); });
    assert.equal(again, true);
    // a novice who became something else meanwhile: no loan, and finishing the trial changes no class
    const other = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'orator'; S.bar = null; const lent = window.__GRG.bar().includes('tsteal'); S.qs.ct.c = 5; G.completeQ('ct'); return { lent, cls: S.cls }; });
    assert.deepEqual(other, { lent: false, cls: 'orator' });
    // the mithril sword quest waits for smithing level 5, as its recipe does
    const sr = await g.eval(() => { const G = window.__G, S = G.S, E = window.__GC2; S.lv = 80; S.qs.fo2 = { st: 2, c: 0 }; S.smith = 4; const a = E.avail('sr1'); S.smith = 5; return [a, E.avail('sr1')]; });
    assert.deepEqual(sr, [false, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
