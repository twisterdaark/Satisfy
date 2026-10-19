# NET/PVP backlog U001–U038 (plan doc §33–§34) — status

Owner: Claude-A · written with SAT-ONLINE-009, updated through SAT-ONLINE-013 · ✅ done · 🟡 partly · ⏳ needs a server or an owner decision (Blaze, D3) · ❌ not started

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
| U009 | Spatial interest management | ❌ | Next: a shard per zone (room key already carries `zone`); see `COST_MODEL.md` proposal 2 |
| U010 | Smooth remote movement | ✅ | Interpolation 100 ms in the past, snap on jumps (`unit/presence`) |
| U011 | Remote animations | ✅ | `anim` idle/walk/attack/dodge/dead |
| U012 | Network room browser | ❌ | One world shard today (`main`) |
| U013 | Rejoin same room | 🟡 | Reconnect after a drop and after reload (`regression/online-firebase`); one room only |
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
| U025 | World shard migration | ❌ | Needs U009 first |
| U026 | Safe Bairan | ✅ | `SAFE_ZONES` (SAT-ONLINE-003) |
| U027 | Safe Winston | ✅ | Same; every town is safe (Patrian, Reidan, Reinhardt too) |
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

**Totals:** ✅ 23 · 🟡 5 · ⏳ 7 · ❌ 3.
