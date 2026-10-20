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
 * World chat (SAT-ONLINE-026, owner feedback 10): with `world` (the transport's world channel: {sayWorld(msg), world(fn)})
 * say(text, 'all') reaches everyone signed in, separate from the party lines. Lines carry ch: 'party' | 'all'.
 * The sender's name is its account ID (`handle()`), which the database rules check against accountIds.
 *
 * Guild chat (SAT-ONLINE-049): with `guild` ({inGuild(), sayGuild(msg), guildLines(fn)}) say(text, 'guild') goes to the
 * guild's feed in the database; only members read it (the rules). Lines carry ch: 'guild'.
 *
 * Whispers (SAT-ONLINE-070): with `whisper` ({say(uid, msg), lines(fn)}) sayTo(uid, name, text) sends one friend a line
 * through the database (the rules take it only from a friend); lines carry ch: 'w' and `to` (the name) on your own.
 *
 * Exposes `Satisfy.chat`:
 *   create({ presence, party, uid, now?, blocked?, world?, guild?, handle? }) -> { say(text, ch?), log(), on(fn), C }
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
    var lines = [], listeners = [], sent = [], seq = 0, world = o.world || null, guild = o.guild || null, whisper = o.whisper || null, handle = o.handle || function () { return ''; };
    function slow(t) { sent = sent.filter(function (x) { return t - x < C.BURST_MS; }); return (sent.length && t - sent[sent.length - 1] < C.MIN_GAP_MS) || sent.length >= C.BURST; }

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
      push({ type: 'line', ch: 'party', from: from.uid, handle: from.handle || '?', text: text, t: now(), self: false, n: ++seq });
    });
    if (world && world.world) world.world(function (m) {
      if (!m || typeof m.from !== 'string' || m.from === self || blocked(m.from)) return;
      var text = clean(m.text);
      if (!text) return;
      push({ type: 'line', ch: 'all', from: m.from, handle: clean(m.h, 24) || '?', text: text, t: now(), self: false, n: ++seq });
    });

    if (whisper && whisper.lines) whisper.lines(function (m) {
      if (!m || typeof m.from !== 'string' || m.from === self || blocked(m.from)) return;
      var text = clean(m.text);
      if (!text) return;
      push({ type: 'line', ch: 'w', from: m.from, handle: clean(m.h, 24) || '?', text: text, t: now(), self: false, n: ++seq });
    });

    if (guild && guild.guildLines) guild.guildLines(function (m) {
      if (!m || typeof m.from !== 'string' || m.from === self || blocked(m.from)) return;
      var text = clean(m.text);
      if (!text) return;
      push({ type: 'line', ch: 'guild', from: m.from, handle: clean(m.h, 24) || '?', text: text, t: now(), self: false, n: ++seq });
    });

    return {
      C: C,
      /** Send a line to the party (ch 'all': to everyone; 'guild': to the guild). Returns 'sent', 'empty', 'noParty', 'noWorld', 'noGuild' or 'tooFast'. */
      say: function (text, ch) {
        var s = clean(text);
        if (!s) return 'empty';
        var all = ch === 'all', gd = ch === 'guild', to = all || gd ? [] : others();
        if (gd ? !(guild && guild.sayGuild && guild.inGuild && guild.inGuild()) : all ? !(world && world.sayWorld) : !party.id() || !to.length) return gd ? 'noGuild' : all ? 'noWorld' : 'noParty';
        var t = now();
        if (slow(t)) return 'tooFast';
        sent.push(t);
        if (gd) guild.sayGuild({ from: self, h: handle(), text: s });
        else if (all) world.sayWorld({ from: self, h: handle(), text: s });
        else to.forEach(function (m) { P.send('chat.say', { to: m.uid, party: party.id(), text: s }); });
        push({ type: 'line', ch: gd ? 'guild' : all ? 'all' : 'party', from: self, handle: null, text: s, t: t, self: true, n: ++seq });
        return 'sent';
      },
      /** A whisper to one friend (SAT-ONLINE-070). Returns 'sent', 'empty', 'noWhisper' or 'tooFast'. */
      sayTo: function (uid, name, text) {
        var s = clean(text);
        if (!s) return 'empty';
        if (!whisper || !whisper.say || !uid) return 'noWhisper';
        var t = now();
        if (slow(t)) return 'tooFast';
        sent.push(t);
        whisper.say(uid, { from: self, h: handle(), text: s });
        push({ type: 'line', ch: 'w', from: self, handle: null, to: clean(name, 24) || '?', text: s, t: t, self: true, n: ++seq });
        return 'sent';
      },
      /** A world or server notice as a line of its own (ch 'sys', SAT-ONLINE-041): local only, nothing is sent. */
      note: function (text) {
        var s = clean(text, 200);
        if (!s) return false;
        push({ type: 'line', ch: 'sys', from: null, handle: '', text: s, t: now(), self: false, n: ++seq });
        return true;
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
