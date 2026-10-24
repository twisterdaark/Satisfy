'use strict';
// U249 Quest tracker (SAT-ONLINE-205; plan: "active + shared objectives and pin", checked by "progress doesn't vanish
// offline"): a party kill shared with you (near the kill, playing: the same as the party XP share) also counts once for your
// active quests that only ask to kill that monster; the quest panel marks those with 👥 while you are in a party; a quest
// that asks how (a weapon kind) doesn't count it; the count is the character's own, so it is still there after the
// connection drops and after a reload offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 8000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
const busy = (b) => b.eval(() => { window.__G.P.x += 1; });

test('a party kill counts for your plain kill quest, marked 👥, and stays offline', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    // the nearest monster that a plain kill quest asks for, with A and B on either side of it
    const m = await a.eval(() => {
      const G = window.__G, P = G.P, QD = G.QD, plain = (k) => Object.keys(QD).find((id) => window.__GQS.ok(id) && QD[id].obj.it === k);
      const how = (k) => Object.keys(QD).find((id) => QD[id].obj.t === 'kill' && QD[id].obj.it === k && QD[id].obj.wk);
      const M = G.mons().filter((x) => !x.dead && !x.tmp && !window.__GQS.boss(x.type) && plain(x.type));
      M.sort((p, q) => Math.hypot(p.x - P.x, p.y - P.y) - Math.hypot(q.x - P.x, q.y - P.y));
      const m = M[0]; window.__pm = m;
      return { x: m.x, y: m.y, type: m.type, q: plain(m.type), qh: how(m.type) || null };
    });
    assert.ok(m.q, 'a plain kill quest for ' + m.type);
    // B has the quest (and, when there is one, a quest for the same monster that asks for a weapon kind)
    await b.eval(([q, qh]) => { const S = window.__G.S; for (const k in S.qs) if (S.qs[k].st === 1) delete S.qs[k]; S.qs[q] = { st: 1, c: 0 }; if (qh) S.qs[qh] = { st: 1, c: 0 }; }, [m.q, m.qh]); // (only these on the panel)
    const mark = () => b.eval((q) => { const e = document.querySelector('#qtext .qi[data-qd="' + q + '"]'); return e ? !!e.querySelector('i.qsh') : null; }, m.q);
    await settle(a, b);
    assert.equal(await mark(), false, 'on the panel, no 👥 out of a party');
    // a party
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await settle(a, b);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    await until(b, (q) => { const e = document.querySelector('#qtext .qi[data-qd="' + q + '"]'); return !!e && !!e.querySelector('i.qsh'); }, 8000, m.q);
    if (m.qh) assert.equal(await b.eval((q) => !!document.querySelector('#qtext .qi[data-qd="' + q + '"] i.qsh'), m.qh), false, 'no 👥 on a quest that asks how');
    // to the monster: A and B on either side of it, nothing else around
    await a.eval(() => { const G = window.__G, P = G.P, m = window.__pm; P.x = m.x - 30; P.y = m.y; P.inv = 1e9; for (const o of G.mons()) if (o !== m && Math.hypot(o.x - m.x, o.y - m.y) < 500) { o.dead = true; o.rt = 1e9; } m.agg = 0; m.eng = 0; });
    await b.eval(([x, y]) => { const G = window.__G; G.P.x = x; G.P.y = y; G.P.inv = 1e9; for (const o of G.mons()) if (Math.hypot(o.x - x, o.y - y) < 500) { o.agg = 0; o.eng = 0; } }, [m.x + 30, m.y]);
    for (let i = 0; i < 3; i++) { await settle(a, b); await busy(b); }
    // A kills it; B, near and playing, gets one for the quest
    await settle(a, b); await busy(b); await settle(a, b);
    await a.eval(() => { const m = window.__pm; m.myd = m.max; m.hp = 0; window.__GB2.kill(m); });
    for (let i = 0; i < 6; i++) { await busy(b); await settle(a, b); }
    await b.page.waitForTimeout(1500);
    for (let i = 0; i < 2; i++) { await busy(b); await settle(a, b); }
    const qs = await b.eval(([q, qh]) => { const S = window.__G.S; return { c: S.qs[q].c, h: qh ? S.qs[qh].c : null }; }, [m.q, m.qh]);
    assert.equal(qs.c, 1, 'the shared kill counted once');
    if (m.qh) assert.equal(qs.h, 0, 'a quest that asks for a weapon kind does not count it');
    assert.equal(await a.eval((q) => (window.__G.S.qs[q] || {}).c || 0, m.q), 0, "A didn't have the quest: nothing for A");
    assert.deepEqual(a.errors, []);
    // the other player is gone (B plays on alone): B's count stays; through a reload too
    await a.page.close();
    for (let i = 0; i < 3; i++) await settle(b);
    assert.equal(await b.eval((q) => window.__G.S.qs[q].c, m.q), 1, 'kept when the party is gone');
    await b.eval(() => window.__G.save(true));
    await b.page.reload(); await b.step(2);
    await H.continueGame(b);
    assert.equal(await b.eval((q) => window.__G.S.qs[q].c, m.q), 1, 'kept through a reload');
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
