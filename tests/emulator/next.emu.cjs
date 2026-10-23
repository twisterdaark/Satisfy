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

test('#161: bug reports: your own, one every 2 minutes; admins read, tag and clear them', async () => {
  const bug = (by, s = 'the shop stays open') => ({ s, v: '1.42', z: 'zWin', n: 'Bassem', by, t: SV });
  const send = (uid, id, v) => db(uid).ref().update({ ['bugs/' + id]: v, ['bugLast/' + uid]: { t: SV } });
  await no(db(B).ref('bugs/b_B_1').set(bug(B)), 'without bugLast in the same update');
  await no(send(B, 'b_B_1', bug(A)), 'as someone else');
  await no(send(B, 'b_B_1', bug(B, 'ok')), 'too short');
  await no(send(B, 'bad id', bug(B)), 'a key of its own form');
  await yes(send(B, 'b_B_1', bug(B)), 'Bassem sends one');
  await no(send(B, 'b_B_2', bug(B)), 'a second within 2 minutes');
  await no(db(B).ref('bugLast/' + B).remove(), "Claude-B's review: bugLast can't be removed to send again at once");
  await no(db(B).ref('bugLast/' + B + '/t').remove(), 'nor its time');
  await no(db(B).ref().update({ ['bugLast/' + B]: null, ['bugs/b_B_2']: bug(B) }), 'nor in the same update');
  await no(send(B, 'b_B_1', bug(B, 'changed it')), 'never changed');
  await no(db(A).ref('bugs').once('value'), 'players do not read them');
  await yes(db(M).ref('bugs').once('value'), 'the owner does');
  await no(db(A).ref('bugTriage/b_B_1').set({ s: 'act', by: A, t: SV }), 'players do not tag');
  await yes(db(M).ref('bugTriage/b_B_1').set({ s: 'act', by: M, t: SV }), 'the owner tags it actionable');
  await yes(db(M).ref('bugTriage/c_1x2y').set({ s: 'fixed', note: 'fixed in 1.42', by: M, t: SV }), 'and a crash group fixed');
  await no(db(M).ref('bugTriage/b_B_1').set({ s: 'dup', by: M, t: SV }), 'the same as nothing');
  await no(db(M).ref('bugTriage/b_B_1').set({ s: 'dup', dup: 'b_B_1', by: M, t: SV }), 'the same as itself');
  await no(db(M).ref('bugTriage/b_B_1').set({ s: 'act', dup: 'c_1x2y', by: M, t: SV }), 'a dup only with dup');
  await no(db(M).ref('bugTriage/b_B_1').set({ s: 'later', by: M, t: SV }), 'five tags only');
  await yes(db(M).ref('bugTriage/b_B_1').set({ s: 'dup', dup: 'c_1x2y', by: M, t: SV }), 'merged into the crash group');
  await no(db(A).ref('bugTriage').once('value'), 'players do not read tags');
  await no(db(B).ref('bugs/b_B_1').remove(), 'the sender does not remove it');
  await yes(db(M).ref().update({ 'bugs/b_B_1': null, 'bugTriage/b_B_1': null }), 'the owner clears it');
  await yes(db(M).ref().update({ 'bugs/b_B_1': null, 'bugTriage/b_B_1': null }), 'a second click on Clear: already gone');
  await no(db(B).ref('bugs/b_gone').remove(), 'a player removes none, gone or not');
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

test("#140: who holds the castle is written only by that guild's member, or by the guild it is taken from", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('world/satisfy/own/castle').set({ g: G, n: 'Dragons', c: '#ff0000', h: 'Ahmed', uid: A, t: 1 }); });
  const own = (who, g) => db(who).ref('world/satisfy/own/castle').set({ g, n: 'X', c: '#ff0000', h: 'h', uid: who, t: SV });
  await no(own(C, G), 'C is not in the Dragons');
  await no(own(C, 'g_' + C), 'nor in a guild of its own');
  await no(own(C, 'bd'), 'nor in the guild that holds it');
  await yes(own(B, 'bd'), 'a canon guild takes it from the Dragons, written by their member');
  await no(own(A, 'rt'), 'then not by the Dragons any more');
  await yes(own(A, G), 'the Dragons take it back');
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
  // Claude-B's review: a start left behind is replaced once it is two hours old, not before
  await yes(db(A).ref('caravans/' + A).set(car), 'A sends another');
  await no(db(A).ref('caravans/' + A).set(Object.assign({}, car, { id: 'v_2' })), 'not over one that can still be delivered');
  await env.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('caravans/' + A + '/t').set(Date.now() - 2 * 3600000 - 60000); });
  await yes(db(A).ref('caravans/' + A).set(Object.assign({}, car, { id: 'v_2' })), 'over one two hours old');
  await no(db(B).ref('caravans/' + A).set(Object.assign({}, car, { id: 'v_3' })), 'still nobody else');
  await env.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('caravanDone/' + A + '/v_0').set({ f: 'zWin', to: 'zReid', g: 400, r: 1, t: 1 }); });
  await no(db(A).ref('caravanDone/' + A).set({ v_9: { f: 'zWin', to: 'zReid', g: 400, r: 1, t: SV } }), 'deliveries are not written whole');
  await no(db(B).ref('caravanDone/' + A).remove(), 'nor removed by others');
  await yes(db(A).ref('caravanDone/' + A).remove(), 'A removes all of its own at once (Delete my online data)');
});

test('#131: repair orders: posted by the owner of the item, answered once by a smith with the fee, then closed', async () => {
  // with its place (#169): repairSlot/{A}/0 = O, written with it and freed with it
  const O = 'r_' + A + '_1', order = { by: A, n: 'Ahmed', iid: 'it_' + A.toLowerCase() + '_1', it: 'sword', d: 40, fee: 500, s: '0', t: SV };
  await no(db(B).ref().update({ ['repairOrders/' + O]: Object.assign({}, order), ['repairSlot/' + B + '/0']: O }), 'nobody posts in another name');
  await yes(db(A).ref().update({ ['repairOrders/' + O]: order, ['repairSlot/' + A + '/0']: O }), 'A posts its sword');
  await yes(db(B).ref('repairOrders').once('value'), 'smiths read the board');
  const answer = (who, fee) => db(who).ref().update({ ['repairOrders/' + O]: null, ['repairSlot/' + A + '/0']: null, ['repairDone/' + A + '/' + O]: { iid: order.iid, by: who, sn: 'Smith', fee, t: SV }, ['repairPaid/' + who + '/' + O]: { g: fee, t: SV } });
  await no(answer(A, 500), 'not your own');
  await no(answer(B, 5000), 'the fee posted, not more');
  await yes(answer(B, 500), 'B repairs it: the order goes, A is told, B is owed the fee');
  await no(answer(C, 500), 'answered once');
  await no(db(B).ref('repairDone/' + A).once('value'), 'the answer is A\'s to read');
  await yes(db(A).ref('repairDone/' + A + '/' + O).remove(), 'A takes the sword back');
  await yes(db(B).ref('repairPaid/' + B + '/' + O).remove(), 'B collects');
});

test('#139: guild research: paid from the treasury at its exact price, in the order of the tree, by those who may spend', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('guildBank/' + G).set({ in: 300000, s: 0, lb: A, lg: 300000, t: 1 }); });
  const research = (who, b, s, named = b) => db(who).ref().update({ ['guildBuild/' + G + '/' + b]: 1, ['guildBank/' + G + '/s']: s, ['guildBank/' + G + '/lb']: who, ['guildBank/' + G + '/b']: named, ['guildBank/' + G + '/t']: SV });
  await no(research(B, 'xp1', 30000), 'a member does not spend by default');
  await no(research(A, 'xp1', 29999), 'the exact price');
  await no(research(A, 'xp2', 120000), 'not before its first step');
  // Claude-B's review: one update buys one node, the one the treasury names
  await no(db(A).ref().update({ ['guildBuild/' + G + '/xp1']: 1, ['guildBuild/' + G + '/gd1']: 1, ['guildBuild/' + G + '/q1']: 1, ['guildBank/' + G + '/s']: 30000, ['guildBank/' + G + '/lb']: A, ['guildBank/' + G + '/b']: 'xp1', ['guildBank/' + G + '/t']: SV }), 'three studies for the price of one');
  await no(research(A, 'xp1', 30000, 'gd1'), 'the treasury names another one');
  await yes(research(A, 'xp1', 30000), 'the master researches the first step');
  await no(db(A).ref('guildBuild/' + G + '/xp1').remove(), 'nothing bought is taken away');
  await no(research(A, 'xp1', 60000), 'once');
  await yes(research(A, 'xp2', 150000), 'then the second, 120,000 more');
  await no(research(A, 'all', 550000), 'the last one needs all three second steps');
  await no(db(C).ref('guildBuild/' + G).once('value'), 'others do not read it');
});

test('#126: guild trophies: given by the owner for a season, read by everyone', async () => {
  const tro = (by, o = {}) => Object.assign({ k: 'gold', p: 3, by, t: SV }, o);
  await no(db(A).ref('guildTrophy/' + G + '/s2026-10').set(tro(A)), 'a master does not give its guild one');
  await no(db(M).ref('guildTrophy/' + G + '/s2026-10').set(tro(M, { k: 'platinum' })), 'gold, silver or bronze');
  await no(db(M).ref('guildTrophy/' + G + '/autumn').set(tro(M)), 'a season is a month');
  await yes(db(M).ref('guildTrophy/' + G + '/s2026-10').set(tro(M)), 'the owner gives it');
  await yes(db(C).ref('guildTrophy/' + G).once('value'), 'everyone reads it');
});

test('#132: crafting commissions: answered once by another crafter with the recipe asked and the fee', async () => {
  const O = 'c_' + A + '_1';
  await yes(db(A).ref('craftOrders/' + O).set({ by: A, n: 'Ahmed', rc: 'ironSword', fee: 800, t: SV }), 'A asks for an iron sword');
  const answer = (who, id, fee) => db(who).ref().update({ ['craftOrders/' + O]: null, ['craftDone/' + A + '/' + O]: { it: '{"id":"' + id + '"}', id, by: who, bn: 'Smith', fee, t: SV }, ['craftPaid/' + who + '/' + O]: { g: fee, t: SV } });
  await no(answer(B, 'woodBow', 800), 'the recipe asked, not another');
  await no(answer(B, 'ironSword', 900), 'the fee posted');
  await yes(answer(B, 'ironSword', 800), 'B makes it');
  await no(answer(C, 'ironSword', 800), 'once');
  await yes(db(A).ref('craftDone/' + A + '/' + O).remove(), 'A takes the sword');
});

test('#128: the balance numbers: your own week only, gold in and out bounded; read by admins', async () => {
  const row = (o = {}) => Object.assign({ wk: 'w2916', cls: 'novice', lv: 3, n: 10, s: 30, w: 1, l: 0, gi: 500, go: 200, t: SV }, o);
  await yes(db(A).ref('balance/' + A).set(row()), 'A writes its week');
  await no(db(B).ref('balance/' + A).set(row()), 'not another player\'s');
  await no(db(A).ref('balance/' + A).set(row({ gi: -1 })), 'no gold in below zero');
  await no(db(A).ref('balance/' + A).set(row({ gold: 1 })), 'nothing else');
  await no(db(A).ref('balance').once('value'), 'players do not read them');
  await yes(db(M).ref('balance').once('value'), 'the owner does');
});

// #169 (Claude-B's note on #131): repair orders each hold one of their poster's five places
test('#169: repair orders: five places an account, each written and freed with its order', async () => {
  const ord = (by, s) => ({ by, n: 'Ahmed', iid: 'it_' + by.toLowerCase() + '_1', it: 'Helm', d: 30, fee: 50, s, t: SV });
  const post = (uid, oid, s) => db(uid).ref().update({ ['repairOrders/' + oid]: ord(uid, s), ['repairSlot/' + uid + '/' + s]: oid });
  await no(db(A).ref('repairOrders/r_A_1').set(ord(A, '0')), 'not without its place');
  await no(db(A).ref().update({ 'repairOrders/r_A_1': ord(A, '0'), [`repairSlot/${A}/0`]: 'r_A_other' }), 'its place names it');
  await no(db(A).ref().update({ 'repairOrders/r_A_1': ord(A, '5'), [`repairSlot/${A}/5`]: 'r_A_1' }), 'five places only');
  await no(db(B).ref().update({ 'repairOrders/r_B_1': ord(B, '0'), [`repairSlot/${A}/0`]: 'r_B_1' }), "not in another account's places");
  for (const k of ['0', '1', '2', '3', '4']) await yes(post(A, 'r_A_' + k, k), 'place ' + k);
  await no(post(A, 'r_A_9', '0'), 'a sixth');
  await no(db(A).ref(`repairSlot/${A}/0`).remove(), "a live order's place stays");
  await no(db(A).ref('repairOrders/r_A_0').remove(), 'the order does not go without freeing its place');
  await yes(db(A).ref().update({ 'repairOrders/r_A_0': null, [`repairSlot/${A}/0`]: null }), 'taken off with its place');
  // a smith mends one: the order, its place, the owner told and the smith paid, in one update
  await yes(db(B).ref().update({ 'repairOrders/r_A_1': null, [`repairSlot/${A}/1`]: null, [`repairDone/${A}/r_A_1`]: { iid: 'it_' + A.toLowerCase() + '_1', by: B, sn: 'Bassem', fee: 50, t: SV }, [`repairPaid/${B}/r_A_1`]: { g: 50, t: SV } }), 'mended');
  await yes(post(A, 'r_A_5', '0'), 'a freed place takes a new order');
  await no(db(B).ref(`repairSlot/${A}`).once('value'), 'the places are their account\'s to read');
});

// SAT-ONLINE-137 (plan U335): content packs live under flags as pk_{name}, set by admins, with an optional cohort
test('#173: content packs: admins set them, with a cohort (level, share) only for a pack', async () => {
  const pk = (o) => Object.assign({ on: true, by: M, t: SV }, o);
  await no(db(A).ref('flags/pk_hunt').set(Object.assign(pk(), { by: A })), 'not a player');
  await yes(db(M).ref('flags/pk_hunt').set(pk({ on: false, why: 'next week' })), 'the owner closes the hunt');
  await yes(db(M).ref('flags/pk_nat').set(pk({ lv: 100, pct: 50 })), 'and opens the competition for a cohort');
  await no(db(M).ref('flags/pk_HUNT').set(pk()), 'lower-case names');
  await no(db(M).ref('flags/pk_x').set(pk()), 'two letters at least');
  await no(db(M).ref('flags/chat').set(pk({ lv: 5 })), 'a cohort only for a pack');
  await no(db(M).ref('flags/pk_nat').set(pk({ pct: 101 })), 'a share up to 100%');
  await no(db(M).ref('flags/pk_nat').set(pk({ lv: 0 })), 'from level 1');
  await no(db(M).ref('flags/pk_nat').set(pk({ zone: 'zWin' })), 'nothing else');
  await yes(db(A).ref('flags').once('value'), 'every page reads them');
});

test('#179: a spawn shield in presence, 1 or nothing', async () => {
  const pres = { v: 1, uid: A, sid: 'sess0123456789ab', handle: 'Ahmed', look: { hair: 1, hc: 2, skin: 1, top: 3 }, cls: 'novice', lv: 3, zone: 'zWin', x: 2000, y: 1300, dir: 0, anim: 'idle', arm: 0, seq: 1, t: SV };
  await yes(db(A).ref('presence/satisfy/main/' + A).set(pres), 'presence as before');
  await yes(db(A).ref('presence/satisfy/main/' + A).update({ sh: 1 }), 'with a shield');
  await no(db(A).ref('presence/satisfy/main/' + A).update({ sh: 2 }), 'only 1');
  await yes(db(A).ref('presence/satisfy/main/' + A + '/sh').remove(), 'and it goes');
});

test('#183: PvE only in presence, 1 or nothing', async () => {
  const pres = { v: 1, uid: A, sid: 'sess0123456789ab', handle: 'Ahmed', look: { hair: 1, hc: 2, skin: 1, top: 3 }, cls: 'novice', lv: 3, zone: 'zWin', x: 2000, y: 1300, dir: 0, anim: 'idle', arm: 0, seq: 1, t: SV };
  await yes(db(A).ref('presence/satisfy/main/' + A).set(Object.assign({ pv: 1 }, pres)), 'PvE only');
  await no(db(A).ref('presence/satisfy/main/' + A).update({ pv: 2 }), 'only 1');
  await yes(db(A).ref('presence/satisfy/main/' + A + '/pv').remove(), 'and it goes');
});

test('#191: arena ratings name the opponent and count one more duel against it; at most 5 a season', async () => {
  const se = 's202610', r = (w, o) => ({ r: 1000 + w, w, l: 0, n: 'Ahmed', t: SV, o });
  const both = (w, o, n) => ({ ['arena/' + se + '/' + A]: r(w, o), ['arenaPairs/' + se + '/' + A + '/' + o]: n });
  await no(db(A).ref('arena/' + se + '/' + A).set(r(1, B)), 'a rating without its count');
  await yes(db(A).ref().update(both(1, B, 1)), 'the first rated duel with B');
  await new Promise((res) => setTimeout(res, 20));
  await no(db(A).ref('arenaPairs/' + se + '/' + A + '/' + B).set(2), 'a count without a new rating');
  for (let i = 2; i <= 5; i++) await yes(db(A).ref().update(both(i, B, i)), 'rated duel ' + i);
  await no(db(A).ref().update(both(6, B, 6)), 'a sixth with B this season');
  await yes(db(A).ref().update(both(6, C, 1)), 'a first with C');
  await no(db(B).ref('arenaPairs/' + se + '/' + A).once('value'), "B can't read A's counts");
});
