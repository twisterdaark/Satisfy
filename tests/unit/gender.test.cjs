'use strict';
// Owner 2026-10-20: Jishuka "بتحارب", not "بيحارب". A line about an NPC by name goes through gk(id,key), which picks
// key+'F' for the women in FEM; every such key has its Arabic F form.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../harness/load-module.cjs');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('lines that name an NPC take the feminine form for women', () => {
  const fem = html.match(/const FEM=new Set\((\[[^\]]*\])\)/);
  assert.ok(fem);
  for (const id of ['jishuka', 'ta', 'stylist']) assert.ok(fem[1].includes(`'${id}'`), id + ' is in FEM');
  // every t('key',{n:t(<npc id>)}) about a companion or a fighting hero goes through gk
  for (const k of ['meetMap', 'meetWin', 'compOn', 'compOff', 'npcKOt']) {
    assert.ok(!new RegExp(`t\\('${k}',\\{n:t\\(`).test(html), k + ' is called through gk');
    assert.ok(new RegExp(`gk\\(\\w+(?:\\.id)?,'${k}'\\)`).test(html), k + ' uses gk');
    assert.ok(new RegExp(`${k}F:["'][^"']*[\\u0600-\\u06ff]`).test(html), k + 'F has an Arabic line');
  }
});
