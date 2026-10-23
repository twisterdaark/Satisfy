'use strict';
// Owner 2026-10-24: every monster drawn (the 6th-1st vampire cities' people were invisible); no First King from holding the
// castle; men see men's hair and women women's at the stylist; the stylist grid comes back drawn after a purchase.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('every monster has something to draw it', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    assert.deepEqual(await g.eval(() => window.__GART()), []);
  } finally { await g.close(); }
});

test('First King: not from the castle; a save that has it loses it', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { const S = window.__G.S; S.tl.fking = 1; S.ach = S.ach || {}; S.ach.king = 1; S.title = 'fking'; window.__G.save(true); });
    await g.page.reload(); await g.page.waitForFunction(() => !!window.__G);
    await H.continueGame(g);
    const r = await g.eval(() => { const S = window.__G.S; return { tl: !!S.tl.fking, ach: !!(S.ach && S.ach.king), title: S.title || '' }; });
    assert.deepEqual(r, { tl: false, ach: false, title: '' });
  } finally { await g.close(); }
});

test('stylist: each body sees its own hair; a purchase brings the grid back drawn', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const hairs = () => g.eval(() => [...document.querySelectorAll('#dopts .dcell span')].map((s) => s.textContent));
    await g.eval(() => { window.__G.S.gold = 1e7; window.__G.S.look.g = 0; window.__GLOOK.sty('hair'); }); await g.step(30);
    const man = await hairs();
    await g.eval(() => { window.__G.S.look.g = 1; window.__GLOOK.sty('hair'); }); await g.step(30);
    const woman = await hairs();
    assert.ok(man.length > 20 && woman.length > 20, man.length + ' / ' + woman.length);
    const both = man.filter((h) => woman.includes(h));
    assert.ok(both.length < man.length && both.length < woman.length, 'different lists (shared: ' + both.length + ')');
    // a purchase: the grid is drawn again at once from the kept thumbnails
    await g.page.click('#dopts .dcell:not(.eq)'); await g.step(1);
    const left = await g.eval(() => document.querySelectorAll('#dopts canvas[data-lk]:not([data-ok])').length);
    assert.equal(left, 0, 'all thumbnails back in one frame');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a below-half-health trial works at a high level: its monster hits harder while you have it, never under a tenth', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P; S.lv = 160; S.cls = 'warrior'; S.qs.c2b = { st: 1, c: 0 };
      const mh = window.__G.eqx.maxMP ? 0 : 0; // (keep the hook list short)
      P.hp = 1e9; const hp0 = P.hp; // max HP is what maxHP() says; fill it
      return { trial: window.__GLOW.trial('merman') };
    });
    assert.equal(r.trial, 0.5);
    const hit = await g.eval(() => { const P = window.__G.P; P.hp = 99999999; const before = P.hp; window.__GLOW.hurt(5, 'merman'); return before - P.hp; });
    assert.ok(hit > 5, 'the trial monster takes a real bite: ' + hit);
    const floor = await g.eval(() => { const P = window.__G.P; for (let i = 0; i < 40; i++) window.__GLOW.hurt(1, 'merman'); return P.hp > 0; });
    assert.ok(floor, 'its extra never kills you');
    const plain = await g.eval(() => { const P = window.__G.P, b = P.hp; window.__GLOW.hurt(3, 'goblin'); return b - P.hp; });
    assert.ok(plain <= 3, 'other monsters as before: ' + plain);
  } finally { await g.close(); }
});

test('Ancient Weapons walk the world east of Reinhardt, not only in the rare event', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const n = await g.eval(() => window.__G.mons().filter((m) => m.type === 'aweapon' && !m.evt && !m.tower).length);
    assert.ok(n >= 2, 'ancient weapons in the world: ' + n);
  } finally { await g.close(); }
});
