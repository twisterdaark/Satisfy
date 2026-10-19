'use strict';
// A bad network for unit tests (doc §29 T25–T27): an in-memory hub whose messages arrive late,
// out of order, twice, or never. Time is the test's fake clock; call pump(now) to deliver what is due.
//
//   const net = netem({ delay: 300, jitter: 100, loss: 0.01, dup: 0.05, seed: 7 });
//   const tr = net.connect();       // same shape as Satisfy.transports.hub().connect()
//   ... net.pump(t) after advancing the clock
//   net.stats -> { sent, delivered, dropped, duplicated }

function rng(seed) {
  let a = seed | 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function netem(o = {}) {
  const delay = o.delay || 0, jitter = o.jitter || 0, loss = o.loss || 0, dup = o.dup || 0;
  const rand = rng(o.seed || 1);
  const now = o.now || (() => 0);
  const peers = [], queue = [];
  const stats = { sent: 0, delivered: 0, dropped: 0, duplicated: 0 };
  const lag = () => Math.max(0, delay + (rand() * 2 - 1) * jitter);
  function enqueue(to, env) {
    if (rand() < loss) { stats.dropped++; return; }
    queue.push({ at: now() + lag(), to, env: JSON.parse(JSON.stringify(env)) });
    if (rand() < dup) { stats.duplicated++; queue.push({ at: now() + lag(), to, env: JSON.parse(JSON.stringify(env)) }); }
  }
  return {
    stats,
    connect() {
      const me = { handler: null };
      peers.push(me);
      return {
        kind: 'netem',
        send(env) { stats.sent++; for (const p of peers) if (p !== me) enqueue(p, env); },
        onmessage(fn) { me.handler = fn; },
        close() { me.handler = null; const i = peers.indexOf(me); if (i >= 0) peers.splice(i, 1); },
      };
    },
    /** Deliver every message due at time t, earliest first (so jitter reorders them). */
    pump(t) {
      queue.sort((a, b) => a.at - b.at);
      while (queue.length && queue[0].at <= t) {
        const m = queue.shift();
        if (m.to.handler) { stats.delivered++; m.to.handler(m.env); }
      }
    },
    pending: () => queue.length,
  };
}

module.exports = { netem };
