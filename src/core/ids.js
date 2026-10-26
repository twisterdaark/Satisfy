/* Satisfy — stable ids (SAT-ONLINE-005, doc §05 R0.5).
 *
 * Classic script, exposes `Satisfy.ids`. No build step; runs in browsers and in Node (vm).
 *
 * - Character id `S.pid`: the one stable id of a character. Claude-B introduced it for guilds
 *   (SAT-GUILD-001, created on first use); `ensure()` now also gives it to every character at the
 *   first save or load. An existing pid is never replaced. New ones are 'p_' + 20 base32 chars.
 * - Item id `item.iid`: 'it_' + <pid> + '_' + <item.uid>. The local numeric `uid` stays the in-game
 *   reference (S.eqW/S.eqA/S.eq point at it) and becomes the *legacy id*; the pair (pid, uid) is
 *   unique and never changes, so the derived iid is the item's stable instance id, and what a
 *   server profile will key the item by (doc: "UID ... becomes legacy id").
 * - Request ids: uuid() (RFC 4122 v4) for every craft/kill/claim request (Satisfy.events).
 * - Entity ids (plan U311): entity('m'|'n'|'p', key) for monsters, NPCs and players; see below.
 *
 * Firebase keys can't hold . # $ [ ] /, so every id is [a-z0-9_-] only.
 */
(function (root) {
  'use strict';

  var B32 = 'abcdefghijklmnopqrstuvwxyz234567';
  var PID_RE = /^[a-z0-9_]{4,40}$/;
  // RegExp#test turns undefined/null into 'undefined'/'null', which would pass PID_RE: check the type.
  function isPid(s) { return typeof s === 'string' && PID_RE.test(s); }
  var IID_RE = /^it_[a-z0-9_]{4,40}_\d+$/;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  function cryptoOf() {
    var c = root.crypto;
    return c && typeof c.getRandomValues === 'function' ? c : null;
  }

  /** n random bytes. Uses crypto when present; Math.random only as a last resort (old browsers). */
  function bytes(n) {
    var out = new Uint8Array(n), c = cryptoOf();
    if (c) { c.getRandomValues(out); return out; }
    for (var i = 0; i < n; i++) out[i] = (Math.random() * 256) | 0;
    return out;
  }

  function token(len) {
    var b = bytes(len), s = '';
    for (var i = 0; i < len; i++) s += B32[b[i] & 31];
    return s;
  }

  function uuid() {
    var c = root.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    var b = bytes(16), h = '';
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    for (var i = 0; i < 16; i++) h += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function charId() { return 'p_' + token(20); }

  /** Stable id of an item, derived from the character id and the item's legacy numeric uid. */
  function itemId(pid, uid) {
    if (!isPid(pid)) throw new Error('bad character id: ' + pid);
    if (!(uid >= 1 && Math.floor(uid) === uid)) throw new Error('bad item uid: ' + uid);
    return 'it_' + pid + '_' + uid;
  }

  /** The legacy numeric uid inside an item id, or null. */
  function legacyUid(iid) {
    return typeof iid === 'string' && IID_RE.test(iid) ? +iid.slice(iid.lastIndexOf('_') + 1) : null;
  }

  /**
   * Give a character its ids if it lacks them: S.pid, and iid on every item. Idempotent; an item
   * whose iid doesn't match its uid (copied between saves by hand) is corrected.
   * @returns {{pid:boolean, items:number}} what was assigned
   */
  function ensure(S) {
    var got = { pid: false, items: 0 };
    if (!S || typeof S !== 'object') return got;
    if (!isPid(S.pid)) { S.pid = charId(); got.pid = true; }
    var items = Array.isArray(S.items) ? S.items : [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || !(it.uid >= 1) || Math.floor(it.uid) !== it.uid) continue;
      var want = itemId(S.pid, it.uid);
      if (it.iid !== want) { it.iid = want; got.items++; }
    }
    return got;
  }

  /* Entity ids (plan U311): one scheme for what stands in the world.
   *   'm:' + the monster's network key (mobKey: kind@x,y, the shape the database rules take, made unique at the
   *          world's build), the same on every screen and kept through respawns
   *   'n:' + the NPC's id
   *   'p:' + the player's network uid ('p:me' offline)
   * entity(kind, key) builds one and throws on a bad kind or key; parseEntity(id) gives {kind, key} back, or null. */
  var ENT_RE = /^[mnp]:[A-Za-z0-9_@,:-]{1,96}$/;   // NPC ids and Firebase uids carry upper case; monster keys '@', ',' and '-'
  function entity(kind, key) {
    if (kind !== 'm' && kind !== 'n' && kind !== 'p') throw new Error('bad entity kind: ' + kind);
    if (key == null || key === '') throw new Error('no entity key');
    var id = kind + ':' + String(key);
    if (!ENT_RE.test(id)) throw new Error('bad entity key: ' + key);
    return id;
  }
  function parseEntity(id) { return typeof id === 'string' && ENT_RE.test(id) ? { kind: id.charAt(0), key: id.slice(2) } : null; }

  var api = {
    uuid: uuid,
    entity: entity,
    parseEntity: parseEntity,
    charId: charId,
    itemId: itemId,
    legacyUid: legacyUid,
    ensure: ensure,
    isCharId: isPid,
    isItemId: function (s) { return typeof s === 'string' && IID_RE.test(s); },
    isUuid: function (s) { return typeof s === 'string' && UUID_RE.test(s); },
  };

  var ns = root.Satisfy = root.Satisfy || {};
  ns.ids = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
