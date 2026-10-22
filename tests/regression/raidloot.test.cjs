'use strict';
// SAT-ONLINE-063 (Claude-B #13 item 24 step 3; plan U058): a raid boss kill puts one bonus piece up for a roll among the
// raid members who fought it. B hits the Goblin Chief, A (the leader and host) finishes it; both are offered the piece;
// B says Need, A says Greed: Need wins, B's game makes the piece, A is told who won and with which roll.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(10);
    await games[0].page.waitForTimeout(30);
  }
}
// next to the boss, frozen so it can't fight back (as raid.test does), the other monsters out of the way
const at = (g, dx) => g.eval((dx) => {
  const G = window.__G, m = G.mons().find((x) => x.type === 'gchief' && !x.dead);
  m.stun = 1e9; m.x = m.sx; m.y = m.sy;
  for (const o of G.mons()) if (o !== m) { o.dead = true; o.rt = 1e9; }
  G.P.x = m.x + dx; G.P.y = m.y; G.P.inv = 0; G.P.hp = 1e6; G.P.dir = dx < 0 ? 1 : 3;
}, dx);
// a toast lives 2.6 s of real time, which a busy machine steps past: every page keeps the toasts it has shown
const toasts = (g) => g.eval(() => window.__toastSeen || '');
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });

test('online: a raid boss kill rolls one bonus piece among those who fought it; Need beats Greed; only the winner gets it', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const pages = {};
    for (const [k, uid, name] of [['a', 'gLtA1', 'Lead'], ['b', 'gLtB2', 'Mate']]) {
      const g = pages[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    }
    const { a, b } = pages;
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    for (const g of [a, b]) await keepToasts(g);
    await at(a, -40); await at(b, -20);
    await settle(a, b);
    await a.page.keyboard.press('KeyP');
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await until([a, b], () => Satisfy.local.net().party.members.length === 2, 15000);
    await a.eval(() => document.getElementById('pRaidB').click());
    await until([a, b], () => window.__GRL.on());
    await at(b, 14);
    await settle(a, b);
    // B hits it (the hit goes to A, the host); A finishes it
    for (let i = 0; i < 6; i++) { await b.eval(() => { const G = window.__G; G.P.acd = 0; G.tryAttack(-1, 0); }); await settle(a, b); }
    await a.eval(() => { const m = window.__G.mons().find((x) => x.type === 'gchief' && !x.dead); m.hp = 0; window.__GB2.kill(m); });
    await until([a, b], () => !document.getElementById('lootW').hidden, 10000);
    const offer = await b.eval(() => window.__GRL.loot().o);
    assert.match(await a.eval(() => document.getElementById('lootT').textContent), /^Raid loot: .+ \((Epic|Unique)\) — \d+ s$/);
    await b.eval(() => document.querySelector('#lootW [data-act="lootN"]').click());
    await a.eval(() => document.querySelector('#lootW [data-act="lootG"]').click());
    await settle(a, b);
    assert.deepEqual((await a.eval(() => window.__GRL.loot().l.ch)).sort(), [['gLtA1', 1], ['gLtB2', 2]], 'the leader has both answers');
    const uid0 = await b.eval(() => window.__G.S.uid); // items made from here on are new
    // after the roll's time: Need wins
    for (let i = 0; i < 18; i++) { await a.step(60); await b.step(60); await a.page.waitForTimeout(20); }
    await settle(a, b);
    const roll = await a.eval((id) => window.__GRL.roll(id, 'gLtB2'), offer.id);
    await until([b], (o) => window.__G.S.items.some((it) => it.uid > o.u && it.id === o.it && it.r === o.r), 10000, { u: uid0, it: offer.it, r: offer.r });
    assert.match(await toasts(b), new RegExp('You won .+ in the raid roll \\(Need ' + roll + '\\)'));
    await until([a], (r) => new RegExp('Mate won .+ in the raid roll \\(Need ' + r + '\\)').test(window.__toastSeen), 10000, roll);
    // plan U058, one result for the raid: the piece is made once, by B only
    const pieces = (g, o) => g.eval((x) => window.__G.S.items.filter((it) => it.uid > x.u && it.id === x.it && it.r === x.r).length, o);
    const uidA = await a.eval(() => window.__G.S.uid);
    assert.equal(await pieces(b, { u: uid0, it: offer.it, r: offer.r }), 1);
    // the result announced again (a message sent twice, a leader that repeats itself): nothing more is made
    const sid = await a.eval(() => Satisfy.local.net().sid);
    const sendAs = (g, to, raid, k, n, seq) => g.eval(async ([t, r, kk, nn, sq, sd]) => { const F = window.__GLD.fb(), D = F.m.database; await D.push(D.ref(F.db, 'inbox/' + t), { from: Satisfy.local.net().uid, sid: sd, seq: sq, type: 'raid.state', payload: { to: t, raid: r, k: kk, n: nn }, t: D.serverTimestamp() }); }, [to, raid, k, n, seq, sid]);
    await b.eval(() => { window.__new = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__new.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); });
    await sendAs(a, 'gLtB2', 'w|' + offer.id + '|gLtB2', roll, 2, 1e9);
    await settle(a, b); await settle(a, b);
    assert.equal(await pieces(b, { u: uid0, it: offer.it, r: offer.r }), 1, 'still one piece');
    assert.ok(!(await b.eval(() => window.__new.some((x) => /You won/.test(x)))), 'not told again');
    // and the boss reported killed again within the minute: no second roll for it
    const sidB = await b.eval(() => Satisfy.local.net().sid);
    await b.eval(async ([sd]) => { const F = window.__GLD.fb(), D = F.m.database; await D.push(D.ref(F.db, 'inbox/gLtA1'), { from: 'gLtB2', sid: sd, seq: 1e9, type: 'raid.state', payload: { to: 'gLtA1', raid: 'k|gchief', k: 0 }, t: D.serverTimestamp() }); }, [sidB]);
    await settle(a, b); await settle(a, b);
    assert.equal(await a.eval(() => window.__GRL.loot().l), null, 'no second roll');
    assert.equal(await pieces(a, { u: uidA, it: offer.it, r: offer.r }), 0, 'A, who lost the roll, has no piece');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
