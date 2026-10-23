'use strict';
// SAT-ONLINE-122 (plan U381, "client config alone not privileged"): every grant in the database rules needs a signed-in
// account, so the public web config (src/net/firebase-config.js) gives nothing by itself; and the lockdown the owner
// deploys in an incident (docs/online/INCIDENT.md) refuses everything.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// is there an || outside parentheses, strings and regexes? ("auth != null && A || B" grants B to anyone)
function topOr(s) {
  let d = 0, q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === '/' && /(\.matches\()\s*$/.test(s.slice(0, i))) { let j = i + 1; while (j < s.length && s[j] !== '/') { if (s[j] === '\\') j++; j++; } i = j; continue; }
    if (c === '(') d++; else if (c === ')') d--; else if (d === 0 && s.startsWith('||', i)) return true;
  }
  return false;
}
// the .read and .write rules that a request without a sign-in could pass
function open(rules) {
  const out = [];
  (function walk(o, p) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (k === '.read' || k === '.write') {
        if (v === false) continue;
        const rest = v === 'auth != null' ? '' : typeof v === 'string' && v.startsWith('auth != null && ') ? v.slice(16) : null;
        if (rest === null || topOr(rest)) out.push(p + '/' + k);
      } else if (v && typeof v === 'object') walk(v, p + '/' + k);
    }
  })(rules, '');
  return out;
}

test('every grant in the rules needs a signed-in account: the web config alone opens nothing', () => {
  const rules = read('backend/database.rules.json').rules;
  assert.equal(rules['.read'], false);
  assert.equal(rules['.write'], false);
  assert.deepEqual(open(rules), []);
});

test('the checker catches a grant without a sign-in', () => {
  assert.deepEqual(open({ a: { '.read': true }, b: { '.write': "auth != null && data.exists() || newData.val() === 1" }, c: { '.read': "now > 0" }, d: { $x: { '.write': "auth != null && ($x === 'k' || root.child('y').exists())" } }, e: { '.validate': "a || b" } }),
    ['/a/.read', '/b/.write', '/c/.read']);
  assert.equal(topOr("newData.val().matches(/^(a||b)$/) && x"), false, 'an || inside a regex is not one');
  assert.equal(topOr("x === '||' && y"), false, 'nor inside a string');
});

test('the lockdown refuses everything, and its config deploys it', () => {
  assert.deepEqual(read('backend/lockdown.rules.json'), { rules: { '.read': false, '.write': false } });
  assert.deepEqual(read('firebase.lockdown.json'), { database: { rules: 'backend/lockdown.rules.json' } });
  assert.equal(read('firebase.json').database.rules, 'backend/database.rules.json', 'the normal deploy keeps the real rules');
});
