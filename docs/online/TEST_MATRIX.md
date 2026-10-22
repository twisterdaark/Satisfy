# Test matrix T01–T40 (plan doc §29) — coverage

Owner: Claude-A · SAT-ONLINE-008 (T20/T21 updated by SAT-ONLINE-009, T37 by SAT-ONLINE-014, T35 by SAT-ONLINE-015, T31 by SAT-ONLINE-016)

Status: **✅ covered** · **🟡 partial** (what's missing is noted) · **⏳ needs a feature that doesn't exist yet** (R5 open PvP, a server, trading) · **❌ gap**.
Test paths are under `tests/`. "Fake" = `tests/harness/fake-firebase.js` (it applies a copy of the database rules).

| ID | What (doc §29) | Status | Where |
|---|---|---|---|
| T01 | Guest offline: new game, continue | ✅ | `regression/boot` (offline, no auth requests), `regression/save` (round trip), `regression/golden` |
| T02 | Migrating a v4 save | ✅ | `unit/storage` (v4→v5 ladder), `regression/save` (migrate + backup), `regression/golden` (same result as the baseline), `regression/ids` (ids on a legacy save) |
| T03 | Unique item ids | ✅ | `unit/ids` (`it_<pid>_<uid>`, idempotent), `regression/ids` (stable across reload, rollback) |
| T04 | Google sign-in popup | ✅ | `regression/online-firebase` (pinned SDK, project config) |
| T05 | Redirect sign-in on mobile | ✅ | `regression/online-firebase` (blocked popup → redirect) |
| T06 | Token refresh | 🟡 | `regression/online-firebase` (saved session reconnects after reload). Refresh within a session is the SDK's job; not testable with the fake. |
| T07 | Second-tab policy | 🟡 | `regression/online-local` (`?slot=` keeps saves apart; each tab is its own session). No rule yet for the same account in two tabs; both show as players. |
| T08 | Reconnect, onDisconnect | ✅ | `regression/online-firebase` (drop → removed for others → back on reconnect); `regression/soak` (20 drops of one, the other or both: positions, the party, one presence each, and no listener or onDisconnect added) |
| T09 | Stale ghost presence | ✅ | `unit/presence` (silent players expire), `regression/online-local` (closed tab removed) |
| T10 | Cross-instance filtering | ✅ | `unit/contracts` (room keys), `regression/online-local` (a player in a house is drawn only inside that house) |
| T11 | Invalid x/y | ✅ | `unit/contracts` (out-of-world rejected), `unit/rules` (database bounds cover the map; a wider map fails the test) |
| T12 | Presence rate limit | ✅ | `unit/presence` (10 Hz moving / 1 Hz idle; flooding dropped) |
| T13 | Safe town denies attack entry | ✅ | `unit/duel` (no challenge in or into a safe zone; entering one forfeits), `regression/duel` (no challenge in Winston), `regression/party` (every town is safe) |
| T14 | Projectile from outside hits someone inside a safe zone | ⏳ | Open PvP (R5). Duels can't start or continue in a town. |
| T15 | Dash across a town edge | ⏳ | R5. In a duel, entering a town forfeits (`unit/duel`). |
| T16 | Target changes instance after the attack | 🟡 | `unit/duel` (range check against the defender's real position). R5 needs the server check. |
| T17 | Friendly fire in a party | ⏳ | R5 (a party has no damage path at all today). |
| T18 | Duel refusal and expiry | ✅ | `unit/duel` (decline, expiry, busy, ready-check timeout), `regression/duel` (N declines) |
| T19 | Duplicate duel result | ✅ | `unit/chaos` (every message duplicated → one result each) |
| T20 | Same kill sent by two clients | ✅ | `unit/raid`, `regression/raid` (party boss: the leader's copy is the one that dies; members' copies die only on its `raid.kill`; one reward each). Outside a party each client keeps its own monsters. |
| T21 | Loot ledger idempotency | 🟡 | `unit/events`, `regression/ids` (a quest pays once; the baseline paid twice), `unit/raid` (a raid kill re-sent or replayed after a reload pays nothing: `S.raidDone`). The ledger itself is server-only (§23). |
| T22 | Reload during a trade | ⏳ | No player trading yet. |
| T23 | Privileged database write denied | ✅ | `unit/rules` (deny by default, owner-only paths, unknown fields rejected); every fake-backed regression test asserts `rejected = []` for the client's own writes |
| T24 | Offline quests and forge still work | ✅ | `regression/golden`, `regression/ids` (forge through the real minigame, quest turn-in) |
| T25 | Lag 300 ms and 1 s | ✅ | `unit/chaos` (presence, a party and a whole duel over 300 ± 60 ms and 1 s ± 200 ms) |
| T26 | Reordering and duplication | ✅ | `unit/chaos` (jitter + 50% duplicates: each duel hit counts once), `unit/presence` (separate replay windows), `unit/transport-ws` (combat on the relay later than a newer social message still counts; a replay on the relay is dropped) |
| T27 | 1% loss | ✅ | `unit/chaos` (presence complete, positions converge) |
| T28 | Simultaneous party invites | ✅ | `unit/chaos` (both bounce, the next invite works) |
| T29 | Party leader disconnects | ✅ | `unit/party` (members leave when the leader disappears) |
| T30 | Full party | ✅ | `unit/party` (capped at 5) |
| T31 | Blocked sender hidden | ✅ | `unit/chat` (a blocked player's chat lines, party invites and duel challenges never surface; forged lines from outside the party are ignored), `regression/chat` (⊘ in the party list hides their lines and their next invite; Block on the invite prompt) |
| T32 | Unicode names | ✅ | `unit/chaos` (Arabic and emoji, never cut in half, valid for the rules) |
| T33 | Malicious numbers in localStorage | 🟡 | `unit/contracts` (hostile values clamped before anything is published), `unit/storage` (corrupt/odd saves backed up). The game itself doesn't sanitize a hand-edited save (single-player, Claude-B's area). |
| T34 | Client-side inventory edits | ⏳ | Needs server inventory (§24: `inventory/$uid .write=false`). Today the inventory exists only in the local save. |
| T35 | Per-user data deletion | ✅ | `unit/cloud` (`eraseAll`: every record of the account, index before save, nobody else's), `regression/account` (Sign out; **Delete my online data** leaves nothing of the account online, the local save stays, another account is untouched), `regression/cloud` (delete one cloud character) |
| T36 | Unauthorized reads of other users' data | ✅ | `unit/rules` (cloud saves owner-only), `regression/cloud` (reading another account's cloud saves is denied) |
| T37 | Spectators | 🟡 | `regression/duel` (U034, SAT-ONLINE-013: a third player sees both duelists' HP and the ring). No free spectator camera. |
| T38 | Frame rate on mobile | ❌ | Needs a device lab. Mobile is playable since SAT-ONLINE-017 (touch controls, `regression/touch`), so the owner's phone check is the first real measurement. |
| T39 | 8-hour session | ❌ | A long soak needs a real browser and time. |
| T40 | 100-client soak | ✅ | `unit/chaos` (100 presence clients, a simulated minute: tables bounded, under 30 s CPU); `unit/load100` (100 real Firebase transports with interest management: who sees whom, downloads against the cost model) |

**Totals:** ✅ 27 · 🟡 6 · ⏳ 5 · ❌ 2 (T38, T39 need devices and time, not code).

Run everything with `npm test`; the network rows (T19, T25–T28, T32, T40) are `node --test tests/unit/chaos.test.cjs` and take about 10 s.
