'use strict';
// The Siren Kingdom (v2.96; owner 2026-10-25: "add any place or region of the novel that has an effect"; ch 137): the night two
// full moons overlap (here every 8th world day), Brinichi's purple path into the sea, Laurelia's Flute and its 25 minutes of
// breath under the water, the first discoverer of the kingdom; the fisherman of Brinichi who tells the legend.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
// world time: DAYL = 2400 s a day; the night of the moons is day 5 of every 8, 20:00 to 4:00
const DAYL = 2400, at = (d, h) => (d * DAYL + DAYL * h / 24) * 1000;

test('the night of the two moons: every 8th world day, 20:00 to 4:00; the next one on the calendar', async () => {
  const g = await H.openGame();
  try {
    const r = await g.eval((A) => {
      const W = window.__GSIR, s = (ms) => ms / 1000, o = {};
      o.on = [W.dmAt(s(A.d5h21)), W.dmAt(s(A.d6h2)), W.dmAt(s(A.d13h23))];
      o.off = [W.dmAt(s(A.d5h19)), W.dmAt(s(A.d6h5)), W.dmAt(s(A.d4h22)), W.dmAt(s(A.d6h21))];
      o.nx = W.next(A.d2h10); o.mid = W.next(A.d5h21); o.after = W.next(A.d6h5);
      const L = window.__GCAL.list(A.d2h10); o.cal = L.find((e) => e.k === 'calDm');
      return o;
    }, { d5h21: at(805, 21), d6h2: at(806, 2), d13h23: at(813, 23), d5h19: at(805, 19), d6h5: at(806, 5), d4h22: at(804, 22), d6h21: at(806, 21), d2h10: at(802, 10) });
    assert.deepEqual(r.on, [true, true, true]); assert.deepEqual(r.off, [false, false, false, false]);
    assert.equal(r.nx.at, at(805, 20)); assert.equal(r.nx.len, DAYL / 3 * 1000, '8 world hours');
    assert.equal(r.mid.at, at(805, 20), 'during it: this one'); assert.equal(r.after.at, at(813, 20), 'after it: eight days on');
    assert.ok(r.cal, 'on the calendar'); assert.equal(r.cal.at, at(805, 20)); assert.equal(r.cal.end, at(806, 4));
  } finally { await g.close(); }
});

test('the way down: hidden off the night, shut without the flute; the flute from the fisherman\'s errand; 25 minutes, then the shore', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, W = window.__GSIR, real = Date.now.bind(Date), o = {};
      const goTo = (ms) => { const off = ms - real(); Date.now = () => real() + off; };
      const n0 = W.next(real());
      // a day before the night: hidden, shut
      goTo(n0.at - 24 * 60 * 1000); W.tick(); const gt = W.gate(); o.offHide = gt.hide; o.offUse = W.use(gt); o.offNight = W.night();
      // the night: shown, but no flute
      goTo(n0.at + 60000); W.tick(); o.onHide = gt.hide; o.noFl = W.use(gt); o.breath0 = !!(S.books || {}).lfB;
      // the fisherman's errand: ten fish for the flute
      S.lv = 220; S.met.brfish = 1; G.acceptQ('sir1'); o.spot = window.__GTRK.spot('sir1'); S.mats.fish = 12; G.completeQ('sir1');
      o.fish = S.mats.fish; o.qst = S.qs.sir1 && S.qs.sir1.st; o.fluteNow = !!(S.books && S.books.lflute);
      // a save from before the fix: the errand done, no flute kept; it still counts
      const fl = S.books.lflute; delete S.books.lflute; o.oldSave = W.open(); S.books.lflute = fl;
      return o;
    });
    assert.equal(r.offNight, false); assert.equal(r.offHide, true, 'hidden off the night'); assert.equal(r.offUse, false);
    assert.equal(r.onHide, false, 'shown on the night'); assert.equal(r.noFl, false, 'shut without the flute'); assert.equal(r.breath0, false);
    assert.equal(r.fish, 2, 'ten fish taken'); assert.equal(r.qst, 2); assert.equal(r.fluteNow, true, 'the flute with the quest, in its save');
    assert.equal(r.oldSave, true, 'the errand done is the flute'); assert.ok(Math.abs(r.spot.x - 575.5) < 3 && Math.abs(r.spot.y - 253.5) < 3, 'the arrow on his beach: ' + JSON.stringify(r.spot));
    await g.page.waitForTimeout(600); await g.step(5);   // the flute comes a moment after the errand
    const r2 = await g.eval(() => {
      const G = window.__G, S = G.S, W = window.__GSIR, TS = 16, o = {};
      o.flute = !!S.books.lflute; o.open = W.open();
      const gt = W.gate(); const t0 = Date.now(); o.use = W.use(gt); o.breath = S.books.lfB - t0;
      G.P.x = gt.to.x; G.P.y = gt.to.y; W.tick(); o.inside = W.inside(); o.zone = G.zoneAt(G.P.x, G.P.y);
      // a second play of the flute: the first discovery only once
      o.fd1 = !!S.books.fd_siren;
      return o;
    });
    assert.equal(r2.flute, true, 'the flute from the errand'); assert.equal(r2.open, true);
    assert.equal(r2.use, true); assert.ok(Math.abs(r2.breath - 25 * 60000) < 2000, 'the flute\'s 25 minutes: ' + r2.breath);
    assert.equal(r2.inside, true); assert.equal(r2.zone, 'zSiren');
    await g.page.waitForTimeout(900); await g.step(5);   // the discovery's toast a moment after the flute
    const r3 = await g.eval(() => {
      const G = window.__G, S = G.S, W = window.__GSIR, TS = 16, o = {};
      o.fd = !!S.books.fd_siren; const f0 = S.books.fd_siren; o.again = window.__GNPC.fd('siren'); o.fdSame = S.books.fd_siren === f0;
      window.__toastLog = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true, subtree: true });
      S.books.lfB = Date.now() + 4.5 * 60000; W.tick(); W.tick(); o.inside5 = W.inside();
      // the breath runs out: back on Brinichi's shore
      S.books.lfB = Date.now() - 1; W.tick(); o.out = !W.inside(); o.surf = G.P.y < 400 * TS * 16; o.y = G.P.y; o.x = G.P.x;
      return o;
    });
    await g.step(5);
    const log = await g.eval(() => window.__toastLog.join(' | '));
    assert.equal(r3.fd, true, 'the first discoverer'); assert.equal(r3.again, false, 'once'); assert.equal(r3.fdSame, true);
    assert.equal(r3.inside5, true); assert.match(log, /5 min/, 'a warning at five minutes: ' + log);
    assert.equal(r3.out, true, 'out of breath, out of the sea'); assert.equal(r3.x, 578 * 16 + 8); assert.equal(r3.y, 253 * 16 + 10);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the fisherman of Brinichi: the legend sets its rumor and the shore\'s discovery; the Sirens below speak', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, N = window.__GNPC, o = {};
      o.brinNeed = N.FD.brin.need();
      S.met.brfish = 1; N.topic('brfish', 'legend'); for (let i = 0; i < 8 && G.mode === 'dialog'; i++) G.advance();
      o.rumor = N.m('brfish', 'rumor_brin'); o.brinNeed2 = N.FD.brin.need();
      o.topics = N.NLD.brfish.topics.map((x) => x.id); o.eTopics = N.NLD.sirenE.topics.map((x) => x.id); o.pool = N.pool('brfish').length;
      const K = window.__GSIR.K.in; o.zone = G.zoneAt((K.x1 - 10) * 16, K.cy * 16); o.shore = G.zoneAt(575 * 16, 252 * 16);
      return o;
    });
    assert.equal(r.brinNeed, false, 'the shore\'s discovery only once the legend is told'); assert.ok(r.rumor, 'the rumor'); assert.equal(r.brinNeed2, true);
    assert.ok(r.topics.includes('legend') && r.topics.includes('flute'), r.topics.join());
    assert.ok(r.eTopics.includes('kingdom'), r.eTopics.join()); assert.ok(r.pool >= 1, 'something for the moment'); assert.equal(r.zone, 'zSiren');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
