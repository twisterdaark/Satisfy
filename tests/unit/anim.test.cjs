'use strict';
// SAT-ONLINE-114 (plan U312): the animation state machine (src/core/anim.js): ranks, timed states that end by time,
// pulses that extend, a lower state that outlives a higher one, the hurt flash, clear(); and it never schedules anything.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const { anim: A } = loadModules('src/core/anim.js');

test('ranks: dead over dodge over hurt over attack over walk over idle', () => {
  const m = A.create();
  assert.equal(m.state(0), 'idle');
  m.set('walk', true); assert.equal(m.state(0), 'walk');
  m.pulse('attack', 0); assert.equal(m.state(10), 'attack');
  m.pulse('hurt', 10); assert.equal(m.state(20), 'hurt');
  m.set('dodge', true); assert.equal(m.state(20), 'dodge');
  m.set('dead', true); assert.equal(m.state(20), 'dead');
  m.set('dead', false); m.set('dodge', false); assert.equal(m.state(20), 'hurt');
  m.set('nonsense', true); m.pulse('nonsense', 0); assert.equal(m.state(20), 'hurt', 'unknown states are ignored');
});

test('timed states end by time; a pulse while one runs extends it; a lower one keeps its own end', () => {
  const m = A.create();
  m.pulse('attack', 1000);
  assert.equal(m.state(1229), 'attack');
  assert.equal(m.state(1230), 'idle', '230 ms by default');
  assert.equal(m.left('attack', 1100), 130);
  m.pulse('attack', 2000); m.pulse('attack', 2100);
  assert.equal(m.state(2300), 'attack', 'the second swing extends the first');
  assert.equal(m.state(2330), 'idle');
  m.pulse('attack', 3000, 1000); m.pulse('attack', 3100);
  assert.equal(m.left('attack', 3100), 900, 'a shorter pulse never cuts a longer one');
  m.pulse('hurt', 3200);
  assert.equal(m.state(3300), 'hurt');
  assert.equal(m.state(3500), 'attack', 'the attack started under the hurt shows when the hurt ends');
  assert.equal(m.state(4000), 'idle');
  m.pulse('attack', NaN); m.pulse('attack', Infinity);
  assert.equal(m.state(4000), 'idle', 'a bad time is ignored');
});

test('the hurt flash alternates every 50 ms from the hit, and stops with it', () => {
  const m = A.create();
  assert.equal(m.blink(0), false);
  m.pulse('hurt', 500);
  const seq = [500, 549, 550, 599, 600, 650, 739, 740].map((t) => m.blink(t));
  assert.deepEqual(seq, [true, true, false, false, true, false, true, false]); // hurt lasts 240 ms
  assert.equal(A.BLINK_MS, 50);
});

test('clear() turns everything off; machines are separate', () => {
  const a = A.create(), b = A.create();
  a.set('dead', true); a.pulse('attack', 0);
  assert.equal(b.state(0), 'idle');
  a.clear();
  assert.equal(a.state(0), 'idle');
  const own = A.create({ big: { rank: 2, ms: 100 }, small: { rank: 1 }, none: { rank: 0 } });
  assert.equal(own.state(0), 'none');
  own.set('small', true); own.pulse('big', 0);
  assert.deepEqual([own.state(50), own.state(100)], ['big', 'small']);
});

test('nothing is scheduled: no timeout or interval can outlive the entity (the plan\'s check)', () => {
  const real = { st: globalThis.setTimeout, si: globalThis.setInterval, raf: globalThis.requestAnimationFrame };
  let made = 0;
  globalThis.setTimeout = globalThis.setInterval = globalThis.requestAnimationFrame = () => { made++; return 0; };
  try {
    const ms = [];
    for (let i = 0; i < 200; i++) { const m = A.create(); m.pulse('attack', i); m.pulse('hurt', i); m.set('walk', true); m.state(i + 100); m.blink(i + 10); ms.push(m); }
    ms.forEach((m) => m.clear());
  } finally { globalThis.setTimeout = real.st; globalThis.setInterval = real.si; if (real.raf) globalThis.requestAnimationFrame = real.raf; else delete globalThis.requestAnimationFrame; }
  assert.equal(made, 0);
});
