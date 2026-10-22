'use strict';
// SAT-ONLINE-128 (plan U063, "no side loses anything without getting its part"): a side that confirmed emits 'confirmed'
// (the game keeps the trade's id), and recover(id, foe) later finds a trade that was done with both offers as swapped,
// or null for one that wasn't. The world below is unit/trade's.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/trade.js');
const C = SN.trade.C;
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };
const tickP = () => new Promise((r) => setImmediate(r));

function world(n = 2, o = {}) {
  const hub = SN.transports.hub(), store = o.store || SN.trade.memoryStore();
  let t = 1000; const now = () => t;
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + i;
    const p = { uid, name: 'P' + i, x: 4000 + i * 20, y: 1500, gold: 500, items: [{ iid: 'it_pid' + i + 'xx_1', json: JSON.stringify({ id: 'sword' + i, r: 1 }) }, { iid: 'it_pid' + i + 'xx_2', json: JSON.stringify({ id: 'helm' + i, r: 2 }) }], events: [], blocked: new Set() };
    p.pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    p.trade = SN.trade.create({ presence: p.pres, uid, now, store, pos: () => ({ x: p.x, y: p.y }), bag: () => p.items, gold: () => p.gold, blocked: (u) => p.blocked.has(u) });
    p.trade.on((e) => p.events.push(e));
    players.push(p);
  }
  const sync = () => {
    for (const p of players) { if (p.gone) continue; p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: p.x, y: p.y, dir: 0 }, { zone: 'zWin', uid: p.uid, sid: p.pres.sid }), true); }
    for (const p of players) if (!p.gone) { p.pres.tick(); p.trade.tick(); }
  };
  const advance = async (ms, step = 100) => { for (let k = 0; k < ms; k += step) { t += Math.min(step, ms - k); sync(); await tickP(); } };
  sync();
  const remote = (from, to) => from.pres.remotes().find((r) => r.uid === to.uid);
  const types = (p) => p.events.map((e) => e.type);
  const openTrade = async (a, b) => {
    assert.equal(a.trade.ask(remote(a, b)), 'sent');
    await tickP();
    const ask = b.trade.pendingAsk();
    assert.ok(ask, 'B got the ask');
    assert.equal(ask.handle, a.name);
    assert.ok(b.trade.accept(ask.trade));
    await tickP();
    assert.equal(a.trade.state().phase, 'open');
    assert.equal(b.trade.state().phase, 'open');
    return ask.trade;
  };
  return { players, store, sync, advance, remote, types, openTrade, now: () => t };
}

test('confirm says so; a side that never saw the swap finds it later, with both offers as they were swapped', async () => {
  const w = world(), [a, b] = w.players;
  const id = await w.openTrade(a, b);
  assert.ok(a.trade.setGold(120));
  assert.ok(b.trade.toggle('it_pid1xx_2'));
  await tickP();
  a.trade.acceptOffer(); b.trade.acceptOffer(); await tickP();
  assert.equal(await a.trade.recover(id, b.uid), null, 'not done yet');
  // B (the higher uid) confirms first; A confirms and writes the swap
  assert.ok(b.trade.confirm());
  assert.deepEqual(b.events.filter((e) => e.type === 'confirmed').map((e) => [e.id, e.foe]), [[id, a.uid]]);
  assert.ok(a.trade.confirm()); await tickP(); await tickP();
  assert.ok(w.store.data.done[id], 'A wrote the swap');
  // B's tab had closed before it: a new tab is a fresh trade object over the same database
  const b2 = SN.trade.create({ presence: b.pres, uid: b.uid, now: w.now, store: w.store, pos: () => ({ x: b.x, y: b.y }), bag: () => b.items, gold: () => b.gold });
  const r = await b2.recover(id, a.uid);
  assert.equal(r.id, id); assert.equal(r.foe, a.uid);
  assert.deepEqual([r.give.g, Object.keys(r.give.it)], [0, ['it_pid1xx_2']], 'what B gave');
  assert.deepEqual([r.get.g, Object.keys(r.get.it)], [120, []], 'what B gets');
  assert.deepEqual(await b2.recover(id, a.uid), r, 'it changes nothing: the same answer again');
  assert.equal(await b2.recover('t_nope_1', a.uid), null, 'a trade that was never done');
  assert.equal(await b2.recover('../x', a.uid), null, 'not a trade id');
});
