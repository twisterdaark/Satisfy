'use strict';
// SAT-ONLINE-046 (owner 2026-10-19, Claude-B handoff #13 item 21): guilds in the database. A founder becomes the master;
// the master and officers invite; an invited player joins by itself; ranks decide who may kick, promote and disband.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/guild.js');
const G = SN.guild, C = G.C;
const tick = () => new Promise((r) => setImmediate(r));

function world(names) {
  const db = G.memoryStore();
  let t = 1000;
  const ps = {};
  for (const [uid, n] of names) {
    const p = ps[uid] = { uid, n, events: [] };
    p.g = G.create({ store: db.as(uid), uid, handle: () => p.n, now: () => t, serverNow: () => t });
    p.g.on((e) => p.events.push(e));
    p.g.start(null);
  }
  return { db, ps, adv: (ms) => { t += ms; db.setClock(t); for (const k in ps) ps[k].g.tick(); }, types: (p) => p.events.map((e) => e.type) };
}

test('names: trimmed, single spaces, 2-18 characters, nothing a database key cannot hold; one guild per founder', () => {
  assert.equal(G.validName('  Black   Dragons '), 'Black Dragons');
  assert.equal(G.validName('عائلة الحداد'), 'عائلة الحداد');
  for (const bad of ['', 'x', 'a'.repeat(19), 'a.b', 'a/b', 'a#b', 'a$b', 'a[b]']) assert.equal(G.validName(bad), null, bad);
  assert.equal(G.nameKey('Black Dragons'), 'black dragons');
  assert.equal(G.gidOf('abcDEF123'), 'g_abcDEF123');
  assert.equal(G.gidOf('bad uid!'), null);
  // ranks: m > o > r
  assert.ok(G.can('m', 'invite') && G.can('o', 'invite') && !G.can('r', 'invite'));
  assert.ok(G.can('m', 'kick', 'o') && G.can('o', 'kick', 'r') && !G.can('o', 'kick', 'o') && !G.can('o', 'kick', 'm') && !G.can('r', 'kick', 'r'));
  assert.ok(G.can('m', 'rank', 'r') && G.can('m', 'rank', 'o') && !G.can('o', 'rank', 'r'));
  assert.ok(G.can('m', 'disband') && !G.can('o', 'disband'));
  assert.ok(!G.can('m', 'leave') && G.can('o', 'leave') && G.can('r', 'leave'));
});

test('found, invite, join; the name is unique; the member list and the experience are shared', async () => {
  const w = world([['uA', 'Grid'], ['uB', 'Faker'], ['uC', 'Ruby']]), { uA: a, uB: b, uC: c } = w.ps;
  assert.equal(await a.g.found(' Black  Dragons '), 'g_uA');
  await tick();
  assert.equal(a.g.state().rank, 'm');
  assert.equal(a.g.state().guild.name, 'Black Dragons');
  assert.ok(w.types(a).includes('joined'));
  await assert.rejects(b.g.found('black dragons'), /taken/, 'the name is taken, in any case');
  await assert.rejects(a.g.found('Second'), /busy/, 'one guild at a time');
  // B joins only by an invitation
  await assert.rejects(b.g.accept('g_uA'), /gone/);
  await a.g.invite('uB'); await tick();
  assert.deepEqual(b.g.state().invites.map((i) => [i.gid, i.n, i.byN]), [['g_uA', 'Black Dragons', 'Grid']]);
  assert.ok(w.types(b).includes('invited'));
  await b.g.accept('g_uA'); await tick();
  assert.equal(b.g.state().rank, 'r');
  assert.deepEqual(b.g.state().invites, [], 'the invitation is used up');
  assert.deepEqual(Object.keys(a.g.state().members).sort(), ['uA', 'uB'], 'A sees B in the list');
  // a member can't invite; C declines A's invitation
  await assert.rejects(b.g.invite('uC'), /rank/);
  await a.g.invite('uC'); await tick();
  await c.g.decline('g_uA'); await tick();
  assert.deepEqual(c.g.state().invites, []);
  await assert.rejects(c.g.accept('g_uA'), /gone/);
  // contributions add up to the guild's experience, written with the heartbeat
  a.g.contribute(300); b.g.contribute(200);
  w.adv(C.BEAT_MS); await tick();
  assert.equal(a.g.state().xp, 500);
  assert.equal(b.g.state().xp, 500);
  // who is online: seen in the last ON_MS
  w.adv(C.ON_MS + 1); // B stops beating: drop it from the clock
  const mA = a.g.state().members;
  assert.ok(a.g.online(mA.uA));
});

test('ranks: the master makes officers; an officer invites and kicks members, not officers; kicked and disbanded players are told', async () => {
  const w = world([['uA', 'Grid'], ['uB', 'Faker'], ['uC', 'Ruby'], ['uD', 'Kraugel']]), { uA: a, uB: b, uC: c, uD: d } = w.ps;
  await a.g.found('Tzedakah');
  for (const p of [b, c]) { await a.g.invite(p.uid); await tick(); await p.g.accept('g_uA'); await tick(); }
  await assert.rejects(b.g.setRank('uC', 'o'), /rank/, 'only the master gives ranks');
  await a.g.setRank('uB', 'o'); await tick();
  assert.equal(b.g.state().rank, 'o');
  await b.g.invite('uD'); await tick();
  await d.g.accept('g_uA'); await tick();
  assert.equal(Object.keys(a.g.state().members).length, 4);
  await assert.rejects(b.g.kick('uA'), /rank/, 'an officer cannot kick the master');
  await a.g.setRank('uC', 'o'); await tick();
  await assert.rejects(b.g.kick('uC'), /rank/, 'nor another officer');
  await b.g.kick('uD'); await tick();
  assert.equal(d.g.state().gid, null);
  assert.deepEqual(d.events.filter((e) => e.type === 'left').map((e) => e.why), ['kicked']);
  // C leaves; the master can't leave (it disbands)
  await c.g.leave(); await tick();
  assert.deepEqual(c.events.filter((e) => e.type === 'left').map((e) => e.why), ['left']);
  await assert.rejects(a.g.leave(), /rank/);
  await a.g.disband(); await tick();
  assert.equal(b.g.state().gid, null);
  assert.deepEqual(b.events.filter((e) => e.type === 'left').map((e) => e.why), ['disbanded']);
  assert.deepEqual(w.db.data.guilds, {});
  assert.deepEqual(w.db.data.names, {}, 'the name is free again');
  assert.equal(await d.g.found('Tzedakah'), 'g_uD');
});

test('start with the save\'s guild id: a member is back in; a player kicked while away is told once', async () => {
  const w = world([['uA', 'Grid'], ['uB', 'Faker']]), { uA: a, uB: b } = w.ps;
  await a.g.found('Snake'); await a.g.invite('uB'); await tick(); await b.g.accept('g_uA'); await tick();
  // B comes back later (a new session)
  const b2 = G.create({ store: w.db.as('uB'), uid: 'uB', handle: () => 'Faker' }), ev = [];
  b2.on((e) => ev.push(e));
  b2.start('g_uA'); await tick();
  assert.equal(b2.state().rank, 'r');
  assert.deepEqual(ev.filter((e) => e.type === 'joined').map((e) => e.why), ['start'], 'the glue says nothing for a start');
  b2.stop();
  // kicked while away
  await a.g.kick('uB'); await tick();
  const b3 = G.create({ store: w.db.as('uB'), uid: 'uB', handle: () => 'Faker' }), ev3 = [];
  b3.on((e) => ev3.push(e));
  b3.start('g_uA'); await tick();
  assert.equal(b3.state().gid, null);
  assert.deepEqual(ev3.filter((e) => e.type === 'left').map((e) => e.why), ['gone']);
  // a guild id that is not a guild id is ignored
  const b4 = G.create({ store: w.db.as('uB'), uid: 'uB', handle: () => 'Faker' });
  b4.start('g_bad id'); await tick();
  assert.equal(b4.state().gid, null);
});

test('old invitations expire; a guild full of members takes no more', async () => {
  const w = world([['uA', 'Grid'], ['uB', 'Faker']]), { uA: a, uB: b } = w.ps;
  await a.g.found('Giant'); await a.g.invite('uB'); await tick();
  assert.equal(b.g.state().invites.length, 1);
  // B's view of an invitation older than INV_MS: dropped on the next update of the list
  const b2 = G.create({ store: w.db.as('uB'), uid: 'uB', handle: () => 'Faker', serverNow: () => 1000 + C.INV_MS + 10 });
  b2.start(null); await tick();
  assert.equal(b2.state().invites.length, 0);
});
