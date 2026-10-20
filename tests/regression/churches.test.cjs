'use strict';
// Priests and paladins (major 7, novel ch 118/122): Cassus at Winston gives the Priest vows (prayers; a word in the chat or a
// bite of food sets them back), a priest for hire, the Paladin trial and its church; a priest's Heal reaches the party online.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}

test('the Priest vows: prayers at Cassus, fasting and silence reset them; Heal, Holy Light and a hired priest', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.lv = 10; return { cp: C.avail('cp'), at9: (G.S.lv = 9, C.avail('cp')) }; });
    assert.equal(a.cp, true);
    await g.eval(() => { window.__G.S.lv = 10; window.__GC2.accept('cp'); });
    // a prayer: stand still for 12 s beside Cassus
    const p = await g.eval(() => { const G = window.__G, X = window.__GPH; const o = X.casOpts(); const pray = o.find((x) => /Pray/.test(x.l)); pray.f();
      for (let i = 0; i < 130; i++) X.tick(0.1); const one = G.S.qs.cp.c;
      pray.f(); X.tick(0.5); G.P.x += 10; X.tick(0.1); const moved = X.PH.pray === null;
      return { one, moved, obj: window.__GC2.obj('cp') }; });
    assert.equal(p.one, 1); assert.equal(p.moved, true, 'moving breaks the prayer');
    assert.match(p.obj, /Pray to Rebecca/);
    // a bite of bread breaks the fast and the prayers start over; so does a word in the chat
    const v = await g.eval(() => { const G = window.__G, X = window.__GPH; X.vow('fast'); const fast = G.S.qs.cp.c;
      G.S.qs.cp.c = 3; X.vow('silence'); return [fast, G.S.qs.cp.c]; });
    assert.deepEqual(v, [0, 0]);
    const d = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.qs.cp.c = 5; C.complete('cp'); return { cls: G.S.cls, sk: C.cls() }; });
    assert.equal(d.cls, 'priest');
    assert.ok(['pheal', 'pbless', 'plight'].every((k) => d.sk.includes(k)), d.sk.join());
    // Heal mends and clears a stun; Holy Light hits the undead twice as hard
    const h = await g.eval(() => { const G = window.__G, X = window.__GPH, P = G.P; P.hp = 10; P.stun = 2; X.sk('pheal'); const healed = P.hp > 10 && !(P.stun > 0);
      G.S.lv = 30; const w = G.spawnMon('wolf', P.x + 15, P.y), s = G.spawnMon('skel', P.x - 15, P.y); for (const m of [w, s]) { m.max = m.hp = 1e9; m.lv = 30; }
      for (let i = 0; i < 8; i++) X.sk('plight'); return { healed, wolf: 1e9 - w.hp, skel: 1e9 - s.hp }; });
    assert.ok(h.healed);
    assert.ok(h.skel > h.wolf * 1.5, JSON.stringify(h));
    // a priest for hire: costs gold, walks along, heals you when hurt
    const paid = await g.eval(() => { const G = window.__G, X = window.__GPH; G.S.gold = 5000; X.casOpts().find((x) => /Hire/.test(x.l)).f(); return 5000 - G.S.gold; });
    for (let i = 0; i < 4 && (await g.mode()) !== 'play'; i++) { await g.page.keyboard.press('KeyE'); await g.step(2); }
    const r = await g.eval((paid) => { const G = window.__G, X = window.__GPH, P = G.P; P.hp = Math.round(G.maxHP() * 0.3); const h0 = P.hp; for (let i = 0; i < 60; i++) X.tick(0.1); return { paid, on: !!X.PH.hire, healed: P.hp > h0 }; }, paid);
    assert.ok(r.paid > 0 && r.on && r.healed, JSON.stringify(r));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Paladin: trial from a Guardian Knight, a church to choose, its skill, and less damage from monsters only', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.cls = 'gknight'; G.S.lv = 25; G.S.mast = { sword: 0 }; const locked = C.mstOk({ mst: ['melee', 2] });
      G.S.mast.sword = 200; return { avail: C.avail('c2p'), locked, talk: C.talk('cassus') }; });
    assert.deepEqual(a, { avail: true, locked: false, talk: true });
    await g.eval(() => { window.__GC2.accept('c2p'); window.__GC2.ev('kill', 'outlaw'); });
    assert.equal(await g.eval(() => window.__G.S.qs.c2p.c), 1);
    await g.eval(() => { const G = window.__G; G.S.qs.c2p.c = 10; window.__GC2.complete('c2p'); });
    await g.page.waitForTimeout(800);
    await g.step(2);
    const opts = await g.eval(() => [...document.querySelectorAll('#dialog button')].map((b) => b.textContent));
    assert.ok(opts.some((o) => /Judar/.test(o)) && opts.some((o) => /Dominion/.test(o)) && opts.some((o) => /Rebecca/.test(o)), opts.join(' | '));
    await g.eval(() => [...document.querySelectorAll('#dialog button')].find((b) => /Judar/.test(b.textContent)).click());
    const s = await g.eval(() => { const G = window.__G, C = window.__GC2, X = window.__GPH; G.S.lv = 30; const sk = C.cls();
      const w = { x: G.P.x + 10, y: G.P.y, type: 'wolf' }; const off = X.hurt(100, w); G.P.jud = 5; const on = X.hurt(100, w); const pvp = X.hurt(100, { x: 0, y: 0 });
      return { cls: G.S.cls, base: G.S.cbase, church: G.S.church, sk, off, on, pvp, st: C.st() }; });
    assert.equal(s.cls, 'paladin'); assert.equal(s.base, 'gknight'); assert.equal(s.church, 'judar');
    assert.ok(s.sk.includes('pjudar') && s.sk.includes('psmite') && !s.sk.includes('prebec') && s.sk.includes('bash'), s.sk.join());
    assert.ok(s.on < s.off, JSON.stringify(s));
    assert.equal(s.pvp, 100, 'nothing changes player blows');
    assert.equal(s.st, 'j', 'the Judar aura rides in the presence fx');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('online: a priest\'s Heal mends a party member nearby; one outside the party gets nothing', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Cassia', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await a.eval(() => { const G = window.__G; G.S.cls = 'priest'; G.S.lv = 20; });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    // not in a party yet: nothing
    await b.eval(() => { window.__G.P.hp = 20; });
    await a.eval(() => window.__GPH.sk('pheal'));
    await settle(a, b);
    assert.ok(await b.eval(() => window.__G.P.hp < 26), 'no heal outside a party');
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await settle(a, b);
    await until(a, () => Satisfy.local.net().party.members.length === 2);
    await settle(a, b);
    await b.eval(() => { window.__G.P.hp = 20; });
    await a.eval(() => window.__GPH.sk('pheal'));
    await until(b, () => window.__G.P.hp > 40);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
