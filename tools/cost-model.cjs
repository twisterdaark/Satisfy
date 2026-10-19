#!/usr/bin/env node
'use strict';
// Doc §28 cost model, with this build's real message sizes and send rates instead of the doc's
// illustrative b = 120 bytes. Prints a table for docs/online/COST_MODEL.md.
//
//   node tools/cost-model.cjs              # default scenarios
//   node tools/cost-model.cjs --json       # machine-readable
//
// Model (Realtime Database):
//   download bytes/s = Σ over senders (send rate × k listeners × bytes per update) + re-queries
//   bytes per update = presence JSON as stored (fields + seq + t) + path + RTDB framing.
//   k = N − 1 when everyone listens to the whole shard. With interest management (SAT-ONLINE-014,
//   doc U009) k is the number of players within the radius, and each moving player re-centres its
//   query every `step` px, downloading the k full nodes in range again.
// Uploads are not billed on Spark/Blaze download quotas and are left out. Party/duel inbox
// messages are a few per minute per player and are added as a small fixed rate.
const path = require('node:path');
const { loadModules } = require(path.join(__dirname, '..', 'tests', 'harness', 'load-module.cjs'));
const SN = loadModules('src/net/contracts.js', 'src/net/presence.js');

const FRAMING = 45;          // {"t":"d","d":{"b":{"p":..,"d":..},"a":"d"}} plus WebSocket framing, measured order of magnitude
const SPARK_GB_MONTH = 10;   // Spark: 10 GB/month downloaded (doc §28)
const SPARK_CONN = 100;      // Spark: 100 simultaneous connections

function updateBytes() {
  const S = { look: { n: 'Grid the Smith', hair: 3, hc: 2, skin: 1, top: 4 }, cls: 'gknight', lv: 124, title: 'smith' };
  const pp = SN.net.toPlayerPublic(S, { x: 5123, y: 1377, dir: 2 }, { zone: 'zPlains', uid: 'aB3dE5fG7hI9jK1lM3nO5pQ7rS9t', sid: '0123456789abcdef01234567', party: 'p_aB3dE5fG7hI9jK1lM3nO5pQ7rS9t', anim: 'walk', arm: 1 });
  const node = {}; for (const k in pp) if (pp[k] !== null && k !== 't') node[k] = pp[k];
  node.seq = 18234; node.t = 1797000000000;
  const pathLen = ('presence/satisfy/main/' + pp.uid).length;
  return { json: JSON.stringify(node).length, total: JSON.stringify(node).length + pathLen + FRAMING };
}

// one scenario: N players, a share of them moving, send rates while moving / idle
function scenario(o) {
  const b = o.bytes;
  const perSender = o.moving * o.moveHz + (1 - o.moving) * o.idleHz + o.inboxPerMin / 60;
  const k = o.k == null ? o.N - 1 : Math.min(o.k, o.N - 1);
  const requery = o.requery ? o.N * o.moving * (o.requery.speed / o.requery.step) * k * o.requery.full : 0;
  const bytesPerSec = o.N * perSender * k * b + requery;
  const gbPerHour = bytesPerSec * 3600 / 1e9;
  return { ...o, k, perSender: +perSender.toFixed(2), kbPerSec: +(bytesPerSec / 1e3).toFixed(1), gbPerHour: +gbPerHour.toFixed(3), sparkHoursPerMonth: +(SPARK_GB_MONTH / gbPerHour).toFixed(1) };
}

function run() {
  const size = updateBytes(), D = SN.presence.DEFAULTS;
  const full = size.total, slim = 70 + FRAMING; // an update of {x,y,dir,anim,seq,t} + path (SAT-ONLINE-011)
  const base = { moving: 0.5, inboxPerMin: 2 };
  const rows = [
    scenario({ name: 'doc §28 example (k = N−1, b = 120)', N: 20, moveHz: 5, idleHz: 5, bytes: 120, ...base, moving: 1 }),
    scenario({ name: 'SAT-ONLINE-004 config: 20 players, half moving, 1 s idle heartbeat', N: 20, moveHz: 5, idleHz: D.idleHz, bytes: full, ...base }),
    scenario({ name: 'now (SAT-ONLINE-008): 5 s idle heartbeat', N: 20, moveHz: 5, idleHz: 0.2, bytes: full, ...base }),
    scenario({ name: 'now (SAT-ONLINE-011): only changed fields', N: 20, moveHz: 5, idleHz: 0.2, bytes: slim, ...base }),
    // interest radius 800 px, re-centre every 400 px, walking at ~66 px/s base speed (index.html) and
    // up to ~230 px/s on the fastest horse; 150 px/s is used as a busy average
    scenario({ name: 'now (SAT-ONLINE-014): 20 players, 5 within 800 px', N: 20, k: 5, requery: { speed: 150, step: 400, full }, moveHz: 5, idleHz: 0.2, bytes: slim, ...base }),
    scenario({ name: 'now (SAT-ONLINE-014): 100 players (Spark cap), 10 within 800 px', N: 100, k: 10, requery: { speed: 150, step: 400, full }, moveHz: 5, idleHz: 0.2, bytes: slim, ...base }),
    scenario({ name: 'without interest: 100 players', N: 100, moveHz: 5, idleHz: 0.2, bytes: slim, ...base }),
    scenario({ name: 'now: 5 friends', N: 5, moveHz: 5, idleHz: 0.2, bytes: slim, ...base }),
  ];
  return { updateBytes: size, slimBytes: slim, spark: { gbPerMonth: SPARK_GB_MONTH, connections: SPARK_CONN }, rows };
}

if (require.main === module) {
  const r = run();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); return; }
  console.log(`presence update: ${r.updateBytes.json} B JSON, ~${r.updateBytes.total} B on the wire; position-only ~${r.slimBytes} B`);
  console.log('| Scenario | N | listeners k | msgs/s per player | download | GB per hour | Spark hours/month |');
  console.log('|---|---|---|---|---|---|---|');
  for (const x of r.rows) console.log(`| ${x.name} | ${x.N} | ${x.k} | ${x.perSender} | ${x.kbPerSec} kB/s | ${x.gbPerHour} | ${x.sparkHoursPerMonth} |`);
}

module.exports = { run, scenario, updateBytes };
