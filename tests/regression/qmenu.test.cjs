'use strict';
// The quest book (the player Suki through the owner 2026-10-26): tags (main story, side, repeatable, completed), a search,
// quests not started and upcoming ones with their level, a 📍 to each giver instead of a Start button, a legend's replay
// once per quest after the reset to level 1, and the Reputation Store's Bounty Book: today's bounties and board tasks taken and turned in from anywhere.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('quest book: tags, search, upcoming, giver marker, legend replay once after the reset, bounty book', async () => {
  const game = await H.openGame();
  try {
    await H.newGame(game);
    await game.step(3);
    const a = await game.eval(() => { const M = window.__GQM, G = window.__G, S = G.S;
      M.open(); const tabs = M.tabs(), L = M.list(), st = {}; for (const r of L) st[r.st] = (st[r.st] || 0) + 1;
      const up = L.find((r) => r.st === 'up'), ms = L.some((r) => r.tags.includes('ms')), hid = L.some((r) => G.QD[r.id].hid || G.QD[r.id].gen);
      const q = document.getElementById('qmQ'); const nm = document.querySelector('#qmL [data-qmd] b').textContent; q.value = nm; q.dispatchEvent(new Event('input'));
      const found = [...document.querySelectorAll('#qmL [data-qmd]')].length; q.value = 'zzzz no quest'; q.dispatchEvent(new Event('input'));
      const none = document.querySelectorAll('#qmL [data-qmd]').length; q.value = ''; q.dispatchEvent(new Event('input'));
      return { open: G.mode, tabs, st, upLv: up && G.QD[up.id].lv > S.lv, upTxt: up && M.html().includes(String(G.QD[up.id].lv)), ms, hid, found: found >= 1, none }; });
    assert.equal(a.open, 'qm');
    assert.deepEqual(a.tabs, ['all', 'ms', 'side', 'rep', 'done']);
    assert.ok(a.st.av >= 1 && a.st.up >= 1 && a.upLv && a.upTxt && a.ms && !a.hid && a.found && a.none === 0, JSON.stringify(a));
    // a repeatable task: the book marks its giver (no Start button) and lists it as done for today after the daily limit
    const r = await game.eval(() => { const M = window.__GQM, G = window.__G, S = G.S, C = window.__GC2; S.lv = 300;
      const id = Object.keys(G.QD).find((k) => { const q = G.QD[k]; return q.rep && !q.gen && q.by !== 'board' && C.avail(k); });
      M.open(); const can = M.can(id), tag = M.tags(id).includes('rep'), start = document.querySelectorAll('#qmL [data-qms]').length;
      M.go(id); const trk = M.trk() === id; let n = 0;
      for (let i = 0; i < 9 && C.avail(id); i++) { C.accept(id); const q = S.qs[id]; q.c = 999; const o = G.QD[id].obj; if (o.t === 'have') S.mats[o.it] = (S.mats[o.it] || 0) + o.n; C.complete(id); n++; }
      const row = M.list().find((x) => x.id === id);
      return { can, tag, start, trk, n, st: row && row.st, done: M.tags(id).includes('done') }; });
    assert.deepEqual(r, { can: true, tag: true, start: 0, trk: true, n: 5, st: 'done', done: true });
    // finished story quests stay finished; a legendary class's reset to level 1 gives each one replay, taken from its giver
    const l = await game.eval(() => { const M = window.__GQM, C = window.__GC2, G = window.__G, S = G.S;
      C.accept('gj1'); S.qs.gj1.c = 99; C.complete('gj1'); const plain = M.can('gj1') || C.avail('gj1');
      S.cls = 'saint'; S.lrd = null; const oldLegend = M.can('gj1') || C.avail('gj1');
      S.lrd = { c: 'saint', q: {} }; const leg = M.can('gj1'), tags = M.tags('gj1'); C.accept('gj1'); const rp = !!S.qs.gj1.rp;
      G.S.qTrk = null; return { plain, oldLegend, leg, tags, rp }; });
    assert.deepEqual(l, { plain: false, oldLegend: false, leg: true, tags: ['ms', 'rep', 'done'], rp: true });
    await game.step(5);
    const l2 = await game.eval(() => { const M = window.__GQM, C = window.__GC2, S = window.__G.S;
      const panel = !!document.querySelector('#qtext [data-qd="gj1"]');
      S.qs.gj1.c = 99; C.complete('gj1'); const after = M.can('gj1') || C.avail('gj1'), tags2 = M.tags('gj1');
      S.cls = 'dslayer'; const other = C.avail('gj1'); S.lrd = { c: 'dslayer', q: {} }; const fresh = C.avail('gj1');
      return { panel, after, tags2, other, fresh }; });
    assert.deepEqual(l2, { panel: true, after: false, tags2: ['ms', 'done'], other: false, fresh: true });
    // the Bounty Book from the Reputation Store adds the Bounties tab
    const b = await game.eval(() => { const M = window.__GQM, G = window.__G, S = G.S; const before = M.book();
      S.crep = M.RSBOOK + 100; window.__GRS.rsBuy('bbook'); const paid = S.crep === 100; const opts = document.querySelectorAll('#dopts button'); opts[opts.length - 1].click(); M.open('bnt');
      const tabs = M.tabs(), daily = M.daily().length > 0 && document.querySelectorAll('#qmL [data-qmbk]').length > 0;
      const n0 = Object.keys(S.qs).filter((k) => G.QD[k] && G.QD[k].gen).length; M.bact('qmbk', 0);
      const id = Object.keys(S.qs).find((k) => G.QD[k] && G.QD[k].gen && S.qs[k].st === 1); const took = !!id && Object.keys(S.qs).filter((k) => G.QD[k] && G.QD[k].gen).length === n0 + 1;
      const o = G.QD[id].obj; S.qs[id].c = 999; if (o.t === 'have') S.mats[o.it] = (S.mats[o.it] || 0) + o.n;
      const g0 = S.gold; M.bact('qmbt', id); const turned = !S.qs[id] && S.gold >= g0;
      const D = M.dly(), x = M.daily()[0]; D.c[x.k] = x.n; M.open('bnt'); const claimBtn = document.querySelectorAll('#qmL [data-qmdl]').length === 1;
      M.bact('qmdl', 0); const claimed = !!D.done[x.k];
      return { before, paid, tabs, daily, took, turned, claimBtn, claimed, mode: G.mode }; });
    assert.deepEqual(b, { before: false, paid: true, tabs: ['all', 'ms', 'side', 'rep', 'done', 'bnt'], daily: true, took: true, turned: true, claimBtn: true, claimed: true, mode: 'qm' });
    // becoming a legend (back to level 1) is what grants the replays
    const bl = await game.eval(() => { const S = window.__G.S; S.cls = 'warrior'; S.lv = 200; S.lrd = null; window.__GL.become('muller'); return { cls: S.cls, lv: S.lv, lrd: S.lrd && S.lrd.c, gj1: window.__GC2.avail('gj1') }; });
    assert.deepEqual(bl, { cls: 'saint', lv: 1, lrd: 'saint', gj1: true });
    assert.deepEqual(game.errors, []);
  } finally { await game.close(); }
});
