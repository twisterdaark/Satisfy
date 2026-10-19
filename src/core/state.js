/* Satisfy — state classes (SAT-ONLINE-005, doc §05 R0.4, §26 PR3 "state adapters").
 *
 * Classic script, exposes `Satisfy.state`. It only *describes* the game's state; index.html still
 * owns S and P. Every key the game stores in S has exactly one class:
 *
 *   durable  character progress: level, xp, gold, items, mats, quests, unlocks, world flags.
 *            This is what a cloud profile (doc §23 profiles/{uid}) will hold, and what a server
 *            will own once it is authoritative.
 *   session  saved in the local save so a reload feels the same, but never shared or trusted:
 *            timers and cooldowns, the current zone banner, one-shot buffs, the forest raid flag
 *            (doc: "S.raid ... not permanent shared truth"), board offers not yet accepted.
 *   meta     bookkeeping: schema/map versions, the local item counter, the character id (S.pid).
 *
 * P (position, hp/mp/stamina, facing, cooldowns) is volatile: the save keeps P_SAVED so a reload
 * puts you back where you were, but online it is session data, never a profile field.
 * UI state (mode, dialogs, fx, damage numbers, cutscenes, allies) is ephemeral and is never saved.
 * WS (guilds, territories, legends; SAT-GUILD-001) is *world* state, not character state: offline it
 * is saved beside S, online it is shared truth that only a server may change. It is not in S.
 *
 * Unknown S keys count as durable, so nothing is ever dropped. tests/unit/state.test.cjs scans
 * index.html and fails if a key the game writes isn't listed here: add new keys to one list.
 */
(function (root) {
  'use strict';

  var DURABLE = [
    // identity and progress
    'look', 'cls', 'lv', 'xp', 'adv', 'title', 'tl', 'st', 'pts', 'hid', 'sk', 'mast', 'balK', 'playT',
    // wallet and inventory
    'gold', 'bread', 'hpot', 'mpot', 'mats', 'arrows', 'arrowsMade', 'sold', 'items', 'eqW', 'eqA',
    // crafting (the Blacksmith's ladder)
    'made', 'smith', 'sxp', 'patience', 'bonus', 'got', 'firstLeg',
    // quests, NPC memory, world flags, discovery
    'qs', 'bqa', 'qOff', 'kills', 'met', 'ev', 'guardDown', 'vis', 'books', 'chest', 'chops', 'hag', 'burnSeen',
    // equipment slots, skill bar, NPC affinity and town reputation, guild membership, companion, life skills
    'eq', 'bar', 'aff', 'rep', 'guild', 'comp', 'life',
    // mounts and pets owned/active (SAT-MOUNT), the daily arena lockout (a date, so it must sync)
    'mounts', 'mount', 'pets', 'pet', 'arenaDay',
    // achievements earned (SAT-ACH-001), arena wins and the highest level ever reached (SAT-RANK-001),
    // today's daily bounties and streak (SAT-DAILY-001; a date inside, so it must sync)
    'ach', 'arW', 'peak', 'dly',
    // costumes owned (SAT-STYLE-001), pet growth (SAT-PETLV-001), best Tower of Trials floor (SAT-TOWER-001)
    'cos', 'petx', 'twB',
    // the inn you are bound to respawn at (main 6991032)
    'bind',
    // mount health and fallen mounts (main 5173f0f), field encounters met (main e68e501)
    'mhp', 'mdead', 'meetN',
    // Muller's trial done (SAT-MULLER-001)
    'mtr',
    // duel record (SAT-ONLINE-006): {w, l}; party-raid encounters already paid (SAT-ONLINE-009)
    'duels', 'raidDone',
    // recipes learned and recipe use counts (main rcLearn)
    'rcK', 'rcN',
    // map cells seen (fog of war, Nitro's feedback): base64 bitset
    'fog', 'sec', 'respec', 'bank',
    // skill use counts that set each skill's level (owner 2026-10-19)
    'skx',
  ];
  var SESSION = ['raid', 'hits', 'focus', 'zone', 'immT', 'swT', 'unstT', 'giftT', 'bq', 'bqT'];
  var META = ['v', 'wv', 'uid', 'pid'];
  // Never saved: set on the title-screen demo state only.
  var TRANSIENT = ['__demo'];

  var P_SAVED = ['x', 'y', 'hp', 'st', 'mp', 'food'];
  var UI_EPHEMERAL = ['mode', 'dialog', 'fx', 'nums', 'smoke', 'shake', 'noise', 'MG', 'CARD', 'SM', 'movers', 'allies', 'proj'];

  var CLASS = Object.create(null);
  [['durable', DURABLE], ['session', SESSION], ['meta', META], ['transient', TRANSIENT]].forEach(function (p) {
    p[1].forEach(function (k) {
      if (CLASS[k]) throw new Error('state key in two classes: ' + k);
      CLASS[k] = p[0];
    });
  });

  /** 'durable' | 'session' | 'meta' | 'transient'; unknown keys are 'durable'. */
  function classOf(key) { return CLASS[key] || 'durable'; }
  function known(key) { return !!CLASS[key]; }

  function copy(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  /** Split S into deep copies by class, plus the keys this module doesn't list. */
  function split(S) {
    var out = { durable: {}, session: {}, meta: {}, unknown: [] };
    if (!S) return out;
    Object.keys(S).forEach(function (k) {
      var c = classOf(k);
      if (c === 'transient') return;
      if (!known(k)) out.unknown.push(k);
      out[c][k] = copy(S[k]);
    });
    return out;
  }

  /**
   * The part of a character a cloud profile would hold: durable keys plus its ids.
   * Plain JSON, safe to keep or send; P and session data are never in it.
   */
  function profileOf(S) {
    var s = split(S);
    return { pid: S && S.pid || null, schema: S && S.v || null, durable: s.durable };
  }

  var api = {
    DURABLE: Object.freeze(DURABLE.slice()),
    SESSION: Object.freeze(SESSION.slice()),
    META: Object.freeze(META.slice()),
    TRANSIENT: Object.freeze(TRANSIENT.slice()),
    P_SAVED: Object.freeze(P_SAVED.slice()),
    UI_EPHEMERAL: Object.freeze(UI_EPHEMERAL.slice()),
    classOf: classOf,
    known: known,
    split: split,
    profileOf: profileOf,
  };

  var ns = root.Satisfy = root.Satisfy || {};
  ns.state = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
