'use strict';
// Only the animals eat fish (owner 2026-10-23: "why would a doppelganger eat fish?"): Randy grows by copying your skills
// and Noe by eating what you defeat together, as in the novel; a dog still eats its fish.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('pets: the dog eats fish; Randy copies skills; Noe eats what you defeat', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => { const G = window.__G, S = G.S, E = window.__GPE, out = {};
      S.pets = { dog: 1, randy: 1, noe: 1 }; S.mats.fish = 5; S.petx = {};
      E.setPet('dog'); E.feed('dog'); out.dog = [S.mats.fish, S.petx.dog];
      E.setPet('randy'); E.feed('randy'); out.randyFish = S.mats.fish; E.skUse('whirl'); E.skUse('charge'); E.skUse('charge'); out.randy = S.petx.randy;
      E.setPet('noe'); const m = { lv: 100, type: 'wolf' }; E.kill(m, {}); out.noe = S.petx.noe; S.pet = 'dog'; const d0 = S.petx.dog; E.kill(m, {}); out.dogKill = S.petx.dog - d0;
      return out; });
    assert.deepEqual(r.dog, [4, 25], 'the dog eats a fish');
    assert.equal(r.randyFish, 4, 'Randy eats no fish'); assert.equal(r.randy, 6, 'two different skills copied');
    assert.equal(r.noe, 2 * r.dogKill, 'Noe eats what he defeats: double');
    await g.eval(() => { window.__GPE.setPet('randy'); });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-23: "let the ones like Randy, the owl and Noe die and have a health bar, as in the novel"
test('pets have health: a fallen pet leaves your side and its passive, and comes back after a while', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.eval(() => { const S = window.__G.S; S.pets = { noe: 1, owl: 1 }; window.__GPE.setPet('noe'); });
    await g.step(5);
    const r = await g.eval(() => { const G = window.__G, S = G.S, E = window.__GPE, out = {};
      out.max = [E.hpMax('noe'), E.hpMax('owl')]; out.there = !!E.pet;
      E.hurt(E.hpMax('noe') * 0.4); out.hurt = E.hp('noe') / E.hpMax('noe');
      E.hurt(E.hpMax('noe')); out.dead = E.dead('noe'); out.gone = !E.pet; return out; });
    assert.ok(r.max[0] > r.max[1], 'Noe has more health than the owl: ' + r.max);
    assert.equal(r.there, true); assert.ok(Math.abs(r.hurt - 0.6) < 0.01, 'hurt to ' + r.hurt);
    assert.equal(r.dead, true); assert.equal(r.gone, true);
    await g.step(10);
    assert.equal(await g.eval(() => !!window.__GPE.pet), false, 'a fallen pet stays away');
    await g.eval(() => { const S = window.__G.S; S.pdead.noe = Date.now() - 1; });
    await g.step(10);
    const b = await g.eval(() => { const E = window.__GPE; return { back: !!E.pet, full: E.hp('noe') === E.hpMax('noe') }; });
    assert.deepEqual(b, { back: true, full: true });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
