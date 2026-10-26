'use strict';
// Plan U237 the guild research tree: backend/database.rules.json itself, through the rules evaluator.
//   - guildResearch/{gid}: a whole number, a bit a node (the game's GRS order: grx1 grg1 grq1, grh grd grl, grx2 grg2 grq2);
//   - written by those who may spend the treasury (the master, officers unless taken away, members if given), one new bit
//     a write, its branch's node before it already there, its cost (100,000 / 250,000 / 600,000) added to the treasury's
//     spent counter in the same write; read by members; gone only with the guild;
//   - the treasury pays only for a building raised or a node bought; the log takes {k: 'res', b: node}.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV, T0 = 1767600000000;

function guild() {
  let st = {
    guilds: { g_one: { master: 'ann' } },
    guildMembers: { g_one: { ann: { rk: 'm' }, oli: { rk: 'o' }, rob: { rk: 'r' } } },
    guildBank: { g_one: { in: 3000000, s: 0, lb: 'ann', lg: 1000000, t: T0 - 1000 } },
  };
  const s = () => (st.guildBank.g_one.s);
  const buy = (uid, m, cost, extra = {}, now = T0) => {
    const b = st.guildBank.g_one, u = Object.assign({
      'guildBank/g_one': { in: b.in, s: b.s + cost, lb: b.lb, lg: b.lg, t: SV },
      'guildResearch/g_one': m,
      ['guildLog/g_one/l_' + uid + m]: { by: uid, n: uid, k: 'res', g: cost, b: 'grx1', t: SV },
    }, extra);
    const r = E.write(R, st, u, { auth: { uid }, now });
    if (r.ok) st = r.after;
    return r.ok ? 'ok' : 'no';
  };
  return { buy, s, get st() { return st; } };
}

test('the research tree: one node a write, in its branch\'s order, at its cost, by those who may spend', () => {
  const G = guild();
  assert.equal(G.buy('rob', 1, 100000), 'no', 'a member without the right to spend');
  assert.equal(G.buy('ann', 1, 99999), 'no', 'for less than it costs');
  assert.equal(G.buy('ann', 3, 100000), 'no', 'two nodes for one price');
  assert.equal(G.buy('ann', 3, 200000), 'no', 'two nodes at once, even paid');
  assert.equal(G.buy('ann', 8, 250000), 'no', 'Endurance Drills before Training Manuals');
  assert.equal(G.buy('ann', 1, 100000), 'ok', 'Training Manuals');
  assert.equal(G.s(), 100000);
  assert.equal(G.buy('oli', 1, 100000), 'no', 'the same node again');
  assert.equal(G.buy('oli', 1 + 8, 250000), 'ok', 'an officer: Endurance Drills after it');
  assert.equal(G.buy('ann', 9 + 128, 600000), 'no', 'Trade Charter without the Armoury');
  assert.equal(G.buy('ann', 9 + 64, 250000), 'no', 'War College for a lesser node\'s cost');
  assert.equal(G.buy('ann', 9 + 64, 600000), 'ok', 'War College');
  assert.equal(G.buy('ann', 73 - 64, 0), 'no', 'never taken back');
  assert.equal(G.s(), 950000);
  assert.equal(E.read(R, G.st, 'guildResearch/g_one', { auth: { uid: 'rob' }, now: T0 }), true, 'members read it');
  assert.equal(E.read(R, G.st, 'guildResearch/g_one', { auth: { uid: 'eve' }, now: T0 }), false, 'others don\'t');
});

test('the treasury pays only for a node bought or a building raised; the log names the node', () => {
  const G = guild();
  const b = G.st.guildBank.g_one;
  assert.equal(E.write(R, G.st, { 'guildBank/g_one': { in: b.in, s: b.s + 100000, lb: b.lb, lg: b.lg, t: SV } }, { auth: { uid: 'ann' }, now: T0 }).ok, false, 'spent for nothing');
  assert.equal(G.buy('ann', 1, 100000, { 'guildLog/g_one/l_ann1': { by: 'ann', n: 'ann', k: 'res', g: 100000, b: 'forge2', t: SV } }), 'no', 'a log line naming no node');
  assert.equal(G.buy('ann', 1, 100000), 'ok');
});
