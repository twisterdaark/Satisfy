'use strict';
// v3.06 the cat (the player Suki through the owner 2026-10-25: "rework cat sprites, currently they're dull and barely visible,
// be able to pet them aswell"): an orange tabby with an outline that stands out on grass and stone; with it beside you and
// nothing else to use, the hint says so and E pets it: its eyes close, a heart rises, a line; a little of its experience,
// once every three minutes.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the cat: seen on the ground, and petted with E', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { const G = window.__G, S = G.S; S.pets = Object.assign(S.pets || {}, { cat: 1 }); S.pet = 'cat'; window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
    // somewhere open, with no one and nothing near
    const spot = await g.eval(() => { const P = window.__G.P, T = window.__GPD; for (let y = 60; y < 115; y += 3) for (let x = 30; x < 100; x += 3) { if (T.solid(x, y) || window.__GTRK.at(x, y) === 4) continue; P.x = x * 16 + 8; P.y = y * 16 + 8; if (!T.nearest()) return [x, y]; } return null; });
    assert.ok(spot, 'an open spot');
    await g.step(30);
    const near = await g.eval(() => ({ pet: !!window.__GCT.PET }));
    assert.equal(near.pet, true, 'the cat follows');
    // bring the cat beside you and stand still
    await g.eval((sp) => { const C = window.__GCT.PET, P = window.__G.P; P.x = sp[0] * 16 + 8; P.y = sp[1] * 16 + 8; C.x = P.x + 12; C.y = P.y + 2; }, spot);
    await g.step(2);
    assert.equal(await g.eval(() => window.__GCT.near()), true, 'beside you');
    assert.equal(await g.eval(() => window.__GPD.nearest()), null, 'nothing else to use here');
    assert.match(await g.eval(() => document.getElementById('hint').textContent), /Pet your cat/, 'the hint says so');
    const x0 = await g.eval(() => window.__G.S.petx && window.__G.S.petx.cat || 0);
    await g.page.keyboard.press('KeyE'); await g.step(3);
    const after = await g.eval(() => ({ pt: window.__GCT.petted, x: window.__G.S.petx && window.__G.S.petx.cat || 0, t: window.__toastSeen }));
    assert.equal(after.pt, true, 'its eyes close and a heart rises');
    assert.ok(after.x > x0, 'a little of its experience');
    assert.match(after.t, /Your cat (purrs|rubs|stretches)/);
    // again at once: the line and the heart, no more experience for three minutes
    const x1 = await g.eval(() => window.__G.S.petx.cat);
    await g.eval(() => window.__GCT.pet()); await g.step(2);
    assert.equal(await g.eval(() => window.__G.S.petx.cat), x1, 'once every three minutes');
    // (review) walking, the hint doesn't offer it: the cat trails behind you
    await g.page.keyboard.down('KeyD'); await g.step(20);
    assert.equal(await g.eval(() => window.__GCT.near()), false, 'not while walking');
    assert.doesNotMatch(await g.eval(() => document.getElementById('hint').textContent || ''), /Pet your cat/);
    await g.page.keyboard.up('KeyD'); await g.step(2);
    // (review) with a person in reach, E talks to them, the cat beside you or not
    await g.eval(() => { const G = window.__G, P = G.P, kh = G.npcs.find((n) => n.id === 'khan'), C = window.__GCT.PET; P.x = kh.x; P.y = kh.y + 14; C.x = P.x + 8; C.y = P.y + 2; });
    await g.step(2); await g.page.keyboard.press('KeyE'); await g.step(3);
    assert.equal(await g.eval(() => window.__G.DL && window.__G.DL.who), 'khan', 'E talks to Khan');
    for (let i = 0; i < 6 && await g.eval(() => window.__G.mode) !== 'play'; i++) { await g.page.keyboard.press('Escape'); await g.step(2); }
    // not near: no petting
    await g.eval(() => { const C = window.__GCT.PET, P = window.__G.P; C.x = P.x + 200; });
    assert.equal(await g.eval(() => window.__GCT.near()), false);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
