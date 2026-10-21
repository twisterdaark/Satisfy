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
      S.cls = 'mage'; S.lv = 480; G.gainXP(1);
      for (const C of M.MSC) { M.s().i[C.k] = 1; for (const id of C.q) { const av = Object.keys(G.QD).filter((q) => G.QD[q].ms && !S.qs[q]); o.order.push(G.QD[id].ms ? av[0] : id); G.acceptQ(id); S.qs[id].c = G.QD[id].obj.n; G.completeQ(id); } }
      o.cur = M.cur(); o.hud = M.hud(); o.done = Object.keys(M.s().d).sort();
      return o;
    });
    assert.deepEqual(r.order, ['gj1', 'gj2', 'gj3', 'gj4', 'gj5', 'gj6', 'gj7', 'gj8', 'gj9', 'asm', 'gj10', 'gj11', 'gj12', 'gj13', 'gj14', 'gj15', 'gj16', 'gj17']);
    assert.equal(r.cur, -1); assert.equal(r.hud, '');
    assert.deepEqual(r.done, ['msc1', 'msc2', 'msc3', 'msc4', 'msc5', 'msc6', 'msc7', 'msc8', 'msc9']);
    await g.page.waitForTimeout(2800);
    assert.match(await toasts(g), /The story continues in a coming update/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// chapters 5-7 (v0.98): the Seventh Servant (Piaro; his SS quest on Asmophel is the chapter's second part), the Behen
// Archipelago (Sage Sticks on the pier's landing) and the 22nd Great Demon (Earl Flenitium behind Fort Taleren's wall)
test('chapters 5 to 7: Dark Bus and Asmophel, the Behen death knights, Berith at Fort Taleren', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G, S = G.S; for (let i = 1; i <= 8; i++)S.qs['gj' + i] = { st: 2, c: 0 }; ['msc1', 'msc2', 'msc3', 'msc4'].forEach((k) => { window.__GMS.s().i[k] = 1; window.__GMS.s().d[k] = 1; }); S.cls = 'warrior'; S.lv = 280; G.gainXP(1); });
    await g.step(3);
    assert.match(await g.eval(() => document.getElementById('qtext').textContent), /Chapter 5: The Seventh Servant.*The Seventh Servant, Dark Bus from Piaro/);
    // Piaro: the page, then the window
    await g.eval(() => window.__G.talkNPC('piaro'));
    await g.step(2);
    assert.match(await g.eval(() => document.getElementById('card').textContent), /Chapter 5: The Seventh Servant[\s\S]*three week journey/);
    await g.eval(() => window.__G.CARD('next'));
    await g.page.waitForTimeout(500);
    await g.step(2);
    const d = await g.eval(() => window.__G.DL.lines.join('\n'));
    assert.match(d, /obliged to maintain Asmophel’s brainwashing[\s\S]*Defeat the Seventh Servant Dark Bus/);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && !(G.DL && G.DL.optOn); i++) G.advance(); G.pickOpt(0); });
    await g.step(2);
    // Dark Bus falls at the mansion; Piaro hears of it
    await g.eval(() => { const G = window.__G, m = G.mons().find((m) => m.type === 'dbus'); m.hp = 1; window.__GB2.kill(m); });
    await g.step(2);
    await g.eval(() => { const G = window.__G; G.DL = null; G.talkNPC('piaro'); });
    await g.step(2);
    assert.match(await g.eval(() => document.getElementById('dtext').textContent), /defeated the Seventh Servant Dark Bus/);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 4 && G.DL; i++) G.advance(); });
    await g.step(2);
    assert.equal(await g.eval(() => window.__G.S.qs.gj9.st), 2);
    // the SS quest on Asmophel ends the chapter
    await g.eval(() => { const G = window.__G; G.acceptQ('asm'); G.S.qs.asm.c = 1; document.getElementById('toasts').innerHTML = ''; G.completeQ('asm'); });
    await g.page.waitForTimeout(2800);
    const t5 = await toasts(g);
    assert.match(t5, /chapter 5, The Seventh Servant, is complete/); assert.match(t5, /Chapter 6, The Behen Archipelago, begins at level 400/);
    // Sticks waits on the landing at the end of the Behen pier, on open ground
    const sp = await g.eval(() => { const G = window.__G, n = G.npcs.find((n) => n.id === 'stickp'), f = G.npcs.find((n) => n.id === 'flenit'); return { n: !!n, f: !!f, ns: !!window.__GC2.solid(Math.floor(n.x / 16), Math.floor(n.y / 16)), fs: !!window.__GC2.solid(Math.floor(f.x / 16), Math.floor(f.y / 16)) }; });
    assert.deepEqual(sp, { n: true, f: true, ns: false, fs: false });
    await g.eval(() => { const G = window.__G; G.S.lv = 400; G.gainXP(1); G.talkNPC('stickp'); });
    await g.step(2);
    assert.match(await g.eval(() => document.getElementById('card').textContent), /Chapter 6: The Behen Archipelago[\s\S]*beautiful and holy place until 200 years ago/);
    await g.eval(() => window.__G.CARD('next'));
    await g.page.waitForTimeout(500);
    await g.step(2);
    assert.match(await g.eval(() => window.__G.DL.lines.join('\n')), /Demon Slayer Alex defended the 62nd island/);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && !(G.DL && G.DL.optOn); i++) G.advance(); G.pickOpt(0); });
    await g.step(2);
    const r6 = await g.eval(() => { const G = window.__G, S = G.S; S.qs.gj10.c = 1; G.completeQ('gj10'); S.lv = 440; G.acceptQ('gj11'); S.qs.gj11.c = 1; document.getElementById('toasts').innerHTML = ''; G.completeQ('gj11'); return [S.qs.gj10.st, S.qs.gj11.st]; });
    assert.deepEqual(r6, [2, 2]);
    await g.page.waitForTimeout(2800);
    assert.match(await toasts(g), /Chapter 7, The 22nd Great Demon, begins at level 445/);
    // the earl at Fort Taleren
    await g.eval(() => { const G = window.__G; G.S.lv = 450; G.gainXP(1); G.DL = null; G.talkNPC('flenit'); });
    await g.step(2);
    assert.match(await g.eval(() => document.getElementById('card').textContent), /Chapter 7: The 22nd Great Demon[\s\S]*Berith on a sickly horse/);
    await g.eval(() => window.__G.CARD('next'));
    await g.page.waitForTimeout(500);
    await g.step(2);
    assert.match(await g.eval(() => window.__G.DL.lines.join('\n')), /army of 3,000 demons[\s\S]*Defeat 30 demons/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('chapters 8 and 9: Jishuka sends you after the divine beasts, then Piaro gathers the raid on Belial', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G, S = G.S; for (let i = 1; i <= 13; i++)S.qs['gj' + i] = { st: 2, c: 0 }; S.qs.asm = { st: 2, c: 0 }; for (let i = 1; i <= 7; i++) { window.__GMS.s().i['msc' + i] = 1; window.__GMS.s().d['msc' + i] = 1; } S.cls = 'archer'; S.lv = 455; G.gainXP(1); });
    await g.step(3);
    assert.match(await g.eval(() => document.getElementById('qtext').textContent), /Chapter 8: The Divine Beasts’ Breaths.*The Red Phoenix’s Breath from Jishuka/);
    await g.eval(() => window.__G.talkNPC('jishuka'));
    await g.step(2);
    assert.match(await g.eval(() => document.getElementById('card').textContent), /Chapter 8: The Divine Beasts’ Breaths[\s\S]*East Continent contest/);
    // chapter 9 opens with Piaro once both breaths are taken
    await g.eval(() => { const G = window.__G, S = G.S; S.qs.gj14 = { st: 2, c: 0 }; S.qs.gj15 = { st: 2, c: 0 }; window.__GMS.s().i.msc8 = 1; window.__GMS.s().d.msc8 = 1; S.lv = 470; G.gainXP(1); });
    await g.step(3);
    assert.match(await g.eval(() => document.getElementById('qtext').textContent), /Chapter 9: The 32nd Great Demon.*Aslan’s Ritual from Piaro/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
