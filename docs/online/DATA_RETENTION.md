# What the online game keeps, and for how long (plan U382)

Owner: Claude-A · SAT-ONLINE-111 (2026-10-22) · from `backend/database.rules.json` and the code that writes each node.

**بالعربي باختصار:** اللعبة أونلاين مبتحفظش غير اللي اللعب محتاجه.
- اللي بيتمسح لوحده:
  - مكان اللاعيبة والوحوش: لما تقفل.
  - الشات وأخبار العالم: بعد 10 دقايق.
  - شات الجيلد: بعد يوم.
  - المزاد: بعد 14 يوم.
  - القوافل: بعد ساعتين.
- اللي بيفضل:
  - حسابك وحفظك: لحد ما تدوس "Delete my online data".
  - حاجات الجيلد: لحد ما الجيلد يتحل.
  - سجل التبادل والتقارير.
- أعطال اللعبة اللي بتوصلك كانت بتتراكم على طول. دلوقتي تقدر تمسح القديم من `/crashes` ← "Clear the ones older than 30 days".

## How to read this
- **Who reads:** "players" means anyone signed in; "own" means only the account it belongs to; "members" means the guild's members; "owner" means admins, i.e. you.
- **Goes:** when it is removed, and by whom. "Kept" means nothing removes it today.
- No node holds an e-mail address, a real name or a payment detail.
  - Account IDs are the names players choose.
  - Crash reports have long ids and e-mail addresses cut out before they are sent (SAT-ONLINE-082).

## While you play (removed by itself)

| Node | What | Who reads | Goes |
|---|---|---|---|
| `presence/satisfy/main/{uid}` | where you are, your look, level, health %, party | players | when the page closes or drops (onDisconnect); a silent one is ignored after 60 s |
| `sessions/{uid}` | which page plays the account now | own | replaced by the next session |
| `mobs/satisfy/{zone}/{uid}` | the monsters a page hosts for its zone | players | when that page leaves the zone or closes |
| `inbox/{uid}/{id}` | party and duel messages to you | own | when read |
| `lfg/{uid}` | your group-finder entry | players | when you leave (onDisconnect), and after 30 minutes |
| `chat/satisfy/{id}` | world chat lines | players | anyone may remove one older than 10 minutes, and each line sent removes up to 10 such (`feedSay`) |
| `news/satisfy/{id}` | world news lines (captures, firsts) | players | the same, after 10 minutes |
| `whisper/{to}/{id}` | a friend's line to you | own | its reader's game removes those older than a day (`whisperClean`) |
| `drops/{id}`, `dropClaims/{id}` | a loot drop on the ground and who took it | players | taken, or anyone after 2 minutes |
| `trades/{tid}`, `tradeSides/…`, `tradeDone/{tid}` | a trade in progress | the two traders | when it ends |

## The account (kept until you delete it)

| Node | What | Who reads | Goes |
|---|---|---|---|
| `accountIds/{uid}`, `handles/{id}` | your account ID and its owner | players | "Delete my online data" (SAT-ONLINE-015/066) |
| `profiles/{uid}` | the public card: name, look, level, class | players | same |
| `cloudIndex/{uid}`, `cloudSaves/{uid}/…` | your characters' saves | own | same |
| `friends/{uid}`, `friendReq/{to}/{from}` | friends and requests | own | removing a friend; a request when answered |
| `lockouts/{uid}` | weekly raid lockouts | own | kept (one small entry a raid) |
| `ranks/{lv\|gold}/{uid}`, `arena/{uid}` | your place in the rankings | players | kept, overwritten as it changes |
| `nat/{uid}`, `natPaid/…` | National Competition scores and prizes paid | players / own | kept (one entry a competition) |
| `balance/{uid}` | this week's play numbers for the balance and economy views | owner | overwritten each week |
| `tradeLog/{uid}/{tid}`, `tradeRep/{uid}` | your trade history and the counts on your card | own / players | kept |
| `tradedItems/{iid}` | which trade an item last went through (so it can't be traded twice) | players | kept: it is the ledger |
| `kills/{victim}/{id}` | a PvP kill record, for bounties | players | its victim or killer may remove it; kept otherwise |
| `bounties/{id}`, `bountyPaid/{id}` | gold on an outlaw's head and who was paid | players | its poster takes it back; paid ones are kept |

## Guilds (kept while the guild stands, cleared when it is disbanded)

`guilds`, `guildNames`, `guildMembers`, `guildInv`, `guildChat` (lines may go after a day), `guildVault`, `guildVaultTaken` (after a day), `guildBank`, `guildBuild` (buildings), `guildResearch` (the research tree, plan U237; a new guild also clears any an older client's disband left), `guildLog`, `guildNote`, `guildRecruit`, `guildApply`/`guildRej` (refusals matter for a week), `guildEvents`/`guildEventSign`, `guildWeek`/`guildWeekPaid`, `guildAlly*`, `guildDiplo`, `guildWar*`, `guildTrophy` (#126), `guildTax` (#140), `capSlot` (#130, kept after a disband so a guild made again under the same id still counts its week).
- With #138, these go only together with the guild in one disband write. Before, a master could clear the weekly rewards taken and take them again.

## Markets and orders

| Node | What | Who reads | Goes |
|---|---|---|---|
| `auction/{id}` (#129) | a listing | players | sold, taken back, or after 14 days (the seller's game takes it back) |
| `auctionPaid/{uid}/{id}` | a sale's gold waiting | own | when collected |
| `repairOrders`, `repairDone`, `repairPaid` (#131) | repair orders, answers, fees | players / own | when done or taken off; answers for nobody after 30 days |
| `craftOrders`, `craftDone`, `craftPaid` (#132) | crafting commissions | players / own | same |
| `caravans/{uid}`, `caravanDone/{uid}/{id}` (#144) | a caravan out, and those delivered | own | delivered, dropped or spoiled (2 hours); deliveries kept, and their owner may remove them |

## The world

`world/satisfy/own` (who holds the castle and territories), `world/satisfy/legends` (the legendary classes taken), `world/satisfy/books` (the one copy of each legend book and the character holding it; freed with that character or with "Delete my online data"), `world/satisfy/wb` (world boss rests), `world/satisfy/tax` (#140), `announce` (your announcements). All are kept and overwritten as they change.

## The owner's (admins only)

| Node | What | Goes |
|---|---|---|
| `admins/{uid}` | who is an admin (set in the console only) | console |
| `reports/{id}`, `reportDone/{id}` | players' reports and what was done | kept (the history of moderation) |
| `mutes/{uid}`, `appeals/{uid}`, `appealDone/{uid}` | mutes and appeals | a mute is lifted or runs out; kept as history |
| `crashes/{id}` | crash reports (message, stack cut short, version, zone) | **new:** admins may remove them; `/crashes` → "Clear the ones older than 30 days" |

## What could still be shorter
- `kills`: only a bounty needs a kill record, so one older than a week could go. Left as is: bounties are paid against it.
- `tradeLog`: the card shows only the counts (`tradeRep`). The log could keep the last 100 a player.
- `reports` and `reportDone`: a year of history is plenty. A later owner tool could clear older ones the same way as crashes.
