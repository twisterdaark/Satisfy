'use strict';
// The game is one inline <script> in index.html that two agents edit. A duplicate `const`/`let`
// stops the whole game at parse time, and a duplicate `function` silently replaces the first one.
// Both can happen in a rebase; this catches them in a second, without a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('../harness/load-module.cjs');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const inline = [...html.matchAll(/<script>\n([\s\S]*?)<\/script>/g)].map((m) => m[1]);

test('the inline game script parses', () => {
  assert.ok(inline.length >= 1, 'inline script found');
  for (const src of inline) assert.doesNotThrow(() => new vm.Script(src, { filename: 'index.html#inline' }));
});

test('no function is declared twice in the game script', () => {
  const src = inline[inline.length - 1];
  const names = [...src.matchAll(/(?:^|[;\n{} ])function ([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
  const seen = new Set(), dup = new Set();
  for (const n of names) (seen.has(n) ? dup : seen).add(n);
  assert.deepEqual([...dup], []);
});
