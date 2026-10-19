'use strict';
// SAT-ONLINE-043 (owner 2026-10-19): a number over your own player (damage taken, a heal, a parry, a skill name) shows over
// you on the other players' screens too, with the same effect, the way your attacks already do.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(4); await games[0].page.waitForTimeout(30); }
}
// the strings drawn on the game canvas, from now on
async function spy(g) {
  await g.eval(() => { window.__drawn = []; const f = CanvasRenderingContext2D.prototype.fillText; if (!f.__spy) { CanvasRenderingContext2D.prototype.fillText = function (s, ...r) { (window.__drawn || []).push(String(s)); return f.call(this, s, ...r); }; CanvasRenderingContext2D.prototype.fillText.__spy = 1; } });
}

test('a heal over B shows over B on A\'s screen too, once', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { const G = window.__G; G.P.x += 30; G.S.hpot = 3; G.P.hp = Math.round(G.maxHP() / 2); });
    await settle(a, b);
    await spy(a);
    await b.page.keyboard.press('KeyQ'); // an HP potion: "+<n>" in green over B
    const heal = await b.eval(() => Math.round(window.__G.maxHP() * 0.4));
    await settle(a, b); await settle(a, b);
    const drawn = await a.eval(() => window.__drawn.slice());
    assert.ok(drawn.includes('+' + heal), 'A saw "+' + heal + '" over B: ' + drawn.filter((x) => /^[+-]\d/.test(x)).slice(0, 8));
    // only once: the replay doesn't repeat an event it already played
    const n0 = drawn.filter((x) => x === '+' + heal).length;
    await settle(a, b);
    const n1 = (await a.eval(() => window.__drawn.slice())).filter((x) => x === '+' + heal).length;
    assert.ok(n1 - n0 <= 60, 'the number fades like your own'); // a number stays up ~0.9 s (drawn every frame)
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
