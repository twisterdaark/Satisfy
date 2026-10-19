'use strict';
// SAT-ONLINE-009 (doc §10 R6): one shared boss HP for a party, one kill, one reward per member.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');
const { netem } = require('../harness/netem.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/party.js', 'src/net/raid.js');
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };
const KEY = 'gchief@2000,1500';

// A fake game per player: one boss copy (its own max HP, as levels roll per client) and a save.
function game(max) {
  const g = { boss: { hp: max, max, dead: false }, saved: [], rewards: 0 };
  g.local = {
    boss: (k) => (k === KEY && !g.boss.dead ? g.boss : null),
    setHp: (k, r) => { g.boss.hp = Math.max(1, Math.round(g.boss.max * r)); },
    kill: () => { g.boss.dead = true; g.boss.hp = 0; g.rewards++; },
    claimed: (e) => g.saved.includes(e),
    claim: (e) => g.saved.push(e),
    damage: (k, n) => { g.boss.hp -= n; if (g.boss.hp <= 0 && !g.boss.dead) { g.boss.dead = true; g.rewards++; g.onKill && g.onKill(); } },
  };
  return g;
}

function world(n, net = {}) {
  let t = 1000; const now = () => t;
  const N = netem({ ...net, now });
  const ps = [];
  for (let i = 0; i < n; i++) {
    const p = { uid: 'u' + i, name: 'P' + i, events: [] };
    p.g = game(1000 + i * 100);
    p.pres = SN.presence.create({ transport: N.connect(), now, world: WORLD, net: SN.net, uid: p.uid, sid: 'sess' + i + 'xxxxxxxx' });
    p.party = SN.party.create({ presence: p.pres, uid: p.uid, now });
    p.raid = SN.raid.create({ presence: p.pres, party: p.party, uid: p.uid, now, local: p.g.local });
    p.raid.on((e) => p.events.push(e.type));
    p.g.onKill = () => p.raid.killed(KEY);
    ps.push(p);
  }
  const step = (ms = 50) => {
    t += ms; N.pump(t);
    for (const p of ps) {
      if (p.gone) continue;
      p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 9 }, { x: 4000, y: 1500, dir: 0 }, { zone: 'zCanyon', uid: p.uid, sid: p.pres.sid, party: p.party.id() }));
      p.pres.tick(); p.party.tick(); p.raid.tick();
    }
  };
  const run = (ms) => { for (let k = 0; k < ms; k += 50) step(50); };
  // the first player leads a party with everyone else
  run(300);
  for (const p of ps.slice(1)) {
    ps[0].party.invite(ps[0].pres.remotes().find((r) => r.uid === p.uid));
    run(300);
    p.party.accept(p.party.pendingInvite().party);
    run(300);
  }
  return { ps, run, net: N };
}
// a member's hit the way the game does it: apply locally, then hand it to the raid
function memberHit(p, k) { p.g.boss.hp -= k; if (p.raid.hit(KEY, k)) p.g.boss.hp += k; }
function hostHit(p, k) { p.raid.hit(KEY, k); p.g.local.damage(KEY, k); p.raid.touch(KEY); }

test('member hits land on the host\'s boss; everyone sees the same HP share', () => {
  const w = world(3), [h, a, b] = w.ps;
  assert.ok(h.raid.isHost() && a.raid.isMember() && b.raid.isMember());
  memberHit(a, 100); memberHit(b, 150); hostHit(h, 50);
  w.run(600);
  assert.equal(h.g.boss.hp, 1000 - 300, 'the host applied all three hits');
  const share = h.g.boss.hp / h.g.boss.max;
  for (const p of [a, b]) assert.ok(Math.abs(p.g.boss.hp / p.g.boss.max - share) < 0.002, p.uid + ' shows the host\'s HP share');
  assert.deepEqual(h.raid.encounters()[KEY].hitters.sort(), ['u0', 'u1', 'u2']);
});

test('one death, one reward each, even when every message arrives twice; a reload pays nothing more', () => {
  const w = world(3, { delay: 40, dup: 1, seed: 3 }), [h, a, b] = w.ps;
  memberHit(a, 400); w.run(300);
  memberHit(b, 400); w.run(300);
  hostHit(h, 400); w.run(600);
  assert.equal(h.g.boss.dead, true);
  assert.deepEqual([h.g.rewards, a.g.rewards, b.g.rewards], [1, 1, 1]);
  assert.equal(w.net.stats.duplicated > 0, true, 'the network duplicated messages (presence drops the copies)');
  // a member "reloads": same save, a fresh boss copy, and the host sends the same kill again
  const encId = a.g.saved[0], id = encId.slice(encId.indexOf(':') + 1);
  a.g.boss = { hp: 1100, max: 1100, dead: false };
  h.pres.send('raid.kill', { to: 'u1', raid: KEY + '~' + id });
  w.run(300);
  assert.ok(a.events.includes('duplicate'), 'already claimed');
  assert.equal(a.g.boss.dead, false, 'the new copy is not killed by an old message');
  assert.deepEqual([a.g.rewards, a.g.saved.length, b.g.saved.length], [1, 1, 1]);
});

test('only members who hit the boss get the kill; outsiders and non-hosts are ignored', () => {
  const w = world(3), [h, a, b] = w.ps;
  memberHit(a, 999); w.run(300);
  hostHit(h, 999); w.run(500);
  assert.deepEqual([a.g.rewards, b.g.rewards], [1, 0], 'b never hit it');
  // a non-host can't kill anyone's boss, and a stranger's hits are not applied
  const before = b.g.boss.hp;
  a.pres.send('raid.kill', { to: 'u2', raid: KEY + '~zzz' });
  a.pres.send('raid.state', { to: 'u2', raid: KEY, k: 1, n: 1000 });
  w.run(200);
  assert.equal(b.g.boss.dead, false);
  assert.equal(b.g.boss.hp, before);
});

test('when the host leaves, members fight their own boss again', () => {
  const w = world(2), [h, a] = w.ps;
  memberHit(a, 100); w.run(300);
  assert.equal(a.g.boss.hp, a.g.boss.max * (900 / 1000));
  h.gone = true; h.pres.close();
  w.run(SN.party.GRACE_MS + 1000);
  assert.equal(a.raid.isMember(), false);
  const hp = a.g.boss.hp;
  memberHit(a, 100);
  assert.equal(a.g.boss.hp, hp - 100, 'damage stays local');
});

test('outside a party nothing changes', () => {
  const hub = SN.transports.hub(), g = game(500);
  const pres = SN.presence.create({ transport: hub.connect(), now: () => 0, world: WORLD, net: SN.net, uid: 'solo', sid: 'solosolosolo1' });
  const party = SN.party.create({ presence: pres, uid: 'solo', now: () => 0 });
  const raid = SN.raid.create({ presence: pres, party, uid: 'solo', local: g.local });
  assert.equal(raid.hit(KEY, 50), false);
  assert.equal(raid.isHost() || raid.isMember(), false);
});

// review fix (#29)
test('a boss the host does not have (or has not confirmed lately) takes the member\'s own hits', () => {
  const w = world(2), [h, a] = w.ps;
  h.g.boss.dead = true;                   // the host killed it solo (respawning), or it's a tower/trial boss only we have
  memberHit(a, 100); w.run(300);
  memberHit(a, 100); w.run(300);
  assert.equal(a.g.boss.hp, a.g.boss.max - 200, 'both hits stayed on the member\'s copy');
  h.g.boss = { hp: 1000, max: 1000, dead: false };
  memberHit(a, 50); w.run(300);            // the first hit lands on both copies; the host confirms with raid.state
  assert.equal(h.g.boss.hp, 950);
  assert.ok(Math.abs(a.g.boss.hp / a.g.boss.max - 0.95) < 0.002, 'the member shows the host\'s HP');
  assert.equal(a.raid.hit(KEY, 10), true, 'confirmed: the next hit goes to the host only');
  w.run(SN.raid.C.CONFIRM_MS + 300);
  assert.equal(a.raid.hit(KEY, 10), false, 'no raid.state for CONFIRM_MS: back to local damage');
});
