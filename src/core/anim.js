/* Satisfy — an animation state machine per entity (SAT-ONLINE-114, plan U312).
 *
 * One machine says which animation an entity shows now: dead, dodge, hurt, attack, walk or idle, the first of these
 * that is on. Two kinds of state:
 *   held:  on until set off (dead, dodge, walk): set(name, on)
 *   timed: on for a while from a moment (attack, hurt): pulse(name, t, ms?); a new pulse while one runs extends it
 * Time is whatever clock the caller passes in (the game's time in ms), never the wall clock, and nothing is scheduled:
 * a timed state ends because its time is past when state(t) is asked, so there is no timeout to outlive the entity,
 * the session or a replay (the plan's check: no orphan timeouts). A timed state of lower rank keeps its own end, so an
 * attack that started under a hurt shows when the hurt ends, if it is still running.
 *
 * Exposes `Satisfy.anim`:
 *   create(defs?) -> { set(name, on), pulse(name, t, ms?), state(t), on(name, t), left(name, t), blink(t), clear(), defs }
 *   DEFS: { name: { rank, ms? } } (ms: a timed state's default length)
 */
(function (root) {
  'use strict';

  var DEFS = Object.freeze({
    dead: Object.freeze({ rank: 5 }),
    dodge: Object.freeze({ rank: 4 }),
    hurt: Object.freeze({ rank: 3, ms: 240 }),
    attack: Object.freeze({ rank: 2, ms: 230 }),
    walk: Object.freeze({ rank: 1 }),
    idle: Object.freeze({ rank: 0 }),
  });
  var BLINK_MS = 50; // a hurt entity is drawn flashing, every other 50 ms

  function create(defs) {
    defs = defs || DEFS;
    var order = Object.keys(defs).sort(function (a, b) { return defs[b].rank - defs[a].rank; });
    var held = {}, until = {}, from = {};
    function known(name) { return Object.prototype.hasOwnProperty.call(defs, name); }
    function on(name, t) { return !!held[name] || (until[name] != null && t < until[name]); }
    return {
      defs: defs,
      /** A held state on or off. */
      set: function (name, v) { if (known(name)) held[name] = !!v; },
      /** A timed state from t for ms (its default length when left out); extends one that is still on. */
      pulse: function (name, t, ms) {
        if (!known(name) || typeof t !== 'number' || !isFinite(t)) return;
        var len = typeof ms === 'number' && ms > 0 ? ms : (defs[name].ms || 0), end = t + len;
        if (!(until[name] != null && t < until[name])) from[name] = t;
        if (until[name] == null || end > until[name] || t >= until[name]) until[name] = end;
      },
      /** The state shown at t: the highest-ranked one that is on (the lowest, idle, when none is). */
      state: function (t) {
        for (var i = 0; i < order.length; i++) if (on(order[i], t)) return order[i];
        return order[order.length - 1];
      },
      on: on,
      /** ms left of a timed state at t (0 when it is off). */
      left: function (name, t) { return until[name] != null && t < until[name] ? until[name] - t : 0; },
      /** Whether to draw the hurt flash at t: hurt is on and this is a flash frame. */
      blink: function (t) { return on('hurt', t) && Math.floor((t - (from.hurt || 0)) / BLINK_MS) % 2 === 0; },
      /** Everything off (a respawn, a new session). */
      clear: function () { held = {}; until = {}; from = {}; },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.anim = Object.freeze({ create: create, DEFS: DEFS, BLINK_MS: BLINK_MS });
})(typeof window !== 'undefined' ? window : globalThis);
