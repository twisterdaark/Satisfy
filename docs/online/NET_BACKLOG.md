# NET/PVP backlog U001–U038 (plan doc §33–§34) — status

Owner: Claude-A · written with SAT-ONLINE-009, updated through SAT-ONLINE-064 (2026-10-20) · ✅ done · 🟡 partly · ⏳ needs a server or an owner decision (Blaze, D3) · ❌ not started

| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U001 | Google login, desktop | ✅ | SAT-ONLINE-004 (popup) |
| U002 | Google login, mobile | ✅ | SAT-ONLINE-004 (redirect when the popup is blocked) |
| U003 | Offline guest mode | ✅ | On `*.github.io` the game opens online (a7439b3), `?net=off` plays offline; elsewhere offline is the default and nothing online loads without `?net=` (`regression/boot`, `regression/onlinedefault`) |
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
| U026 | Safe Bairan | 🟡 | `SAFE_ZONES` (SAT-ONLINE-003): no duels and no open PvP inside (SAT-ONLINE-038 checks it on both sides), but it is still a client-side policy, not a server PvP authority (doc §59 C16; D3). The undefined interior strip is `void`, never safe (SAT-ONLINE-019, C06) |
| U027 | Safe Winston | 🟡 | Same as U026; every town is in the list (Patrian, Reidan, Reinhardt too) |
| U028 | Spawn shield | ⏳ | Only matters with open PvP (R5) |
| U029 | Projectile boundary test | ⏳ | R5 |
| U030 | Duel request UI | ✅ | SAT-ONLINE-006 (K, Y/N prompt) |
| U031 | Duel countdown | ✅ | SAT-ONLINE-006 |
| U032 | Duel arena ring | ✅ | SAT-ONLINE-006 |
| U033 | Duel normalized mode | ✅ | SAT-ONLINE-006 (4–18 of 100 duel HP per hit) |
| U034 | Duel spectator | ✅ | SAT-ONLINE-013: `PlayerPublic.duel` ("id:HP"), bars over both duelists and a ring for everyone nearby |
| U035 | Open PvP toggle | 🟡 | SAT-ONLINE-038 (#72, owner 2026-10-19): open PvP outside towns, capped hits (3–9% of max HP) applied by the victim's own client, the victim checks rate and range; not cheat-proof until Trusted Combat (D3) |
| U036 | Party friendly fire | ✅ | SAT-ONLINE-038: no hits inside a party, checked by the attacker and again by the victim (`unit/pvp`, `regression/pvp`) |
| U037 | Outlaw flag | ✅ | SAT-ONLINE-038: a kill makes the killer an outlaw for 10 min (`PlayerPublic.ol`, red name for everyone, `S.olT` kept across a reload); the kill counts only from a real, recent hit |
| U038 | Bounty board | 🟡 | SAT-ONLINE-051 (#84): gold on an outlaw's head from its card, paid once to its PvP killer through the victim's own kill record (`bountyPaid`), taken back from the board; karma (SAT-ONLINE-052, #85): murders cost points and lengthen the red name, -5 is a murderer; gold has no ledger (D3) |

**Totals:** ✅ 24 · 🟡 9 · ⏳ 3 · ❌ 2.

## Social U046–U065 (plan doc §35 [SOC])

| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U046 | Nearby player context | ✅ | SAT-ONLINE-020: click/tap a player → card with Invite / Duel / Block, aimed at their uid (`regression/playermenu`: twin names) |
| U047 | Party invite | ✅ | SAT-ONLINE-003: invites expire after 30 s, decline, busy/full replies; blocked senders dropped (016) |
| U048 | Party accept | 🟡 | The leader caps the party at 5 when accepts arrive, a raid at 10 (SAT-ONLINE-060, #93); no server transaction yet |
| U049 | Party leader election | ✅ | SAT-ONLINE-024: a leader gone 15 s (longer than a reload) is replaced by the remaining member with the lowest uid; members whose clocks differ still agree; a returning old leader joins the new party (`regression/partylead`) |
| U050 | Party roles | ✅ | SAT-ONLINE-025: a badge (tank/healer/damage/support) picked in the party panel, `PlayerPublic.role`; in a raid against bosses it does something (SAT-ONLINE-061, #95): a tank draws the boss and takes 30% less, a healer heals the raid near it every 3 s, damage +15%, support -15% near it |
| U051 | Party HP UI | ✅ | SAT-ONLINE-021: `PlayerPublic.hp` (5% steps, nothing else of the profile); a bar per member in the party panel |
| U052 | Party pings | ✅ | SAT-ONLINE-021: Alt+click (touch: Ping marks where you stand) → `party.ping`; a ring on the ground and the minimap for 3 s; one per member per 1.5 s |
| U053 | Party chat | 🟡 | SAT-ONLINE-016: party lines, rate-limited, block list; world chat for everyone (SAT-ONLINE-026), guild chat (SAT-ONLINE-049, #81), world notices as lines (SAT-ONLINE-041); no profanity filter |
| U054 | Party summon | ⏳ | A teleport needs a movement authority |
| U055 | Party follow | ❌ | |
| U056 | Shared PvE XP | ⏳ | Needs a combat authority; a party raid pays each member their own rewards (009) |
| U057 | Personal loot | 🟡 | SAT-ONLINE-009: each member's own game pays the boss kill once per encounter; no server ledger |
| U058 | Need/Greed loot | 🟡 | SAT-ONLINE-063 (#96): every raid boss kill rolls one bonus piece among those who fought it, Need/Greed/Pass run by the raid leader, the roll a hash anyone checks; only the winner's game makes it; server random + ledger still D3 |
| U059 | Friends and follow | ❌ | |
| U060 | Guild invitations | 🟡 | SAT-ONLINE-046/049/050 (#79, #81, #82): guilds in the database (unique names, ranks master/officer/member), invites from the card, remove, disband, the guild under the name, guild chat and the vault. Guild buildings: SAT-ONLINE-065 (#99) |
| U061 | Emotes | ✅ | SAT-ONLINE-022: V (touch: Emote) → wave/dance/point/cheer for 3 s as `PlayerPublic.em` (a fixed list, no text); one per 2 s |
| U062 | Chat moderation | 🟡 | Block list + rate limit (016); no report or keyword filter |
| U063 | Player trade request | 🟡 | SAT-ONLINE-039 (#76): serverless trade, Accept then Confirm, any change resets the accepts, one update with the `tradedItems` ledger so an item can't be traded twice; gold has no ledger (D3) |
| U064 | Player inspect | ✅ | SAT-ONLINE-020: the card shows only PlayerPublic (name, level, class, title, party, armour) |
| U065 | Party reconnect | ✅ | SAT-ONLINE-023: the party lives in the tab's sessionStorage; within 60 s a reloaded member auto-accepts its leader's invite back and a reloaded leader keeps its party. Leaving on purpose is final (`regression/rejoin`) |

**Totals (social):** ✅ 9 · 🟡 7 · ⏳ 2 · ❌ 2.

## Online since the backlog (owner requests and Claude-B's #13 handoff), not in U001–U065

| Feature | Where | Status |
|---|---|---|
| Shared monsters: the same position, health, death, attacks on every screen; bosses after the nearest player, Trauka's breath, phase roars | B's host rule (5f0a7e2, d0cecd4); SAT-ONLINE-042 (#73), 045 (#77) | ✅ |
| World and server notices reach everyone, also in the chat | SAT-ONLINE-041 (#71) | ✅ |
| Numbers and effects over your player on every screen; others' action sounds; their death and return | SAT-ONLINE-043 (#74), 047 (#78), 058 (#91) | ✅ |
| Weather, herbs, knocked-out townsfolk the same for everyone (server clock) | SAT-ONLINE-044 (#75) | ✅ |
| Things dropped on the ground: everyone sees them, one player takes each | SAT-ONLINE-048 (#80) | ✅ |
| A player on another build: only the older page refreshes | SAT-ONLINE-045 (#77) | ✅ |
| Trade with a two-step confirm | SAT-ONLINE-039 (#76) | ✅ |
| Guilds, guild chat, guild vault; guild buildings (a treasury, the Forge, the Training Hall, the Treasure Hall) | SAT-ONLINE-046/049/050 (#79, #81, #82); 065 (#99) | ✅ |
| Karma, bounties, ranked arena seasons | SAT-ONLINE-051/052/053 (#84–#86) | ✅ |
| Legendary classes one per world; rankings with the real players; Trauka's half hour shared | SAT-ONLINE-054/055/056 (#88–#90) | ✅ |
| Weekly lockouts: a dungeon boss chest pays once a week per account (dungeons are shared already: one world, shared monsters) | SAT-ONLINE-059 (#92) | ✅ |
| Raids of up to 10, raid roles against bosses, raid loot rolls | SAT-ONLINE-060/061/063 (#93, #95, #96) | ✅ |
| The National Competition: every two hours, hunting, production, arena; paid by rank | SAT-ONLINE-064 (#98) | ✅ |
| "Delete my online data" also erases rankings, arena ratings, lockouts and held legends | SAT-ONLINE-066 (#97) | ✅ |
| "Follow" a party mate | SAT-ONLINE-068 (#102) | ✅ |
| Friends: ask from the card, accept, who is online and where | SAT-ONLINE-067 (#101) | ✅ |
| Whispers to friends anywhere (`/w name text`) | SAT-ONLINE-070 (#104) | ✅ |
| Report a player; insults in others' chat as stars (`/filter`) | SAT-ONLINE-071 (#105) | ✅ |
| Group finder (plan U185): who is looking for a raid, party, dungeon group or duel, with level, class, party role and place; your own entry goes when you stop, sign out or drop | SAT-ONLINE-073 (#106) | open |

Not cheat-proof yet (the owner knows): trades, drops, the vault, PvP hits, bounties, ratings, competition scores, raid heals and rolls trust each client; a game server (D3) closes that.
