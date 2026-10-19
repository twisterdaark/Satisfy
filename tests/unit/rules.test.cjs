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
const NULLABLE = ['title', 'room', 'party', 'duel']; // omitted when null/empty is allowed by the client

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

test('presence is indexed on exactly the children the interest queries order by (U009: x; party)', () => {
  assert.deepEqual(rules.presence.$world.$shard['.indexOn'], ['x', 'party']);
  const fb = fs.readFileSync(path.join(ROOT, 'src/net/firebase.js'), 'utf8');
  assert.deepEqual([...new Set([...fb.matchAll(/orderByChild\('(\w+)'\)/g)].map((m) => m[1]))].sort(), ['party', 'x']);
  // the radius must cover the screen after a full re-centre step: |offset| <= step, half screen = W / 2
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const I = /const NET_INTEREST=\{radius:(\d+),step:(\d+)\}/.exec(html), W = +/const W=(\d+),H=/.exec(html)[1];
  assert.ok(I, 'NET_INTEREST in index.html');
  assert.ok(+I[2] + W / 2 < +I[1], `step ${I[2]} + half screen ${W / 2} < radius ${I[1]}`);
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
  const { raid: RA } = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/party.js', 'src/net/raid.js');
  assert.deepEqual(types.filter((x) => x.startsWith('raid.')), [...RA.TYPES], 'every raid message can travel');
  assert.match(msg.payload.raid['.validate'], /length <= 64/);
  assert.match(msg.payload['.validate'], /beginsWith\('raid\.'\)/);
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  assert.deepEqual(expand(/if \(!\/(.*)\/\.test\(v\.type\)\)/.exec(fake)[1]), types, 'the fake accepts the same types');
  for (const f of ['party', 'duel']) assert.match(msg.payload[f]['.validate'], /length <= 40/);
  assert.match(msg.payload['.validate'], /beginsWith\('party\.'\)/);
  assert.match(msg.payload['.validate'], /beginsWith\('duel\.'\)/);
  // SAT-ONLINE-016: party chat, text only in chat messages, as long as Satisfy.chat allows
  const { chat: CH } = loadModules('src/net/chat.js');
  assert.deepEqual(types.filter((x) => x.startsWith('chat.')), [...CH.TYPES]);
  assert.match(msg.payload.text['.validate'], new RegExp('length <= ' + CH.C.MAX_LEN + '$'));
  assert.match(msg.payload['.validate'], /beginsWith\('chat\.'\) && newData\.hasChildren\(\['party', 'text'\]\)/);
  for (const kind of ['party', 'duel', 'raid']) assert.match(msg.payload['.validate'], new RegExp("beginsWith\\('" + kind + "\\.'\\)[^|]*!newData\\.hasChild\\('text'\\)"), kind + ' messages carry no text');
});

test('profiles and cloud saves: owner writes only; cloud saves are private; limits match Satisfy.cloud', () => {
  const { cloud: CL } = loadModules('src/net/cloud.js');
  const prof = rules.profiles.$uid, idx = rules.cloudIndex.$uid, sav = rules.cloudSaves.$uid;
  const owner = 'auth != null && auth.uid === $uid';
  assert.equal(prof['.read'], 'auth != null', 'the public profile is readable by signed-in players');
  assert.equal(prof['.write'], owner);
  assert.match(prof['.validate'], /revision'\)\.val\(\) > data\.child\('revision'\)\.val\(\)/, 'no stale overwrite');
  for (const n of [idx, sav]) { assert.equal(n['.read'], owner, 'cloud saves are private'); assert.equal(n.$pid['.write'], owner); assert.equal(n.$pid.$other['.validate'], false); }
  assert.equal(prof.$other['.validate'], false);
  assert.match(sav.$pid.blob['.validate'], new RegExp('length <= ' + CL.MAX_BLOB + '$'));
  assert.match(idx.$pid.size['.validate'], new RegExp('<= ' + CL.MAX_BLOB + '$'));
  // doc §23 public fields, nothing private (gold, items) can be stored under the public parent
  const fields = Object.keys(prof).filter((k) => !k.startsWith('.') && !k.startsWith('$')).sort();
  assert.deepEqual(fields, ['classId', 'handle', 'language', 'look', 'lv', 'revision', 't', 'titleId']);
  const p = CL.profileFrom({ look: { n: 'G' } }, 'en', 1);
  assert.deepEqual(Object.keys(p).concat('t').sort(), fields, 'the client writes exactly these fields');
});

test('sessions: one lease node per account, owner only, server time', () => {
  const s = rules.sessions.$uid, owner = 'auth != null && auth.uid === $uid';
  assert.equal(s['.read'], owner);
  assert.equal(s['.write'], owner);
  assert.equal(s.t['.validate'], 'newData.val() === now');
  assert.equal(s.$other['.validate'], false);
  const fb = fs.readFileSync(path.join(ROOT, 'src/net/firebase.js'), 'utf8');
  assert.match(fb, /'sessions\/' \+ uid/);
});
