# Online cost model (plan doc §28) — with this build's real numbers

Owner: Claude-A · SAT-ONLINE-008 · Regenerate the table with `node tools/cost-model.cjs`.

The doc's example is illustrative: 120-byte events, 8 recipients. This build measures the real
presence node instead (`Satisfy.net.toPlayerPublic` + `seq` + server time, as `src/net/firebase.js`
writes it). It is about **322 bytes of JSON, ~417 bytes on the wire** with the path and Realtime
Database framing. On one shard every player listens to the whole shard, so each update reaches **N − 1**
players, not 8.

`download/s = N × (msgs/s per player) × (N − 1) × bytes`. "Half moving" means moving players send at
5 Hz and idle players send the heartbeat. Party and duel inbox messages add about 2 per minute per player.

| Scenario | N | msgs/s per player | download | GB per hour | Spark hours/month |
|---|---|---|---|---|---|
| doc §28 example (k = N−1, b = 120) | 20 | 5.03 | 229.5 kB/s | 0.826 | 12.1 |
| SAT-ONLINE-004 config: 20 players, half moving, 1 s idle heartbeat | 20 | 3.03 | 480.7 kB/s | 1.73 | 5.8 |
| now (SAT-ONLINE-008): 5 s idle heartbeat | 20 | 2.63 | 417.3 kB/s | 1.502 | 6.7 |
| proposal: + position-only updates | 20 | 2.63 | 115.1 kB/s | 0.414 | 24.1 |
| proposal: + 10 players per zone shard | 10 | 2.63 | 27.3 kB/s | 0.098 | 101.9 |
| now: 5 friends | 5 | 2.63 | 22 kB/s | 0.079 | 126.5 |

Spark gives **10 GB/month** of downloads and **100 simultaneous connections** (doc §28).

## What it means

- **Testing with friends is fine on Spark.** Five players use about 0.08 GB/hour, over 120 hours a month.
- **A full 20-player shard does not fit Spark for long.** With every update carrying the whole public
  profile, it uses about 1.5 GB/hour, about 7 hours a month. The doc's `b = 120` figure hides this.
- **Changed in SAT-ONLINE-008:** online presence now sends the idle heartbeat every 5 s instead of every
  1 s, and remote players expire after 15 s instead of 5 s. A player who vanishes is still removed at
  once by the server's `onDisconnect`. A reconnecting client republishes immediately, so recovery stays
  within the doc's 5-second budget.

## Proposals (not done; each needs a rules redeploy)

1. **Position-only updates.** Split `presence/{world}/{shard}/{uid}` into a static node (handle, look,
   class, level, title, party; written when it changes) and a small moving node (`x, y, dir, anim,
   seq, t`, about 70 bytes). That cuts download by about 3.6× and raises a full shard to ~24 hours a month.
2. **Interest management by zone.** Use one shard per zone (the room key already has `zone`), so players
   only listen to their zone. With 10 per zone, that's about 100 hours a month.
3. **Past that, alternative B in the doc:** Firebase Auth plus a WebSocket shard on Cloud Run (Blaze,
   owner decision). Fan-out costs are then server CPU instead of database downloads.

Measure the real bill from the Firebase console's *Usage* tab after a play session. The model counts
downloads only; reconnects, the initial snapshot on joining a shard, and cloud saves (a few hundred KB,
only when someone uploads or downloads one) come on top.
