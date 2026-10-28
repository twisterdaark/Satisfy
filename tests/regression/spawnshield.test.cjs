'use strict';
// Spawn protection (owner 2026-10-23, after a spawn kill on loading in): after you load in or come back to life nothing hurts
// you until you attack, use a skill or have moved for 3 seconds in all, so you can still run from an invasion.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('spawn protection: no damage until you attack or move 3 seconds', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, { n: 'Grid', hair: 3, hc: 0, skin: 1, top: 1 });
    const hit = () => g.eval(() => { const P = window.__GSPW.P; P.inv = 0; P.dash = 0; P.hp = 1e6; window.__G.mode === 'play'; window.__GUND.hurt(300, 1); return 1e6 - P.hp; });
    await g.eval(() => { window.__GSPW.set(1); window.__GSPW.on(); });
    assert.equal(await hit(), 0, 'shielded after loading in');
    // an attack ends it
    await g.eval(() => window.__G.tryAttack());
    assert.ok(await hit() > 0, 'an attack ends it');
    // moving ends it after 3 seconds in all, not before
    await g.eval(() => window.__GSPW.on());
    const walk = (sec) => g.eval((sec) => { const P = window.__GSPW.P; for (let i = 0; i < sec * 60; i++) { P.x += (i % 2 ? 0.6 : -0.6); window.__step(1); } }, sec);
    await walk(1.5);
    assert.equal(await hit(), 0, 'still on after a short walk');
    await walk(2);
    assert.ok(await hit() > 0, 'off after 3 seconds of moving');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
