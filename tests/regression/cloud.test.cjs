'use strict';
// SAT-ONLINE-007 (doc §06 R1, §23, D4): a character moves between two "devices" (tabs with separate
// saves) of the same Google account through the fake Firebase. The buttons need a confirming second click;
// since 2026-10-20 (owner) the save also goes up by itself while signed in, and a new device starts from it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const UID = 'gSameGoogleAccount1';
async function until(g, fn, ms = 5000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
async function signIn(g, name) {
  await g.eval(([n, uid]) => { window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = uid; document.getElementById('onlineBtn').click(); }, [name, UID]);
  await until(g, () => !document.getElementById('cloudBtn').hidden);
}
const click = (g, sel) => g.eval((s) => document.querySelector(s).click(), sel);
const rows = (g) => g.eval(() => [...document.querySelectorAll('#cloudL .cr')].map((r) => ({ pid: r.dataset.pid, text: r.querySelector('span').textContent })));

// owner 2026-10-21: no manual Upload/Download (fewer chances of duplicated data): the window lists the account's
// characters with Delete only, and a character moves only by the automatic sync (the next test)
test('the cloud window: the save went up by itself, no manual upload or download, Delete only', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    // device A: a character with some progress, back on the title screen
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await signIn(a, 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await a.eval(() => { window.__G.gainXP(900); window.__G.S.gold = 4321; });
    await a.step(5);
    await a.eval(() => window.__G.act('quit'));
    await a.waitMode('title');
    const mine = await a.eval(() => JSON.parse(localStorage.getItem('satisfy_proto_v4@a')).S);
    assert.match(mine.pid, /^p_/);
    // the public profile was written while playing
    await until(a, (u) => !!window.__fakeRTDB.data.get('profiles/' + u), 5000, UID);
    const prof = await a.eval((u) => window.__fakeRTDB.data.get('profiles/' + u), UID);
    assert.equal(prof.handle, 'Grid');
    assert.equal(typeof prof.revision, 'number');

    await until(a, ([u, p]) => window.__fakeRTDB.data.has('cloudSaves/' + u + '/' + p), 5000, [UID, mine.pid]);
    await click(a, '#cloudBtn');
    await until(a, () => !document.getElementById('cloudW').hidden && !/Loading/.test(document.getElementById('cloudL').textContent));
    assert.match(await a.eval(() => document.getElementById('cloudN').textContent), /On this device: Grid · Lv \d+/);
    assert.equal(await a.eval(() => document.querySelectorAll('#cloudN button').length), 0, 'no Upload');
    await until(a, () => document.getElementById('cloudL').querySelectorAll('.cr').length === 1);
    assert.deepEqual((await rows(a)).map((r) => r.pid), [mine.pid]);
    assert.match((await rows(a))[0].text, /Grid · Lv \d+ .*\(same character\)/);
    assert.deepEqual(await a.eval(() => [...document.querySelectorAll('#cloudL .cr button')].map((b) => b.textContent)), ['Delete'], 'no Download');
    assert.deepEqual(await a.eval(() => [...document.querySelectorAll('#cloudA button')].map((b) => b.textContent)), ['Sign out', 'Delete my account']);
    // T36: another account's cloud saves can't be read (the fake applies the owner-only rule)
    const other = await a.eval(async () => {
      const sdk = await window.__SATISFY_FIREBASE_LOADER__();
      try { await sdk.database.get({ path: 'cloudSaves/gSomeoneElse' }); return 'read'; } catch (e) { return e.code; }
    });
    assert.equal(other, 'PERMISSION_DENIED');
    // owner 2026-10-24: deleting the character that is also on this device deletes it here too (the sync put it back)
    await click(a, '#cloudL .cr button'); await click(a, '#cloudL .cr button');
    await until(a, ([u, p]) => !window.__fakeRTDB.data.has('cloudSaves/' + u + '/' + p) && /No characters/.test(document.getElementById('cloudL').textContent), 5000, [UID, mine.pid]);
    assert.equal(await a.eval(() => localStorage.getItem('satisfy_proto_v4@a')), null);
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(a.errors, []);
  } finally { await ctx.close(); }
});

// owner 2026-10-20: "on the phone there was no cloud save and no account". The character now follows the Google
// account: it goes up while playing, and a device without it starts from it when you press Play online.
test('the save goes up by itself and a new device starts from it', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await signIn(a, 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await a.eval(() => { window.__G.gainXP(5000); window.__G.S.gold = 777; window.__G.save(true); });
    const pid = await a.eval(() => window.__G.S.pid), lv = await a.eval(() => window.__G.S.lv);
    await until(a, ([u, p]) => window.__fakeRTDB.data.has('cloudSaves/' + u + '/' + p), 5000, [UID, pid]);
    // the phone: same account, nothing saved on it yet, the account ID already taken on the computer
    const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
    await b.eval((u) => window.__fakeRTDB.data.set('accountIds/' + u, 'Ahmed'), UID);
    assert.equal(await b.eval(() => localStorage.getItem('satisfy_proto_v4@b')), null);
    await signIn(b, 'Ahmed');
    await b.waitMode('play');
    const got = await b.eval(() => ({ pid: window.__G.S.pid, n: window.__G.S.look.n, lv: window.__G.S.lv }));
    assert.deepEqual(got, { pid, n: 'Grid', lv });
    // the copy on the phone is not replaced again by an older one: the phone plays on and its save goes up
    await b.eval(() => { window.__G.S.gold = 999; window.__G.save(true); });
    await until(b, ([u, p]) => JSON.parse(window.__fakeRTDB.data.get('cloudSaves/' + u + '/' + p).blob).S.gold === 999, 40000, [UID, pid]);
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

test('offline and ?net=local show no cloud button and never touch the network', async () => {
  for (const q of ['', '?net=local']) {
    const g = await H.openGame({ query: q });
    try {
      assert.equal(await g.eval(() => document.getElementById('cloudBtn').hidden), true, q || 'offline');
      assert.equal(await g.eval(() => !!window.__fakeRTDB), false);
    } finally { await g.close(); }
  }
});
