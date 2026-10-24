'use strict';
// The open windows as classes on #ui (SAT-ONLINE-194; owner 2026-10-24: "the lag grew a lot, many frame drops"). CSS :has()
// rules on #ui restyled the whole HUD (300-400 elements) on every text change inside it, so every frame. They are classes now:
//   - no :has() is left in the page's CSS;
//   - for any mix of open windows the classes say what the :has() rules said (checked against ui.matches(':has(...)'));
//   - they follow at once when a window opens or closes, without a frame.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const HAS = {
  uhD: '#dialog:not([hidden])', uhSy: '#sysm:not([hidden])', uhSt: '#statusW:not([hidden])', uhI: '#inv:not([hidden])',
  uhE: '#equipW:not([hidden])', uhF: '#forge:not([hidden])', uhL: '#logW:not([hidden])', uhM: '#mbW:not([hidden])',
  uhP: '.panel:not([hidden])', uhP1: '.panel:not([hidden]):not(#partyW):not(#chatW)', uhP2: '.panel:not([hidden]):not(#inv):not(#equipW):not(#statusW)',
};

test('the open-window classes match what :has() said, for any mix of windows, at once', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const css = await g.eval(() => [...document.styleSheets].map((sh) => { try { return [...sh.cssRules].map((r) => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n'));
    assert.ok(css.length > 1000, 'the page has its CSS');
    assert.equal((css.match(/:has\(/g) || []).length, 0, 'no :has() in the CSS');
    // play: nothing open but the HUD's own windows
    const play = await g.eval((HAS) => { const ui = document.getElementById('ui'), o = {}; for (const c in HAS) o[c] = [ui.classList.contains(c), ui.matches(':has(' + HAS[c] + ')')]; return o; }, HAS);
    for (const c in play) assert.equal(play[c][0], play[c][1], 'in play: ' + c);
    let bad = [], seen = new Set();
    for (let round = 0; round < 40; round++) {
      // open and close a random mix (the classes follow before the next frame: no step here)
      await g.eval((round) => {
        let a = (round + 1) * 2654435761 >>> 0; const rnd = () => { a = (a ^ (a << 13)) >>> 0; a = (a ^ (a >>> 17)) >>> 0; a = (a ^ (a << 5)) >>> 0; return a / 4294967296; };
        const ui = document.getElementById('ui'), ids = ['dialog', 'sysm', 'statusW', 'inv', 'equipW', 'forge', 'logW', 'mbW', 'partyW', 'chatW'];
        window.__uh0 = window.__uh0 || [...ui.getElementsByClassName('panel')].concat(ids.map((i) => document.getElementById(i))).filter(Boolean).map((e) => [e, e.hidden]);
        for (const [e] of window.__uh0) e.hidden = rnd() < 0.75;
      }, round);
      const r = await g.eval((HAS) => { const ui = document.getElementById('ui'), o = { body: [document.body.classList.contains('uhD'), document.body.matches(':has(#dialog:not([hidden]))')] }; for (const c in HAS) o[c] = [ui.classList.contains(c), ui.matches(':has(' + HAS[c] + ')')]; return o; }, HAS);
      for (const c in r) { if (r[c][0] !== r[c][1]) bad.push(round + ' ' + c + ' ' + JSON.stringify(r[c])); if (r[c][1]) seen.add(c); }
    }
    assert.deepEqual(bad, []);
    assert.deepEqual([...seen].sort(), ['body', ...Object.keys(HAS)].sort(), 'every state came up at least once');
    await g.eval(() => { for (const [e, h] of window.__uh0) e.hidden = h; });
    await g.step(2);
    // a real window: the bag hides the keys' hints and the chat, and they come back when it closes
    const vis = () => g.eval(() => ({ keys: getComputedStyle(document.getElementById('keys')).opacity, chat: getComputedStyle(document.getElementById('chatW')).opacity }));
    await g.page.waitForTimeout(350); const before = await vis();
    await g.page.keyboard.press('i'); await g.step(3); await g.page.waitForTimeout(350); // the fade is a real 0.2 s transition
    assert.equal(await g.eval(() => !document.getElementById('inv').hidden), true, 'the bag opened');
    const open = await vis();
    assert.equal(open.keys, '0', 'the keys hide under the bag');
    await g.page.keyboard.press('Escape'); await g.step(3); await g.page.waitForTimeout(350);
    assert.deepEqual(await vis(), before);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
