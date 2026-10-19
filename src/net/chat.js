/* Satisfy — party chat and a block list (SAT-ONLINE-016, doc §29 T31). Runs on presence + party.
 *
 * Chat is party-only: a line goes to each other member as a directed `chat.say` message
 * ({to, party, text}), the same way party and duel messages travel (local hub or the Firebase inbox).
 * There is no open chat with strangers: you only talk to people whose party invite you accepted, or
 * who accepted yours.
 *
 * Text is cleaned on both ends (clean()): control and bidi-override characters removed, whitespace
 * collapsed, at most MAX_LEN characters, never half an emoji. The game shows it with textContent only.
 *
 * Block list: players you block are hidden everywhere their messages reach you: chat lines, party
 * invites and duel challenges (party.create / duel.create take the same `blocked(uid)` predicate and
 * drop those silently, so the sender just sees no answer). It is kept on this device
 * (localStorage `satisfy_blocked`), not in the save or the database.
 *
 * Exposes `Satisfy.chat`:
 *   create({ presence, party, uid, now?, blocked? }) -> { say(text), log(), on(fn), C }
 *   blocklist(storage?) -> { has(uid), add(uid, handle), remove(uid), clear(), list() }
 *   clean(text) -> string
 */
(function (root) {
  'use strict';

  var C = Object.freeze({ MAX_LEN: 120, MIN_GAP_MS: 700, BURST: 5, BURST_MS: 10000, LOG: 50 });
  var TYPES = ['chat.say'];
  var KEY = 'satisfy_blocked';

  // C0/C1 controls, zero-width and bidi controls (they can reorder or hide text around them)
  var STRIP = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤⁦-⁩﻿￹-￻]/g;
  function clean(v, max) {
    var s = String(v == null ? '' : v).replace(STRIP, ' ').replace(/\s+/g, ' ').trim();
    max = max || C.MAX_LEN;
    if (s.length <= max) return s;
    var out = '';
    for (var ch of s) { if (out.length + ch.length > max) break; out += ch; }
    return out.trim();
  }

  function create(o) {
    var P = o.presence, party = o.party, self = o.uid, now = o.now || function () { return Date.now(); };
    var blocked = o.blocked || function () { return false; };
    var lines = [], listeners = [], sent = [], seq = 0;

    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function push(line) { lines.push(line); if (lines.length > C.LOG) lines.shift(); emit(line); }
    function others() { return party.members().filter(function (m) { return !m.self && m.uid; }); }

    P.on(function (ev) {
      if (ev.type !== 'message' || ev.env.type !== 'chat.say') return;
      var pl = ev.env.payload || {};
      if (pl.to !== self || typeof pl.party !== 'string' || !party.id() || pl.party !== party.id()) return;
      var from = P.get(ev.sid);
      if (!from || !from.uid || blocked(from.uid)) return;
      // only current members of this party (the leader's view counts accepted members only)
      if (!others().some(function (m) { return m.uid === from.uid; })) return;
      var text = clean(pl.text);
      if (!text) return;
      push({ type: 'line', from: from.uid, handle: from.handle || '?', text: text, t: now(), self: false, n: ++seq });
    });

    return {
      C: C,
      /** Send a line to the party. Returns 'sent', 'empty', 'noParty' or 'tooFast'. */
      say: function (text) {
        var s = clean(text);
        if (!s) return 'empty';
        var to = others();
        if (!party.id() || !to.length) return 'noParty';
        var t = now();
        sent = sent.filter(function (x) { return t - x < C.BURST_MS; });
        if ((sent.length && t - sent[sent.length - 1] < C.MIN_GAP_MS) || sent.length >= C.BURST) return 'tooFast';
        sent.push(t);
        to.forEach(function (m) { P.send('chat.say', { to: m.uid, party: party.id(), text: s }); });
        push({ type: 'line', from: self, handle: null, text: s, t: t, self: true, n: ++seq });
        return 'sent';
      },
      /** The last LOG lines, oldest first. */
      log: function () { return lines.slice(); },
      on: function (fn) { listeners.push(fn); },
    };
  }

  /** The device's block list: {uid: handle} in localStorage (or a given Storage-like object). */
  function blocklist(store) {
    var st = store || null, mem = {};
    if (!st) try { st = typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { st = null; } // blocked site storage throws
    function read() {
      if (!st) return mem;
      try { var v = JSON.parse(st.getItem(KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
    }
    function write(v) { mem = v; if (st) try { st.setItem(KEY, JSON.stringify(v)); } catch (e) { /* full or blocked: kept in memory */ } }
    return {
      has: function (uid) { return !!uid && Object.prototype.hasOwnProperty.call(read(), uid); },
      add: function (uid, handle) { if (!uid) return; var v = read(); v[uid] = clean(handle, 24) || '?'; write(v); },
      remove: function (uid) { var v = read(); delete v[uid]; write(v); },
      clear: function () { write({}); },
      list: function () { var v = read(); return Object.keys(v).map(function (u) { return { uid: u, handle: v[u] }; }); },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.chat = Object.freeze({ create: create, blocklist: blocklist, clean: clean, C: C, TYPES: Object.freeze(TYPES.slice()), KEY: KEY });
})(typeof window !== 'undefined' ? window : globalThis);
