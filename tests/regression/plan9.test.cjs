'use strict';
// Plan batch 9 (owner 2026-10-26 21:35: "keep making updates, don't stop"): U203 a letter that goes to the Kingdom or to the
// Empire, one side's thanks and the other's memory; U158 the border posts on the Kingdom–Empire line, gated by reputation.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const closeDialogs = async (g) => {   // a menu is left with Escape, a line by going on
  for (let i = 0; i < 10 && await g.eval(() => window.__G.mode) === 'dialog'; i++) {
    if (await g.eval(() => { const D = window.__G.DL; return !!(D && D.opts && D.opts.length); })) await g.page.keyboard.press('Escape'); else await g.eval(() => window.__G.advance());
    await g.step(2);
  }
};

test('the courier\'s letter: one side or the other, and the other remembers; then its border post stops you', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB9, o = {};
      S.lv = 160;
      o.offer = [X.avail('fcA'), X.avail('fcB')];
      X.npcTalk('innRo'); for (let i = 0; i < 4 && !(G.DL && G.DL.opts); i++) G.advance(); o.opts = G.DL && G.DL.opts ? G.DL.opts.map((x) => x.l) : [];
      X.accept('fcA'); o.other = X.avail('fcB');
      X.npcTalk('aden'); o.dl = S.qs.fcA.c;
      const r0 = X.repOf('zRein'); X.complete('fcA'); o.rep = [X.repOf('zRein') - r0 >= 60, X.repOf('zTitan')];
      o.after = X.avail('fcB');
      return o;
    });
    assert.deepEqual(r.offer, [true, true], 'both sides are offered');
    assert.deepEqual(r.opts, ['Accept', "No, I'll take it to Titan's knights", 'Not now'], 'the innkeeper offers both sides');
    assert.equal(r.other, false, 'taking one closes the other');
    assert.equal(r.dl, 1, 'the letter delivered to Earl Aden');
    assert.deepEqual(r.rep, [true, -60], 'the Kingdom thanks you, the Empire remembers');
    assert.equal(r.after, false);
    await closeDialogs(g);

    // the Empire's post: walking east over the line is stopped; a fine buys a day's pass
    const b = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB9, P = G.P, L = X.EX * 16, o = {};
      P.y = 84 * 16; P.x = L - 10; X.bcTick(0.016); P.x = L + 5; X.bcTick(0.016);
      o.pushed = P.x < L; o.mode = G.mode; o.opts = G.DL.opts.map((x) => x.l);
      S.gold = 1e6; const g0 = S.gold; G.DL.opts[0].f(); o.paid = g0 - S.gold === X.bcFine(); o.pass = S.bpass.zTitan > Date.now();
      return o;
    });
    assert.equal(b.pushed, true, 'stopped at the line');
    assert.equal(b.mode, 'dialog');
    assert.match(b.opts[0], /^Pay the fine \([\d,]+ gold\): a day's pass$/); assert.equal(b.opts[1], 'Turn back');
    assert.equal(b.paid, true); assert.equal(b.pass, true);
    await closeDialogs(g);
    const c = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB9, P = G.P, L = X.EX * 16, o = { mode: G.mode };
      P.x = L - 10; X.bcTick(0.016); P.x = L + 5; X.bcTick(0.016); o.through = P.x > L;
      // west into the Kingdom: Reinhardt likes you, so the post lets you by
      P.x = L - 5; X.bcTick(0.016); o.west = P.x < L;
      // no pass and a bad name: a teleport over the line isn't a crossing
      delete S.bpass.zTitan; P.x = L - 10; X.bcTick(0.016); P.x = L + 400; X.bcTick(0.016); o.tele = P.x > L;
      // a coach across the line asks the post first
      // a blink over the line is a crossing; so is walking with the bag open
      P.x = L - 70; X.bcTick(0.016); P.x = L + 80; X.bcTick(0.016); o.blink = P.x < L;
      G.mode = 'inv'; P.x = L - 10; X.bcTick(0.016); P.x = L + 5; X.bcTick(0.016); o.bag = P.x < L; G.mode = 'play';
      P.x = L - 900; X.bcTick(0.016); S.gold = 0; X.cGo('coachRo', 'coachRh'); o.coach = G.mode === 'dialog' && /^Pay the fine/.test((G.DL.opts[0] || {}).l || '');
      return o;
    });
    assert.equal(c.mode, 'play', 'the post\'s dialog was closed');
    assert.equal(c.through, true, 'with a pass, through');
    assert.equal(c.west, true, 'no stop going west with Reinhardt\'s good will');
    assert.equal(c.tele, true, 'a teleport isn\'t stopped');
    assert.equal(c.blink, true, 'a blink is stopped'); assert.equal(c.bag, true, 'with the bag open too');
    assert.equal(c.coach, true, 'the coach to Rolling stops at the post, before the fare');
    await closeDialogs(g);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
