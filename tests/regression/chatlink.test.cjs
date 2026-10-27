'use strict';
// Chat links (owner 2026-10-27, "like League of Legends"): a piece from the bag, a stack or a quest goes into the chat as a
// tag; the other player sees its name and, hovering it, its details (a piece's passives and maker ride in the sender's fx).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) { for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); } }
async function until(g, fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
const links = (g) => g.eval(() => [...document.querySelectorAll('#chatL span.lnk')].map((s) => ({ c: s.className, t: s.textContent, tip: s.dataset.tip })));

test('a linked piece, stack and quest show their details to the other player', async () => {
  const ctx = await H.newContext({});
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await a.page.keyboard.press('KeyP'); await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY'); await settle(a, b);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    // the bag's 💬 mode: a click puts the piece in the chat line
    await a.eval(() => { const it = window.__GSH.mk('isword', 3); it.en = 5; it.by = 'Grid'; window.__G.S.items.push(it); window.__LNKIT = it; });
    await a.page.keyboard.press('KeyI'); await a.step(2);
    await a.page.click('#invLnk'); await a.step(2);
    const slot = await a.eval(() => window.__G.bag().INVS.findIndex((s) => s.it === window.__LNKIT));
    await a.page.click(`[data-inv="${slot}"]`); await a.step(2);
    await a.page.click('#invLnk'); await a.page.keyboard.press('Escape'); await a.step(2);
    const put = await a.eval(() => { window.__GLNK.item({ k: 'mith' }); window.__GLNK.quest('rg1');
      return { v: document.getElementById('chatIn').value, pub: window.__GLNK.pub().slice(0, 40) }; });
    assert.match(put.v, /^\[i:isword\.3\.5\.[a-z0-9]+\] \[m:mith\] \[q:rg1\] $/, put.v);
    assert.match(put.pub, /^ln:[a-z0-9]+~\{/, 'the full piece rides in the fx');
    await a.page.keyboard.type('look');
    await a.page.keyboard.press('Enter');
    await settle(a, b);
    await until(b, () => document.querySelectorAll('#chatL span.lnk').length === 3);
    let L = await links(b);
    for (let i = 0; i < 20 && /lnkBase|online/.test(L[0].tip); i++) { await settle(a, b); L = await links(b); }
    assert.match(L[0].t, /^\[.+ ‪\+5‬\]$/, 'the piece by its name and plus: ' + L[0].t);
    assert.match(L[0].c, /rt rt3/, 'in its rating colour');
    assert.match(L[0].tip, /Grid/, 'the maker, from the full piece: ' + L[0].tip.slice(0, 200));
    assert.match(L[1].t, /^\[.+\]$/); assert.match(L[1].c, /\bm\b/);
    assert.match(L[2].t, /^\[📜 /); assert.match(L[2].tip, /Regas|ريجاس/, 'the quest giver');
    assert.match(await b.eval(() => document.querySelector('#chatL div:not(.sys)').textContent), /look$/, 'the words after the links');
    // without the sender's presence the tag still names the piece
    const base = await b.eval(() => window.__GLNK.of('i', 'isword.2.0.zz', 'nobody'));
    assert.match(base[1], /not online|مش أونلاين/); assert.equal(base[2], 'rt rt2');
    assert.equal(await b.eval(() => window.__GLNK.of('i', 'nosuch.2.0.zz', 'nobody')), null, 'an unknown piece is plain text');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
