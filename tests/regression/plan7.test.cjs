'use strict';
// Plan batch 7 (owner 2026-10-26 19:41: "continue the document's updates"): U054 a party summon, asked for and accepted,
// paid only on accept, refused where a Return Scroll can't go; U119 the Guardian of the Forest's pillars; U121 the orcs'
// shield wall and the Frostlight warband.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 };
async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}

test('a party summon: asked, accepted with Y, paid on accept; declined; refused where a scroll can\'t go', async () => {
  const ctx = await H.newContext({});
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, LOOK_A);
    await H.newGame(b, LOOK_B);
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await a.page.keyboard.press('KeyP'); await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY'); await settle(a, b);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    const ub = await b.eval(() => Satisfy.local.net().uid);
    // (owner 2026-10-27) no public party summon: no ⇲ in the panel, and a request goes nowhere
    assert.equal(await a.eval(() => document.querySelectorAll('#partyL button.smn').length), 0, 'no summon button');
    assert.equal(await a.eval((u) => window.__GSMN.ask(u), ub), false, 'no summons between party members');
    // the mechanism, kept for the knight summon
    for (const g of [a, b]) await g.eval(() => window.__GSMN.knight(true));
    // B walks off; A asks; nothing is paid until B says yes
    await b.eval(() => { const P = window.__G.P; P.x += 600; window.__G.S.gold = 50000; });
    await settle(a, b);
    const ax = await a.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));
    assert.equal(await a.eval((u) => window.__GSMN.ask(u), ub), true);
    await settle(a, b);
    await until(b, () => !document.getElementById('smnBox').hidden);
    const ask = await b.eval(() => ({ text: document.getElementById('smnT').textContent, gold: window.__G.S.gold, fee: window.__GSMN.fee() }));
    assert.match(ask.text, /^Grid wants to summon you to .+\. Going costs [\d,]+ gold\.$/);
    assert.equal(ask.gold, 50000, 'nothing paid yet');
    await b.page.keyboard.press('KeyY'); await settle(a, b);
    const went = await b.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y, gold: window.__G.S.gold, box: document.getElementById('smnBox').hidden }));
    assert.ok(Math.hypot(went.x - ax.x, went.y - ax.y) < 40, 'B stands by A: ' + JSON.stringify([went, ax]));
    assert.equal(went.gold, 50000 - ask.fee, 'the fee, on accept');
    assert.equal(went.box, true);
    await until(a, () => !window.__GSMN.R && true);
    // declined: B stays put and pays nothing
    await b.eval(() => { window.__G.P.x += 600; });
    await a.eval((u) => { window.__GSMN.cd(); return window.__GSMN.ask(u); }, ub); await settle(a, b);
    await until(b, () => !document.getElementById('smnBox').hidden);
    const before = await b.eval(() => [window.__G.P.x, window.__G.S.gold]);
    await b.page.keyboard.press('KeyN'); await settle(a, b);
    assert.deepEqual(await b.eval(() => [window.__G.P.x, window.__G.S.gold]), before, 'declined');
    // refused: B somewhere a scroll can't leave (a ghost), and A somewhere nobody can be summoned to (below the world: rooms, dungeons)
    await a.eval((u) => { window.__GSMN.cd(); return window.__GSMN.ask(u); }, ub); await settle(a, b);
    await until(b, () => !document.getElementById('smnBox').hidden);
    await b.eval(() => { window.__G.P.ghost = true; }); await b.page.keyboard.press('KeyY'); await settle(a, b);
    assert.deepEqual(await b.eval(() => [window.__G.P.x, window.__G.S.gold]), before, 'a ghost goes nowhere and pays nothing');
    await b.eval(() => { window.__G.P.ghost = false; });
    await a.eval((u) => { window.__GSMN.cd(); return window.__GSMN.ask(u); }, ub); await settle(a, b);
    await until(b, () => !document.getElementById('smnBox').hidden);
    await b.eval(() => { window.__G.P.hitT = window.__GPB7.gt(); }); await b.page.keyboard.press('KeyY'); await settle(a, b);
    assert.deepEqual(await b.eval(() => [window.__G.P.x, window.__G.S.gold]), before, 'no summons out of a fight');
    const deep = await a.eval((u) => { const P = window.__G.P, y0 = P.y; P.y = 1e6; window.__GSMN.cd(); const r = window.__GSMN.ask(u); P.y = y0; return r; }, ub);
    assert.equal(deep, false, 'nobody is summoned below the world');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

test('the Guardian\'s pillars: four stand by him; each turns away 15% of his damage; broken, they give nothing and rise later', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB7, ps = X.gps(), gd = X.mons().find((m) => m.type === 'guardian'), o = {};
      o.n = ps.length; o.near = ps.every((p) => Math.hypot(p.x - gd.x, p.y - gd.y) < 280); o.ids = ps.map((p) => p.nk || (p.type + '@' + (p.sx | 0) + ',' + (p.sy | 0)));
      o.cut = [X.gpAtk(gd)];
      G.P.x = gd.x + 60; G.P.y = gd.y;
      const hp0 = gd.hp; X.hitMon(gd, 1000, { pure: 1 }); const d4 = hp0 - gd.hp;
      const xp0 = S.xp, g0 = S.gold, k0 = (S.kills || {}).gpillar || 0; X.kill(ps[0]); X.kill(ps[1]); o.cut.push(X.gpAtk(gd)); o.free = [S.xp - xp0, S.gold - g0, ps[0].rt, ((S.kills || {}).gpillar || 0) - k0];
      X.kill(ps[2]); X.kill(ps[3]); o.cut.push(X.gpAtk(gd));
      gd.hp = gd.max; const hp1 = gd.hp; X.hitMon(gd, 1000, { pure: 1 }); const d0 = hp1 - gd.hp; o.ratio = Math.round(d4 / d0 * 100) / 100;
      const p = { ...ps[0] }; for (const q of ps) { q.dead = false; q.hp = q.max; } X.monTick(ps[0], 1); o.still = ps[0].x === ps[0].sx && ps[0].y === ps[0].sy && !(ps[0].eng > 0);
      return o;
    });
    assert.equal(r.n, 4); assert.equal(r.near, true); assert.ok(r.ids.every((k) => /^gpillar@\d+,\d+$/.test(k)) && new Set(r.ids).size === 4, 'fixed keys of the rules\' shape (their spots): ' + r.ids);
    assert.deepEqual(r.cut, [0.4, 0.7, 1]);
    assert.ok(Math.abs(r.ratio - 0.4) <= 0.02, 'his blow with four pillars up, against none: ' + r.ratio);
    assert.deepEqual(r.free, [0, 0, 90, 0], 'no experience, no gold, no kill on the books, back in 90 s');
    assert.equal(r.still, true, 'a pillar never moves or fights');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('orcs lock shields together; the Frostlight warband marches post to post, waits while it fights, and keeps its ids', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GPB7, o = {}, W = X.WB;
      const mv = X.moves('forc').find((m) => m.k === 'ward'); o.wall = !!(mv && mv.wall);
      // the shield wall: every orc beside the one who calls it
      const orcs = X.mons().filter((m) => m.type === 'forc' && !m.dead && !m.band).slice(0, 3), c = orcs[0];
      orcs[1].x = c.x + 20; orcs[1].y = c.y; orcs[2].x = c.x + 400; orcs[2].y = c.y;
      X.mxk('ward', c, mv); const t0 = X.gt(); o.warded = orcs.map((m) => m.wardT > t0 ? m.wardR : 0); orcs[1].wardT = 0; X.mxk('ward', c, mv); o.again = orcs[1].wardT > t0;
      // the warband
      o.n = W.ms.length; o.ids = W.ms.map((m) => m.nk); o.pts = W.pts.length;
      G.P.x = W.x + 3000; G.P.y = W.y;
      const x0 = W.x, y0 = W.y, p1 = W.pts[1], d0 = Math.hypot(p1.x - x0, p1.y - y0);
      for (let i = 0; i < 100; i++) { X.wbTick(0.1); for (const m of W.ms) { m.x = m.sx; m.y = m.sy; } }
      o.moved = Math.round(d0 - Math.hypot(p1.x - W.x, p1.y - W.y));
      W.ms[2].eng = 4; const x1 = W.x, y1 = W.y; for (let i = 0; i < 50; i++) X.wbTick(0.1); o.waited = W.x === x1 && W.y === y1; W.ms[2].eng = 0;
      W.ms[3].x += 900; X.wbTick(0.1); o.caught = Math.hypot(W.ms[3].x - W.ms[3].sx, W.ms[3].y - W.ms[3].sy) < 1;
      // the posts are on open ground the band can walk between; one stuck in sight is put back after 20 s
      o.span = [Math.min(...W.pts.map((p) => p.x)), Math.max(...W.pts.map((p) => p.x))];
      G.P.x = W.ms[1].x + 100; G.P.y = W.ms[1].y; W.ms[1].x += 150; W.ms[1].sx0 = 1;
      o.stuck = 0; for (let i = 0; i < 260 && !o.stuck; i++) { X.wbTick(0.1); if (Math.hypot(W.ms[1].x - W.ms[1].sx, W.ms[1].y - W.ms[1].sy) < 5) o.stuck = Math.round(i / 10); }
      o.healed = (() => { const m = W.ms[4]; delete m.band; delete m.bi; X.wbTick(0.1); return m.band === 1 && m.bi === 4 && Number.isFinite(m.sx); })();
      return o;
    });
    assert.equal(r.wall, true);
    assert.deepEqual(r.warded, [0.6, 0.6, 0], 'the one beside him locks shields; one far off doesn\'t');
    assert.equal(r.again, false, 'not called again while he holds his shield');
    assert.equal(r.n, 5); assert.deepEqual(r.ids, ['forc@-1,-1', 'forc@-1,-2', 'forc@-1,-3', 'forc@-1,-4', 'forc@-1,-5'], 'the band\'s fixed keys, of the rules\' shape');
    assert.ok(r.pts >= 4, 'posts: ' + r.pts);
    assert.ok(r.moved >= 170 && r.moved <= 185, '18 px a second for 10 s: ' + r.moved);
    assert.equal(r.waited, true, 'the march waits while one of them fights');
    assert.equal(r.caught, true, 'one left behind out of sight catches up');
    assert.ok(r.span[1] - r.span[0] > 600, 'the march covers the orcs\' land: ' + r.span);
    assert.ok(r.stuck >= 19 && r.stuck <= 22, 'one stuck in sight is put back in line after 20 s: ' + r.stuck);
    assert.equal(r.healed, true, 'a member that lost its band fields (a follower\'s revive) gets them back');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
