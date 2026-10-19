'use strict';
// SAT-ONLINE-004 with a fake Firebase (tests/harness/fake-firebase.js): sign-in, presence over the
// Realtime Database transport, disconnect/reconnect, session restore. The real two-device check is
// done by the owner against project satisfy-online-8yjeix.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 };

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, arg, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
const net = (g) => g.eval(() => Satisfy.local.net());
const fake = (g) => g.eval(() => ({ rejected: window.__fakeRTDB.rejected, sdk: window.__fakeRTDB.sdkVersion, cfg: window.__fakeRTDB.config, url: window.__fakeRTDB.databaseURL, redirected: window.__fakeRTDB.redirected }));

async function signIn(g, name) {
  await g.eval((n) => { window.__fakeRTDB.nextName = n; document.getElementById('onlineBtn').click(); }, name);
  await until(g, () => !!Satisfy.local.net());
}

async function twoOnline() {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
  await signIn(a, 'Ahmed');
  await signIn(b, 'Bassem');
  await H.newGame(a, LOOK_A);
  await H.newGame(b, LOOK_B);
  await settle(a, b);
  return { ctx, a, b };
}

test('title shows "Play online" only with ?net=online; sign-in uses the pinned SDK and project config; the first time asks for a unique ID', async () => {
  const off = await H.openGame();
  try {
    assert.equal(await off.eval(() => document.getElementById('onlineBtn').hidden), true);
  } finally { await off.close(); }
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const g = await H.openGame({ ctx, query: '?net=online' });
    assert.equal(await g.eval(() => document.getElementById('onlineBtn').hidden), false);
    assert.equal(await g.eval(() => document.getElementById('onlineBtn').textContent), 'Play online');
    assert.equal(await g.eval(() => document.getElementById('newBtn').hidden && document.getElementById('contBtn').hidden), true, 'online only: no New game / Continue');
    await signIn(g, 'Ahmed');
    // SAT-ONLINE-026: no account ID yet, so the ID box opens; a taken ID is refused, a free one is kept and shown
    await until(g, () => !document.getElementById('idW').hidden);
    await g.eval(() => { window.__fakeRTDB.data.set('handles/taken', 'someone-else'); document.getElementById('idIn').value = 'Taken'; document.getElementById('idOk').click(); });
    await until(g, () => document.getElementById('idErr').textContent !== '');
    assert.equal(await g.eval(() => document.getElementById('idW').hidden), false);
    await g.eval(() => { document.getElementById('idIn').value = 'Ahmed_1'; document.getElementById('idOk').click(); });
    await until(g, () => document.getElementById('idW').hidden);
    assert.equal(await g.eval(() => document.getElementById('onlineBtn').textContent), 'Play online · Ahmed_1');
    const f = await fake(g);
    assert.equal(f.sdk, '12.19.0');
    assert.equal(f.cfg.projectId, 'satisfy-online-8yjeix');
    assert.equal(f.url, 'https://satisfy-online-8yjeix-default-rtdb.europe-west1.firebasedatabase.app');
    assert.deepEqual(ctx.__external.filter((u) => !/fonts\.(googleapis|gstatic)\.com/.test(u)), [], 'no real SDK download in tests');
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('two signed-in players see each other through the database; writes pass the rules', async () => {
  const { ctx, a, b } = await twoOnline();
  try {
    const na = await net(a), nb = await net(b);
    assert.equal(na.state, 'ONLINE');
    assert.equal(na.count, 1);
    assert.equal(nb.count, 1);
    assert.equal(na.remotes[0].handle, 'Faker');
    assert.equal(na.remotes[0].uid, nb.uid);
    assert.equal(nb.remotes[0].handle, 'Grid');
    assert.equal(na.drawn, 1);
    assert.equal(await a.eval(() => document.getElementById('netB').textContent), 'Online · players: 2 · Safe zone');
    // presence, the public profile (SAT-ONLINE-007), the session lease (SAT-ONLINE-010) and the account ID read (SAT-ONLINE-026)
    const paths = await a.eval(() => [...new Set(window.__fakeRTDB.log.map((l) => l.path))]);
    assert.deepEqual(paths.sort(), ['accountIds/' + na.uid, 'presence/satisfy/main/' + na.uid, 'profiles/' + na.uid, 'sessions/' + na.uid]);
    assert.deepEqual((await fake(a)).rejected, []);
    assert.deepEqual((await fake(b)).rejected, []);
    // link quality (doc U015/U020): acknowledged writes give a round trip, shown in the badge tooltip
    const link = (await net(a)).link;
    assert.ok(link.writes > 0 && link.fails === 0 && link.rtt >= 0, JSON.stringify(link));
    await a.step(70);
    assert.match(await a.eval(() => document.getElementById('netB').title), /^Link: \d+ ms · sent \d+ · received \d+ · dropped \d+$/);
    assert.deepEqual(a.errors, []);
  } finally { await ctx.close(); }
});

test('movement reaches the other device', async () => {
  const { ctx, a, b } = await twoOnline();
  try {
    const x0 = (await net(a)).remotes[0].x;
    await b.page.keyboard.down('KeyD');
    await settle(a, b);
    await b.page.keyboard.up('KeyD');
    await settle(a, b);
    const bx = await b.eval(() => Math.round(window.__G.P.x));
    const seen = (await net(a)).remotes[0];
    assert.ok(bx > x0 + 10);
    assert.equal(seen.x, bx);
    assert.equal(seen.dir, 2);
    // after the first full write, a step only sends what changed (SAT-ONLINE-011, COST_MODEL.md)
    const ups = await b.eval(() => window.__fakeRTDB.log.filter((l) => l.op === 'update' && l.path.startsWith('presence/')));
    assert.ok(ups.length > 0, 'moves go out as updates');
    for (const u of ups) for (const k of ['handle', 'look', 'cls', 'uid', 'sid', 'v']) assert.equal(u.keys.includes(k), false, k + ' is not resent');
    assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected), []);
  } finally { await ctx.close(); }
});

test('a dropped connection removes the player for others and comes back on reconnect', async () => {
  const { ctx, a, b } = await twoOnline();
  try {
    await b.eval(() => window.__fakeRTDB.setConnected(false));
    await settle(a, b);
    assert.equal((await net(a)).count, 0, 'server ran onDisconnect');
    assert.equal((await net(b)).state, 'RECONNECTING');
    assert.equal(await b.eval(() => document.getElementById('netB').textContent), 'Reconnecting… · Safe zone');
    await b.eval(() => window.__fakeRTDB.setConnected(true));
    await b.step(10); // reconnecting republishes at once (no waiting for the 5 s idle heartbeat)
    await settle(a, b);
    assert.equal((await net(a)).count, 1);
    assert.equal((await net(b)).count, 1);
    assert.equal((await net(b)).state, 'ONLINE');
  } finally { await ctx.close(); }
});

test('a saved Google session reconnects after reload without a popup', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const g = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await signIn(g, 'Ahmed');
    const uid = (await net(g)).uid;
    await until(g, () => !document.getElementById('idW').hidden);
    await g.eval(() => { document.getElementById('idIn').value = 'Ahmed'; document.getElementById('idOk').click(); });
    await until(g, () => document.getElementById('idW').hidden);
    const keep = await H.openGame({ ctx, query: '?net=online&slot=k' }); // holds the database while g reloads (the fake lives in pages)
    await g.reload();
    await until(g, () => !!Satisfy.local.net());
    assert.equal((await net(g)).uid, uid);
    // SAT-ONLINE-026 (owner feedback 15): the account ID comes back after a reload, not the Google name
    await until(g, () => document.getElementById('onlineBtn').textContent === 'Play online · Ahmed');
  } finally { await ctx.close(); }
});

test('blocked popup falls back to redirect sign-in', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const g = await H.openGame({ ctx, query: '?net=online' });
    await g.eval(() => { window.__fakeRTDB.popupBlocked = true; document.getElementById('onlineBtn').click(); });
    await g.page.waitForTimeout(200);
    assert.equal((await fake(g)).redirected, true);
    assert.equal(await g.eval(() => Satisfy.local.net()), null);
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('offline and ?net=local never load the Firebase SDK', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    for (const q of ['', '?net=local']) {
      const g = await H.openGame({ ctx, query: q });
      await H.newGame(g);
      await g.step(30);
      assert.equal((await fake(g)).sdk, undefined, `loader not called for "${q}"`);
      await g.close();
    }
  } finally { await ctx.close(); }
});
