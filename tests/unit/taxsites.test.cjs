'use strict';
// SAT-ONLINE-106 after Claude-B's review: every purchase that charges a price with Reidan's city tax in it (price(), or a
// fee worked out from it) passes the tax on to the castle guild (taxNote). Three didn't (honours shop, salvage, appraisal).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

// the helpers that turn a price into a fee: `name=(...)=>...price(...)`
function feeHelpers(src) {
  const out = [];
  for (const m of src.matchAll(/[,;\s]([A-Za-z0-9_]+)=\([^)]*\)=>[^;\n]*\bprice\(/g)) out.push(m[1]);
  return out;
}
// every named function's body
function functions(src) {
  const out = [];
  for (const m of src.matchAll(/function ([A-Za-z0-9_]+)\([^)]*\)\{/g)) {
    let d = 0, i = src.indexOf('{', m.index);
    for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && !--d) break; }
    out.push([m[1], src.slice(m.index, i + 1)]);
  }
  return out;
}

test('a purchase charged at a taxed price passes the tax on', () => {
  const fees = feeHelpers(SRC);
  assert.ok(fees.includes('salvFee') && fees.includes('aprFee'), 'the fee helpers are found: ' + fees.join(', '));
  const priced = new RegExp('\\b(price|' + fees.join('|') + ')\\(');
  const miss = functions(SRC).filter(([, b]) => /S\.gold-=/.test(b) && priced.test(b) && !/\btaxNote\(/.test(b)).map(([n]) => n);
  assert.deepEqual(miss, [], 'charged without taxNote: ' + miss.join(', '));
});
