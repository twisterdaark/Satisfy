'use strict';
// Skill levels belong to the skill (owner 2026-10-23): an attack's Lv 5 and Lv 10 give it a crit chance and bleeding hits;
// a buff or a utility (a bard's song, a shield, a step) costs less mana, then cools down faster; a heal heals more, then
// cools down faster. No buff opens a crit chance, and only an attack's level raises skill damage.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('skill levels: each kind of skill grows in what it does', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, L = window.__GSL, out = {};
      out.kinds = ['whirl', 'bvalor', 'pheal', 'ashadow', 'galight', 'gabreath', 'gnaim', 'scraft'].map((k) => L.kind(k));
      const mp0 = { bvalor: L.mp('bvalor'), whirl: L.mp('whirl') };
      S.skx = S.skx || {}; for (const k of ['whirl', 'bvalor', 'pheal']) S.skx[k] = 99999;
      out.opt = { whirl: [L.opt('whirl', 5), L.opt('whirl', 10)], bvalor: [L.opt('bvalor', 5), L.opt('bvalor', 10)], pheal: [L.opt('pheal', 5), L.opt('pheal', 10)] };
      out.cdm = [L.cdm('whirl'), L.cdm('bvalor'), L.cdm('pheal')];
      out.mp = { bvalor: L.mp('bvalor') / mp0.bvalor, whirl: L.mp('whirl') / mp0.whirl };
      P.hp = 100; L.heal('pheal', 50); out.heal = P.hp; out.txt = L.txt('bvalor');
      return out; });
    assert.deepEqual(r.kinds, ['atk', 'buff', 'heal', 'util', 'buff', 'heal', 'atk', 'own']);
    assert.match(r.opt.whirl[0], /critical/); assert.match(r.opt.whirl[1], /bleed/);
    assert.doesNotMatch(r.opt.bvalor.join(' '), /critical|bleed/, 'a song opens no crit'); assert.match(r.opt.bvalor[0], /mana/); assert.match(r.opt.bvalor[1], /Cooldown/);
    assert.match(r.opt.pheal[0], /Heals/);
    assert.deepEqual(r.cdm, [1, 0.8, 0.8]);
    assert.ok(r.mp.bvalor / r.mp.whirl < 0.9, 'a levelled song costs less mana than an attack at the same level (rounded): ' + JSON.stringify(r.mp));
    assert.ok(r.heal > 100 + 50 * 0.6, 'a Lv 10 heal heals more: ' + r.heal);
    assert.doesNotMatch(r.txt, /critical/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
