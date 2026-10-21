'use strict';
// The monster encyclopedia (v1.21): B opens a page for every monster. The first kill opens its page (name, level,
// strength), more kills show its drops, and enough kills master it: +3% damage to it and -3% damage from it
// (6% with the Monster Scholar title). Kills are the player's own save, so online and offline work the same.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));

test('the book: B opens it, unknown pages stay dark, kills fill a page and master it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const S = window.__G.S; S.kills = { wolf: 12, goblin: 100, trauka: 1, sdrag: 1, belial: 1, berith: 1 }; });
    await g.page.keyboard.press('KeyB');
    await g.step(2);
    assert.equal(await g.eval(() => window.__G.mode), 'mb');
    const L = await g.eval(() => window.__GMB.list().length);
    assert.ok(L >= 90, 'pages ' + L);
    assert.match(await g.eval(() => document.getElementById('mbSum').textContent), new RegExp(`Discovered 6/${L} · Mastered 5 · Mastery: \\+3% damage`));
    // a wolf with 12 kills shows its drops but is not mastered; a goblin at 100 is
    const w = await g.eval(() => { window.__GMB.sel('wolf'); return document.getElementById('mbD').textContent; });
    assert.match(w, /Grey Wolf[\s\S]*Level \d+[\s\S]*HP [\d,]+ · Damage [\d,]+[\s\S]*Kills 12\/100 to master/);
    assert.doesNotMatch(w, /drops show after/);
    assert.match(await g.eval(() => { window.__GMB.sel('goblin'); return document.getElementById('mbD').textContent; }), /Mastered: \+3% damage, −3% damage taken/);
    // a monster never killed is ??? with a dark portrait
    const u = await g.eval(() => { window.__GMB.sel('kking'); return [document.getElementById('mbD').textContent, document.querySelector('.mbc.sel').classList.contains('un')]; });
    assert.match(u[0], /\?\?\?[\s\S]*Defeat it once/); assert.equal(u[1], true);
    // every monster gets a portrait, the big ones included, and drawing them leaves no errors
    const pics = await g.eval(() => window.__GMB.list().filter((k) => !window.__GMB.pic(k)));
    assert.deepEqual(pics, []);
    // the filters
    assert.equal(await g.eval(() => { window.__GMB.filt('ms'); return document.querySelectorAll('.mbc').length; }), 5);
    assert.equal(await g.eval(() => { window.__GMB.filt('seen'); return document.querySelectorAll('.mbc').length; }), 6);
    await g.page.click('#mbF [data-mbf="boss"]');
    assert.ok(await g.eval(() => [...document.querySelectorAll('.mbc')].every((c) => window.__GMB.MT[c.dataset.mb].boss)));
    if (process.env.SHOT) { await g.eval(() => window.__GMB.filt('all')); await g.page.click('.mbc[data-mb="sdrag"]'); await g.page.screenshot({ path: process.env.SHOT + '-mbook.png' }); }
    await g.page.keyboard.press('KeyB');
    await g.step(1);
    assert.equal(await g.eval(() => window.__G.mode), 'play');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('mastery: the toasts, the damage both ways, the achievements and the Monster Scholar title', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // the first kill opens the page, the hundredth masters it
    await g.eval(() => { const G = window.__G; G.S.kills = { wolf: 98 }; document.getElementById('toasts').innerHTML = ''; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
      for (const ty of ['rabbit', 'wolf', 'wolf']) { const m = G.spawnMon(ty, G.P.x + 30, G.P.y); m.tmp = 0; m.hp = 0; window.__GB2.kill(m); } });
    await g.step(2);
    const t = await toasts(g);
    assert.match(t, /New page in the Monster Encyclopedia: Wild Rabbit/);
    assert.match(t, /\[You have mastered Grey Wolf!\] \+3% damage to it, −3% damage from it/);
    const r = await g.eval(() => { const B = window.__GMB; return [B.atk({ type: 'wolf' }), B.atk({ type: 'rabbit' }), B.hurt(1000, { type: 'wolf' }), B.hurt(1000, { type: 'rabbit' }), B.hurt(1000, null)]; });
    assert.deepEqual(r, [1.03, 1, 970, 1000, 1000]);
    // 60 pages: two achievements and the title, which doubles mastery
    await g.eval(() => { const S = window.__G.S; S.kills = S.kills || {}; window.__GMB.list().slice(0, 60).forEach((k) => { S.kills[k] = Math.max(S.kills[k] || 0, 1); }); });
    for (let i = 0; i < 30 && !(await g.eval(() => window.__G.S.tl.mbook)); i++) await g.step(130);
    const a = await g.eval(() => { const S = window.__G.S; return [!!S.ach.mb30, !!S.ach.mb60, !!S.tl.mbook, window.__GMB.atk({ type: 'wolf' }), window.__GMB.hurt(1000, { type: 'wolf' })]; });
    assert.deepEqual(a, [true, true, true, 1.06, 940]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
