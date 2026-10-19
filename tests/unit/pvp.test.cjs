'use strict';
// SAT-ONLINE-038 (owner 2026-10-19): open PvP outside towns, the way duels work: capped hits that the victim's client
// applies; no friendly fire in a party; a kill makes the killer an outlaw.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/pvp.js');
const C = SN.pvp.C;
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };

function world(n, o = {}) {
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + i;
    const p = { uid, name: 'P' + i, x: 4000 + i * 20, y: 1500, zone: o.zone || 'zPlains', room: null, party: null, duel: false, dead: false, events: [] };
    p.pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    p.pvp = SN.pvp.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, room: () => p.room, party: () => p.party, busy: () => p.duel, alive: () => !p.dead, policy: SN.net.zonePolicy });
    p.pvp.on((e) => p.events.push(e));
    players.push(p);
  }
  const sync = () => {
    for (const p of players) {
      const pp = SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: p.x, y: p.y, dir: 0 },
        { zone: p.zone, room: p.room, uid: p.uid, sid: p.pres.sid, party: p.party, anim: p.dead ? 'dead' : 'idle' });
      p.pres.publish(pp, true);
    }
    for (const p of players) p.pres.tick();
  };
  const advance = (ms, step = 100) => { for (let k = 0; k < ms; k += step) { t += Math.min(step, ms - k); sync(); } };
  sync(); advance(300);
  const remote = (from, to) => from.pres.remotes().find((r) => r.uid === to.uid);
  const hurts = (p) => p.events.filter((e) => e.type === 'hurt');
  return { players, sync, advance, remote, hurts, now: () => t };
}

test('a hit outside town reaches the victim, capped to MIN..MAX per mille of max HP', () => {
  const w = world(2), [a, b] = w.players;
  assert.equal(a.pvp.why(w.remote(a, b)), null);
  assert.equal(a.pvp.hit(w.remote(a, b), 10), 40);
  assert.equal(a.pvp.hit(w.remote(a, b), 1000), C.MAX_HIT, 'a huge blow is capped');
  assert.equal(a.pvp.hit(w.remote(a, b), 0.1), C.MIN_HIT);
  const h = w.hurts(b);
  assert.deepEqual(h.map((e) => e.pm), [40, C.MAX_HIT, C.MIN_HIT]);
  assert.equal(h[0].uid, 'u0');
  assert.equal(h[0].handle, 'P0');
  // a forged huge k is capped by the victim too
  a.pres.send('pvp.hit', { to: 'u1', k: 999999, n: 9 });
  assert.equal(w.hurts(b).at(-1).pm, C.MAX_HIT);
});

test('no hits in a town (either side), in another room, inside a party, during a duel, or on the dead', () => {
  const w = world(2), [a, b] = w.players;
  const tryHit = () => a.pvp.hit(w.remote(a, b), 10);
  b.zone = 'zWin'; w.advance(200);
  assert.equal(a.pvp.why(w.remote(a, b)), 'safe'); assert.equal(tryHit(), 0);
  b.zone = 'zPlains'; a.zone = 'zPat'; w.advance(200);
  assert.equal(tryHit(), 0, 'the attacker in a town can not hit out');
  a.zone = 'void'; w.advance(200);
  assert.equal(a.pvp.why(w.remote(a, b)), 'safe', 'a place the world does not define counts as no-fight');
  a.zone = 'zPlains'; b.room = 'r7'; w.advance(200);
  assert.equal(a.pvp.why(w.remote(a, b)), 'room');
  b.room = null; a.party = b.party = 'p_u0'; w.advance(200);
  assert.equal(a.pvp.why(w.remote(a, b)), 'mate', 'no friendly fire');
  a.party = b.party = null; a.duel = true; w.advance(200);
  assert.equal(a.pvp.why(w.remote(a, b)), 'duel');
  a.duel = false; b.dead = true; w.advance(200);
  assert.equal(a.pvp.why(w.remote(a, b)), 'dead');
  assert.equal(w.hurts(b).length, 0);
  // the victim checks the same things itself: a hit sent anyway from a party mate is rejected
  b.dead = false; a.party = b.party = 'p_u0'; w.advance(200);
  a.pres.send('pvp.hit', { to: 'u1', k: 50, n: 1 });
  assert.equal(w.hurts(b).length, 0);
  assert.equal(b.events.at(-1).why, 'mate');
});

test('the victim rejects hits from too far and more than HITS_PER_S a second', () => {
  const w = world(2), [a, b] = w.players;
  for (let i = 0; i < C.HITS_PER_S + 3; i++) a.pres.send('pvp.hit', { to: 'u1', k: 40, n: i + 1 });
  assert.equal(w.hurts(b).length, C.HITS_PER_S);
  assert.ok(b.events.some((e) => e.why === 'rate'));
  w.advance(1100);
  b.x += C.HIT_RANGE + 50; // the victim's real position is far from where the attacker is
  a.pres.send('pvp.hit', { to: 'u1', k: 40, n: 99 });
  assert.equal(b.events.at(-1).why, 'range');
  // and the attacker's own side sends at most HITS_PER_S a second
  b.x -= C.HIT_RANGE + 50; w.advance(1100);
  let sent = 0; for (let i = 0; i < 10; i++) if (a.pvp.hit(w.remote(a, b), 10)) sent++;
  assert.equal(sent, C.HITS_PER_S);
});

test('a kill report makes the killer an outlaw, only for a player it really hit lately', () => {
  const w = world(3), [a, b, c] = w.players;
  a.pvp.hit(w.remote(a, b), 10);
  b.pvp.died('u0');
  const k = a.events.find((e) => e.type === 'kill');
  assert.ok(k, 'the killer is told');
  assert.equal(k.uid, 'u1'); assert.equal(k.handle, 'P1');
  // C never hit B: a kill report "from B" to C counts for nothing
  b.pvp.died('u2');
  assert.ok(!c.events.some((e) => e.type === 'kill'));
  // too late: a report long after the last hit doesn't count either
  a.pvp.hit(w.remote(a, c), 10);
  w.advance(C.KILL_MS + 500);
  c.pvp.died('u0');
  assert.equal(a.events.filter((e) => e.type === 'kill').length, 1);
});

test('PlayerPublic.ol is 1 or null', () => {
  const pp = (ol) => SN.net.toPlayerPublic({ look: { n: 'X' }, cls: 'novice', lv: 2 }, { x: 1, y: 1, dir: 0 }, { ol });
  assert.equal(pp(true).ol, 1);
  assert.equal(pp(false).ol, null);
  assert.ok(SN.net.validatePlayerPublic(pp(true)).ok);
  assert.deepEqual(SN.net.validatePlayerPublic({ ...pp(true), ol: 2 }).errors, ['ol']);
});
