# Engine API (R0)

> ملخص: هذه الواجهات التي يعتمد عليها Claude-B (المحتوى والاختبارات) وطبقة الأونلاين القادمة.
> كلها قراءة فقط ولا تغير الـGameplay. أي تغيير فيها يُعلن هنا وفي الـIssue المعنية.

Owner: Claude-A · Introduced by SAT-ONLINE-001 (#1) · API version `Satisfy.local.api === 1`

The game is still one IIFE in `index.html`. Two classic scripts load before it and create a
global namespace `window.Satisfy`; the game adds a read-only `Satisfy.local` at the end of boot.

```html
<script src="src/core/storage.js"></script>   <!-- Satisfy.storage -->
<script src="src/net/contracts.js"></script>  <!-- Satisfy.net -->
<script src="src/net/presence.js"></script>   <!-- Satisfy.presence (SAT-ONLINE-002) -->
<script src="src/net/transport-local.js"></script> <!-- Satisfy.transports -->
<script> (()=>{ ...game...; Satisfy.local = Object.freeze({...}) })() </script>
```

## `Satisfy.local` — read-only view of the running game

| Member | Returns |
|---|---|
| `api` | `1` |
| `defs()` | Deep copy of content tables as plain JSON: `MT`, `BOSSES`, `SPAWN`, `QD` (static quests only, no generated board quests), `RC`, `SKD`, `NPCS`, `TOWNS`, `ZR`, `MATS`. Functions (e.g. `RC[i].unlock`) become `{ "$fn": "<source>" }`. Also at `window.__G.defs()`. |
| `world()` | `{ id: 'satisfy', tile: 16, w: 160, h: 144, y0: -960, outdoorH: 120, zones: [...ZR ids], towns: ['zBai','zWin'] }`. Rows `>= outdoorH` hold house interiors. The north is above row 0: `y` runs from `y0` (`-NR*TS`) to `h*tile`. |
| `rooms()` | House interiors: `[{ id: 'r<n>', kind: 'house'|'shop'|'armory'|'inn', zone }]`. Ids are stable for a given map. |
| `zoneAt(x, y)` | Zone id at a pixel position (`'zWin'`, `'zPlains'`, …). |
| `roomAt(x, y)` | `{ id, kind, zone }` if the position is inside a house interior, else `null`. |
| `inGame()` | `false` on title/demo screens. |
| `playerPublic(ctx?)` | The local player as a `PlayerPublic` (see below), or `null` outside a game. `ctx` may set `uid`, `sid`, `party`, `anim`, `t`. |
| `backups()` | `{ reason: rawJSON }` for every save backup of the current slot. |
| `net()` | `null` offline; with `?net=local`: `{ mode, sid, count, drawn, remotes, stats }`. |

Content tables are **source data for SAT-CONTENT-001 parity tests**. They are not an editing
interface: changing values happens in `data/**` once the engine reads from it (after the split).

## `Satisfy.storage` — local save (see ADR-001)

| Member | Notes |
|---|---|
| `SCHEMA` | `5` — current `S.v`. |
| `KEY` | `'satisfy_proto_v4'` — historical name, kept for compatibility. |
| `BACKUP_PREFIX` | `'satisfy_proto_v4.backup.'` + `corrupt` / `from-v<N>` / `newer-v<N>`. |
| `decode(raw)` | `{ status: 'empty'|'corrupt'|'ok', raw, data?, schema?, error? }`. Never throws. |
| `encode(S, P, now?)` | `JSON {S, P:{x,y,hp,st,mp,food}, fmt:1, schema, savedAt}`. |
| `migrate(S, P, ctx)` | Runs the ladder in place; returns applied versions. `ctx = { PTS_LV, spawn:{x,y}, maxHP() }`. |
| `create(storage, {slot?})` | Adapter with `key`, `exists()`, `read()`, `write(S, P)`, `backup(reason, raw)`, `backups()`. Swallows storage errors. A slot stores under `satisfy_proto_v4@<slot>` (`?slot=` in the URL). |
| `slotKey(slot)` | Key for a slot; throws on names outside `[A-Za-z0-9_-]{1,16}`. |

Save shape compatibility rule: a save written by any build must load in the previous build.
Adding a field to `S` needs a default in `freshState()`; changing the meaning of a field needs a
new ladder step and `SCHEMA + 1`.

## `Satisfy.net` — online contracts (no network yet)

| Member | Notes |
|---|---|
| `PROTOCOL_VERSION` | `1` |
| `PUBLIC_FIELDS` | `v, uid, sid, handle, look, cls, lv, title, zone, room, x, y, dir, anim, arm, party, t` (`arm` 0/1 = armored sprite) |
| `PRIVATE_FIELDS` | Keys of `S` that must never appear in presence (gold, items, mats, quests, stats…). |
| `toPlayerPublic(S, P, ctx)` | Builds a `PlayerPublic`; clamps strings, rounds positions. |
| `validatePlayerPublic(o, {world}?)` | `{ ok, errors[] }`; rejects unknown fields and out-of-world positions. |
| `roomKey(world, zone, shard)` / `parseRoomKey(key)` | Presence channel id, e.g. `satisfy/zWin/0` (all players in Winston shard 0). |
| `NET_STATES`, `canTransition(a, b)` | Connection state machine (doc §25). |
| `envelope(type, payload, meta)` | `{ v, type, requestId, sessionId, seq, tick, payload }`, max 2048 bytes. |
| `ERRORS` | `ZONE_SAFE, CD_ACTIVE, OUT_OF_RANGE, SESSION_STALE, RATE_LIMITED, BAD_MESSAGE` |

A *room* here is a presence channel (who you can see), not a house interior. House interiors
are reported in `PlayerPublic.room` so remote players inside a house are only drawn there.

## `Satisfy.presence` and `Satisfy.transports` (SAT-ONLINE-002)

`Satisfy.presence.create({ transport, now?, world?, sid?, uid?, config? })` returns a client:

| Member | Notes |
|---|---|
| `publish(pp, force?)` | Sends the local `PlayerPublic`: 10 Hz while moving, 1 Hz idle, immediately on room/zone/look/level/party change. Returns whether it sent. |
| `send(type, payload)` | Any other envelope (`party.*` in SAT-ONLINE-003). Received by listeners as `{type:'message', sid, env}`, only from visible players. |
| `remotes()` | Copies of remote `PlayerPublic`s with x/y interpolated 100 ms in the past; jumps over 64 px snap. |
| `tick()` | Expires players silent for 5 s. |
| `on(fn)` | Events `join`, `leave` (`reason: left|timeout`), `message`. |
| `count()`, `get(sid)`, `stats()`, `close()` | `close()` sends `presence.leave`. |

Untrusted input is dropped: wrong protocol, invalid or spoofed `PlayerPublic` (`sid` must match the envelope), replayed or old `seq`, more than 30 messages/s per sender, more than 64 remotes.

Transports (`{ kind, send, onmessage, close }`): `Satisfy.transports.local(name)` (BroadcastChannel, tabs of one browser) and `Satisfy.transports.hub().connect()` (in-memory, tests). The Firebase transport (SAT-ONLINE-004) has the same shape.

In the game: `?net=local` turns it on; remote players are drawn only inside the same house interior (or both outdoors), with their name and look; a badge shows the player count. Use `?slot=a` / `?slot=b` so two tabs don't share one save.

## Tests

```bash
npm install && npm run setup:browsers   # once: Playwright + Chromium
npm test                  # everything under tests/**/*.test.cjs
npm run test:unit         # no browser
npm run test:regression   # headless Chromium, compares with the R0 baseline
npm run test:content      # Claude-B: tests/content/**
```

Helpers for content tests (owned by Claude-A, import, don't edit):

- `tests/harness/game.cjs` — `openGame({ html?, storage? })` returns `g` with `g.eval(fn)`,
  `g.step(n)`, `g.mode()`, `g.errors`; plus `newGame(g)`, `continueGame(g)`, `snapshot(g)`.
  Runs with a seeded `Math.random`, a manual frame clock, and no network.
- `tests/harness/load-module.cjs` — `loadGlobal('SATISFY_DATA', ['data/monsters.js', ...])` runs
  classic scripts in Node and returns the global they fill (`loadModules(...)` does the same for `Satisfy`).

Example parity check:

```js
const H = require('../harness/game.cjs');
const g = await H.openGame();
const defs = await g.eval(() => Satisfy.local.defs());
// compare defs.MT with SATISFY_DATA.monsters.types ...
await g.close(); await H.closeBrowser();
```

## Change log

- **api 1** (SAT-ONLINE-001): `Satisfy.storage`, `Satisfy.net`, `Satisfy.local`, `__G.defs()`.
- **api 1, additive** (SAT-ONLINE-002): `Satisfy.presence`, `Satisfy.transports`, `Satisfy.local.net()`, storage slots, `PlayerPublic.arm`.
- **api 1, fix** (SAT-ONLINE-002 review, #10/#23): NET_LIVE: every in-game screen (`qd`, `gname`, `controls`, `enhfx`, `lang` too), so reading a quest neither hides the player nor forfeits a duel; `tests/unit/modes.test.cjs` checks it against every `mode=` in the game.
- **api 1, fix** (SAT-ONLINE-001 review, #10): `world().y0` = `-NR*TS`, the top edge; `validatePlayerPublic` accepts `y >= world.y0`, so players in the north (negative y) are no longer dropped.
