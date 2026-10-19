# Engine API (R0)

> ملخص: هذه الواجهات التي يعتمد عليها Claude-B (المحتوى والاختبارات) وطبقة الأونلاين القادمة.
> كلها قراءة فقط ولا تغير الـGameplay. أي تغيير فيها يُعلن هنا وفي الـIssue المعنية.

Owner: Claude-A · Introduced by SAT-ONLINE-001 (#1) · API version `Satisfy.local.api === 1`

The game is still one IIFE in `index.html`. Two classic scripts load before it and create a
global namespace `window.Satisfy`; the game adds a read-only `Satisfy.local` at the end of boot.

```html
<script src="src/core/storage.js"></script>   <!-- Satisfy.storage -->
<script src="src/core/ids.js"></script>       <!-- Satisfy.ids (SAT-ONLINE-005) -->
<script src="src/core/state.js"></script>     <!-- Satisfy.state (SAT-ONLINE-005) -->
<script src="src/core/events.js"></script>    <!-- Satisfy.events (SAT-ONLINE-005) -->
<script src="src/net/contracts.js"></script>  <!-- Satisfy.net -->
<script src="src/net/presence.js"></script>   <!-- Satisfy.presence (SAT-ONLINE-002) -->
<script src="src/net/transport-local.js"></script> <!-- Satisfy.transports -->
<script src="src/net/party.js"></script>      <!-- Satisfy.party (SAT-ONLINE-003) -->
<script src="src/net/duel.js"></script>       <!-- Satisfy.duel (SAT-ONLINE-006) -->
<script src="src/net/raid.js"></script>       <!-- Satisfy.raid (SAT-ONLINE-009) -->
<script src="src/net/cloud.js"></script>      <!-- Satisfy.cloud (SAT-ONLINE-007) -->
<script src="src/net/firebase-config.js"></script> <!-- Satisfy.firebaseConfig (public web config) -->
<script src="src/net/firebase.js"></script>   <!-- Satisfy.firebase (SAT-ONLINE-004), SDK loaded on demand -->
<script> (()=>{ ...game...; Satisfy.local = Object.freeze({...}) })() </script>
```

## `Satisfy.local` — read-only view of the running game

| Member | Returns |
|---|---|
| `api` | `1` |
| `defs()` | Deep copy of content tables as plain JSON: `MT`, `BOSSES`, `SPAWN`, `QD` (static quests only, no generated board quests), `RC`, `SKD`, `NPCS`, `TOWNS`, `ZR`, `MATS`. Functions (e.g. `RC[i].unlock`) become `{ "$fn": "<source>" }`. Also at `window.__G.defs()`. |
| `world()` | `{ id: 'satisfy', tile: 16, w: 724, h: 144, outdoorH: 120, zones: [...ZR ids], towns: ['zBai','zWin','zPat','zReid','zRein'] }` (w is the physical width with the wilderness belts, from `MW`; it grows as towns are added). Rows `>= outdoorH` hold house interiors. |
| `rooms()` | House interiors: `[{ id: 'r<n>', kind: 'house'|'shop'|'armory'|'inn', zone }]`. Ids are stable for a given map. |
| `zoneAt(x, y)` | Zone id at a pixel position (`'zWin'`, `'zPlains'`, …). |
| `roomAt(x, y)` | `{ id, kind, zone }` if the position is inside a house interior, else `null`. |
| `inGame()` | `false` on title/demo screens. |
| `playerPublic(ctx?)` | The local player as a `PlayerPublic` (see below), or `null` outside a game. `ctx` may set `uid`, `sid`, `party`, `anim`, `t`. |
| `backups()` | `{ reason: rawJSON }` for every save backup of the current slot. |
| `profile()` | `{ pid, schema, durable }`: the durable part of the character (see `Satisfy.state`), deep-copied. `null` outside a game. What a cloud profile will hold (doc §23). |
| `events()` | The last 200 domain events (oldest first), see `Satisfy.events`. In memory only. |
| `onEvent(fn)` | Calls `fn(event)` for each new domain event; returns an unsubscribe function. |
| `net()` | `null` offline; with `?net=local` or a signed-in `?net=online`: `{ mode, state, uid, sid, count, drawn, remotes, stats, party, duel, raid, link, interest }`. `state` is one of `NET_STATES`; `interest` is the Firebase transport's `interest()` (null for `?net=local`). |

Content tables are **source data for SAT-CONTENT-001 parity tests**. They are not an editing
interface: changing values happens in `data/**` once the engine reads from it (after the split).

## `Satisfy.storage` — local save (see ADR-001)

| Member | Notes |
|---|---|
| `SCHEMA` | `5` — current `S.v`. |
| `KEY` | `'satisfy_proto_v4'` — historical name, kept for compatibility. |
| `BACKUP_PREFIX` | `'satisfy_proto_v4.backup.'` + `corrupt` / `from-v<N>` / `newer-v<N>`. |
| `decode(raw)` | `{ status: 'empty'|'corrupt'|'ok', raw, data?, schema?, error? }`. Never throws. |
| `encode(S, P, now?, {WS}?)` | `JSON {S, P:{x,y,hp,st,mp,food}, WS?, fmt:1, schema, savedAt}`. `WS` is the world state (guilds, territories, legends) main saves next to S and P. |
| `migrate(S, P, ctx)` | Runs the ladder in place; returns applied versions. `ctx = { PTS_LV, spawn:{x,y}, maxHP() }`. |
| `create(storage, {slot?})` | Adapter with `key`, `exists()`, `read()`, `write(S, P, {WS}?)`, `backup(reason, raw)`, `backups()`. Swallows storage errors. A slot stores under `satisfy_proto_v4@<slot>` (`?slot=` in the URL). |
| `slotKey(slot)` | Key for a slot; throws on names outside `[A-Za-z0-9_-]{1,16}`. |

Save shape compatibility rule: a save written by any build must load in the previous build.
Adding a field to `S` needs a default in `freshState()`; changing the meaning of a field needs a
new ladder step and `SCHEMA + 1`.

## `Satisfy.state`, `Satisfy.ids`, `Satisfy.events` (SAT-ONLINE-005, doc §05 R0.4/R0.5)

See ADR-002. Every key of `S` has one class:

| Class | Keys (examples) | Online meaning |
|---|---|---|
| `durable` | `lv`, `xp`, `gold`, `items`, `mats`, `qs`, `sk`, `tl`, `eq`, `aff`, `rep`, `guild`, `life`, … | Character progress. Goes into the cloud profile; a server owns it once it is authoritative. |
| `session` | `raid`, `zone`, `immT`, `swT`, `unstT`, `giftT`, `bq`, `bqT`, `hits`, `focus` | Saved locally so a reload feels the same; never shared or trusted. |
| `meta` | `v`, `wv`, `uid`, `pid` | Bookkeeping and ids. |

`P` is volatile (only `P_SAVED` = `x,y,hp,st,mp,food` is saved); UI state is ephemeral; `WS` is world
state (shared truth online). **Adding a key to `S`: add it to one list in `src/core/state.js`**;
`tests/unit/state.test.cjs` scans `index.html` and names any key that isn't listed. Unknown keys
count as durable, so nothing is dropped.

| Member | Notes |
|---|---|
| `state.classOf(k)`, `state.split(S)`, `state.profileOf(S)` | Class of a key; deep copies by class plus `unknown` keys; `{ pid, schema, durable }`. |
| `ids.ensure(S)` | Gives the character `S.pid` (kept if it exists, e.g. from a guild join) and every item `iid = 'it_' + pid + '_' + uid`. Called on save and load. |
| `ids.itemId(pid, uid)`, `ids.legacyUid(iid)` | The numeric `uid` is the legacy id; `(pid, uid)` is the stable item id. |
| `ids.uuid()` | RFC 4122 v4 request id. |
| `events.create({uuid, pid?, now?})` | `emit(type, payload, key?)`, `on(fn)`, `log()`, `seen(key)`, `reset()`. A key already emitted returns `null`. |

Events: `{ id: uuid, key, type, pid, at: S.playT, payload }`.

| Type | When | Key (prefixed with `pid:`) | Payload |
|---|---|---|---|
| `monster.kill` | a monster dies (same place quest kill credit is counted) | `kill:<type>:<count>` | `{ monster, n }` |
| `craft.item.created` | a forge finishes | `craft:item:<uid>` / `craft:arrows:<n>` | `{ recipe, r, slot, itemId }` |
| `quest.reward.claimed` | a quest turn-in pays out | `claim:<quest>` (null for repeatable quests) | `{ quest, gold, xp, item, cls }` |

`completeQ(id)` now pays only if the quest is still active and ready when it runs: a second call
(a double click, the dialog callback firing twice) pays nothing.

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
| `SAFE_ZONES`, `zonePolicy(zone)` | `['zBai','zWin','zPat','zReid','zRein']` (every town); `{ zone, safe, pvp:false, duel:false }`. The combat authority will reject PvP actions with `ZONE_SAFE` here. |

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

## `Satisfy.party` (SAT-ONLINE-003)

`Satisfy.party.create({ presence, uid, now?, max? })` runs on a presence client. Party id = `'p_' + leaderUid`; max 5.

| Member | Notes |
|---|---|
| `invite(remotePlayerPublic)` | `'sent'`, or `'busy'` / `'full'` / `'notLeader'` / `'already'` / `'bad'`. The first invite creates the caller's party. |
| `pendingInvite()`, `accept(pid)`, `decline(pid)` | Invites expire after 30 s. A player who is already in a party auto-declines. |
| `leave()`, `kick(uid)` | A leader who leaves removes everyone. Members leave when the leader has been missing for 5 s. |
| `members()` | Self first, then remotes whose `PlayerPublic.party` matches (the leader counts only players who accepted). |
| `tick()`, `on(fn)` | Events: `invite, joined, youJoined, declined, left, memberLeft, kicked, dissolved, full`. |

Messages `party.invite|accept|decline|kick` carry `{ to: uid, party }`. They go over BroadcastChannel locally, and through `inbox/{to}` in RTDB: only the recipient reads and deletes, a sender can't fake `from`, and messages older than 60 s are dropped. Until Server Authority a party is cosmetic: it gives no shared XP or loot.

In the game, near another player: `P` invites, `Y`/`N` answers, and the party panel sits under the minimap with a Leave button. Party members' names are green. The badge adds `· Safe zone` in every town (Bairan, Winston, Patrian, Reidan, Reinhardt).

## `Satisfy.duel` (SAT-ONLINE-006, doc §09 R4)

Consent-based duels on top of presence, no server. `create({ presence, uid, now?, pos, zone, policy? })`:

| Member | Notes |
|---|---|
| `challenge(remote)` | `'sent'` or `'bad'`/`'busy'`/`'safe'` (either side in a safe zone)/`'far'` (> `C.CHALLENGE_R` px). |
| `pendingChallenge()`, `accept(id)`, `decline(id)` | Answering a challenge. Accepting inside a town declines it. |
| `ready()` | Ready check; the `C.COUNTDOWN_MS` countdown starts when both sides are ready. |
| `hit(power)` | The game's attack reached the opponent; sends `duel.hit` with `k` = clamp(power, `MIN_HIT`, `MAX_HIT`). Returns the damage or 0. |
| `yield(why?)` | Surrender (or cancel before the fight). |
| `state()` | `{ phase: idle|asking|ready|countdown|fight|over, duel, foe, handle, hp, foeHp, meReady, foeReady, arena:{x,y,r}, countdown, last }`; `last` = the latest `{ result: win|lose, why }`. |
| `locked()` | True during countdown and fight. |
| `tick()` | Timers, arena (`C.ARENA_R`, out for `C.OUT_MS` = yield), teleport (> `C.TELEPORT_PX` in a tick = yield), entering a safe zone, opponent gone for `C.GRACE_MS` = win. |

Messages (`payload: { to, duel, k?, n? }`): `duel.challenge`, `duel.accept`, `duel.decline`, `duel.ready`,
`duel.hit` (k = damage, n = hit number), `duel.hp` (k = defender's duel HP, ≤ 5/s), `duel.yield`, `duel.end`.
Each side owns its own duel HP (100) and checks every hit for rate (at most `C.HITS_PER_S` in any second, so jitter that bunches hits doesn't drop one) and range
(`C.HIT_RANGE` from its real position). A duel moves no gold, items, materials, durability, real HP or
quest credit; the result goes to `S.duels = { w, l }`.

In the game: `K` challenges the nearest player outside towns, `Y`/`N` answer and `Y` is the ready
check; a bar at the top shows both duel HPs and the countdown, with a **Yield** button; the arena is a
dashed ring. Real death, travel or entering a town forfeits. `Satisfy.local.net().duel` = `state()` plus
`challenge`.

## `Satisfy.raid` (SAT-ONLINE-009, doc §10 R6)

A party fights one boss. `create({ presence, party, uid, now?, local })`; `local` is the game's side:
`boss(key) → {hp,max}|null`, `setHp(key, ratio)`, `kill(key)`, `damage(key, k)` (host), `claimed(enc)`, `claim(enc)`.

| Member | Notes |
|---|---|
| `isHost()`, `isMember()` | Host = the party leader (party of 2+). |
| `hit(key, k)` | A member's hit: sent to the host as `raid.hit`, returns `true` (the game undoes its local damage). The host or a solo player gets `false` (normal flow). |
| `killed(key)` | Host: its copy died; sends `raid.kill` to every member who hit it. |
| `touch(key)`, `tick()` | Host: send changed HP as `raid.state` (≤ 4/s) to the party. |
| `encounters()` | Host: `{ key: { enc, hitters } }`. |

Boss key = `"<type>@<spawn x>,<spawn y>"` (the same on every client). Members show the host's HP as a share
of their own copy's max (levels roll per client) and kill their copy only on `raid.kill`, with their own
normal rewards, once per encounter: `S.raidDone` keeps the last 30 claimed `"<host uid>:<encounter>"`
ids, so a resent message or a reload can't pay twice. When the host leaves, the party dissolves and
each client fights its own copy again. Messages travel in the inbox as `raid.*` with
`{ to, raid, k?, n? }` (rules redeploy). `Satisfy.local.net().raid = { host, member, encounters }`.

## `Satisfy.cloud` (SAT-ONLINE-007, doc §06 R1, §23, §24, D4)

`create(sdk, { uid, now? })` on the handle from `Satisfy.firebase.load()`:

| Member | Notes |
|---|---|
| `writeProfile(S, lang)` | `profiles/{uid}` = `{ handle, look, language, titleId, classId, lv, revision, t }`, the public profile of §23. Readable by signed-in players, written by the owner; `revision` must go up (read once before the first write, so a device with a slow clock can't be locked out). |
| `list()` | This account's cloud characters, newest first: `[{ pid, handle, lv, cls, schema, savedAt, rev, size }]` from `cloudIndex/{uid}`. |
| `upload(raw)` | Copies a save string to `cloudSaves/{uid}/{pid}` then indexes it. Needs `S.pid`; at most `MAX_BLOB` (400 000) characters. |
| `download(pid)` | The save string, or `null`. |
| `remove(pid)` | Index first, then the blob. |
| `profileFrom(S, lang, rev)`, `indexFrom(raw, rev)` | Pure helpers (tests). |

`Satisfy.storage.create(...).replace(raw, reason)` puts a downloaded save in place after keeping the
current one under `reason` (the game uses `before-cloud-<time>`); it refuses a string that doesn't decode.

A cloud save is a copy of the local save, not an online wallet (D4). Nothing moves without a second
click (§06: no silent writes; U003). In the game: signed in with `?net=online`, the title screen shows
**Cloud saves** with this device's character (**Upload**) and the account's characters (**Download**,
**Delete**). Offline and `?net=local` never show it.

## `Satisfy.firebase` (SAT-ONLINE-004)

| Member | Notes |
|---|---|
| `SDK_VERSION` | `'12.19.0'` (modular SDK from gstatic, via dynamic `import()`). |
| `load(config)` | Downloads and initializes once; resolves `{ m, app, auth, db }`. Only called for `?net=online`. |
| `currentUser(sdk)` | Saved Google session or `null`. |
| `signIn(sdk)` | Google popup; falls back to redirect when popups are blocked. |
| `transport(sdk, { uid, world, shard, interest?, onConnection?, onError? })` | Same shape as `transports.local`. Writes `presence/{world}/{shard}/{uid}` (nulls omitted, `seq`, `t` = server time), arms `onDisconnect().remove()` on every reconnect, and turns child added/changed/removed into presence envelopes. With `interest: { radius, step }` (SAT-ONLINE-014, doc U009) it listens only to players whose `x` is within `radius` px of the last published `x` (an `orderByChild('x')` range query, re-centred after moving `step` px); players left outside get a `presence.leave` at once. |
| `transport.watch(uids)` | Also follow these players wherever they are (the game passes its party members). Replaces the previous list. |
| `transport.interest()` | `{ radius, centre, watched }`; radius 0 = the whole shard. |

Rules: `backend/database.rules.json` (deploy with `firebase deploy --only database`). Deny by default; presence is readable by signed-in players, each player writes only their own node, every field is validated, and unknown fields are rejected. `tests/unit/rules.test.cjs` keeps the rules, the contract and the test fake in agreement.

In the game: `?net=online` shows **Play online (Google)** on the title screen. A saved session reconnects by itself, and the HUD badge shows `Connecting…` / `Online · players: N` / `Reconnecting…`. Presence sends at 5 Hz while moving. Offline and `?net=local` never download the SDK.

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
- **api 1, additive** (SAT-ONLINE-004): `Satisfy.firebase`, `Satisfy.firebaseConfig`, `net().state/uid`, `?net=online`.
- **api 1, additive** (SAT-ONLINE-014): interest management (doc U009). Online, presence comes from a range query on `x` (±800 px, re-centred every 400 px) plus each party member's node; `net().interest`, `transport.watch/interest`. Rules add `.indexOn: ["x"]` on `presence/{world}/{shard}` (redeploy; without it the query still works but downloads the whole shard).
- **api 1, additive** (SAT-ONLINE-013): `PlayerPublic.duel` = `"<duel id>:<duel HP>"` while in a duel's countdown/fight (null otherwise); other players see an HP bar over each duelist and a ring between them (doc U034). Presence + rules field (rules redeploy).
- **api 1, additive** (SAT-ONLINE-012): `net().link = { rtt, writes, fails }` (Firebase: smoothed ms until the server acknowledges a presence write); the HUD badge tooltip shows link, sent, received and dropped (doc U015, U020).
- **api 1, additive** (SAT-ONLINE-011): the Firebase transport writes presence in full once per connection, then `update()`s only changed fields (≈3.6× less download, `COST_MODEL.md`). Same database shape and rules.
- **api 1, additive** (SAT-ONLINE-010): `Satisfy.firebase.lease()`, `transport.release()`, RTDB `sessions/` (rules redeploy), "Play here" panel.
- **api 1, additive** (SAT-ONLINE-009): `Satisfy.raid`, `net().raid`, `S.raidDone`, RTDB inbox accepts `raid.*` (rules redeploy). Hooks in `hitMon()`/`killMon()`.
- **api 1, additive** (SAT-ONLINE-008): online presence `idleHz 0.2`, `expireMs 15000`, republish on reconnect; `tools/cost-model.cjs`.
- **api 1, additive** (SAT-ONLINE-007): `Satisfy.cloud`, `storage.replace()`, RTDB `profiles/`, `cloudIndex/`, `cloudSaves/` (rules redeploy), title-screen **Cloud saves**.
- **api 1, additive** (SAT-ONLINE-006): `Satisfy.duel`, `net().duel`, `S.duels`, RTDB inbox accepts `duel.*` messages with `{to, duel, k?, n?}` (rules redeploy).
- **api 1, additive** (SAT-ONLINE-005): `Satisfy.state`, `Satisfy.ids`, `Satisfy.events`, `Satisfy.local.profile/events/onEvent`, `S.pid` for every character, `item.iid`, storage writes `WS`, `__G.startMG(id)` (test hook).
- **api 1, additive** (SAT-ONLINE-003): `Satisfy.party`, `Satisfy.net.zonePolicy/SAFE_ZONES`, `net().party`, the RTDB `inbox/`. Presence now checks replays separately for state and messages.
