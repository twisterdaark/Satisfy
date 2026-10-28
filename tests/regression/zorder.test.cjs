'use strict';
// Windows on top (v2.98; the owner 2026-10-25, a screenshot of the ID window under the title's buttons: "fix the screen hidden
// underneath, and anything like it"): the ID window above the title's menu, the cloud window and the update log; the
// windows that come on their own (a party, guild or trade invitation, a duel challenge, a raid roll, death, another device
// taking the account) above every window a player opens, but not the trade or the duel's bars (a window beside them, the
// toasts); death closes them all (the equipment window stayed open).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

// the share of points inside an element whose topmost element is that element
const onTop = (ids) => ids.map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); let n = 0, k = 0;
  for (let i = 1; i <= 5; i++) for (let j = 1; j <= 5; j++) { const x = r.left + r.width * i / 6, y = r.top + r.height * j / 6; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue; n++; const t = document.elementFromPoint(x, y); if (t && e.contains(t)) k++; }
  return n ? Math.round(k / n * 100) : -1; });

test('the ID window is above the title menu, the cloud window and the update log', async () => {
  for (const [w, h] of [[1280, 720], [800, 450]]) {
    const g = await H.openGame();
    try {
      await g.page.setViewportSize({ width: w, height: h }); await g.step(20);
      const r = await g.eval((src) => { const onTop = eval(src), $ = (id) => document.getElementById(id), o = {};
        $('idW').hidden = false; o.alone = onTop(['idW'])[0];
        $('cloudW').hidden = false; o.cloud = onTop(['idW'])[0]; $('cloudW').hidden = true;
        $('updLog').hidden = false; o.log = onTop(['idW'])[0]; $('updLog').hidden = true;
        $('idBlk').hidden = false; o.forced = onTop(['idW'])[0];
        return o; }, onTop.toString());
      assert.deepEqual(r, { alone: 100, cloud: 100, log: 100, forced: 100 }, `${w}x${h}`);
      assert.deepEqual(g.errors, []);
    } finally { await g.close(); }
  }
});

test('what comes on its own is above the windows you open; death closes them', async () => {
  const g = await H.openGame();
  try {
    await g.page.setViewportSize({ width: 1280, height: 720 });
    await H.newGame(g); await g.step(10);
    const r = await g.eval((src) => { const onTop = eval(src), $ = (id) => document.getElementById(id), o = {};
      for (const b of ['inv', 'equipW', 'statusW', 'mapW', 'ixW', 'guildW', 'auW', 'qdW', 'logW', 'forge']) { $(b).hidden = false;
        for (const p of ['partyInv', 'guildInv', 'tradeInv', 'duelInv', 'lootW', 'deathW', 'netRepW']) { $(p).hidden = false; const v = onTop([p])[0]; if (v < 100) o[b + '>' + p] = v; $(p).hidden = true; }
        $(b).hidden = true; }
      // a trade beside the windows you open: the bag and the Esc menu stay above it; a duel's bars stay below the toasts
      $('tradeW').hidden = false; $('inv').hidden = false; const ix = $('inv').querySelector('.x'); o.tradeBag = ix ? onTop([ix.id || (ix.id = 'invX_t')])[0] : 100; $('inv').hidden = true;
      $('pauseScreen').hidden = false; const rs = $('pauseScreen').querySelector('[data-act=resume]'); rs.id = rs.id || 'resume_t'; o.tradeResume = onTop([rs.id])[0]; $('pauseScreen').hidden = true; $('tradeW').hidden = true;
      $('duelW').hidden = false; const tt = document.createElement('div'); tt.className = 'toast'; tt.id = 'toast_t'; tt.textContent = 'Fight!'; $('toasts').appendChild(tt); o.duelToast = onTop(['toast_t'])[0]; tt.remove(); $('duelW').hidden = true;
      return o; }, onTop.toString());
    const { tradeBag, tradeResume, duelToast, ...cov } = r;
    assert.deepEqual(cov, {}, 'covered: ' + JSON.stringify(cov));
    assert.deepEqual([tradeBag, tradeResume, duelToast], [100, 100, 100], 'the bag and Resume over a trade, a toast over a duel');
    // death with the equipment window open: it closes
    await g.page.keyboard.press('KeyU'); await g.step(3);
    const open = await g.eval(() => [window.__G.mode, document.getElementById('equipW').hidden]);
    await g.eval(() => { const G = window.__G; G.P.inv = 0; G.P.hp = 1; G.hurtPlayer ? G.hurtPlayer(1e9) : window.__GUND.hurt(1e9, 1); });
    await g.step(5);
    const after = await g.eval(() => [window.__G.mode, document.getElementById('equipW').hidden]);
    assert.deepEqual(open, ['equip', false]); assert.deepEqual(after, ['dead', true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
