'use strict';
// U286 Limited reroll (SAT-ONLINE-201; plan: "affix rerolls with escalating sinks", checked by "rates disclosed and audit
// logged"): a smith reforges one of a weapon's passives (◆), never a ★ found by appraisal;
//   - before paying, the dialog lists every passive the new one can be, each's odds and its strength range at this grade;
//   - gold and magic stones double each time; at most 5 times a weapon; refused without the stones or the gold;
//   - the weapon keeps its count (a trade carries it) and its last 5 reforges (what went, what came, when, for what);
//   - the new passive is never one the weapon already has on another line.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('reforging a passive: the odds first, doubling costs, five at most, the log kept', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    // a unique short sword with three passives, a ★ added as appraisal does
    const w = await g.eval(() => { const G = window.__G, S = G.S, K = G.isk; const it = K.mkItem('ssword', 3); it.wp.push({ k: 'push', v: 0.1, h: 1 }); S.items.push(it); S.gold = 1e6; S.mats.mstone = 100; S.lv = 60; return { uid: it.uid, wp: it.wp.map((p) => p.k) }; });
    assert.equal(w.wp.length, 3, 'two rolled passives and the ★');
    // the smith's services offer it
    let top = '';
    for (let k = 0; k < 4 && !/Reforge/.test(top); k++) { // (a quest offer first: "Not now", then talk again)
      await g.eval(() => { window.__G.DL = null; window.__G.talkNPC('smith'); }); await g.step(2);
      for (let i = 0; i < 6 && await g.eval(() => !document.querySelector('#dopts button')); i++) { await g.page.keyboard.press('Enter'); await g.step(2); }
      top = await g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent).join(' | '));
      if (/Not now/.test(top)) { await g.page.locator('#dopts button', { hasText: 'Not now' }).click(); await g.step(3); }
    }
    assert.match(top, /Reforge a passive/, top);
    const it = () => g.eval((u) => { const i = window.__G.S.items.find((x) => x.uid === u); return JSON.parse(JSON.stringify(i)); }, w.uid);
    // the odds, before paying
    const odds = await g.eval((u) => { const R = window.__GRR, i = window.__G.S.items.find((x) => x.uid === u); R.odds(i, 0, 'smith'); return { text: document.getElementById('dtext').textContent, kinds: R.kinds(i, 0) }; }, w.uid);
    assert.ok(odds.kinds.length >= 8, 'kinds: ' + odds.kinds.length);
    assert.ok(!odds.kinds.some((x) => x.k === w.wp[1] || x.k === 'push'), 'never a kind on another line (the ★ included)');
    assert.ok(odds.kinds.some((x) => x.k === w.wp[0]), 'the old kind may come back');
    assert.match(odds.text, new RegExp('one of these ' + odds.kinds.length + ', each ' + (Math.round(1000 / odds.kinds.length) / 10) + '% likely'));
    assert.ok(odds.kinds.every((x) => x.lo <= x.hi), 'ranges');
    assert.match(odds.text, /Damage on bosses \+\d+–\d+%|Damage \+\d+–\d+%|critical/i, 'ranges shown: ' + odds.text.slice(0, 200));
    // five reforges: the costs double, the ★ stays, no repeated kinds, the log keeps five
    const S0 = await g.eval(() => ({ g: window.__G.S.gold, m: window.__G.S.mats.mstone }));
    const paid = [];
    for (let k = 0; k < 5; k++) {
      const before = await g.eval(() => ({ g: window.__G.S.gold, m: window.__G.S.mats.mstone }));
      await g.eval(([u, n]) => { const i = window.__G.S.items.find((x) => x.uid === u); window.__GRR.go(i, n, 'smith'); }, [w.uid, k % 2]);
      const after = await g.eval(() => ({ g: window.__G.S.gold, m: window.__G.S.mats.mstone }));
      paid.push([before.g - after.g, before.m - after.m]);
      const i = await it();
      assert.equal(i.rr, k + 1);
      assert.equal(i.wp.length, 3);
      assert.deepEqual(i.wp[2], { k: 'push', v: 0.1, h: 1 }, 'the ★ stays');
      assert.equal(new Set(i.wp.map((p) => p.k)).size, 3, 'no kind twice: ' + i.wp.map((p) => p.k));
    }
    assert.deepEqual(paid.map((p) => p[0]), [1000, 2000, 4000, 8000, 16000], 'gold doubles (250 x (1 + unique) x 2^n)');
    assert.deepEqual(paid.map((p) => p[1]), [1, 2, 3, 4, 5], 'magic stones grow');
    const i5 = await it();
    assert.equal(i5.rrl.length, 5);
    assert.ok(i5.rrl.every((e) => e.a && e.b && e.t > 0 && e.g > 0 && e.s > 0), JSON.stringify(i5.rrl[0]));
    // a sixth: refused, nothing taken
    const S5 = await g.eval(() => ({ g: window.__G.S.gold, m: window.__G.S.mats.mstone }));
    await g.eval((u) => { const i = window.__G.S.items.find((x) => x.uid === u); window.__GRR.go(i, 0, 'smith'); }, w.uid);
    assert.deepEqual(await g.eval(() => ({ g: window.__G.S.gold, m: window.__G.S.mats.mstone })), S5, 'the sixth takes nothing');
    assert.equal((await it()).rr, 5);
    assert.match(await g.eval(() => document.getElementById('dtext').textContent), /reforged 5 times/);
    assert.ok(S0.g - S5.g === 31000);
    // a trade carries the count (the other side can't start over)
    const back = await g.eval((u) => { const G = window.__G, i = G.S.items.find((x) => x.uid === u); const o = {}; for (const k in i) if (k !== 'uid' && k !== 'iid') o[k] = i[k]; return window.__GAP.tin(JSON.stringify(o)).rr; }, w.uid);
    assert.equal(back, 5);
    // no stones: refused before anything is taken
    const w2 = await g.eval(() => { const G = window.__G, S = G.S, it = G.isk.mkItem('ssword', 2); S.items.push(it); S.mats.mstone = 0; return it.uid; });
    const S6 = await g.eval(() => window.__G.S.gold);
    await g.eval((u) => { const i = window.__G.S.items.find((x) => x.uid === u); window.__GRR.go(i, 0, 'smith'); }, w2);
    assert.equal(await g.eval(() => window.__G.S.gold), S6);
    assert.equal(await g.eval((u) => window.__G.S.items.find((x) => x.uid === u).rr || 0, w2), 0);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
