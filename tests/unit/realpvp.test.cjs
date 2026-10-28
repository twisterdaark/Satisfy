'use strict';
// v3.76 (owner 2026-10-28: "PvP uses your health and your damage, as normal, in a duel and in PK"): with o.hurt a hit
// carries the attacker's real blow; open PvP (src/net/pvp.js) hands it to the victim's o.hurt, which says what share of
// its health it took; a duel (src/net/duel.js) with o.hp as well makes its bar the defender's real health.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/pvp.js', 'src/net/duel.js');
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };

// players with real health: max hp 1000, defence def; a blow k takes round(k*150/(150+def)), a third of max at most
function world(n, o = {}) {
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + i;
    const p = { uid, name: 'P' + i, x: 4000 + i * 20, y: 1500, zone: 'zPlains', max: 1000, hp: 1000, def: 50, dodge: false, events: [], took: [] };
    const take = (k) => { const d = Math.min(Math.round(k * 150 / (150 + p.def)), Math.round(p.max / 3)); return d; };
    p.pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    if (o.pvp) {
      p.pvp = SN.pvp.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, policy: SN.net.zonePolicy,
        hurt: o.legacy ? undefined : (k) => { if (p.dodge) return 0; const d = take(k); p.took.push(d); p.pend = d; return d / p.max * 1000; } });
      p.pvp.on((e) => { p.events.push(e); if (e.type === 'hurt' && p.pend) { p.hp -= p.pend; p.pend = 0; } });
    }
    if (o.duel) {
      p.duel = SN.duel.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, policy: SN.net.zonePolicy,
        hurt: (k) => { if (p.dodge) return 0; const d = take(k); p.took.push(d); if (p.hp - d < 1) { p.hp = 1; return 100; } p.hp -= d; return d / p.max * 100; },
        hp: o.noHp ? undefined : () => p.hp / p.max * 100 });
      p.duel.on((e) => p.events.push(e));
    }
    players.push(p);
  }
  const sync = () => {
    for (const p of players) {
      const pp = SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: p.x, y: p.y, dir: 0 }, { zone: p.zone, uid: p.uid, sid: p.pres.sid });
      p.pres.publish(pp, true);
    }
    for (const p of players) { p.pres.tick(); if (p.duel) p.duel.tick(); }
  };
  const advance = (ms, step = 100) => { for (let k = 0; k < ms; k += step) { t += Math.min(step, ms - k); sync(); } };
  sync(); advance(300);
  const remote = (from, to) => from.pres.remotes().find((r) => r.uid === to.uid);
  const fight = (a, b) => {
    assert.equal(a.duel.challenge(remote(a, b)), 'sent');
    assert.ok(b.duel.accept(b.duel.pendingChallenge().duel));
    a.duel.ready(); b.duel.ready();
    advance(100); advance(SN.duel.C.COUNTDOWN_MS + 100);
    assert.equal(b.duel.state().phase, 'fight');
  };
  return { players, advance, remote, fight };
}

test('open PvP: the real blow goes out whole, and the victim takes what its own defence lets through', () => {
  const w = world(2, { pvp: true }), [a, b] = w.players;
  assert.equal(a.pvp.hit(w.remote(a, b), 1234.4), 1234, 'the blow sent is the real one, not a per mille');
  w.advance(100);
  const h = b.events.filter((e) => e.type === 'hurt');
  assert.equal(h.length, 1);
  assert.equal(h[0].dmg, 1234);
  assert.equal(b.took[0], Math.min(Math.round(1234 * 150 / 200), 333));
  assert.equal(b.hp, 1000 - b.took[0], 'real health');
  assert.ok(Math.abs(h[0].pm - b.took[0]) < 1e-9, 'pm is the share of max health it took (per mille)');
  // a huge blow: a third, never more
  w.advance(1100);
  a.pvp.hit(w.remote(a, b), 5e12);
  w.advance(100);
  assert.equal(b.took[1], 333);
  // a dodge: nothing lands, nothing is recorded
  w.advance(1100);
  b.dodge = true;
  a.pvp.hit(w.remote(a, b), 100);
  w.advance(100);
  assert.equal(b.events.filter((e) => e.type === 'hurt').length, 2);
  assert.equal(b.pvp.recap().lines.length, 2, 'the recap has the two that landed');
  assert.ok(Math.abs(b.pvp.recap().pm - (b.took[0] + b.took[1])) < 1e-9);
});

test('open PvP without o.hurt keeps the old capped share (per mille)', () => {
  const w = world(2, { pvp: true, legacy: true }), [a, b] = w.players;
  assert.equal(a.pvp.hit(w.remote(a, b), 1234), SN.pvp.C.MAX_HIT);
  w.advance(100);
  assert.equal(b.events.find((e) => e.type === 'hurt').pm, SN.pvp.C.MAX_HIT);
});

test('a duel with o.hp: the bar is real health from the start; the blow takes real health; the last one leaves 1 HP and loses', () => {
  const w = world(2, { duel: true }), [a, b] = w.players;
  b.hp = 500;
  w.fight(a, b);
  assert.equal(b.duel.state().hp, 50, 'B starts on half its health, so its bar starts at 50');
  w.advance(300);
  assert.equal(a.duel.state().foeHp, 50, 'and A sees it');
  assert.equal(a.duel.hit(800), 800);
  w.advance(100);
  const d0 = Math.min(Math.round(800 * 150 / 200), 333);
  assert.equal(b.hp, 500 - d0);
  assert.ok(Math.abs(b.duel.state().hp - (500 - d0) / 10) < 1e-9);
  // B heals (a potion): its bar follows, and A's view of it goes up too
  b.hp = 900; w.advance(400);
  assert.ok(Math.abs(b.duel.state().hp - 90) < 1e-9);
  assert.ok(Math.abs(a.duel.state().foeHp - 90) < 1e-9, 'a report of more health stands: health heals');
  // three huge blows: 900 → 567 → 234 → the last would kill: 1 HP, and B loses
  for (let i = 0; i < 3; i++) { w.advance(1100); a.duel.hit(1e9); w.advance(100); }
  assert.equal(b.hp, 1, 'a duel never kills');
  assert.equal(b.duel.state().last.result, 'lose');
  assert.equal(a.duel.state().last.result, 'win');
  // the log rebuilds the same result, from the start at 50 and the heal
  const r = SN.duel.report(b.duel.state().last.log);
  assert.equal(r.result, 'lose');
  assert.equal(r.ok, true, JSON.stringify(r.lines));
  assert.equal(r.hp, 0);
});

test('a duel with o.hurt but no o.hp still keeps a bar of its own (and a report of more is a lie)', () => {
  const w = world(2, { duel: true, noHp: true }), [a, b] = w.players;
  b.hp = 500;
  w.fight(a, b);
  assert.equal(b.duel.state().hp, 100);
  a.duel.hit(800); w.advance(300);
  assert.ok(b.duel.state().hp < 100 && b.duel.state().hp > 0);
});
