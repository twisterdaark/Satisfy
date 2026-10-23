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
    const p = { uid, name: 'P' + i, x: 4000 + i * 20, y: 1500, zone: o.zone || 'zPlains', room: null, party: null, duel: false, dead: false, allies: [], events: [] };
    p.pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    p.pvp = SN.pvp.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, room: () => p.room, party: () => p.party, ally: (r) => p.allies.includes(r.uid), busy: () => p.duel, alive: () => !p.dead, policy: SN.net.zonePolicy, zoneAt: o.zoneAt });
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
  // SAT-ONLINE-085: nor between allied guilds, checked by the victim too
  a.party = b.party = null; a.allies = ['u1']; w.advance(200);
  assert.equal(a.pvp.why(w.remote(a, b)), 'ally');
  b.allies = ['u0']; a.pres.send('pvp.hit', { to: 'u1', k: 50, n: 2 }); w.advance(100);
  assert.equal(w.hurts(b).length, 0);
  assert.equal(b.events.at(-1).why, 'ally');
});

// plan U026/U027 (Safe Bairan, Safe Winston): from inside a town no player damage can be received. The victim's client
// applies hits, and its own zone is the one it checks: a modified attacker that skips its checks gets nowhere.
test('in a town no hit lands, whatever a modified attacker sends or says about where it is', () => {
  const town = (x) => (x < 4010 ? 'zWin' : 'zPlains'); // a town's edge between the two, on everyone's map
  const w = world(2, { zoneAt: town }), [a, b] = w.players;
  // B inside Winston, A outside: A skips its own checks and sends hits straight away
  b.zone = 'zWin'; b.x = 4000; a.x = 4030; w.advance(200);
  for (let i = 0; i < 3; i++) a.pres.send('pvp.hit', { to: 'u1', k: 90, n: 100 + i });
  assert.equal(w.hurts(b).length, 0, 'nothing taken in town');
  assert.equal(b.events.at(-1).why, 'safe');
  // nor when A also says it is in the town with B, or anywhere else
  a.zone = 'zWin'; a.x = 4005; w.advance(200);
  a.pres.send('pvp.hit', { to: 'u1', k: 90, n: 200 });
  assert.equal(w.hurts(b).length, 0);
  // A standing in the town names the field as its zone: B, outside, checks where A really is on its own map
  b.zone = 'zPlains'; b.x = 4030; a.zone = 'zPlains'; a.x = 4000; w.advance(200);
  assert.equal(b.pvp.why(w.remote(b, a)), 'safe', 'A is in the town on B\'s map');
  a.pres.send('pvp.hit', { to: 'u1', k: 90, n: 300 });
  assert.equal(w.hurts(b).length, 0, 'no hitting out of a town');
  assert.equal(b.events.at(-1).why, 'safe');
  // both outside: the same hit lands (the check above is the zone, nothing else)
  a.x = 4020; w.advance(200);
  a.pres.send('pvp.hit', { to: 'u1', k: 90, n: 400 });
  assert.equal(w.hurts(b).length, 1);
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

test('PlayerPublic.ol is 1 (an outlaw), 2 (a murderer, SAT-ONLINE-052) or null', () => {
  const pp = (ol) => SN.net.toPlayerPublic({ look: { n: 'X' }, cls: 'novice', lv: 2 }, { x: 1, y: 1, dir: 0 }, { ol });
  assert.equal(pp(true).ol, 1);
  assert.equal(pp(1).ol, 1);
  assert.equal(pp(2).ol, 2);
  assert.equal(pp(false).ol, null);
  assert.ok(SN.net.validatePlayerPublic(pp(true)).ok);
  assert.ok(SN.net.validatePlayerPublic(pp(2)).ok);
  assert.deepEqual(SN.net.validatePlayerPublic({ ...pp(true), ol: 3 }).errors, ['ol']);
});

// plan U041 (PvP CC immunity; acceptance: "the target is never locked beyond the limit"). No crowd control crosses between
// players: a hit is its damage and nothing else, whatever a modified attacker adds to it, so the limit is zero. Should a stun,
// a root or a knockback ever travel with a player's hit, it has to come through here and be given diminishing returns.
test('U041: a hit carries only its damage; stun, root, slow or knockback added by a modified attacker never reach the victim', () => {
  const w = world(2), [a, b] = w.players;
  const forged = { to: 'u1', k: 60, n: 7, stun: 9000, root: 9000, slow: 9000, kb: 400, pull: 400, kx: 300, ky: 300, cc: 'lock', x: 0, y: 0 };
  a.pres.send('pvp.hit', forged);
  const h = w.hurts(b);
  assert.equal(h.length, 1, 'the damage lands');
  assert.deepEqual(Object.keys(h[0]).sort(), ['handle', 'pm', 'type', 'uid'], 'and is all that does: ' + JSON.stringify(h[0]));
  assert.equal(h[0].pm, 60);
  // the duel's hit is the same: damage and the HP after it, nothing more
  const D = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/duel.js');
  const hub = D.transports.hub(); let t = 1000; const now = () => t, ev = [];
  const mk = (i) => { const p = { uid: 'd' + i, x: 4000 + i * 30, y: 1500 }; p.pres = D.presence.create({ transport: hub.connect(), now, world: WORLD, net: D.net, uid: p.uid, sid: 'dsess' + i + 'xxxxxxx' }); p.duel = D.duel.create({ presence: p.pres, uid: p.uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => 'zPlains', policy: D.net.zonePolicy }); return p; };
  const x = mk(0), y = mk(1);
  const sync = () => { for (const p of [x, y]) p.pres.publish(D.net.toPlayerPublic({ look: { n: p.uid }, cls: 'novice', lv: 2, title: '' }, { x: p.x, y: p.y, dir: 0 }, { zone: 'zPlains', uid: p.uid, sid: p.pres.sid }), true); for (const p of [x, y]) { p.pres.tick(); p.duel.tick(); } };
  const adv = (ms) => { for (let k = 0; k < ms; k += 100) { t += 100; sync(); } };
  y.duel.on((e) => ev.push(e));
  sync(); adv(300);
  x.duel.challenge(x.pres.remotes().find((r) => r.uid === 'd1')); y.duel.accept(y.duel.pendingChallenge().duel); x.duel.ready(); y.duel.ready();
  adv(100); adv(D.duel.C.COUNTDOWN_MS + 100);
  assert.equal(y.duel.state().phase, 'fight');
  x.pres.send('duel.hit', { to: 'd1', duel: x.duel.state().duel, k: 20, n: 1, stun: 9000, root: 9000, kb: 400 });
  const hd = ev.filter((e) => e.type === 'hurt');
  assert.equal(hd.length, 1);
  assert.deepEqual(Object.keys(hd[0]).sort(), ['dmg', 'hp', 'type'], JSON.stringify(hd[0]));
});
