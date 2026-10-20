'use strict';
// The Behen Archipelago's island boxes sit in rows under the dungeons and must stay inside the map and clear of them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../harness/load-module.cjs');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const num = (re) => { const m = html.match(re); assert.ok(m, 'not found: ' + re); return +m[1]; };

test('island boxes fit inside the map, below the dungeons and rooms', () => {
  const LW = num(/LW=(\d+),GAPS/), EW = num(/,EW=(\d+),/), MH = num(/,MH=(\d+),/);
  const gaps = html.match(/GAPS=(\[\[[\d,\[\]]*\]\])/); assert.ok(gaps);
  const MW = LW + JSON.parse(gaps[1]).reduce((a, g) => a + g[1], 0) + EW;
  const Y0 = num(/BHY0=(\d+)/), Y1 = num(/BHY1=(\d+)/);
  const kinds = html.match(/const BHT=\[([^\]]*)\]/)[1].split(',').length;
  const x0 = html.match(/bhX0=i=>(\d+)\+i\*(\d+)/);
  assert.ok(x0);
  assert.ok(+x0[1] + (kinds - 1) * +x0[2] + 63 < MW, 'last island box past the map edge');
  assert.ok(Y1 < MH, 'island rows past MH');
  // dungeon floors and house interiors end above the archipelago
  for (const m of html.matchAll(/\by1:(\d+)/g)) if (+m[1] > 200 && +m[1] < 400) assert.ok(+m[1] < Y0, 'a dungeon reaches row ' + m[1]);
});

test('the archipelago is an instance for one and its save state persists', () => {
  assert.match(html, /const solo=\(x,y\)=>\{if\(inBh\(x,y\)\)return true;/);
  const st = fs.readFileSync(path.join(ROOT, 'src', 'core', 'state.js'), 'utf8');
  assert.match(st, /'bh',/);
});
