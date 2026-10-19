'use strict';
// The read-only engine surface (window.Satisfy.local) that the online layer and content tests use.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../harness/game.cjs');
const { loadGlobal } = require('../harness/load-module.cjs');

// Content grows (Claude-B owns data/**): expected counts come from data/*.js, which its own parity
// tests keep equal to index.html. Here we check the runtime surface reports the same tables.
const DATA = loadGlobal('SATISFY_DATA', fs.readdirSync(path.join(H.ROOT, 'data')).filter((f) => f.endsWith('.js')).map((f) => 'data/' + f));

test.after(() => H.closeBrowser());

test('Satisfy namespace exposes storage, net and local', async () => {
  const g = await H.openGame();
  try {
    const r = await g.eval(() => ({
      storage: Satisfy.storage.SCHEMA, key: Satisfy.storage.KEY, net: Satisfy.net.PROTOCOL_VERSION, local: Satisfy.local.api,
      frozen: Object.isFrozen(Satisfy.local) && Object.isFrozen(Satisfy.storage) && Object.isFrozen(Satisfy.net),
    }));
    assert.deepEqual(r, { storage: 5, key: 'satisfy_proto_v4', net: 1, local: 1, frozen: true });
  } finally { await g.close(); }
});

test('defs(): content tables as plain JSON, functions replaced by {$fn}', async () => {
  const g = await H.openGame();
  try {
    const d = await g.eval(() => window.__G.defs());
    assert.equal(Object.keys(d.MT).length, Object.keys(DATA.monsters.types).length);
    assert.equal(d.BOSSES.length, DATA.monsters.bosses.length);
    assert.equal(d.SPAWN.length, DATA.monsters.spawns.length);
    assert.equal(Object.keys(d.QD).length, Object.keys(DATA.quests.quests).length);
    assert.equal(d.RC.length, Object.keys(DATA.recipes.recipes).length);
    assert.equal(Object.keys(d.SKD).length, Object.keys(DATA.skills.skills).length);
    assert.equal(d.NPCS.length, Object.keys(DATA.npcs.npcs).length);
    // data/zones.js is regenerated from index.html by Claude-B and can lag a new town by a few commits,
    // so towns are checked as "every data town is in the engine" rather than by count.
    for (const T of DATA.zones.towns) assert.ok(d.TOWNS.some((x) => x.k === T.id), 'engine has town ' + T.id);
    assert.equal(d.ZR.length, DATA.zones.regions.length);
    for (const m of ['ore', 'wood', 'leather', 'blue', 'mstone']) assert.ok(d.MATS.includes(m), m);
    assert.equal(typeof d.RC[0].unlock.$fn, 'string');
    // a copy, not a live reference
    const same = await g.eval(() => { const a = Satisfy.local.defs(); a.MT.rabbit.hp = -1; return Satisfy.local.defs().MT.rabbit.hp; });
    assert.equal(same, 70);
  } finally { await g.close(); }
});

test('playerPublic(): valid, public-only, null on the title screen', async () => {
  const g = await H.openGame();
  try {
    assert.equal(await g.eval(() => Satisfy.local.playerPublic()), null);
    await H.newGame(g);
    const r = await g.eval(() => {
      const pp = Satisfy.local.playerPublic({ uid: 'u1', sid: 's1' });
      return { pp, check: Satisfy.net.validatePlayerPublic(pp, { world: Satisfy.local.world() }), priv: Satisfy.net.PRIVATE_FIELDS };
    });
    assert.deepEqual(r.check, { ok: true, errors: [] });
    assert.equal(r.pp.handle, H.DEFAULT_LOOK.n);
    assert.equal(r.pp.zone, 'zWin');
    assert.equal(r.pp.room, null);
    for (const k of r.priv) assert.equal(k in r.pp, false, `private field ${k} leaked`);
  } finally { await g.close(); }
});

test('world(), rooms(), roomAt(): stable ids for zones and house interiors', async () => {
  const g = await H.openGame();
  try {
    const r = await g.eval(() => {
      const w = Satisfy.local.world(), rooms = Satisfy.local.rooms(), R = window.__G.ROOMS[0];
      return { w, n: rooms.length, ids: new Set(rooms.map((x) => x.id)).size, inside: Satisfy.local.roomAt((R.rx + 6) * w.tile, (R.ry + 4) * w.tile), id0: R.id };
    });
    const W = DATA.zones.world;
    assert.deepEqual([r.w.id, r.w.tile, r.w.w, r.w.h, r.w.outdoorH], ['satisfy', W.TS, W.MW, W.MH, W.WMH]);
    assert.ok(r.w.towns.includes('zWin') && r.w.towns.includes('zBai'));
    assert.ok(r.n > 0);
    assert.equal(r.ids, r.n, 'room ids unique');
    assert.equal(r.inside.id, r.id0);
  } finally { await g.close(); }
});
