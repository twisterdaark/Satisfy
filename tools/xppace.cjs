'use strict';
// XP pace measurement (owner 2026-10-25, encyclopedia §96): for a character at levels 150, 250, 300, 400, 450, 479, 480 and 500 with
// gear and stats of its level, what one kill of the best normal monster for it gives (the real kill, every multiplier the
// game applies), how long a kill takes (its real hits on that monster, the attack interval, plus the time between kills),
// XP per hour solo and in a party of four (a kill near a party mate shares PXP.SHARE of its XP), the hours to the next
// level; what the level's bosses give, the first time and again; the quests of those levels.
// Run: node tools/xppace.cjs [index.html] [--json out.json]   (SATISFY_HTML works too). A model, stated in the output:
// between kills OVERHEAD seconds (walking to the next one, pulling it), no skills (they only make a kill shorter), and the
// party kills four times as fast but each of the four lands a quarter of the kills.
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), jsonAt = args.indexOf('--json'), out = jsonAt >= 0 ? args[jsonAt + 1] : null;
const html = args.find((a, i) => !a.startsWith('--') && (jsonAt < 0 || i !== jsonAt + 1)) || process.env.SATISFY_HTML || path.join(__dirname, '..', 'index.html');
process.env.SATISFY_HTML = path.resolve(html);
const H = require('../tests/harness/game.cjs');
const LEVELS = [150, 250, 300, 400, 450, 479, 480, 490, 500, 510], OVERHEAD = 4, PARTY = 4;
// the gear a character of the level would wear: the strongest piece for each slot it may wear (by the item tables' text)
const src = fs.readFileSync(process.env.SATISFY_HTML, 'utf8');
const RC = [...src.matchAll(/\{id:'(\w+)',slot:'([waxhgbknr])'([^}]*)\}/g)].map(([, id, slot, rest]) => {
  const n = (k) => { const m = new RegExp('[,{]' + k + ':([0-9.]+)').exec(',' + rest); return m ? +m[1] : 0; };
  return { id, slot, atk: n('atk'), def: n('def'), dm: n('dm'), hpp: n('hpp'), lvr: n('lvr') };
});
const BOSSES = ['vb6', 'vb3', 'berith', 'vmrose', 'belial', 'hydra', 'vfenrir', 'sanju4'];

(async () => {
  const g = await H.openGame();
  const res = { html: path.relative(process.cwd(), process.env.SATISFY_HTML), model: { overheadS: OVERHEAD, party: PARTY, skills: 'none' }, levels: [], bosses: [], quests: [] };
  try {
    await H.newGame(g, { n: 'Pace', hair: 1, hc: 2, skin: 1, top: 3 });
    for (const L of LEVELS) {
      const r = await g.eval(([L, RC]) => {
        const G = window.__G, S = G.S, U = window.__GU, MT = G.isk.MT;
        S.lv = L; S.xp = 0; S.rx = 0; const p = L * 10; S.st = { str: 10 + Math.round(p * .6), sta: 10 + Math.round(p * .25), agi: 10 + Math.round(p * .15), int: 10, dex: 10 }; S.pts = 0;
        // gear: the best sword, hammer or spear and the best armour of the level
        S.items = []; S.eq = {}; S.eqW = null; S.eqA = null;
        const ok = (x) => !x.lvr || x.lvr <= L, best = (slot, key) => RC.filter((x) => x.slot === slot && ok(x) && x[key] > 0).sort((a, b) => b[key] - a[key])[0];
        const melee = RC.filter((x) => x.slot === 'w' && ok(x) && x.atk > 0 && !/st$|staff|bow|dag|fang|bst$/.test(x.id) && !['oakst', 'frstaff', 'stormst', 'abyssst', 'mstaff', 'mgstaff', 'hunbow', 'wyvbow', 'moonbow', 'mbow', 'mgbow', 'sqfbow', 'vipdag', 'shdag', 'bldag', 'mdagger', 'mgdagger', 'dagger', 'bow', 'sbow', 'staff', 'sstaff'].includes(x.id)).sort((a, b) => b.atk - a.atk)[0];
        const gear = [melee, best('a', 'def'), best('h', 'def'), best('g', 'def'), best('b', 'def'), best('k', 'dm'), best('n', 'dm'), best('r', 'dm')].filter(Boolean);
        for (const x of gear) { const it = G.isk.mkItem(x.id, 3); S.items.push(it); G.isk.equip(it); }
        G.P.hp = G.maxHP(); G.P.inv = 1e9;
        // the best normal monster for the level: most XP an hour (its real kill XP and the time its hits take)
        // normal monsters only: not a boss, not an elite (the game's rule, worked out here too so that a build without the caps
        // is measured on the same monsters: five times the median XP of the others within 15 levels), not a critter that
        // never fights (aggro 0, a few health: the rare lucky ones)
        const kindOf = (k) => { const b = MT[k], L0 = b.lv[0], pe = Object.keys(MT).filter((o) => o !== k && !MT[o].boss && MT[o].xp > 0 && Math.abs(MT[o].lv[0] - L0) <= 15).map((o) => MT[o].xp).sort((a, c) => a - c), med = pe.length >= 3 ? pe[pe.length >> 1] : 0; const nL = (L) => Math.round((50 + L * 30 + L * L * 3.5 + L ** 3 * .025) * (1 + Math.max(0, L - 100) * .02) * (1 + .15 * Math.floor(Math.max(0, L - 1) / 100))); return med ? (b.xp >= 5 * med ? 'elite' : 'mob') : (L0 >= 200 && b.xp * 1.2 >= .03 * nL(L0) ? 'elite' : 'mob'); };
        const cand = Object.keys(MT).filter((k) => { const b = MT[k]; return !b.boss && b.xp > 0 && b.hp >= 100 && b.aggro > 0 && b.lv[1] >= L - 40 && b.lv[0] <= L + 10 && kindOf(k) === 'mob'; });
        let top = null;
        for (const k of cand) {
          const b = MT[k], ml = Math.min(b.lv[1], Math.max(b.lv[0], L)), hp = Math.round(b.hp * (1 + (ml - b.lv[0]) * .03));
          // its real kill: XP as the game gives it
          const m = G.spawnMon(k, G.P.x + 30, G.P.y); m.tmp = 0; m.lv = ml; m.hp = 1; m.max = hp; const x0 = S.xp, l0 = S.lv; U.killMon(m); const xp = S.xp - x0; S.lv = l0; S.xp = 0; m.dead = true; m.rt = 1e9;
          // its real hits: the average of 200 (crits, guards and all)
          const d = G.spawnMon(k, G.P.x + 30, G.P.y); d.tmp = 1; d.lv = ml; d.hp = 1e15; d.max = 1e15; d.noLoot = 1; let sum = 0; for (let i = 0; i < 200; i++) { const h0 = d.hp; U.hitMon(d, 1, {}); sum += h0 - d.hp; } d.dead = true; d.rt = 1e9;
          const hit = sum / 200, cd = G.eqx.atkCD(), ttk = Math.max(cd, Math.ceil(hp / hit) * cd), xph = 3600 / (ttk + 4) * xp;
          const o = { k, lv: ml, hp, xp, hit: Math.round(hit), cd: +cd.toFixed(3), ttk: +ttk.toFixed(2) };
          if (!top || xph > top.xph) top = { ...o, xph };
        }
        const need = G.xpNeed();
        return { L, need, gear: gear.map((x) => x.id), top };
      }, [L, RC]);
      const t = r.top, perKill = t.ttk + OVERHEAD, solo = 3600 / perKill * t.xp;
      // a party of four: kills come four times as fast, each member lands a quarter and shares a quarter of the others'
      const pk = 3600 / (t.ttk / PARTY + OVERHEAD), share = await g.eval(() => window.__GPXP.C.SHARE), party = pk / PARTY * t.xp + pk * (PARTY - 1) / PARTY * t.xp * share;
      res.levels.push({ ...r, pct: +(t.xp / r.need * 100).toFixed(3), soloXPh: Math.round(solo), soloHours: +(r.need / solo).toFixed(2), partyXPh: Math.round(party), partyHours: +(r.need / party).toFixed(2) });
    }
    // bosses at level 400 and 480: the first clear and a repeat
    for (const L of [400, 480]) for (const k of BOSSES) {
      const r = await g.eval(([L, k]) => { const G = window.__G, S = G.S, U = window.__GU, MT = G.isk.MT; if (!MT[k]) return null; S.lv = L; S.xp = 0; S.kills = S.kills || {}; delete S.kills[k]; if (S.bfc) delete S.bfc[k]; if (S.bkt) delete S.bkt[k];
        const one = () => { const m = G.spawnMon(k, G.P.x + 30, G.P.y); m.tmp = 0; m.hp = 1; const x0 = S.xp, l0 = S.lv; U.killMon(m); const lv = S.lv; const x = S.xp - x0; S.lv = l0; S.xp = 0; m.dead = true; m.rt = 1e9; return lv > l0 ? 'lv+' + (lv - l0) : x; };
        const need = G.xpNeed(), first = one(); if (S.bkt) S.bkt[k] = 0; const again = one(); return { L, k, lv: MT[k].lv[0], need, first, again }; }, [L, k]);
      if (r) res.bosses.push({ ...r, firstPct: typeof r.first === 'number' ? +(r.first / r.need * 100).toFixed(2) : r.first, againPct: typeof r.again === 'number' ? +(r.again / r.need * 100).toFixed(2) : r.again });
    }
    // the quests of level 300 and more: what they give at their own level
    res.quests = await g.eval(() => { const G = window.__G, S = G.S, Q = G.QD, out = []; for (const id in Q) { const q = Q[id]; if (!(q.lv >= 300 && q.lv <= 999) || !q.xp) continue; S.lv = q.lv; const need = G.xpNeed(), raw = q.xp * 1.2, X = window.__GXP, cap = X ? X.capP(q.rep || q.gen ? 'rquest' : 'squest', q.lv) * need : 0, given = cap && raw > cap ? cap : raw; out.push({ id, lv: q.lv, rep: !!(q.rep || q.gen), xp: q.xp, pct: +(raw / need * 100).toFixed(2), given: Math.round(given), givenPct: +(given / need * 100).toFixed(2) }); } return out.sort((a, b) => a.lv - b.lv); });
    if (g.errors.length) res.errors = g.errors.slice(0, 5);
  } finally { await g.close(); await H.closeBrowser(); }
  if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
  const f = (n) => Math.round(n).toLocaleString('en');
  console.log(`XP pace for ${res.html} (model: ${OVERHEAD} s between kills, no skills, party of ${PARTY})`);
  console.log('| Level | XP needed | monster (Lv) | XP a kill | % of the level | kill (s) | solo XP/h | solo h/level | party XP/h | party h/level |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of res.levels) console.log(`| ${r.L} | ${f(r.need)} | ${r.top.k} (${r.top.lv}) | ${f(r.top.xp)} | ${r.pct}% | ${r.top.ttk} | ${f(r.soloXPh)} | ${r.soloHours} | ${f(r.partyXPh)} | ${r.partyHours} |`);
  console.log('\n| Player Lv | Boss (Lv) | first clear | % | again | % |\n|---|---|---|---|---|---|');
  for (const b of res.bosses) console.log(`| ${b.L} | ${b.k} (${b.lv}) | ${typeof b.first === 'number' ? f(b.first) : b.first} | ${b.firstPct}% | ${typeof b.again === 'number' ? f(b.again) : b.again} | ${b.againPct}% |`);
  console.log('\n| Quest | Lv | repeatable | XP (table) | % of its level | given | % given |\n|---|---|---|---|---|---|---|');
  for (const q of res.quests) console.log(`| ${q.id} | ${q.lv} | ${q.rep ? 'yes' : ''} | ${f(q.xp)} | ${q.pct}% | ${f(q.given)} | ${q.givenPct}% |`);
  if (res.errors) console.log('page errors:', res.errors);
})();
