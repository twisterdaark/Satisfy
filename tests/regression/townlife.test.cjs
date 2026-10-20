'use strict';
// Town life (owner 2026-10-20): horse races at Winston every three minutes, dice at the inn tables every twenty seconds,
// and the town festival. All of it runs on the world clock, so every screen online shares the same race, riders and
// rolls; your race and your bet ride along in the presence fx field as one "tl:" string.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const RCG = 134000, RCGO = 140000, RCEND = 176000, RCBACK = 178000;
// move this page's clock so that the race slot is at `ms` (the next slot when the current one is already past it)
const raceClock = (g, ms) => g.eval((ms) => {
  if (!window.__realNow) window.__realNow = Date.now.bind(Date);
  if (window.__raceSlot == null) window.__raceSlot = Math.floor(window.__realNow() / 180000) + 1;
  window.__off = window.__raceSlot * 180000 + ms - window.__realNow(); Date.now = () => window.__realNow() + window.__off;
}, ms);
const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
const bar = async (g) => { await g.step(8); return g.eval(() => { const b = document.getElementById('tlbar'); return b.hidden ? '' : b.textContent; }); };
async function signUp(g) {
  await g.eval(() => { const G = window.__G, n = G.npcs.find((n) => n.id === 'rcS'); G.P.x = n.x; G.P.y = n.y + 16; });
  await g.step(3);
  await g.eval(() => window.__G.talkNPC('rcS'));
  await g.step(2);
  await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && !(G.DL && G.DL.optOn); i++) G.advance(); });
  const opts = await g.eval(() => window.__G.DL.opts.map((o) => o.l));
  assert.equal(opts[0], 'Sign up for the race (free)');
  await g.eval(() => window.__G.pickOpt(0));
  await g.step(2);
}
// ride lane 0 from where you are to past the second lap, `secs` seconds of race clock in all
async function ride(g, secs) {
  const p0 = await g.eval(() => window.__GTL.RCR.p), end = 4 * Math.PI + 0.25, n = Math.ceil((end - p0) / 0.12);
  for (let i = 1; i <= n; i++) {
    await g.eval(([p, ms]) => { const L = window.__GTL, q = L.rcPos(p, 0); window.__G.P.x = q.x; window.__G.P.y = q.y; window.__off += ms; }, [p0 + (end - p0) * i / n, secs * 1000 / n]);
    await g.step(1);
  }
}

test('horse race: sign up with the steward, the gate takes you to the track on a race horse, Space spurs it, two laps, the prize, and back to Winston', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { window.__G.S.lv = 20; });
    await raceClock(g, RCG - 20000);
    await signUp(g);
    assert.equal(await g.eval(() => window.__GTL.RCR.in), false);
    assert.match(await bar(g), /Horse race: the gate opens in 0:2\d/);
    assert.match(await toasts(g), /Signed up! The gate opens in/);
    // the gate: down to the track, on the race horse, held at the line until GO
    await raceClock(g, RCG + 200);
    await g.step(3);
    await g.page.waitForTimeout(500);
    await g.step(3);
    const at = await g.eval(() => { const G = window.__G, L = window.__GTL; return { in: L.inRace(G.P.x, G.P.y), ride: G.P.ride, zone: G.zoneAt(G.P.x, G.P.y), pub: L.tlPub(), x: G.P.x }; });
    assert.deepEqual([at.in, at.ride, at.zone], [true, 1, 'zRace']);
    assert.match(at.pub, /^rc\d{1,3}\.0\.0$/);
    assert.match(await bar(g), /At the gate! The race starts in\s+\d/);
    await g.page.keyboard.down('d'); await g.step(10); await g.page.keyboard.up('d');
    assert.equal(await g.eval(() => window.__G.P.x), at.x, 'held at the gate');
    // GO: the horse runs, and Space spurs it for breath
    await raceClock(g, RCGO + 100);
    await g.step(2);
    assert.match(await bar(g), /GO!/);
    await g.page.keyboard.down('d'); await g.step(12); await g.page.keyboard.up('d');
    assert.ok(await g.eval(() => window.__G.P.x) > at.x + 20, 'the race horse runs');
    await g.page.keyboard.press('Space'); await g.step(1);
    assert.ok(await g.eval(() => window.__GTL.RCR.st) < 70, 'a spur costs breath');
    await g.step(90);
    assert.match(await bar(g), /Lap 1\/2 · Place \d of 4 · [\d.]+ s/);
    // two laps in about 20 seconds beat every stable rider (the best of them needs 24 at the very least)
    await ride(g, 17);
    const fin = await g.eval(() => window.__GTL.RCR.fin);
    assert.ok(fin > 17 && fin < 23, 'finish time ' + fin);
    assert.match(await bar(g), /Finished! Place 1 of 4/);
    const gold0 = await g.eval(() => window.__G.S.gold);
    await raceClock(g, RCEND + 200);
    await g.step(3);
    assert.equal(await g.eval(() => window.__G.S.gold) - gold0, 300 + 20 * 25);
    assert.deepEqual(await g.eval(() => ({ n: window.__G.S.rc.n, w: window.__G.S.rc.w })), { n: 1, w: 1 });
    assert.match(await toasts(g), /You won the race! First place in [\d.]+ s/);
    // back to Winston by the steward
    await raceClock(g, RCBACK + 200);
    await g.step(3);
    await g.page.waitForTimeout(500);
    await g.step(3);
    const home = await g.eval(() => { const G = window.__G, n = G.npcs.find((n) => n.id === 'rcS'); return { d: Math.hypot(G.P.x - n.x, G.P.y - n.y), ride: G.P.ride, R: window.__GTL.RCR, zone: G.zoneAt(G.P.x, G.P.y) }; });
    assert.ok(home.d < 30); assert.equal(home.ride, 0); assert.equal(home.R, null); assert.equal(home.zone, 'zWin');
    // someone left on the track (a reload) is taken back to Winston
    await g.step(100);
    await g.eval(() => { const q = window.__GTL.rcPos(1, 0); window.__G.P.x = q.x; window.__G.P.y = q.y; });
    await g.step(3); await g.page.waitForTimeout(500); await g.step(3);
    assert.equal(await g.eval(() => window.__G.zoneAt(window.__G.P.x, window.__G.P.y)), 'zWin');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the stable riders run the same on every screen, and two players online race each other and see who won', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await raceClock(a, RCG - 20000);
    await b.eval((s) => { window.__raceSlot = s; }, await a.eval(() => window.__raceSlot));
    await raceClock(b, RCG - 20000);
    for (const g of [a, b]) await signUp(g);
    for (const g of [a, b]) await raceClock(g, RCGO + 100);
    for (let i = 0; i < 6; i++) { for (const g of [a, b]) await g.step(3); await a.page.waitForTimeout(150); }
    // the riders: same seed, same places
    const ra = await a.eval(() => window.__GTL.rcRiders(window.__GTL.RCR.slot, 12).map((v) => Math.round(v.p * 1000)));
    const rb = await b.eval(() => window.__GTL.rcRiders(window.__GTL.RCR.slot, 12).map((v) => Math.round(v.p * 1000)));
    assert.deepEqual(ra, rb);
    // Faker rides two laps in 18 seconds; Grid sees Faker on the board, then first
    await ride(b, 18);
    for (let i = 0; i < 12; i++) { for (const g of [a, b]) await g.step(3); await a.page.waitForTimeout(120); }
    const brd = await a.eval(() => window.__GTL.rcBoard().map((e) => [e.n, e.fin > 0]));
    assert.equal(brd.length, 5, JSON.stringify(brd));
    assert.deepEqual(brd[0], ['Faker', true]);
    for (const g of [a, b]) await raceClock(g, RCEND + 200);
    for (let i = 0; i < 4; i++) { for (const g of [a, b]) await g.step(3); await a.page.waitForTimeout(150); }
    assert.match(await toasts(a), /The race ended before you finished both laps/);
    assert.match(await toasts(b), /You won the race!/);
    assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

test('dice at the inn table: bet before the roll, the house rules pay, and the rolls show over the table', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G; G.S.gold = 5000; G.S.lv = 20; G.enterRoom(G.ROOMS.find((r) => r.id === 'r13')); });
    await g.page.waitForTimeout(1200); await g.step(5);
    await g.eval(() => { const G = window.__G, p = G.PROPS.find((p) => p.room === 'r13' && p.k === 'table'); G.P.x = p.tx * 16 + p.w * 8; G.P.y = p.ty * 16 + 22; });
    await g.step(5);
    assert.equal(await g.eval(() => document.getElementById('hint').textContent), 'E: Dice table');
    await g.eval(() => { window.__realNow = Date.now.bind(Date); window.__off = 2000 - Date.now() % 20000; Date.now = () => window.__realNow() + window.__off; });
    await g.page.keyboard.press('KeyE');
    await g.step(2);
    assert.match(await g.eval(() => document.getElementById('dtext').textContent), /Two dice for you, two for the house/);
    assert.match(await g.eval(() => window.__G.DL.lines.join(' ')), /^dcHi The next roll is in 1[78] seconds/);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 5 && !(G.DL && G.DL.optOn); i++) G.advance(); });
    assert.deepEqual(await g.eval(() => window.__G.DL.opts.map((o) => o.l)), ['Bet 10 gold', 'Bet 100 gold', 'Leave'], 'up to 25 x level');
    await g.eval(() => window.__G.pickOpt(1));
    await g.step(2);
    const bet = await g.eval(() => ({ dcb: window.__G.S.dcb, gold: window.__G.S.gold, pub: window.__GTL.tlPub(), me: window.__G.S.pid || 'me' }));
    assert.equal(bet.gold, 4900); assert.equal(bet.pub, 'dc' + (bet.dcb.n % 1000) + '.100');
    assert.match(await bar(g), /Dice: 100 gold on this roll · rolling in 1\d/);
    // a second bet on the same roll is refused
    await g.eval(() => window.__GTL.dcBet(10)); await g.step(1);
    assert.equal(await g.eval(() => window.__G.S.gold), 4900);
    // the roll: the same numbers the seed gives, paid by the rules
    const want = await g.eval(([n, me]) => { const L = window.__GTL, [a, b] = L.dcRoll(n, me), [h1, h2] = L.dcRoll(n, 'house'), m = a + b, h = h1 + h2, box = m === 12 && h < 12, win = m !== 2 && (box || m > h); return { win, d: win ? (box ? 200 : 100) : -100, h: h1 + h2 }; }, [bet.dcb.n, bet.me]);
    await g.eval(() => { window.__off += 18500; }); await g.step(3);
    assert.equal(await g.eval(() => window.__G.S.gold), 5000 + want.d);
    assert.equal(await g.eval(() => window.__G.S.dcb), null);
    assert.match(await toasts(g), want.win ? /you win \d+ gold/ : /you lose 100 gold/);
    const show = await g.eval(() => window.__GTL.DCSHOW && { h: window.__GTL.DCSHOW.house[0] + window.__GTL.DCSHOW.house[1], me: !!window.__GTL.DCSHOW.me });
    assert.deepEqual(show, { h: want.h, me: true });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the town festival: it begins with a toast, fireworks fill the town sky, and the steward says the prizes are doubled', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G, n = G.npcs.find((n) => n.id === 'rcS'); G.P.x = n.x; G.P.y = n.y + 16; window.__GTL.setFS(Date.now() + 60000); });
    await g.step(4);
    assert.match(await toasts(g), /The town festival has begun!/);
    assert.equal(await g.eval(() => window.__GTL.fsOn()), true);
    await g.step(150);
    await g.eval(() => window.__G.talkNPC('rcS'));
    await g.step(2);
    assert.match(await g.eval(() => window.__G.DL.lines.join(' ')), /race prizes are doubled/);
    await g.eval(() => window.__GTL.setFS(Date.now() - 1));
    await g.step(3);
    assert.match(await toasts(g), /The town festival is over/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
