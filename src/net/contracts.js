/* Satisfy — online contracts (SAT-ONLINE-001). Pure data shapes and validators; no network yet.
 *
 * Classic script, exposes `Satisfy.net`. The future presence/room layer (R2) sends and
 * receives only these shapes. Durable/private data (inventory, gold, quests, materials)
 * never enters a PlayerPublic; see PRIVATE_FIELDS.
 *
 * @typedef {{id:string, tile:number, w:number, h:number}} WorldRef
 *   The shared map. w/h in tiles; positions in PlayerPublic are pixels (tile * TS).
 * @typedef {{key:string, world:string, zone:string, shard:number}} RoomRef
 *   A presence channel: everyone on the same channel can see each other. `zone` is a zone id or an
 *   instance name ('main' while the whole map is one channel). Not a house interior.
 * @typedef {{hair:number, hc:number, skin:number, top:number}} Look
 * @typedef {{
 *   v:number, uid:(string|null), sid:(string|null), handle:string, look:Look,
 *   cls:string, lv:number, title:string, zone:string, room:(string|null),
 *   x:number, y:number, dir:number, anim:string, arm:number, party:(string|null), duel:(string|null), mv:(string|null),
 *   hp:(number|null), em:(string|null), role:(string|null), t:number
 * }} PlayerPublic
 *   What other players may see. `room` is the house interior id (e.g. "r7") or null outdoors;
 *   `arm` is 1 when armor is worn (picks the armored sprite). `mv` is the map version (8 hex digits, a hash of
 *   the generated world): positions only mean the same place to players with the same map (doc §59 C07/C14),
 *   so the game hides remotes whose mv differs from its own. `hp` is health in percent, rounded to 5 (0..100), for
 *   party frames (doc §35 U051); it is no more than the health bar anyone nearby could already see. `em` is the
 *   emote being played (EMOTES) or null; `role` the party role badge you picked (ROLES) or null.
 * @typedef {{v:number, type:string, requestId:(string|null), sessionId:(string|null),
 *   seq:number, tick:number, payload:object}} Envelope
 */
(function (root) {
  'use strict';

  var PROTOCOL_VERSION = 1;
  var WORLD_ID = 'satisfy';
  // posX/posY: pixel bounds the database accepts for x/y (backend/database.rules.json). They are
  // headroom over the map (724 x 144 tiles = 11584 x 2304 px today) so a wider map needs no redeploy.
  var LIMITS = Object.freeze({ handle: 24, title: 32, envelopeBytes: 2048, shard: 999, posX: 16384, posY: 4096, posYMin: -2048 });
  var ANIMS = ['idle', 'walk', 'attack', 'dodge', 'dead'];
  // PlayerPublic.em (SAT-ONLINE-022, doc §35 U061): an emote from a fixed list, never free text
  var EMOTES = ['wave', 'dance', 'point', 'cheer'];
  // PlayerPublic.role (SAT-ONLINE-025, doc §35 U050): the party role you show, a badge only, independent of class
  var ROLES = ['tank', 'healer', 'damage', 'support'];
  // PlayerPublic.duel: a duel id from Satisfy.duel and the player's duel HP (0..100)
  var DUEL_RE = /^d_[A-Za-z0-9_-]{1,40}:(100|[1-9]?[0-9])$/;
  var MV_RE = /^[0-9a-f]{8}$/; // PlayerPublic.mv (SAT-ONLINE-019)
  var PUBLIC_FIELDS = ['v', 'uid', 'sid', 'handle', 'look', 'cls', 'lv', 'title', 'zone', 'room', 'x', 'y', 'dir', 'anim', 'arm', 'party', 'duel', 'mv', 'hp', 'em', 'role', 't'];
  // Keys of S that are private or server-owned. Listed so tests can prove none leak into presence.
  // S.uid (the local item-instance counter) is private too, but its name collides with the public
  // account `uid`, so it is checked by value in the tests instead of listed here.
  var PRIVATE_FIELDS = ['gold', 'items', 'mats', 'qs', 'kills', 'met', 'ev', 'arrows', 'arrowsMade', 'bread', 'eqW', 'eqA',
    'made', 'smith', 'sxp', 'st', 'pts', 'bonus', 'got', 'hid', 'bq', 'bqa', 'bqT', 'sk', 'tl', 'xp', 'sold', 'playT'];
  // Reply codes from doc §25.
  var ERRORS = Object.freeze({ ZONE_SAFE: 'ZONE_SAFE', CD_ACTIVE: 'CD_ACTIVE', OUT_OF_RANGE: 'OUT_OF_RANGE',
    SESSION_STALE: 'SESSION_STALE', RATE_LIMITED: 'RATE_LIMITED', BAD_MESSAGE: 'BAD_MESSAGE' });

  // Connection state machine from doc §25. The UI derives online status from this only.
  var NET_STATES = ['DISCONNECTED', 'AUTHENTICATING', 'PROFILE_LOADING', 'JOINING', 'SYNCING', 'ONLINE', 'DEGRADED', 'RECONNECTING', 'OFFLINE', 'ERROR'];
  var NET_EDGES = {
    DISCONNECTED: ['AUTHENTICATING', 'OFFLINE'],
    AUTHENTICATING: ['PROFILE_LOADING', 'ERROR', 'OFFLINE'],
    PROFILE_LOADING: ['JOINING', 'ERROR', 'OFFLINE'],
    JOINING: ['SYNCING', 'ERROR', 'RECONNECTING'],
    SYNCING: ['ONLINE', 'ERROR', 'RECONNECTING'],
    ONLINE: ['DEGRADED', 'RECONNECTING', 'DISCONNECTED'],
    DEGRADED: ['ONLINE', 'RECONNECTING', 'DISCONNECTED'],
    RECONNECTING: ['SYNCING', 'OFFLINE', 'ERROR'],
    OFFLINE: ['AUTHENTICATING', 'DISCONNECTED'],
    ERROR: ['DISCONNECTED', 'OFFLINE'],
  };

  // Safe zones (doc §08): towns where no player can hurt another. Enforced by the combat authority
  // once duels/PvP exist; until then the game only shows it. Zone ids come from Satisfy.local.zoneAt.
  // Every town is safe: Patrian (zPat) joined with SAT-CONTENT-002, Reidan (zReid) with SAT-REIDAN-001,
  // Reinhardt (zRein) with SAT-GUILD-001. tests/regression/party.test.cjs checks this list against
  // Satisfy.local.world().towns so a new town can't be left out.
  var SAFE_ZONES = ['zBai', 'zWin', 'zPat', 'zReid', 'zRein'];
  // 'void' (or no zone): a position the world doesn't define, e.g. the interior strip between rooms. The game's
  // own zoneAt falls back to Winston there (doc §59 C06); online that must never count as a safe town, nor as a
  // field where players may fight, so it is `known: false` and callers refuse both.
  var UNKNOWN_ZONES = ['void', ''];
  function zonePolicy(zone) {
    var known = typeof zone === 'string' && UNKNOWN_ZONES.indexOf(zone) < 0;
    var safe = known && SAFE_ZONES.indexOf(zone) >= 0;
    return { zone: zone, known: known, safe: safe, pvp: false, duel: false };
  }

  function canTransition(from, to) {
    return !!(NET_EDGES[from] && NET_EDGES[from].indexOf(to) >= 0);
  }

  function roomKey(world, zone, shard) {
    return (world || WORLD_ID) + '/' + zone + '/' + ((shard | 0) || 0);
  }
  function parseRoomKey(key) {
    var m = /^([a-z0-9_-]+)\/([A-Za-z0-9_-]+)\/(\d{1,3})$/.exec(String(key));
    return m ? { key: key, world: m[1], zone: m[2], shard: +m[3] } : null;
  }

  // Truncate to at most `max` UTF-16 units without splitting a surrogate pair (an emoji or other
  // astral character cut in half is an invalid string that a database or font may reject).
  function str(v, max) {
    var s = String(v == null ? '' : v);
    if (s.length <= max) return s;
    var out = '';
    for (var ch of s) { if (out.length + ch.length > max) break; out += ch; }
    return out;
  }
  function int(v) { return Math.round(+v || 0); }

  /**
   * Build the public view of the local player.
   * @param {object} S durable state
   * @param {object} P volatile player state
   * @param {{handle?:string, hideLv?:boolean, zone?:string, room?:(string|null), uid?:string, sid?:string, party?:string, duel?:string, mv?:string, hp?:number, em?:string, role?:string, anim?:string, arm?:number, t?:number}} [ctx]
   *   duel: "<duel id>:<duel HP>" while in a duel's countdown or fight, so others can watch (U034)
   * @returns {PlayerPublic}
   */
  function toPlayerPublic(S, P, ctx) {
    ctx = ctx || {};
    var L = S.look || {};
    return {
      v: PROTOCOL_VERSION,
      uid: ctx.uid || null,
      sid: ctx.sid || null,
      handle: str(ctx.handle || L.n, LIMITS.handle), // online: the account ID (SAT-ONLINE-026); otherwise the character name
      look: { hair: L.hair | 0, hc: L.hc | 0, skin: L.skin | 0, top: L.top | 0 },
      cls: str(S.cls || 'novice', 16),
      lv: ctx.hideLv ? 0 : S.lv | 0, // 0 = the player hides their level (SAT-ONLINE-026)
      title: str(S.title, LIMITS.title),
      zone: str(ctx.zone, 24),
      room: ctx.room || null,
      x: int(P.x),
      y: int(P.y),
      dir: (P.dir | 0) & 3,
      anim: ANIMS.indexOf(ctx.anim) >= 0 ? ctx.anim : 'idle',
      arm: ctx.arm ? 1 : 0,
      party: ctx.party || null,
      duel: typeof ctx.duel === 'string' && DUEL_RE.test(ctx.duel) ? ctx.duel : null,
      mv: typeof ctx.mv === 'string' && MV_RE.test(ctx.mv) ? ctx.mv : null,
      hp: typeof ctx.hp === 'number' && isFinite(ctx.hp) ? Math.max(0, Math.min(100, Math.round(ctx.hp / 5) * 5)) : null,
      em: EMOTES.indexOf(ctx.em) >= 0 ? ctx.em : null,
      role: ROLES.indexOf(ctx.role) >= 0 ? ctx.role : null,
      t: ctx.t || 0,
    };
  }

  /**
   * Check a PlayerPublic received from the network (or about to be sent).
   * @param {object} o
   * @param {{world?:WorldRef}} [opts] when world is given, positions are bounds-checked
   * @returns {{ok:boolean, errors:string[]}}
   */
  function validatePlayerPublic(o, opts) {
    var e = [];
    if (!o || typeof o !== 'object') return { ok: false, errors: ['not an object'] };
    for (var k in o) if (PUBLIC_FIELDS.indexOf(k) < 0) e.push('unknown field ' + k);
    if (o.v !== PROTOCOL_VERSION) e.push('protocol version');
    if (typeof o.handle !== 'string' || o.handle.length > LIMITS.handle) e.push('handle');
    if (!o.look || typeof o.look !== 'object') e.push('look');
    else ['hair', 'hc', 'skin', 'top'].forEach(function (f) { if (!Number.isInteger(o.look[f]) || o.look[f] < 0 || o.look[f] > 31) e.push('look.' + f); });
    if (typeof o.cls !== 'string') e.push('cls');
    if (!Number.isInteger(o.lv) || o.lv < 0 || o.lv > 999) e.push('lv');
    if (!Number.isInteger(o.x) || !Number.isInteger(o.y)) e.push('position');
    var w = opts && opts.world;
    if (w && (o.x < 0 || o.y < -(w.north || 0) * w.tile || o.x >= w.w * w.tile || o.y >= w.h * w.tile)) e.push('out of world'); // rows -north..-1 are the north (SAT-WORLD-003)
    if (!Number.isInteger(o.dir) || o.dir < 0 || o.dir > 3) e.push('dir');
    if (ANIMS.indexOf(o.anim) < 0) e.push('anim');
    if (o.arm !== 0 && o.arm !== 1) e.push('arm');
    if (o.room !== null && typeof o.room !== 'string') e.push('room');
    if (o.party !== null && typeof o.party !== 'string') e.push('party');
    if (o.duel !== undefined && o.duel !== null && !(typeof o.duel === 'string' && DUEL_RE.test(o.duel))) e.push('duel');
    if (o.mv !== undefined && o.mv !== null && !(typeof o.mv === 'string' && MV_RE.test(o.mv))) e.push('mv');
    if (o.hp !== undefined && o.hp !== null && !(Number.isInteger(o.hp) && o.hp >= 0 && o.hp <= 100)) e.push('hp');
    if (o.em !== undefined && o.em !== null && EMOTES.indexOf(o.em) < 0) e.push('em');
    if (o.role !== undefined && o.role !== null && ROLES.indexOf(o.role) < 0) e.push('role');
    return { ok: e.length === 0, errors: e };
  }

  /** Wrap a message for the wire (doc §25). Throws if it would exceed the size limit. */
  function envelope(type, payload, meta) {
    meta = meta || {};
    var env = {
      v: PROTOCOL_VERSION,
      type: String(type),
      requestId: meta.requestId || null,
      sessionId: meta.sessionId || null,
      seq: meta.seq | 0,
      tick: meta.tick | 0,
      payload: payload || {},
    };
    if (JSON.stringify(env).length > LIMITS.envelopeBytes) throw new Error(ERRORS.BAD_MESSAGE + ': envelope too large');
    return env;
  }

  var api = {
    PROTOCOL_VERSION: PROTOCOL_VERSION,
    WORLD_ID: WORLD_ID,
    LIMITS: LIMITS,
    ANIMS: Object.freeze(ANIMS.slice()),
    EMOTES: Object.freeze(EMOTES.slice()),
    ROLES: Object.freeze(ROLES.slice()),
    PUBLIC_FIELDS: Object.freeze(PUBLIC_FIELDS.slice()),
    PRIVATE_FIELDS: Object.freeze(PRIVATE_FIELDS.slice()),
    ERRORS: ERRORS,
    NET_STATES: Object.freeze(NET_STATES.slice()),
    SAFE_ZONES: Object.freeze(SAFE_ZONES.slice()),
    zonePolicy: zonePolicy,
    canTransition: canTransition,
    roomKey: roomKey,
    parseRoomKey: parseRoomKey,
    toPlayerPublic: toPlayerPublic,
    validatePlayerPublic: validatePlayerPublic,
    envelope: envelope,
  };

  var ns = root.Satisfy = root.Satisfy || {};
  ns.net = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
