'use strict';
// More look (owner 2026-10-23): a girl's body without the beard-like jaw line, many more hairstyles, beards, face details,
// lip colour, two accessories, a skirt, and gear whose look you hide while its stats stay. All of it reaches the others.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 10; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const mine = (g) => g.eval(() => window.__GLK.mine());
const seen = (g, uid) => g.eval((u) => window.__GLK.theirs(u), uid);
const wear = (g, ids) => g.eval((ids) => { const G = window.__G, S = G.S; S.eq = S.eq || {}; for (const id of ids) { const it = G.eqx.mkItem(id, 1); S.items.push(it); if (it.slot === 'a') S.eqA = it.uid; else S.eq[it.slot] = it.uid; } }, ids);

test('the creator: a girl has no beard, new hairs and accessories draw; the figure follows the choices', async () => {
  const g = await H.openGame();
  try {
    const r = await g.eval(() => {
      const X = window.__GLOOK;
      const boy = X.fig({ hair: 0, hc: 0, skin: 0, top: 0, bst: 1 }, 0), girl = X.fig({ g: 1, hair: X.LOOK.hair.indexOf('hime'), hc: 9, skin: 0, top: 0, bst: 1, lip: 1, sk: 1, acc: X.ACCK.indexOf('flw'), acol: 6, acc2: X.ACCK.indexOf('ear') }, 0);
      const ok = X.LOOK.hair.every((h, i) => { try { SatArt.chars.buildSheet(X.fig({ hair: i, hc: 0, skin: 0, top: 0 }, 0)); return true; } catch (e) { return false; } });
      return { boy, girl, n: X.LOOK.hair.length, ok };
    });
    assert.equal(r.boy.beard, r.boy.hc, 'a full beard for him');
    assert.ok(r.girl.fem && !r.girl.beard, 'none for her: ' + JSON.stringify(r.girl));
    assert.ok(r.girl.lip && r.girl.skirt && r.girl.flw && r.girl.ear, JSON.stringify(r.girl));
    assert.ok(r.n >= 70 && r.ok, 'every hairstyle draws (' + r.n + ')');
    // the create screen: Female hides the beard row
    await g.eval(() => window.__GLOOK.create());
    await g.step(2);
    {
      await g.page.click('#create [data-cy="g"][data-d="1"]');
      assert.equal(await g.eval(() => document.getElementById('cy_g').textContent), 'Female');
      assert.equal(await g.eval(() => document.getElementById('crow_bst').hidden), true);
      await g.page.click('#create [data-cy="acc"][data-d="1"]');
      assert.equal(await g.eval(() => document.getElementById('cy_acc').textContent), 'Glasses');
    }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("hide a piece's look, keep its stats; the other player sees the same body, face and accessories", async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Mercedes', g: 1, hair: 12, hc: 2, skin: 0, top: 3, lip: 2, acc: 4, acol: 3, sk: 1 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await wear(a, ['ihelm', 'parmor']);
    await settle(a, b);
    const ua = await a.eval(() => Satisfy.local.net().uid);
    assert.equal(await a.eval(() => window.__GLOOK.bd()), '10002430010');
    let fa = await mine(a);
    assert.ok(fa.fem && fa.hair === 'helm' && fa.chest, 'helmet and armour show: ' + JSON.stringify(fa));
    assert.deepEqual(await seen(b, ua), fa);
    // the eyes on the equipment window: helmet and armour hidden, the defence unchanged
    const d0 = await a.eval(() => window.__G.eqx.defV());
    await a.eval(() => { const G = window.__G; G.S.look.vh = 1 | 8; });
    await settle(a, b);
    fa = await mine(a);
    assert.ok(fa.hair === 'hime' && !fa.chest && fa.band, 'her own hair and headband again: ' + JSON.stringify(fa));
    assert.deepEqual(await seen(b, ua), fa, 'and so for the other player');
    assert.equal(await a.eval(() => window.__G.eqx.defV()), d0, 'the stats stay');
    // a hairstyle past the presence range (0..31) still reaches the other player through the bd tag
    await a.eval(() => { const G = window.__G, X = window.__GLOOK; G.S.look.hair = X.LOOK.hair.indexOf('waist'); G.buildMe ? G.buildMe(G.S.look) : 0; });
    await settle(a, b);
    fa = await mine(a);
    assert.equal(fa.hair, 'waist', JSON.stringify(fa));
    assert.deepEqual(await seen(b, ua), fa, 'the long hair shows for the other player too');
    // the stylist's mirror: you now and with the option you're on, beside the list
    await a.eval(() => window.__GLOOK.sty('hair'));
    await a.step(3);
    await a.page.keyboard.press('ArrowDown'); await a.page.keyboard.press('ArrowDown');
    await a.step(5);
    const m = await a.eval(() => ({ on: !document.getElementById('styW').hidden, diff: document.getElementById('styNewT').classList.contains('diff'), side: document.body.classList.contains('styon') }));
    assert.deepEqual(m, { on: true, diff: true, side: true });
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
