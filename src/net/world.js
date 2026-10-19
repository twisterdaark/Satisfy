/* Satisfy — world chat and world notices (SAT-ONLINE-028, owner feedback #10, #12). Runs on presence.
 *
 * World chat: lines for everyone online, kept apart from party chat (the game shows them in a World tab).
 * World notices: the game's world-scope announcements (a legendary class taken, the day's champion, a world boss
 * down, a castle taken...) reach every online player, who shows them in their own language: a notice travels as a
 * string key from NOTE_KEYS plus its parameters, never as free text.
 *
 * Transport: with Firebase, `world/{shard}/{pushId} = {from, h, ty: 'say'|'note', x, t}` through transport.worldSend /
 * transport.onWorld (the rules check `from` is the writer; see backend/database.rules.json). The local transport (tabs
 * on one machine) has no such path, so there the same lines go out as presence broadcasts 'world.say' / 'world.note'.
 * Either way text is cleaned on both ends (Satisfy.chat.clean), blocked players are hidden, and sending is rate-limited
 * here (the database can't count; a modified client could still flood the channel, see docs/online/COST_MODEL.md).
 *
 * Exposes `Satisfy.world`:
 *   create({ presence, transport?, uid, handle?: () => string, now?, blocked? }) -> { say(text), note(k, p), log(), on(fn) }
 *     say -> 'sent' | 'empty' | 'tooFast'; events: {type:'line', ...} (also kept in log()) and {type:'note', k, p, handle}
 *   NOTE_KEYS, C
 */
(function (root) {
  'use strict';

  var C = Object.freeze({ MAX_LEN: 120, MIN_GAP_MS: 1500, BURST: 4, BURST_MS: 15000, LOG: 60, MAX_X: 240 });
  // STR keys of the game's world announcements that are worth telling everyone (index.html announce())
  var NOTE_KEYS = ['drDown', 'arnChamp', 'twrRec', 'noeDrop', 'sgStart', 'sgWon', 'evBossDown', 'annGuard', 'terrWon',
    'annSaint', 'annBraham', 'annPagma', 'craftLeg', 'annLeg', 'annGrid'];

  var CH = root.Satisfy && root.Satisfy.chat; // src/net/chat.js loads first: its clean() (controls, bidi, whole emoji)
  function clean(v, max) { return CH ? CH.clean(v, max) : String(v == null ? '' : v).trim().slice(0, max || C.MAX_LEN); }
  /** {k, p} from the wire, or null: the key must be listed and the parameters short plain strings. */
  function parseNote(x) {
    var v;
    try { v = JSON.parse(String(x)); } catch (e) { return null; }
    if (!v || typeof v !== 'object' || NOTE_KEYS.indexOf(v.k) < 0) return null;
    var p = {}, src = v.p && typeof v.p === 'object' ? v.p : {};
    for (var k in src) if (/^[a-z]{1,8}$/.test(k) && (typeof src[k] === 'string' || typeof src[k] === 'number')) p[k] = clean(String(src[k]), 48);
    return { k: v.k, p: p };
  }

  function create(o) {
    var P = o.presence, tr = o.transport || null, self = o.uid, now = o.now || function () { return Date.now(); };
    var blocked = o.blocked || function () { return false; }, handle = o.handle || function () { return ''; };
    var fb = !!(tr && typeof tr.worldSend === 'function');
    var lines = [], listeners = [], sent = [], seq = 0;

    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function push(l) { lines.push(l); if (lines.length > C.LOG) lines.shift(); emit(l); }
    function got(from, h, ty, x) {
      if (typeof from !== 'string' || !from || from === self || blocked(from)) return;
      var name = clean(h, 24) || '?';
      if (ty === 'say') {
        var text = clean(x);
        if (text) push({ type: 'line', from: from, handle: name, text: text, t: now(), self: false, n: ++seq });
      } else if (ty === 'note') {
        var nt = parseNote(x);
        if (nt) emit({ type: 'note', from: from, handle: name, k: nt.k, p: nt.p });
      }
    }
    if (fb) tr.onWorld(function (m) { if (m && typeof m === 'object') got(m.from, m.h, m.ty, m.x); });
    else P.on(function (ev) {
      if (ev.type !== 'message' || (ev.env.type !== 'world.say' && ev.env.type !== 'world.note')) return;
      var r = P.get(ev.sid);
      if (!r || !r.uid) return;
      got(r.uid, r.handle, ev.env.type === 'world.say' ? 'say' : 'note', (ev.env.payload || {}).x);
    });
    function out(ty, x) { if (fb) tr.worldSend(ty, x, clean(handle(), 24)); else P.send(ty === 'say' ? 'world.say' : 'world.note', { x: x }); }

    return {
      C: C,
      /** A line for everyone online. */
      say: function (text) {
        var s = clean(text);
        if (!s) return 'empty';
        var t = now();
        sent = sent.filter(function (x) { return t - x < C.BURST_MS; });
        if ((sent.length && t - sent[sent.length - 1] < C.MIN_GAP_MS) || sent.length >= C.BURST) return 'tooFast';
        sent.push(t);
        out('say', s);
        push({ type: 'line', from: self, handle: null, text: s, t: t, self: true, n: ++seq });
        return 'sent';
      },
      /** Tell everyone a world announcement: k from NOTE_KEYS, p its parameters. Returns whether it went out. */
      note: function (k, p) {
        if (NOTE_KEYS.indexOf(k) < 0) return false;
        var q = {};
        for (var n in (p || {})) if (/^[a-z]{1,8}$/.test(n)) q[n] = clean(String(p[n]), 48);
        var x = JSON.stringify({ k: k, p: q });
        if (x.length > C.MAX_X) return false;
        out('note', x);
        return true;
      },
      log: function () { return lines.slice(); },
      on: function (fn) { listeners.push(fn); },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.world = Object.freeze({ create: create, parseNote: parseNote, NOTE_KEYS: Object.freeze(NOTE_KEYS.slice()), C: C });
})(typeof window !== 'undefined' ? window : globalThis);
