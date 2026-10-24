'use strict';
// SAT-ONLINE-161 (owner 2026-10-23: "add more titles in general, and above all titles with skills, as in the novel").
//   - every new title is listed in the status window, in both languages, and gives what it says;
//   - and then (22:55): "the passives work for every title you have and add up, but the active skill needs the title worn":
//     every owned title's effects count, worn or not, the old titles' too; a title's skill only while it is worn;
//   - the skills: Unbreakable Justice (ch 707, 300% at once), the Secret Hero's Unstoppable and Majesty;
//   - the passives: Apostle of Justice below 30% health, Hero King's Fighting Spirit, the First King's shield, Protagonist
//     of Two Eras after a legend's immortality, One Hit, One Kill! and the Martial God by the record in one hit, the
//     Vampire Slaughter King's 1,000 more, the Legend of the Canyon against great demons, Winston without tax, the Old
//     Gods' land without its gravity;
//   - titles for what was done before they existed: a quest's title, the first legendary item, an achievement's title.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function game() {
  const g = await H.openGame({});
  await H.newGame(g);
  await g.eval(() => { const G = window.__G; G.S.lv = 300; for (const k in G.S.st) G.S.st[k] = 200; G.P.x = 90 * 16; G.P.y = 60 * 16; G.P.inv = 1e9; G.P.hp = window.__GTTL.mh(); G.P.mp = 1e6; });
  await g.step(5);
  return g;
}

test('the new titles: listed in both languages; what each gives counts while you own it, worn or not, an old title too', async () => {
  const g = await game();
  try {
    const r = await g.eval(() => {
      const T = window.__GTTL, s = (l, k) => window.__GSET.str(l, k), G = window.__G, S = G.S;
      const miss = T.own().filter((id) => !s('en', 'tl_' + id) || !s('ar', 'tl_' + id) || !s('en', 'tl_' + id + 'D') || !s('ar', 'tl_' + id + 'D'));
      const st0 = {}, st1 = {};
      for (const k of ['str', 'sta', 'agi', 'int', 'dex']) st0[k] = T.stat(k);
      const h0 = T.mh(), snap = () => { const a = T.agg(); return { ...a.st, hp: a.hp }; }, none = snap(), flat = {};
      // each one given in turn, none of them worn: what it adds
      S.title = '';
      for (const id of ['apjus', 'kslay', 'fuim', 'flim', 'khero', 'ytemple', 'hell9']) { const p = snap(); T.give(id); S.title = ''; const n = snap(); flat[id] = Object.fromEntries(Object.keys(n).map((k) => [k, n[k] - p[k]])); }
      T.give('khero'); S.title = ''; const g0 = {}; for (const k of ['str', 'sta', 'agi', 'int', 'dex']) g0[k] = T.stat(k);
      S.title = 'khero'; for (const k of ['str', 'sta', 'agi', 'int', 'dex']) st1[k] = T.stat(k);
      const same = Object.keys(g0).every((k) => g0[k] === st1[k]);
      const h1 = T.mh(); S.title = ''; T.give('purifier'); S.title = ''; const hp10 = T.mh() / h1; S.title = 'purifier'; const hp10w = T.mh() / h1;
      return { miss, d: Object.fromEntries(Object.keys(st0).map((k) => [k, st1[k] - st0[k]])), flat, none, same, hp10, hp10w, n: T.own().length };
    });
    assert.deepEqual(r.miss, [], 'titles without both names and lines');
    assert.equal(r.n, 26); // 22 of SAT-ONLINE-161, First to Obtain a Second Class (SAT-ONLINE-171), the harvest fair's two and Keeper of Lore
    const z = { str: 0, sta: 0, agi: 0, int: 0, dex: 0, hp: 0 }, w = (o) => ({ ...z, ...o });
    assert.deepEqual(r.flat, {
      apjus: w({ str: 10, sta: 10, agi: 10, int: 10, dex: 10 }), kslay: w({ sta: 100, str: 30 }), fuim: w({ dex: 200 }), flim: w({ dex: 350 }),
      khero: w({ str: 120, sta: 120, agi: 120, int: 120, dex: 120 }), ytemple: w({ int: 60, hp: 1000 }), hell9: w({ hp: 3000 }) }, 'each one, owned and not worn');
    assert.deepEqual(r.none, z, 'no title yet: nothing');
    for (const k of Object.keys(r.d)) assert.ok(r.d[k] >= 120 + 10, k + ': ' + JSON.stringify(r.d)); // Kingdom's Hero and the Apostle add up, multipliers on top
    assert.ok(r.same, 'worn or not, the same stats');
    assert.ok(Math.abs(r.hp10 - 1.1) < 0.01 && Math.abs(r.hp10w - 1.1) < 0.01, 'an old title (Purifier, +10% health), worn or not: ' + r.hp10 + ' ' + r.hp10w);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("a title's active skills only while you wear it: Unbreakable Justice strikes for 300%; Unstoppable and Majesty", async () => {
  const g = await game();
  try {
    const before = await g.eval(() => { const T = window.__GTTL; return T.cls().filter(T.ok).includes('ujust'); });
    assert.equal(before, false, 'not before the title');
    const r = await g.eval(() => {
      const T = window.__GTTL, G = window.__G, P = G.P;
      T.give('apjus'); T.give('shero'); G.S.title = 'krage'; // another title worn: not theirs
      const on = () => ['ujust', 'jhmj', 'wise'].map((k) => T.ok(k) && T.cls().includes(k));
      const out = { other: on() }; G.S.title = 'shero'; out.shero = on(); G.S.title = 'apjus'; out.apjus = on();
      // the same monster hit by a basic blow and by Unbreakable Justice, with the dice held still
      const m = G.spawnMon('wolf', P.x, P.y + 20); m.max = m.hp = 1e9; P.dir = 0;
      const r0 = Math.random; Math.random = () => 0.5;
      let h = m.hp; window.__GWP.hit(m, 1); const basic = h - m.hp;
      h = m.hp; T.sk('ujust'); const just = h - m.hp;
      Math.random = r0;
      out.ratio = just / basic;
      // Unstoppable: the foes in a line ahead, not the one behind
      const a = G.spawnMon('wolf', P.x, P.y + 40), b = G.spawnMon('wolf', P.x, P.y - 40);
      G.S.title = 'shero'; a.max = a.hp = b.max = b.hp = 1e9; T.sk('jhmj'); out.line = [a.hp < 1e9, b.hp < 1e9];
      // Majesty: the monsters around hit 25% less for 8 s
      T.sk('wise'); out.awe = T.shield(1000, a);
      return out;
    });
    assert.deepEqual([r.other, r.shero, r.apjus], [[false, false, false], [false, true, true], [true, false, false]], 'usable and listed with their title worn only');
    assert.ok(Math.abs(r.ratio - 3) < 0.35, '300% of a basic blow: ' + r.ratio);
    assert.deepEqual(r.line, [true, false], 'Unstoppable hits the one ahead only');
    assert.equal(r.awe, 750);
    // the status window lists the titles and their skills, with their pictures
    await g.page.keyboard.press('c'); await g.step(3);
    const w = await g.eval(() => { const t = document.body.innerText, s = (k) => window.__GSET.str('en', k);
      return ['tl_apjus', 'tl_shero', 'sk_jhmj', 'sk_wise'].filter((k) => !t.includes(s(k))); });
    assert.deepEqual(w, [], 'missing from the status window');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("the passives, owned and not worn: Apostle below 30%, Fighting Spirit, the record in one hit, vampires, great demons, the East, Winston", async () => {
  const g = await game();
  try {
    const r = await g.eval(() => {
      const T = window.__GTTL, G = window.__G, P = G.P, S = G.S, o = {}, mh = T.mh();
      // Apostle of Justice: all stats +20% below 30% health
      T.give('apjus'); S.title = ''; P.hp = mh; T.tick(.016); const s1 = T.stat('str'); P.hp = mh * .2; T.tick(.016); o.jus = T.stat('str') / s1; P.hp = mh; T.tick(.016);
      // Hero King: each blow +1 Fighting Spirit (10 at rest), each point +0.5% Strength; back to 10 after 5 s out of a fight
      T.give('hking'); S.title = ''; const s2 = T.stat('str'); const w = G.spawnMon('wolf', P.x, P.y + 20); w.max = w.hp = 1e9;
      for (let i = 0; i < 20; i++) window.__GWP.hit(w, 1);
      o.fsp = P.fsp; o.fspStr = T.stat('str') / s2;
      // One Hit, One Kill! at 100,000 in one hit, the Martial God at 1,000,000; the critical multiplier follows the record
      S.title = ''; T.rec(150000); o.t1 = [!!S.tl.ohok, !!S.tl.mgod, +T.cdm().toFixed(2)];
      T.rec(2000000); o.t2 = [!!S.tl.ohok, !!S.tl.mgod, +T.cdm().toFixed(2)]; S.title = 'mgod'; o.t3 = +T.cdm().toFixed(2); S.title = '';
      // the Vampire Slaughter King: +10% and 1,000 more a hit, on vampires only
      T.give('vslay'); S.title = ''; o.vamp = [T.hit({ type: 'vjun', x: 0, y: 0 }, 10000, false), T.hit({ type: 'wolf', x: 0, y: 0 }, 10000, false)];
      // the Legend of the Canyon: great demons hit 15% less
      T.give('canyon'); S.title = ''; o.canyon = [T.shield(1000, { type: 'berith' }), T.shield(1000, { type: 'wolf' })]; S.title = 'canyon'; o.canyon.push(T.shield(1000, { type: 'berith' })); S.title = '';
      // Guardian of the Land of the Old Gods: the East's gravity (-10% Strength) no longer weighs
      const x0 = P.x; P.x = 1500 * 16; const e0 = T.stat('str'); T.give('oldgod'); S.title = ''; o.oldgod = T.stat('str') / e0; P.x = x0;
      // Winston's Person of Distinction: no tax in Winston
      const wn = G.npcs.map((n) => n.id).find((id) => T.town(id) === 'zWin'), out = G.npcs.map((n) => n.id).find((id) => T.town(id) && T.town(id) !== 'zWin');
      const p0 = T.price(wn, 1000), q0 = T.price(out, 1000); T.give('wdist'); S.title = ''; o.win = [T.town(wn), p0, T.price(wn, 1000), q0 === T.price(out, 1000)];
      return o;
    });
    assert.ok(Math.abs(r.jus - 1.2) < 0.02, 'Apostle below 30%: ' + r.jus);
    assert.ok(r.fsp >= 29 && r.fsp <= 31, 'Fighting Spirit after 20 blows: ' + r.fsp);
    assert.ok(r.fspStr > 1.08, 'and Strength with it: ' + r.fspStr);
    assert.deepEqual(r.t1, [true, false, 1.1]);
    assert.deepEqual(r.t2, [true, true, 1.7], 'the record at tier 2 (+20%) and the Martial God (+50%), both owned, none worn');
    assert.equal(r.t3, 1.7, 'worn or not, the same');
    assert.ok(Math.abs(r.vamp[0] - (r.vamp[1] * 1.1 + 1000)) < 1, JSON.stringify(r.vamp));
    assert.deepEqual(r.canyon, [850, 1000, 850], 'great demons 15% less, worn or not; a wolf the same');
    assert.ok(Math.abs(r.oldgod - 1 / 0.9) < 0.02, 'no gravity in the East: ' + r.oldgod);
    assert.equal(r.win[0], 'zWin');
    assert.ok(r.win[2] < r.win[1], 'cheaper in Winston: ' + r.win[1] + ' -> ' + r.win[2]);
    assert.ok(r.win[3], 'the same elsewhere');
    // Fighting Spirit drains back to 10 out of a fight
    await g.step(60 * 8);
    assert.equal(await g.eval(() => Math.round(window.__G.P.fsp)), 10);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("the First King's shield at 70% health lost, and Protagonist of Two Eras when a legend's immortality ends", async () => {
  const g = await game();
  try {
    const r = await g.eval(() => {
      const T = window.__GTTL, G = window.__G, P = G.P, mh = T.mh(), o = {};
      T.give('fking'); G.S.title = ''; P.inv = 0;
      // 75% of the health lost in the last minute
      T.hurt(mh * .75); P.hp = mh * .25; T.tick(.016);
      o.fk = [Math.round(P.fkA), Math.round(Math.min(mh * .5, mh * .75)), P.fkU > 0];
      o.absorb = T.shield(1000, null); // 10% less, then the shield takes it all
      return o;
    });
    assert.equal(r.fk[0], r.fk[1], 'a shield of what was lost, up to half the max');
    assert.ok(r.fk[2]);
    assert.equal(r.absorb, 0);
    // the legend's immortality: 1 HP and 5 s; when it ends, 20% back
    const h = await g.eval(() => { const T = window.__GTTL; T.give('legend'); T.give('twoera'); window.__G.S.title = ''; return T.mh(); });
    await g.eval(() => { const G = window.__G, P = G.P; P.hp = 1; P.tlLeg = 1e-9; }); // as legSave leaves it: the end time already past
    await g.step(2);
    const hp = await g.eval(() => window.__G.P.hp);
    assert.ok(Math.abs(hp - (1 + h * .2)) < 10, 'Two Eras: 20% back: ' + hp + ' of ' + h); // and a little natural recovery
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('titles for what was done before: a finished quest with a title, the first legendary item, an achievement already won', async () => {
  const g = await game();
  try {
    const r = await g.eval(() => {
      const T = window.__GTTL, G = window.__G, S = G.S;
      S.qs.pt6 = { st: 2, n: 1 }; S.qs.gj7 = { st: 2, n: 1 }; S.firstLeg = 1; S.ach = S.ach || {}; S.ach.k50000 = Date.now();
      S.kills.vjun = 300; S.kills.redk = 1;
      T.tick(10);
      return { got: ['apjus', 'khero', 'fuim', 'flim', 'massacre'].map((k) => !!S.tl[k]), worn: S.title };
    });
    assert.deepEqual(r.got, [true, true, true, true, true]);
    assert.equal(r.worn, 'apjus', 'the first title you get is worn when you wear none');
    // the kill-count ones come from the achievements (checked every 2 s)
    // (one achievement a check, and a level 300 character has a row of them waiting)
    for (let i = 0; i < 30 && !(await g.eval(() => !!(window.__G.S.tl.vslay && window.__G.S.tl.kslay))); i++) await g.step(60 * 2);
    assert.deepEqual(await g.eval(() => ['vslay', 'kslay'].map((k) => !!window.__G.S.tl[k])), [true, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
