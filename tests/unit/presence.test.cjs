'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js');
const WORLD = { id: 'satisfy', tile: 16, w: 160, h: 144 };

function clock() { let t = 0; const f = () => t; f.at = (v) => { t = v; }; f.add = (d) => { t += d; }; return f; }
function pp(sid, over) {
  return { ...SN.net.toPlayerPublic({ look: { n: 'P-' + sid.slice(0, 4), hair: 1, hc: 0, skin: 0, top: 0 }, cls: 'novice', lv: 3, title: '' },
    { x: 2024, y: 1354, dir: 0 }, { zone: 'zWin', sid, uid: 'local:' + sid }), ...over };
}
function pair(config) {
  const hub = SN.transports.hub(), now = clock();
  const a = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, config });
  const b = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, config });
  return { hub, now, a, b };
}

test('two clients see each other; join and leave events', () => {
  const { a, b, now } = pair();
  const evB = [];
  b.on((e) => evB.push(e.type));
  assert.equal(a.publish(pp(a.sid)), true);
  assert.equal(b.count(), 1);
  assert.equal(b.remotes()[0].handle, 'P-' + a.sid.slice(0, 4));
  b.publish(pp(b.sid));
  assert.equal(a.count(), 1);
  now.add(10);
  a.close();
  assert.equal(b.count(), 0);
  assert.deepEqual(evB, ['join', 'leave']);
  assert.notEqual(a.sid, b.sid);
});

test('rate: 10 Hz while moving, 1 Hz heartbeat when idle, metadata changes go out at once', () => {
  const { a, b, now } = pair();
  assert.equal(a.publish(pp(a.sid)), true);
  now.add(50); assert.equal(a.publish(pp(a.sid, { x: 2030 })), false, 'too soon while moving');
  now.add(60); assert.equal(a.publish(pp(a.sid, { x: 2030 })), true, '110 ms later');
  now.add(500); assert.equal(a.publish(pp(a.sid, { x: 2030 })), false, 'idle: wait for the 1 s heartbeat');
  now.add(600); assert.equal(a.publish(pp(a.sid, { x: 2030 })), true);
  now.add(10); assert.equal(a.publish(pp(a.sid, { x: 2030, room: 'r7' })), true, 'entering a room is sent immediately');
  assert.equal(b.get(a.sid).room, 'r7');
});

test('interpolation draws remotes 100 ms in the past; large jumps snap', () => {
  const { a, b, now } = pair({ moveHz: 1000 });
  now.at(1000); a.publish(pp(a.sid, { x: 100 }));
  now.at(1100); a.publish(pp(a.sid, { x: 140 }));
  now.at(1150);
  assert.equal(b.remotes()[0].x, 120);
  now.at(1300);
  assert.equal(b.remotes()[0].x, 140, 'past the last snapshot: hold it');
  now.at(1400); a.publish(pp(a.sid, { x: 900 }));
  now.at(1450);
  assert.equal(b.remotes()[0].x, 900, 'a 700 px jump (door/teleport) is not interpolated');
});

test('silent players expire after 5 s', () => {
  const { a, b, now } = pair();
  const ev = [];
  b.on((e) => ev.push(e));
  a.publish(pp(a.sid));
  now.add(4900); b.tick(); assert.equal(b.count(), 1);
  now.add(200); b.tick(); assert.equal(b.count(), 0);
  assert.equal(ev.at(-1).reason, 'timeout');
});

test('untrusted input: invalid, spoofed, replayed and flooding messages are dropped', () => {
  const hub = SN.transports.hub(), now = clock();
  const b = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net });
  const evil = hub.connect();
  const env = (seq, payload, over) => ({ v: 1, type: 'presence.state', requestId: null, sessionId: 'evil1', seq, tick: 0, payload, ...over });
  evil.send(env(1, { ...pp('evil1'), gold: 999999 }));
  evil.send(env(2, pp('someone-else')));
  evil.send(env(3, { ...pp('evil1'), x: -50 }));
  evil.send(env(4, pp('evil1'), { v: 99 }));
  evil.send('not an envelope');
  assert.equal(b.count(), 0);
  evil.send(env(10, pp('evil1')));
  assert.equal(b.count(), 1);
  evil.send(env(10, { ...pp('evil1'), x: 50 }));
  evil.send(env(9, { ...pp('evil1'), x: 60 }));
  assert.equal(b.get('evil1').x, 2024, 'replayed and older seq ignored');
  for (let i = 0; i < 100; i++) evil.send(env(11 + i, { ...pp('evil1'), x: 100 + i }));
  assert.ok(b.get('evil1').x < 130, 'per-second budget enforced');
  assert.ok(b.stats().dropped >= 75);
  evil.send({ v: 1, type: 'presence.leave', sessionId: 'evil1', seq: 5, payload: {} });
  assert.equal(b.count(), 1, 'a replayed leave cannot kick a player');
});

test('remote table is bounded', () => {
  const hub = SN.transports.hub(), now = clock();
  const b = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, config: { maxRemotes: 3 } });
  const t = hub.connect();
  for (let i = 0; i < 10; i++) t.send({ v: 1, type: 'presence.state', sessionId: 's' + i, seq: 1, tick: 0, payload: pp('s' + i) });
  assert.equal(b.count(), 3);
});

test('other message types reach listeners only from known players', () => {
  const { a, b } = pair();
  const got = [];
  b.on((e) => { if (e.type === 'message') got.push(e.env.type); });
  a.send('party.invite', { to: b.sid });
  assert.deepEqual(got, [], 'unknown sender');
  a.publish(pp(a.sid));
  a.send('party.invite', { to: b.sid });
  assert.deepEqual(got, ['party.invite']);
});

test('remotes() returns copies', () => {
  const { a, b } = pair();
  a.publish(pp(a.sid));
  b.remotes()[0].handle = 'hacked';
  assert.notEqual(b.remotes()[0].handle, 'hacked');
});
