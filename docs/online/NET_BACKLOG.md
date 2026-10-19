# NET/PVP backlog U001–U038 (plan doc §33–§34) — status

Owner: Claude-A · written with SAT-ONLINE-009, updated through SAT-ONLINE-019 · ✅ done · 🟡 partly · ⏳ needs a server or an owner decision (Blaze, D3) · ❌ not started

| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U001 | Google login, desktop | ✅ | SAT-ONLINE-004 (popup) |
| U002 | Google login, mobile | ✅ | SAT-ONLINE-004 (redirect when the popup is blocked) |
| U003 | Offline guest mode | ✅ | Offline is the default; nothing online loads without `?net=` (`regression/boot`) |
| U004 | Account profile creation | ✅ | SAT-ONLINE-007 `profiles/{uid}` |
| U005 | Appearance sync | ✅ | `PlayerPublic.look/arm` (SAT-ONLINE-002) |
| U006 | Session leases | ✅ | SAT-ONLINE-010: `sessions/{uid}`, the newest session wins, "Play here" takes over |
| U007 | Connection indicator | ✅ | HUD badge from the net state machine (§25) |
| U008 | Player presence | ✅ | SAT-ONLINE-002/004 |
| U009 | Spatial interest management | ✅ | SAT-ONLINE-014: range query on `x` (±800 px, re-centred every 400 px); SAT-ONLINE-018: a second query on the party id, so all members see each other wherever they are; `regression/interest`, `COST_MODEL.md` |
| U010 | Smooth remote movement | ✅ | Interpolation 100 ms in the past, snap on jumps (`unit/presence`) |
| U011 | Remote animations | ✅ | `anim` idle/walk/attack/dodge/dead |
| U012 | Network room browser | ❌ | One world shard today (`main`) |
| U013 | Rejoin same room | 🟡 | Reconnect after a drop and after reload (`regression/online-firebase`), and back into the same party (SAT-ONLINE-023); one room only |
| U014 | Stale state watchdog | ✅ | Remotes expire (15 s online, 5 s local); onDisconnect on the server |
| U015 | Latency diagnostics | ✅ | SAT-ONLINE-012: smoothed write round trip in `net().link` and the badge tooltip |
| U016 | Public profile projection | ✅ | SAT-ONLINE-007 (public fields only, §23) |
| U017 | Cloud Function command bus | ⏳ | Blaze (D3) |
| U018 | Offline-to-online migration | 🟡 | SAT-ONLINE-007 moves a save between devices with consent; a wallet migration is server-side (D4) |
| U019 | Rate limiting | ✅ | Presence per-sender budget, duel hits per second, rules on every write |
| U020 | Network observability | 🟡 | `net().stats`/`net().link` and the badge tooltip (SAT-ONLINE-012); no dashboard |
| U021 | Auth emulator CI | 🟡 | A fake Firebase that applies a copy of the rules; the real emulator isn't reachable from this sandbox |
| U022 | Config/env isolation | 🟡 | Public web config in `src/net/firebase-config.js`; no staging project |
| U023 | Protocol versioning | ✅ | Envelope `v: 1`, `PROTOCOL_VERSION` (§25) |
| U024 | Load testing swarm | ✅ | `unit/chaos` 100-client soak (in memory) |
| U025 | World shard migration | ❌ | U009 is in, but there is still one shard (`main`); migration needs more than one |
| U026 | Safe Bairan | 🟡 | `SAFE_ZONES` (SAT-ONLINE-003) is a client-side policy: it stops duels and labels the town, but there is no server PvP authority yet (doc §59 C16; R5 needs D3). The undefined interior strip is `void`, never safe (SAT-ONLINE-019, C06) |
| U027 | Safe Winston | 🟡 | Same as U026; every town is in the list (Patrian, Reidan, Reinhardt too) |
| U028 | Spawn shield | ⏳ | Only matters with open PvP (R5) |
| U029 | Projectile boundary test | ⏳ | R5 |
| U030 | Duel request UI | ✅ | SAT-ONLINE-006 (K, Y/N prompt) |
| U031 | Duel countdown | ✅ | SAT-ONLINE-006 |
| U032 | Duel arena ring | ✅ | SAT-ONLINE-006 |
| U033 | Duel normalized mode | ✅ | SAT-ONLINE-006 (4–18 of 100 duel HP per hit) |
| U034 | Duel spectator | ✅ | SAT-ONLINE-013: `PlayerPublic.duel` ("id:HP"), bars over both duelists and a ring for everyone nearby |
| U035 | Open PvP toggle | ⏳ | R5 needs Trusted Combat (Blaze, D3) |
| U036 | Party friendly fire | ⏳ | R5 |
| U037 | Outlaw flag | ⏳ | R5 |
| U038 | Bounty board | ⏳ | R5 + ledger |

**Totals:** ✅ 22 · 🟡 7 · ⏳ 7 · ❌ 2.

## Social U046–U065 (plan doc §35 [SOC])

| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U046 | Nearby player context | ✅ | SAT-ONLINE-020: click/tap a player → card with Invite / Duel / Block, aimed at their uid (`regression/playermenu`: twin names) |
| U047 | Party invite | ✅ | SAT-ONLINE-003: invites expire after 30 s, decline, busy/full replies; blocked senders dropped (016) |
| U048 | Party accept | 🟡 | The leader caps the party at 5 when accepts arrive; no server transaction yet |
| U049 | Party leader election | ❌ | The party dissolves when the leader leaves |
| U050 | Party roles | ❌ | |
| U051 | Party HP UI | ✅ | SAT-ONLINE-021: `PlayerPublic.hp` (5% steps, nothing else of the profile); a bar per member in the party panel |
| U052 | Party pings | ✅ | SAT-ONLINE-021: Alt+click (touch: Ping marks where you stand) → `party.ping`; a ring on the ground and the minimap for 3 s; one per member per 1.5 s |
| U053 | Party chat | 🟡 | SAT-ONLINE-016: party-only, rate-limited, block list; no profanity filter |
| U054 | Party summon | ⏳ | A teleport needs a movement authority |
| U055 | Party follow | ❌ | |
| U056 | Shared PvE XP | ⏳ | Needs a combat authority; a party raid pays each member their own rewards (009) |
| U057 | Personal loot | 🟡 | SAT-ONLINE-009: each member's own game pays the boss kill once per encounter; no server ledger |
| U058 | Need/Greed loot | ⏳ | Server random + ledger |
| U059 | Friends and follow | ❌ | |
| U060 | Guild invitations | ⏳ | Guilds are local game content today |
| U061 | Emotes | ✅ | SAT-ONLINE-022: V (touch: Emote) → wave/dance/point/cheer for 3 s as `PlayerPublic.em` (a fixed list, no text); one per 2 s |
| U062 | Chat moderation | 🟡 | Block list + rate limit (016); no report or keyword filter |
| U063 | Player trade request | ⏳ | Needs inventory escrow on a server (D3) |
| U064 | Player inspect | ✅ | SAT-ONLINE-020: the card shows only PlayerPublic (name, level, class, title, party, armour) |
| U065 | Party reconnect | ✅ | SAT-ONLINE-023: the party lives in the tab's sessionStorage; within 60 s a reloaded member auto-accepts its leader's invite back and a reloaded leader keeps its party. Leaving on purpose is final (`regression/rejoin`) |

**Totals (social):** ✅ 7 · 🟡 4 · ⏳ 6 · ❌ 3.
