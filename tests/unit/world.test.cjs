'use strict';
// SAT-ONLINE-028 (owner feedback #10, #12): world chat and world notices, over presence (local tabs) and over a
// Firebase-like transport (world/{shard} lines).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/chat.js', 'src/net/world.js');
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 184, y0: -960 };

function local(n) {
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const ps = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + i, blocked = new Set();
    const pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    const w = SN.world.create({ presence: pres, uid, now, blocked: (u) => blocked.has(u), handle: () => 'P' + i });
    const heard = [], notes = [];
    w.on((e) => (e.type === 'note' ? notes : heard).push(e));
    ps.push({ uid, pres, w, heard, notes, blocked });
  }
  const sync = () => {
    for (const [i, p] of ps.entries()) p.pres.publish(SN.net.toPlayerPublic({ look: { n: 'P' + i }, cls: 'novice', lv: 3, title: '' }, { x: 3000 + i * 900, y: 1500, dir: 0 }, { zone: 'zPlains', uid: p.uid, sid: p.pres.sid }), true);
    for (const p of ps) p.pres.tick();
  };
  const advance = (ms) => { for (let k = 0; k < ms; k += 100) { t += 100; sync(); } };
  sync(); advance(300);
  return { ps, advance };
}

test('world chat reaches everyone, party or not; blocked players are hidden', () => {
  const { ps: [a, b, c], advance } = local(3);
  c.blocked.add('u0');
  assert.equal(a.w.say('  hello world  '), 'sent');
  advance(100);
  assert.deepEqual(b.heard.map((l) => [l.handle, l.text]), [['P0', 'hello world']]);
  assert.deepEqual(c.heard, [], 'C blocked A');
  assert.deepEqual(a.w.log().map((l) => [l.self, l.text]), [[true, 'hello world']]);
  assert.equal(a.w.say('again'), 'tooFast');
  advance(SN.world.C.MIN_GAP_MS);
  assert.equal(a.w.say(''), 'empty');
  assert.equal(a.w.say('again'), 'sent');
});

test('world notices: only listed keys travel, as key + short values, and come back as events', () => {
  const { ps: [a, b], advance } = local(2);
  assert.equal(a.w.note('annPagma', { n: 'Grid' }), true);
  assert.equal(a.w.note('brokeT', { it: 'Sword' }), false, 'a personal message is not a world notice');
  assert.equal(a.w.note('drDown', { n: 'x'.repeat(300) }), true);
  advance(100);
  assert.deepEqual(b.notes.map((e) => [e.k, e.p.n.length, e.handle]), [['annPagma', 4, 'P0'], ['drDown', 48, 'P0']]);
  assert.equal(SN.world.parseNote('{"k":"brokeT","p":{}}'), null);
  assert.equal(SN.world.parseNote('nope'), null);
  assert.deepEqual(SN.world.parseNote('{"k":"sgWon","p":{"g":"Lions","BAD":"x","o":{"x":1}}}'), { k: 'sgWon', p: { g: 'Lions' } });
});

test('over a Firebase-like transport: lines go through worldSend / onWorld, never through presence', () => {
  const hub = SN.transports.hub();
  const pres = SN.presence.create({ transport: hub.connect(), now: () => 1, world: WORLD, net: SN.net, uid: 'me', sid: 'sessmexxxxxxxx' });
  const out = []; let deliver = null;
  const tr = { worldSend: (ty, x, h) => out.push([ty, x, h]), onWorld: (fn) => { deliver = fn; } };
  const w = SN.world.create({ presence: pres, transport: tr, uid: 'me', now: () => 5000, handle: () => 'Grid' });
  const got = []; w.on((e) => got.push(e));
  assert.equal(w.say('hi all'), 'sent');
  assert.equal(w.note('arnChamp', { n: 'Grid' }), true);
  assert.deepEqual(out, [['say', 'hi all', 'Grid'], ['note', '{"k":"arnChamp","p":{"n":"Grid"}}', 'Grid']]);
  deliver({ from: 'u9', h: 'Ruby', ty: 'say', x: 'yo\u0000' });
  deliver({ from: 'u9', h: 'Ruby', ty: 'note', x: '{"k":"sgWon","p":{"g":"Lions"}}' });
  deliver({ from: 'me', h: 'Grid', ty: 'say', x: 'my own echo' });
  deliver({ from: 'u9', h: 'Ruby', ty: 'what', x: 'x' });
  assert.deepEqual(got.filter((e) => !e.self).map((e) => e.type === 'line' ? ['line', e.handle, e.text] : ['note', e.k, e.p.g]), [['line', 'Ruby', 'yo'], ['note', 'sgWon', 'Lions']]);
});
