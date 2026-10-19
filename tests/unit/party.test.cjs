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
        { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.party.id() });
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
    for (const p of players()) p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: 2024, y: 1354, dir: 0 }, { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.party.id() }), true);
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
