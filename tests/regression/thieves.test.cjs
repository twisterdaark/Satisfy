'use strict';
// Thieves and assassins (major 8, novel ch 54/76/120/121): the hooded man's Thief trial (steal from monsters), Stealth that
// monsters lose you in and that the first blow ends at double, Evasion; the Assassin trial counts only kills after a blow
// from stealth; Assassinate from behind; Shadow Step; stealth shows faint to other players and no player damage changes.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the Thief: trial by stealing, Stealth loses the monsters and doubles the first blow, Evasion', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.lv = 14; const at14 = C.avail('ct'); G.S.lv = 15; return [at14, C.avail('ct')]; });
    assert.deepEqual(a, [true, true], 'class quests show from their level in talk; the trainer checks it');
    await g.eval(() => window.__GC2.accept('ct'));
    // Steal: once per monster, gold, counts for the trial
    const s = await g.eval(() => { const G = window.__G, X = window.__GRG, P = G.P; P.dir = 2; const m = G.spawnMon('wolf', P.x + 14, P.y); m.max = m.hp = 1e7; const g0 = G.S.gold;
      X.sk('tsteal'); const one = G.S.gold - g0, c1 = G.S.qs.ct.c; X.sk('tsteal'); return { one, c1, c2: G.S.qs.ct.c, obj: window.__GC2.obj('ct') }; });
    assert.ok(s.one > 0); assert.equal(s.c1, 1); assert.equal(s.c2, 1, 'once per monster');
    assert.match(s.obj, /Steal from monsters/);
    const d = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.qs.ct.c = 5; C.complete('ct'); G.S.lv = 20; return { cls: G.S.cls, sk: C.cls(), pas: C.pas() }; });
    assert.equal(d.cls, 'thief');
    assert.ok(['tstealth', 'tsteal', 'tknife'].every((k) => d.sk.includes(k)) && d.pas.includes('tevade'), JSON.stringify(d));
    // Stealth: an engaged monster lets go; the first blow lands double and ends it; a blow taken ends it too
    const st = await g.eval(() => { const G = window.__G, X = window.__GRG, C = window.__GC2, P = G.P; G.S.lv = 30;
      const m = G.spawnMon('wolf', P.x + 40, P.y); m.max = m.hp = 1e9; m.lv = 30; m.eng = 4; X.sk('tstealth'); const let_go = m.eng === 0, hidden = P.stl > 0, tag = C.st();
      let plain = 0, amb = 0; for (let i = 0; i < 6; i++) { const h = m.hp; C.hit(m); plain += h - m.hp; }
      for (let i = 0; i < 6; i++) { P.stl = 5; const h = m.hp; C.hit(m); amb += h - m.hp; }
      const ended = !(P.stl > 0); P.stl = 5; P.inv = 0; P.dash = 0; C.hurt(10, { x: P.x + 5, y: P.y, type: 'wolf', spar: 1 }); return { let_go, hidden, tag, plain, amb, ended, afterHurt: P.stl > 0 }; });
    assert.ok(st.let_go && st.hidden, JSON.stringify(st));
    assert.match(st.tag, /s/, 'stealth rides in the presence fx');
    assert.ok(st.amb > st.plain * 1.5, JSON.stringify(st));
    assert.equal(st.ended, true); assert.equal(st.afterHurt, false);
    // Evasion: some monster blows miss entirely
    const e = await g.eval(() => { const G = window.__G, X = window.__GRG; let miss = 0; for (let i = 0; i < 400; i++) if (X.evade({ type: 'wolf', x: 0, y: 0 })) miss++; return miss; });
    assert.ok(e > 20 && e < 90, 'about 12%: ' + e);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Assassin: only kills after a stealth blow count; Assassinate from behind; Shadow Step lands behind', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.cls = 'thief'; G.S.lv = 30; G.S.mast = { dagger: 0 }; const locked = C.avail('c2a') && !C.mstOk({ mst: ['dagger', 3] });
      G.S.mast.dagger = 400; C.accept('c2a'); return { locked, talk: C.talk('hood') }; });
    assert.equal(a.locked, true);
    const k = await g.eval(() => { const G = window.__G, C = window.__GC2, P = G.P; const kill = (stl) => { const m = G.spawnMon('deserter', P.x + 14, P.y); m.lv = 30; m.max = m.hp = 1; P.dir = 2; if (stl) P.stl = 5; C.hit(m); return G.S.qs.c2a.c || 0; };
      return [kill(false), kill(true), C.obj('c2a')]; });
    assert.equal(k[0], 0, 'a plain kill is no assassination'); assert.equal(k[1], 1);
    assert.match(k[2], /after a blow from stealth/);
    const d = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.qs.c2a.c = 8; C.complete('c2a'); return { cls: G.S.cls, base: G.S.cbase, sk: C.cls(), pas: C.pas() }; });
    assert.equal(d.cls, 'assassin'); assert.equal(d.base, 'thief');
    assert.ok(d.sk.includes('aassn') && d.sk.includes('tstealth') && d.pas.includes('tevade'), JSON.stringify(d));
    // Assassinate hits harder from behind than from the front
    const b = await g.eval(() => { const G = window.__G, X = window.__GRG, P = G.P; G.S.lv = 40; let front = 0, back = 0;
      for (let i = 0; i < 6; i++) { const m = G.spawnMon('wolf', P.x + 14, P.y); m.lv = 40; m.max = m.hp = 1e9; P.dir = 2; m.face = -1; X.sk('aassn'); front += 1e9 - m.hp; m.dead = true;
        const n = G.spawnMon('wolf', P.x + 14, P.y); n.lv = 40; n.max = n.hp = 1e9; n.face = 1; X.sk('aassn'); back += 1e9 - n.hp; n.dead = true; }
      return { front, back }; });
    assert.ok(b.back > b.front * 1.5, JSON.stringify(b));
    // Shadow Step: behind the monster in front, hidden for a moment
    const s = await g.eval(() => { const G = window.__G, X = window.__GRG, P = G.P; P.dir = 2; const x0 = P.x; const m = G.spawnMon('wolf', P.x + 40, P.y); m.max = m.hp = 1e9; X.sk('ashadow'); return { past: P.x > m.x, hid: P.stl > 0, dx: P.x - x0 }; });
    assert.ok(s.past && s.hid, JSON.stringify(s));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
