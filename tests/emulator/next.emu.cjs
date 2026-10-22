'use strict';
// rules-next only: the rules of the open pull requests that this branch carries, on the real Realtime Database emulator, before
// the owner deploys them. Players A and B, an admin M, and C outside A's guild. One test per pull request, named by it.
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const RULES = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'database.rules.json'), 'utf8');
const SV = { '.sv': 'timestamp' };
const A = 'uidAhmed01', B = 'uidBassem02', M = 'uidAdmin03', C = 'uidCarim04', G = 'g_' + A;
let env;

test.before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-satisfy-next', database: { rules: RULES } }); });
test.after(async () => { if (env) await env.cleanup(); });
test.beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().set({
      accountIds: { [A]: 'Ahmed', [B]: 'Bassem', [M]: 'Owner', [C]: 'Carim' },
      handles: { ahmed: A, bassem: B, owner: M, carim: C },
      admins: { [M]: true },
      guilds: { [G]: { name: 'Dragons', nk: 'dragons', master: A, col: 2, t: 1 } },
      guildNames: { dragons: G },
      guildMembers: { [G]: { [A]: { rk: 'm', n: 'Ahmed', c: 0, on: Date.now() }, [B]: { rk: 'r', n: 'Bassem', c: 0, on: Date.now() } } },
      crashes: { c1: { m: 'TypeError', s: 'at f', v: '1.41', by: B, t: 1 } },
    });
  });
});
const db = (uid) => env.authenticatedContext(uid).database();
async function no(p, why) { try { await assertFails(p); } catch (e) { throw new Error('should be refused: ' + why + ' (' + e.message + ')'); } }
async function yes(p, why) { try { await assertSucceeds(p); } catch (e) { throw new Error('should pass: ' + why + ' (' + e.message + ')'); } }

test('#145: an admin removes crash reports, nobody else does', async () => {
  await no(db(B).ref('crashes/c1').remove(), 'the player who sent it');
  await no(db(A).ref('crashes/c1').remove(), 'another player');
  await yes(db(M).ref('crashes/c1').remove(), 'the owner');
  await yes(db(B).ref('crashes/c2').set({ m: 'TypeError', s: 'at f', v: '1.42', by: B, t: SV }), 'sending one still works');
});

test('#151: the guild hall: members and guests read it, the master furnishes it, a guest only leaves', async () => {
  const piece = (by, n, k = 'table') => ({ k, by, n, t: SV });
  await yes(db(A).ref('guildHall/' + G + '/s0').set(piece(A, 'Ahmed')), 'the master furnishes');
  await no(db(B).ref('guildHall/' + G + '/s1').set(piece(B, 'Bassem')), 'a member does not');
  await no(db(A).ref('guildHall/' + G + '/s9').set(piece(A, 'Ahmed')), 'eight places only');
  await no(db(A).ref('guildHall/' + G + '/s1').set(piece(A, 'Ahmed', 'throne')), 'nine pieces only');
  await yes(db(B).ref('guildHall/' + G).once('value'), 'members read it');
  await no(db(C).ref('guildHall/' + G).once('value'), 'others do not');
  await no(db(B).ref().update({ ['guildHallGuest/' + G + '/' + C]: { n: 'Carim', by: B, t: SV }, ['hallInv/' + C + '/' + G]: { g: 'Dragons', by: B, t: SV } }), 'a member lets nobody in');
  await no(db(A).ref().update({ ['guildHallGuest/' + G + '/' + B]: { n: 'Bassem', by: A, t: SV }, ['hallInv/' + B + '/' + G]: { g: 'Dragons', by: A, t: SV } }), 'a member is not a guest');
  await no(db(A).ref('hallInv/' + C + '/' + G).set({ g: 'Dragons', by: A, t: SV }), 'an invitation needs its guest entry');
  await yes(db(A).ref().update({ ['guildHallGuest/' + G + '/' + C]: { n: 'Carim', by: A, t: SV }, ['hallInv/' + C + '/' + G]: { g: 'Dragons', by: A, t: SV } }), 'the master lets C in');
  await yes(db(C).ref('guildHall/' + G).once('value'), 'the guest reads the hall');
  await yes(db(C).ref('hallInv/' + C).once('value'), 'and its invitations');
  await no(db(C).ref('guildHall/' + G + '/s2').set(piece(C, 'Carim')), 'a guest does not furnish');
  await no(db(C).ref('guildHallGuest/' + G + '/' + C).set({ n: 'Me', by: C, t: SV }), 'nor changes its entry');
  await yes(db(C).ref().update({ ['hallInv/' + C + '/' + G]: null, ['guildHallGuest/' + G + '/' + C]: null }), 'it may turn it down');
  await no(db(C).ref('guildHall/' + G).once('value'), 'then it reads nothing');
});

test('#156: live switches: only admins set them; while off, no new world line, trade or challenge', async () => {
  await no(db(A).ref('flags/chat').set({ on: false, by: A, t: SV }), 'a player does not switch');
  await no(db(M).ref('flags/pvp').set({ on: false, by: M, t: SV }), 'three switches only');
  await yes(db(A).ref('chat/satisfy/l1').set({ from: A, h: 'Ahmed', text: 'hi', t: SV }), 'chat on (unset)');
  await yes(db(M).ref('flags').update({ chat: { on: false, why: 'spam', by: M, t: SV }, trade: { on: false, by: M, t: SV }, duel: { on: false, by: M, t: SV } }), 'the owner switches all three off');
  await yes(db(B).ref('flags').once('value'), 'every player reads them');
  await no(db(A).ref('chat/satisfy/l2').set({ from: A, h: 'Ahmed', text: 'hi again', t: SV }), 'no world line while chat is off');
  await no(db(A).ref('trades/t_' + A + '_1').set({ a: A, b: B, t: SV }), 'no new trade');
  const msg = (type, payload) => ({ from: A, sid: 'sess0123456789ab', seq: 1, type, payload, t: SV });
  await no(db(A).ref('inbox/' + B + '/m1').set(msg('trade.ask', { to: B, trade: 't_' + A + '_1' })), 'no trade request');
  await no(db(A).ref('inbox/' + B + '/m2').set(msg('duel.challenge', { to: B, duel: 'd_x1' })), 'no duel challenge');
  await yes(db(A).ref('inbox/' + B + '/m3').set(msg('party.invite', { to: B, party: 'p_' + A })), 'the rest of the inbox works');
  await yes(db(M).ref('flags/chat').set({ on: true, by: M, t: SV }), 'back on');
  await yes(db(A).ref('chat/satisfy/l3').set({ from: A, h: 'Ahmed', text: 'back', t: SV }), 'a world line again');
});

test('#138: rank rights: the master decides who takes from the vault; the vault goes only with the guild', async () => {
  const D = 'uidDina05';
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().update({
      ['accountIds/' + D]: 'Dina', 'handles/dina': D,
      ['guildMembers/' + G + '/' + D]: { rk: 'o', n: 'Dina', c: 0, on: Date.now() },
      ['guildVault/' + G + '/v_1']: { k: 'ore', n: 3, r: 0, by: A, t: 1 },
      ['guildVault/' + G + '/v_2']: { k: 'wood', n: 2, r: 0, by: A, t: 1 },
    });
  });
  await no(db(B).ref('guildVault/' + G + '/v_1').remove(), 'a member takes nothing by default');
  await yes(db(A).ref('guilds/' + G + '/perm/r').set({ take: true }), 'the master lets members take');
  await no(db(B).ref('guilds/' + G + '/perm/r').set({ take: true, spend: true }), 'a member sets no rights');
  await yes(db(B).ref('guildVault/' + G + '/v_1').remove(), 'now the member takes');
  await yes(db(A).ref('guilds/' + G + '/perm/o').set({ take: false }), 'the master stops the officers taking');
  await no(db(D).ref('guildVault/' + G + '/v_2').remove(), 'the officer no longer takes');
  await no(db(A).ref('guilds/' + G + '/perm/m').set({ take: false }), 'there are no rights to set for the master');
  await no(db(A).ref('guildVault/' + G).remove(), 'the whole vault goes only with the guild');
});

test('#129: the auction: your own listing, bought once by someone else with the exact price, collected by the seller', async () => {
  const L = 'a_' + A + '_0', item = { by: A, n: 'Ahmed', it: 'ore', q: 5, price: 300, t: SV };
  await no(db(B).ref('auction/' + L).set(Object.assign({}, item)), 'nobody lists in another name');
  await no(db(A).ref('auction/a_' + A + '_8').set(item), 'eight slots a seller');
  await yes(db(A).ref('auction/' + L).set(item), 'A lists ore');
  await yes(db(C).ref('auction').once('value'), 'everyone reads the market');
  const buy = (who, g) => db(who).ref().update({ ['auction/' + L]: null, ['auctionPaid/' + A + '/' + L]: { g, by: who, bn: 'x', it: 'ore', q: 5, t: SV } });
  await no(buy(B, 1), 'not below the price');
  await no(db(B).ref('auction/' + L).remove(), 'nor taken off without paying');
  await no(buy(A, 300), 'the seller does not buy its own');
  await yes(buy(B, 300), 'B buys it: the listing goes and the gold waits for A');
  await no(buy(C, 300), 'bought once');
  await no(db(B).ref('auctionPaid/' + A + '/' + L).remove(), 'only the seller collects');
  await no(db(B).ref('auctionPaid/' + A).once('value'), 'nor reads it');
  await yes(db(A).ref('auctionPaid/' + A + '/' + L).remove(), 'A collects');
});

test('#140: the city tax: set by the master of the castle guild, at most 10%, once an hour; paid into it by others', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('world/satisfy/own/castle').set({ g: G, n: 'Dragons', c: '#ff0000', h: 'Ahmed', uid: A, t: 1 }); });
  const tax = (by, r) => db(by).ref('world/satisfy/tax').set({ g: G, r, by, t: SV });
  await no(tax(B, 5), 'a member does not set it');
  await no(tax(A, 11), 'at most 10%');
  await yes(tax(A, 5), 'the master of the castle guild sets 5%');
  await no(tax(A, 6), 'once an hour');
  await yes(db(C).ref('world/satisfy/tax').once('value'), 'everyone reads it');
  await no(db(B).ref('guildTax/' + G + '/x_b1').set({ g: 10, by: B, n: 'Bassem', t: SV }), 'members pay no tax to their own guild');
  await yes(db(C).ref('guildTax/' + G + '/x_c1').set({ g: 10, by: C, n: 'Carim', t: SV }), 'C pays the tax of a purchase');
  await no(db(C).ref('guildTax/' + G + '/x_c2').set({ g: 100001, by: C, n: 'Carim', t: SV }), 'within the bounds');
  await no(db(C).ref('guildTax/' + G + '/x_c1').remove(), 'nobody takes it back');
});

test('#144: a caravan: one at a time, delivered after its time and before it spoils, with the same load', async () => {
  const car = { id: 'v_1', f: 'zWin', to: 'zReid', g: 400, r: 1, md: 60000, t: SV };
  await no(db(B).ref('caravans/' + A).set(car), 'nobody sends a caravan in another name');
  await no(db(A).ref('caravans/' + A).set(Object.assign({}, car, { to: 'zWin' })), 'somewhere else');
  await no(db(A).ref('caravans/' + A).set(Object.assign({}, car, { md: 1000 })), 'a minute at least');
  await yes(db(A).ref('caravans/' + A).set(car), 'A sends one');
  await no(db(A).ref('caravans/' + A).set(Object.assign({}, car, { g: 900 })), 'one at a time, the load is not changed');
  await no(db(A).ref().update({ ['caravans/' + A]: null, ['caravanDone/' + A + '/v_1']: { f: 'zWin', to: 'zReid', g: 400, r: 1, t: SV } }), 'not delivered before its time');
  await no(db(B).ref('caravans/' + A).once('value'), 'others do not read it');
  await yes(db(A).ref('caravans/' + A).remove(), 'dropped');
});
