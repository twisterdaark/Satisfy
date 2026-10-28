'use strict';
// U290 Blacksmith expo (SAT-ONLINE-174): backend/database.rules.json itself, through the rules evaluator.
//   - a season is 30 days on the server's clock; an account with an account ID enters one creation a season, and only
//     into the season that is running;
//   - a vote: once a season, never for your own creation, only for an entry of the running season, and its count rises by
//     one in the same write; nobody raises a count alone;
//   - alts (plan: "alts don't mass-vote"): a voter needs an account ID, a level 10 profile, and an account first seen
//     before the season began (or before the expo opened); an account made during the season waits for the next one;
//   - firstSeen is written once, at the server's time; a vote is read by its own account alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV;
const P = 2592000000, O = 2419200000, DAY = 86400000, OPEN = 1794700800000;
const season = (now) => Math.floor((now - O) / P), start = (now) => O + season(now) * P;
const NOW = start(OPEN) + 3 * P + 10 * DAY; // ten days into a season after the expo opened

test('the expo: one entry a season, protected votes, the counts one by one, alts kept out', () => {
  const p = season(NOW), ps = String(p), s0 = start(NOW);
  let st = {
    accountIds: { ann: 'Ann', bob: 'Bob', cid: 'Cid', dan: 'Dan', eve: 'Eve' },
    profiles: { ann: { lv: 40 }, bob: { lv: 12 }, cid: { lv: 30 }, dan: { lv: 3 }, eve: { lv: 50 }, fay: { lv: 50 } },
    firstSeen: { ann: s0 - 90 * DAY, bob: s0 - DAY, cid: s0 + 2 * DAY, dan: s0 - 90 * DAY, fay: s0 - 90 * DAY },
  };
  const w = (uid, u, now = NOW) => { const r = E.write(R, st, u, { auth: uid ? { uid } : null, now }); if (r.ok) st = r.after; return r.ok ? 'ok' : 'no'; };
  const entry = (o = {}) => Object.assign({ p, n: 'Blue Fang', by: 'Ann', ty: 'gs', L: 70, W: 40, C: 10, sl: 5, mats: { blue: 2, ore: 4 }, t: SV }, o);
  // entering
  assert.equal(w('fay', { ['expo/' + ps + '/fay']: entry({ by: 'Fay' }) }), 'no', 'no account ID');
  assert.equal(w('ann', { ['expo/' + ps + '/bob']: entry() }), 'no', 'as someone else');
  assert.equal(w('ann', { ['expo/' + String(p - 1) + '/ann']: entry({ p: p - 1 }) }), 'no', 'into last season');
  assert.equal(w('ann', { ['expo/' + ps + '/ann']: entry({ ty: 'zz' }) }), 'no', 'a kind that does not exist');
  assert.equal(w('ann', { ['expo/' + ps + '/ann']: entry({ L: 140 }) }), 'no', 'a shape out of range');
  assert.equal(w('ann', { ['expo/' + ps + '/ann']: entry({ gold: 5 }) }), 'no', 'a field the expo does not have');
  assert.equal(w('ann', { ['expo/' + ps + '/ann']: entry() }), 'ok', 'an entry');
  assert.equal(w('ann', { ['expo/' + ps + '/ann']: entry({ n: 'Other' }) }), 'no', 'a second entry');
  assert.equal(w('bob', { ['expo/' + ps + '/bob']: entry({ n: 'Oak Bow', by: 'Bob', ty: 'bw' }) }), 'ok', 'another entry');
  // voting
  const vote = (uid, e, n) => ({ ['expoVotes/' + ps + '/' + uid]: e, ['expoTally/' + ps + '/' + e]: n });
  assert.equal(w('ann', vote('ann', 'ann', 1)), 'no', 'for your own creation');
  assert.equal(w('dan', vote('dan', 'ann', 1)), 'no', 'a level 3 profile');
  assert.equal(w('cid', vote('cid', 'ann', 1)), 'no', 'an account first seen during this season');
  assert.equal(w('eve', vote('eve', 'ann', 1)), 'no', 'an account never seen');
  assert.equal(w('fay', vote('fay', 'ann', 1)), 'no', 'no account ID');
  assert.equal(w('bob', { ['expoTally/' + ps + '/ann']: 1 }), 'no', 'a count alone');
  assert.equal(w('bob', { ['expoVotes/' + ps + '/bob']: 'ann' }), 'no', 'a vote without its count');
  assert.equal(w('bob', vote('bob', 'ann', 3)), 'no', 'a count by more than one');
  assert.equal(w('bob', vote('bob', 'nobody', 1)), 'no', 'for an entry that does not exist');
  assert.equal(w('bob', vote('ann', 'bob', 1)), 'no', 'for someone else');
  assert.equal(w('bob', vote('bob', 'ann', 1)), 'ok', 'a vote and its count');
  assert.equal(w('bob', vote('bob', 'ann', 2)), 'no', 'twice');
  assert.equal(w('ann', vote('ann', 'bob', 1)), 'ok', "Ann's for Bob");
  assert.deepEqual(st.expoTally[ps], { ann: 1, bob: 1 });
  // last season: closed for votes
  st.expo[String(p - 1)] = { bob: entry({ p: p - 1, by: 'Bob' }) };
  assert.equal(w('ann', { ['expoVotes/' + String(p - 1) + '/ann']: 'bob', ['expoTally/' + String(p - 1) + '/bob']: 1 }), 'no', 'last season');
  // next season: the account first seen in this one votes
  const N2 = NOW + P, q = String(season(N2));
  assert.equal(w('bob', { ['expo/' + q + '/bob']: entry({ p: season(N2), by: 'Bob' }) }, N2), 'ok');
  assert.equal(w('cid', { ['expoVotes/' + q + '/cid']: 'bob', ['expoTally/' + q + '/bob']: 1 }, N2), 'ok', 'Cid, a season later');
  // firstSeen: once, at the server's time
  assert.equal(w('eve', { 'firstSeen/eve': 5 }), 'no', 'a made-up time');
  assert.equal(w('eve', { 'firstSeen/ann': SV }), 'no', "someone else's");
  assert.equal(w('eve', { 'firstSeen/eve': SV }), 'ok');
  assert.equal(w('eve', { 'firstSeen/eve': SV }), 'no', 'again');
  // reading
  const r = (uid, path) => E.read(R, st, path, { auth: uid ? { uid } : null, now: NOW }) ? 'ok' : 'no';
  assert.equal(r('bob', 'expoVotes/' + ps + '/bob'), 'ok', 'your own vote');
  assert.equal(r('bob', 'expoVotes/' + ps + '/ann'), 'no', "someone else's vote");
  assert.equal(r('bob', 'expoVotes/' + ps), 'no', 'all the votes');
  assert.equal(r('bob', 'expoTally/' + ps), 'ok', 'the counts');
  assert.equal(r('bob', 'expo/' + ps), 'ok', 'the entries');
  assert.equal(r(null, 'expo/' + ps), 'no', 'signed out');
  assert.equal(r('bob', 'firstSeen/ann'), 'no', "someone else's first time");
});

test('the expo before it opened: an account first seen before the opening day votes in its first season', () => {
  const N = start(OPEN) + 5 * DAY, p = season(N), ps = String(p);
  let st = { accountIds: { ann: 'Ann', bob: 'Bob' }, profiles: { bob: { lv: 20 } }, firstSeen: { bob: N - DAY } };
  const w = (uid, u) => { const r = E.write(R, st, u, { auth: { uid }, now: N }); if (r.ok) st = r.after; return r.ok ? 'ok' : 'no'; };
  assert.equal(w('ann', { ['expo/' + ps + '/ann']: { p, n: 'X', by: 'Ann', ty: 'hm', L: 0, W: 100, C: 50, sl: 1, mats: { ore: 6 }, t: SV } }), 'ok');
  assert.ok(N - DAY > start(N) && N - DAY < OPEN, 'first seen in this season, before the opening day');
  assert.equal(w('bob', { ['expoVotes/' + ps + '/bob']: 'ann', ['expoTally/' + ps + '/ann']: 1 }), 'ok');
});
