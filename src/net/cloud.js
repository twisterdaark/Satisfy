/* Satisfy — cloud profile and consented cloud saves (SAT-ONLINE-007, doc §06 R1, §23, §24, D4).
 *
 * Classic script, exposes `Satisfy.cloud`. Runs on the Firebase SDK handle from Satisfy.firebase.load().
 *
 * Database layout (rules: backend/database.rules.json):
 *   profiles/{uid}           = {handle, look, language, titleId, classId, lv, revision, t}
 *                              the public profile of doc §23: readable by signed-in players,
 *                              written by its owner only; revision only goes up (no stale overwrite)
 *   cloudIndex/{uid}/{pid}   = {pid, handle, lv, cls, schema, savedAt, rev, size, t}   (owner only)
 *   cloudSaves/{uid}/{pid}   = {blob, rev, t}                                          (owner only)
 * eraseAll() deletes every one of these for the account, plus its session lease and inbox (doc §29
 * T35: per-user data deletion). The local save on the device is not touched.
 *
 * A cloud save is a copy of the local save (the same JSON string), keyed by the character id S.pid.
 * It moves a character between devices; it is not an online wallet (D4: the online wallet stays
 * separate until a server-side migration is tested). Nothing is uploaded or downloaded without the
 * player confirming it (doc §06: no silent writes; U003: no upload without confirmation); the game
 * keeps a backup of the local save before a download replaces it.
 */
(function (root) {
  'use strict';

  var MAX_BLOB = 400000;          // characters; the rules enforce the same limit
  var PID_RE = /^[a-z0-9_]{4,40}$/;
  // at most `max` UTF-16 units, never half of a surrogate pair (same as Satisfy.net)
  function cut(v, max) {
    var s = String(v == null ? '' : v);
    if (s.length <= max) return s;
    var out = '';
    for (var ch of s) { if (out.length + ch.length > max) break; out += ch; }
    return out;
  }

  /** Public profile fields from a game state (S) and language. */
  function profileFrom(S, lang, revision, hideLv, handle) {
    var L = (S && S.look) || {};
    var num = function (v) { return v >= 0 && v <= 31 ? v | 0 : 0; };
    return {
      handle: cut(handle || L.n || 'Player', 24), // the account's name when it has one (SAT-ONLINE-029)
      look: { hair: num(L.hair), hc: num(L.hc), skin: num(L.skin), top: num(L.top) },
      language: lang === 'ar' ? 'ar' : 'en',
      titleId: cut((S && S.title) || '', 32),
      classId: cut((S && S.cls) || 'novice', 16),
      lv: hideLv ? 0 : Math.max(1, Math.min(999, (S && S.lv) | 0 || 1)), // 0: the player hides its level
      revision: revision,
    };
  }

  /** Index entry for a save string. Throws if the save can't be read or has no character id. */
  function indexFrom(raw, rev) {
    var d = JSON.parse(raw), S = d && d.S;
    if (!S || !PID_RE.test(S.pid || '')) throw new Error('cloud: save has no character id');
    return {
      pid: S.pid, handle: cut((S.look && S.look.n) || 'Player', 24),
      lv: Math.max(1, Math.min(999, S.lv | 0 || 1)), cls: cut(S.cls || 'novice', 16),
      schema: S.v | 0 || 4, savedAt: +d.savedAt || 0, rev: rev, size: raw.length,
    };
  }

  /**
   * @param {{m:object, db:object}} sdk from Satisfy.firebase.load()
   * @param {{uid:string, now?:function():number}} o
   */
  function create(sdk, o) {
    var D = sdk.m.database, db = sdk.db, uid = o.uid, now = o.now || function () { return Date.now(); };
    var lastRev = 0, revLoaded = null;
    function rev() { var r = Math.max(now(), lastRev + 1); lastRev = r; return r; }
    function ref(p) { return D.ref(db, p); }
    // The rules only accept a higher profile revision. Another device may have written one with a
    // clock ahead of ours, so read the stored revision once before the first write.
    function ensureRev() {
      if (!revLoaded) revLoaded = D.get(ref('profiles/' + uid)).then(function (s) {
        var v = s.val();
        if (v && +v.revision > lastRev) lastRev = +v.revision;
      }, function () { revLoaded = null; });
      return revLoaded;
    }

    return {
      uid: uid,
      /** Write the public profile. Resolves when stored; rejects on a rules error. */
      writeProfile: function (S, lang, opts) {
        return ensureRev().then(function () {
          var p = profileFrom(S, lang, rev(), !!(opts && opts.hideLv), opts && opts.handle);
          p.t = D.serverTimestamp();
          return D.set(ref('profiles/' + uid), p);
        });
      },
      /** Cloud characters of this account, newest first: [{pid, handle, lv, cls, schema, savedAt, rev, size}]. */
      list: function () {
        return D.get(ref('cloudIndex/' + uid)).then(function (s) {
          var v = s.val() || {}, out = [];
          for (var k in v) if (v[k] && typeof v[k] === 'object') out.push(v[k]);
          return out.sort(function (a, b) { return (b.rev || 0) - (a.rev || 0); });
        });
      },
      /** Upload a save string (the caller has the player's confirmation). Resolves with the index entry. */
      upload: function (raw) {
        if (typeof raw !== 'string' || !raw) return Promise.reject(new Error('cloud: nothing to upload'));
        if (raw.length > MAX_BLOB) return Promise.reject(new Error('cloud: save too large'));
        var r = rev(), idx;
        try { idx = indexFrom(raw, r); } catch (e) { return Promise.reject(e); }
        // the blob first, so an index entry never points at a missing save
        return D.set(ref('cloudSaves/' + uid + '/' + idx.pid), { blob: raw, rev: r, t: D.serverTimestamp() })
          .then(function () {
            var e = {}; for (var k in idx) e[k] = idx[k];
            e.t = D.serverTimestamp();
            return D.set(ref('cloudIndex/' + uid + '/' + idx.pid), e);
          })
          .then(function () { return idx; });
      },
      /** The save string of a cloud character, or null. */
      download: function (pid) {
        if (!PID_RE.test(pid || '')) return Promise.reject(new Error('cloud: bad character id'));
        return D.get(ref('cloudSaves/' + uid + '/' + pid)).then(function (s) {
          var v = s.val();
          return v && typeof v.blob === 'string' ? v.blob : null;
        });
      },
      /**
       * Delete everything this account stored online: cloud characters (index entries first, then the
       * saves, including any saved without an index entry), inbox, `extra` paths (the game passes its
       * presence node), the session lease and the public profile. One path at a time, in that order, so
       * a failure part-way leaves no index entry pointing at a deleted save. Resolves with the number
       * of paths deleted.
       * @param {string[]} [extra]
       */
      eraseAll: function (extra) {
        var mine = new RegExp('^(presence/[a-z0-9_-]+/[A-Za-z0-9_-]+|inbox|online/[a-z0-9_-]+)/' + uid.replace(/[^A-Za-z0-9_-]/g, '') + '(/|$)');
        // world lines are keyed by push id, not uid: the caller passes its own (transport.worldMine()); the rules
        // refuse deleting anyone else's anyway
        var line = /^world\/[a-z0-9_-]+\/[A-Za-z0-9_-]+$/, name = /^handles\/[a-z0-9_]{3,16}$/; // our name (SAT-ONLINE-029)
        var own = (extra || []).filter(function (p) { return typeof p === 'string' && (mine.test(p) || line.test(p) || name.test(p)); });
        return Promise.all(['cloudIndex', 'cloudSaves', 'inbox'].map(function (k) { return D.get(ref(k + '/' + uid)); })).then(function (r) {
          var paths = [];
          ['cloudIndex', 'cloudSaves', 'inbox'].forEach(function (k, i) {
            var v = r[i].val();
            if (v && typeof v === 'object') Object.keys(v).forEach(function (id) { paths.push(k + '/' + uid + '/' + id); });
          });
          paths = paths.concat(own, ['sessions/' + uid, 'profiles/' + uid, 'accounts/' + uid]);
          return paths.reduce(function (p, path) { return p.then(function () { return D.remove(ref(path)); }); }, Promise.resolve())
            .then(function () { lastRev = 0; revLoaded = null; return paths.length; });
        });
      },
      /** Delete a cloud character (index first, so a half-done delete never lists a missing save). */
      remove: function (pid) {
        if (!PID_RE.test(pid || '')) return Promise.reject(new Error('cloud: bad character id'));
        return D.remove(ref('cloudIndex/' + uid + '/' + pid)).then(function () { return D.remove(ref('cloudSaves/' + uid + '/' + pid)); });
      },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.cloud = Object.freeze({ create: create, profileFrom: profileFrom, indexFrom: indexFrom, MAX_BLOB: MAX_BLOB });
})(typeof window !== 'undefined' ? window : globalThis);
