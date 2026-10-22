'use strict';
// The update log (src/ui/changelog.js): the title shows the newest entry's ver, and the owner wants every update to raise it
// by 0.01. A merge that keeps two entries' headers or numbers wrongly breaks the page's script or the count; catch that.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const L = loadModules('src/ui/changelog.js').CHANGELOG;

test('update log: unique ids, both languages, newest first, each numbered entry 0.01 above the next', () => {
  assert.ok(Array.isArray(L) && L.length > 0);
  assert.equal(new Set(L.map((e) => e.v)).size, L.length, 'every v id is unique');
  for (const e of L) {
    assert.ok(/^\d{4}-\d\d-\d\d/.test(e.v) && /^\d{4}-\d\d-\d\d$/.test(e.d), e.v);
    assert.ok(Array.isArray(e.ar) && e.ar.length && Array.isArray(e.en) && e.en.length === e.ar.length, e.v + ': ar and en, the same number of points');
  }
  const nums = L.filter((e) => e.ver).map((e) => Math.round(+e.ver * 100));
  for (let i = 1; i < nums.length; i++) assert.equal(nums[i - 1] - nums[i], 1, 'ver ' + nums[i - 1] / 100 + ' then ' + nums[i] / 100);
});

// owner 2026-10-22: the players' log shows nothing about the owner's or the admins' own tools; such lines get `hide`
test("update log: no visible line about the owner's or the admins' tools", () => {
  const vis = (e, l) => (e.hide === 1 ? [] : (e[l] || []).filter((x, i) => !(Array.isArray(e.hide) && e.hide.includes(i))));
  const bad = [];
  for (const e of L) {
    assert.ok(e.hide === undefined || e.hide === 1 || (Array.isArray(e.hide) && e.hide.every((i) => Number.isInteger(i) && i >= 0 && i < e.en.length)), e.v + ': hide is 1 or line numbers');
    for (const x of vis(e, 'en')) if (/game's owner|\badmins?\b|\/net\b/i.test(x)) bad.push(e.v + ': ' + x.slice(0, 60));
    for (const x of vis(e, 'ar')) if (/صاحب اللعبة|الأدمن|الادمن/.test(x)) bad.push(e.v + ': ' + x.slice(0, 60));
  }
  assert.deepEqual(bad, []);
});
