'use strict';
// SAT-ONLINE-092 (plan U379): localization regressions. Every line the game shows is written twice, Arabic and English
// (STR in index.html: the big table and every Object.assign(STR.ar/en, ...) next to a feature). Each English key has an
// Arabic one and each Arabic one an English one, except the Arabic feminine forms (a key ending in F next to its
// masculine one); both say the same {placeholders}; a line is empty in both or in neither.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

// the object literal that starts at src[i] ('{'), to its matching brace (strings skipped)
function literal(src, i) {
  let depth = 0, q = null, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) break; }
  }
  return vm.runInNewContext('(' + src.slice(i, j + 1) + ')');
}
function tables(src) {
  const k = src.indexOf('const STR={');
  assert.ok(k >= 0, 'the string table');
  const base = literal(src, src.indexOf('{', k)), out = { ar: Object.assign({}, base.ar), en: Object.assign({}, base.en) };
  const re = /Object\.assign\(STR\.(ar|en),\{/g; let m, n = 0;
  while ((m = re.exec(src))) { Object.assign(out[m[1]], literal(src, m.index + m[0].length - 1)); n++; }
  return Object.assign(out, { blocks: n });
}
const holes = (s) => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');

test('every line in both languages, with the same placeholders, empty in both or neither', () => {
  const T = tables(SRC);
  assert.ok(T.blocks > 100 && Object.keys(T.en).length > 2000, 'found the tables: ' + T.blocks + ' blocks');
  const fem = (k) => /F$/.test(k) && (k.slice(0, -1) in T.ar);
  assert.deepEqual(Object.keys(T.en).filter((k) => !(k in T.ar)), [], 'English lines with no Arabic');
  assert.deepEqual(Object.keys(T.ar).filter((k) => !(k in T.en) && !fem(k)), [], 'Arabic lines with no English (other than feminine forms)');
  const both = Object.keys(T.en).filter((k) => k in T.ar && typeof T.en[k] === 'string' && typeof T.ar[k] === 'string');
  assert.deepEqual(both.filter((k) => holes(T.en[k]) !== holes(T.ar[k])).map((k) => k + ': ' + holes(T.en[k]) + ' | ' + holes(T.ar[k])), [], 'placeholders differ');
  assert.deepEqual(Object.keys(T.ar).filter((k) => fem(k) && holes(T.ar[k]) !== holes(T.ar[k.slice(0, -1)])), [], 'a feminine form with other placeholders');
  assert.deepEqual(both.filter((k) => !T.en[k].trim() !== !T.ar[k].trim()), [], 'a line empty in one language only');
});

// SAT-ONLINE-118 (plan U315): every key the page asks for by name, in t('key') or t('key', {...}) and in data-i18n="key", is in
// the tables; the page would show the bare key otherwise. Keys built at run time (t('cl_' + k)) are not checked here.
function asked(src) {
  const out = new Map();
  for (const m of src.matchAll(/\bt\('([A-Za-z0-9_]+)'\s*[,)]/g)) if (!out.has(m[1])) out.set(m[1], 't()');
  for (const m of src.matchAll(/data-i18n(?:-[a-z]+)?="([A-Za-z0-9_]+)"/g)) if (!out.has(m[1])) out.set(m[1], 'data-i18n');
  return out;
}
test('every key the page asks for by name has its lines', () => {
  const T = tables(SRC), A = asked(SRC);
  assert.ok(A.size > 1000, 'found the keys: ' + A.size);
  assert.deepEqual([...A].filter(([k]) => !(k in T.en)).map(([k, w]) => k + ' (' + w + ')'), [], 'asked for with no English line');
  assert.deepEqual([...A].filter(([k]) => !(k in T.ar)).map(([k, w]) => k + ' (' + w + ')'), [], 'asked for with no Arabic line');
  const B = asked("t('a');t('b',{n:1});t('c'+k);t( 'd');x.t('e');<b data-i18n=\"f\"></b><i data-i18n-title=\"g\"></i>");
  assert.deepEqual([...B.keys()], ['a', 'b', 'e', 'f', 'g'], 'the scan itself: whole keys only, not prefixes');
});

test('the checker finds what it should', () => {
  const T = tables('const STR={ar:{a:"س {n}",bF:"ب"},en:{a:"A {n}",c:"C"}};\nObject.assign(STR.ar,{d:"د {x}"});Object.assign(STR.en,{d:"D {y}",e:"it\'s {z}"});');
  assert.equal(T.blocks, 2);
  assert.deepEqual(Object.keys(T.en).filter((k) => !(k in T.ar)), ['c', 'e']);
  assert.equal(holes(T.en.d) === holes(T.ar.d), false);
  assert.equal(T.en.e, "it's {z}", 'quotes inside strings');
});
