'use strict';
// SAT-ONLINE-049: guild chat. say(text, 'guild') goes to the guild's feed only while you are in a guild; lines from the
// feed come in as ch 'guild' (your own echo and blocked players are skipped).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const SN = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/transport-local.js', 'src/net/party.js', 'src/net/chat.js');
const WORLD = { id: 'satisfy', tile: 16, w: 160, h: 144 };

test('guild lines: sent to the feed while in a guild, received as ch guild; own echo and blocked players skipped', () => {
  const hub = SN.transports.hub(), sent = [];
  let t = 1000, inGuild = false, feed = null;
  const pres = SN.presence.create({ transport: hub.connect(), now: () => t, world: WORLD, net: SN.net, uid: 'u0', sid: 'sess0xxxxxxxx' });
  const party = SN.party.create({ presence: pres, uid: 'u0', now: () => t });
  const guild = { inGuild: () => inGuild, sayGuild: (m) => sent.push(m), guildLines: (fn) => { feed = fn; } };
  const chat = SN.chat.create({ presence: pres, party, uid: 'u0', now: () => t, guild, blocked: (u) => u === 'uBad', handle: () => 'Grid' });
  assert.equal(chat.say('hello', 'guild'), 'noGuild', 'not in a guild yet');
  inGuild = true;
  assert.equal(chat.say('  hello\n guild  ', 'guild'), 'sent');
  assert.deepEqual(sent, [{ from: 'u0', h: 'Grid', text: 'hello guild' }]);
  t += 2000;
  feed({ from: 'u0', h: 'Grid', text: 'hello guild' }); // the feed echoes our own line: already shown
  feed({ from: 'u1', h: 'Faker', text: 'hi‮ there' });
  feed({ from: 'uBad', h: 'Spam', text: 'buy gold' });
  feed({ from: 'u2', h: 'Ruby', text: '   ' });
  const l = chat.log();
  assert.deepEqual(l.map((x) => [x.ch, x.self, x.handle, x.text]), [['guild', true, null, 'hello guild'], ['guild', false, 'Faker', 'hi there']]);
  // the party and world channels are unchanged
  assert.equal(chat.say('x', 'party'), 'noParty');
  assert.equal(chat.say('x', 'all'), 'noWorld');
});
