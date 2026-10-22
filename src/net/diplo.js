/* Satisfy — standings between guilds (SAT-ONLINE-123, plan U245 "treaties/cooldowns and faction standings").
 *
 * A guild's standing with another guild comes only from what both guilds already keep: the diplomacy log
 * (guildDiplo/{gid}, SAT-ONLINE-085/086) and what is in force now (guildAlly, guildWar). It needs no new data and no new
 * rules, and both guilds see the same standing, because each event is written to both logs (ask and warask are only in
 * the asker's log, and count nothing).
 *
 * The formula, shown in G -> Diplomacy -> Standings: every log entry of the last 30 days counts once
 *   an alliance made +20 · ended in order or ran out +10 · broken -50 · a proposal declined -5
 *   a war fought -30 · a war refused -10 · an alliance in force +50
 * The sum is held to -100..100. 25 and up is friendly, -25 and down hostile, between them neutral; an alliance in force
 * is 'ally' and a war set or going on is 'war', whatever the points.
 *
 * Exposes `Satisfy.diplo`: `standing(log, now, live)`, `standings(log, now, allies, wars)`, `PTS`, `C`.
 */
(function (root) {
  'use strict';

  var C = Object.freeze({ MS: 30 * 24 * 3600 * 1000, MAX: 100, FRIEND: 25, HOSTILE: -25, GID_RE: /^g_[A-Za-z0-9]{1,128}$/ });
  // the points of each kind of log entry, and 'live' for an alliance in force; 'gone' an alliance that ran out (still
  // listed, nobody has ended it yet) counts as one ended in order
  var PTS = Object.freeze({ ally: 20, end: 10, gone: 10, break: -50, decline: -5, war: -30, warno: -10, live: 50 });
  var LOGGED = ['ally', 'end', 'break', 'decline', 'war', 'warno'];

  // the standing with one guild: log is that guild's entries in your guild's log ({k, t}); live {ally, gone, war}
  // -> { k: 'ally' | 'war' | 'friendly' | 'neutral' | 'hostile', pts, why: { kind: count } }
  function standing(log, now, live) {
    var pts = 0, why = {}, l = live || {};
    (log || []).forEach(function (e) {
      if (!e || LOGGED.indexOf(e.k) < 0) return;
      var t = +e.t;
      if (!(t > 0) || t > now + 60000 || now - t > C.MS) return; // a minute ahead is the server clock; older ones are done
      pts += PTS[e.k]; why[e.k] = (why[e.k] || 0) + 1;
    });
    if (l.ally) { pts += PTS.live; why.live = 1; } else if (l.gone) { pts += PTS.gone; why.gone = 1; }
    pts = Math.max(-C.MAX, Math.min(C.MAX, pts));
    var k = l.war ? 'war' : l.ally ? 'ally' : pts >= C.FRIEND ? 'friendly' : pts <= C.HOSTILE ? 'hostile' : 'neutral';
    return { k: k, pts: pts, why: why };
  }

  // every guild your guild has dealt with in the last 30 days (or is allied with, or at war with): log is your guild's
  // diplomacy log ({id: {k, o, n, t}}); allies {gid: {n, until}}; wars {gid: {n, end}} -> { gid: {n, k, pts, why} }, the
  // name from the latest entry that has one
  function standings(log, now, allies, wars) {
    var by = {}, out = {};
    function g(o) { return by[o] || (by[o] = { log: [], n: '', nt: -1 }); }
    Object.keys(log || {}).forEach(function (id) {
      var e = log[id];
      if (!e || typeof e !== 'object' || !C.GID_RE.test(String(e.o))) return;
      var x = g(e.o), t = +e.t || 0;
      x.log.push(e);
      if (typeof e.n === 'string' && e.n && t >= x.nt) { x.n = e.n; x.nt = t; }
    });
    Object.keys(allies || {}).forEach(function (o) { if (C.GID_RE.test(o)) { var x = g(o); if (!x.n) x.n = allies[o].n || ''; } });
    Object.keys(wars || {}).forEach(function (o) { if (C.GID_RE.test(o)) { var x = g(o); if (!x.n) x.n = wars[o].n || ''; } });
    Object.keys(by).forEach(function (o) {
      var a = (allies || {})[o], w = (wars || {})[o];
      var s = standing(by[o].log, now, { ally: !!(a && a.until > now), gone: !!(a && !(a.until > now)), war: !!(w && now < w.end) });
      s.n = by[o].n || '?';
      if (s.k !== 'neutral' || s.pts !== 0 || by[o].log.some(function (e) { return now - (+e.t || 0) <= C.MS; })) out[o] = s;
    });
    return out;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.diplo = Object.freeze({ standing: standing, standings: standings, PTS: PTS, C: C });
})(typeof window !== 'undefined' ? window : globalThis);
