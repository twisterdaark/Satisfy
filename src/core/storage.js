/* Satisfy — local save storage (SAT-ONLINE-001, see docs/architecture/ADR-001-save-storage.md).
 *
 * Classic script, no build step: runs from file://, GitHub Pages and Node (vm).
 * Exposes `Satisfy.storage`. It owns how a save is encoded, read, backed up and migrated;
 * index.html still owns what goes into the save (S and part of P).
 *
 * Save format, unchanged since Patch 3 so older builds can still read it:
 *   localStorage['satisfy_proto_v4'] = JSON {S, P, WS?, fmt?, schema?, savedAt?}
 * WS is the local world state (guilds, territories, legends; SAT-GUILD-001), written next to S and P.
 * The key name is historical. The save's schema version is S.v (currently 5).
 */
(function (root) {
  'use strict';

  var SCHEMA = 5;
  var KEY = 'satisfy_proto_v4';
  var BACKUP_PREFIX = KEY + '.backup.';
  var FMT = 1;

  // Migration ladder. Each step upgrades S/P in place and sets S.v.
  // A save without S.v is treated as schema 4, exactly like the original load().
  var STEPS = [
    {
      to: 5,
      applies: function (v) { return v < 5; },
      // Patch 4: stats were rebalanced (base 10, PTS_LV per level) and the map grew,
      // so allocations are refunded and the player is moved to the Winston spawn.
      run: function (S, P, ctx) {
        S.v = 5;
        S.st = { str: 10, sta: 10, agi: 10, int: 10, dex: 10 };
        S.pts = (S.lv - 1) * ctx.PTS_LV;
        S.zone = '';
        S.vis = Object.assign({ zWin: 1 }, S.vis || {});
        P.x = ctx.spawn.x;
        P.y = ctx.spawn.y;
        P.hp = ctx.maxHP();
      },
    },
  ];

  function schemaOf(data) {
    return (data && data.S && data.S.v) || 4;
  }

  /** Parse a raw save string. Never throws. */
  function decode(raw) {
    if (raw == null) return { status: 'empty', raw: null };
    var data;
    try { data = JSON.parse(raw); } catch (e) { return { status: 'corrupt', raw: raw, error: 'parse' }; }
    if (!data || typeof data !== 'object' || !data.S || typeof data.S !== 'object') {
      return { status: 'corrupt', raw: raw, error: 'shape' };
    }
    return { status: 'ok', raw: raw, data: data, schema: schemaOf(data) };
  }

  /**
   * Serialize the durable part of the game. `now` is injectable for tests.
   * @param {{WS?:object}} [extra] other top-level blocks the game saves (WS: world state)
   */
  function encode(S, P, now, extra) {
    var o = { S: S, P: { x: P.x, y: P.y, hp: P.hp, st: P.st, mp: P.mp, food: P.food } };
    if (extra && extra.WS != null) o.WS = extra.WS;
    o.fmt = FMT;
    o.schema = S.v;
    o.savedAt = now != null ? now : Date.now();
    return JSON.stringify(o);
  }

  /**
   * Upgrade a loaded state in place to SCHEMA.
   * @param {object} S durable state (already merged over freshState defaults)
   * @param {object} P volatile player state
   * @param {{PTS_LV:number, spawn:{x:number,y:number}, maxHP:function():number}} ctx game hooks
   * @returns {number[]} schema versions that were applied
   */
  function migrate(S, P, ctx) {
    var applied = [];
    for (var i = 0; i < STEPS.length; i++) {
      var st = STEPS[i];
      if (st.applies(S.v || 4)) { st.run(S, P, ctx); applied.push(st.to); }
    }
    return applied;
  }

  /**
   * Bind to a Storage-like object (localStorage, or a fake in tests).
   * Every method swallows storage errors (private mode, quota) like the original code did.
   */
  function create(store) {
    function get(k) { try { return store.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { store.setItem(k, v); return true; } catch (e) { return false; } }

    return {
      key: KEY,
      // Same truthiness as the original hasSave(): an empty string is "no save".
      exists: function () { return !!get(KEY); },
      read: function () { return decode(get(KEY)); },
      write: function (S, P, extra) {
        var raw;
        try { raw = encode(S, P, null, extra); } catch (e) { return false; }
        return set(KEY, raw);
      },
      /**
       * Keep a verbatim copy of a save before it can be lost. First copy per reason wins,
       * so the oldest (most valuable) data is never replaced by a later failure.
       */
      backup: function (reason, raw) {
        if (raw == null) return false;
        var k = BACKUP_PREFIX + reason;
        if (get(k) != null) return false;
        return set(k, raw);
      },
      backups: function () {
        var out = {};
        try {
          for (var i = 0; i < store.length; i++) {
            var k = store.key(i);
            if (k && k.indexOf(BACKUP_PREFIX) === 0) out[k.slice(BACKUP_PREFIX.length)] = store.getItem(k);
          }
        } catch (e) { /* ignore */ }
        return out;
      },
    };
  }

  var api = {
    SCHEMA: SCHEMA,
    KEY: KEY,
    BACKUP_PREFIX: BACKUP_PREFIX,
    FMT: FMT,
    decode: decode,
    encode: encode,
    migrate: migrate,
    create: create,
  };

  var ns = root.Satisfy = root.Satisfy || {};
  ns.storage = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
