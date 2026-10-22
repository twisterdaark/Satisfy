'use strict';
// SAT-ONLINE-116: the game's own online code (src/net/firebase.js transport and src/net/presence.js) between two clients on
// the real Firebase SDK, signed in on the Auth emulator, through the real rules on the Realtime Database emulator. The
// browser tests use tests/harness/fake-firebase.js, which copies the database's behaviour by hand; this checks the real one:
// both see each other, a move arrives as an update, a dropped connection removes the player through onDisconnect and a
// reconnect brings it back, and a party invitation goes through the inbox. CI runs it (.github/workflows/emulator.yml).
const test = require('node:test');
const assert = require('node:assert/strict');
const fbApp = require('firebase/app');
const fbAuth = require('firebase/auth');
const fbDb = require('firebase/database');
const { loadModules } = require('../harness/load-module.cjs');

// the database the emulator started for this project, with the rules firebase.json names (backend/database.rules.json)
const PROJECT = 'demo-satisfy', NS = PROJECT + '-default-rtdb';
// the emulators' addresses as emulators:exec gives them, with localhost as 127.0.0.1 (Node may try ::1 first, where they don't listen)
const v4 = (h) => String(h).replace(/^localhost(?=:)/, '127.0.0.1');
const DBH = v4(process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000'), AUTHH = v4(process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099');
const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/guild.js', 'src/net/firebase-config.js', 'src/net/firebase.js');
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };
const DBURL = 'http://' + DBH + '?ns=' + NS;
const clients = [];

async function until(fn, what, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) { if (await fn()) return; if (Date.now() > end) throw new Error('timed out: ' + what); await new Promise((r) => setTimeout(r, 100)); }
}

// one player: its own app, signed in anonymously on the Auth emulator, its account ID claimed the way the game does (the
// handle first, then the ID that points at it), the game's transport and presence
async function player(name, x) {
  const app = fbApp.initializeApp({ apiKey: 'demo-key', projectId: PROJECT, databaseURL: DBURL }, name);
  const auth = fbAuth.getAuth(app);
  fbAuth.connectAuthEmulator(auth, 'http://' + AUTHH, { disableWarnings: true });
  const db = fbDb.getDatabase(app);
  const [h, p] = DBH.split(':');
  fbDb.connectDatabaseEmulator(db, h, +p);
  const uid = (await fbAuth.signInAnonymously(auth)).user.uid;
  await fbDb.set(fbDb.ref(db, 'handles/' + name.toLowerCase()), uid);
  await fbDb.set(fbDb.ref(db, 'accountIds/' + uid), name);
  const c = { name, uid, app, db, x, y: 1300, events: [] };
  c.errs = [];
  c.tr = SN.firebase.transport({ m: { database: fbDb }, db }, { uid, world: WORLD.id, shard: 'main', interest: { radius: 800, step: 400 }, onError: (e) => c.errs.push(String(e && (e.code || e.message) || e)) });
  c.pres = SN.presence.create({ transport: c.tr, uid, world: WORLD, net: SN.net, now: () => Date.now(), config: { moveHz: 5, idleHz: 0.2, expireMs: 30000 } });
  c.pres.on((e) => c.events.push(e));
  c.pp = () => SN.net.toPlayerPublic({ look: { n: name, hair: 1, hc: 2, skin: 1, top: 3 }, cls: 'novice', lv: 3, title: '' }, { x: c.x, y: c.y, dir: 0 }, { zone: 'zWin', uid, sid: c.pres.sid, handle: name, anim: 'idle' });
  c.publish = (force) => c.pres.publish(c.pp(), force);
  c.sees = (o) => c.pres.remotes().find((r) => r.uid === o.uid) || null;
  clients.push(c);
  return c;
}

test.after(async () => {
  for (const c of clients) { try { c.pres.close(); } catch (e) { /* closing */ } try { fbDb.goOffline(c.db); await fbApp.deleteApp(c.app); } catch (e) { /* closing */ } }
});

test('the emulators answer', { timeout: 20000 }, async () => {
  const r = await fetch('http://' + AUTHH + '/', { method: 'GET' }).then((x) => x.status, (e) => 'unreachable: ' + e.message);
  assert.notEqual(String(r).slice(0, 11), 'unreachable', 'the Auth emulator at ' + AUTHH + ' (env ' + process.env.FIREBASE_AUTH_EMULATOR_HOST + '): ' + r);
});

test('two clients on the real SDK and rules: presence, a move, a dropped connection and back, a party invitation', { timeout: 90000 }, async () => {
  const a = await player('Ahmed', 2000), b = await player('Bassem', 2030);
  // what this client may do as itself: a read any signed-in player may do, its own session, and what the fixtures hold
  const probe = async (c) => {
    const r = await fbDb.get(fbDb.ref(c.db, 'accountIds/' + c.uid)).then((x) => 'read ' + JSON.stringify(x.val()), (e) => 'read ' + (e.code || e.message));
    const w = await fbDb.set(fbDb.ref(c.db, 'sessions/' + c.uid), { sid: c.pres.sid, t: fbDb.serverTimestamp() }).then(() => 'write ok', (e) => 'write ' + (e.code || e.message));
    return c.name + ' (' + c.uid + ', signed in: ' + !!fbAuth.getAuth(c.app).currentUser + '): ' + r + ', ' + w;
  };
  const probes = [await probe(a), await probe(b)];
  a.publish(true); b.publish(true);
  await until(() => a.sees(b) && b.sees(a), 'each sees the other').catch(async (e) => {
    const pres = await fbDb.get(fbDb.ref(a.db, 'presence/satisfy/main')).then((x) => x.val(), (e) => e.code || e.message);
    throw new Error(e.message + ' · ' + probes.join(' · ') + ' · db ' + DBURL + ' · errors A ' + JSON.stringify(a.errs) + ' B ' + JSON.stringify(b.errs) + ' · stored ' + String(JSON.stringify(pres)).slice(0, 600) + ' · events B ' + JSON.stringify(b.events.map((x) => x.type)).slice(0, 200));
  });
  assert.equal(b.sees(a).handle, 'Ahmed');

  // a move goes out as an update of the changed fields and arrives
  a.x = 2100; a.publish(true);
  await until(() => { const r = b.sees(a); return r && r.x === 2100; }, 'the move arrives');

  // the connection drops: the server runs onDisconnect and the other side sees the player go; then it comes back
  fbDb.goOffline(a.db);
  await until(() => !b.sees(a), 'gone for the other side when the connection drops');
  fbDb.goOnline(a.db);
  await until(async () => { a.publish(true); return !!b.sees(a); }, 'back after the reconnect');
  assert.equal(b.sees(a).x, 2100, 'where it was');

  // a party invitation through the inbox, from a session the other side knows
  a.pres.send('party.invite', { to: b.uid, party: 'p_' + a.uid });
  await until(() => b.events.some((e) => e.type === 'message' && e.env.type === 'party.invite' && e.env.payload.to === b.uid), 'the invitation arrives');
  await until(async () => (await fbDb.get(fbDb.ref(b.db, 'inbox/' + b.uid))).val() === null, 'the inbox is empty again');
  const inbox = (await fbDb.get(fbDb.ref(b.db, 'inbox/' + b.uid))).val();
  assert.equal(inbox, null, 'read and removed by its recipient');
});

test('a guild on the real SDK and rules: found, invite, join, deposit and take once, a member can not take, leave, disband', { timeout: 90000 }, async () => {
  const a = clients.find((c) => c.name === 'Ahmed') || await player('Ahmed', 2000);
  const b = clients.find((c) => c.name === 'Bassem') || await player('Bassem', 2030);
  const mk = (c) => {
    const store = SN.firebase.guildStore({ m: { database: fbDb }, db: c.db });
    const g = SN.guild.create({ store, uid: c.uid, handle: () => c.name, now: () => Date.now(), serverNow: () => Date.now() });
    g.start(null);
    return g;
  };
  const ga = mk(a), gb = mk(b);
  const gid = await ga.found('Dragons ' + String(Date.now() % 1e6), SN.guild.C.COLORS[0]);
  await until(() => ga.state().rank === 'm' && ga.state().guild, 'A is the master');
  await ga.invite(b.uid, 'Bassem');
  await until(() => gb.state().invites.some((x) => x.gid === gid), 'B sees the invitation');
  await gb.accept(gid);
  await until(() => gb.state().rank === 'r' && ga.state().members[b.uid], 'B is a member, and A sees it');
  // a deposit by A; B, a member, can't take it; A takes it once
  const vid = await ga.deposit({ k: 'ore', n: 3, r: 0 });
  await until(() => !!gb.vault()[vid], 'B sees the deposit');
  await assert.rejects(gb.withdraw(vid), /rank/, 'a member does not take what is not its own');
  await assert.rejects(fbDb.remove(fbDb.ref(b.db, 'guildVault/' + gid + '/' + vid)), /PERMISSION/i, 'nor by writing');
  const got = await ga.withdraw(vid);
  assert.equal(got.k, 'ore');
  await assert.rejects(ga.withdraw(vid), /./, 'once');
  // B leaves; A disbands, and nothing of the guild is left
  await gb.leave();
  await until(() => !ga.state().members[b.uid], 'A sees B go');
  await ga.disband();
  await until(async () => (await fbDb.get(fbDb.ref(b.db, 'guilds/' + gid))).val() === null, 'the guild is gone');
  ga.stop(); gb.stop();
});
