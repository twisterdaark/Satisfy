'use strict';
// SAT-ONLINE-016 (doc §29 T31): party chat and the block list, on the in-memory hub.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/party.js', 'src/net/duel.js', 'src/net/chat.js');
const WORLD = { id: 'satisfy', tile: 16, w: 724, h: 144 };
const CH = SN.chat;

function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; }

// n players a few px apart outside town; each has its own block list
function world(n) {
  const hub = SN.transports.hub();
  let t = 1000; const now = () => t;
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = 'u' + i, store = memStore(), bl = CH.blocklist(store);
    const pres = SN.presence.create({ transport: hub.connect(), now, world: WORLD, net: SN.net, uid, sid: 'sess' + i + 'xxxxxxxx' });
    const blocked = (u) => bl.has(u);
    const party = SN.party.create({ presence: pres, uid, now, blocked });
    const duel = SN.duel.create({ presence: pres, uid, now, blocked, pos: () => ({ x: 4000 + i * 30, y: 1500 }), zone: () => 'zPlains', policy: SN.net.zonePolicy });
    const chat = CH.create({ presence: pres, party, uid, now, blocked });
    const heard = [], events = [];
    chat.on((l) => heard.push((l.self ? 'me' : l.handle) + ': ' + l.text));
    party.on((e) => events.push(e.type));
    duel.on((e) => events.push('duel:' + e.type));
    players.push({ uid, name: 'P' + i, pres, party, duel, chat, bl, store, heard, events });
  }
  const sync = () => {
    for (const [i, p] of players.entries()) {
      const pp = SN.net.toPlayerPublic({ look: { n: p.name }, cls: 'novice', lv: 2, title: '' }, { x: 4000 + i * 30, y: 1500, dir: 0 },
        { zone: 'zPlains', uid: p.uid, sid: p.pres.sid, party: p.party.id() });
      p.pres.publish(pp, true);
    }
    for (const p of players) { p.pres.tick(); p.party.tick(); p.duel.tick(); }
  };
  const advance = (ms) => { for (let k = 0; k < ms; k += 100) { t += Math.min(100, ms - k); sync(); } };
  sync(); advance(300);
  const remote = (from, to) => from.pres.remotes().find((r) => r.uid === to.uid);
  const join = (leader, p) => { assert.equal(leader.party.invite(remote(leader, p)), 'sent'); assert.ok(p.party.accept(p.party.pendingInvite().party)); advance(200); };
  return { players, sync, advance, remote, join, now: () => t };
}

test('clean(): no control or bidi characters, collapsed spaces, at most 120 characters, whole emoji', () => {
  assert.equal(CH.clean('  hi\u0000\u0007 there\n\t you  '), 'hi there you');
  assert.equal(CH.clean('abc‮dcba⁦x​'), 'abc dcba x');
  const long = 'a'.repeat(119) + '😀😀';
  assert.equal(CH.clean(long), 'a'.repeat(119), 'an emoji that does not fit is left out whole');
  assert.equal(CH.clean('مرحبا يا جريد'), 'مرحبا يا جريد');
  assert.equal(CH.clean(null), '');
  assert.equal(CH.clean('x'.repeat(500)).length, CH.C.MAX_LEN);
});

test('party chat reaches every other member and nobody else', () => {
  const w = world(4), [a, b, c, d] = w.players;
  assert.equal(a.chat.say('hello'), 'noParty');
  w.join(a, b); w.join(a, c);
  assert.equal(a.chat.say('  '), 'empty');
  assert.equal(a.chat.say('hello party'), 'sent');
  w.advance(100);
  assert.deepEqual(a.heard, ['me: hello party']);
  assert.deepEqual(b.heard, ['P0: hello party']);
  assert.deepEqual(c.heard, ['P0: hello party']);
  assert.deepEqual(d.heard, [], 'not in the party: hears nothing');
  assert.equal(b.chat.say('hi from B'), 'sent');
  w.advance(100);
  assert.deepEqual(a.heard.slice(-1), ['P1: hi from B']);
  assert.deepEqual(c.heard.slice(-1), ['P1: hi from B'], 'members talk to each other, not only to the leader');
  assert.equal(b.chat.log().length, 2);
});

test('a forged line from outside the party, or for another party, is ignored', () => {
  const w = world(3), [a, b, c] = w.players;
  w.join(a, b);
  c.pres.send('chat.say', { to: b.uid, party: a.party.id(), text: 'I am not in your party' });
  c.pres.send('chat.say', { to: b.uid, party: 'p_u2', text: 'wrong party' });
  a.pres.send('chat.say', { to: b.uid, party: 'p_other', text: 'right sender, wrong party' });
  a.pres.send('chat.say', { to: b.uid, party: a.party.id(), text: '‮\u0000   ' });
  w.advance(200);
  assert.deepEqual(b.heard, []);
});

test('sending too fast is refused; the burst limit resets', () => {
  const w = world(2), [a, b] = w.players;
  w.join(a, b);
  assert.equal(a.chat.say('1'), 'sent');
  assert.equal(a.chat.say('2'), 'tooFast');
  for (let i = 2; i <= 5; i++) { w.advance(CH.C.MIN_GAP_MS); assert.equal(a.chat.say(String(i)), 'sent'); }
  w.advance(CH.C.MIN_GAP_MS);
  assert.equal(a.chat.say('6'), 'tooFast', 'at most 5 in 10 s');
  w.advance(CH.C.BURST_MS);
  assert.equal(a.chat.say('7'), 'sent');
  w.advance(100);
  assert.deepEqual(b.heard.map((x) => x.split(': ')[1]), ['1', '2', '3', '4', '5', '7']);
});

test('T31: a blocked player\'s chat, party invites and duel challenges never show', () => {
  const w = world(3), [a, b, c] = w.players;
  b.bl.add(a.uid, 'P0');
  assert.ok(b.bl.has(a.uid));
  assert.deepEqual(JSON.parse(b.store.getItem(CH.KEY)), { u0: 'P0' }, 'kept on this device');
  // A's invite is dropped silently: no prompt for B, no answer for A
  assert.equal(a.party.invite(w.remote(a, b)), 'sent');
  w.advance(200);
  assert.equal(b.party.pendingInvite(), null);
  assert.ok(!a.events.includes('declined'), 'no decline either');
  assert.equal(a.duel.challenge(w.remote(a, b)), 'sent');
  w.advance(200);
  assert.equal(b.duel.pendingChallenge(), null);
  assert.ok(!b.events.some((e) => e === 'invite' || e === 'duel:challenge'));
  // in a party with someone B blocked later: their lines disappear, the others' stay
  a.party.leave(); w.advance(200);
  b.bl.clear();
  w.join(a, b); w.join(a, c);
  b.bl.add(c.uid, 'P2');
  c.chat.say('from C'); a.chat.say('from A');
  w.advance(100);
  assert.deepEqual(b.heard, ['P0: from A']);
  assert.deepEqual(b.bl.list(), [{ uid: 'u2', handle: 'P2' }]);
  b.bl.remove(c.uid);
  w.advance(CH.C.MIN_GAP_MS);
  c.chat.say('again');
  w.advance(100);
  assert.deepEqual(b.heard.slice(-1), ['P2: again']);
});

test('a broken block list in storage is treated as empty', () => {
  const s = memStore(); s.setItem(CH.KEY, '{nope');
  const bl = CH.blocklist(s);
  assert.equal(bl.has('u1'), false);
  bl.add('u1', 'x'.repeat(40) + '😀');
  assert.equal(bl.list()[0].handle.length, 24);
  s.setItem(CH.KEY, '[1,2]');
  assert.deepEqual(CH.blocklist(s).list(), []);
});
