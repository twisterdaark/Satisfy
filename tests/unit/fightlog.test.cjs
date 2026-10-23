'use strict';
// SAT-ONLINE-150 (plan U039 "PvP combat log: validated damage events with origin, cause and timing; acceptance: the
// report rebuilds a duel's result with its timing"). Each side of a duel logs the fight it saw; Satisfy.duel.report()
// rebuilds the result, the time and the totals from that log alone, on both sides, for a win on HP, a yield, a burst the
// defender turned down and a lie about reach. Open PvP keeps who hurt you and when: Satisfy.pvp's recap of a death.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/duel.js', 'src/net/pvp.js');
const C = SN.duel.C;
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };

function world(n) {
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + i;
    const p = { uid, name: 'P' + i, x: 4000 + i * 30, y: 1500, zone: 'zPlains', events: [], hurts: [] };
    p.pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    p.duel = SN.duel.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, policy: SN.net.zonePolicy });
    p.pvp = SN.pvp.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, party: () => null, policy: SN.net.zonePolicy });
    p.duel.on((e) => p.events.push(e.type));
    players.push(p);
  }
  const sync = () => {
    for (const p of players) {
      const pp = SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: p.x, y: p.y, dir: 0 }, { zone: p.zone, uid: p.uid, sid: p.pres.sid });
      p.pres.publish(pp, true);
    }
    for (const p of players) { p.pres.tick(); p.duel.tick(); }
  };
  const advance = (ms, step = 100) => { for (let k = 0; k < ms; k += step) { t += Math.min(step, ms - k); sync(); } };
  sync(); advance(300);
  const remote = (from, to) => from.pres.remotes().find((r) => r.uid === to.uid);
  const fight = (a, b) => {
    a.duel.challenge(remote(a, b)); b.duel.accept(b.duel.pendingChallenge().duel);
    a.duel.ready(); b.duel.ready(); advance(100); advance(C.COUNTDOWN_MS + 100);
    assert.equal(a.duel.state().phase, 'fight');
  };
  return { players, advance, remote, fight, now: () => t };
}

test('a duel won on HP: both sides rebuild the same result and its time from their own logs', () => {
  const w = world(2), [a, b] = w.players;
  w.fight(a, b);
  const t0 = w.now();
  let hits = 0;
  while (b.duel.state().phase === 'fight') { a.duel.hit(C.MAX_HIT); hits++; w.advance(300); if (hits === 2) { b.duel.hit(C.MIN_HIT); w.advance(300); } }
  const la = a.duel.state().last, lb = b.duel.state().last;
  assert.deepEqual([la.result, lb.result], ['win', 'lose']);
  const ra = SN.duel.report(la.log), rb = SN.duel.report(lb.log);
  assert.equal(rb.ok, true, 'B rebuilt: ' + JSON.stringify(rb, (k, v) => (k === 'lines' ? undefined : v)));
  assert.equal(ra.ok, true, 'A rebuilt');
  assert.deepEqual([rb.result, rb.why, rb.hp], ['lose', 'hp', 0], 'B: lost on HP, at 0');
  assert.deepEqual([ra.result, ra.why, ra.hp, ra.foeHp], ['win', 'hp', C.HP - C.MIN_HIT, 0], 'A: won on HP, hit once for the minimum');
  assert.equal(rb.taken, C.HP, 'B took all its HP');
  assert.equal(rb.hitsIn, Math.ceil(C.HP / C.MAX_HIT));
  assert.equal(ra.hitsOut, hits);
  assert.equal(rb.biggest, C.MAX_HIT);
  assert.equal(ra.dealt, C.HP, "A's damage: all of B's HP, from B's own reports and the end");
  // the timing: from the start of the fight to the last hit, the same on both sides (one clock here), each event in order
  assert.ok(ra.ms > 0 && Math.abs(ra.ms - rb.ms) <= 300, 'the time: ' + ra.ms + ' / ' + rb.ms);
  assert.ok(Math.abs(rb.ms - (w.now() - t0)) <= 700, 'the time it took');
  for (const r of [ra, rb]) for (let i = 1; i < r.lines.length; i++) assert.ok(r.lines[i].ms >= r.lines[i - 1].ms);
  assert.equal(rb.lines.filter((l) => l.e === 'in').map((l) => l.hp).at(-1), 0, 'the last hit took B to 0');
});

test('a yield, a burst the defender turned down, a lie about reach: in the log as they were', () => {
  const w = world(2), [a, b] = w.players;
  w.fight(a, b);
  for (let i = 0; i < C.HITS_PER_S + 2; i++) a.duel.hit(5); // too fast: the defender takes HITS_PER_S of them
  w.advance(100);
  w.advance(1100);
  for (let i = 0; i < 5; i++) { a.x += 48; w.advance(100); } // walks out of reach
  w.advance(500);
  a.pres.send('duel.hit', { to: 'u1', duel: a.duel.state().duel, k: 10, n: 99 }); // and says it hit
  w.advance(100);
  b.duel.yield();
  w.advance(100);
  const rb = SN.duel.report(b.duel.state().last.log), ra = SN.duel.report(a.duel.state().last.log);
  assert.equal(rb.ok, true);
  assert.deepEqual([rb.result, rb.why], ['lose', 'yield']);
  assert.deepEqual([ra.result, ra.why], ['win', 'yield']);
  assert.equal(rb.hitsIn, C.HITS_PER_S, 'the hits it took');
  assert.equal(rb.taken, 5 * C.HITS_PER_S);
  assert.equal(rb.hp, C.HP - 5 * C.HITS_PER_S, 'and the HP they left');
  assert.deepEqual(rb.lines.filter((l) => l.e === 'rej').map((l) => l.why), ['rate', 'rate', 'range'], 'what it turned down, and why');
  assert.ok(ra.hitsOut >= C.HITS_PER_S + 2);
});

test('a log that was changed or cut short does not rebuild', () => {
  const w = world(2), [a, b] = w.players;
  w.fight(a, b);
  while (b.duel.state().phase === 'fight') { a.duel.hit(C.MAX_HIT); w.advance(300); }
  const log = b.duel.state().last.log;
  assert.equal(SN.duel.report(log).ok, true);
  const lost = log.filter((e, i) => !(e.e === 'in' && i === log.findIndex((x) => x.e === 'in'))); // one hit taken out
  assert.equal(SN.duel.report(lost).ok, false);
  const softer = log.map((e) => (e.e === 'in' ? Object.assign({}, e, { k: 1 }) : e));
  assert.equal(SN.duel.report(softer).ok, false);
  assert.equal(SN.duel.report([]).ok, false);
  assert.equal(SN.duel.report(null).result, null);
});

test('open PvP: who hurt you and when, for the last seconds before a death', () => {
  const w = world(3), [a, b, c] = w.players;
  const r = (from, to) => w.remote(from, to);
  const h1 = a.pvp.hit(r(a, c), 10); w.advance(400);
  const h2 = b.pvp.hit(r(b, c), 20); w.advance(400);
  const h3 = a.pvp.hit(r(a, c), 10); w.advance(400);
  assert.ok(h1 > 0 && h2 > 0 && h3 > 0);
  const rc = c.pvp.recap();
  assert.deepEqual(rc.by.map((x) => [x.uid, x.handle, x.hits]), [['u0', 'P0', 2], ['u1', 'P1', 1]], 'the most hits first');
  assert.equal(rc.by[0].pm, h1 + h3, 'per mille of max HP, as the victim applied them');
  assert.equal(rc.pm, h1 + h2 + h3);
  assert.ok(rc.ms >= 700 && rc.ms <= 900, 'from the first hit to the last: ' + rc.ms);
  assert.deepEqual(rc.lines.map((l) => l.uid), ['u0', 'u1', 'u0']);
  // older than the window: gone from the recap
  w.advance(SN.pvp.C.RECAP_MS + 100);
  assert.deepEqual(c.pvp.recap().by, []);
});
