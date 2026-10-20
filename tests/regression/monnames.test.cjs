'use strict';
// Owner 2026-10-20: a monster shows its name over its level, so every monster type needs a name in both languages.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

for (const lang of ['en', 'ar']) {
  test('every monster type has a ' + lang + ' name', async () => {
    const g = await H.openGame({ storage: { satisfy_lang: lang } });
    const bad = await g.eval((lang) => window.__G.monNames().filter(([k, n]) => !n || n === k || (lang === 'ar' && !/[؀-ۿ]/.test(n))), lang);
    assert.deepEqual(bad, []);
    await g.close();
  });
}
