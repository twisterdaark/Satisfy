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
  assert.match(node.x['.validate'], new RegExp('< ' + N.LIMITS.posX + '"?$'));
  assert.match(node.y['.validate'], new RegExp('< ' + N.LIMITS.posY + '"?$'));
  const anims = /\^\((.*)\)\$/.exec(node.anim['.validate'])[1].split('|');
  assert.deepEqual(anims, N.ANIMS);
});

test('the test fake enforces the same required fields', () => {
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  const req = JSON.parse(/const REQUIRED = (\[.*\]);/.exec(fake)[1].replace(/'/g, '"'));
  assert.deepEqual(req.sort(), [...N.PUBLIC_FIELDS.filter((f) => !NULLABLE.includes(f)), 'seq'].sort());
});

test('position bounds cover the whole map, and the fake uses the same bounds', () => {
  // Read the map size from index.html so a wider map fails here, not in a live Winston write.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /TS=(\d+),LW=(\d+),GAPS=(\[\[[\d,\[\]]*\]\]),MW=.*?,MH=(\d+)/.exec(html);
  assert.ok(m, 'map constants found in index.html');
  const [ts, lw, gaps, mh] = [+m[1], +m[2], JSON.parse(m[3]), +m[4]];
  const mw = lw + gaps.reduce((a, g) => a + g[1], 0);
  assert.ok(mw * ts <= N.LIMITS.posX, `map width ${mw * ts}px fits under ${N.LIMITS.posX}`);
  assert.ok(mh * ts <= N.LIMITS.posY, `map height ${mh * ts}px fits under ${N.LIMITS.posY}`);
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  const fb = /const POS_X = (\d+), POS_Y = (\d+);/.exec(fake);
  assert.deepEqual([+fb[1], +fb[2]], [N.LIMITS.posX, N.LIMITS.posY]);
});

// review fix (#12, #51): the open world spans rows -NR..WMH-1, so the north is written at negative y
test('the north (negative y) is writable; one shard name only', () => {
  assert.match(node.y['.validate'], new RegExp('>= -' + N.LIMITS.posY + ' '));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const nr = +/,NR=(\d+)/.exec(html)[1], ts = +/TS=(\d+)/.exec(html)[1];
  assert.ok(nr * ts <= N.LIMITS.posY, 'the north fits');
  assert.equal(rules.presence.$world.$shard['.validate'], "$shard === 'main'", 'nobody creates nodes under other shard names');
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  assert.match(fake, /v\.y >= -POS_Y && v\.y < POS_Y/);
  assert.match(fake, /seg\[2\] !== 'main'/);
});
