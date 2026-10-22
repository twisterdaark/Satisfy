'use strict';
// The storage chest (owner 2026-10-22: "a chest to keep the weapons and things in your bag you do not need, to use
// later"): every inn opens the same chest; a click moves a stack across, worn gear stays; the chest is saved.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const talk = (g, who) => g.eval((w) => { const G = window.__G; G.DL = null; G.talkNPC(w); for (let i = 0; i < 6 && G.DL && !G.DL.optOn; i++) G.advance(); return G.DL ? G.DL.opts.map((o) => o.l) : []; }, who);

test('an inn opens the chest; a sword and wood go in and come back out', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const S = window.__G.S; S.mats.wood = 7; });
    const o = await talk(g, 'inn');
    const i = o.findIndex((l) => /Storage chest/.test(l));
    assert.ok(i >= 0, o.join(' | '));
    await g.eval((i) => window.__G.pickOpt(i), i);
    assert.equal(await g.eval(() => [window.__G.mode, document.getElementById('invH').textContent].join()), 'inv,Storage');
    const put = (k) => g.eval((k) => { const B = window.__G.bag(); const j = B.INVS.findIndex((s) => s.k === k && !s.eq); if (j < 0) return 'none'; B.invClick(j, false); return 'ok'; }, k);
    // a spare iron sword
    await g.eval(() => { const G = window.__G, S = G.S; S.items.push({ uid: ++S.uid, id: 'isword', slot: 'w', r: 1, dur: 100, atk: 20, spd: .4 }); window.__G.bag().invClick(-1); });
    await g.page.keyboard.press('KeyI'); await g.page.keyboard.press('KeyI'); // nothing else is open: stays a plain bag
    await g.eval(() => { const G = window.__G; G.DL = null; }); await talk(g, 'inn');
    await g.eval(() => { const G = window.__G; G.pickOpt(G.DL.opts.findIndex((o) => /Storage chest/.test(o.l))); });
    assert.equal(await put('wood'), 'ok');
    const n0 = await g.eval(() => window.__G.S.items.length);
    assert.equal(await put('isword'), 'ok');
    const a = await g.eval(() => ({ st: window.__G.S.stash.map((o) => o.it ? o.it.id : o.k + o.n), wood: window.__G.S.mats.wood || 0, items: window.__G.S.items.length }));
    assert.deepEqual(a.st.sort(), ['isword', 'wood7']);
    assert.equal(a.wood, 0); assert.equal(a.items, n0 - 1);
    // the chest side, Shift-click takes one wood back
    await g.eval(() => document.querySelector('[data-stside="st"]').click());
    await g.eval(() => { const B = window.__G.bag(); B.invClick(B.INVS.findIndex((s) => s.k === 'wood'), true); });
    assert.equal(await g.eval(() => window.__G.S.mats.wood), 1);
    await g.eval(() => { const B = window.__G.bag(); B.invClick(B.INVS.findIndex((s) => s.k === 'isword'), false); });
    assert.equal(await g.eval(() => window.__G.S.items.length), n0);
    // walking away closes it
    await g.eval(() => { window.__G.P.x += 400; }); await g.step(2);
    assert.equal(await g.eval(() => document.getElementById('inv').hidden), true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// Lifesteal works for a mage's skills too (owner 2026-10-22: a Braham mage had it and never healed)
test('the Vampire ring heals on a skill hit', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G, S = G.S; S.lv = 200; S.items.push({ uid: ++S.uid, id: 'vring', slot: 'k', r: 3, dur: 100, dm: .06 }); });
    await g.page.keyboard.press('KeyI');
    await g.eval(() => { const B = window.__G.bag(); B.invClick(B.INVS.findIndex((s) => s.k === 'vring'), false); });
    await g.page.keyboard.press('KeyI');
    const r = await g.eval(() => { const G = window.__G, P = G.P; const m = G.spawnMon('slime', P.x + 20, P.y); m.max = m.hp = 1e9; m.tmp = 1;
      P.hp = 10; P.vampT = 0; window.__GWP.hitS(m, 1); return P.hp; });
    assert.ok(r > 10, 'a skill hit healed: ' + r);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
