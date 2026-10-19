'use strict';
// backend/database.rules.json must agree with the PlayerPublic contract and with the fake used in tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadModules, ROOT } = require('../harness/load-module.cjs');

const { net: N } = loadModules('src/net/contracts.js');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/database.rules.json'), 'utf8')).rules;
const node = rules.presence.$world.$shard.$uid;
const firebaseJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
const NULLABLE = ['title', 'room', 'party']; // omitted when null/empty is allowed by the client

test('deny by default; presence readable only when signed in, writable only by its owner', () => {
  assert.equal(rules['.read'], false);
  assert.equal(rules['.write'], false);
  assert.equal(rules.presence.$world.$shard['.read'], 'auth != null');
  assert.equal(node['.write'], 'auth != null && auth.uid === $uid');
  assert.equal(node.uid['.validate'], 'newData.val() === $uid');
  assert.equal(node.t['.validate'], 'newData.val() === now', 'server time only');
  assert.equal(node.$other['.validate'], false, 'unknown fields rejected');
  assert.equal(firebaseJson.database.rules, 'backend/database.rules.json');
});

test('every PlayerPublic field has a rule, required fields match the contract', () => {
  for (const f of N.PUBLIC_FIELDS) assert.ok(node[f], `rule for ${f}`);
  assert.ok(node.seq, 'rule for seq');
  const required = /hasChildren\(\[(.*)\]\)/.exec(node['.validate'])[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.deepEqual(required.sort(), [...N.PUBLIC_FIELDS.filter((f) => !NULLABLE.includes(f)), 'seq'].sort());
});

test('limits match the contract and the world', () => {
  assert.match(node.handle['.validate'], new RegExp('length <= ' + N.LIMITS.handle));
  assert.match(node.title['.validate'], new RegExp('length <= ' + N.LIMITS.title));
  assert.match(node.x['.validate'], /< 2560/); // 160 tiles * 16 px
  assert.match(node.y['.validate'], /< 2304/); // 144 tiles * 16 px
  const anims = /\^\((.*)\)\$/.exec(node.anim['.validate'])[1].split('|');
  assert.deepEqual(anims, N.ANIMS);
});

test('the test fake enforces the same required fields', () => {
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  const req = JSON.parse(/const REQUIRED = (\[.*\]);/.exec(fake)[1].replace(/'/g, '"'));
  assert.deepEqual(req.sort(), [...N.PUBLIC_FIELDS.filter((f) => !NULLABLE.includes(f)), 'seq'].sort());
});
