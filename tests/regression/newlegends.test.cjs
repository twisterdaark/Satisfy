'use strict';
// The new legends from the novel (legends/other-legends.md): Lantier through Doran and a duel with Bain, the Bow Saint
// after Povia's offer and a battle won against a legend, Tzudan's Successor from the diary in the Giants' Land, and
// Mumud's Successor from his spellbook and his freed lich. Each one starts over at level 1 and is one per world.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Faker', hair: 1, hc: 2, skin: 1, top: 3 };
const pick = (g, re) => g.eval((src) => { const o = window.__G.DL.opts.find((x) => new RegExp(src).test(x.l)); if (!o) return window.__G.DL.opts.map((x) => x.l).join('|'); o.f(); return 'ok'; }, re.source);

test('Lantier: Doran asks a thief of level 150, Bain is beaten in a duel, and the class starts over with its poison', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, L = window.__GLG, out = {};
      S.cls = 'warrior'; out.war = L.ltOpts().length;
      S.cls = 'thief'; S.lv = 150; L.ltOpts()[0].f(); return out; });
    assert.equal(r.war, 0, 'Doran only asks the thieves');
    assert.equal(await pick(g, /Accept|قبول|اقبل/), 'ok');
    const d = await g.eval(() => { const G = window.__G, S = G.S, L = window.__GLG; const q = S.ltq; L.ltDuel(); const m = G.mons().find((x) => x.lgq === 'lantier'); return { q, m: !!m, spar: !!m && !!m.spar }; });
    assert.deepEqual(d, { q: 1, m: true, spar: true });
    await g.eval(() => window.__GLG.won('lantier'));
    assert.equal(await pick(g, /^(Use|Yes|استخدم|نعم)/), 'ok');
    const c = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, A = window.__GSKF;
      const out = { cls: S.cls, lv: S.lv, croot: S.croot, rec: !!(G.WS ? G.WS.legends : 1) };
      G.isk.checkSkills(); out.sk = ['ltmoon', 'ltpois', 'ltshade', 'ltsold'].filter((k) => S.sk[k]);
      for (const m of G.mons()) m.dead = true;
      const m = G.spawnMon('wolf', P.x + 20, P.y); m.max = m.hp = 1e7; m.tmp = 0;
      P.mp = 1e6; A.cast('ltpois'); out.poisoned = window.__GLG.LTP.length; out.hp0 = m.hp; window.__mm = m; return out; });
    assert.equal(c.cls, 'lantier'); assert.equal(c.lv, 1); assert.equal(c.croot, 'thief');
    assert.deepEqual(c.sk, ['ltmoon', 'ltpois']);
    assert.equal(c.poisoned, 1);
    await g.step(120);
    assert.ok(await g.eval(() => window.__mm.hp) < c.hp0, 'the poison ticks');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Bow Saint, Tzudan and Mumud: the offer, the diary and the spellbook each lead to their class', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    // Bow Saint: an archer of 150 gets Povia's offer once per level; a death knight beaten after it makes him the Bow Saint
    await g.eval(() => { const S = window.__G.S; S.cls = 'archer'; S.lv = 150; window.__GLG.bsOffer(); });
    assert.equal(await pick(g, /Accept|قبول|اقبل/), 'ok');
    await g.eval(() => { const G = window.__G, P = G.P; const m = G.spawnMon('wolf', P.x + 30, P.y); m.type = 'dk_povia'; window.__GLG.kill(m); });
    await new Promise((r) => setTimeout(r, 900));
    assert.equal(await pick(g, /^(Use|Yes|استخدم|نعم)/), 'ok');
    const b = await g.eval(() => { const G = window.__G, S = G.S; G.isk.checkSkills(); return { cls: S.cls, lv: S.lv, ev: !!S.sk.bsevil, lock: !!S.sk.bslock, fam: Object.keys(S.sk).filter((k) => k !== 'bsevil' && k !== 'bslock' && k !== 'bsclair').length }; });
    assert.equal(b.cls, 'bowsaint'); assert.equal(b.lv, 1); assert.ok(b.ev && b.lock);
    // Tzudan: a great demon slain at 150 opens the quest, the Giants' Land gives the diary, a warrior reads it
    const t = await g.eval(() => { const G = window.__G, S = G.S, L = window.__GLG; S.cls = 'warrior'; S.lv = 160; S.tzq = 0;
      const m = G.spawnMon('wolf', G.P.x + 30, G.P.y); m.type = 'belial'; L.kill(m); const q = S.tzq; S.tzq = 2; S.mats.tzbook = 1; L.tzUse(); return { q }; });
    assert.equal(t.q, 1);
    assert.equal(await pick(g, /^(Use|Yes|استخدم|نعم)/), 'ok');
    const tz = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, L = window.__GLG; G.isk.checkSkills();
      const out = { cls: S.cls, five: !!S.sk.tzfive, book: S.mats.tzbook };
      P.tz5 = 2; const m = G.spawnMon('wolf', P.x + 20, P.y); m.lv = 300; out.mul = L.tzHit(m, 100, {}); out.after = L.tzHit(m, 100, {}); return out; });
    assert.equal(tz.cls, 'tzudan'); assert.ok(tz.five); assert.equal(tz.book, 0);
    assert.ok(tz.mul > 200, 'five steps in a row make the blow double and true: ' + tz.mul); assert.equal(tz.after, 100);
    // Mumud: a mage reads the spellbook, frees the lich, and becomes Mumud's Successor
    for (let i = 0; i < 6 && await g.eval(() => window.__G.mode) === 'dialog'; i++) { await g.page.keyboard.press('Escape'); await g.step(2); }   // Tzudan's lines are still open
    await g.eval(() => { const S = window.__G.S; delete window.__G.WS; S.cls = 'mage'; S.lv = 200; S.mmq = 0; S.mats.mumbk = 1; window.__GLG.mmUse(); });
    const q = await g.eval(() => window.__G.S.mmq);
    assert.equal(q, 1);
    await g.eval(() => { const G = window.__G, m = G.spawnMon('wraith', G.P.x + 30, G.P.y); m.mlich = 1; window.__GLG.kill(m); });
    await new Promise((r) => setTimeout(r, 900));
    assert.equal(await pick(g, /^(Use|Yes|استخدم|نعم)/), 'ok');
    const mm = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, A = window.__GSKF; G.isk.checkSkills();
      for (const m of G.mons()) m.dead = true; const m = G.spawnMon('wolf', P.x + 30, P.y); m.max = m.hp = 1e7; m.tmp = 0;
      P.mp = 1e6; A.cast('mmwater'); return { cls: S.cls, sk: ['mmwater', 'mmnull', 'mmreint'].filter((k) => S.sk[k]), hit: 1e7 - m.hp }; });
    assert.equal(mm.cls, 'mumud'); assert.deepEqual(mm.sk, ['mmwater', 'mmnull', 'mmreint']); assert.ok(mm.hit > 0);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
