'use strict';
// The Legendary Blacksmith's Patience and Eyes (v1.12). Patience can't be cast: it wakes when a blacksmith holds on in a
// fight below 30% health or keeps at the anvil, and triples Stamina, Dexterity and defense for an hour, once a day.
// The Eyes see a monster's named item, more lines the closer you stand; at skill Lv 5 they are the Legendary Eyes.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('Patience wakes when a blacksmith perseveres, triples the stats for an hour, once a day', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(3);
    // a warrior has no Patience; a level 15 blacksmith does
    const w = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'warrior'; S.lv = 20; return window.__GBS.patTry(); });
    assert.equal(w, false);
    const a = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBS; S.cls = 'pagma'; S.lv = 20; G.P.x = 90 * 16; G.P.y = 60 * 16;
      const sta0 = window.__GSET.stat('sta'), dex0 = window.__GSET.stat('dex'), def0 = G.eqx.defV();
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } const m = G.spawnMon('wolf', G.P.x + 30, G.P.y); m.eng = 4; m.max = m.hp = 1e9;
      G.P.hp = Math.floor(window.__GSET.maxHP() * .2); B.reset(); for (let i = 0; i < 30; i++) { m.eng = 4; B.tick(.1); } const half = B.patOn(); for (let i = 0; i < 40; i++) { m.eng = 4; B.tick(.1); }
      return { half, on: B.patOn(), sta: window.__GSET.stat('sta') / sta0, dex: window.__GSET.stat('dex') / dex0, def: G.eqx.defV() / Math.max(1, def0), left: (S.pat1 - Date.now()) / 60000, again: B.patTry() }; });
    assert.equal(a.half, false);
    assert.equal(a.on, true);
    assert.ok(Math.abs(a.sta - 3) < .05 && Math.abs(a.dex - 3) < .05, JSON.stringify(a));
    assert.ok(a.def > 2.5, JSON.stringify(a));
    assert.ok(a.left > 59 && a.left <= 60, JSON.stringify(a));
    assert.equal(a.again, false, 'once a day');
    assert.match(await g.eval(() => document.getElementById('anntext').textContent), /Legendary Blacksmith's Patience skill has been activated/);
    // it wears off after the hour
    await g.eval(() => { window.__G.S.pat1 = Date.now() - 1; window.__GBS.tick(.1); });
    assert.equal(await g.eval(() => window.__GBS.patOn()), false);
    assert.match(await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | ')), /Patience has worn off/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Legendary Eyes see a named item whole and help understanding', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(3);
    // the Eyes are Pagma's Descendant's alone (owner 2026-10-21), and Pagma's Descendant always has the Legendary Eyes:
    // every line in three seconds
    await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'pagma'; S.lv = 20; S.skx = {}; G.P.x = 90 * 16; G.P.y = 60 * 16; });
    const l = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBS; S.eyes = {}; const m = G.spawnMon('fochief', G.P.x + 180, G.P.y); m.max = m.hp = 1e9; m.tmp = 0;
      for (const o of G.mons()) if (o !== m) { o.dead = true; o.rt = 1e9; } B.reset(); for (let i = 0; i < 31; i++) B.eyTick(.1);
      return { leg: B.leg(), txt: document.getElementById('eyesW').textContent, eyes: S.eyes, n: B.lines('ochelm').length }; });
    assert.equal(l.leg, true);
    assert.match(l.txt, /\[Legendary Blacksmith's Eyes\]/);
    assert.doesNotMatch(l.txt, /\?\?\?/);
    assert.equal(l.eyes.ochelm, l.n);
    // the chief dead, a plain orc beside you: its 0.3% share of the chief set is not something it wears, so nothing shows
    // (owner 2026-10-22: the Eyes named the chief's gloves with the chief long dead)
    const o = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBS; S.eyes = {}; const w = document.getElementById('eyesW'); w.hidden = true;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } const f = G.spawnMon('forc', G.P.x + 60, G.P.y); f.max = f.hp = 1e9; f.tmp = 0;
      B.reset(); for (let i = 0; i < 61; i++) B.eyTick(.1); return { hid: w.hidden, eyes: S.eyes }; });
    assert.equal(o.hid, true);
    assert.deepEqual(o.eyes, {});
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("a plain blacksmith has a blacksmith's own skills; the Legendary Blacksmith's are Pagma's Descendant's alone", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBS; S.lv = 40; S.qs.kh5 = { st: 2 }; S.qs.kh6 = { st: 2 };
      S.cls = 'warrior'; const z0 = B.zone();
      S.cls = 'smith'; const sm = [B.pas(), B.act(), B.zone()];
      S.cls = 'novice'; S.sec = 'smith'; const sec = B.pas(); S.sec = null;
      S.cls = 'pagma'; const pg = [B.pas(), B.act(), B.zone()];
      return { z0, sm, sec, pg };
    });
    const LEG = ['focus', 'beyes', 'lpat', 'lcre'];
    for (const k of LEG) { assert.ok(!r.sm[0].includes(k), 'a blacksmith has no ' + k); assert.ok(!r.sec.includes(k), 'nor a blacksmith by trade'); assert.ok(r.pg[0].includes(k), 'Pagma has ' + k); }
    for (const k of ['lrep', 'icomb']) { assert.ok(!r.sm[1].includes(k)); assert.ok(r.pg[1].includes(k), 'Pagma has ' + k); }
    for (const k of ['scraft', 'stemp']) { assert.ok(r.sm[0].includes(k), 'a blacksmith has ' + k); assert.ok(r.sec.includes(k)); assert.ok(!r.pg[0].includes(k)); }
    assert.ok(r.sm[1].includes('srep') && !r.pg[1].includes('srep'), 'Item Repair is the blacksmith\'s');
    assert.ok(r.sm[2] > r.z0 && r.pg[2] > r.sm[2], 'Craftsmanship widens the sweet spot, the legendary Breath more');
    // Item Repair mends the gear you wear by 13% at level 1
    const d = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBS; S.cls = 'smith'; const it = G.eqx.eqIt('w'); it.dur = 50; B.sk('srep'); return it.dur; });
    assert.equal(d, 63);
  } finally { await g.close(); }
});
