'use strict';
// Plan batch 6 (owner 2026-10-26 19:41: "continue the document's updates"): U090 plowing and watering Piaro's plots;
// U280 torn recipe pages put together into a rare recipe book; U207 the weekly profession contracts and their ledger;
// U115 goblin scouts walking a round of posts.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const closeDialogs = async (g) => {
  for (let i = 0; i < 10 && await g.eval(() => window.__G.mode) === 'dialog'; i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
};

test('Piaro\'s plots: plow for one more crop, water once for a quicker crop; the farming contract counts the harvest', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB6, s = X.p4S(), o = {};
      S.gold = 100000; S.mats.compost = 0; S.lv = 30;
      X.plotAct(0); o.offer = G.DL.opts.map((x) => x.l)[0];
      X.plow(0); o.after = G.DL.opts.some((x) => /^Plow/.test(x.l)); o.plowed = !!s.pw[0];
      X.plant(0, 'wheat'); X.plant(1, 'wheat'); o.n = [s.pl[0].n, s.pl[1].n]; o.pwLeft = !!s.pw[0]; o.pw = s.pl[0].pw;
      const p = s.pl[1]; p.t0 -= p.d / 2; const d0 = p.d, left = p.t0 + p.d - Date.now();
      X.plotAct(1); o.waterOpt = G.DL.opts.map((x) => x.l);
      X.water(1); o.cut = d0 - p.d; o.left = left; o.w = p.w; const d1 = p.d; X.water(1); o.again = p.d === d1;
      // the farming contract: taken, then the next harvest counts
      X.wcMenu(); const take = G.DL.opts.find((x) => x.l.startsWith('Farming:')); take.f(); o.taken = !!X.wcS().on.farm;
      const q = s.pl[0]; q.t0 = Date.now() - q.d - 1000; const wh = () => (S.mats.wheat || 0) + (S.mats.shnwheat || 0), w0 = wh(); X.harvest(0);
      o.got = wh() - w0; o.count = X.wcS().c.farm; o.free = !s.pl[0] && !s.pw[0];
      return o;
    });
    assert.equal(r.offer, 'Plow the soil first');
    assert.equal(r.after, false, 'no plowing twice');
    assert.equal(r.plowed, true);
    assert.equal(r.n[0], r.n[1] + 1, 'the plowed plot gives one more: ' + r.n);
    assert.equal(r.pwLeft, false, 'the crop uses the plowed soil'); assert.equal(r.pw, 1);
    assert.deepEqual(r.waterOpt, ["Water it from Piaro's barrel", 'Close']);
    assert.ok(Math.abs(r.cut - r.left * 0.3) < 2000, 'a third of what was left, less: ' + r.cut + ' of ' + r.left);
    assert.equal(r.w, 1); assert.equal(r.again, true, 'watered once');
    assert.equal(r.taken, true);
    assert.equal(r.got, r.n[0]); assert.equal(r.count, r.n[0], 'the contract counts the crops'); assert.equal(r.free, true);
    await closeDialogs(g);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('torn recipe pages: four make a rare book you lack; boss quests give one once; the smithing contract\'s ledger', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB6, RS = window.__GRS, o = {};
      o.rare = X.bpRare(); o.chance = X.bpChance();
      // bosses give at most BPDAY pages a day
      S.mats.bpfrag = 0; for (let i = 0; i < 300; i++) X.bpBoss(); o.day = [S.mats.bpfrag, X.BPDAY(), X.dly().bp];
      // contracts start at level 20
      S.lv = 5; X.wcMenu(); o.low = G.DL.opts.map((x) => x.l); S.lv = 30;
      S.mats.bpfrag = 3; RS.rsUse('bpfrag'); o.short = S.mats.bpfrag;
      S.rbk = { rb_c_gfeast: 1 }; S.mats.rb_a_regenp = 1; S.mats.bpfrag = 4; RS.rsUse('bpfrag');
      o.made = S.mats.rb_m_vwolf || 0; o.pages = S.mats.bpfrag;
      S.rbk = { rb_c_gfeast: 1, rb_a_regenp: 1, rb_m_vwolf: 1 }; const n0 = o.rare.reduce((a, k) => a + (S.mats[k] || 0), 0); S.mats.bpfrag = 4; RS.rsUse('bpfrag');
      o.any = o.rare.reduce((a, k) => a + (S.mats[k] || 0), 0) - n0;
      const bq = X.bossQ(), pq = X.plainQ(); S.mats.bpfrag = 0; X.bpQuest(bq); X.bpQuest(bq); X.bpQuest(pq); o.quest = [bq, pq, S.mats.bpfrag];
      // the smithing contract: each piece once, by its uid; turned in for gold, a page and smithing experience
      X.wcMenu(); G.DL.opts.find((x) => x.l.startsWith('Smithing:')).f();
      const N = X.wcN('smith'); X.wcEv('smith', 1, 9001); X.wcEv('smith', 1, 9001); o.once = X.wcS().c.smith;
      for (let i = 0; i < N; i++) X.wcEv('smith', 1, 9100 + i);
      o.capped = X.wcS().c.smith === N;
      X.board(); o.mark = G.DL.opts.some((x) => /^Weekly contracts ❗/.test(x.l));
      const g0 = S.gold, p0 = S.mats.bpfrag || 0, x0 = S.sxp, l0 = S.smith; X.wcTurn('smith');
      o.paid = [S.gold - g0 === X.wcGold('smith'), (S.mats.bpfrag || 0) - p0, S.sxp > x0 || S.smith > l0, !!X.wcS().done.smith];
      X.wcTurn('smith'); o.twice = S.gold - g0 === X.wcGold('smith');
      X.wcMenu(); o.list = G.DL.opts.map((x) => x.l.split(':')[0]);
      S.wc.wk = 'w1'; o.next = JSON.stringify(X.wcS().on);
      const I = window.SatArt.icons; o.icon = I.iconRGBA('bpfrag').join() !== I.iconRGBA('rusty').join(); o.kind = window.__GP5B.kind('bpfrag');
      return o;
    });
    assert.deepEqual(r.rare, ['rb_c_gfeast', 'rb_a_regenp', 'rb_m_vwolf'], 'the books no shop sells');
    assert.equal(r.chance, 0.05, 'alone, a boss gives a page one time in twenty');
    assert.deepEqual(r.day, [3, 3, 3], 'three pages a day from bosses');
    assert.deepEqual(r.low, ['Back'], 'no contracts under level 20');
    assert.equal(r.short, 3, 'three pages make nothing');
    assert.equal(r.made, 1, 'the one rare book you neither know nor carry'); assert.equal(r.pages, 0);
    assert.equal(r.any, 1, 'knowing them all, any of them');
    assert.ok(r.quest[0] && r.quest[1]); assert.equal(r.quest[2], 1, 'a boss quest gives one page, once; a plain one none');
    assert.equal(r.once, 1, 'the same piece counts once');
    assert.equal(r.capped, true);
    assert.equal(r.mark, true, 'the board marks a contract to turn in');
    assert.deepEqual(r.paid, [true, 1, true, true]);
    assert.equal(r.twice, true, 'paid once');
    assert.deepEqual(r.list, ['✓ Smithing', 'Cooking', 'Brewing', 'Tailoring', 'Farming', 'Back']);
    assert.equal(r.next, '{}', 'a new week, new contracts');
    assert.equal(r.icon, true, 'the page has its own icon');
    assert.equal(r.kind, 'book', 'the auction files pages with the books');
    await closeDialogs(g);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('goblin scouts walk their round of posts and stay near their camp', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GPB6, ms = X.mons().filter((m) => m.type === 'gobsc' && !m.dead && !m.tdum);
      const m = ms[0], pr = X.PATROL.gobsc; G.P.x = m.sx + 520; G.P.y = m.sy;
      m.x = m.sx; m.y = m.sy; m.eng = 0; m.agg = 0; m.wt = 0; m.pi = 0; m.blk = 0;
      const posts = [0, 1, 2, 3].map((i) => X.post(m, i)), seen = new Set(); let far = 0, moved = 0, px = m.x, py = m.y;
      for (let k = 0; k < 3000; k++) {
        X.monTick(m, 0.05); moved += Math.hypot(m.x - px, m.y - py); px = m.x; py = m.y;
        posts.forEach((p, i) => { if (Math.hypot(m.x - p[0], m.y - p[1]) < 14) seen.add(i); });
        far = Math.max(far, Math.hypot(m.x - m.sx, m.y - m.sy));
      }
      return { n: ms.length, seen: seen.size, far: Math.round(far), pr, moved: Math.round(moved), eng: m.eng > 0 };
    });
    assert.ok(r.n > 0, 'there are scouts');
    assert.equal(r.eng, false, 'it never saw the player');
    assert.ok(r.seen >= 3, 'it walked to its posts: ' + JSON.stringify(r));
    assert.ok(r.far <= r.pr + 20, 'within its round: ' + JSON.stringify(r));
    assert.ok(r.moved > 4 * r.pr, 'it keeps walking: ' + JSON.stringify(r));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
