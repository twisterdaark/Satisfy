'use strict';
// SAT-ONLINE-005 (doc §05 R0.5, §10): domain events with request ids and idempotency keys.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const { events: E, ids: I } = loadModules('src/core/ids.js', 'src/core/events.js');
const mk = (o) => E.create({ uuid: I.uuid, pid: () => 'p_abcdefghijklmnopqrst', now: () => 12.34, ...o });

test('emit: request id, key, type, character, game clock, copied payload', () => {
  const ev = mk(), p = { monster: 'rabbit', n: 1 };
  const e = ev.emit('monster.kill', p, 'k1');
  assert.ok(I.isUuid(e.id));
  assert.deepEqual({ ...e, id: 0 }, { id: 0, key: 'k1', type: 'monster.kill', pid: 'p_abcdefghijklmnopqrst', at: 12.3, payload: p });
  p.n = 99;
  assert.equal(ev.log()[0].payload.n, 1, 'payload copied at emit time');
});

test('the same key is applied once; null keys are never deduplicated', () => {
  const ev = mk();
  assert.ok(ev.emit('quest.reward.claimed', { quest: 'kh1' }, 'claim:kh1'));
  assert.equal(ev.emit('quest.reward.claimed', { quest: 'kh1' }, 'claim:kh1'), null);
  assert.ok(ev.seen('claim:kh1'));
  assert.ok(ev.emit('quest.reward.claimed', { quest: 'rep' }, null));
  assert.ok(ev.emit('quest.reward.claimed', { quest: 'rep' }, null));
  assert.equal(ev.log().length, 3);
  assert.notEqual(ev.log()[1].id, ev.log()[2].id, 'every request gets its own id');
});

test('unknown types are a programming error', () => {
  assert.throws(() => mk().emit('gold.add', {}), /unknown type/);
  assert.deepEqual([...E.TYPES], ['monster.kill', 'craft.item.created', 'quest.reward.claimed']);
});

test('listeners get each event once and cannot break the emitter', () => {
  const ev = mk(), got = [];
  const off = ev.on((e) => got.push(e.key));
  ev.on(() => { throw new Error('bad listener'); });
  ev.emit('monster.kill', {}, 'a');
  ev.emit('monster.kill', {}, 'a');
  off();
  ev.emit('monster.kill', {}, 'b');
  assert.deepEqual(got, ['a']);
});

test('log is bounded, reset forgets keys, no character on the title screen', () => {
  const ev = mk({ pid: () => null });
  for (let i = 0; i < E.LOG_MAX + 25; i++) ev.emit('monster.kill', { i }, 'k' + i);
  const log = ev.log();
  assert.equal(log.length, E.LOG_MAX);
  assert.equal(log[0].payload.i, 25, 'oldest dropped first');
  assert.equal(log[0].pid, null);
  ev.reset();
  assert.equal(ev.log().length, 0);
  assert.ok(ev.emit('monster.kill', {}, 'k0'), 'after reset the key is new again');
  assert.throws(() => E.create({}), /uuid/);
});
