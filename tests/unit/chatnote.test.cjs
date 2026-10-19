'use strict';
// SAT-ONLINE-041: a world or server notice goes into the chat as a line of its own; nothing is sent.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/party.js', 'src/net/chat.js');
const WORLD = { id: 'satisfy', tile: 16, w: 160, h: 144 };

test('note: a local sys line, cleaned, never sent', () => {
  const hub = SN.transports.hub(), sent = [];
  const pres = SN.presence.create({ transport: hub.connect(), now: () => 1000, world: WORLD, net: SN.net, uid: 'u0', sid: 'sess0xxxxxxxx' });
  const orig = pres.send; pres.send = (...a) => { sent.push(a); return orig.apply(pres, a); };
  const party = SN.party.create({ presence: pres, uid: 'u0', now: () => 1000 });
  const world = { sayWorld: (m) => sent.push(m), world: () => {} };
  const chat = SN.chat.create({ presence: pres, party, uid: 'u0', now: () => 1000, world });
  assert.equal(chat.note('  Goblin\n invasion!  '), true);
  assert.equal(chat.note('   '), false);
  const l = chat.log();
  assert.equal(l.length, 1);
  assert.equal(l[0].ch, 'sys'); assert.equal(l[0].text, 'Goblin invasion!'); assert.equal(l[0].self, false); assert.equal(l[0].handle, '');
  assert.deepEqual(sent, [], 'nothing goes out');
});
