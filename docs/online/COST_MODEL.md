# Online cost model (plan doc §28) — with this build's real numbers

Owner: Claude-A · SAT-ONLINE-008, updated by SAT-ONLINE-011 and SAT-ONLINE-014 · Regenerate the table with `node tools/cost-model.cjs`.

The doc's example is illustrative: 120-byte events, 8 recipients. This build measures the real
presence node instead (`Satisfy.net.toPlayerPublic` + `seq` + server time, as `src/net/firebase.js`
writes it). It is about **322 bytes of JSON, ~417 bytes on the wire** with the path and Realtime
Database framing. Without interest management every player listens to the whole shard, so each update
reaches **k = N − 1** players, not 8. Since SAT-ONLINE-014 a client listens only to players within 800 px
along the map (plus its party), so k is the crowd around a player, and each moving player re-downloads
the k full nodes in range every time its query re-centres (every 400 px).

`download/s = N × (msgs/s per player) × k × bytes + re-queries`. "Half moving" means moving players send at
5 Hz and idle players send the heartbeat. Party and duel inbox messages add about 2 per minute per player.

| Scenario | N | listeners k | msgs/s per player | download | GB per hour | Spark hours/month |
|---|---|---|---|---|---|---|
| doc §28 example (k = N−1, b = 120) | 20 | 19 | 5.03 | 229.5 kB/s | 0.826 | 12.1 |
| SAT-ONLINE-004 config: 20 players, half moving, 1 s idle heartbeat | 20 | 19 | 3.03 | 480.7 kB/s | 1.73 | 5.8 |
| now (SAT-ONLINE-008): 5 s idle heartbeat | 20 | 19 | 2.63 | 417.3 kB/s | 1.502 | 6.7 |
| now (SAT-ONLINE-011): only changed fields | 20 | 19 | 2.63 | 115.1 kB/s | 0.414 | 24.1 |
| now (SAT-ONLINE-014): 20 players, 5 within 800 px | 20 | 5 | 2.63 | 38.1 kB/s | 0.137 | 72.9 |
| now (SAT-ONLINE-014): 100 players (Spark cap), 10 within 800 px | 100 | 10 | 2.63 | 381 kB/s | 1.372 | 7.3 |
| without interest: 100 players | 100 | 99 | 2.63 | 2998 kB/s | 10.793 | 0.9 |
| now: 5 friends | 5 | 4 | 2.63 | 6.1 kB/s | 0.022 | 458.6 |

Spark gives **10 GB/month** of downloads and **100 simultaneous connections** (doc §28).

## What it means

- **Testing with friends is fine on Spark.** Five players use about 0.02 GB/hour now (0.08 before SAT-ONLINE-011).
- **A full 20-player shard used to burn Spark fast.** With every update carrying the whole public
  profile it used about 1.5 GB/hour, about 7 hours a month. The doc's `b = 120` figure hides this.
- **SAT-ONLINE-008:** online presence sends the idle heartbeat every 5 s instead of every 1 s, and remote
  players expire after 15 s instead of 5 s. A player who vanishes is still removed at once by the
  server's `onDisconnect`, and a reconnecting client republishes immediately (doc: recovery < 5 s).
- **SAT-ONLINE-011:** after the first full write, the client sends only the changed fields with
  `update()`, usually `{x, y, dir, anim, seq, t}`, and the database forwards only those to listeners. A
  full 20-player shard now uses about 0.41 GB/hour (~24 hours a month on Spark), and five friends use
  about 0.02 GB/hour. The first write and every reconnect still send the whole node.

- **SAT-ONLINE-014 (doc U009): interest management.** The presence listener is a Realtime Database
  range query, `orderByChild('x')` from x − 800 to x + 800 px, re-centred after moving 400 px (the
  screen is 480 px wide, so everything on it stays covered). A second query follows the party
  (`orderByChild('party').equalTo(id)`, SAT-ONLINE-018), so members see each other wherever they are, even
  ones who never met; it costs at most four extra listeners' worth of updates. A 20-player shard with about 5 players around each one drops to ~0.14 GB/hour
  (~73 hours a month on Spark), and a 100-player shard (Spark's connection cap) becomes ~1.4 GB/hour
  instead of ~11. The rules add `.indexOn: ["x", "party"]` on `presence/{world}/{shard}` so the server filters;
  until that is deployed the query still works, but the SDK downloads the whole shard and warns in the
  console.
  - Why a range query and not a shard per zone (the earlier proposal): players on either side of a zone
    border would not see each other, and changing zones would mean deleting and rewriting the node.
    The range has no borders and keeps one node path. y is not filtered (RTDB queries one child); the
    map is 724 × 144 tiles, so x carries almost all of the distance.

## World chat, notices and the player list (SAT-ONLINE-028)

- **World chat / notices** (`world/main`): every line is downloaded by every online player, so the cost is
  lines × N × ~150 B. At 20 players and one line every 10 s that is ~0.3 KB/s per player, about a tenth of a
  moving player's presence. A client joining reads only the last 2 minutes, and each author deletes its own
  lines after 10 minutes, so the path stays small. Sending is rate-limited in the client (one line per 1.5 s,
  4 per 15 s); the rules can't count, so a modified client could still flood the channel. If that happens the
  fix is a Cloud Function (Blaze) that drops lines over a rate, or moving chat to the WebSocket server of
  alternative B.
- **Player list** (`online/main/{uid}`, ~60 B): each client writes its entry about once a minute and on a zone or
  level change; the list is downloaded only while someone has it open (O), plus its changes while open.

## Shared monsters (SAT-ONLINE-031)

The zone's host writes its list of monsters near players 4 times a second: up to 60 entries of about 30 B, so up to
~2 KB per write and ~8 KB/s from the host, downloaded by every other player in that zone. With a handful of players
together that is the largest stream in the game, still within Spark at a few hours of play a day. If it grows:
send only the monsters that changed, or drop the rate to 2/s for monsters that are not fighting.

## Next steps

1. **Measure k.** The table assumes 5 players near each one in a 20-player shard. Town crowds are the
   worst case: in a single town k is still N − 1.
2. **Past that, alternative B in the doc:** Firebase Auth plus a WebSocket shard on Cloud Run (Blaze,
   owner decision). Fan-out costs are then server CPU instead of database downloads.

Measure the real bill from the Firebase console's *Usage* tab after a play session. The model counts
downloads only; reconnects, the initial snapshot on joining a shard, and cloud saves (a few hundred KB,
only when someone uploads or downloads one) come on top.
