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
| U013 | Rejoin same room | ✅ | Reconnect after a drop and after reload (`regression/online-firebase`), and back into the same party (SAT-ONLINE-023); SAT-ONLINE-115: a reload inside a guild hall goes on in the same guild's hall (the save keeps the visit and where you came in), or puts you back where you came in when it can't (offline 15 s, no longer a member or a guest) (`regression/guildhall`) |
| U014 | Stale state watchdog | ✅ | Remotes expire (15 s online, 5 s local); onDisconnect on the server |
| U015 | Latency diagnostics | ✅ | SAT-ONLINE-012: smoothed write round trip in `net().link` and the badge tooltip |
| U016 | Public profile projection | ✅ | SAT-ONLINE-007 (public fields only, §23) |
| U017 | Cloud Function command bus | ⏳ | Blaze (D3) |
| U018 | Offline-to-online migration | 🟡 | SAT-ONLINE-007 moves a save between devices with consent; a wallet migration is server-side (D4) |
| U019 | Rate limiting | ✅ | Presence per-sender budget, duel hits per second, rules on every write |
| U020 | Network observability | ✅ | `net().stats`/`net().link` and the badge tooltip (SAT-ONLINE-012); the owner's `/net` (SAT-ONLINE-108): online in the last minute by zone and level, this page's link, the last day's crashes (`regression/netdash`) |
| U021 | Auth emulator CI | ✅ | SAT-ONLINE-116: the real rules on the Realtime Database emulator in CI (`tests/emulator/rules.emu.cjs`, `.github/workflows/emulator.yml`), players A and B and an admin: A can't change what is B's (account ID, presence, profile, saves, session, friends, chat lines, guild rank); the fake still mirrors the rules for the browser tests |
| U022 | Config/env isolation | ✅ | Public web config in `src/net/firebase-config.js`; SAT-ONLINE-120: a test environment apart from the real one, the local Firebase emulators with `?emu`, honoured only on a page served from this computer, so the public site can't point at a test database (`unit/firebase-load`; [EMULATOR.md](EMULATOR.md)). A second Firebase project (staging) stays the owner's call (U327) |
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
| U048 | Party accept | ✅ | The leader is the one place membership is decided, one accept at a time, so it works as the transaction: invites out count against the cap, and everyone accepting at once still gives 5 (a raid 10); forged and duplicate accepts change nothing (SAT-ONLINE-060, #93). An accept the leader can't take (its side of the invite ran out first, or the party filled up or is gone) is answered at once (`party.kick` k = 2), so that player isn't left believing it joined (SAT-ONLINE-126, `unit/partycap`) |
| U049 | Party leader election | ✅ | SAT-ONLINE-024: a leader gone 15 s (longer than a reload) is replaced by the remaining member with the lowest uid; members whose clocks differ still agree; a returning old leader joins the new party (`regression/partylead`) |
| U050 | Party roles | ✅ | SAT-ONLINE-025: a badge (tank/healer/damage/support) picked in the party panel, `PlayerPublic.role`; in a raid against bosses it does something (SAT-ONLINE-061, #95): a tank draws the boss and takes 30% less, a healer heals the raid near it every 3 s, damage +15%, support -15% near it |
| U051 | Party HP UI | ✅ | SAT-ONLINE-021: `PlayerPublic.hp` (5% steps, nothing else of the profile); a bar per member in the party panel |
| U052 | Party pings | ✅ | SAT-ONLINE-021: Alt+click (touch: Ping marks where you stand) → `party.ping`; a ring on the ground and the minimap for 3 s; one per member per 1.5 s |
| U053 | Party chat | ✅ | SAT-ONLINE-016: party lines, rate-limited, block list; world chat for everyone (SAT-ONLINE-026), guild chat (SAT-ONLINE-049, #81), world notices as lines (SAT-ONLINE-041); insults shown as stars in every channel unless the player turns it off with `/filter` (SAT-ONLINE-071, #105) |
| U054 | Party summon | ⏳ | A teleport needs a movement authority |
| U055 | Party follow | ✅ | SAT-ONLINE-068 (#102): "Follow" on a party mate's card walks after them; any move key stops it (`regression/follow`) |
| U056 | Shared PvE XP | ⏳ | Needs a combat authority; a party raid pays each member their own rewards (009) |
| U057 | Personal loot | 🟡 | SAT-ONLINE-009: each member's own game pays the boss kill once per encounter; no server ledger |
| U058 | Need/Greed loot | 🟡 | SAT-ONLINE-063 (#96): every raid boss kill rolls one bonus piece among those who fought it, Need/Greed/Pass run by the raid leader, the roll a hash anyone checks; only the winner's game makes it; server random + ledger still D3 |
| U059 | Friends and follow | ✅ | SAT-ONLINE-067 (#101): ask from the card, accept, online list with level and place, told when they come online; whispers to friends anywhere (070, #104) |
| U060 | Guild invitations | ✅ | SAT-ONLINE-046/049/050 (#79, #81, #82): guilds in the database (unique names, ranks master/officer/member), invites from the card, remove, disband, the guild under the name, guild chat and the vault. Guild buildings: SAT-ONLINE-065 (#99). SAT-ONLINE-104: the master decides which ranks may invite (the officers by default, the members if allowed), and the rules refuse an invitation from anyone else |
| U061 | Emotes | ✅ | SAT-ONLINE-022: V (touch: Emote) → wave/dance/point/cheer for 3 s as `PlayerPublic.em` (a fixed list, no text); one per 2 s |
| U062 | Chat moderation | ✅ | Block list + rate limit (016); Report from the card (`reports`, read by the owner) and insults as stars with `/filter` (071, #105) |
| U063 | Player trade request | ✅ | SAT-ONLINE-039 (#76): serverless trade, Accept then Confirm, any change resets the accepts, one update with the `tradedItems` ledger so an item can't be traded twice. SAT-ONLINE-128: a side whose tab closed (or connection dropped, or read failed) after it confirmed gets the swap when it comes back: the save keeps the confirmed trade (`S.trPend`) until it is applied, the game finds `tradeDone` and both offers, and `S.trDone` applies each trade once (`unit/traderecover`, `regression/traderecover`). Gold offered beyond what a modified client has still needs the server (D3) |
| U064 | Player inspect | ✅ | SAT-ONLINE-020: the card shows only PlayerPublic (name, level, class, title, party, armour) |
| U065 | Party reconnect | ✅ | SAT-ONLINE-023: the party lives in the tab's sessionStorage; within 60 s a reloaded member auto-accepts its leader's invite back and a reloaded leader keeps its party. Leaving on purpose is final (`regression/rejoin`) |

**Totals (social):** ✅ 13 · 🟡 5 · ⏳ 2 · ❌ 0.

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
| U187 | Boss encyclopedia | ✅ | B's monster encyclopedia (v1.21): a page per monster opens on the first kill, drops after 10 kills (1 for a boss), mastery after 100 |
| U188 | Adaptive difficulty | ✅ | SAT-ONLINE-083: the host gives a boss the health of the n players of its group within 600 px (+60% a player, up to 10), the share left kept as players come and go (`regression/bossscale`) |
| U189 | Seasonal world boss | ✅ | SAT-ONLINE-124: the world boss hunt, every Saturday 19:00–20:00 UTC, one boss a week over a ten-week season (Trauka, the Storm Lord, Pagma's Doppelganger, the Wyvern Queen, the Vampire Lord, the four Divine Beasts, Berith). It is on the calendar and told 10 minutes before; the boss is back at its lair for it on every screen (a kill before the hunt is set aside, its shared timer too); anyone within 40 levels goes there for free from the calendar and back after (opt-in transport); the killer gets a cosmetic title and one hunt mark a week, never twice (`S.hunt`); a kill whose timer the rules refused while an older one ran is written again after it (`regression/hunt`). Timers stay `world/satisfy/wb` (056, B's v0.87) |

### Economy and trade (plan §42)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U210 | NPC price catalog | ✅ | B's one sell-price rule (v0.62): nothing sells for its buying price or more |
| U211 | Player-to-player trade | ✅ | SAT-ONLINE-039 (#76): Accept then Confirm, one update, both or neither |
| U212 | Trade cancel on disconnect | ✅ | A trade ends when the other player leaves or changes anything; the `tradedItems` ledger refuses the same item twice after a reconnect (`regression/trade`) |
| U213 | Auction market | 🟡 | B's auction window (v0.70) is the NPC auction house on each device; a market between players needs a ledger |
| U214 | Searchable item market | 🟡 | The auction window searches its listings; local only |
| U215 | Seller history | ✅ | SAT-ONLINE-089: after a trade each side writes its own record (`tradeLog`: with whom, gold given and got, checked by the rules against the trade's immutable sides, item counts; yours only) and a public one (`tradeRep`: with whom), once and only for a done trade, so the count can't be forged; the card shows trades and partners, `/trades` your last ten; the trade itself (`trades`, `tradeSides`, `tradeDone`, `tradedItems`) stays as the dispute trace (`regression/trade`) |
| U216 | Bank deposits | ✅ | The town bank (every inn, B) keeps gold in the character's own save, which goes with the character to the account (U018). SAT-ONLINE-140: a deposit or withdrawal takes from what is there at that moment, not from the numbers the menu showed (the world runs behind the menu: gold can change while it is open), so a choice made again moves nothing more (`regression/bank`, also through a reload) |
| U217 | Bank withdrawal locks | ✅ | Same as U216: neither the bag nor the bank goes below zero, whatever was shown or pressed twice; one device plays a character at a time (the session lease, U006), so no second client spends the same balance |
| U218 | Gold sinks | ✅ | Repairs, fees, the inn, the guild treasury, reputation-store prices (B). Inflow and outflow are observable: every game counts the gold that comes in and goes out each week from each change of the bag (SAT-ONLINE-093, `balance/{uid}` `gi`/`go`), and `/economy` adds them up over all players with a warning when far more comes in (U334, `regression/balance`) |
| U219 | Crafting commissions | ❌ | |
| U220 | Region merchant caravans | ❌ | |
| U221 | Guild treasury | ✅ | SAT-ONLINE-065 (#99) + 069: gifts add exactly their amount, only the master and officers spend, and only on a building raised in the same write; `guildLog` keeps who did what |
| U222 | Fish market | ❌ | Content (B) |
| U223 | Crop wholesale market | ❌ | Content (B) |
| U224 | Rare gem exchange | 🟡 | Socketing and paid upgrades (B); no exchange between players |
| U225 | Repair market | ✅ | SAT-ONLINE-096: work orders (`repairOrders`) a player posts with a fee at any smith's; a player Blacksmith mends one in one write that takes it off, tells its owner (`repairDone`) and pays the smith (`repairPaid`), checked by the rules; the piece is mended in its owner's bag with the same id (`regression/repair`) |
| U226 | Taxation caps | ❌ | There are no city taxes yet |
| U227 | Inflation dashboard | ✅ | SAT-ONLINE-082: `/economy` for the owner: total, median, top 10% and richest gold of the ranked players, and their average level |

### Guilds (plan §43)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U228 | Guild creation | ✅ | SAT-ONLINE-046 (#79): unique names (case-folded, `guildNames`), the founder is master |
| U229 | Guild recruitment | ✅ | SAT-ONLINE-078: a recruiting message (`guildRecruit`), requests to join (`guildApply`, only for yourself and while it recruits), refusals kept a week (`guildRej`); joining still needs the invitation (`regression/guildrecruit`) |
| U230 | Guild rank permissions | ✅ | SAT-ONLINE-104: the master sets, for officers and members, the rights to invite (and handle requests), take from the vault, spend the treasury, write the notice and plan events (`guilds/{gid}/perm`); the rules check each one (an officer without "take" can't take another's thing, also writing the database); a guild's records go only with the guild (`regression/guildperm`, `unit/rules-fuzz` on the real rules) |
| U231 | Guild banners | ✅ | SAT-ONLINE-084: the colour, and an emblem the master picks from 15 fixed symbols (`guilds/{gid}/emb`; no uploaded pictures, so nothing to moderate), shown before the guild name for everyone (`regression/guildbanner`) |
| U232 | Guild chat | ✅ | SAT-ONLINE-049 (#81): `/g`, members only by the rules, so a removed member loses it |
| U233 | Guild weekly quests | ✅ | SAT-ONLINE-081: the weekly goal: members' kills add up (`guildWeek`, each its own count, only upward, at most 1,500, monsters within 15 levels), three tiers, each reward taken once (`guildWeekPaid`) (`regression/guildweek`) |
| U234 | Guild forge | ✅ | SAT-ONLINE-065 (#99): the Guild Forge, +2% quality a level, capped at 3 levels |
| U235 | Guild housing | ✅ | SAT-ONLINE-115: the guild hall, a room each guild furnishes (eight places, nine pieces, who placed what kept with it; `guildHall`); members go in from the guild panel, the master and officers let other players in by account ID (`guildHallGuest`, `hallInv`), guests and members only read it and only the master and officers furnish (the rules); presence keeps each hall to itself; it goes with the guild (`regression/guildhall`) |
| U236 | Guild treasury | ✅ | Same as U221 |
| U237 | Guild research tree | 🟡 | Three buildings of three levels paid from the treasury (065); no tree |
| U238 | Guild alliances | ✅ | SAT-ONLINE-085: proposed by the master or an officer, accepted or declined by the other guild's; the rules write each side only against a fresh proposal from the other (one guild can't force it); 30 days, renewable in the last week, up to 3; no open PvP between allies (pvp.js `ally`) (`guildAllyAsk`, `guildAlly`) (`regression/guildally`) |
| U239 | Guild wars | ✅ | SAT-ONLINE-086: declared for one full hour 30 min–7 days ahead, accepted by the other guild (`guildWarAsk` → `guildWar`, the same hour), never on an ally; kills of enemy members outside towns count only during the hour (`guildWarKill`, the rules check it: a war can't start off-schedule), cost no karma, at most 200 a member; called off up to 10 min before, never during; told before, at the start and with the score at the end. Declared by guilds, not matched by the game (`regression/guildwar`) |
| U240 | Territory objectives | 🟡 | Guilds capture territory banners and the castle; who holds them is shared online (`world/satisfy/own`, with world news); no weekly limit |
| U241 | Guild leader handover | ✅ | SAT-ONLINE-076: the master hands the guild to an officer, or an officer takes it over from a master unseen 14 days; the ranks swap in the same write, so there is never a second master (`regression/guildlead`, `unit/guild`) |
| U242 | Guild event calendar | ✅ | SAT-ONLINE-080: events added by the master or officers (`guildEvents`), "I'm going" (`guildEventSign`), reminders 10 min before and at the start, in G and in the Calendar; one stored instant, shown in each player's time zone and UTC (`regression/guildevents`) |
| U243 | Guild notice board | ✅ | SAT-ONLINE-076: `guildNote/{gid}`, written by the master and officers, each write the next version; members read it and hear when it changes; shown as text, never as HTML |
| U244 | Guild rankings | ✅ | SAT-ONLINE-076: every online guild next to the canon ones, by level from the members' summed contribution (the same formula as your own guild's) |
| U245 | Guild diplomacy | ✅ | SAT-ONLINE-085: treaties (alliances) with a day's cooldown after a break, and a diplomacy log in both guilds (ask, ally, decline, break, end); the break records who (`guildAllyCd`, `guildDiplo`). Standings between guilds (SAT-ONLINE-123): from that log and what is in force, the same on both sides, by a formula the game shows (G → Diplomacy → Standings: allied, friendly, neutral, hostile, at war over the last 30 days); a hostile guild carries 💢 by its name, and a proposal or a war declared on you shows the standing (`unit/diplo`, `regression/guildstand`) |
| U246 | Guild seasonal rewards | ✅ | SAT-ONLINE-090: a season is a month; each week a guild earns the weekly-goal tier it reached (0–3); `/season` (the owner, standing in for a server job: admins read every guild's `guildWeek`) gives fixed-tier trophies (`guildTrophy`: gold 10, silver 6, bronze 3), shown by the guild's name and in G; cosmetic only, nothing in fights (`regression/season`) |

### Engine (plan §47)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U308 | Extract state store | 🟡 | `src/core/state.js`: durable, volatile and UI keys (ADR-002); the game still writes `S` directly |
| U309 | Extract world generator | 🟡 | Seeded spawns (`mulberry32`), the same tiles on every client (`regression/worldparity`); still inside `index.html` |
| U310 | Renderer batching | 🟡 | The big map draws only the visible land from a cached copy (B, v0.60) |
| U311 | Entity registry | 🟡 | Stable keys for monsters (`type@sx,sy`), item ids (`iid`), character id (`pid`) |
| U312 | Animation state machine | ✅ | `src/core/anim.js` (SAT-ONLINE-114): idle, walk, attack, hurt, dodge, dead per entity by rank, timed ones ending by game time with nothing scheduled; your swing as others see it, and other players flash when hurt (`unit/anim`, `regression/anim`). Monsters keep their own poses (B) |
| U313 | Fixed tick simulator | ✅ | SAT-ONLINE-099: `?tick=fixed` (off by default) moves the world in steps of 1/60 s at any frame rate; drawing, sound and the network draw their random numbers from a stream of their own. tests/regression/fixedtick |
| U314 | Dedicated game clock | ✅ | Server clock offset (`wNow`, SAT-ONLINE-044) for everything shared |
| U315 | Localization bundles | 🟡 | `STR.ar`/`STR.en` in the page; every line in both languages (`unit/i18n`, SAT-ONLINE-092) and every key the page asks for by name has its lines (SAT-ONLINE-118), so a missing key fails the tests. Left: the tables are still in the page, not bundles of their own |
| U316 | Asset loader | 🟡 | Sprite sheets in `sprites-original/` (B) |
| U317 | Save migrations | ✅ | Save versions with backups (ADR-001); old saves keep working (`regression/golden`, `regression/save`) |
| U318 | Map testing | ✅ | `regression/towns`, `worldparity`, `boot`; every door reachable |
| U319 | Command validation | ✅ | Every message is checked against the contract and dropped when invalid, oversized, replayed or too frequent (`src/net/contracts.js`, `unit/contracts`, `unit/presence`) |
| U320 | Data catalogs | ✅ | `data/*.js` with `tests/content/data` |
| U321 | Audio mixer | ✅ | SAT-ONLINE-101: "Sound" in the pause menu: game sounds, music, world sounds (monsters' voices and swings, fireworks) and other players (their swings, deaths, news), each with its own volume and off, remembered on the device (`regression/mixer`) |
| U322 | Accessibility QA | ✅ | Keyboard and touch for every menu (B, v1.01); `regression/zoom` (SAT-ONLINE-118): at 125% in the windows a 1280x720 and a 1366x768 screen give (and a small one), the title, Esc menu, bag, status and a dialog have every control inside the window and clickable at its centre |
| U323 | Replay recorder | ✅ | SAT-ONLINE-100: offline, `?tick=fixed&rec` records from Continue (the save, a seed, the start clock, keys and dialog choices at their steps; clock and timers run on the steps), `?tick=fixed&replay` plays it back in its own save slot and checks the world every 10 s and at the end (`regression/replay`: recorded at 60 fps, the same at 30 and 144; one key taken out and it says when it went apart) |
| U324 | Exception boundary | ✅ | SAT-ONLINE-117: each part that adds to the scene is its own boundary (the other players above all), as are the network tick, the minimap and each drawing; a broken one costs only itself, told once (`regression/boundary`, which breaks them on purpose); a failing listener can't stop presence |
| U325 | Performance profiler | ✅ | SAT-ONLINE-103: F9 (or `?perf`): fps, frame time p50/p95/max, the work a frame takes (update + draw, p95), network writes/s, round trip and failures, what is on the map; red over budget (frame ≤ 20 ms; work ≤ 8 ms on a computer, 14 on a phone); each device keeps its own numbers every minute of play (`satisfy_perf`) (`regression/perf`) |
| U326 | Build pipeline | ✅ | SAT-ONLINE-107: GitHub Actions (`.github/workflows/tests.yml`) runs the unit and content tests and a smoke set of the browser tests on every pull request and push to main; GitHub Pages serves main as it is |
| U327 | Staging deployment | ⏳ | Needs a second Firebase project (owner) |
| U328 | Rollback support | ✅ | Every update is one merge on main, so reverting one is one commit (GitHub's Revert); the rules go back with main's copy; saves survive both ways (SAT-ONLINE-091, `docs/online/ROLLBACK.md`) |

### Live ops (plan §48)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U329 | Daily world events | ✅ | World events by the server clock, once for everyone (SAT-ONLINE-041/044) |
| U330 | Seasonal progression | ✅ | Monthly arena seasons; ratings reset, items stay (SAT-ONLINE-053) |
| U331 | World boss calendar | ✅ | SAT-ONLINE-077: "Calendar" in the player list: the next world events, the competition, the siege, the festival, the race, Trauka and Berith; in your time zone and UTC, from the server clock (`regression/calendar`) |
| U332 | Limited festivals | ✅ | The town festival every third hour (B, v0.94) |
| U333 | Balance dashboard | ✅ | SAT-ONLINE-088: each game writes its own class's week (`balance/{uid}`: kills, seconds from first hit to kill, PvP wins and losses from duels and open PvP; bounded by the rules), the owner's `/balance` sums them by class (PvE time to kill, PvP win rate); admins only read them; no names on the board (`regression/balance`) |
| U334 | Economy health | ✅ | SAT-ONLINE-093: every game counts the gold that came in and went out this week from each change of the bag (`balance/{uid}` `gi`, `go`, with 088); `/economy` adds the week's flow over all players and warns when more than twice as much comes in as goes out (three players or more) (`regression/balance`) |
| U335 | Content flags | 🟡 | Older pages skip what they don't know (fx tags, presence fields). SAT-ONLINE-121: live switches, world chat, trading and dueling, which the owner turns off and on for everyone without a release (`/switch`), held by the rules for every page (`flags`). Left: content packs by region and player group |
| U336 | Announcement system | ✅ | SAT-ONLINE-079: `/announce text` from an admin account (`admins/{uid}`, set in the console only); everyone online sees it once, late joiners within 10 min; the rules refuse anyone else (`regression/announce`) |
| U337 | Maintenance notices | ✅ | SAT-ONLINE-079: `/maint minutes text`: the time, reminders 10/5/1 min before, a save when it starts; and "a new version" asks only the older page to refresh (SAT-ONLINE-045) |
| U338 | Hotfix pipeline | ✅ | [HOTFIX.md](HOTFIX.md) (SAT-ONLINE-111): a `HOTFIX:` PR from main with its failing test, reviewed first, rules deployed first; ROLLBACK.md when it can't wait |
| U339 | Moderation console | ✅ | SAT-ONLINE-082: `/reports`, `/mute ID hours`, `/unmute ID` for admins only; a mute has an expiry and keeps the player out of the world chat by the rules (`regression/moderation`) |
| U340 | Player appeal flow | ✅ | SAT-ONLINE-087: `/appeal why` while muted, once a mute (`appeals/{uid}`, `mt` = the mute's time: linked to the moderation event); read only by admins and the player (privacy); `/appeals` lifts or keeps it (`appealDone`), the player is told once; a second appeal for the same mute and anyone else's answer are refused by the rules (`regression/appeal`) |
| U341 | Crash reporting | ✅ | SAT-ONLINE-082: errors on a signed-in page go to `crashes` (admins read): message and stack with long ids, e-mails and paths cut out, build and zone, at most three a session; `/crashes` lists them |
| U342 | A/B testing ethics | ⏳ | No tests on players; owner decision |
| U343 | Community feedback triage | ✅ | GitHub issue templates for bugs and ideas (Arabic and English, sorted by part of the game: SAT-ONLINE-107) and in-game reports |
| U344 | Season rewards | ✅ | SAT-ONLINE-129: when a month's arena season is over, each player's game gives cosmetic titles once: Arena Regular for 10 duels (taking part is enough, win or lose), Arena Top 10 for a top-ten place among those with 5 duels, Arena Champion for the first (`S.arnS`); the board says how. `unit/seasontitles` fails if a season or competition title (these and the National Champion) gets a stat, a stats line or a skill; no paid items exist (`regression/arenaseason`) |
| U345 | Retention without grind | ✅ | SAT-ONLINE-130: the daily bounties' bonus was a streak that a missed day reset to 0; now it is +10% for each day you cleared all three in the last 7 days (up to +50%, `S.dlyW`), so a missed day takes nothing away, and an old save's streak becomes the days it stood for. The day is the world clock's (`today()` follows `wNow`), the same for everyone online. Daily caps on repeatable quests (B) as before (`regression/dailyweek`) |
| U346 | Data export/delete | 🟡 | "Delete my online data" (SAT-ONLINE-015/066). The owner took out "Download my online data" (078) and the manual cloud Upload/Download on 2026-10-21, to cut the chance of duplicated data: characters move only by the automatic sync |
| U347 | Disaster recovery | ⏳ | Database backups need the Blaze plan (owner) |
| U348 | Shard scale-out | ⏳ | One shard (`main`) |

### QA (plan §50)
| ID | Item | Status | Where / what's left |
|---|---|---|---|
| U368 | Automated unit test harness | ✅ | `tests/unit`, `tests/content`, `tests/regression` with a seeded random and a frame clock |
| U369 | Firebase rules fuzzing | ✅ | SAT-ONLINE-102: `tests/harness/rules-eval.cjs` evaluates the real `database.rules.json` in Node (cascading .read/.write, .validate, wildcards, auth/now/root/data/newData). `unit/rules-fuzz` sends thousands of random writes and reads: nothing signed out, nothing into another account's own nodes, no client-chosen server time; drops, bounties and friend requests played through. `SATISFY_RULES=<file>` runs it on a PR's rules |
| U370 | Multi-browser smoke | ✅ | Chromium in every test; CI also runs boot and saves in Firefox and WebKit (SAT-ONLINE-107, `SATISFY_BROWSER`); the owner tests desktop and phone |
| U371 | Reconnect soak | ✅ | `unit/chaos` (drops, delays, duplicates); `regression/soak` (SAT-ONLINE-112): 20 drops and reconnects of two players in a party, moving while away; each sees the other once where it is, and the pages listen to exactly what they did after the first |
| U372 | Load test 100 clients | ✅ | `unit/load100` (SAT-ONLINE-113): 100 real transports over an in-process database for a simulated minute; everyone sees who is near and its party; 522 kB/s against the model's 528 at k = 14 (COST_MODEL.md) |
| U373 | Combat determinism | ✅ | With `?tick=fixed` the same fight at 30, 60 and 144 fps ends the same to the last digit (`regression/fixedtick`); a recorded session has its own seed, and its replay ends in the same world (`regression/replay`, SAT-ONLINE-100) |
| U374 | Dupe attack cases | ✅ | Replayed and reordered messages dropped (`unit/presence`); claims once (`dropClaims`, `tradedItems`, `bountyPaid`, `natPaid`, lockouts) |
| U375 | Safe zone exploit cases | ✅ | No duel or PvP damage in towns, checked on both sides (`regression/pvp`, SAT-ONLINE-038) |
| U376 | Trade race tests | ✅ | `regression/trade`: any change resets the accepts; the same item twice is refused |
| U377 | Boss raid race tests | ✅ | `regression/raid`, `raidloot`: one boss death, one reward each, nothing paid twice |
| U378 | Save backward compatibility | ✅ | `regression/golden` and the characterization tests against the R0 baseline |
| U379 | Localization regressions | ✅ | SAT-ONLINE-092: `unit/i18n` reads every string table in the page: each line in both languages (Arabic feminine forms aside), the same `{placeholders}`, empty in both or neither. Play tests still run in English |
| U380 | Art provenance audit | 🟡 | `docs/art/ART_CONTRACT.md` (B) |
| U381 | Security incident drill | ⏳ | Owner (Firebase console) |
| U382 | Data retention review | ✅ | [DATA_RETENTION.md](DATA_RETENTION.md) (SAT-ONLINE-111): every node, who reads it and when it goes; admins clear crash reports older than 30 days (they piled up for ever) |
| U383 | Community report resolution | ✅ | SAT-ONLINE-082: each report is resolved with its action (`reportDone/{id}` {a: ok or mute, by, t}), so what was done and by whom is kept |
| U384 | Version gate report | ✅ | Every PR shows its CI checks (SAT-ONLINE-107) and lists the tests it ran |
| U385 | Rollback rehearsal | ✅ | SAT-ONLINE-091: `regression/rollback` takes a save this build wrote to the previous release (the baseline build) and back: nothing dropped on the way, a key the old build doesn't know kept, the same save again; a save from a newer build is backed up first. `ROLLBACK.md` has the owner's steps (revert on GitHub, the rules from main, a database export) |
| U386 | Documentation sync | ✅ | This backlog, `OWNER_TEST_GUIDE.md`, the update log on every merge |
| U387 | Pilot invite-only rollout | ⏳ | Owner |

**Totals (U184–U189, U210–U246, U308–U348, U368–U387):** ✅ 78 · 🟡 14 · ⏳ 6 · ❌ 6 of 104.

Not cheat-proof yet (the owner knows): trades, drops, the vault, PvP hits, bounties, ratings, competition scores, raid heals and rolls trust each client; a game server (D3) closes that.
