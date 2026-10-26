'use strict';
// Owner 2026-10-26: Mumud's Spellbook fell again (Floor 49) for an account that had sold its copy, and the buyer read it
// (04:37). Then (15:24): no legend book may fall once one has fallen or while someone has it in their bag, and when a
// legend deletes his character, people can take his class again. Each book (Mumud's Spellbook, Tzudan's diary, Madra's
// sheath) is one copy in the world: world/satisfy/books/{k} online, WS.books offline. A taken legend's book can't be read,
// the newer legends are claimed in the database first, and their quests show in the quest panel.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Mumud', hair: 2, hc: 1, skin: 1, top: 2 };
// 3000 undead at 1% each: no book at all would be one chance in ten billion
const killUndead = (g, n = 3000) => g.eval((n) => { const L = window.__GLG; for (let i = 0; i < n; i++) L.kill({ type: i % 2 ? 'wraith' : 'skel' }); return window.__G.S.mats.mumbk || 0; }, n);

test('offline: one copy of each legend book in the world; none while it is out or its legend has a holder', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { const S = window.__G.S; S.cls = 'mage'; S.lv = 200; S.mmq = 0; S.mats.mumbk = 0; });
    assert.equal(await killUndead(g), 1, 'the first book falls, only one');
    assert.equal(await g.eval(() => window.__GUQ.rec('mumbk').p === window.__G.S.pid), true, 'the copy is this character\'s');
    // given away: the copy is still out in the world, so the undead give nothing more
    await g.eval(() => { window.__G.S.mats.mumbk = 0; });
    assert.equal(await killUndead(g), 0, 'a copy that is out does not fall again');
    assert.equal(await g.eval(() => window.__GUQ.give('mumbk')), false);
    // the one copy can't be sold to a merchant, thrown away or dropped
    const kept = await g.eval(() => { const S = window.__G.S, O = window.__GUQ.out; S.mats.mumbk = 1; for (const f of ['sell', 'trash', 'drop']) O[f]({ k: 'mumbk', n: 1 }); return { n: S.mats.mumbk, mode: window.__G.mode }; });
    assert.deepEqual(kept, { n: 1, mode: 'play' });

    // the copy gone back to the world but the legend has a holder: nothing falls, and a copy in a bag can't be read
    const held = await g.eval(() => { const G = window.__G, S = G.S, W = window.__GU.WS; S.mats.mumbk = 0; delete W.books.mumbk; W.legends = W.legends || {}; W.legends.mumud = { pid: 'u:valiant', n: 'Valiant' }; return window.__GUQ.free('mumbk'); });
    assert.equal(held, false);
    assert.equal(await killUndead(g), 0, 'no book while Mumud has a successor');
    const read = await g.eval(() => { const S = window.__G.S; S.mats.mumbk = 1; window.__GLG.mmUse(); return { q: S.mmq || 0, book: S.mats.mumbk }; });
    assert.deepEqual(read, { q: 0, book: 1 }, 'a taken legend\'s book is not used up');
    // a copy that came in (a trade, the market) is recorded as this character's
    assert.equal(await g.eval(() => { window.__GUQ.tick(); const r = window.__GUQ.rec('mumbk'); return !!r && r.p === window.__G.S.pid; }), true);
    // on the quest when someone else became Mumud's Successor (Nitro, 04:49): the quest panel says who, the lich does not
    // come, and freeing it says the legend is taken instead of nothing at all
    const q = await g.eval(() => { const G = window.__G, S = G.S, o = {}; S.mmq = 1; o.held = window.__GUQ.hud();
      window.__GLG.won('mumud'); o.mode = G.mode; delete window.__GU.WS.legends.mumud; o.free = window.__GUQ.hud(); S.mmq = 0; return o; });
    assert.match(q.held, /Valiant/); assert.notEqual(q.mode, 'dialog');
    assert.match(q.free, /Mumud's Soul Liberation/); assert.match(q.free, /Chaos Mountains/);
    // a Mumud offer declined is offered again while the legend is free
    const re = await g.eval(() => { const G = window.__G, S = G.S; S.mats.mumbk = 0; S.mmq = 2; S.mumudW = 1; window.__GUQ.reoffer(); const o = { mode: G.mode, lines: (G.DL && G.DL.lines) || [] };
      const no = G.mode === 'dialog' && G.DL.opts.find((x) => /^(No|Not|لا|مش)/.test(x.l)); if (no) no.f(); S.mmq = 0; S.mumudW = 0; return o; });
    assert.equal(re.mode, 'dialog'); assert.ok(re.lines.includes('mmWon'), re.lines.join());
    for (let i = 0; i < 8 && await g.eval(() => window.__G.mode) === 'dialog'; i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
    await g.eval(() => { window.__GU.WS.legends.mumud = { pid: 'u:valiant', n: 'Valiant' }; });

    // Tzudan's diary: no quest while Tzudan has a holder or the diary is out; the gift itself is one copy
    const tz = await g.eval(() => { const G = window.__G, S = G.S, L = window.__GLG, U = window.__GUQ, W = window.__GU.WS, o = {};
      S.cls = 'warrior'; S.lv = 160; S.tzq = 0; S.mats.tzbook = 0; W.legends.tzudan = { pid: 'u:rein', n: 'Rein' };
      const demon = () => { const m = G.spawnMon('wolf', G.P.x + 30, G.P.y); m.type = 'belial'; return m; };
      L.kill(demon()); o.whileHeld = S.tzq; delete W.legends.tzudan;
      W.books.tzbook = { p: 'someone_else' }; L.kill(demon()); o.whileOut = S.tzq; delete W.books.tzbook;
      L.kill(demon()); o.free = S.tzq; o.give = U.give('tzbook'); o.again = U.give('tzbook'); o.n = S.mats.tzbook;
      S.mats.tzbook = 0; o.afterTrade = U.give('tzbook'); return o; });
    assert.deepEqual(tz, { whileHeld: 0, whileOut: 0, free: 1, give: true, again: false, n: 1, afterTrade: false });
    // the Mountain King's seat itself gives the diary to a warrior on the quest (review: it once checked after closing it)
    await new Promise((r) => setTimeout(r, 800)); // the quest's own lines (700 ms after the demon) come first
    const seat = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, Z = Satisfy.local.zoneAt, o = {};
      let at = null; for (let tx = 600; tx < 760 && !at; tx++) for (let ty = -60; ty < 0 && !at; ty++) if (Z(tx * 16 + 8, ty * 16 + 8) === 'zGiantL') at = [tx * 16 + 8, ty * 16 + 8];
      for (let i = 0; i < 30 && G.mode === 'dialog'; i++) G.advance(); window.__uqAt = at; P.x = at[0]; P.y = at[1]; S.tzq = 1; S.mats.tzbook = 0; delete window.__GU.WS.books.tzbook; window.__GUQ.tz(); o.q = S.tzq; o.n = S.mats.tzbook; o.mode = G.mode; return o; });
    assert.deepEqual(seat, { q: 2, n: 1, mode: 'dialog' });
    // the seat again, the diary given away: it is out, so no second diary and the quest waits for it
    await g.eval(() => { window.__G.S.mats.tzbook = 0; window.__atSeat = () => { const G = window.__G, P = G.P, S = G.S; for (let i = 0; i < 30 && G.mode === 'dialog'; i++) G.advance(); P.x = window.__uqAt[0]; P.y = window.__uqAt[1]; P.hp = 1e9; S.tzq = 1; window.__GUQ.tz(); return { q: S.tzq, n: S.mats.tzbook || 0, why: [G.mode, document.getElementById('dialog').hidden, Satisfy.local.zoneAt(P.x, P.y)].join() }; }; });
    const seat2 = await g.eval(() => window.__atSeat());
    assert.deepEqual([seat2.q, seat2.n], [1, 0], 'the diary is out: ' + seat2.why);
    // Tzudan held by someone else: the seat leaves the quest open (for when the legend is free) and gives nothing
    const seat3 = await g.eval(() => { const W = window.__GU.WS; delete W.books.tzbook; W.legends.tzudan = { pid: 'u:rein', n: 'Rein' }; const r = window.__atSeat(); delete W.legends.tzudan; return r; });
    assert.deepEqual([seat3.q, seat3.n], [1, 0], 'held: ' + seat3.why);

    // Madra's sheath from the Red Knights: one copy; a failed trial gives it back to the world
    const md = await g.eval(() => { const G = window.__G, S = G.S, D = window.__GMD, W = window.__GU.WS; S.cls = 'warrior'; S.mdq = 0; S.mats.mdsheath = 0; delete W.legends.madra;
      const kill = () => { for (let i = 0; i < 1500; i++) D.kill({ type: 'redk' }); return S.mats.mdsheath || 0; };
      const o = { first: kill() }; S.mats.mdsheath = 0; o.out = kill();
      S.mdq = { st: 1, k: 0, e: 0 }; D.die(); o.lost = S.mdq.st; o.freed = !W.books.mdsheath;
      delete S.mdq; o.again = kill(); return o; }); // (the trial's own character has its skill quest; another gets the sheath)
    assert.deepEqual(md, { first: 1, out: 0, lost: 3, freed: true, again: 1 });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

async function until(games, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(30);
  }
}
const rec = (g, k) => g.eval((k) => window.__fakeRTDB.data.get('world/satisfy/books/' + k) || null, k);

test('online: one copy in the world follows its holder; a legend\'s deleted character gives the class and the book back', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gUqA1', 'Nitro', LOOK], ['b', 'gUqB2', 'Valiant', { n: 'Valiant', hair: 1, hc: 3, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    await until([a, b], () => !!window.__GL.db() && !!window.__GUQ.db());
    for (const g of [a, b]) await g.eval(() => { const S = window.__G.S; S.cls = 'mage'; S.lv = 200; S.mmq = 0; S.mats.mumbk = 0; });
    // Nitro's undead give the one copy; while it is out, nobody's undead give another
    await killUndead(a);
    await until([a], () => (window.__G.S.mats.mumbk || 0) === 1);
    assert.equal(await killUndead(a), 1, 'one book while the first claim is on its way');
    const r0 = await rec(a, 'mumbk');
    assert.equal(r0.uid, 'gUqA1'); assert.equal(r0.p, await a.eval(() => window.__G.S.pid));
    await until([b], () => !!window.__GUQ.rec('mumbk'));
    assert.equal(await killUndead(b), 0, 'Valiant\'s undead give nothing while Nitro has it');

    // Nitro trades it to Valiant: the record follows the book (same copy, same g)
    await a.eval(() => { window.__G.S.mats.mumbk = 0; });
    await b.eval(() => { window.__G.S.mats.mumbk = 1; });
    await until([a, b], () => { const r = window.__fakeRTDB.data.get('world/satisfy/books/mumbk'); return !!r && r.uid === 'gUqB2'; });
    const r1 = await rec(b, 'mumbk');
    assert.equal(r1.g, r0.g); assert.equal(r1.p, await b.eval(() => window.__G.S.pid));
    assert.equal(await killUndead(a), 0, 'still out: Nitro gets no second one');

    // Valiant reads it and becomes Mumud's Successor (the database first)
    await b.eval(() => { window.__GLG.mmUse(); });
    assert.equal(await b.eval(() => window.__G.S.mmq), 1);
    await b.eval(() => { window.__GLG.become('mumud'); });
    await until([b], () => window.__G.S.cls === 'mumud');
    assert.equal(await b.eval(() => window.__fakeRTDB.data.get('world/satisfy/legends/mumud').uid), 'gUqB2');
    await until([a], () => { const L = window.__GL.legends(); return !!(L && L.mumud && L.mumud.n === 'Valiant'); });
    // Nitro can't take it, even past a stale local list
    await a.eval(() => { delete window.__GL.legends().mumud; window.__GLG.become('mumud'); });
    for (let i = 0; i < 6; i++) { await a.step(5); await a.page.waitForTimeout(40); }
    assert.equal(await a.eval(() => window.__G.S.cls), 'mage');
    // another character of Valiant's own account can't take the legend her account holds (nor rewrite or free it)
    const alt = await b.eval(() => { const G = window.__G, S = G.S, t0 = window.__fakeRTDB.data.get('world/satisfy/legends/mumud').t; S.cls = 'mage'; window.__GLG.become('mumud'); const o = { cls: S.cls, t0 }; S.cls = 'mumud'; return o; });
    for (let i = 0; i < 4; i++) { await b.step(5); await b.page.waitForTimeout(40); }
    assert.equal(alt.cls, 'mage');
    assert.equal(await b.eval(() => window.__fakeRTDB.data.get('world/satisfy/legends/mumud').t), alt.t0);

    // Valiant deletes that character: the legend and the book are the world's again, and Nitro's undead can give it
    await b.eval(() => { const S = window.__G.S, c = { pid: S.pid, cls: 'mumud' }, p = window.__GUQ.del(c, [c]); S.cls = 'mage'; S.mmq = 0; return p; });
    await until([a, b], () => !window.__fakeRTDB.data.get('world/satisfy/legends/mumud') && !window.__fakeRTDB.data.get('world/satisfy/books/mumbk'));
    await until([a], () => !(window.__GL.legends() || {}).mumud && !window.__GUQ.rec('mumbk'));
    await killUndead(a);
    await until([a], () => (window.__G.S.mats.mumbk || 0) === 1);
    assert.equal((await rec(a, 'mumbk')).uid, 'gUqA1');
    assert.equal(await a.eval(() => window.__GUQ.pass('mumbk')), true, 'the world\'s copy can be passed on');
    // one copy at a time, in the trade window and the guild vault (a spare beside it isn't the world's)
    const offer = await a.eval(() => { const S = window.__G.S, U = window.__GUQ; S.mats.mumbk = 2; S.mats.catfish = 3; const o = { trade: U.offer(), vault: U.vault() }; S.mats.mumbk = 1; return o; });
    assert.deepEqual(offer, { trade: ['mumbk:1'], vault: ['mumbk:1'] }); // (and catfish beside it: the list itself works)
    // a copy that isn't the world's (from before this update, or found signed out while Nitro's was out) is inert: it
    // can't be read or offered, and a merchant may buy it; it doesn't take Nitro's record
    await b.eval(() => { const S = window.__G.S, U = window.__GUQ; U.tick(); S.mats.mumbk = 1; U.reload(); U.tick(); U.tick(); }); // (the game runs this tick once a second)
    const dupe = await b.eval(() => { const S = window.__G.S, o = { pass: window.__GUQ.pass('mumbk') }; window.__GLG.mmUse(); o.q = S.mmq || 0; const g0 = S.gold; window.__GUQ.out.sell({ k: 'mumbk', n: 1 }); o.left = S.mats.mumbk; o.paid = S.gold > g0; return o; });
    assert.deepEqual(dupe, { pass: false, q: 0, left: 0, paid: true });
    assert.equal((await rec(a, 'mumbk')).uid, 'gUqA1', 'Nitro still holds the world\'s copy');

    // a won legend that can't be asked yet (another claim on its way) is offered again, not lost (review round 3)
    const busy = await a.eval(() => { const G = window.__G, L = window.__GLG; L.become('bowsaint'); L.won('madra');
      const yes = G.DL.opts.find((o) => /^(Use|Yes|استخدم|نعم)/.test(o.l)); yes.f(); return !!window.__fakeRTDB.data.get('world/satisfy/legends/madra'); });
    assert.equal(busy, false, 'not claimed while the first claim is on its way');
    await until([a], () => { const G = window.__G, offer = G.mode === 'dialog' && (G.DL.lines || []).includes('mdWon'); if (G.mode === 'dialog' && !offer) G.advance(); return offer; }, 15000);
    await a.eval(() => { const o = window.__G.DL.opts.find((o) => /^(No|Not|لا|مش)/.test(o.l)); o.f(); });
    for (let i = 0; i < 8 && await a.eval(() => window.__G.mode) === 'dialog'; i++) { await a.eval(() => window.__G.advance()); await a.step(2); }
    await until([a], () => window.__G.S.cls === 'bowsaint', 10000); // the Bow Saint's own claim, waited out

    // a claim the class change can't follow (the diary left the bag meanwhile) is freed again, not held by nobody
    await b.eval(() => { const S = window.__G.S; S.cls = 'warrior'; S.lv = 200; S.mats.tzbook = 1; });
    await until([b], () => { const r = window.__GUQ.rec('tzbook'); return !!r && r.uid === 'gUqB2'; }); // the diary that came in is the world's (none was out)
    const tzf = await b.eval(() => { const G = window.__G, S = G.S; window.__GLG.tzUse();
      const yes = G.DL.opts.find((o) => /^(Use|Yes|استخدم|نعم)/.test(o.l)); yes.f(); S.mats.tzbook = 0; return !!yes; });
    assert.ok(tzf);
    for (let i = 0; i < 8; i++) { await b.step(5); await b.page.waitForTimeout(40); }
    await until([a, b], () => !window.__fakeRTDB.data.get('world/satisfy/legends/tzudan'));
    assert.equal(await b.eval(() => window.__G.S.cls), 'warrior');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
