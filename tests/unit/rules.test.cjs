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

test('inbox: only the owner reads and deletes; senders create write-once messages as themselves', () => {
  const box = rules.inbox.$uid, msg = box.$msg;
  assert.equal(box['.read'], 'auth != null && auth.uid === $uid');
  assert.equal(msg['.write'], "auth != null && ((auth.uid === $uid && !newData.exists()) || (!data.exists() && newData.child('from').val() === auth.uid))");
  assert.equal(msg.payload.to['.validate'], 'newData.val() === $uid');
  assert.equal(msg.t['.validate'], 'newData.val() === now');
  assert.equal(msg.$other['.validate'], false);
  assert.equal(msg.payload.$other['.validate'], false);
  // "party\.(a|b)|duel\.(c|d)" -> ['party.a', 'party.b', 'duel.c', 'duel.d']
  const expand = (src) => [...src.matchAll(/(\w+)\\\.\(([^)]*)\)/g)].flatMap((m) => m[2].split('|').map((x) => m[1] + '.' + x));
  const types = expand(/matches\(\/(.*)\/\)/.exec(msg.type['.validate'])[1]);
  const fb = fs.readFileSync(path.join(ROOT, 'src/net/firebase.js'), 'utf8');
  const sent = expand(/DIRECTED = \/(.*)\/;/.exec(fb)[1]);
  assert.deepEqual(types, sent, 'rules accept exactly the messages the transport sends');
  assert.deepEqual(types.filter((x) => x.startsWith('party.')), ['party.invite', 'party.accept', 'party.decline', 'party.kick']);
  const { duel: DU } = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/duel.js');
  assert.deepEqual(types.filter((x) => x.startsWith('duel.')), [...DU.TYPES], 'every duel message can travel');
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  assert.deepEqual(expand(/if \(!\/(.*)\/\.test\(v\.type\)\)/.exec(fake)[1]), types, 'the fake accepts the same types');
  for (const f of ['party', 'duel']) assert.match(msg.payload[f]['.validate'], /length <= 40/);
  assert.match(msg.payload['.validate'], /beginsWith\('party\.'\)/);
  assert.match(msg.payload['.validate'], /beginsWith\('duel\.'\)/);
});
