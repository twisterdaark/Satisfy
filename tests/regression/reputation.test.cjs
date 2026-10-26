'use strict';
// Continent reputation and the Reputation Store (v0.96): great deeds raise "reputation throughout the continent"; from
// 3,000 a golden carriage only you can see brings the store, where reputation buys Sweet Candy, the Good-looking
// Sunglasses and draws from the machine. Town ranks open the merchant's rare stock and free rooms for the Town Hero.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
const dl = (g) => g.eval(() => { const D = window.__G.DL; return D ? { who: D.who, text: document.getElementById('dtext').textContent, opts: (D.opts || []).map((o) => o.l), optOn: D.optOn } : null; });
async function toOpts(g) { await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && G.DL && !G.DL.optOn; i++) G.advance(); }); await g.step(1); }

test('reputation throughout the continent: quests, town ranks and S quests raise it, with the novel\'s message', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => window.__GRS.crepAdd(150));
    assert.match(await toasts(g), /Reputation throughout the continent will rise by \+150\./);
    // a quest for a Winston townsman: town reputation, and three times as much across the continent
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, QD = G.QD;
      const id = 'hn1';
      S.qs[id] = { st: 1, c: 999 }; const q = QD[id], rn = 10 + Math.min(15, Math.floor((q.xp || 0) / 200)), c0 = S.crep;
      G.completeQ(id); return { id, rn, gain: S.crep - c0, town: (S.rep || {}).zWin };
    });
    assert.ok(r.id, 'a plain hunter quest');
    assert.ok(r.gain >= r.rn * 3, JSON.stringify(r));
    // a new town rank adds 100 per rank
    const k = await g.eval(() => { const G = window.__G, S = G.S; S.rep.zWin = 149; return S.crep; });
    await g.eval(() => { const G = window.__G, S = G.S; const o = G.QD.ow1.obj; S.mats[o.it] = o.n; S.qs.ow1 = { st: 1, c: 0 }; G.completeQ('ow1'); });
    const k2 = await g.eval(() => window.__G.S.crep);
    assert.ok(k2 - k >= 200 + 30 && (await g.eval(() => window.__G.S.rep.zWin)) >= 150, `Respected adds 200 on top of the quest (${k} -> ${k2})`);
    // the store is shut below 3,000
    await g.eval(() => { window.__G.S.crep = 2500; window.__GRS.rsCall(); });
    assert.match(await toasts(g), /You can use the Reputation Store when your reputation reaches over 3,000/);
    assert.equal(await g.eval(() => window.__GRS.RSC), null);
    // crossing 3,000 says so
    await g.eval(() => window.__GRS.crepAdd(600));
    await g.page.waitForTimeout(1100);
    assert.match(await toasts(g), /You currently have 3,100 reputation throughout the continent\. You can now use the Reputation Store\./);
  } finally { await g.close(); }
});

test('the Reputation Store: the golden carriage falls, Sweet Candy (+30% all stats, five per account), the sunglasses, the drawing machine', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const S = window.__G.S; S.crep = 60000; window.__GRS.rsCall(); });
    assert.match(await toasts(g), /This is a special service for the best in Satisfy!/);
    assert.ok(await g.eval(() => !!window.__GRS.RSC));
    for (let i = 0; i < 70; i++) await g.step(1);
    await g.page.waitForTimeout(400);
    let d = await dl(g);
    assert.equal(d && d.who, 'rstore');
    assert.match(d.text, /Introducing the luxurious goods to our guest!/);
    await toOpts(g);
    d = await dl(g);
    assert.deepEqual(d.opts, ['Sweet Candy', 'Good-looking Sunglasses', 'Bounty Book', 'Draw! Draw! Draw everything!', 'Leave']);
    // Sweet Candy: 20,000, into the bag; in the mouth all stats rise by 30%
    const s0 = await g.eval(() => window.__GRS.stat('str'));
    await g.eval(() => window.__G.pickOpt(0));
    await g.step(1);
    assert.deepEqual(await g.eval(() => [window.__G.S.crep, window.__G.S.mats.candy, window.__G.S.rsh.c]), [40000, 1, 1]);
    assert.match((await dl(g)).text, /Congratulations! Sweet Candy has been acquired!/);
    await g.eval(() => window.__GRS.rsUse('candy'));
    const s1 = await g.eval(() => window.__GRS.stat('str'));
    assert.equal(s1, Math.round(s0 * 1.3), `${s0} -> ${s1}`);
    assert.equal(await g.eval(() => window.__GRS.candyOn()), true);
    await g.eval(() => { window.__G.S.playT += 301; });
    assert.equal(await g.eval(() => window.__GRS.stat('str')), s0);
    // only five per account
    await g.eval(() => { window.__G.S.rsh.c = 5; window.__G.S.crep = 60000; window.__GRS.rsBuy('candy'); });
    await g.step(1);
    assert.match((await dl(g)).text, /only be purchased five times per account/);
    assert.equal(await g.eval(() => window.__G.S.crep), 60000);
    // the sunglasses: 5,000, worn at once; your sprite and your presence carry them
    await g.eval(() => window.__GRS.rsBuy('sgl'));
    await g.step(1);
    assert.deepEqual(await g.eval(() => [window.__G.S.crep, window.__G.S.rsh.g, window.__G.S.rsh.w]), [55000, 1, 1]);
    assert.match(await g.eval(() => window.__GRS.pSpr()), /g$/);
    assert.match(await g.eval(() => window.__GRS.fxPub()), /"gl:1"/);
    d = await dl(g);
    assert.equal(d.opts[1], 'Take off the Good-looking Sunglasses');
    await g.eval(() => window.__G.pickOpt(1));
    await g.step(1);
    assert.doesNotMatch(await g.eval(() => window.__GRS.pSpr()), /g$/);
    assert.doesNotMatch(await g.eval(() => window.__GRS.fxPub()), /gl:1/);
    // the drawing machine: 999 a try, a failure or one of its goods
    const dr = await g.eval(() => { const G = window.__G, S = G.S, c0 = S.crep, ks = ['hairpin', 'dskewer', 'choco', 'blocks', 'xpot']; const m0 = ks.reduce((a, k) => a + (S.mats[k] || 0), 0); for (let i = 0; i < 30; i++)window.__GRS.rsBuy('draw'); return { spent: c0 - S.crep, got: ks.reduce((a, k) => a + (S.mats[k] || 0), 0) - m0, d: S.rsh.d }; });
    assert.equal(dr.spent, 30 * 999);
    assert.equal(dr.d, 30);
    assert.ok(dr.got >= 1 && dr.got < 30, JSON.stringify(dr));
    const txt = (await dl(g)).text;
    assert.ok(/This! You have failed!|Congratulations! .+ has been acquired!/.test(txt), txt);
    // leaving: the carriage flies off
    await g.eval(() => { const G = window.__G, o = G.DL.opts; G.pickOpt(o.length - 1); });
    for (let i = 0; i < 90; i++) await g.step(1);
    assert.equal(await g.eval(() => window.__GRS.RSC), null);
    // the Experience Increase Potion: +20% for three days
    await g.eval(() => { window.__G.S.mats.xpot = 1; window.__GRS.rsUse('xpot'); });
    assert.equal(await g.eval(() => window.__GRS.xpbOn()), true);
    const xp = await g.eval(() => { const S = window.__G.S; S.xp = 0; window.__G.gainXP(10); return S.xp; });
    assert.equal(xp, 14, 'x1.2 (every XP, v2.80) and x1.2 (the potion)');
    // the hairpin: a woman is delighted (double)
    const aff = await g.eval(() => { const G = window.__G, S = G.S; S.mats.hairpin = 2; const a0 = (S.aff || {}).stylist || 0; G.eqx.giveGift('stylist', 'hairpin'); return ((S.aff || {}).stylist || 0) - a0; });
    assert.equal(aff, 24);
  } finally { await g.close(); }
});

test('town ranks: the Honoured buy rare stock from the merchant, the Town Hero sleeps free', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    assert.ok(!(await g.eval(() => window.__GRS.merch('merchant'))).some((l) => /Honoured stock/.test(l)));
    await g.eval(() => { const S = window.__G.S; S.rep = S.rep || {}; S.rep.zWin = 400; S.gold = 5000; });
    let m = await g.eval(() => window.__GRS.merch('merchant'));
    assert.ok(m.some((l) => /^Honoured stock: Mana Stone/.test(l)), m.join(' / '));
    assert.ok(!m.some((l) => /Enchant/i.test(l) && /Honoured stock/.test(l)));
    const got = await g.eval(() => { const S = window.__G.S, n0 = S.mats.mstone || 0; for (let i = 0; i < 4; i++)window.__GRS.honBuy('merchant', 'mstone'); return (S.mats.mstone || 0) - n0; });
    assert.equal(got, 3);
    await g.eval(() => { window.__G.S.rep.zWin = 800; });
    m = await g.eval(() => window.__GRS.merch('merchant'));
    assert.equal(m.filter((l) => /Honoured stock/.test(l)).length, 4, m.join(' / ')); // + the blessing and protection stones (v1.82)
    const inn = await g.eval(() => window.__GRS.inn('inn'));
    assert.ok(inn.includes('A free room (Town Hero)'), inn.join(' / '));
  } finally { await g.close(); }
});

test('online: the sunglasses show on your character on other players\' screens', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await a.eval(() => { const S = window.__G.S; S.crep = 9000; window.__GRS.rsBuy('sgl'); });
    await b.eval(([x, y]) => { window.__G.P.x = x + 20; window.__G.P.y = y; }, await a.eval(() => [window.__G.P.x, window.__G.P.y]));
    for (let i = 0; i < 10; i++) { for (const g of [a, b]) await g.step(3); await a.page.waitForTimeout(150); }
    const keys = await b.eval(() => window.__GRS.shKeys().filter((k) => k.startsWith('rp_')));
    assert.ok(keys.some((k) => /^rp_1_2_1_3_\dg$/.test(k)), keys.join(' '));
  } finally { await ctx.close(); }
});
