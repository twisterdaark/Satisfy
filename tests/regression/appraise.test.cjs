'use strict';
// Appraisal and hidden functions (v1.03): gear above Normal and every boss's named item is unappraised until someone
// looks. Only Pagma's Successor appraises, free at the anvil (owner 2026-10-22; smithies and plain blacksmiths no longer); the answer is the novel's "[A hidden function
// doesn't exist.]" or "[This item has a hidden function.]", and a found function works only once it is known.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
const give = (g, id, r) => g.eval(([id, r]) => { const G = window.__G, it = G.eqx.mkItem(id, r); G.S.items.push(it); return it.uid; }, [id, r]);

test('only Pagma\'s Successor: others are refused; at the anvil the bag opens to appraise, free, and the item says what was found', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const uid = await give(g, 'isword', 2);
    const n = await g.eval((uid) => { const G = window.__G, it = G.S.items.find((i) => i.uid === uid); return { need: window.__GAP.need(it), n0: window.__GAP.need(G.eqx.mkItem('isword', 0)), fee: window.__GAP.fee(it, 'anvil'), tip: window.__GAP.tip(it) }; }, uid);
    assert.equal(n.need, true); assert.equal(n.n0, false, 'a Normal item has nothing to appraise');
    assert.equal(n.fee, 0);
    assert.match(n.tip, /Unappraised/);
    // a warrior can't open it, at a smith or at the anvil
    await g.eval(() => { window.__G.S.cls = 'warrior'; window.__GAP.open('khan'); window.__GAP.open('anvil'); });
    assert.equal(await g.eval(() => document.getElementById('inv').hidden), true);
    assert.match(await toasts(g), /Only Pagma's Successor can appraise items/);
    await g.eval(() => { window.__G.S.cls = 'pagma'; window.__G.S.gold = 5000; window.__GAP.open('anvil'); });
    await g.step(1);
    assert.match(await g.eval(() => document.getElementById('invH').textContent), /Appraise items/);
    const i = await g.eval((uid) => window.__G.bag().INVS.findIndex((s) => s.it && s.it.uid === uid), uid);
    assert.match(await g.eval((i) => window.__G.bag().INVS[i].tip, i), /Click to appraise/);
    await g.eval((i) => window.__GSV.inv(i), i);
    await g.page.waitForTimeout(500);
    const r = await g.eval((uid) => { const G = window.__G, it = G.S.items.find((i) => i.uid === uid); return { apr: it.apr, hid: it.hid || null, gold: G.S.gold, tip: window.__GAP.tip(it) }; }, uid);
    assert.equal(r.apr, 1); assert.equal(r.gold, 5000);
    assert.doesNotMatch(r.tip, /Unappraised/);
    if (r.hid) { assert.match(await toasts(g), /\[This item has a hidden function\.\].*\[The information of Iron Sword has been updated\.\]/); assert.match(r.tip, /Hidden function: /); }
    else assert.match(await toasts(g), /\[A hidden function doesn't exist\.\]/);
    // once is enough
    await g.eval((i) => window.__GSV.inv(i), i);
    assert.match(await toasts(g), /already been appraised/);
    assert.equal(await g.eval(() => window.__G.S.gold), 5000);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a hidden function works only once it is known; only Pagma\'s Successor appraises, for free, and learns named items', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // of many Legendary swords some hide a function, and each one is in range for its kind
    const s = await g.eval(() => { const G = window.__G, out = []; G.S.cls = 'pagma'; for (let k = 0; k < 40; k++) { const it = G.eqx.mkItem('isword', 4); G.S.items.push(it); window.__GAP.doApr(it, 'anvil'); if (it.hid) out.push(it.hid); } return out; });
    assert.ok(s.length >= 8 && s.length <= 36, String(s.length));
    for (const h of s) {
      if (h.k === 'hpp') assert.ok(h.v > 0 && h.v <= .12, JSON.stringify(h));
      else if (h.k === 'as') assert.ok(h.v > 0 && h.v <= .09, JSON.stringify(h));
      else assert.ok(Number.isInteger(h.v) && h.v >= 1 && h.v <= 63, JSON.stringify(h));
    }
    const w = await g.eval(() => { const G = window.__G, X = G.eqx, it = X.mkItem('isword', 3); G.S.items.push(it); it.hid = { k: 'str', v: 7 }; const s0 = window.__GSET.stat('str'); X.equip(it); const s1 = window.__GSET.stat('str'); return [s1 - s0, window.__GAP.tip(it)]; });
    assert.equal(w[0], 7);
    assert.match(w[1], /★ Hidden function: Strength \+7/);
    // a traded item keeps its known hidden function (capped), and nothing else rides along in it
    const tr = await g.eval(() => [window.__GAP.tin(JSON.stringify({ id: 'isword', r: 3, apr: 1, hid: { k: 'str', v: 7 } })).hid, window.__GAP.tin(JSON.stringify({ id: 'isword', r: 3, hid: { k: 'atk', v: 9 } })).hid || null, window.__GAP.tin(JSON.stringify({ id: 'isword', r: 3, hid: { k: 'hpp', v: 5 } })).hid]);
    assert.deepEqual(tr, [{ k: 'str', v: 7 }, null, { k: 'hpp', v: .12 }]);
    // the anvil's Appraise button is Pagma's Successor's only (owner 2026-10-22): not a warrior's, not even a blacksmith's
    for (const c of ['warrior', 'smith']) assert.equal(await g.eval((c) => { window.__G.S.cls = c; window.__GTC.openForge(); const b = !!document.querySelector('[data-act="fApr"]'); window.__GTC.closeForge(); return b; }, c), false, c);
    assert.equal(await g.eval(() => { const G = window.__G; G.S.cls = 'smith'; const it = G.eqx.mkItem('isword', 3); G.S.items.push(it); return window.__GAP.doApr(it, 'anvil'); }), null);
    // the toasts from here on, as they appear (the forty appraisals above fill the toast box for a while; QA)
    await g.eval(() => { window.__toastNew = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) window.__toastNew.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); });
    const u = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'pagma'; const it = G.eqx.mkItem('ochelm', 0); S.items.push(it); const n = window.__GAP.need(it), f = window.__GAP.fee(it, 'anvil'); window.__GAP.doApr(it, 'anvil'); return [n, f, window.__GSV.undOf('ochelm')]; });
    assert.deepEqual(u, [true, 0, 17]);
    for (let i = 0; i < 40 && !(await g.eval(() => window.__toastNew.some((x) => /Your understanding of Frostlight Orc Chief.s Helmet is now 17%/.test(x)))); i++) { await g.step(3); await g.page.waitForTimeout(100); }
    assert.ok(await g.eval(() => window.__toastNew.some((x) => /Your understanding of Frostlight Orc Chief.s Helmet is now 17%/.test(x))), 'told: ' + JSON.stringify(await g.eval(() => window.__toastNew)));
    assert.equal(await g.eval(() => { window.__GTC.openForge(); return !!document.querySelector('[data-act="fApr"]'); }), true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
