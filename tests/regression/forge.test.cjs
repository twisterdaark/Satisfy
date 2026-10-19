'use strict';
// Review fix (#12, #15): the Realtime Database vouches only for the uid (the presence node key, the inbox `from`). A session
// id is the writer's choice, and anyone signed in can read everyone's from presence. A client must never let one account
// pose as another account's session by copying its sid: not in presence (hiding or replacing the real player, or
// poisoning its replay counter with a huge seq), and not in the inbox (a party kick or a duel result "from" someone else).
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
async function online(g, name) {
  await g.eval((n) => { window.__fakeRTDB.nextName = n; document.getElementById('onlineBtn').click(); }, name);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
}
const who = (g) => g.eval(() => ({ uid: Satisfy.local.net().uid, sid: Satisfy.local.net().sid }));
// three accounts; A and B play next to each other, C (Mallory) stays on the title screen and writes to the database
// by hand, the way a modified client could
async function three() {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
  const c = await H.openGame({ ctx, query: '?net=online&slot=c' });
  await online(a, 'Ahmed'); await online(b, 'Bassem'); await online(c, 'Mallory');
  await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
  await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
  await b.eval(() => { window.__G.P.x += 20; });
  await settle(a, b);
  return { ctx, a, b, c };
}

test('presence: a node that copies another player\'s session id is a separate player, never the real one', async () => {
  const { ctx, a, b, c } = await three();
  try {
    const A = await who(a), C = await who(c);
    const at = await a.eval(() => ({ x: Math.round(window.__G.P.x), y: Math.round(window.__G.P.y) }));
    await c.eval(async ([uid, sid, at]) => {
      const sdk = await Satisfy.firebase.load(Satisfy.firebaseConfig), D = sdk.m.database;
      await D.set(D.ref(sdk.db, 'presence/satisfy/main/' + uid), { v: 1, uid, sid, handle: 'Grid', look: { hair: 0, hc: 0, skin: 0, top: 0 }, cls: 'novice', lv: 1, zone: 'zWin', x: at.x + 10, y: at.y, dir: 0, anim: 'idle', arm: 0, seq: 1e15, t: D.serverTimestamp() });
    }, [C.uid, A.sid, at]);
    await settle(a, b, c);
    const x0 = Math.round(await a.eval(() => window.__G.P.x));
    await a.eval(() => { window.__G.P.x -= 40; });
    await settle(a, b, c); await settle(a, b, c);
    const rs = (await b.eval(() => Satisfy.local.net().remotes)).map((r) => ({ uid: r.uid, x: Math.round(r.x), sid: r.sid }));
    const real = rs.find((r) => r.uid === A.uid), copy = rs.find((r) => r.uid === C.uid);
    assert.ok(real, 'A is still there: ' + JSON.stringify(rs));
    assert.ok(Math.abs(real.x - (x0 - 40)) <= 2, 'A\'s later moves still arrive (no replay poisoning): ' + JSON.stringify(rs));
    assert.ok(copy && copy.sid !== real.sid, 'the copy is its own session: ' + JSON.stringify(rs));
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

// SAT-ONLINE-003 review fix (#15): inbox messages are tied to the sender's verified uid as well
test('inbox: a party kick "from the leader\'s session" sent by another account is ignored', async () => {
  const { ctx, a, b, c } = await three();
  try {
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await until([a, b], () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    const A = await who(a), B = await who(b), C = await who(c);
    const pid = await a.eval(() => Satisfy.local.net().party.id);
    await c.eval(async ([me, to, sid, party]) => {
      const sdk = await Satisfy.firebase.load(Satisfy.firebaseConfig), D = sdk.m.database;
      await D.push(D.ref(sdk.db, 'inbox/' + to), { from: me, sid, seq: 1e15, type: 'party.kick', payload: { to, party }, t: D.serverTimestamp() });
    }, [C.uid, B.uid, A.sid, pid]);
    await settle(a, b, c); await settle(a, b, c);
    assert.equal(await b.eval(() => (Satisfy.local.net().party || {}).id), pid, 'B is still in the party');
    assert.equal(await c.eval(() => window.__fakeRTDB.rejected.length), 0, 'the forged message passed the database rules (only the client can tell)');
    // and the real leader's messages still land afterwards (the huge seq did not poison A's message counter)
    await a.eval(() => document.querySelector('#partyW [data-act=pLeave]').click());
    await until([b], () => !(Satisfy.local.net().party || {}).id);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
