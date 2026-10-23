'use strict';
// Legends born among the NPCs (legends/npc-legends.md §2-3): Mercedes in Reidan opens the Legendary Knight for a knight who
// slays a great demon near death, and her chivalric codes raise her stats; Kyle in Titan opens the Legendary Lightning
// Warrior for one who kills 3,000 demonic creatures and then survives a great demon's killing blow.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Mercedes', hair: 1, hc: 2, skin: 1, top: 3 };
const pick = (g, re) => g.eval((src) => { const o = window.__G.DL.opts.find((x) => new RegExp(src).test(x.l)); if (!o) return window.__G.DL.opts.map((x) => x.l).join('|'); o.f(); return 'ok'; }, re.source);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function shut(g) { for (let i = 0; i < 12 && (await g.eval(() => window.__G.mode)) === 'dialog'; i++) { await g.eval(() => { const o = [...document.querySelectorAll('#dopts button')]; if (document.getElementById('dopts').hidden || !o.length) window.__G.advance(); else o[o.length - 1].click(); }); await g.step(2); } }

test('Mercedes: a knight near death slays a great demon; the codes raise every stat by 10%', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, N = window.__GNL;
      const npc = G.npcs.find((n) => n.id === 'mercedes'), zone = G.zoneAt(npc.x, npc.y);
      S.cls = 'knight'; S.lv = 260; N.merc()[0].f(); return { zone, kyle: G.zoneAt(...(() => { const k = G.npcs.find((n) => n.id === 'kyle'); return [k.x, k.y]; })()) }; });
    assert.deepEqual(r, { zone: 'zReid', kyle: 'zTitan' });
    assert.equal(await pick(g, /Accept/), 'ok');
    const k = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, N = window.__GNL;
      P.hp = G.maxHP(); N.kill({ type: 'belial' }); const full = S.lkq; P.hp = Math.round(G.maxHP() * .2); N.kill({ type: 'belial' }); return [full, S.lkq]; });
    assert.deepEqual(k, [1, 2], 'only near death');
    await wait(900);
    assert.equal(await pick(g, /^(Use|Yes)/), 'ok');
    await shut(g);
    const c = await g.eval(() => { const G = window.__G, S = G.S, N = window.__GNL; G.isk.checkSkills();
      const out = { cls: S.cls, lv: S.lv, sk: ['lkvaintz', 'lkblock', 'lkres', 'lkinsight', 'lkcode'].filter((x) => S.sk[x]), c1: N.codes(), m1: N.codeM() };
      S.lv = 210; out.c3 = N.codes(); out.m3 = N.codeM(); return out; });
    assert.deepEqual([c.cls, c.lv, c.sk], ['lknight', 1, ['lkvaintz', 'lkblock', 'lkres', 'lkinsight', 'lkcode']]);
    assert.deepEqual([c.c1, c.c3], [1, 3]); assert.ok(Math.abs(c.m3 - 1.3) < 1e-9);
    await g.step(70);
    const d = await g.eval(() => ({ mode: window.__G.mode, c: window.__G.S.lkC }));
    assert.equal(d.mode, 'dialog'); assert.ok(d.c >= 1 && d.c <= 3, 'the codes are announced one by one: ' + d.c);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Kyle: 3,000 demonic creatures, then a great demon\'s killing blow is survived and the lightning comes', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { const S = window.__G.S; S.cls = 'berserker'; S.lv = 300; window.__GNL.kyle()[0].f(); });
    assert.equal(await pick(g, /Accept/), 'ok');
    const q = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, N = window.__GNL; const no = N.save();
      for (let i = 0; i < N.N; i++) N.kill({ type: i % 2 ? 'demon' : 'hdemon' }); const st = S.kyq.st;
      P.lastSrc = 'belial'; P.hp = 0; G.die(); return { no, st, after: S.kyq.st, hp: P.hp, mode: G.mode }; });
    assert.equal(q.no, false); assert.equal(q.st, 2); assert.equal(q.after, 3);
    assert.ok(q.hp > 0); assert.notEqual(q.mode, 'dead');
    await wait(700);
    await shut(g);
    await g.eval(() => window.__GLG.won('lwarrior'));
    assert.equal(await pick(g, /^(Use|Yes)/), 'ok');
    await shut(g);
    const c = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, A = window.__GSKF; G.isk.checkSkills();
      const out = { cls: S.cls, sk: ['kypalm', 'kyspear', 'kycur'].filter((x) => S.sk[x]) };
      for (const m of G.mons()) m.dead = true;
      const a = G.spawnMon('wolf', P.x + 20, P.y), b = G.spawnMon('wolf', P.x + 50, P.y);
      for (const x of [a, b]) { x.max = x.hp = 1e7; x.tmp = 0; } P.mp = 1e6; A.cast('kypalm'); out.hit = [1e7 - a.hp > 0, 1e7 - b.hp > 0]; return out; });
    assert.deepEqual(c.cls, 'lwarrior'); assert.deepEqual(c.sk, ['kypalm', 'kyspear', 'kycur']);
    assert.deepEqual(c.hit, [true, true], 'the current carries the blow on');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
