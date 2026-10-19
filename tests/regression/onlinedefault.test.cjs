'use strict';
// SAT-ONLINE-034 (owner feedback #3): with Satisfy.netOnlineOnly = true (src/net/firebase-config.js; on by default on the
// GitHub Pages host, a7439b3) the plain address is the online game; ?net=off still opens it offline. The harness runs from
// file://, so this is the only test that sees the public site's default path.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('online at the plain address when the switch is on; ?net=off plays offline', async () => {
  const flag = path.join(os.tmpdir(), 'satisfy-online-only.js');
  fs.writeFileSync(flag, 'window.Satisfy = window.Satisfy || {}; window.Satisfy.netOnlineOnly = true;');
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, flag] });
  try {
    const shown = (g) => g.eval(() => ['onlineBtn', 'newBtn', 'contBtn'].map((id) => !document.getElementById(id).hidden));
    const g = await H.openGame({ ctx, query: '' });
    assert.deepEqual(await shown(g), [true, false, false], 'Play online only');
    const off = await H.openGame({ ctx, query: '?net=off' });
    assert.deepEqual(await shown(off), [false, true, true], 'offline for testing');
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); fs.unlinkSync(flag); }
  // without the flag nothing changes: every other regression test opens the plain address offline, and the unit test
  // firebase-load checks the default is false
});
