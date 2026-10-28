# Online cost model (plan doc §28) — with this build's real numbers

Owner: Claude-A · SAT-ONLINE-008, updated by SAT-ONLINE-011, SAT-ONLINE-014 and SAT-ONLINE-113 · Regenerate the table with `node tools/cost-model.cjs`.

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

## Measured: 100 clients (SAT-ONLINE-113, plan U372)

`tests/unit/load100` runs 100 real presence transports (`src/net/firebase.js`) over one in-process database
(`tests/harness/node-rtdb.cjs`, with range and party queries), with the game's online settings, for 60 simulated
seconds. Sixty players stand in four towns and forty are spread over the map. Half walk at 150 px/s, and ten
parties of three are scattered.

| Run | k (average within 800 px) | download, all clients | the model with that k | GB per hour |
|---|---|---|---|---|
| interest (800 px, re-centred every 400 px) | 14.4 | 522 kB/s (4,400 child events/s) | 528 kB/s | 1.88 |
| whole shard | 99 | 2,800 kB/s (26,000 events/s) | 2,960 kB/s | 10.1 |

- **The model holds.** It counts bytes the same way: the same framing, and a change costs the fields written. So the run checks the code's side of the model: how often it sends, how many players hear each one, and how often queries re-centre. The model is within 1% with interest and about 5% without.
- **Town crowds raise k** from the table's 10 to 14. A full 100-player shard is then about 1.9 GB an hour, about 5 hours a month on Spark.
- **So Spark is for testing** (Claude-B's review of #147): its 10 GB a month is about 5 hours of a full 100-player shard, or about 24 hours of a full 20-player one. Before opening the game to more than a few friends at a time, the project needs the Blaze plan (pay as you go: about $1 per GB downloaded) or the server (D3), and a budget alert in the Firebase console.
- **Everyone sees who they should.** Everyone within 350 px is seen, nobody past 1,250 px is, and every party member is seen wherever they are. Each client holds at most 7 listeners (3 for the range, 3 for the party, 1 for the inbox), and the run takes about 4 s of CPU.

## Next steps

1. **Measure k in play.** The run above gives about 14 for 100 players gathered in four towns. With everyone in a single town, k is still N − 1.
2. **Past that, alternative B in the doc:** Firebase Auth plus a WebSocket shard on Cloud Run (Blaze,
   owner decision). Fan-out costs are then server CPU instead of database downloads.

Measure the real bill from the Firebase console's *Usage* tab after a play session. The model counts
downloads only; reconnects, the initial snapshot on joining a shard, and cloud saves (a few hundred KB,
only when someone uploads or downloads one) come on top.
