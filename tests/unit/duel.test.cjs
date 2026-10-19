'use strict';
// SAT-ONLINE-006 (doc §09 R4): consent-based duels over presence, no server.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/duel.js');
const C = SN.duel.C;
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };

// Two or three players outside town (zPlains) a few pixels apart, on an in-memory hub.
function world(n, o = {}) {
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = (o.uidPrefix || 'u') + i;
    const p = { uid, name: 'P' + i, x: 4000 + i * 30, y: 1500, zone: o.zone || 'zPlains', events: [] };
    p.pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    p.duel = SN.duel.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, policy: SN.net.zonePolicy });
    p.duel.on((e) => p.events.push(e.type + (e.result ? ':' + e.result : '') + (e.why ? ':' + e.why : '')));
    players.push(p);
  }
  const sync = () => {
    for (const p of players) {
      if (p.gone) continue;
      const pp = SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: p.x, y: p.y, dir: 0 },
        { zone: p.zone, uid: p.uid, sid: p.pres.sid });
      p.pres.publish(pp, true);
    }
    for (const p of players) { if (!p.gone) { p.pres.tick(); p.duel.tick(); } }
  };
  const advance = (ms, step = 100) => { for (let k = 0; k < ms; k += step) { t += Math.min(step, ms - k); sync(); } };
  sync(); advance(300);
  const remote = (from, to) => from.pres.remotes().find((r) => r.uid === to.uid);
  // challenge → accept → both ready → countdown over: returns with both in the fight
  const fight = (a, b) => {
    assert.equal(a.duel.challenge(remote(a, b)), 'sent');
    const inv = b.duel.pendingChallenge();
    assert.ok(b.duel.accept(inv.duel));
    a.duel.ready(); b.duel.ready();
    advance(100);
    advance(C.COUNTDOWN_MS + 100);
    assert.equal(a.duel.state().phase, 'fight');
    assert.equal(b.duel.state().phase, 'fight');
  };
  return { players, sync, advance, remote, fight, now: () => t };
}

test('challenge → accept → ready check → countdown → fight', () => {
  const w = world(2), [a, b] = w.players;
  assert.equal(a.duel.challenge(w.remote(a, b)), 'sent');
  assert.equal(a.duel.state().phase, 'asking');
  const inv = b.duel.pendingChallenge();
  assert.equal(inv.handle, 'P0');
  assert.ok(b.duel.accept(inv.duel));
  assert.equal(a.duel.state().phase, 'ready');
  assert.equal(b.duel.state().phase, 'ready');
  a.duel.ready();
  w.advance(500);
  assert.equal(a.duel.state().phase, 'ready', 'the countdown waits for both');
  b.duel.ready();
  w.advance(100);
  const s = a.duel.state();
  assert.equal(s.phase, 'countdown');
  assert.ok(s.countdown > 0 && s.countdown <= C.COUNTDOWN_MS);
  assert.ok(a.duel.locked());
  assert.equal(a.duel.hit(10), 0, 'no hits before the fight');
  w.advance(C.COUNTDOWN_MS + 100);
  assert.equal(a.duel.state().phase, 'fight');
  assert.ok(a.events.includes('fight') && b.events.includes('fight'));
  assert.equal(a.duel.state().arena.r, C.ARENA_R);
});

test('consent: decline, expiry, busy, and only outside safe zones', () => {
  const w = world(3), [a, b, c] = w.players;
  a.duel.challenge(w.remote(a, b));
  b.duel.decline(b.duel.pendingChallenge().duel);
  assert.equal(a.duel.state().phase, 'idle');
  assert.ok(a.events.includes('declined'));
  a.duel.challenge(w.remote(a, b));
  assert.equal(a.duel.challenge(w.remote(a, c)), 'busy', 'one duel at a time');
  w.advance(C.INVITE_MS + 200, 1000);
  assert.equal(b.duel.pendingChallenge(), null);
  assert.equal(a.duel.state().phase, 'idle');
  const t = world(2, { zone: 'zWin' }), [x, y] = t.players;
  assert.equal(x.duel.challenge(t.remote(x, y)), 'safe');
  const f = world(2); f.players[1].x += 300; f.advance(500);
  assert.equal(f.players[0].duel.challenge(f.remote(f.players[0], f.players[1])), 'far');
});

test('hits are normalized, the defender owns its HP, the attacker sees it, HP 0 ends the duel', () => {
  const w = world(2), [a, b] = w.players;
  w.fight(a, b);
  assert.equal(a.duel.hit(999), C.MAX_HIT, 'capped');
  w.advance(300);
  assert.equal(b.duel.state().hp, C.HP - C.MAX_HIT);
  assert.equal(a.duel.state().foeHp, C.HP - C.MAX_HIT, 'duel.hp reply');
  assert.equal(a.duel.hit(1), C.MIN_HIT, 'floored');
  w.advance(300);
  assert.equal(b.duel.state().hp, C.HP - C.MAX_HIT - C.MIN_HIT);
  while (b.duel.state().phase === 'fight') { a.duel.hit(C.MAX_HIT); w.advance(300); }
  assert.equal(b.duel.state().phase, 'over');
  assert.equal(b.duel.state().last.result, 'lose');
  assert.equal(a.duel.state().last.result, 'win');
  assert.equal(a.duel.state().last.why, 'hp');
  w.advance(C.OVER_MS + 200);
  assert.equal(a.duel.state().phase, 'idle');
});

test('the defender rejects hits that come too fast or from out of range', () => {
  const w = world(2), [a, b] = w.players;
  w.fight(a, b);
  for (let i = 0; i < C.HITS_PER_S + 2; i++) a.duel.hit(5); // a burst faster than any weapon can swing
  w.advance(100);
  assert.equal(b.duel.state().hp, C.HP - 5 * C.HITS_PER_S, 'only HITS_PER_S of them count');
  assert.ok(b.events.includes('rejected:rate'));
  w.advance(1100); // a new second
  a.duel.hit(5); w.advance(100);
  assert.equal(b.duel.state().hp, C.HP - 5 * (C.HITS_PER_S + 1));
  // A's client lies about reach: the hit message arrives, but B sees A far away
  w.advance(400);
  for (let i = 0; i < 5; i++) { a.x += 48; w.advance(100); } // walk (a jump would be a teleport) to 210 px from B
  w.advance(500); // B's interpolated view of A catches up
  a.pres.send('duel.hit', { to: 'u1', duel: a.duel.state().duel, k: 10, n: 99 });
  w.advance(100);
  assert.equal(b.duel.state().hp, C.HP - 5 * (C.HITS_PER_S + 1));
  assert.ok(b.events.includes('rejected:range'));
});

test('surrender, leaving the arena, a teleport, a safe zone and a disconnect all end the fight', () => {
  let w = world(2), [a, b] = w.players;
  w.fight(a, b);
  a.duel.yield();
  w.advance(100);
  assert.equal(a.duel.state().last.result, 'lose');
  assert.deepEqual([b.duel.state().last.result, b.duel.state().last.why], ['win', 'yield']);

  w = world(2); [a, b] = w.players;
  w.fight(a, b);
  for (let i = 0; i < 6; i++) { a.x += 60; w.advance(100); } // walk out of the arena
  w.advance(C.OUT_MS + 200);
  assert.deepEqual([a.duel.state().last.result, a.duel.state().last.why], ['lose', 'arena']);
  assert.equal(b.duel.state().last.result, 'win');

  w = world(2); [a, b] = w.players;
  w.fight(a, b);
  a.x += 500; w.advance(100); // coach, unstuck, map travel: anything that jumps
  assert.deepEqual([a.duel.state().last.result, a.duel.state().last.why], ['lose', 'teleport']);

  w = world(2); [a, b] = w.players;
  w.fight(a, b);
  a.zone = 'zWin'; w.advance(100);
  assert.deepEqual([a.duel.state().last.result, a.duel.state().last.why], ['lose', 'safe']);

  w = world(2); [a, b] = w.players;
  w.fight(a, b);
  b.gone = true; b.pres.close();
  w.advance(C.GRACE_MS + 1000, 500);
  assert.deepEqual([a.duel.state().last.result, a.duel.state().last.why], ['win', 'gone']);
});

test('cancel before the fight; the ready check times out', () => {
  let w = world(2), [a, b] = w.players;
  a.duel.challenge(w.remote(a, b));
  b.duel.accept(b.duel.pendingChallenge().duel);
  b.duel.yield();
  w.advance(100);
  assert.equal(a.duel.state().phase, 'idle');
  assert.ok(a.events.includes('cancelled'));
  w = world(2); [a, b] = w.players;
  a.duel.challenge(w.remote(a, b));
  b.duel.accept(b.duel.pendingChallenge().duel);
  a.duel.ready();
  w.advance(C.READY_MS + 500, 500);
  assert.equal(a.duel.state().phase, 'idle');
  assert.equal(b.duel.state().phase, 'idle');
});

test('messages for someone else or another duel are ignored', () => {
  const w = world(3), [a, b, c] = w.players;
  w.fight(a, b);
  const id = a.duel.state().duel;
  c.pres.send('duel.end', { to: 'u0', duel: id, k: 0 });     // C is not A's opponent
  a.pres.send('duel.hit', { to: 'u2', duel: id, k: 10 });    // C is not in the duel
  w.advance(100);
  assert.equal(a.duel.state().phase, 'fight');
  assert.equal(c.duel.state().phase, 'idle');
  assert.equal(c.duel.state().last, null);
});

test('duel ids fit the public duel field for any uid (local transport uids contain ":")', () => {
  const w = world(2, { uidPrefix: 'local:4cef53c75882' }), [a, b] = w.players;
  w.fight(a, b);
  const id = a.duel.state().duel;
  assert.match(id, /^d_[A-Za-z0-9_-]{1,40}$/);
  assert.equal(b.duel.state().duel, id);
  const pp = SN.net.toPlayerPublic({ look: { n: 'P0' }, cls: 'novice', lv: 2, title: '' }, { x: 1, y: 1, dir: 0 }, { duel: id + ':100' });
  assert.equal(pp.duel, id + ':100');
});

test('SAT-ONLINE-019: no challenge where the world defines nothing (zone "void"), from either side', () => {
  const w = world(2), [a, b] = w.players;
  a.zone = 'void'; w.advance(200);
  assert.equal(a.duel.challenge(w.remote(a, b)), 'safe');
  a.zone = 'zPlains'; b.zone = 'void'; w.advance(200);
  assert.equal(a.duel.challenge(w.remote(a, b)), 'safe', 'the other player stands in an undefined place');
  b.zone = 'zPlains'; w.advance(200);
  assert.equal(a.duel.challenge(w.remote(a, b)), 'sent');
});
