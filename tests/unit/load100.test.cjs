'use strict';
// SAT-ONLINE-113 (plan U372): 100 clients through the real Firebase presence transport (src/net/firebase.js) and the
// real presence module, with the game's online settings (5 Hz while moving, a 5 s heartbeat, interest radius 800 px
// re-centred every 400 px), over one in-process database (tests/harness/node-rtdb.cjs) for 70 simulated seconds.
// Players gather in four towns and the rest spread over the map; half walk at 150 px/s, ten parties of three are
// scattered. It checks that everyone sees who it should, and measures what they download against tools/cost-model.cjs.
// The bytes are counted the model's way (the same framing; a change costs the fields written), so what this checks is
// the real code's side of the model: how often it sends, how many listen to each player, how often queries re-centre.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadModules } = require('../harness/load-module.cjs');
const { rtdb } = require('../harness/node-rtdb.cjs');
const model = require(path.join(__dirname, '..', '..', 'tools', 'cost-model.cjs'));

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/firebase-config.js', 'src/net/firebase.js');
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };
const CONFIG = { moveHz: 5, idleHz: 0.2, expireMs: 30000 }; // index.html's online presence config
const INTEREST = { radius: 800, step: 400 }; // index.html's NET_INTEREST
const N = 100, SPEED = 150, TICK = 100;

function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function run(interest, WARM, RUN) {
  const rand = rng(113), t0 = Date.now();
  let t = t0;
  const now = () => t;
  const db = rtdb({ now });
  const towns = [1400, 4200, 7100, 9800], ps = [];
  for (let i = 0; i < N; i++) {
    const town = i < 60 ? towns[i % 4] : null;
    const x = town ? town + (rand() - 0.5) * 600 : 200 + rand() * 11000;
    const p = { uid: 'u' + String(i).padStart(3, '0'), x: Math.round(x), y: 1200 + Math.round(rand() * 400), moving: i % 2 === 0, dir: rand() < 0.5 ? -1 : 1, party: null };
    p.c = db.client(p.uid);
    p.tr = SN.firebase.transport(p.c.sdk, { uid: p.uid, world: WORLD.id, shard: 'main', interest });
    p.pres = SN.presence.create({ transport: p.tr, uid: p.uid, world: WORLD, net: SN.net, now, config: CONFIG, sid: 'load' + i + 'xxxxxxxxxxxx' });
    ps.push(p);
  }
  for (let k = 0; k < 10; k++) { // ten parties of three, from anywhere on the map
    const id = 'p_' + ps[k * 7].uid;
    for (const j of [k * 7, k * 7 + 3, k * 7 + 5]) ps[j].party = id;
  }
  for (const p of ps) if (p.party && interest) p.tr.party([p.party]);
  let down0 = 0, ev0 = 0, steps = 0;
  const t1 = process.hrtime.bigint();
  for (let s = 0; (s * TICK) < WARM + RUN; s++) {
    if (s * TICK === WARM) { down0 = db.clients.reduce((n, c) => n + c.down, 0); ev0 = db.clients.reduce((n, c) => n + c.events, 0); }
    t += TICK;
    for (const p of ps) {
      if (p.moving) {
        p.x += p.dir * SPEED * TICK / 1000;
        if (s % 80 === 79 || p.x < 100 || p.x > 11400) p.dir = -p.dir; // turn every 8 s, and at the map's ends
      }
      const pp = SN.net.toPlayerPublic({ look: { n: 'L' + p.uid }, cls: 'novice', lv: 30, title: '' }, { x: Math.round(p.x), y: p.y, dir: p.dir < 0 ? 1 : 2 },
        { zone: 'zPlains', uid: p.uid, sid: p.pres.sid, party: p.party, anim: p.moving ? 'walk' : 'idle' });
      p.pres.publish(pp);
      p.pres.tick();
    }
    steps++;
  }
  const cpuMs = Number(process.hrtime.bigint() - t1) / 1e6;
  const down = db.clients.reduce((n, c) => n + c.down, 0) - down0, events = db.clients.reduce((n, c) => n + c.events, 0) - ev0;
  return { ps, db, kbPerSec: down / (RUN / 1000) / 1000, eventsPerSec: events / (RUN / 1000), cpuMs, steps };
}

test('100 clients over the real transport: everyone sees who is near and its party, and downloads match the cost model', (t) => {
  const r = run(INTEREST, 10000, 60000), R = INTEREST.radius, STEP = INTEREST.step;
  let k = 0;
  for (const p of r.ps) {
    const seen = new Set(p.pres.remotes().map((x) => x.uid));
    const iv = p.tr.interest();
    assert.ok(Math.abs(iv.centre - p.x) <= STEP + 1, p.uid + ' re-centres its query as it moves');
    for (const q of r.ps) {
      if (q === p) continue;
      const d = Math.abs(q.x - p.x), mate = !!p.party && q.party === p.party;
      if (mate) assert.ok(seen.has(q.uid), `${p.uid} sees its party member ${q.uid} ${Math.round(d)} px away`);
      else if (d <= R - STEP - 50) assert.ok(seen.has(q.uid), `${p.uid} sees ${q.uid}, ${Math.round(d)} px away`);
      else if (d > R + STEP + 50) assert.ok(!seen.has(q.uid), `${p.uid} no longer sees ${q.uid}, ${Math.round(d)} px away`);
    }
    k += r.ps.filter((q) => q !== p && Math.abs(q.x - p.x) <= R).length;
    assert.ok(p.c.listening() <= 3 + 3 + 1, p.uid + ' listens to its range, its party and its inbox only: ' + p.c.listening());
  }
  k /= N;
  // the model with this run's own numbers: N, the average number within the radius, half moving, no inbox messages
  const slim = model.run().slimBytes, full = model.updateBytes().total;
  const m = model.scenario({ name: 'this run', N, k: Math.round(k), moving: 0.5, moveHz: CONFIG.moveHz, idleHz: CONFIG.idleHz, inboxPerMin: 0, bytes: slim, requery: { speed: SPEED, step: STEP, full } });
  const ratio = r.kbPerSec / m.kbPerSec;
  t.diagnostic(`interest: ${r.kbPerSec.toFixed(1)} kB/s downloaded by all (${r.eventsPerSec | 0} events/s), model ${m.kbPerSec} kB/s at k = ${k.toFixed(1)}, ratio ${ratio.toFixed(2)}; ${r.cpuMs | 0} ms CPU`);
  assert.ok(ratio > 0.5 && ratio < 1.5, `the model is within half of what 100 real clients download: ${ratio.toFixed(2)}`);
  assert.ok(r.cpuMs < 30000, `${r.steps} steps of 100 clients took ${r.cpuMs | 0} ms`);

  const all = run(undefined, 5000, 20000); // shorter: every write reaches all 99 others
  t.diagnostic(`whole shard: ${all.kbPerSec.toFixed(1)} kB/s (${all.eventsPerSec | 0} events/s), ${(all.kbPerSec / r.kbPerSec).toFixed(1)}× the interest run`);
  for (const p of all.ps) assert.equal(p.pres.remotes().length, Math.min(N - 1, SN.presence.DEFAULTS.maxRemotes), 'without interest everyone hears everyone (up to the table cap)');
  assert.ok(all.kbPerSec > r.kbPerSec * 4, 'interest management cuts the download more than four times');
  const spark = r.kbPerSec * 3600 / 1e6; // GB an hour
  t.diagnostic(`a full 100-player shard for an hour: ${spark.toFixed(2)} GB (Spark: 10 GB a month)`);
});
