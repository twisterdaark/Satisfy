'use strict';
// SAT-ONLINE-163 (owner 2026-10-23, with a picture of the West's world map zoomed out: the vampire cities' masters in a row
// under the coast): "make sure everything of the other continent moved from this map to the other one, and hide the vampires
// and anything under the ground from the map". A wide or tall screen shows past the continent's edges; what stands there (the
// East's region names past the Red Sea, the monsters and people under the ground) was drawn too.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

// the world map zoomed out as far as it goes, every label it draws (names of regions, bosses, quests, people)
const labels = (g) => g.eval(() => {
  const G = window.__G, MM = window.SatArt.minimap, out = [], l0 = MM.label;
  MM.label = function (g2, text, x, y, o) { out.push(String(text)); return l0.apply(this, arguments); };
  // the map is built in pieces since v2.83 (drawn without freezing) and shows a loading bar until they are in: finish them
  try { G.mapBase(); G.MV.z = 1; G.mapDraw(); } finally { MM.label = l0; }
  return out;
});

test('the West map: no region of the East, nothing under the ground (the vampire cities and their masters)', async () => {
  const g = await H.openGame({});
  try {
    await g.page.setViewportSize({ width: 1600, height: 900 });
    await H.newGame(g);
    await g.step(5);
    const r = await g.eval(() => {
      const G = window.__G, s = (k) => window.__GSET.str('en', k), M = G.mons();
      // what lives under the ground: the vampire cities, their masters among them (the bosses' names are what the map labels)
      const under = [...new Set(M.filter((m) => m.y >= window.__GTRK.WMH * 16).map((m) => m.type))];
      return { under, names: under.map((k) => s(k + 'N') || s(k)).filter(Boolean), east: ['zEaPangea', 'zEaPa', 'zEaWTig', 'zEaDesert', 'zEaGate'].map(s) };
    });
    assert.ok(r.under.length >= 10, 'the vampire cities are under the ground: ' + r.under.join(' '));
    await g.page.keyboard.press('m'); await g.step(2);
    const L = await labels(g);
    assert.ok(L.length > 20, 'the map draws its names: ' + L.length);
    assert.ok(L.includes(await g.eval(() => window.__GSET.str('en', 'zWin'))), 'Winston is on it');
    assert.deepEqual(L.filter((t) => r.east.includes(t)), [], 'no region of the East');
    assert.deepEqual(L.filter((t) => r.names.some((n) => t.startsWith(n))), [], 'no master of a vampire city');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the East map: no region of the West', async () => {
  const g = await H.openGame({});
  try {
    await g.page.setViewportSize({ width: 1600, height: 900 });
    await H.newGame(g);
    await g.eval(() => { const G = window.__G; G.S.lv = 300; G.P.x = 1000 * 16; G.P.y = 120 * 16; G.P.inv = 1e9; }); // by the Red Sea, on the East's side
    await g.step(5);
    await g.page.keyboard.press('m'); await g.step(2);
    const L = await labels(g);
    const west = await g.eval(() => ['zWin', 'zBai', 'zSuaz', 'zTitan', 'zAbyss', 'zButin', 'zTatur'].map((k) => window.__GSET.str('en', k)));
    assert.ok(L.length > 5, 'the map draws its names: ' + L.length);
    assert.deepEqual(L.filter((t) => west.includes(t)), [], 'no region of the West');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
