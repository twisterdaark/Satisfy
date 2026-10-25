'use strict';
// The Index (v2.97; the player Suki, through the owner 2026-10-25): N opens it; the trainers but no legendary or hidden
// teacher, the classes and their skills (the hidden and legendary ones locked unless you hold one of their kind), the drops
// that matter (no plain materials, no potions), the gems, smithing and magic.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('N opens and closes it; the trainers, the classes with their skills, hidden and legendary ones locked', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(5);
    await g.page.keyboard.press('KeyN'); await g.step(2);
    const m1 = await g.eval(() => window.__G.mode);
    await g.page.keyboard.press('KeyN'); await g.step(2);
    const m2 = await g.eval(() => window.__G.mode);
    await g.page.keyboard.press('KeyN'); await g.step(2); await g.page.keyboard.press('Escape'); await g.step(2);
    const m3 = await g.eval(() => window.__G.mode);
    assert.deepEqual([m1, m2, m3], ['idx', 'play', 'play']);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GIX, o = {};
      X.open(); o.ask = X.ask();
      // the Monster Book is its monsters' page (owner 2026-10-25)
      X.tab('mon'); o.mon = [document.getElementById('mbW').hidden, document.getElementById('ixG').hidden, document.getElementById('mbSum').textContent.length > 0];
      X.tab('tr'); o.mon2 = [document.getElementById('mbW').hidden, document.getElementById('ixG').hidden];
      X.tab('tr'); o.tr = X.cards();
      const D = X.data(); o.trCls = D.T.flatMap((t) => t.cls.map((c) => c.k)); o.sys = D.T.some((t) => t.id === 'sys');
      X.tab('cls'); o.cls = X.cards();
      X.tab('cls', 'mage'); o.mage = X.det();
      X.tab('cls', 'lock_leg'); o.lockLeg = X.det();
      o.legSeen = ['pagma', 'braham', 'saint'].map((c) => X.see(c)); o.hidSeen = X.see('aura');
      G.S.cls = 'pagma'; X.tab('cls'); o.clsLeg = X.cards(); o.legSeen2 = ['braham', 'saint', 'dslayer'].map((c) => X.see(c)); o.hidSeen2 = X.see('aura');
      G.S.cls = 'aura'; X.tab('cls'); o.clsHid = X.cards(); o.hidSeen3 = [X.see('orator'), X.see('braham')];
      G.S.cls = 'novice'; X.close(); o.mode = G.mode;
      return o;
    });
    assert.equal(r.ask, false);
    assert.deepEqual(r.mon, [false, true, true], 'the monsters page'); assert.deepEqual(r.mon2, [true, false]);
    for (const id of ['khan', 'tw', 'tk', 'ta', 'tm', 'cassus', 'hood', 'nec', 'fisher', 'eliz']) assert.ok(r.tr.includes(id), 'trainer ' + id);
    assert.equal(r.sys, false, 'no hidden offer as a trainer'); assert.ok(r.trCls.length > 20 && r.trCls.every((k) => k === 'base' || k === 'adv'), 'trainers teach base and advanced classes only');
    for (const id of ['smith', 'warrior', 'mage', 'knight', 'bmage', 'lock_hid', 'lock_leg']) assert.ok(r.cls.includes(id), 'class card ' + id);
    for (const id of ['pagma', 'braham', 'saint', 'aura', 'orator']) assert.ok(!r.cls.includes(id), 'locked from a novice: ' + id);
    assert.match(r.mage, /Magician/); assert.match(r.mage, /Fireball/); assert.match(r.mage, /Magic Instructor/); assert.match(r.mage, /Staff/);
    assert.match(r.lockLeg, /for you to find/);
    assert.deepEqual(r.legSeen, [false, false, false]); assert.equal(r.hidSeen, false);
    assert.ok(r.clsLeg.includes('braham') && r.clsLeg.includes('saint') && !r.clsLeg.includes('lock_leg'), 'a legendary class holder sees the others');
    assert.deepEqual(r.legSeen2, [true, true, true]); assert.equal(r.hidSeen2, false, 'but not the hidden ones');
    assert.ok(r.clsHid.includes('orator') && r.clsHid.includes('lock_leg') && !r.clsHid.includes('lock_hid'), 'a hidden class holder sees the hidden ones');
    assert.deepEqual(r.hidSeen3, [true, false]);
    assert.equal(r.mode, 'play');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the drops that matter, the gems, smithing and magic', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(5);
    const r = await g.eval(() => {
      const X = window.__GIX, o = {};
      X.open();
      X.tab('drop'); X.filt('gear'); o.gear = X.cards();
      X.tab('drop', 'iyarugt'); o.iya0 = X.det(); window.__G.S.kills.ypriest = 1; X.tab('drop', 'iyarugt'); o.iya = X.det();
      X.tab('drop', 'vring'); o.vring = X.det();
      X.filt('mat'); o.mat = X.cards();
      X.tab('gem'); o.gem = X.cards(); o.gemG = X.det();
      X.tab('smith'); o.sm = X.cards(); o.smG = X.det();
      X.tab('smith', 'rpbow'); o.rp = X.det(); o.rq = [X.req('rpbow'), X.req('isword'), X.req('iyarugt'), X.req('oakst'), X.req('sqfbow')];
      X.tab('smith', 'sqfbow'); o.sq = X.det(); X.tab('cls', 'dupl'); o.dupl = X.det(); X.tab('tr', 'tm'); o.tm = X.det();
      X.tab('drop'); X.filt('mat'); o.mat0 = X.cards()[0]; X.tab('drop', 'xtra'); X.filt('mat'); o.xtra = X.det();
      X.tab('mag'); o.mag = X.cards(); o.magG = X.det();
      o.odds = [X.odds({ k: 'ypriest', p: 0.25, nm: 1 }), X.odds({ k: 'hydra', p: 22, nm: 0 }), X.odds({ k: 'hydra', p: 0.5, nm: 0 }), X.odds({ k: 'hydra', p: 3, nm: 0 }), X.odds({ k: 'hydra', p: 5, nm: 0 })];
      // the search
      X.tab('drop'); X.filt('gear'); const q = document.getElementById('ixQ'); q.value = 'iyar'; q.dispatchEvent(new Event('input')); o.q = X.cards();
      X.close();
      return o;
    });
    for (const id of ['iyarugt', 'vring', 'dpgs', 'ochelm']) assert.ok(r.gear.includes(id), 'gear ' + id);
    assert.doesNotMatch(r.iya0, /High Priest of Yatan/, 'a monster not met is ???'); assert.match(r.iya0, /\?\?\? Lv 200/);
    assert.match(r.iya, /High Priest of Yatan/); assert.match(r.iya, /25%/);
    assert.match(r.vring, /High Priest of Yatan[^%]*11%/, 'the second named drop after the first missed: 15% x 75%');
    assert.ok(!r.gear.includes('vipdag'), 'none from a monster only an event or a siege brings');
    assert.equal(r.mat0, 'xtra'); assert.match(r.xtra, /once a day/); assert.match(r.xtra, /Return Scroll/);
    for (const id of ['mith', 'blue', 'mstone', 'dscale']) assert.ok(r.mat.includes(id), 'material ' + id);
    for (const id of ['wood', 'ore', 'leather', 'herb', 'ruby', 'diam', 'hpot', 'mpot']) assert.ok(!r.mat.includes(id) && !r.gear.includes(id), 'not filler: ' + id);
    assert.deepEqual(r.gem, ['guide', 'ruby', 'topaz', 'emer', 'sapph', 'diam', 'thund']); assert.match(r.gemG, /500 gold/);
    assert.equal(r.sm[0], 'guide'); assert.ok(r.sm.includes('isword') && r.sm.includes('rpbow') && !r.sm.includes('oakst') && !r.sm.includes('pgwork'), 'only what can be made');
    assert.match(r.smG, /Khan/); assert.match(r.rp, /Smithing 9/); assert.match(r.rp, /Blacksmiths only/);
    assert.deepEqual(r.rq[0], { sm: 9, bs: 1 }); assert.deepEqual(r.rq[1], { q: 'kh3' }); assert.equal(r.rq[2].und, 1); assert.equal(r.rq[3], null);
    assert.deepEqual(r.rq[4], { sm: 7, bs: 1, mk: ['mbow', 'mgbow'], mkn: 3 }); assert.match(r.sq, /after making 3: Mithril Bow or /);
    assert.doesNotMatch(r.dupl + r.tm, /Explosion Sorcerer/, 'a hidden class is not named');
    assert.ok(r.mag[0] === 'guide' && r.mag.includes('mage') && r.mag.includes('warlock') && !r.mag.includes('warrior'));
    assert.match(r.magG, /INT/); assert.match(r.magG, /Red Phoenix/);
    assert.deepEqual(r.odds, ['25%', '×6–11', '75%', '×1', '×1–2']);
    assert.deepEqual(r.q, ['iyarugt']);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('closing it leaves a dialog or death alone; death hides it; the key box opens and closes it', async () => {
  const g = await H.openGame({ query: '?touch=1' });
  try {
    await H.newGame(g, LOOK);
    await g.step(5);
    const r = await g.eval(() => { const G = window.__G, X = window.__GIX, o = {}, k = document.getElementById('kN');
      k.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })); o.tap1 = G.mode;
      k.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })); o.tap2 = G.mode;
      X.open(); window.__GUND.hurt(1e9, 1); o.dead = [G.mode, document.getElementById('ixW').hidden];
      X.close(); o.after = G.mode;
      return o; });
    assert.deepEqual(r, { tap1: 'idx', tap2: 'play', dead: ['dead', true], after: 'dead' });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
