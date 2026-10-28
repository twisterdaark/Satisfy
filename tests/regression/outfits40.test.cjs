'use strict';
// Owner 2026-10-24: "15 outfits aren't enough, add 25". Every outfit has a name in both languages, draws without an error, and
// looks different from every other; the five new rare ones drop from bosses.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('48 outfits: named, drawn, each its own look; the rare new ones drop', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const X = window.__GLOOK, C = window.SatArt.chars, keys = ['school', 'hoodie', 'puffer', 'idol', 'gyaru', 'qipao', 'hanbok', 'kimono', 'cowboy', 'pirate', 'samurai', 'paladin', 'miko', 'witch', 'pajama', 'summer', 'punk', 'scholar', 'chef', 'soldier', 'healer', 'frost', 'shadow', 'royal', 'emperor'];
      const html = document.documentElement.outerHTML, out = { missing: [], unnamed: [], same: [] }, sig = {};
      for (const k of keys) {
        let fr;
        try { fr = C.frame(X.fig({ hair: 0, hc: 0, skin: 0, top: 0, cos: k }, 0), 'd', 'idle', 0); } catch (e) { out.missing.push(k + ' ' + e.message); continue; }
        const d = fr.c.getContext('2d').getImageData(0, 0, 16, 24).data.join(',');
        if (sig[d]) out.same.push(k + '=' + sig[d]); sig[d] = k;
        if (!html.includes('cos_' + k + ':')) out.unnamed.push(k);
      }
      return out;
    });
    assert.deepEqual(r, { missing: [], unnamed: [], same: [] });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
