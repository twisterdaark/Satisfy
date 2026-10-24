'use strict';
// SAT-ONLINE-159 (owner 2026-10-23): "the four legendary beasts belong to another continent you travel to by a scroll, as in the
// novel"; "make it a copy of the novel with all its content"; "at least twice as big: the size of the other continent or
// bigger". The East Continent lies past the Red Sea: no walking, sailing or flying across; the Behen store's portal scroll
// takes you to Pangea's White Tree Forest; a Return Scroll can't cross (ch 549); the East's gravity takes 10% off strength,
// stamina and agility (ch 513); the beasts, the kingdoms, the people and the novel's quests are there.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
// a crossing fades out and in on real time: wait until the player has moved
const waitX = async (g) => { const x0 = await g.eval(() => window.__G.P.x); for (let i = 0; i < 30 && (await g.eval(() => window.__G.P.x)) === x0; i++) { await g.page.waitForTimeout(100); await g.step(2); } };
const ZONES = ['zEaRedSea', 'zEaSea', 'zEaPangea', 'zEaDesert', 'zEaGate', 'zEaTiger', 'zEaPa', 'zEaPaC', 'zEaWTig', 'zEaXing', 'zEaXingC', 'zEaTort', 'zEaBarb', 'zEaKaya', 'zEaKayaC', 'zEaDrag', 'zEaCho', 'zEaKars', 'zEaFarm', 'zEaLava', 'zEaPhx', 'zEaMurS', 'zEaMur'];

test('the East is its own land past the Red Sea, as big as the West or bigger; the beasts, kingdoms and people are on it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval((ZONES) => { const E = window.__GEA, G = window.__G, at = G.at, W = Satisfy.local.world(), o = {};
      let west = 0, east = 0, sea = 0;
      for (let y = -W.north; y < W.outdoorH; y += 2) for (let x = 0; x < W.w; x += 2) { const v = at(x, y); if (x < 964) { if (v !== 4) west++; } else if (E.eaLand(x, y)) east++; }
      for (let y = -W.north; y < W.outdoorH; y++) for (let x = 964; x < 992; x++) if (at(x, y) !== 4) sea++;
      Object.assign(o, { west, east, sea, w: W.w, lim: Satisfy.net.LIMITS.posX });
      o.beasts = Object.fromEntries(['sdrag', 'stiger', 'sbird', 'stort'].map((k) => { const m = G.mons().find((m) => m.type === k); return [k, [Math.round((m.sx - 8) / 16), Math.round((m.sy - 8) / 16), Satisfy.local.zoneAt(m.sx, m.sy)]]; }));
      o.zones = [[E.EPG.gx, E.EPG.gy], [E.EKARS.gx, E.EKARS.gy], [E.EXING.gx, E.EXING.gy], [E.EKAYA.gx, E.EKAYA.gy], [E.EPA.gx, E.EPA.gy], [E.EMUR.x, E.EMUR.y], [E.ELAVA.x, E.ELAVA.y], [1200, 190], [1600, 200], [1500, -120], [1900, -100], [1900, 180], [1400, 40], [978, 40]].map(([x, y]) => Satisfy.local.zoneAt(x * 16 + 8, y * 16 + 8));
      o.towns = W.towns.filter((k) => /^zEa/.test(k));
      o.safe = o.towns.filter((k) => !Satisfy.net.zonePolicy(k).safe);
      // every zone, every monster and every person of the East has a name in both languages
      const npcs = G.npcs.filter((n) => n.x >= 992 * 16).map((n) => n.id), mt = [...new Set(G.mons().filter((m) => m.x >= 992 * 16).map((m) => m.type))];
      o.missing = [];
      for (const k of [...ZONES, ...npcs, ...mt.filter((k) => !['sdrag', 'stiger', 'sbird', 'stort'].includes(k)).map((k) => k + 'N'), 'ecscr', 'ecscrD', 'tl_pgstar', 'tl_phxg', 'tl_btprot'])
        for (const L of ['en', 'ar']) if (typeof E.str(L, k) !== 'string') o.missing.push(L + ':' + k);
      o.npcs = npcs.length; o.kinds = mt.length;
      // every East monster stands in the East and none of the West's old kinds was moved there
      o.westKinds = mt.filter((k) => !/^e|^(sdrag|stiger|sbird|stort|arube|gildong)$/.test(k));
      return o; }, ZONES);
    assert.ok(r.east >= r.west, 'the East has at least as much land as the West: ' + r.east + ' / ' + r.west);
    assert.equal(r.sea, 0, 'the Red Sea between them is all water');
    assert.ok(r.w * 16 <= r.lim, 'the map fits the database bounds');
    assert.deepEqual(r.beasts, { sdrag: [2008, 124, 'zEaDrag'], stiger: [1024, -64, 'zEaWTig'], sbird: [1530, 252, 'zEaPhx'], stort: [1530, -141, 'zEaTort'] });
    assert.deepEqual(r.zones, ['zEaPangea', 'zEaKars', 'zEaXingC', 'zEaKayaC', 'zEaPaC', 'zEaMur', 'zEaLava', 'zEaDesert', 'zEaCho', 'zEaXing', 'zEaBarb', 'zEaKaya', 'zEaMurS', 'zEaRedSea']);
    assert.deepEqual(r.towns, ['zEaPangea', 'zEaKars', 'zEaXingC', 'zEaKayaC', 'zEaPaC', 'zEaFarm']);
    assert.deepEqual(r.safe, [], 'the East\'s towns are safe');
    assert.deepEqual(r.missing, []);
    assert.ok(r.npcs >= 30 && r.kinds >= 20, r.npcs + ' people, ' + r.kinds + ' kinds of monster');
    assert.deepEqual(r.westKinds, [], 'no West kind in the East');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('nothing crosses the Red Sea: not on foot, by boat or flying; the view stays on your continent', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const E = window.__GEA, P = window.__G.P, o = {}, split = E.split * 16;
      P.x = split - 6; P.y = 40 * 16; P.fly = 30; for (let i = 0; i < 40; i++) E.mv(2, 0); o.fly = P.x < split; P.fly = 0;
      P.x = split - 6; P.boat = 1; for (let i = 0; i < 40; i++) E.mv(2, 0); o.boat = P.x < split; P.boat = 0;
      P.x = split + 6; P.fly = 30; for (let i = 0; i < 40; i++) E.mv(-2, 0); o.back = P.x >= split; P.fly = 0;
      P.x = split - 40; P.y = 40 * 16; return o; });
    assert.deepEqual(r, { fly: true, boat: true, back: true });
    await g.step(90);
    const cam = await g.eval(() => ({ see: window.__GEA.view(), split: window.__GEA.split * 16 }));
    assert.ok(cam.see[1] <= cam.split, 'from the Saharan coast the view stops at the middle of the Red Sea: ' + cam.see + ' / ' + cam.split);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Behen store sells the portal scroll; it sets you down in Pangea with the gravity penalty; a Return Scroll cannot cross', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, E = window.__GEA, X = window.__GRT, o = {};
      S.bh = { cp: 1500 }; const op = E.shop()[0]; o.label = op.l; op.f(); o.cp = S.bh.cp; o.have = S.mats.ecscr;
      o.str0 = E.stat('str'); o.sta0 = E.stat('sta'); o.int0 = E.stat('int');
      P.x = 300 * 16; P.y = 120 * 16; X.use('ecscr'); o.casting = !!P.rcast; return o; });
    assert.match(r.label, /East Continent Portal Scroll \(1,000 Challenger Points\)/);
    assert.equal(r.cp, 500); assert.equal(r.have, 1); assert.ok(r.casting);
    await g.step(200);
    // the crossing fades out and in, and the first arrival's words follow it (both on real time)
    for (let i = 0; i < 40 && !(await g.eval(() => window.__G.mode === 'dialog' && window.__G.P.x >= 992 * 16)); i++) { await g.page.waitForTimeout(100); await g.step(2); }
    const a = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, E = window.__GEA; return { zone: Satisfy.local.zoneAt(P.x, P.y), at: [P.x, P.y], port: [E.EAPORT.x, E.EAPORT.y], v: S.ea.v, left: S.mats.ecscr, mode: G.mode, str: E.stat('str'), sta: E.stat('sta'), int: E.stat('int') }; });
    assert.equal(a.zone, 'zEaPangea'); assert.deepEqual(a.at, a.port, 'in the White Tree Forest'); assert.equal(a.v, 1); assert.equal(a.left, 0);
    assert.equal(a.mode, 'dialog', 'the first arrival tells you where you are and about the gravity');
    assert.equal(a.str, Math.round(r.str0 * .9)); assert.equal(a.sta, Math.round(r.sta0 * .9)); assert.equal(a.int, r.int0, 'intelligence is untouched');
    for (let i = 0; i < 6 && (await g.eval(() => window.__G.mode)) === 'dialog'; i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
    // a Return Scroll whose inn is in the West does nothing here (ch 549), and isn't used up
    const b = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GRT; S.mats.rscroll = 1; S.bind = 'inn'; S.rsT = 0; X.use('rscroll'); return { cast: !!P.rcast, mode: G.mode, n: S.mats.rscroll }; });
    assert.deepEqual(b, { cast: false, mode: 'dialog', n: 1 });
    await g.eval(() => window.__G.advance()); await g.step(2);
    // with no inn of its own it goes to the nearest town on this continent
    const c = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GRT; S.bind = null; P.x = 1600 * 16; P.y = 205 * 16; X.use('rscroll'); return !!P.rcast; });
    assert.ok(c);
    await g.step(200);
    assert.equal(await g.eval(() => Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y)), 'zEaKars');
    // dying in the East with your inn in the West: you wake in the East's nearest town
    await g.eval(() => { const G = window.__G, S = G.S, P = G.P; S.bind = 'inn'; P.x = 1230 * 16; P.y = 80 * 16; P.inv = 0; P.hp = 0; G.die(); window.__GK.respawn(); });
    await g.step(10);
    assert.ok(await g.eval(() => window.__G.P.x >= 992 * 16), 'still on the East Continent');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the magic circles carry you across once you have been there; back in the West at your inn or by Reinhardt\'s circle', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, E = window.__GEA, o = {}; S.gold = 100000;
      E.circle(true); o.cold = G.mode; window.__G.advance(); S.ea = { v: 1 }; return o; });
    assert.equal(r.cold, 'dialog');
    await g.step(5);
    const b = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, E = window.__GEA; P.x = E.EAPORT.x; P.y = E.EAPORT.y; S.bind = null; E.cross(false); return 1; });
    await g.step(40); await waitX(g);
    const c = await g.eval(() => { const G = window.__G, P = G.P, E = window.__GEA; return { x: P.x, y: P.y, w: [E.ECW.x * 16 + 8, (E.ECW.y + 2) * 16 + 10], zone: Satisfy.local.zoneAt(P.x, P.y) }; });
    assert.deepEqual([c.x, c.y], c.w, 'by Reinhardt\'s circle'); assert.equal(c.zone, 'zRein');
    await g.eval(() => window.__GEA.cross(true)); await g.step(40); await waitX(g);
    await g.eval(() => { const S = window.__G.S; S.bind = 'inn'; window.__GEA.cross(false); }); await g.step(40); await waitX(g);
    const d = await g.eval(() => { const G = window.__G, P = G.P, n = G.npcs.find((n) => n.id === 'inn'); return [P.x - n.x, P.y - n.y]; });
    assert.deepEqual(d, [0, 18], 'at your inn in the West');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the novel\'s quests: the gateways, Arube captured or killed, Han Seokbong in the Lava Prison, the Red Phoenix\'s seals, the Black Tortoise', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, E = window.__GEA, o = {}; S.lv = 380; S.ea = { v: 1 }; P.x = E.EAPORT.x; P.y = E.EAPORT.y;
      // the third gateway (ch 1161) gives "Pangea's New Star"
      G.acceptQ('ea0'); E.act(E.pt('eagate')[0]); o.gate0 = E.ready('ea0'); if (G.DL && G.DL.done) { const d = G.DL.done; G.DL.done = null; d(); } o.keepers = E.gk().length; for (const m of E.gk()) window.__GBH.kill(m); o.gate = !o.gate0 && o.keepers === 5 && E.ready('ea0'); /* the third gateway is broken by beating its keepers (owner 2026-10-24) */ G.completeQ('ea0'); o.star = !!S.tl.pgstar;
      // Arube: capture opens the daoist priest's quest; kill gives two levels and ends it (ch 543)
      S.qs.ea1 = { st: 2 }; G.acceptQ('ea2'); S.qs.ea2.c = 1; G.completeQ('ea2'); o.ea3a = E.avail('ea3');
      const xp0 = S.xp, need = G.xpNeed(); E.arube()[0].f(); o.capXp = Math.round((S.xp - xp0) / need * 100); o.ar = S.ea.ar; o.ea3 = E.avail('ea3'); o.ea4a = E.avail('ea4');
      G.acceptQ('ea3'); S.qs.ea3.c = 1; G.completeQ('ea3'); o.bow = S.items.some((i) => i.id === 'rpbow'); o.jail = E.jail(); E.vis();
      const hid = (id) => G.npcs.find((n) => n.id === id).hidden; o.vis1 = [hid('hanS'), hid('hanS2')]; o.ea4 = E.avail('ea4');
      // the warden of the Lava Prison: "or rescue them by force" (ch 633)
      G.acceptQ('ea4'); E.kill('ewarden'); o.ready4 = E.ready('ea4'); G.completeQ('ea4'); E.vis(); o.vis2 = [hid('hanS'), hid('hanS2')]; o.aff = S.aff.hanS;
      // the Red Phoenix's three seals (ch 1161)
      G.acceptQ('ea5'); for (const s of E.pt('phxseal')) E.act(s); o.ready5 = E.ready('ea5'); const b0 = S.mats.brphx || 0; G.completeQ('ea5'); o.phx = [!!S.tl.phxg, (S.mats.brphx || 0) - b0];
      // Hwang Gildong and the Black Tortoise's shrine (ch 1210)
      G.acceptQ('ea6'); S.qs.ea6.c = 1; G.completeQ('ea6'); G.acceptQ('ea7'); E.act(E.pt('btshrine')[0]); o.ready7 = E.ready('ea7'); G.completeQ('ea7');
      o.bt = [!!S.tl.btprot, S.items.some((i) => i.id === 'ttshell')];
      return o; });
    assert.ok(r.gate && r.star, 'the gateway and the title ' + JSON.stringify([r.gate0, r.keepers, r.gate, r.star]));
    assert.equal(r.ea3a, false, 'nothing before you choose');
    assert.equal(r.capXp, 30); assert.equal(r.ar, 'cap'); assert.equal(r.ea3, true); assert.equal(r.ea4a, false, 'Han Seokbong is still free');
    assert.ok(r.bow, 'the Red Phoenix Bow comes back'); assert.ok(r.jail);
    assert.deepEqual(r.vis1, [true, false], 'Han Seokbong is in the Lava Prison'); assert.ok(r.ea4);
    assert.ok(r.ready4, 'the warden\'s fall frees them'); assert.deepEqual(r.vis2, [false, true], 'back in Pangea'); assert.equal(r.aff, 100);
    assert.ok(r.ready5); assert.deepEqual(r.phx, [true, 1]);
    assert.ok(r.ready7); assert.deepEqual(r.bt, [true, true]);
    // the other road: killing Arube gives two levels and the quest ends
    const k = await g.eval(() => { const G = window.__G, S = G.S, E = window.__GEA; S.ea = { v: 1 }; const lv = S.lv; E.arube()[1].f(); return { up: S.lv - lv, ar: S.ea.ar, ea3: E.avail('ea3') }; });
    assert.deepEqual(k, { up: 2, ar: 'kill', ea3: false });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a save from before the East keeps the fog it had uncovered', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, E = window.__GEA, w = Math.ceil(964 / 8), h = Math.ceil((272 + 172) / 8);
      let b = ''; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b += String.fromCharCode(x === 100 && y === 30 || x === 5 && y === 2 ? 1 : 0);
      S.fog = btoa(b); E.fogReload(); return { a: E.fogSeen(100 * 8 + 2, 30 * 8 - 172 + 2), b: E.fogSeen(5 * 8 + 2, 2 * 8 - 172 + 2), c: E.fogSeen(101 * 8 + 2, 30 * 8 - 172 + 2), len: atob(S.fog).length, w: Math.ceil(Satisfy.local.world().w / 8) * h }; });
    assert.deepEqual(r, { a: true, b: true, c: false, len: r.w, w: r.w });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('online: two players in the East see each other where they are (x past the old 16384 px bound)', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  const online = async (k, uid, name) => {
    const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
    await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
    for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
    return g;
  };
  try {
    const a = await online('a', 'eaA1', 'Ahmed'); await H.newGame(a, LOOK);
    const b = await online('b', 'eaB2', 'Bassem'); await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    for (const [g, dx] of [[a, 0], [b, 40]]) await g.eval((dx) => { const E = window.__GEA, S = window.__G.S, P = window.__G.P; S.ea = { v: 1 }; P.x = E.EKARS.gx * 16 + 8 + dx; P.y = (E.EKARS.gy + 6) * 16; P.inv = 1e9; }, dx);
    for (let i = 0; i < 60; i++) { await a.step(2); await b.step(2); await a.page.waitForTimeout(15); }
    const seen = await a.eval(() => Satisfy.local.net().remotes.map((r) => ({ x: Math.round(r.x), name: r.handle })));
    const bx = await b.eval(() => Math.round(window.__G.P.x));
    assert.ok(seen.some((r) => Math.abs(r.x - bx) < 24), JSON.stringify(seen) + ' / ' + bx);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
