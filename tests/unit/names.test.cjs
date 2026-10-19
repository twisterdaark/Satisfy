// Names shown to the player must not repeat (owner 2026-10-19: "Blacksmith's Rage" was listed twice with different numbers).
// Every skill name (sk_*) and every item name (the RC ids' strings) is unique within each language, and no skill or item
// text says where it was quoted from.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

// the language of a string is set by the nearest STR block above it: `ar:{`/`en:{` in the table, or Object.assign(STR.xx,
function strings(prefix) {
  const marks = [...html.matchAll(/(?:^(ar|en):\{|Object\.assign\(STR\.(ar|en),)/gm)].map((m) => [m.index, m[1] || m[2]]);
  const out = { ar: {}, en: {} };
  for (const m of html.matchAll(new RegExp('[{,\\s]' + prefix + '(\\w+):(["\'])((?:\\\\.|(?!\\2).)*)\\2', 'g'))) {
    const mk = marks.filter((x) => x[0] < m.index).pop();
    if (mk) out[mk[1]][m[1]] = m[3];
  }
  return out;
}
const skd = new Set([...html.slice(html.indexOf('const SKD={')).matchAll(/^\s*(\w+):\{/gm)].map((m) => m[1]));

test('every skill name is used by one skill only', () => {
  const S = strings('sk_');
  for (const lang of ['ar', 'en']) {
    const seen = {};
    for (const [k, v] of Object.entries(S[lang])) {
      assert.ok(!seen[v], `${lang}: "${v}" names both sk_${seen[v]} and sk_${k}`);
      seen[v] = k;
    }
  }
  assert.ok(Object.keys(S.ar).length > 20 && skd.size > 0);
});

test('every crafted or dropped item has its own name', () => {
  const ids = [...html.matchAll(/\{id:'(\w+)',slot:'[waxhgbk]'/g)].map((m) => m[1]);
  for (const lang of ['ar', 'en']) {
    const all = {};
    const seen = {};
    const marks = [...html.matchAll(/(?:^(ar|en):\{|Object\.assign\(STR\.(ar|en),)/gm)].map((m) => [m.index, m[1] || m[2]]);
    for (const id of ids) {
      for (const m of html.matchAll(new RegExp('[{,\\s]' + id + ':(["\'])((?:\\\\.|(?!\\1).)*)\\1', 'g'))) {
        const mk = marks.filter((x) => x[0] < m.index).pop();
        if (mk && mk[1] === lang) { all[id] = m[2]; break; }
      }
    }
    assert.ok(Object.keys(all).length > 30, `${lang}: item names found`);
    for (const [id, v] of Object.entries(all)) { assert.ok(!seen[v], `${lang}: "${v}" names both ${seen[v]} and ${id}`); seen[v] = id; }
  }
});

test('skill and item texts do not cite the novel', () => {
  assert.doesNotMatch(html, /\((?:الرواية|Novel)[^)]*\)|\(novel\)/);
});
