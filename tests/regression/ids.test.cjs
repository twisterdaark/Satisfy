'use strict';
// SAT-ONLINE-005 (doc §05 R0.4/R0.5, gate R0.6): character and item ids survive saves in both
// directions, kills/crafts/claims are reported once with request ids, a quest pays once.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');
const F = require('../harness/fixtures.cjs');

test.after(() => H.closeBrowser());

const baseline = H.baselineHtml();
const r0 = H.baselineHtml(H.R0_SHA); // the characterization tests' baseline (R0)
const skip = baseline ? false : `baseline ${H.BASELINE_SHA.slice(0, 7)} not available in this clone`;
const ids = (g) => g.eval(() => ({ pid: window.__G.S.pid, items: window.__G.S.items.map((i) => [i.uid, i.iid]) }));
const quit = async (g) => { await g.eval(() => window.__G.act('quit')); await g.waitMode('title'); };

test('a new character gets a pid and item ids; they survive quit → reload → continue', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const a = await ids(g);
    assert.match(a.pid, /^p_[a-z2-7]{20}$/);
    assert.deepEqual(a.items, [[1, 'it_' + a.pid + '_1']]);
    const saved = JSON.parse((await g.storage())[H.LEGACY_KEY]);
    assert.equal(saved.S.pid, a.pid, 'written into the save');
    await quit(g);
    await g.reload();
    await H.continueGame(g);
    assert.deepEqual(await ids(g), a);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a legacy v4 save gets ids on load and keeps them after the next save', async () => {
  const g = await H.openGame({ storage: { [H.LEGACY_KEY]: JSON.stringify(F.LEGACY_V4) } });
  try {
    await H.continueGame(g);
    const a = await ids(g);
    assert.match(a.pid, /^p_/);
    assert.ok(a.items.every(([uid, iid]) => iid === 'it_' + a.pid + '_' + uid));
    await quit(g);
    await g.reload();
    await H.continueGame(g);
    assert.deepEqual(await ids(g), a);
  } finally { await g.close(); }
});

test('rollback keeps ids: the baseline build loads and re-saves them untouched', { skip }, async () => {
  const g = await H.openGame();
  let a, written;
  try {
    await H.newGame(g);
    a = await ids(g);
    await quit(g);
    written = (await g.storage())[H.LEGACY_KEY];
  } finally { await g.close(); }
  const old = await H.openGame({ html: baseline, storage: { [H.LEGACY_KEY]: written } });
  try {
    await H.continueGame(old);
    await old.eval(() => window.__G.act('quit'));
    await old.waitMode('title');
    const back = JSON.parse((await old.storage())[H.LEGACY_KEY]);
    assert.equal(back.S.pid, a.pid);
    assert.deepEqual(back.S.items.map((i) => [i.uid, i.iid]), a.items);
    assert.deepEqual(old.errors, []);
  } finally { await old.close(); }
});

// A plain kill quest with a gold reward: no item/class/title side effects, not repeatable.
const pickQuest = (g) => g.eval(() => {
  const QD = window.__G.QD; // __G (not Satisfy.local) so the baseline build can run it too
  const id = Object.keys(QD).find((k) => { const q = QD[k]; return q.obj && q.obj.t === 'kill' && q.gold > 0 && !q.rep && !q.item && !q.cls && !q.title && !q.pts; });
  return { id, gold: QD[id].gold, n: QD[id].obj.n };
});
async function claimTwice(g, q) {
  return g.eval(({ id, n }) => {
    const G = window.__G, before = G.S.gold;
    G.acceptQ(id);
    G.S.qs[id].c = n; // objective done
    G.completeQ(id);
    G.completeQ(id); // the dialog callback firing twice, or a second click on the board
    return G.S.gold - before;
  }, q);
}

test('R0.6: a quest reward is paid once even if the turn-in fires twice', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const q = await pickQuest(g);
    assert.ok(q.id, 'found a plain kill quest');
    assert.equal(await claimTwice(g, q), q.gold);
    const claims = (await g.eval(() => Satisfy.local.events())).filter((e) => e.type === 'quest.reward.claimed');
    assert.equal(claims.length, 1);
    assert.equal(claims[0].payload.quest, q.id);
    assert.equal(claims[0].key, (await ids(g)).pid + ':claim:' + q.id);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('characterization: the baseline paid a quest twice when the turn-in fired twice', { skip: r0 ? false : 'R0 baseline not available in this clone' }, async () => {
  const g = await H.openGame({ html: r0 });
  try {
    await H.newGame(g);
    const q = await pickQuest(g);
    assert.equal(await claimTwice(g, q), 2 * q.gold);
  } finally { await g.close(); }
});

test('kills and crafts are reported as domain events with request ids and keys', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P;
      const m = G.mons().find((x) => !x.dead);
      m.hp = 1; m.x = P.x + 12; m.y = P.y + 4; P.acd = 0;
      G.tryAttack(1, 0);
      S.mats.ore = 20; S.mats.wood = 20;
      G.startMG('isword'); G.finishMG()();
      G.startMG('jaffa'); G.finishMG()();
      return { type: m.type, dead: m.dead, pid: S.pid, sword: S.items[S.items.length - 1], ev: Satisfy.local.events() };
    });
    assert.equal(r.dead, true);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    assert.ok(r.ev.every((e) => uuid.test(e.id) && e.pid === r.pid));
    assert.equal(new Set(r.ev.map((e) => e.id)).size, r.ev.length);
    assert.deepEqual(r.ev.map((e) => [e.type, e.key]), [
      ['monster.kill', `${r.pid}:kill:${r.type}:1`],
      ['craft.item.created', `${r.pid}:craft:item:${r.sword.uid}`],
      ['craft.item.created', `${r.pid}:craft:arrows:1`],
    ]);
    assert.equal(r.ev[1].payload.itemId, r.sword.iid);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('profile(): durable progress and ids only; no position, timers or raid flag', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(30);
    const p = await g.eval(() => Satisfy.local.profile());
    const S = await g.eval(() => window.__G.S);
    assert.equal(p.pid, S.pid);
    assert.equal(p.schema, S.v);
    assert.equal(p.durable.gold, S.gold);
    assert.deepEqual(p.durable.items, S.items);
    for (const k of ['raid', 'immT', 'bqT', 'zone', 'pid', 'uid', 'v', 'x', 'y', 'hp']) assert.equal(k in p.durable, false, k);
  } finally { await g.close(); }
});
