'use strict';
// Doc §29 test matrix, network rows: T25 lag (300 ms, 1 s), T26 reordering + duplication, T27 1% loss,
// T19 duplicate duel result, T28 simultaneous party invites, T32 Unicode names, T40 soak with 100 clients.
// Everything runs on a fake clock over tests/harness/netem.cjs, so it is deterministic and fast.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');
const { netem } = require('../harness/netem.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/party.js', 'src/net/duel.js');
const C = SN.duel.C;
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };

// n players in the plains (not a safe zone), 30 px apart, over a netem network.
function world(n, net) {
  let t = 1000; const now = () => t;
  const N = netem({ ...net, now });
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + i;
    const p = { uid, name: 'P' + i, x: 4000 + i * 30, y: 1500, zone: 'zPlains', events: [], results: [] };
    p.pres = SN.presence.create({ transport: N.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    p.party = SN.party.create({ presence: p.pres, uid, now });
    p.duel = SN.duel.create({ presence: p.pres, uid, now, pos: () => ({ x: p.x, y: p.y }), zone: () => p.zone, policy: SN.net.zonePolicy });
    p.party.on((e) => p.events.push('party:' + e.type));
    p.duel.on((e) => { p.events.push('duel:' + e.type); if (e.type === 'result') p.results.push(e.result + ':' + e.why); });
    players.push(p);
  }
  const step = (ms = 50) => {
    t += ms;
    N.pump(t);
    for (const p of players) {
      if (p.gone) continue;
      p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: p.x, y: p.y, dir: 0 },
        { zone: p.zone, uid: p.uid, sid: p.pres.sid, party: p.party.id() }));
      p.pres.tick(); p.party.tick(); p.duel.tick();
    }
  };
  const run = (ms, every = 50) => { for (let k = 0; k < ms; k += every) step(every); };
  const until = (fn, ms, what) => { for (let k = 0; k < ms; k += 50) { if (fn()) return; step(50); } assert.fail('timed out: ' + what); };
  const remote = (from, to) => from.pres.remotes().find((r) => r.uid === to.uid);
  return { players, step, run, until, remote, net: N, now };
}

// The whole duel over a bad network: challenge, accept, ready, countdown, fight to the end.
function duelToTheEnd(w, a, b, budget) {
  w.until(() => w.remote(a, b), budget, 'A sees B');
  assert.equal(a.duel.challenge(w.remote(a, b)), 'sent');
  w.until(() => b.duel.pendingChallenge(), budget, 'challenge arrives');
  assert.ok(b.duel.accept(b.duel.pendingChallenge().duel));
  w.until(() => a.duel.state().phase === 'ready', budget, 'accept arrives');
  a.duel.ready(); b.duel.ready();
  w.until(() => a.duel.state().phase === 'fight' && b.duel.state().phase === 'fight', budget + C.COUNTDOWN_MS, 'both fighting');
  let sent = 0;
  for (let i = 0; i < 60 && b.duel.state().phase === 'fight'; i++) { sent += a.duel.hit(10); w.run(400); }
  w.until(() => a.results.length && b.results.length, budget, 'both see the result');
  return sent;
}

for (const [label, net, budget] of [['T25 300 ms lag', { delay: 300, jitter: 60, seed: 3 }, 4000], ['T25 1 s lag', { delay: 1000, jitter: 200, seed: 5 }, 8000]]) {
  test(`${label}: presence, a party and a whole duel still work`, () => {
    const w = world(2, net), [a, b] = w.players;
    w.until(() => w.remote(a, b) && w.remote(b, a), budget, 'presence');
    assert.equal(a.party.invite(w.remote(a, b)), 'sent');
    w.until(() => b.party.pendingInvite(), budget, 'invite');
    b.party.accept(b.party.pendingInvite().party);
    w.until(() => a.party.members().length === 2 && b.party.members().length === 2, budget, 'party');
    duelToTheEnd(w, a, b, budget);
    assert.deepEqual([a.results, b.results], [['win:hp'], ['lose:hp']]);
  });
}

test('T26 reordering and duplication: every duel hit counts once, one result each', () => {
  const w = world(2, { delay: 120, jitter: 110, dup: 0.5, seed: 11 }), [a, b] = w.players;
  w.until(() => w.remote(a, b), 3000, 'presence');
  assert.equal(a.duel.challenge(w.remote(a, b)), 'sent');
  w.until(() => b.duel.pendingChallenge(), 3000, 'challenge');
  b.duel.accept(b.duel.pendingChallenge().duel);
  w.until(() => a.duel.state().phase === 'ready', 3000, 'accept');
  a.duel.ready(); b.duel.ready();
  w.until(() => b.duel.state().phase === 'fight', 6000, 'fight');
  for (let i = 0; i < 5; i++) { a.duel.hit(10); w.run(400); }
  w.run(1000);
  assert.ok(w.net.stats.duplicated > 0, 'the network did duplicate messages');
  assert.equal(b.duel.state().hp, C.HP - 50, 'five hits of 10, each applied once');
  assert.equal(a.duel.state().foeHp, C.HP - 50, 'and the attacker converges on the same HP');
  a.duel.yield(); w.run(1000);
  assert.deepEqual([a.results, b.results], [['lose:yield'], ['win:yield']]);
});

test('T19 a duplicated duel end gives one result and one record', () => {
  const w = world(2, { delay: 50, dup: 1, seed: 2 }), [a, b] = w.players; // every message arrives twice
  const sent = duelToTheEnd(w, a, b, 4000);
  assert.ok(sent >= C.HP / C.MAX_HIT);
  w.run(2000);
  assert.deepEqual([a.results, b.results], [['win:hp'], ['lose:hp']]);
  assert.equal(b.events.filter((e) => e === 'duel:result').length, 1);
});

test('T27 1% loss: presence stays complete and positions converge', () => {
  const w = world(6, { delay: 80, jitter: 40, loss: 0.01, seed: 9 });
  w.run(2000);
  for (let s = 0; s < 100; s++) { for (const p of w.players) p.x += (s % 20 < 10 ? 2 : -2); w.step(100); }
  w.run(1500);
  assert.ok(w.net.stats.dropped > 0, 'the network did drop messages');
  for (const p of w.players) {
    const rs = p.pres.remotes();
    assert.equal(rs.length, 5, p.uid + ' sees everyone');
    for (const r of rs) {
      const real = w.players.find((q) => q.uid === r.uid);
      assert.ok(Math.abs(r.x - real.x) <= 4, `${p.uid} sees ${r.uid} at ${r.x}, really ${real.x}`);
    }
  }
});

test('T28 simultaneous party invites both bounce; the next invite works', () => {
  const w = world(2, { delay: 100, seed: 4 }), [a, b] = w.players;
  w.until(() => w.remote(a, b) && w.remote(b, a), 2000, 'presence');
  assert.equal(a.party.invite(w.remote(a, b)), 'sent');
  assert.equal(b.party.invite(w.remote(b, a)), 'sent');
  w.run(2000);
  assert.equal(a.party.id(), null, 'each was in its own new party, so each declined the other');
  assert.equal(b.party.id(), null);
  assert.ok(a.events.includes('party:declined') && b.events.includes('party:declined'));
  assert.equal(a.party.invite(w.remote(a, b)), 'sent');
  w.until(() => b.party.pendingInvite(), 2000, 'second invite');
  b.party.accept(b.party.pendingInvite().party);
  w.until(() => a.party.members().length === 2, 2000, 'party formed');
});

test('T32 Unicode names: Arabic and emoji survive, never cut in half, within the limit', () => {
  const { net: N } = SN;
  const ar = N.toPlayerPublic({ look: { n: 'جريد الحداد' }, cls: 'novice', lv: 1 }, { x: 1, y: 1, dir: 0 }, { zone: 'zWin' });
  assert.equal(ar.handle, 'جريد الحداد');
  const emoji = N.toPlayerPublic({ look: { n: '⚔️😀'.repeat(20) }, cls: 'novice', lv: 1 }, { x: 1, y: 1, dir: 0 }, { zone: 'zWin' });
  assert.ok(emoji.handle.length <= N.LIMITS.handle);
  assert.doesNotMatch(emoji.handle, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/, 'no lone surrogate');
  assert.ok(N.validatePlayerPublic(emoji, { world: WORLD }).ok);
  const w = world(2, { delay: 50, seed: 1 }), [a, b] = w.players;
  a.name = 'جريد😀'; w.run(1000);
  assert.equal(w.remote(b, a).handle, 'جريد😀');
});

test('T40 soak: 100 clients for a simulated minute stay bounded and fast', () => {
  let t = 0; const now = () => t;
  const hub = SN.transports.hub(), ps = [];
  for (let i = 0; i < 100; i++) {
    const p = { uid: 'u' + i, x: 2000 + (i % 10) * 40, y: 1200 + Math.floor(i / 10) * 40 };
    p.pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid: p.uid, sid: 'soak' + i + 'xxxxxxxx' });
    ps.push(p);
  }
  const t0 = process.hrtime.bigint();
  for (let s = 0; s < 600; s++) { // 60 s at 10 ticks/s; ten players walk, the rest idle on heartbeats
    t += 100;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (i < 10) p.x += (s % 40 < 20 ? 3 : -3);
      p.pres.publish(SN.net.toPlayerPublic({ look: { n: 'S' + i }, cls: 'novice', lv: 2 }, { x: p.x, y: p.y, dir: 0 }, { zone: 'zPlains', uid: p.uid, sid: p.pres.sid }));
      p.pres.tick();
    }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const max = SN.presence.DEFAULTS ? SN.presence.DEFAULTS.maxRemotes : 64;
  for (const p of ps) assert.ok(p.pres.remotes().length <= max, 'remote table stays bounded');
  assert.ok(ps[50].pres.remotes().length >= Math.min(max, 99) - 1, 'and is full, not empty');
  assert.ok(ms < 30000, `60 simulated seconds of 100 clients took ${ms | 0} ms`);
});
