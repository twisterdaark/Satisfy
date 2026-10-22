'use strict';
// SAT-ONLINE-116 (plan U021): the real rules (backend/database.rules.json) on the real Realtime Database emulator, with
// three accounts: A and B, two players, and M, an admin. The fake (tests/harness/fake-firebase.js) and the evaluator copy
// the rules by hand or evaluate them in Node; this runs them where they run. The plan's check: account A can't change
// what is account B's (B's account ID, presence, profile, saves, session, friends, lines, guild rank), and the denials
// that matter for each part. CI runs it (.github/workflows/emulator.yml): the emulator needs Java and a download that
// this sandbox can't reach. To run it by hand:
//   npm install --no-save firebase-tools@14 @firebase/rules-unit-testing@4 firebase@11
//   npx firebase emulators:exec --only database --project demo-satisfy "node --test tests/emulator/"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const RULES = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'database.rules.json'), 'utf8');
const SV = { '.sv': 'timestamp' };
const A = 'uidAhmed01', B = 'uidBassem02', M = 'uidAdmin03';
let env;

test.before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-satisfy', database: { rules: RULES } }); });
test.after(async () => { if (env) await env.cleanup(); });
test.beforeEach(async () => {
  await env.clearDatabase();
  // the fixtures, written as the server would hold them (rules off): A and B have account IDs, M is an admin
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().set({
      accountIds: { [A]: 'Ahmed', [B]: 'Bassem', [M]: 'Owner' },
      handles: { ahmed: A, bassem: B, owner: M },
      admins: { [M]: true },
    });
  });
});
// a refusal expected (no) or a write or read that must pass (yes); the message names the step, or its line in this file
async function no(p, why) { try { await assertFails(p); } catch (e) { throw new Error('should be refused: ' + why + ' (' + e.message + ')'); } }
async function yes(p, why) { try { await assertSucceeds(p); } catch (e) { throw new Error('should pass: ' + why + ' (' + e.message + ')'); } }
const db = (uid) => env.authenticatedContext(uid).database();
const anon = () => env.unauthenticatedContext().database();
const presence = (uid, handle, o = {}) => Object.assign({ v: 1, uid, sid: 'sess0123456789ab', handle, look: { hair: 1, hc: 2, skin: 1, top: 3 }, cls: 'novice', lv: 3, zone: 'zWin', x: 2000, y: 1300, dir: 0, anim: 'idle', arm: 0, seq: 1, t: SV }, o);

test('account IDs: yours once, never another account\'s', async () => {
  const c = db('uidCarim04');
  await yes(c.ref('handles/carim').set('uidCarim04'), 'a free ID: the handle first');
  await yes(c.ref('accountIds/uidCarim04').set('Carim'), 'then the account ID that points at it');
  await no(db('uidZed05').ref().update({ 'handles/zed': 'uidZed05', 'accountIds/uidZed05': 'Zed' }), 'both at once: the account ID needs the handle already there');
  await no(db(B).ref('handles/carim').set(B), 'B can\'t take a taken ID');
  await no(db(B).ref('handles/ahmed').remove(), 'nor free A\'s');
  await no(db(B).ref('accountIds/' + A).set('Bassem'), 'nor write A\'s account ID');
  await no(db(A).ref('accountIds/' + A).set('Ahmed2'), 'an ID is not renamed in place');
  await no(db(B).ref().update({ 'handles/zed': B, 'accountIds/uidCarim04': 'Zed' }), 'nor point another account at a new one');
  await no(anon().ref('accountIds/' + A).once('value'), 'signed out reads nothing');
  await yes(db(B).ref('accountIds/' + A).once('value'), 'players read account IDs');
});

test('presence: only your own node, with your own uid and ID, and no field outside the contract', async () => {
  await yes(db(A).ref('presence/satisfy/main/' + A).set(presence(A, 'Ahmed')), 'A writes its own presence');
  await yes(db(B).ref('presence/satisfy/main').once('value'), 'every player reads it');
  await no(db(B).ref('presence/satisfy/main/' + A).set(presence(A, 'Ahmed')), 'B can\'t write A\'s');
  await no(db(B).ref('presence/satisfy/main/' + A).update({ x: 10 }), 'nor move A');
  await no(db(B).ref('presence/satisfy/main/' + B).set(presence(A, 'Ahmed')), 'nor claim A\'s uid in its own');
  await no(db(B).ref('presence/satisfy/main/' + B).set(presence(B, 'Ahmed')), 'nor A\'s account ID');
  await no(db(A).ref('presence/satisfy/main/' + A).update({ gold: 1 }), 'unknown fields are refused');
  await no(db(A).ref('presence/satisfy/main/' + A).update({ anim: 'fly' }), 'only the known animations');
  await no(db(A).ref('presence/satisfy/main/' + A).update({ t: 5 }), 'server time only');
  await no(db(A).ref('presence/satisfy/other/' + A).set(presence(A, 'Ahmed')), 'one shard');
});

test('profile, cloud saves and session: yours only, read and write', async () => {
  const prof = { handle: 'Ahmed', look: { hair: 1, hc: 2, skin: 1, top: 3 }, language: 'ar', titleId: '', classId: 'novice', lv: 3, revision: 1, t: SV };
  await yes(db(A).ref('profiles/' + A).set(prof), 'A writes its own card');
  await no(db(B).ref('profiles/' + A).set(Object.assign({}, prof, { revision: 2, handle: 'Hacked' })), 'B can\'t rewrite A\'s card');
  await no(db(A).ref('profiles/' + A).set(prof), 'an older or equal revision is refused');
  await yes(db(A).ref('cloudSaves/' + A + '/pid_main').set({ blob: '{"lv":3}', rev: 1, t: SV }), 'A saves to its own cloud slot');
  await no(db(B).ref('cloudSaves/' + A + '/pid_main').once('value'), 'B can\'t read A\'s save');
  await no(db(B).ref('cloudSaves/' + A + '/pid_main').set({ blob: '{}', rev: 2, t: SV }), 'nor write it');
  await no(db(B).ref('cloudSaves/' + A).remove(), 'nor delete it');
  await no(db(B).ref('cloudIndex/' + A).once('value'), 'B can\'t list A\'s saves');
  await yes(db(A).ref('sessions/' + A).set({ sid: 'sess0123456789ab', t: SV }), 'A writes its own session');
  await no(db(B).ref('sessions/' + A).set({ sid: 'sessB123456789ab', t: SV }), 'B can\'t take over A\'s session');
  await no(db(B).ref('sessions/' + A).once('value'), 'B can\'t read A\'s session');
});

test('friends and admins: no friend without a request, nobody makes themselves an admin', async () => {
  await no(db(B).ref('friends/' + A + '/' + B).set({ n: 'Bassem', t: SV }), 'B can\'t add itself to A\'s friends unasked');
  await no(db(A).ref('friends/' + A + '/' + B).set({ n: 'Bassem', t: SV }), 'nor A without B\'s request');
  await no(db(B).ref('friends/' + A).once('value'), 'nor read A\'s list');
  await no(db(A).ref('admins/' + A).set(true), 'admins are set in the console only');
  await no(db(M).ref('admins/' + A).set(true), 'by an admin too');
  await no(db(A).ref('admins/' + M).once('value'), 'and read by their own account only');
  await yes(db(M).ref('admins/' + M).once('value'), 'an admin reads its own flag');
});

test('world chat: lines in your own name, removed by nobody while fresh', async () => {
  await yes(db(A).ref('chat/satisfy/l1').set({ from: A, h: 'Ahmed', text: 'hi', t: SV }), 'A speaks as A');
  await no(db(B).ref('chat/satisfy/l2').set({ from: A, h: 'Ahmed', text: 'I am Ahmed', t: SV }), 'B can\'t speak as A');
  await no(db(B).ref('chat/satisfy/l3').set({ from: B, h: 'Ahmed', text: 'hi', t: SV }), 'nor under A\'s ID');
  await no(db(B).ref('chat/satisfy/l1').remove(), 'nor remove A\'s fresh line');
  await no(db(B).ref('chat/satisfy/l1').set({ from: B, h: 'Bassem', text: 'edited', t: SV }), 'nor overwrite it');
  await no(db(A).ref('chat/satisfy/l4').set({ from: A, h: 'Ahmed', text: 'x'.repeat(121), t: SV }), 'at most 120 characters');
});

test('crash reports: anyone signed in sends one, once; only admins read them', async () => {
  await yes(db(B).ref('crashes/c1').set({ m: 'TypeError', s: 'at f', v: '1.41', by: B, t: SV }), 'B sends a crash report');
  await no(db(A).ref('crashes/c2').set({ m: 'TypeError', s: 'at f', v: '1.41', by: B, t: SV }), 'in your own name');
  await no(db(B).ref('crashes/c1').set({ m: 'changed', s: '', v: '1.41', by: B, t: SV }), 'once');
  await no(db(B).ref('crashes').once('value'), 'players don\'t read them');
  await yes(db(M).ref('crashes').once('value'), 'the owner does');
  await no(anon().ref('crashes/c3').set({ m: 'x', s: '', v: '1', by: 'nobody', t: SV }), 'signed out sends none');
});

test('guilds: B, a member, can\'t take A\'s guild, raise its own rank or let itself in', async () => {
  const G = 'g_' + A;
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().update({
      ['guilds/' + G]: { name: 'Dragons', nk: 'dragons', master: A, col: 2, t: 1 },
      'guildNames/dragons': G,
      ['guildMembers/' + G + '/' + A]: { rk: 'm', n: 'Ahmed', c: 0, on: Date.now() },
      ['guildMembers/' + G + '/' + B]: { rk: 'r', n: 'Bassem', c: 0, on: Date.now() },
    });
  });
  await no(db(B).ref('guilds/' + G + '/master').set(B), 'B can\'t make itself master');
  await no(db(B).ref('guilds/' + G).update({ name: 'Mine' }), 'nor rename the guild');
  await no(db(B).ref('guildMembers/' + G + '/' + B + '/rk').set('o'), 'nor raise its rank');
  await no(db(B).ref('guildMembers/' + G + '/' + A).remove(), 'nor remove the master');
  await no(db(M).ref('guildMembers/' + G + '/' + M).set({ rk: 'r', n: 'Owner', c: 0, on: SV }), 'nobody joins without an invitation, an admin neither');
  await no(db(B).ref('guildMembers/' + G).remove(), 'nor disband it');
  await no(db(B).ref().update({ ['guilds/g_' + B]: { name: 'Dragons', nk: 'dragons', master: B, col: 1, t: SV }, 'guildNames/dragons': 'g_' + B }), 'nor take its name');
  await yes(db(B).ref('guildMembers/' + G + '/' + B).remove(), 'B may leave');
});
