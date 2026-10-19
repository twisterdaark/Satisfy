'use strict';
// SAT-ONLINE-039 (owner 2026-10-19): a trade window without a game server. Each side offers gold and bag items, both
// Accept, then Confirm; any change resets the accepts; the swap is one database update keyed by the item ids, so an item
// can't be traded twice.
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

test('offer, Accept both, Confirm both: one swap, each side gets the other offer once', async () => {
  const w = world(), [a, b] = w.players;
  const id = await w.openTrade(a, b);
  assert.ok(a.trade.setGold(120));
  assert.ok(a.trade.toggle('it_pid0xx_1'));
  assert.ok(b.trade.toggle('it_pid1xx_2'));
  await tickP();
  assert.equal(a.trade.state().theirs.it['it_pid1xx_2'], b.items[1].json, 'A sees what B offers');
  assert.equal(a.trade.confirm(), false, 'Confirm waits for both accepts');
  assert.ok(a.trade.acceptOffer()); await tickP();
  assert.equal(a.trade.confirm(), false, 'still only one accept');
  assert.ok(b.trade.acceptOffer()); await tickP();
  assert.ok(b.trade.state().canConfirm);
  assert.ok(a.trade.confirm()); await tickP();
  assert.ok(!w.store.data.done[id], 'one confirm is not enough');
  assert.ok(b.trade.confirm()); await tickP(); await tickP();
  assert.ok(w.store.data.done[id], 'the swap is written');
  const da = a.events.find((e) => e.type === 'done'), db = b.events.find((e) => e.type === 'done');
  assert.ok(da && db);
  assert.equal(da.give.g, 120); assert.deepEqual(Object.keys(da.give.it), ['it_pid0xx_1']); assert.deepEqual(Object.keys(da.get.it), ['it_pid1xx_2']);
  assert.equal(db.get.g, 120); assert.deepEqual(Object.keys(db.get.it), ['it_pid0xx_1']);
  assert.deepEqual(w.store.data.items, { it_pid0xx_1: { o: 'u1', t: id }, it_pid1xx_2: { o: 'u0', t: id } }, 'the ledger: each item now belongs to its new owner');
  assert.equal(a.events.filter((e) => e.type === 'done').length, 1);
  assert.equal(a.trade.state().phase, 'idle');
});

test('any change resets the accepts (and the confirms)', async () => {
  const w = world(), [a, b] = w.players;
  await w.openTrade(a, b);
  a.trade.setGold(50); await tickP();
  a.trade.acceptOffer(); b.trade.acceptOffer(); await tickP();
  assert.ok(a.trade.state().canConfirm);
  a.trade.confirm(); await tickP();
  assert.ok(b.trade.state().theyConfirmed);
  b.trade.setGold(10); await tickP(); // B changes its offer
  const sa = a.trade.state(), sb = b.trade.state();
  assert.equal(sa.accepted, false, 'A has to accept the new offer');
  assert.equal(sa.confirmed, false);
  assert.equal(sb.accepted, false, "B's own accept is gone too");
  assert.equal(sb.canConfirm, false);
  // A changing its own offer also clears its accept
  a.trade.acceptOffer(); await tickP();
  assert.ok(a.trade.state().accepted);
  a.trade.toggle('it_pid0xx_2'); await tickP();
  assert.equal(a.trade.state().accepted, false);
});

test('the offer follows the bag: an item sold meanwhile or gold spent changes the offer and resets the accepts', async () => {
  const w = world(), [a, b] = w.players;
  await w.openTrade(a, b);
  a.trade.setGold(300); a.trade.toggle('it_pid0xx_1'); a.trade.toggle('it_pid0xx_2'); await tickP();
  a.trade.acceptOffer(); b.trade.acceptOffer(); await tickP();
  a.trade.confirm(); await tickP();
  assert.ok(b.trade.state().theyConfirmed);
  const rev = a.trade.state().mine.rev;
  a.items.splice(0, 1); // A sells the first piece at a shop
  a.gold = 120; // and spends gold
  await w.advance(C.CHECK_MS + 100);
  const sa = a.trade.state(), sb = b.trade.state();
  assert.ok(sa.mine.rev > rev, 'a new offer');
  assert.deepEqual(Object.keys(sa.mine.it), ['it_pid0xx_2'], 'the sold piece is out of the offer');
  assert.equal(sa.mine.g, 120, 'at most the gold A still has');
  assert.equal(sa.confirmed, false); assert.equal(sb.accepted, false, 'B has to accept again');
  assert.deepEqual(Object.keys(sb.theirs.it), ['it_pid0xx_2'], 'B sees the new offer');
  // a piece that changed (upgraded meanwhile) is offered as it is now
  a.items[0].json = JSON.stringify({ id: 'helm0', r: 3 }); await w.advance(C.CHECK_MS + 100);
  assert.equal(b.trade.state().theirs.it['it_pid0xx_2'], a.items[0].json);
});

test('an item already traded away can not be traded again: the swap is refused, nothing moves', async () => {
  const w = world(3), [a, b, c] = w.players;
  const done = async (x, y) => { x.trade.acceptOffer(); y.trade.acceptOffer(); await tickP(); x.trade.confirm(); y.trade.confirm(); await tickP(); await tickP(); };
  await w.openTrade(a, b);
  a.trade.toggle('it_pid0xx_1'); await tickP();
  await done(a, b);
  assert.equal(w.store.data.items.it_pid0xx_1.o, 'u1');
  // A reloads an old save that still has the item, and offers it to C
  c.x = a.x + 10; await w.advance(200);
  const id2 = await w.openTrade(a, c);
  assert.ok(a.trade.toggle('it_pid0xx_1'));
  c.trade.setGold(5); await tickP();
  await done(a, c);
  assert.ok(!w.store.data.done[id2], 'refused');
  assert.equal(w.store.data.items.it_pid0xx_1.o, 'u1', 'still B\'s');
  await w.advance(2000);
  assert.ok(a.events.some((e) => e.type === 'failed' && e.why === 'rejected'));
  assert.ok(!c.events.some((e) => e.type === 'done'));
});

test('decline, cancel, walking apart, a blocked player, a busy player', async () => {
  const w = world(3), [a, b, c] = w.players;
  a.trade.ask(w.remote(a, b)); await tickP();
  b.trade.decline(b.trade.pendingAsk().trade); await tickP();
  assert.ok(w.types(a).includes('declined'));
  assert.equal(a.trade.state().phase, 'idle');
  // cancel by the other side
  await w.openTrade(a, b);
  b.trade.cancel(); await tickP();
  assert.ok(a.events.some((e) => e.type === 'cancelled' && e.why === 'them'));
  assert.equal(a.trade.state().phase, 'idle');
  // walking apart
  await w.openTrade(a, b);
  b.x += C.KEEP_R + 40; await w.advance(300);
  assert.equal(a.trade.state().phase, 'idle');
  assert.equal(b.trade.state().phase, 'idle');
  assert.ok([a, b].some((p) => p.events.some((e) => e.type === 'cancelled' && e.why === 'far')), 'one side saw the other walk off');
  b.x -= C.KEEP_R + 40; await w.advance(300);
  // a blocked player's ask never shows; a busy player declines by itself
  b.blocked.add('u0');
  a.trade.ask(w.remote(a, b)); await tickP();
  assert.equal(b.trade.pendingAsk(), null);
  a.trade.cancel(); b.blocked.clear();
  await w.openTrade(a, b);
  c.x = a.x + 10; await w.advance(200);
  assert.equal(c.trade.ask(w.remote(c, b)), 'sent'); await tickP();
  assert.ok(w.types(c).includes('declined'), 'B is busy');
  // too far to ask
  c.x += 500; await w.advance(200);
  a.trade.cancel(); await tickP();
  assert.equal(a.trade.ask(w.remote(a, c)), 'far');
});

test('offers are bounded: gold up to what you have, items you have, MAX_ITEMS', async () => {
  const w = world(), [a, b] = w.players;
  await w.openTrade(a, b);
  a.trade.setGold(1e9);
  assert.equal(a.trade.state().mine.g, 500, 'not more than you have');
  assert.equal(a.trade.toggle('it_nothere_9'), false);
  const off = SN.trade.cleanOffer({ g: -5, it: Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['it_pidxx_' + i, '{}']).concat([['bad key', '{}']])), rev: 3 });
  assert.equal(off.g, 0);
  assert.equal(Object.keys(off.it).length, C.MAX_ITEMS);
  assert.ok(!('bad key' in off.it));
});
