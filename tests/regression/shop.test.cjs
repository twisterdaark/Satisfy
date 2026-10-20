'use strict';
// Shops (owner 2026-10-20): merchants sell through the sell window only, and nothing sells back for more than it costs:
// shop goods about 30% of their price, shop gear at most 30% of its price. Shift with a buy option buys 10, Ctrl as
// many as fit and you can pay for, and buy dialogs say so.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('shop gear lists are never cheaper than SHOPG (the table the sell price is capped by)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
  const shopg = Object.fromEntries([...src.match(/const SHOPG=\{([^}]*)\}/)[1].matchAll(/(\w+):(\d+)/g)].map((m) => [m[1], +m[2]]));
  const lists = [...src.matchAll(/smithMenu\('\w+',(\[\[[^;]*?\]\]),(\[\[[^;]*?\]\])/g)];
  assert.ok(lists.length >= 5);
  for (const m of lists) for (const [, id, g] of (m[1] + m[2]).matchAll(/\['(\w+)',(\d+)\]/g)) {
    assert.ok(shopg[id], 'SHOPG has ' + id);
    assert.ok(shopg[id] <= +g, id + ' ' + shopg[id] + ' <= ' + g);
  }
});

test('nothing sells for more than it costs; Shift buys 10 potions; the merchant has no sell lines', async () => {
  const g = await H.openGame();
  await H.newGame(g);
  const r = await g.eval(() => {
    const B = window.__G.bag(), bad = [];
    for (const k in B.POT) if (B.unitVal({ k }) >= B.POT[k].price * 0.35) bad.push(k + ' ' + B.unitVal({ k }));
    for (const k in B.SHOPM) if (B.unitVal({ k }) >= B.SHOPM[k] * 0.45) bad.push(k + ' ' + B.unitVal({ k }));
    for (const id in B.SHOPG) {
      const v = B.itemVal({ id, r: 0, en: 0, dur: 100 });
      if (v > Math.round(B.SHOPG[id] * 0.3)) bad.push(id + ' ' + v + '/' + B.SHOPG[id]);
      if (B.itemVal({ id, r: 0, en: 0, dur: 100, bp: B.SHOPG[id] - 1 }) >= B.SHOPG[id]) bad.push(id + ' bp');
    }
    return bad;
  });
  assert.deepEqual(r, []);
  // the merchant's dialog: buy lines, one "sell things" line, the quantity note
  await g.eval(() => { const S = window.__G.S; S.gold = 1000; S.hpot = 0; S.mats.ore = 7; window.__G.talkNPC('merchant'); });
  for (let i = 0; i < 6 && (await g.eval(() => !document.querySelector('#dopts:not([hidden]) button'))); i++) { await g.page.keyboard.press('Space'); await g.step(2); }
  const d = await g.eval(() => ({ opts: [...document.querySelectorAll('#dopts button')].map((b) => b.textContent), note: (document.querySelector('#dopts .qnote') || {}).textContent }));
  assert.ok(d.note && /Shift/.test(d.note), 'quantity note shown');
  assert.ok(!d.opts.some((l) => /Sell (arrows|\d)/.test(l)), 'no sell lines: ' + d.opts.join(' | '));
  assert.ok(d.opts.some((l) => /sell/i.test(l)), 'the sell-window line stays');
  const hp = await g.eval(() => [...document.querySelectorAll('#dopts button')].findIndex((b) => /potion/i.test(b.textContent) && /HP|heal/i.test(b.textContent + b.dataset.tip)));
  assert.ok(hp >= 0, 'an HP potion line: ' + d.opts.join(' | '));
  const box = await g.page.locator('#dopts button').nth(hp).boundingBox();
  await g.page.keyboard.down('Shift');
  await g.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await g.page.keyboard.up('Shift');
  await g.step(2);
  const after = await g.eval(() => ({ hpot: window.__G.S.hpot, gold: window.__G.S.gold }));
  assert.equal(after.hpot, 10);
  assert.ok(after.gold < 1000 - 9 * 20, 'paid for ten: ' + after.gold);
  assert.deepEqual(g.errors, []);
  await g.close();
});
