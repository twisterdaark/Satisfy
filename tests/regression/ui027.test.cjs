'use strict';
// SAT-ONLINE-027 (owner feedback #2, #11, #16, #17; #6 and #9 are in chat/playermenu): the chat has its own corner, the
// big map shows party members, "Online as …" opens the account panel, and a player can hide its level.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(6);
    await games[0].page.waitForTimeout(30);
  }
}
const inParty = () => ((Satisfy.local.net().party || {}).members || []).length === 2;
async function party(a, b) {
  await a.page.keyboard.press('KeyP');
  await settle(a, b);
  await until([b], () => !document.getElementById('partyInv').hidden);
  await b.page.keyboard.press('KeyY');
  await until([a, b], inParty);
}

test('chat sits in its own corner (not under the party panel or the key hints); the big map shows party members', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await party(a, b);
    await a.page.keyboard.press('Enter');
    await a.page.keyboard.type('hello');
    await a.page.keyboard.press('Enter');
    await settle(a, b);
    const box = await a.eval(() => {
      const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      return { inRcol: document.getElementById('rcol').contains(document.getElementById('chatW')), chat: r('chatW'), keys: r('keys'), party: r('partyW'), hidden: document.getElementById('chatW').hidden };
    });
    const hit = (p, q) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;
    assert.equal(box.hidden, false);
    assert.equal(box.inRcol, false, 'not stacked under the party panel any more');
    assert.equal(hit(box.chat, box.keys), false, 'the key hints do not cover it: ' + JSON.stringify(box));
    assert.equal(hit(box.chat, box.party), false);

    // B walks far away; A opens the big map: B is on it with its name
    await b.eval(() => { window.__G.P.x += 1500; });
    await settle(a, b);
    await a.page.keyboard.press('KeyM');
    await a.step(40);
    assert.equal(await a.eval(() => window.__G.mode), 'map');
    const marks = await a.eval(() => Satisfy.local.net().mapParty);
    const bx = await b.eval(() => window.__G.P.x / 16);
    assert.equal(marks.length, 1);
    assert.equal(marks[0].handle, 'Faker');
    assert.ok(Math.abs(marks[0].x - bx) < 1, JSON.stringify(marks) + ' vs ' + bx);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('online: "Online as …" opens the account panel; "Hide my level" shows others "Lv ?"', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
    for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem']]) {
      await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    }
    // the signed-in title button now does something: it opens the account panel
    assert.match(await b.eval(() => document.getElementById('onlineBtn').textContent), /Bassem/);
    await b.eval(() => document.getElementById('onlineBtn').click());
    await b.step(3);
    assert.equal(await b.eval(() => document.getElementById('cloudW').hidden), false);
    await b.eval(() => document.getElementById('hideLvBtn').click());
    await b.step(3);
    assert.equal(await b.eval(() => localStorage.getItem('satisfy_hidelv')), '1');
    assert.equal(await b.eval(() => document.getElementById('hideLvBtn').textContent), 'Show my level to others');
    await b.eval(() => { document.getElementById('cloudW').hidden = true; });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b); await settle(a, b);
    const rb = (await a.eval(() => Satisfy.local.net().remotes)).find((r) => r.handle === 'Faker');
    assert.equal(rb.lv, 0, 'no level in presence');
    const p = await a.eval((x) => window.__G.toScreen(x.x, x.y - 10), rb);
    await a.page.mouse.click(p.x, p.y, { button: 'right' });
    await a.step(3);
    assert.match(await a.eval(() => document.getElementById('pctxI').textContent), /^Lv \?/);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
