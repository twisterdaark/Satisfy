# NET/PVP backlog U001–U038 (plan doc §33–§34) — status

Owner: Claude-A · written with SAT-ONLINE-009, updated through SAT-ONLINE-075 (2026-10-21) · ✅ done · 🟡 partly · ⏳ needs a server or an owner decision (Blaze, D3) · ❌ not started

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
| U055 | Party follow | ✅ | SAT-ONLINE-068 (#102): "Follow" on a party mate's card walks after them; any move key stops it (`regression/follow`) |
| U056 | Shared PvE XP | ⏳ | Needs a combat authority; a party raid pays each member their own rewards (009) |
| U057 | Personal loot | 🟡 | SAT-ONLINE-009: each member's own game pays the boss kill once per encounter; no server ledger |
| U058 | Need/Greed loot | 🟡 | SAT-ONLINE-063 (#96): every raid boss kill rolls one bonus piece among those who fought it, Need/Greed/Pass run by the raid leader, the roll a hash anyone checks; only the winner's game makes it; server random + ledger still D3 |
| U059 | Friends and follow | ✅ | SAT-ONLINE-067 (#101): ask from the card, accept, online list with level and place, told when they come online; whispers to friends anywhere (070, #104) |
| U060 | Guild invitations | 🟡 | SAT-ONLINE-046/049/050 (#79, #81, #82): guilds in the database (unique names, ranks master/officer/member), invites from the card, remove, disband, the guild under the name, guild chat and the vault. Guild buildings: SAT-ONLINE-065 (#99) |
| U061 | Emotes | ✅ | SAT-ONLINE-022: V (touch: Emote) → wave/dance/point/cheer for 3 s as `PlayerPublic.em` (a fixed list, no text); one per 2 s |
| U062 | Chat moderation | ✅ | Block list + rate limit (016); Report from the card (`reports`, read by the owner) and insults as stars with `/filter` (071, #105) |
| U063 | Player trade request | 🟡 | SAT-ONLINE-039 (#76): serverless trade, Accept then Confirm, any change resets the accepts, one update with the `tradedItems` ledger so an item can't be traded twice; gold has no ledger (D3) |
| U064 | Player inspect | ✅ | SAT-ONLINE-020: the card shows only PlayerPublic (name, level, class, title, party, armour) |
| U065 | Party reconnect | ✅ | SAT-ONLINE-023: the party lives in the tab's sessionStorage; within 60 s a reloaded member auto-accepts its leader's invite back and a reloaded leader keeps its party. Leaving on purpose is final (`regression/rejoin`) |

**Totals (social):** ✅ 12 · 🟡 6 · ⏳ 2 · ❌ 0.

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
| Group finder (plan U185): who is looking for a raid, party, dungeon group or duel, with level, class, party role and place; your own entry goes when you stop, sign out or drop | SAT-ONLINE-073 (#106) | ✅ |


## The plan's later updates in Claude-A's areas (U184–U189, U210–U246, U308–U348, U368–U387)

The plan document has 387 updates. Claude-B takes the content ones (classes, crafts, monsters, maps, quests, items, town life, end game). These are the online, economy, guild, engine, live-ops and QA ones. Same marks as above.

### Raids, online parts (plan §40)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U184 | Raid weekly lockouts | ✅ | SAT-ONLINE-059 (#92): `lockouts/{uid}/{week}/{boss}` once per account and UTC week, so changing the time zone resets nothing |
| U185 | Raid party finder | ✅ | SAT-ONLINE-073 (#106): the group finder; stopping, signing out or dropping removes your entry |
| U186 | Raid replay | ❌ | Needs an event log of the fight |
| U187 | Boss encyclopedia | ❌ | Content (B): traits revealed after a confirmed kill |
| U188 | Adaptive difficulty | ❌ | Boss health by party size |
| U189 | Seasonal world boss | 🟡 | Trauka's half hour and Berith's two-hour rest are shared through `world/satisfy/wb` (056, B's v0.87); no season schedule |

### Economy and trade (plan §42)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U210 | NPC price catalog | ✅ | B's one sell-price rule (v0.62): nothing sells for its buying price or more |
| U211 | Player-to-player trade | ✅ | SAT-ONLINE-039 (#76): Accept then Confirm, one update, both or neither |
| U212 | Trade cancel on disconnect | ✅ | A trade ends when the other player leaves or changes anything; the `tradedItems` ledger refuses the same item twice after a reconnect (`regression/trade`) |
| U213 | Auction market | 🟡 | B's auction window (v0.70) is the NPC auction house on each device; a market between players needs a ledger |
| U214 | Searchable item market | 🟡 | The auction window searches its listings; local only |
| U215 | Seller history | ❌ | |
| U216 | Bank deposits | 🟡 | The town bank keeps gold and items in the player's own save; not online |
| U217 | Bank withdrawal locks | 🟡 | Same as U216 |
| U218 | Gold sinks | 🟡 | Repairs, fees, the inn, the guild treasury, reputation-store prices (B); no counter of gold in and out |
| U219 | Crafting commissions | ❌ | |
| U220 | Region merchant caravans | ❌ | |
| U221 | Guild treasury | ✅ | SAT-ONLINE-065 (#99) + 069: gifts add exactly their amount, only the master and officers spend, and only on a building raised in the same write; `guildLog` keeps who did what |
| U222 | Fish market | ❌ | Content (B) |
| U223 | Crop wholesale market | ❌ | Content (B) |
| U224 | Rare gem exchange | 🟡 | Socketing and paid upgrades (B); no exchange between players |
| U225 | Repair market | ❌ | |
| U226 | Taxation caps | ❌ | There are no city taxes yet |
| U227 | Inflation dashboard | ❌ | |

### Guilds (plan §43)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U228 | Guild creation | ✅ | SAT-ONLINE-046 (#79): unique names (case-folded, `guildNames`), the founder is master |
| U229 | Guild recruitment | ❌ | Next: a recruiting board with applications |
| U230 | Guild rank permissions | 🟡 | Master, officer, member with fixed rights, checked by the rules; no custom ranks |
| U231 | Guild banners | 🟡 | A guild colour at founding; no emblem |
| U232 | Guild chat | ✅ | SAT-ONLINE-049 (#81): `/g`, members only by the rules, so a removed member loses it |
| U233 | Guild weekly quests | ❌ | |
| U234 | Guild forge | ✅ | SAT-ONLINE-065 (#99): the Guild Forge, +2% quality a level, capped at 3 levels |
| U235 | Guild housing | ❌ | |
| U236 | Guild treasury | ✅ | Same as U221 |
| U237 | Guild research tree | 🟡 | Three buildings of three levels paid from the treasury (065); no tree |
| U238 | Guild alliances | ❌ | |
| U239 | Guild wars | ❌ | |
| U240 | Territory objectives | ❌ | Sieges exist as world events (B), not owned by guilds |
| U241 | Guild leader handover | ❌ | Next: the master hands the guild to an officer |
| U242 | Guild event calendar | ❌ | |
| U243 | Guild notice board | ❌ | Next: a notice the master and officers write |
| U244 | Guild rankings | ❌ | Next: guilds by level and members |
| U245 | Guild diplomacy | ❌ | |
| U246 | Guild seasonal rewards | ❌ | |

### Engine (plan §47)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U308 | Extract state store | 🟡 | `src/core/state.js`: durable, volatile and UI keys (ADR-002); the game still writes `S` directly |
| U309 | Extract world generator | 🟡 | Seeded spawns (`mulberry32`), the same tiles on every client (`regression/worldparity`); still inside `index.html` |
| U310 | Renderer batching | 🟡 | The big map draws only the visible land from a cached copy (B, v0.60) |
| U311 | Entity registry | 🟡 | Stable keys for monsters (`type@sx,sy`), item ids (`iid`), character id (`pid`) |
| U312 | Animation state machine | ❌ | |
| U313 | Fixed tick simulator | ❌ | Tests step frames by hand (the harness); the game runs on frame time |
| U314 | Dedicated game clock | ✅ | Server clock offset (`wNow`, SAT-ONLINE-044) for everything shared |
| U315 | Localization bundles | 🟡 | `STR.ar`/`STR.en` in the page; the UI falls back to the key |
| U316 | Asset loader | 🟡 | Sprite sheets in `sprites-original/` (B) |
| U317 | Save migrations | ✅ | Save versions with backups (ADR-001); old saves keep working (`regression/golden`, `regression/save`) |
| U318 | Map testing | ✅ | `regression/towns`, `worldparity`, `boot`; every door reachable |
| U319 | Command validation | ✅ | Every message is checked against the contract and dropped when invalid, oversized, replayed or too frequent (`src/net/contracts.js`, `unit/contracts`, `unit/presence`) |
| U320 | Data catalogs | ✅ | `data/*.js` with `tests/content/data` |
| U321 | Audio mixer | 🟡 | One volume; no separate channels |
| U322 | Accessibility QA | 🟡 | Keyboard and touch for every menu (B, v1.01) |
| U323 | Replay recorder | ❌ | |
| U324 | Exception boundary | 🟡 | A failing listener can't stop presence; network errors show in the badge |
| U325 | Performance profiler | 🟡 | `net().link` (round trip, sent, received, dropped) in the badge tooltip; no frame-time budget |
| U326 | Build pipeline | 🟡 | Tests on every PR by hand; GitHub Pages serves main as it is |
| U327 | Staging deployment | ⏳ | Needs a second Firebase project (owner) |
| U328 | Rollback support | 🟡 | Every update is one merge on main, so reverting one is one commit; rules have `rules-next` |

### Live ops (plan §48)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U329 | Daily world events | ✅ | World events by the server clock, once for everyone (SAT-ONLINE-041/044) |
| U330 | Seasonal progression | ✅ | Monthly arena seasons; ratings reset, items stay (SAT-ONLINE-053) |
| U331 | World boss calendar | ❌ | Next: a calendar of the coming events in your own time zone |
| U332 | Limited festivals | ✅ | The town festival every third hour (B, v0.94) |
| U333 | Balance dashboard | ❌ | |
| U334 | Economy health | ❌ | |
| U335 | Content flags | 🟡 | Older pages skip what they don't know (fx tags, presence fields) |
| U336 | Announcement system | ❌ | World notices come from events only; no owner message |
| U337 | Maintenance notices | 🟡 | "A new version" box asks only the older page to refresh (SAT-ONLINE-045) |
| U338 | Hotfix pipeline | 🟡 | Small PRs, a review, then main |
| U339 | Moderation console | 🟡 | Reports reach the database; the owner reads them in the Firebase console |
| U340 | Player appeal flow | ❌ | |
| U341 | Crash reporting | ❌ | |
| U342 | A/B testing ethics | ⏳ | No tests on players; owner decision |
| U343 | Community feedback triage | 🟡 | GitHub issues and in-game reports |
| U344 | Season rewards | 🟡 | Titles for the National Champion and the arena; cosmetic |
| U345 | Retention without grind | 🟡 | Nothing is lost for a missed day; daily caps on repeatable quests (B) |
| U346 | Data export/delete | 🟡 | "Delete my online data" (SAT-ONLINE-015/066); export is next |
| U347 | Disaster recovery | ⏳ | Database backups need the Blaze plan (owner) |
| U348 | Shard scale-out | ⏳ | One shard (`main`) |

### QA (plan §50)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U368 | Automated unit test harness | ✅ | `tests/unit`, `tests/content`, `tests/regression` with a seeded random and a frame clock |
| U369 | Firebase rules fuzzing | 🟡 | The fake applies a copy of the rules and every test checks `rejected`; `unit/rules` checks each block, duplicate keys and expression syntax; no random fuzzing |
| U370 | Multi-browser smoke | 🟡 | Chromium in the tests; the owner tests desktop and phone |
| U371 | Reconnect soak | 🟡 | `unit/chaos` (drops, delays, duplicates); `regression/online-firebase` reconnects |
| U372 | Load test 100 clients | 🟡 | `COST_MODEL.md` measured numbers; no 100-client run |
| U373 | Combat determinism | 🟡 | Seeded random and frame clock in tests |
| U374 | Dupe attack cases | ✅ | Replayed and reordered messages dropped (`unit/presence`); claims once (`dropClaims`, `tradedItems`, `bountyPaid`, `natPaid`, lockouts) |
| U375 | Safe zone exploit cases | ✅ | No duel or PvP damage in towns, checked on both sides (`regression/pvp`, SAT-ONLINE-038) |
| U376 | Trade race tests | ✅ | `regression/trade`: any change resets the accepts; the same item twice is refused |
| U377 | Boss raid race tests | ✅ | `regression/raid`, `raidloot`: one boss death, one reward each, nothing paid twice |
| U378 | Save backward compatibility | ✅ | `regression/golden` and the characterization tests against the R0 baseline |
| U379 | Localization regressions | 🟡 | Tests run in English; Arabic lines are written with each feature |
| U380 | Art provenance audit | 🟡 | `docs/art/ART_CONTRACT.md` (B) |
| U381 | Security incident drill | ⏳ | Owner (Firebase console) |
| U382 | Data retention review | 🟡 | Only what play needs is online; entries expire (lfg 30 min, chat lines, inbox) |
| U383 | Community report resolution | ❌ | |
| U384 | Version gate report | 🟡 | Every PR lists the tests it ran |
| U385 | Rollback rehearsal | ❌ | |
| U386 | Documentation sync | ✅ | This backlog, `OWNER_TEST_GUIDE.md`, the update log on every merge |
| U387 | Pilot invite-only rollout | ⏳ | Owner |

**Totals (U184–U189, U210–U246, U308–U348, U368–U387):** ✅ 25 · 🟡 39 · ⏳ 6 · ❌ 34 of 104. Next from here: guild leader handover, notice board and rankings (U241, U243, U244), the event calendar (U331), guild recruitment (U229) and data export (U346).

Not cheat-proof yet (the owner knows): trades, drops, the vault, PvP hits, bounties, ratings, competition scores, raid heals and rolls trust each client; a game server (D3) closes that.
