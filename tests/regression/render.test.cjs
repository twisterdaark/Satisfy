'use strict';
// Render parity: after the same frames, the branch draws exactly the same pixels as the baseline.
// Compares the game canvases (world + minimap), which are driven only by the frame clock.
// DOM overlays (HUD text, toasts, CSS animations) run on real time, so they are not hashed.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const baseline = H.baselineHtml();
const skip = baseline ? false : `baseline ${H.BASELINE_SHA.slice(0, 7)} not available in this clone`;

async function frameHash(html, setup) {
  const g = await H.openGame({ html });
  try {
    await g.page.setViewportSize({ width: 960, height: 540 });
    await setup(g);
    const urls = await g.eval(() => ['game', 'mini'].map((id) => document.getElementById(id).toDataURL()));
    return { hash: crypto.createHash('sha1').update(urls.join('|')).digest('hex'), errors: g.errors };
  } finally { await g.close(); }
}

const scenes = {
  title: async (g) => { await g.step(30); },
  'Winston after new game': async (g) => { await H.newGame(g); await g.step(90); },
};

for (const [name, setup] of Object.entries(scenes)) {
  test(`render parity: ${name}`, { skip }, async () => {
    const want = await frameHash(baseline, setup);
    const got = await frameHash(H.CURRENT_HTML, setup);
    assert.deepEqual(got.errors, []);
    assert.equal(got.hash, want.hash);
  });
}
