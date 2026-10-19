/* Satisfy — domain events (SAT-ONLINE-005, doc §05 R0.5, §10 "quest credit as domain events").
 *
 * Classic script, exposes `Satisfy.events`. The game reports what happened (a kill, a craft, a
 * quest reward claimed) as an event; nothing reads them for gameplay yet. They are the requests a
 * server will receive once kills, crafts and rewards are authoritative (doc §10, §26 PR10 ledger):
 *
 *   { id, key, type, pid, at, payload }
 *   id       uuid v4, unique per request (retries of the same request reuse it)
 *   key      idempotency key, or null: the same game fact always gets the same key, so a ledger
 *            applies it once even if it arrives twice. `emit` drops a second event with a key it
 *            has already seen in this session and returns null.
 *   type     one of TYPES
 *   pid      the character (S.pid, Satisfy.ids), null on the title screen
 *   at       game clock (S.playT seconds) when it happened
 *
 * The log is in memory only (last LOG_MAX events). Nothing here is saved, so it can't change a save.
 */
(function (root) {
  'use strict';

  var TYPES = ['monster.kill', 'craft.item.created', 'quest.reward.claimed'];
  var LOG_MAX = 200;
  var SEEN_MAX = 2000;

  /**
   * @param {{uuid:function():string, pid?:function():(string|null), now?:function():number}} deps
   */
  function create(deps) {
    if (!deps || typeof deps.uuid !== 'function') throw new Error('events: deps.uuid required');
    var log = [], seen = [], seenSet = Object.create(null), subs = [];
    var pid = deps.pid || function () { return null; };
    var now = deps.now || function () { return 0; };

    function remember(key) {
      seenSet[key] = 1;
      seen.push(key);
      if (seen.length > SEEN_MAX) delete seenSet[seen.shift()];
    }

    /** @returns {object|null} the event, or null if `key` was already emitted */
    function emit(type, payload, key) {
      if (TYPES.indexOf(type) < 0) throw new Error('events: unknown type ' + type);
      if (key != null) {
        key = String(key);
        if (seenSet[key]) return null;
        remember(key);
      }
      var ev = { id: deps.uuid(), key: key == null ? null : key, type: type, pid: pid() || null,
        at: Math.round((+now() || 0) * 10) / 10, payload: JSON.parse(JSON.stringify(payload || {})) };
      log.push(ev);
      if (log.length > LOG_MAX) log.shift();
      for (var i = 0; i < subs.length; i++) { try { subs[i](ev); } catch (e) { /* a listener can't break the game */ } }
      return ev;
    }

    return {
      emit: emit,
      /** Listen to new events; returns an unsubscribe function. */
      on: function (fn) { subs.push(fn); return function () { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; },
      /** Copies of the logged events, oldest first. */
      log: function () { return log.map(function (e) { return JSON.parse(JSON.stringify(e)); }); },
      seen: function (key) { return !!seenSet[String(key)]; },
      /** Forget everything (a new game or a load starts a new session). */
      reset: function () { log.length = 0; seen.length = 0; seenSet = Object.create(null); },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.events = Object.freeze({ TYPES: Object.freeze(TYPES.slice()), LOG_MAX: LOG_MAX, create: create });
})(typeof window !== 'undefined' ? window : globalThis);
