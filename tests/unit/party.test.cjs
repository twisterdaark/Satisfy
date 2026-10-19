'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/party.js');
const WORLD = { id: 'satisfy', tile: 16, w: 160, h: 144 };

function world(n) {
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + i;
    const pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    const party = SN.party.create({ presence: pres, uid, now });
    const events = [];
    party.on((e) => events.push(e.type));
    players.push({ uid, pres, party, events, name: 'P' + i });
  }
  const sync = () => {
    for (const p of players) {
      const pp = SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: 2024, y: 1354, dir: 0 },
        { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.party.id(), rs: p.party.roster() });
      p.pres.publish(pp, true);
    }
    for (const p of players) { p.pres.tick(); p.party.tick(); }
  };
  const advance = (ms) => { t += ms; sync(); };
  sync();
  return { players, sync, advance, remote: (from, to) => from.pres.remotes().find((r) => r.uid === to.uid) };
}

test('invite → accept: both end up in the leader\'s party and see each other as members', () => {
  const w = world(2), [a, b] = w.players;
  assert.equal(a.party.invite(w.remote(a, b)), 'sent');
  assert.equal(a.party.id(), 'p_u0');
  const inv = b.party.pendingInvite();
  assert.equal(inv.handle, 'P0');
  assert.equal(b.party.accept(inv.party), true);
  w.sync();
  assert.deepEqual(a.party.members().map((m) => m.uid), ['u0', 'u1']);
  assert.deepEqual(b.party.members().map((m) => [m.uid, m.leader]), [['u1', false], ['u0', true]]);
  assert.ok(a.events.includes('joined'));
  assert.ok(b.events.includes('youJoined'));
  assert.equal(w.remote(a, b).party, 'p_u0', 'membership travels in presence');
});

test('decline and invite expiry', () => {
  const w = world(3), [a, b, c] = w.players;
  a.party.invite(w.remote(a, b));
  b.party.decline(b.party.pendingInvite().party);
  assert.ok(a.events.includes('declined'));
  w.sync();
  assert.equal(a.party.id(), null, 'a party with nobody invited or accepted dissolves');
  a.party.invite(w.remote(a, c));
  w.advance(SN.party.INVITE_MS + 10);
  assert.equal(c.party.pendingInvite(), null);
  assert.equal(c.party.accept('p_u0'), false);
});

test('only the leader invites; a member cannot pull others into the party', () => {
  const w = world(3), [a, b, c] = w.players;
  a.party.invite(w.remote(a, b)); b.party.accept('p_u0'); w.sync();
  assert.equal(b.party.invite(w.remote(b, c)), 'notLeader');
  // a forged invite naming someone else's party is ignored
  b.pres.send('party.invite', { to: 'u2', party: 'p_u0' });
  assert.equal(c.party.pendingInvite(), null);
});

test('an accept without an invite is ignored; party size is capped at 5', () => {
  const w = world(7), [a, ...rest] = w.players;
  rest[0].pres.send('party.accept', { to: 'u0', party: 'p_u0' });
  assert.equal(a.party.id(), null);
  for (const p of rest.slice(0, 4)) { a.party.invite(w.remote(a, p)); p.party.accept('p_u0'); }
  w.sync();
  assert.equal(a.party.members().length, 5);
  assert.equal(a.party.invite(w.remote(a, rest[4])), 'full');
});

test('a player already in a party auto-declines other invites', () => {
  const w = world(3), [a, b, c] = w.players;
  a.party.invite(w.remote(a, b)); b.party.accept('p_u0'); w.sync();
  assert.equal(c.party.invite(w.remote(c, b)), 'busy', 'b shows a party in presence');
});

test('kick and leave', () => {
  const w = world(3), [a, b, c] = w.players;
  a.party.invite(w.remote(a, b)); b.party.accept('p_u0');
  a.party.invite(w.remote(a, c)); c.party.accept('p_u0');
  w.sync();
  assert.equal(a.party.kick('u1'), true);
  assert.equal(b.party.id(), null);
  assert.ok(b.events.includes('kicked'));
  c.pres.send('party.kick', { to: 'u1', party: 'p_u0' }); // a non-leader kick is ignored
  c.party.leave(); w.sync();
  w.advance(SN.party.GRACE_MS + 10);
  assert.ok(a.events.includes('memberLeft'));
  assert.equal(a.party.id(), null, 'leader alone again: party dissolved');
});

test('members follow the leader: party dissolves when the leader disappears', () => {
  const w = world(2), [a, b] = w.players;
  a.party.invite(w.remote(a, b)); b.party.accept('p_u0'); w.sync();
  a.pres.close();
  w.players.splice(0, 1);
  w.advance(SN.party.GRACE_MS + 10);
  assert.equal(b.party.id(), null);
  assert.ok(b.events.includes('dissolved'));
});

test('messages addressed to someone else are ignored', () => {
  const w = world(3), [a, b, c] = w.players;
  a.party.invite(w.remote(a, b));
  assert.equal(c.party.pendingInvite(), null);
  assert.ok(b.party.pendingInvite());
});

test('SAT-ONLINE-021 pings: members only, at most one per member every PING_MS, sane coordinates', () => {
  const w = world(3), [a, b, c] = w.players;
  const pings = (p) => { const out = []; p.party.on((e) => { if (e.type === 'ping') out.push(e); }); return out; };
  const pa = pings(a), pb = pings(b), pc = pings(c);
  assert.equal(a.party.ping(10, 10), 'noParty');
  a.party.invite(w.remote(a, b)); b.party.accept('p_u0'); w.sync();
  assert.equal(a.party.ping(2100, 1300), 'sent');
  assert.deepEqual(pb.map((e) => [e.uid, e.handle, e.x, e.y, e.self]), [['u0', 'P0', 2100, 1300, false]]);
  assert.deepEqual(pa.map((e) => e.self), [true], 'the pinger sees its own ping');
  assert.deepEqual(pc, [], 'not in the party');
  assert.equal(a.party.ping(2100, 1300), 'tooFast');
  w.advance(SN.party.PING_MS);
  // a forged ping from outside the party, a flood from a member, and nonsense coordinates are dropped
  c.pres.send('party.ping', { to: 'u1', party: 'p_u0', k: 5, n: 5 });
  b.pres.send('party.ping', { to: 'u0', party: 'p_u0', k: 7, n: 7 });
  b.pres.send('party.ping', { to: 'u0', party: 'p_u0', k: 8, n: 8 });
  b.pres.send('party.ping', { to: 'u0', party: 'p_u0', k: -1, n: 99999 });
  assert.deepEqual(pb.length, 1);
  assert.deepEqual(pa.filter((e) => !e.self).map((e) => [e.x, e.y]), [[7, 7]]);
});

test('SAT-ONLINE-021 members() carries the public HP %', () => {
  const w = world(2), [a, b] = w.players;
  a.party.invite(w.remote(a, b)); b.party.accept('p_u0'); w.sync();
  const m = a.party.members().find((x) => x.uid === 'u1');
  assert.ok('hp' in m);
  assert.equal(m.hp, null, 'this test world publishes no hp');
});

// SAT-ONLINE-023: a party survives a reload. Each player gets a Storage-like store (the tab's sessionStorage);
// "reloading" = closing the presence and creating a new client with the same uid and store.
function store() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; }

test('SAT-ONLINE-023 rejoin: a member who reloads is invited back and accepts by itself', () => {
  let clock = 1e12; const wall = () => clock;
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const mk = (uid, st, i) => {
    const pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + uid + i + 'xxxxxxxx' });
    const party = SN.party.create({ presence: pres, uid, now, store: st, wall });
    const events = []; party.on((e) => events.push(e.type));
    return { uid, pres, party, events, name: uid === 'u0' ? 'Lead' : 'Mem' };
  };
  const sa = store(), sb = store();
  let a = mk('u0', sa, 0), b = mk('u1', sb, 0);
  const players = () => [a, b];
  const sync = () => {
    for (const p of players()) p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: 2024, y: 1354, dir: 0 }, { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.party.id(), rs: p.party.roster() }), true);
    for (const p of players()) { p.pres.tick(); p.party.tick(); }
  };
  const advance = (ms) => { for (let k = 0; k < ms; k += 100) { t += 100; clock += 100; sync(); } };
  sync();
  assert.equal(a.party.invite(a.pres.remotes().find((r) => r.uid === 'u1')), 'sent');
  b.party.accept('p_u0'); advance(300);
  assert.equal(a.party.members().length, 2);
  assert.equal(JSON.parse(sb.getItem(SN.party.KEY)).id, 'p_u0', 'the member keeps its party in the tab store');
  advance(SN.party.REJOIN_MS + 5000); // a long session first: the stored time keeps up, so the reload still counts
  assert.ok(clock - JSON.parse(sb.getItem(SN.party.KEY)).t < 6000);

  // B reloads: new presence session, same uid and store
  b.pres.close(); b = mk('u1', sb, 1); advance(300);
  assert.equal(b.party.id(), null, 'a fresh page starts outside the party');
  advance(SN.party.GRACE_MS + 500); // the leader notices B's old session gone, then invites B back
  assert.equal(b.party.id(), 'p_u0', 'B accepted by itself');
  assert.ok(b.events.includes('rejoined'));
  assert.equal(b.party.pendingInvite(), null, 'no prompt');
  advance(300);
  assert.deepEqual(a.party.members().map((m) => m.uid), ['u0', 'u1']);

  // the leader reloads: it restores its party and B is still in it
  a.pres.close(); a = mk('u0', sa, 2); advance(300);
  assert.equal(a.party.id(), 'p_u0');
  advance(SN.party.GRACE_MS + 500);
  assert.equal(b.party.id(), 'p_u0');
  assert.deepEqual(a.party.members().map((m) => m.uid), ['u0', 'u1']);

  // B leaves on purpose: the leader drops B at once and does not invite it back
  b.party.leave(); advance(300);
  assert.equal(sb.getItem(SN.party.KEY), null, 'forgotten');
  assert.ok(a.events.includes('memberLeft'));
  advance(SN.party.GRACE_MS + 2000);
  assert.equal(b.party.pendingInvite(), null);
  assert.equal(b.party.id(), null);
});

test('SAT-ONLINE-023 rejoin expires: after REJOIN_MS a reload starts clean', () => {
  let clock = 1e12; const wall = () => clock;
  const st = store();
  st.setItem(SN.party.KEY, JSON.stringify({ id: 'p_u0', leader: 'u0', members: ['u1'], t: clock - SN.party.REJOIN_MS - 1 }));
  const hub = SN.transports.hub();
  const pres = SN.presence.create({ transport: hub.connect(), now: () => 1, world: WORLD, net: SN.net, uid: 'u0', sid: 'sessu0xxxxxxxx' });
  const party = SN.party.create({ presence: pres, uid: 'u0', now: () => 1, store: st, wall });
  assert.equal(party.id(), null);
  assert.equal(st.getItem(SN.party.KEY), null);
  // a store entry claiming someone else's leadership is not taken as ours
  st.setItem(SN.party.KEY, JSON.stringify({ id: 'p_u9', leader: 'u0', members: [], t: clock }));
  assert.equal(SN.party.create({ presence: pres, uid: 'u0', now: () => 1, store: st, wall }).id(), null);
});

test('SAT-ONLINE-024 leader election: the remaining members agree on the lowest uid; the old leader rejoins', () => {
  let clock = 1e12; const wall = () => clock;
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const stores = { u0: store(), u1: store(), u2: store() };
  const live = {};
  const mk = (uid, i) => {
    const pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + uid + i + 'xxxxxxxx' });
    const party = SN.party.create({ presence: pres, uid, now, store: stores[uid], wall });
    const events = []; party.on((e) => events.push(e.type + (e.self ? ':me' : '')));
    live[uid] = { uid, pres, party, events };
    return live[uid];
  };
  const sync = () => {
    for (const p of Object.values(live)) p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.uid }, cls: 'novice', lv: 2, title: '' }, { x: 2024, y: 1354, dir: 0 }, { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.party.id(), rs: p.party.roster() }), true);
    for (const p of Object.values(live)) { p.pres.tick(); p.party.tick(); }
  };
  const advance = (ms) => { for (let k = 0; k < ms; k += 100) { t += 100; clock += 100; sync(); } };
  const a = mk('u0', 0), b = mk('u1', 0), c = mk('u2', 0);
  sync();
  for (const m of [b, c]) { a.party.invite(a.pres.remotes().find((r) => r.uid === m.uid)); m.party.accept('p_u0'); }
  advance(300);
  assert.equal(a.party.members().length, 3);

  // the leader vanishes (closed tab, crash): members wait out a reload, then elect u1
  a.pres.close(); delete live.u0;
  advance(SN.party.GRACE_MS + 500);
  assert.equal(b.party.id(), 'p_u0', 'still waiting for the leader (it may be reloading)');
  advance(SN.party.LEAD_MS);
  assert.equal(b.party.id(), 'p_u1');
  assert.equal(c.party.id(), 'p_u1', 'both picked the same leader');
  assert.equal(b.party.isLeader(), true);
  assert.equal(c.party.leader(), 'u1');
  assert.ok(b.events.includes('newLeader:me'));
  assert.ok(c.events.includes('newLeader'));
  advance(300);
  assert.deepEqual(b.party.members().map((m) => m.uid), ['u1', 'u2']);
  assert.deepEqual(c.party.members().map((m) => [m.uid, m.leader]), [['u2', false], ['u1', true]]);

  // the old leader comes back: it sees its members in u1's party, drops its own and is invited back in
  const a2 = mk('u0', 1);
  advance(300);
  advance(2000);
  assert.ok(a2.events.includes('replaced'));
  assert.equal(a2.party.id(), 'p_u1');
  assert.equal(a2.party.leader(), 'u1');
  advance(300);
  assert.deepEqual(b.party.members().map((m) => m.uid).sort(), ['u0', 'u1', 'u2']);
});

test('SAT-ONLINE-024: a member left alone still dissolves after GRACE_MS', () => {
  const w = world(2), [a, b] = w.players;
  a.party.invite(w.remote(a, b)); b.party.accept('p_u0'); w.sync();
  a.pres.close(); w.players.splice(0, 1);
  w.advance(SN.party.GRACE_MS + 10);
  assert.equal(b.party.id(), null);
});

test('SAT-ONLINE-024: members whose clocks differ still agree (one elects first and moves; the other follows)', () => {
  const hub = SN.transports.hub();
  const clocks = { u1: 1000, u2: 1000, u0: 1000 };
  const mk = (uid) => {
    const now = () => clocks[uid];
    const pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + uid + 'xxxxxxxx' });
    return { uid, pres, now, party: SN.party.create({ presence: pres, uid, now }) };
  };
  const all = { u0: mk('u0'), u1: mk('u1'), u2: mk('u2') };
  const pub = (p) => p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.uid }, cls: 'novice', lv: 2, title: '' }, { x: 2024, y: 1354, dir: 0 }, { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.party.id(), rs: p.party.roster() }), true);
  const step = (uids, ms) => { for (let k = 0; k < ms; k += 100) { for (const u of uids) { clocks[u] += 100; pub(all[u]); } for (const u of uids) { all[u].pres.tick(); all[u].party.tick(); } } };
  step(['u0', 'u1', 'u2'], 300);
  const [a, b, c] = [all.u0, all.u1, all.u2];
  for (const m of [b, c]) { a.party.invite(a.pres.remotes().find((r) => r.uid === m.uid)); m.party.accept('p_u0'); }
  step(['u0', 'u1', 'u2'], 500);
  a.pres.close(); delete all.u0;
  clocks.u2 += 3000;                           // u2's clock runs 3 s ahead, so it elects first
  let first = null;
  for (let k = 0; k < SN.party.LEAD_MS + 2000; k += 100) {
    step(['u1', 'u2'], 100);
    if (!first && c.party.id() === 'p_u1') { first = b.party.id(); }
  }
  assert.equal(first, 'p_u0', 'u2 moved while u1 was still waiting for the old leader');
  assert.equal(c.party.id(), 'p_u1');
  assert.equal(b.party.id(), 'p_u1', 'u1 followed instead of dissolving');
  assert.equal(b.party.isLeader(), true);
  step(['u1', 'u2'], 1000);
  assert.deepEqual(b.party.members().map((m) => m.uid), ['u1', 'u2']);
  assert.equal(c.party.leader(), 'u1');
});

// review fix (#55)
test('election: only the leader\'s roster votes; a stranger who claims the party id neither votes nor wins', () => {
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const live = {};
  const mk = (uid) => {
    const pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + uid + 'xxxxxxxx' });
    return (live[uid] = { uid, pres, party: SN.party.create({ presence: pres, uid, now }), fake: null });
  };
  const sync = () => {
    for (const p of Object.values(live)) p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.uid }, cls: 'novice', lv: 2, title: '' }, { x: 2024, y: 1354, dir: 0 }, { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.fake || p.party.id(), rs: p.party.roster() }), true);
    for (const p of Object.values(live)) { p.pres.tick(); p.party.tick(); }
  };
  const advance = (ms) => { for (let k = 0; k < ms; k += 100) { t += 100; sync(); } };
  const lead = mk('u5'), b = mk('u7'), c = mk('u8'), x = mk('u1');
  sync();
  for (const m of [b, c]) { lead.party.invite(lead.pres.remotes().find((r) => r.uid === m.uid)); m.party.accept('p_u5'); }
  advance(300);
  assert.equal(lead.party.roster(), 'u7 u8');
  assert.deepEqual(b.party.follow(), ['p_u5', 'p_u7', 'p_u8'], 'a member follows every id the party could move to');
  x.fake = 'p_u5'; // the stranger writes the party id into its own presence
  advance(300);
  lead.pres.close(); delete live.u5;
  advance(SN.party.LEAD_MS + 3000);
  assert.equal(b.party.id(), 'p_u7', 'u7 leads, not the stranger u1 (its uid sorts lower)');
  assert.equal(c.party.id(), 'p_u7');
  assert.equal(c.party.leader(), 'u7');
  assert.equal(b.party.roster(), 'u8');
});

test('election: a mate out of sight for a moment still counts', () => {
  const w = world(3), [a, b, c] = w.players;
  for (const m of [b, c]) { a.party.invite(w.remote(a, m)); m.party.accept('p_u0'); }
  w.sync(); w.sync();
  a.pres.close(); w.players.splice(0, 1);
  const hide = w.players.indexOf(c);
  w.players.splice(hide, 1);                      // c's presence stops for a while (a blip)
  for (let k = 0; k < 60; k++) w.advance(100);    // 6 s: past GRACE_MS, alone as far as b can see
  assert.equal(b.party.id(), 'p_u0', 'b does not dissolve while c may come back');
  w.players.push(c);
  for (let k = 0; k < (SN.party.LEAD_MS / 100) + 20; k++) w.advance(100);
  assert.equal(b.party.id(), 'p_u1');
  assert.equal(c.party.id(), 'p_u1');
});

// SAT-ONLINE-033 (owner feedback #14): a party that broke while its leader was only out of sight (a covered or
// minimised window) needs a fresh Y; only a real reload is rejoined by itself. Toasts keep the name of who left.
test('owner #14: a break without a reload is answered with Y; a leader reload is rejoined by itself', () => {
  let clock = 1e12; const wall = () => clock;
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const sa = store(), sb = store();
  const mk = (uid, st, i, name) => {
    const pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + uid + i + 'xxxxxxxx' });
    const party = SN.party.create({ presence: pres, uid, now, store: st, wall });
    const events = []; party.on((e) => events.push(e));
    return { uid, pres, party, events, name, quiet: false };
  };
  let a = mk('u0', sa, 0, 'Lead'), b = mk('u1', sb, 0, 'Mem');
  const sync = () => {
    for (const p of [a, b]) if (!p.quiet) p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: 2024, y: 1354, dir: 0 }, { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.party.id(), rs: p.party.roster() }), true);
    for (const p of [a, b]) { p.pres.tick(); if (!p.quiet) p.party.tick(); }
  };
  const advance = (ms) => { for (let k = 0; k < ms; k += 100) { t += 100; clock += 100; sync(); } };
  sync();
  a.party.invite(a.pres.remotes().find((r) => r.uid === 'u1')); b.party.accept('p_u0'); advance(300);
  // the leader's window is covered: it stops publishing (and ticking) for a while, same session
  a.quiet = true;
  advance(SN.presence.DEFAULTS.expireMs + SN.party.GRACE_MS + 500);
  assert.equal(b.party.id(), null, 'the member gave up on the leader');
  a.quiet = false;
  advance(SN.party.GRACE_MS + 1000); // the leader notices, and invites the member back
  const types = b.events.map((e) => e.type);
  assert.ok(types.includes('invite'), 'a normal invite: ' + types);
  assert.ok(!types.includes('rejoined'), 'not accepted by itself');
  assert.equal(b.party.id(), null);
  const left = a.events.find((e) => e.type === 'memberLeft');
  assert.equal(left && left.handle, 'Mem', 'the toast still has the name');
  // answer with Y
  assert.equal(b.party.accept('p_u0'), true); advance(300);
  assert.equal(a.party.members().length, 2);

  // the leader reloads for real, slowly (the member gives up first); the new session's invite is taken by itself
  const old = a; a.pres.close(); a.quiet = true;
  advance(SN.party.GRACE_MS + 500);
  assert.equal(b.party.id(), null);
  a = mk('u0', sa, 1, 'Lead'); assert.notEqual(a.pres.sid, old.pres.sid);
  advance(2000);
  assert.equal(b.party.id(), 'p_u0');
  assert.ok(b.events.some((e) => e.type === 'rejoined'));
});

// SAT-ONLINE-037 (owner 2026-10-19): the leader kicks a member; the member gets a notice naming the leader and is never
// rejoined to that party by itself (no rejoin memo, no invite back from the leader's rejoin logic). A leader who leaves
// is not a kick.
function kickWorld(n = 3) {
  let clock = 1e12; const wall = () => clock;
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const ps = ['u0', 'u1', 'u2'].map((uid, i) => {
    const st = store(), pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + uid + 'xxxxxxxx' });
    const party = SN.party.create({ presence: pres, uid, now, store: st, wall });
    const events = []; party.on((e) => events.push(e));
    return { uid, pres, party, events, st, name: ['Lead', 'Eslam', 'Mona'][i], quiet: false };
  });
  const pub = (p) => p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: 2024, y: 1354, dir: 0 }, { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.party.id(), rs: p.party.roster() }), true);
  const sync = () => {
    for (const p of ps) if (!p.quiet) pub(p);
    for (const p of ps) { p.pres.tick(); if (!p.quiet) p.party.tick(); }
  };
  const advance = (ms) => { for (let k = 0; k < ms; k += 100) { t += 100; clock += 100; sync(); } };
  sync();
  const [a, b, c] = ps;
  for (const m of [b, c].slice(0, n - 1)) { a.party.invite(a.pres.remotes().find((r) => r.uid === m.uid)); m.party.accept('p_u0'); }
  advance(300);
  for (const p of ps) p.events.length = 0;
  return { ps, a, b, c, sync, advance, pub };
}

test('kick: the member is told who removed them, the leader stops counting them, and a new invite needs Y', () => {
  const { a, b, c, advance } = kickWorld();
  assert.equal(a.party.members().length, 3);
  assert.ok(b.st.m.has(SN.party.KEY), 'the member keeps a rejoin memo while in the party');
  assert.equal(b.party.kick('u2'), false, 'only the leader kicks');
  assert.equal(a.party.kick('u1'), true);
  advance(300);
  assert.equal(b.party.id(), null);
  const k = b.events.find((e) => e.type === 'kicked');
  assert.equal(k && k.handle, 'Lead');
  assert.ok(!b.st.m.has(SN.party.KEY), 'the rejoin memo is gone');
  assert.deepEqual(a.party.members().map((m) => m.uid), ['u0', 'u2']);
  assert.equal(a.party.roster(), 'u2', 'not in the electorate any more');
  assert.equal(c.party.id(), 'p_u0', 'the others stay');
  advance(SN.party.GRACE_MS + 2000);
  assert.ok(!b.events.some((e) => e.type === 'invite'), 'the leader does not invite them back by itself');
  // a fresh invite from the leader is a normal one
  a.party.invite(a.pres.remotes().find((r) => r.uid === 'u1'));
  advance(200);
  assert.ok(b.events.some((e) => e.type === 'invite'));
  assert.ok(!b.events.some((e) => e.type === 'rejoined'));
  assert.equal(b.party.id(), null, 'needs Y');
});

test('kick while the member had lost sight of the leader: the memo goes, so the next invite still needs Y', () => {
  const { a, b, advance, pub } = kickWorld(2);
  a.quiet = true; // the leader's window is covered: the member gives up and keeps a memo to take the leader's invite back
  advance(SN.presence.DEFAULTS.expireMs + SN.party.GRACE_MS + 500);
  assert.equal(b.party.id(), null);
  assert.ok(b.events.some((e) => e.type === 'dissolved'));
  // the leader is back and kicks before its own tick has noticed anything (the member is still in its list)
  a.quiet = false; pub(a); b.pres.tick();
  assert.equal(a.party.kick('u1'), true, 'the leader still has them');
  advance(300);
  assert.ok(b.events.some((e) => e.type === 'kicked'));
  assert.ok(!b.st.m.has(SN.party.KEY));
  a.party.invite(a.pres.remotes().find((r) => r.uid === 'u1'));
  advance(300);
  assert.ok(!b.events.some((e) => e.type === 'rejoined'), 'not back by itself');
  assert.equal(b.party.id(), null);
});

test('a leader who leaves is not a kick: the members are told the party broke up', () => {
  const { a, b, c, advance } = kickWorld();
  a.party.leave();
  advance(300);
  for (const m of [b, c]) {
    assert.equal(m.party.id(), null);
    assert.ok(!m.events.some((e) => e.type === 'kicked'));
    const e = m.events.find((x) => x.type === 'leaderLeft');
    assert.equal(e && e.handle, 'Lead');
  }
});
