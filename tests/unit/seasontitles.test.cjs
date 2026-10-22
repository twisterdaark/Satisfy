'use strict';
// SAT-ONLINE-129 (plan U344, "season rewards: non-competitive cosmetics first; no paid PvP dominance"): the titles that
// seasons and competitions give (the National Champion, the arena season's three) are cosmetic. No stat formula reads them
// (no `tl.<id>` anywhere in the game), they have no stats line (`tl_<id>S`), no skill comes with them (TLS), and their
// descriptions say so.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const SEASONAL = ['natChamp', 'arnReg', 'arnTop', 'arnChamp'];

test('season and competition titles give no stats', () => {
  const tls = /\bTLS=\{([^}]*)\}/.exec(SRC);
  assert.ok(tls, 'the title skills (TLS) are where they were');
  for (const id of SEASONAL) {
    assert.ok(SRC.includes("giveTitle('" + id + "')") || new RegExp("\\b" + id + "\\b").test(SRC), id + ' is given somewhere');
    assert.ok(new RegExp("tl_" + id + "\\s*:").test(SRC) || SRC.includes('"tl_' + id + '"'), id + ' has a name');
    assert.equal(new RegExp("\\btl\\." + id + "\\b").test(SRC), false, 'no formula reads S.tl.' + id);
    assert.equal(new RegExp("\\btl\\[['\"]" + id + "['\"]\\]").test(SRC), false, 'nor S.tl["' + id + '"]');
    assert.equal(new RegExp("tl_" + id + "S\\b").test(SRC), false, id + ' has no stats line');
    assert.equal(new RegExp("\\b" + id + "\\s*:").test(tls[1]), false, id + ' brings no skill');
  }
});

test('the checker would catch a title with a stat', () => {
  const bad = "x=(S.tl.arnChamp?1.05:1)", ok = "giveTitle('arnChamp')";
  assert.equal(/\btl\.arnChamp\b/.test(bad), true);
  assert.equal(/\btl\.arnChamp\b/.test(ok), false);
});
