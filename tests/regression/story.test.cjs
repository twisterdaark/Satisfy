'use strict';
// The main story (major 15): one quest chain for every class, chapter by chapter from the novel: Khan's smithy (ch 22-29),
// the Guardian of the Forest (ch 12-19), the frostlight orcs (ch 68-71) and the golem war (ch 194-205). A chapter opens
// with a page from the novel at its first giver, the quest box shows where the story goes next, and a finished chapter
// says so and points to the next one.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));

test('chapter one: the page from the novel, the story before other quests, Khan’s windows, and the next chapter', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // a warrior at level 30: the quest box shows the story's next step
    await g.eval(() => { const G = window.__G; G.S.cls = 'warrior'; G.S.lv = 30; G.gainXP(1); });
    await g.step(3);
    assert.match(await g.eval(() => document.getElementById('qtext').textContent), /Chapter 1: Khan’s Smithy.*Blacksmith’s Rage from Khan.*\(Lv 30\)/);
    // Khan: the chapter page first, then the story quest (not his own first errand)
    await g.eval(() => window.__G.talkNPC('khan'));
    await g.step(2);
    assert.equal(await g.mode(), 'cut');
    assert.match(await g.eval(() => document.getElementById('card').textContent), /Chapter 1: Khan’s Smithy[\s\S]*Mero Company had dominated[\s\S]*seven generations/);
    await g.eval(() => window.__G.CARD('next'));
    await g.page.waitForTimeout(500);
    await g.step(2);
    assert.equal(await g.mode(), 'dialog');
    const d = await g.eval(() => window.__G.DL ? window.__G.DL.lines.join('\n') : document.getElementById('dtext').textContent);
    assert.match(d, /Difficulty: B[\s\S]*Help the blacksmith Khan[\s\S]*smithy transfer contract/);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && !(G.DL && G.DL.optOn); i++) G.advance(); G.pickOpt(0); });
    await g.step(2);
    assert.deepEqual(await g.eval(() => [window.__G.S.qs.gj1 && window.__G.S.qs.gj1.st, !window.__G.S.qs.kh1]), [1, true]);
    // Praga falls; Khan pays and his affinity reaches the maximum
    const r = await g.eval(() => { const G = window.__G, m = G.mons().find((m) => m.type === 'praga'); m.hp = 1; window.__GB2.kill(m); const a0 = (G.S.aff || {}).khan || 0; G.completeQ('gj1'); return { st: G.S.qs.gj1.st, aff: G.S.aff.khan, a0, page2: window.__GMS.s().i.msc1 }; });
    assert.equal(r.st, 2); assert.equal(r.aff, 100); assert.equal(r.page2, 1);
    // the production game: a rare or better item wins it; the chapter ends and points to the next
    await g.eval(() => { const G = window.__G; G.acceptQ('gj2'); G.S.qs.gj2.c = 1; document.getElementById('toasts').innerHTML = ''; G.completeQ('gj2'); });
    await g.page.waitForTimeout(2800);
    const t1 = await toasts(g);
    assert.match(t1, /chapter 1, Khan’s Smithy, is complete/); assert.match(t1, /Chapter 2, The Guardian of the Forest, begins at level 95/);
    assert.deepEqual(await g.eval(() => [window.__GMS.cur(), window.__GMS.s().d.msc1]), [1, 1]);
    // at 95 the box points to Regas; his page opens once
    await g.eval(() => { const G = window.__G; G.S.lv = 95; G.gainXP(1); });
    await g.step(3);
    assert.match(await g.eval(() => document.getElementById('qtext').textContent), /Chapter 2: The Guardian of the Forest.*The Grey Forest from Regas/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the whole chain: every story quest is reachable in order for any class, and the last chapter says the story goes on', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, M = window.__GMS, o = { order: [] };
      S.cls = 'mage'; S.lv = 300; G.gainXP(1);
      for (const C of M.MSC) { M.s().i[C.k] = 1; for (const id of C.q) { const av = Object.keys(G.QD).filter((q) => G.QD[q].ms && !S.qs[q]); o.order.push(av[0]); G.acceptQ(id); S.qs[id].c = G.QD[id].obj.n; G.completeQ(id); } }
      o.cur = M.cur(); o.hud = M.hud(); o.done = Object.keys(M.s().d).sort();
      return o;
    });
    assert.deepEqual(r.order, ['gj1', 'gj2', 'gj3', 'gj4', 'gj5', 'gj6', 'gj7', 'gj8']);
    assert.equal(r.cur, -1); assert.equal(r.hud, '');
    assert.deepEqual(r.done, ['msc1', 'msc2', 'msc3', 'msc4']);
    await g.page.waitForTimeout(2800);
    assert.match(await toasts(g), /The story continues in a coming update/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
