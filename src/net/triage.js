/* Satisfy — triage of bug reports and crash reports (SAT-ONLINE-125, plan U343 "community feedback triage: bug reports
 * tagged actionable and status; duplicates merged with provenance").
 *
 * The owner's "/bugs" puts two kinds of report in one list:
 *   - crash reports (crashes/{id} {m, s, v, z?, by, t}, SAT-ONLINE-082), which every signed-in page sends by itself. Those
 *     with the same message (numbers aside) are one group, key 'c_' + a hash of it.
 *   - players' bug reports (bugs/{id} {s, v, z?, n?, by, t}, "/bug what happened"), each its own group, key = its id.
 * The owner tags a group (bugTriage/{key} {s, dup?, by, t}): 'act' actionable, 'fixed', 'no' not a bug, or 'dup' the same
 * as another group (dup = that key), which merges it into that one. A merged group keeps its provenance: every report in
 * it, with who sent it, from which build and zone, and when. A fixed group that gets a report after it was tagged is open
 * again ('back').
 *
 * Exposes `Satisfy.triage`: `groups(crashes, bugs, triage)` -> [group], `crashKey(m)`, `norm(m)`, `STATUS`.
 *   group: { key, kind: 'crash' | 'bug', s: 'new' | 'act' | 'fixed' | 'no', back, open, text, n, items: [{id, kind, text,
 *            by, n?, v, z, t}], by: [uids], v: [builds], z: [zones], first, last, dupOf? }
 */
(function (root) {
  'use strict';

  var STATUS = Object.freeze(['new', 'act', 'fixed', 'no', 'dup']), KEY_RE = /^[bc]_[A-Za-z0-9_-]{1,60}$/;

  // a crash message with its numbers and quoted parts set aside, so the same fault reads the same from any page
  function norm(m) {
    return String(m == null ? '' : m).replace(/(['"`]).*?\1/g, '"…"').replace(/\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36);
  }
  function crashKey(m) { return 'c_' + hash(norm(m)); }
  function uniq(a) { var o = []; a.forEach(function (x) { if (x != null && x !== '' && o.indexOf(x) < 0) o.push(x); }); return o; }
  function str(x, n) { return typeof x === 'string' ? x.slice(0, n) : ''; }

  function groups(crashes, bugs, triage) {
    var G = {}, T = triage || {};
    function g(key, kind, text) { return G[key] || (G[key] = { key: key, kind: kind, text: text, items: [] }); }
    Object.keys(crashes || {}).forEach(function (id) {
      var c = crashes[id];
      if (!c || typeof c.m !== 'string') return;
      g(crashKey(c.m), 'crash', norm(c.m)).items.push({ id: id, kind: 'crash', text: str(c.m, 200), stack: str(c.s, 800), by: str(c.by, 128), v: str(c.v, 16), z: str(c.z, 24), t: +c.t || 0 });
    });
    Object.keys(bugs || {}).forEach(function (id) {
      var b = bugs[id];
      if (!b || typeof b.s !== 'string' || !KEY_RE.test(id)) return;
      g(id, 'bug', str(b.s, 300)).items.push({ id: id, kind: 'bug', text: str(b.s, 300), by: str(b.by, 128), n: str(b.n, 24), v: str(b.v, 16), z: str(b.z, 24), t: +b.t || 0 });
    });
    // follow each 'dup' to the group it names (a chain, never a loop), and move its reports there
    function end(key) {
      var seen = {}, k = key;
      while (T[k] && T[k].s === 'dup' && typeof T[k].dup === 'string' && G[T[k].dup] && !seen[k]) { seen[k] = 1; k = T[k].dup; }
      return seen[k] ? key : k;
    }
    Object.keys(G).forEach(function (key) {
      var to = end(key);
      if (to !== key) { G[to].items = G[to].items.concat(G[key].items); G[to].merged = (G[to].merged || []).concat([key]); G[key].dupOf = to; }
    });
    return Object.keys(G).filter(function (k) { return !G[k].dupOf; }).map(function (k) {
      var x = G[k], tg = T[k], s = tg && STATUS.indexOf(tg.s) >= 0 && tg.s !== 'dup' ? tg.s : 'new';
      x.items.sort(function (a, b) { return a.t - b.t; });
      x.n = x.items.length;
      x.by = uniq(x.items.map(function (i) { return i.by; }));
      x.v = uniq(x.items.map(function (i) { return i.v; }));
      x.z = uniq(x.items.map(function (i) { return i.z; }));
      x.first = x.n ? x.items[0].t : 0;
      x.last = x.n ? x.items[x.n - 1].t : 0;
      x.s = s;
      x.back = s === 'fixed' && !!tg && x.last > (+tg.t || 0);
      x.open = s === 'new' || s === 'act' || x.back;
      x.merged = x.merged || [];
      return x;
    }).sort(function (a, b) { return (b.open - a.open) || ((b.s === 'act') - (a.s === 'act')) || (b.n - a.n) || (b.last - a.last); });
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.triage = Object.freeze({ groups: groups, crashKey: crashKey, norm: norm, STATUS: STATUS, KEY_RE: KEY_RE });
})(typeof window !== 'undefined' ? window : globalThis);
