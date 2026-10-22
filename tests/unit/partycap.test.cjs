'use strict';
// SAT-ONLINE-126 (plan U048, "party accept: a transaction on the members and the cap; the party never passes its cap under
// simultaneous accepts"). The leader alone decides who is in, one accept at a time: invites count against the cap, every
// accept at once still gives a party of 5 (a raid of 10), forged and duplicate accepts change nothing, and an accept the
// leader can't take (its side of the invite ran out first, or the party is gone) is answered at once, so that player is
// not left believing it joined.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/party.js');
const WORLD = { id: 'satisfy', tile: 16, w: 160, h: 144 };

function world(n) {
  const hub = SN.transports.hub();
  const T = { t: 1000 }, now = () => T.t;
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + String(i).padStart(2, '0');
    const pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    const party = SN.party.create({ presence: pres, uid, now });
    const events = [];
    party.on((e) => events.push(e.type));
    players.push({ uid, pres, party, events, name: 'P' + i });
  }
  const pub = (p) => p.pres.publish(SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: 2024, y: 1354, dir: 0 },
    { zone: 'zWin', uid: p.uid, sid: p.pres.sid, party: p.party.id(), rs: p.party.roster(), rd: p.party.isLeader() && p.party.isRaid() }), true);
  // only: tick just these players (the others' messages wait until their own tick)
  const sync = (only) => { for (const p of players) pub(p); for (const p of (only || players)) { p.pres.tick(); p.party.tick(); } };
  sync();
  return { T, players, sync, advance: (ms) => { T.t += ms; sync(); }, remote: (from, to) => from.pres.remotes().find((r) => r.uid === to.uid) };
}
const inParty = (p, pid) => p.party.id() === pid;

test('everyone accepting at once: the party stops at 5; invites past the cap are refused; forged accepts change nothing', () => {
  const w = world(9), [a, ...rest] = w.players, pid = 'p_' + a.uid;
  assert.deepEqual(rest.map((p) => a.party.invite(w.remote(a, p))), ['sent', 'sent', 'sent', 'sent', 'full', 'full', 'full', 'full'], 'an invite out counts against the cap');
  // the four invited and four who weren't all "accept" in the same moment
  for (const p of rest.slice(0, 4)) assert.equal(p.party.accept(pid), true);
  for (const p of rest.slice(4)) p.pres.send('party.accept', { to: a.uid, party: pid });
  for (const p of rest.slice(0, 4)) p.pres.send('party.accept', { to: a.uid, party: pid }); // and a duplicate of each
  w.sync(); w.advance(1000); w.advance(1000);
  assert.equal(a.party.members().length, 5);
  assert.deepEqual(rest.map((p) => inParty(p, pid)), [true, true, true, true, false, false, false, false]);
  assert.deepEqual(rest.slice(0, 4).map((p) => p.party.members().length), [5, 5, 5, 5], 'every member sees the same five');
  assert.ok(rest.slice(4).every((p) => p.events.length === 0), 'nothing happens to the forgers');
  assert.equal(a.events.filter((e) => e === 'joined').length, 4, 'each joins once');
  assert.equal(a.party.invite(w.remote(a, rest[4])), 'full');
});

test('a raid: twelve at once, it stops at 10', () => {
  const w = world(13), [a, ...rest] = w.players, pid = 'p_' + a.uid;
  a.party.invite(w.remote(a, rest[0])); rest[0].party.accept(pid); w.sync();
  assert.equal(a.party.setRaid(true), 'ok');
  const sent = rest.slice(1).map((p) => a.party.invite(w.remote(a, p)));
  assert.equal(sent.filter((x) => x === 'sent').length, 8, 'nine others fit with the leader');
  for (const p of rest.slice(1)) if (p.party.pendingInvite()) p.party.accept(pid); else p.pres.send('party.accept', { to: a.uid, party: pid });
  w.sync(); w.advance(1000); w.advance(1000);
  assert.equal(a.party.members().length, SN.party.RAID_MAX);
  assert.equal(rest.filter((p) => inParty(p, pid)).length, SN.party.RAID_MAX - 1);
  assert.equal(a.party.setRaid(false), 'big', 'too many to be a party again');
});

test('an accept the leader can no longer take is answered at once: that player is not left in a party of one', () => {
  const w = world(3), [a, b, c] = w.players, pid = 'p_' + a.uid;
  a.party.invite(w.remote(a, b)); a.party.invite(w.remote(a, c));
  w.sync();
  // the leader's side of the invites runs out first (it sent them a moment before they arrived); then B accepts
  w.T.t += SN.party.INVITE_MS + 1; w.sync([a]);
  assert.ok(b.party.pendingInvite(), "B's copy hasn't run out yet");
  assert.equal(b.party.accept(pid), true);
  w.sync(); w.sync();
  assert.equal(b.party.id(), null, 'B is told it did not get in');
  assert.ok(b.events.includes('notJoined'));
  assert.ok(!b.events.includes('dissolved') && !b.events.includes('leaderLeft'));
  assert.equal(a.party.members().length, 0, 'the leader has no party: nobody accepted in time');
  // the same while the leader's party is alive and full of others
  const w2 = world(7), [l, ...r] = w2.players, pid2 = 'p_' + l.uid;
  l.party.invite(w2.remote(l, r[0]));
  w2.T.t += SN.party.INVITE_MS + 1; w2.sync([l]);
  for (const p of r.slice(1, 5)) { l.party.invite(w2.remote(l, p)); }
  w2.sync([l, ...r.slice(1, 5)]); // r[0] hasn't ticked since: its copy of the invite still stands
  for (const p of r.slice(1, 5)) p.party.accept(pid2);
  assert.equal(r[0].party.accept(pid2), true);
  w2.sync(); w2.sync();
  assert.equal(l.party.members().length, 5);
  assert.equal(r[0].party.id(), null);
  assert.ok(r[0].events.includes('notJoined'));
  assert.deepEqual(r.slice(1, 5).map((p) => inParty(p, pid2)), [true, true, true, true]);
});

test('a member who left, or a duplicate of an old accept, is not pulled back or told anything', () => {
  const w = world(3), [a, b] = w.players, pid = 'p_' + a.uid;
  a.party.invite(w.remote(a, b)); b.party.accept(pid); w.sync();
  assert.equal(a.party.members().length, 2);
  b.pres.send('party.accept', { to: a.uid, party: pid }); w.sync(); // a duplicate while in
  assert.equal(a.party.members().length, 2);
  assert.ok(!b.events.includes('notJoined'));
  b.party.leave(); w.sync();
  b.pres.send('party.accept', { to: a.uid, party: pid }); w.sync(); w.sync(); // a stale one after leaving
  assert.equal(b.party.id(), null);
  assert.ok(!b.events.includes('notJoined'), 'nothing to tell: B is in no party');
  assert.equal(a.party.members().length, 0);
});
