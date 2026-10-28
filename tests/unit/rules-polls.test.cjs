'use strict';
// U306 Community board polls (SAT-ONLINE-173): backend/database.rules.json itself, through the rules evaluator.
//   - only an admin posts a poll (2 to 4 answers, open at most 30 days);
//   - an account with an account ID votes once, for an answer the open poll has, raising that answer's count by one in
//     the same write; nobody raises a count alone or votes twice; a closed poll takes no vote;
//   - a vote is read by its own account alone; the polls and the counts by everyone signed in.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../harness/rules-eval.cjs');

const R = E.load(process.env.SATISFY_RULES || undefined), SV = E.SV, NOW = 1767606030000;

test('polls: the owner asks, each account votes once, the counts rise one by one, a vote is private', () => {
  let st = { admins: { boss: true }, accountIds: { boss: 'Twister', ann: 'Ann', bob: 'Bob' } };
  const w = (uid, u, now = NOW) => { const r = E.write(R, st, u, { auth: uid ? { uid } : null, now }); if (r.ok) st = r.after; return r.ok ? 'ok' : 'no'; };
  const poll = (by, o = { 0: { ar: 'أ', en: 'A' }, 1: { ar: 'ب', en: 'B' }, 2: { ar: 'ج', en: 'C' } }, end = NOW + 86400000) => ({ q: { ar: 'سؤال', en: 'Q?' }, o, end, by, t: SV });
  // posting
  assert.equal(w('ann', { 'polls/p1': poll('ann') }), 'no', 'a player');
  assert.equal(w('boss', { 'polls/p1': poll('boss', { 0: { ar: 'أ', en: 'A' } }) }), 'no', 'one answer');
  assert.equal(w('boss', { 'polls/p1': poll('boss', undefined, NOW + 40 * 86400000) }), 'no', 'longer than 30 days');
  assert.equal(w('boss', { 'polls/p1': poll('boss') }), 'ok', 'the owner');
  // voting
  assert.equal(w('ann', { 'pollVotes/p1/ann': '1', 'pollTally/p1/1': 1 }), 'ok', 'a vote and its count');
  assert.equal(w('ann', { 'pollVotes/p1/ann': '2', 'pollTally/p1/2': 1 }), 'no', 'twice');
  assert.equal(w('bob', { 'pollTally/p1/0': 1 }), 'no', 'a count alone');
  assert.equal(w('bob', { 'pollVotes/p1/bob': '0' }), 'no', 'a vote without its count');
  assert.equal(w('bob', { 'pollVotes/p1/bob': '1', 'pollTally/p1/1': 5 }), 'no', 'a count by more than one');
  assert.equal(w('bob', { 'pollVotes/p1/bob': '3', 'pollTally/p1/3': 1 }), 'no', 'an answer the poll does not have');
  assert.equal(w('bob', { 'pollVotes/p1/bob': 1, 'pollTally/p1/1': 2 }), 'no', 'the answer as a number, not its key');
  assert.equal(w('bob', { 'pollVotes/p1/ann': '0', 'pollTally/p1/0': 1 }), 'no', 'for someone else');
  assert.equal(w('guest', { 'pollVotes/p1/guest': '0', 'pollTally/p1/0': 1 }), 'no', 'no account ID');
  assert.equal(w('bob', { 'pollVotes/p1/bob': '1', 'pollTally/p1/1': 2 }), 'ok', 'the second vote for B');
  assert.equal(w('boss', { 'pollVotes/p1/boss': '0', 'pollTally/p1/0': 1 }, NOW + 2 * 86400000), 'no', 'after it closed');
  assert.deepEqual(st.pollTally.p1, { 1: 2 });
  // reading
  const r = (uid, p) => E.read(R, st, p, { auth: uid ? { uid } : null, now: NOW }) ? 'ok' : 'no';
  assert.equal(r('bob', 'pollVotes/p1/bob'), 'ok', 'your own vote');
  assert.equal(r('bob', 'pollVotes/p1/ann'), 'no', "someone else's vote");
  assert.equal(r('bob', 'pollVotes/p1'), 'no', 'all the votes');
  assert.equal(r('bob', 'pollTally/p1'), 'ok', 'the counts');
  assert.equal(r('bob', 'polls'), 'ok', 'the polls');
  assert.equal(r(null, 'polls'), 'no', 'signed out');
});
