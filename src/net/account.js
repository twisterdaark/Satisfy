/* Satisfy — the account's player name (SAT-ONLINE-029, owner feedback #1, #15). Needs Satisfy.firebase loaded.
 *
 * Online, other players see one name per Google account: a handle the player picks after signing in, unique across
 * the game (case-insensitive), never the Google display name. Database (backend/database.rules.json):
 *   handles/{key}   = {uid, name, t}   key = the name in lower case; created by whoever takes it first, kept or
 *                                      deleted only by its owner. Readable by every signed-in player (to check a name).
 *   accounts/{uid}  = {handle, t}      the account's current name; the rules accept it only if handles/{key} is theirs.
 * Taking a name writes handles/{key} first, then accounts/{uid}, then frees the old key. Two players racing for the
 * same name: the second write is refused by the rules, and the second player is told it is taken.
 *
 * Exposes `Satisfy.account`: RE, keyOf(name), valid(name), create(sdk, uid) -> { load(), check(name), claim(name, old?) }
 *   load()  -> Promise<string|null>                       the account's handle, if it has one
 *   check() -> Promise<'free'|'mine'|'taken'|'bad'>
 *   claim() -> Promise<name>; rejects with Error code 'bad' | 'taken' (or a database error)
 */
(function (root) {
  'use strict';

  var RE = /^[A-Za-z0-9_]{3,16}$/;
  function keyOf(name) { return String(name).toLowerCase(); }
  function valid(name) { return typeof name === 'string' && RE.test(name); }
  function fail(code) { var e = new Error('account: ' + code); e.code = code; return e; }

  function create(sdk, uid) {
    var D = sdk.m.database, db = sdk.db;
    function ref(p) { return D.ref(db, p); }
    return {
      load: function () {
        return D.get(ref('accounts/' + uid)).then(function (s) { var v = s.val(); return v && valid(v.handle) ? v.handle : null; });
      },
      check: function (name) {
        if (!valid(name)) return Promise.resolve('bad');
        return D.get(ref('handles/' + keyOf(name))).then(function (s) { var v = s.val(); return !v ? 'free' : v.uid === uid ? 'mine' : 'taken'; });
      },
      claim: function (name, old) {
        if (!valid(name)) return Promise.reject(fail('bad'));
        var k = keyOf(name);
        return D.get(ref('handles/' + k)).then(function (s) {
          var v = s.val();
          if (v && v.uid !== uid) throw fail('taken');
          return D.set(ref('handles/' + k), { uid: uid, name: name, t: D.serverTimestamp() });
        }).then(function () {
          return D.set(ref('accounts/' + uid), { handle: name, t: D.serverTimestamp() });
        }).then(function () {
          if (valid(old) && keyOf(old) !== k) return D.remove(ref('handles/' + keyOf(old))).catch(function () { /* stays reserved */ });
        }).then(function () { return name; }, function (e) {
          if (e && e.code === 'PERMISSION_DENIED') throw fail('taken'); // someone took it between our check and our write
          throw e;
        });
      },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.account = Object.freeze({ RE: RE, keyOf: keyOf, valid: valid, create: create });
})(typeof window !== 'undefined' ? window : globalThis);
