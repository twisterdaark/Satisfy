/* Satisfy — the National Competition (SAT-ONLINE-064, Claude-B #13 item 25). A world event in three stages between
 * players, on the server clock: every PERIOD it runs for three STAGEs, hunting (monsters killed), production (items
 * crafted) and the arena (duels online), each scored by its own rule. The board is the total; when it ends, every
 * player who scored is paid once by its rank (nat/{id}/{uid} the scores, natPaid/{id}/{uid} the payment).
 * Pure functions here; the game keeps the scores and the database (index.html). Not cheat-proof: each player writes
 * its own scores, only upward (D3).
 */
(function (root) {
  'use strict';

  var C = Object.freeze({
    PERIOD: 6 * 3600000,   // one competition every six hours (server time; owner 2026-10-22: was every two) ...
    OFFSET: 0,             // ... at 00:00, 06:00, 12:00, 18:00 UTC: the castle siege is at the odd hours (SIEGO 1 h)
    STAGE: 10 * 60000,     // three stages of ten minutes
    STAGES: ['hunt', 'craft', 'duel'],
    HUNT_LV: 5,            // a kill scores its monster's level / HUNT_LV (at least 1) ...
    HUNT_BOSS: 10,         // ... times this for a boss
    CRAFT: 5,              // an item scores CRAFT x 2^rating (Normal 5 ... Legendary 80)
    WIN: 50, LOSS: 10,     // a duel online
    FOE_MAX: 3,            // duels against the same player that score, per competition
    TOP_N: 10,
    PRIZE: [20000, 10000, 5000], // gold for ranks 1-3 ...
    TOP_GOLD: 2000,        // ... and 4-10
    BASE: 200,             // everyone who scored: BASE + a gold per point, at most PER_MAX
    PER_MAX: 2000,
    CLAIM_MS: 30000,       // pay this long after the end, once the last scores are in
  });

  /** Where the competition is at server time t (forced: a test's start time). */
  function now(t, forced) {
    var start, sl;
    if (forced) { start = forced; sl = Math.floor((forced - C.OFFSET) / C.PERIOD); }
    else { sl = Math.floor((t - C.OFFSET) / C.PERIOD); start = sl * C.PERIOD + C.OFFSET; }
    var into = t - start, end = start + C.STAGE * C.STAGES.length;
    var o = { id: 'n' + sl, start: start, end: end, next: forced ? end + C.PERIOD : start + C.PERIOD, running: into >= 0 && t < end };
    if (o.running) { o.stage = Math.floor(into / C.STAGE); o.kind = C.STAGES[o.stage]; o.stageEnd = start + (o.stage + 1) * C.STAGE; }
    else o.stage = -1;
    return o;
  }
  function huntPts(lv, boss) { return Math.max(1, Math.round((+lv || 0) / C.HUNT_LV)) * (boss ? C.HUNT_BOSS : 1); }
  function craftPts(r) { return C.CRAFT * Math.pow(2, Math.max(0, Math.min(4, r | 0))); }
  /** A duel online; `before`: duels already counted against that foe this competition. */
  function duelPts(win, before) { return before >= C.FOE_MAX ? 0 : win ? C.WIN : C.LOSS; }
  /** The gold for a total and a rank on the board (1-based; 0 = not in the top TOP_N). */
  function reward(rank, total) {
    if (!(total > 0)) return 0;
    var g = C.BASE + Math.min(C.PER_MAX, Math.round(total));
    if (rank >= 1 && rank <= C.PRIZE.length) g += C.PRIZE[rank - 1];
    else if (rank >= 1 && rank <= C.TOP_N) g += C.TOP_GOLD;
    return g;
  }
  /** A board entry as the rules keep it, or null. */
  function clean(v) {
    if (!v || typeof v !== 'object') return null;
    var o = { h: v.h | 0, c: v.c | 0, d: v.d | 0, n: String(v.n || '?').slice(0, 24) };
    if (o.h < 0 || o.c < 0 || o.d < 0) return null;
    o.s = o.h + o.c + o.d;
    return o;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.natcomp = Object.freeze({ C: C, now: now, huntPts: huntPts, craftPts: craftPts, duelPts: duelPts, reward: reward, clean: clean });
})(typeof window !== 'undefined' ? window : globalThis);
