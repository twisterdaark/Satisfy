# Relics (v3.74; 2026-10-28)

> This file holds the solutions. Keep it out of anything players see.

The owner, 2026-10-27 23:50: "New Equippable items, Relics. Relics are unique accessories that are hard to find, only one copy of
the relic exist. A player may only have one relic equipped at the time. If they have one they are not elligible to gain or even
have in their inventory another. Please make the steps to get the relics complicated. not just one quest npc.. a questline that
leads across the map and doesn't give much hints. or possibly hard puzzles in the overworld for players to solve in order to have
a chance at finding one."

Everything here is GAME_ORIGINAL; the relics' numbers are the owner's.

## The item

- **The item.** `{id:'rl_<k>', slot:'rl', r:4}`, one of `RQK`. `rcById` finds it in `RLC`, which is not a recipe, so the forge,
  the Index and the drop tables never list relics.
- **The slot.** The equipment window has a Relic slot (`rl`, `S.eq.rl`) and, while you hold a relic, a line with its name and
  "Let it go".
- **Icons** are drawn by `rqIcon` (bag) and `SKICO` (skills).

### One copy in the world

A relic uses the legend books' record: `world/satisfy/books/rl_<k>` `{uid, p, g, t}`. The rule and code are the same
(`bkTake`/`bkFree`/`bkRec`/`bkMine`), so no rules deploy is needed. The key fits `^[a-z0-9_]{1,16}$`. Offline it is the device's
world (`WS.books`).

- **Given:** the record is taken first, then the item goes in the bag (`rqGive`). If the page closes in between, `S.rqgp`
  finishes it. Only one give runs at a time (`rqClaim` waits while any is pending). A give that finds you already holding a relic
  frees what it took.
- **Kept in step (`rqMend`, every half second):**
  - A record of yours with no relic in the bag gives the relic back, for example when a save lagged behind its record on
    another device.
  - A record of yours beside a different relic you hold goes back to the world.
  - Neither happens while a give or a letting go is under way: `RQS.rel` holds for 30 s, and `S.bkfp` is respected.
- **Found signed out:** its record goes up when you sign in. If another copy came out first, yours sleeps (`rqLive` is false)
  and gives nothing. While the records are not read (loading, a drop), the last answer stands.
- **Let go:** the item leaves and its record is freed (`rqRelease`).
- **Character deleted:** `legDel` frees the relic record that character held.

### One relic to a player

You hold at most one (`rqHeld`), so "one equipped" follows. Signed in, it counts across the account (`rqAcct`): another
character of yours holding a relic keeps the vault shut. You can never gain a second:
- An open vault will not give one while you hold a relic.
- No relic comes in: `tradeItemIn` and `dropItemOk` refuse slot `rl`.

A relic never leaves its holder except by being let go. `ivLocked` refuses selling, the bin, salvage and dropping; `slotOut`
refuses the stash; `tradeBag` (trades and the guild vault) leaves it out; and gear can't go to the auction.

## The powers (`rq*` hooks)

| Relic | Numbers | Passive / skill |
|---|---|---|
| God Hand Miniature | attack speed +10% (`atkCD`), crafting and enhancement success ×1.05 (`craftRate`, `enhCost`) | Greed's Reflex: 10% of the blows that land call a golden hand for 6 s, and it catches every enemy projectile (`updateEProj`) |
| Parchment of Baal | dark magic +20%, mana regeneration ×1.15 (the passive regen and a demonkin's Demonic Power on hit) | Soul Contract `rqsoul`: 15% of current health; every other skill's cooldown resets. 90 s |
| Sacred Scripture of Rebecca | healing skills +15% (`skHealUp`), holy damage taken ×0.9 | Divine Blessing: every 60 s, `cls2Clean()` and +5% health |
| Heart of the Ancient Giant | physical defence ×1.25 (against physical blows: `rqPdM` in the damage formula), health ×1.15, move speed ×0.9 | Unshakeable: no knockback, pull, hook or charge shove (`hitBy`, the ring pull, `mxOn`'s hook, the charge's wall shove), stuns wear off 1/0.7 as fast (30% shorter) |
| Eye of the Evil King | magic +15%, critical chance +10% | True Perception: five dodges ready against any blow, one back every 20 s while worn (`rqEvade`). Spent ones stay spent if it is taken off |
| Dragon Blood Vial | fire damage taken ×0.85, penetration 10% (`lvF^-0.1`) | Draconic Roar `rqroar`: ordinary foes within 90 px flee 3 s; your attack +12% for 10 s. 60 s |
| Taoist's Sacred Gourd | every stat ×1.1 | potions restore 15% more (`rqPot`); Five Elements Harmony: 1.5% health and mana a second out of combat (5 s since you struck or were struck) |
| Magic Machine Core | shields ×1.2 (Overdrive, the Hydro-Shield, Totemic Will's barrier), physical damage +10% | Overdrive Barrier `rqover`: a shield of 25% health (×1.2) for 8 s. 90 s |

The owner gave no cooldown for Soul Contract or Draconic Roar; 90 s and 60 s are GAME_BALANCE. Soul Contract does not reset
itself.

## The chains (`RQST`, `RQSITE`)

Each chain is three stones and a vault. A stone answers only when it is the current step of its chain (`S.rqs[k]`). Before that
it shows a plain description; after, "silent". Each answer shows a sign (`RQG`) and a vague hint toward the next stone.

The vault (`rqVault`/`rqRing`) has three rings. Each ring offers nine signs: the chain's three and six others, in a fixed shuffle
for that relic. The three signs in the order found open it (`S.rqo[k]`); a wrong turn locks it for 10 minutes of real time
(`S.rqL[k]`, on the world's clock `wNow`). An open vault gives the relic only if no one holds it and your hands are empty.
Otherwise it says why, and you can come back.

At Lv 100 one whisper says relics exist and old stones remember the way (`S.rqw`), only into an empty screen. Every stone
shows a faint glimmer. A relic's own dialog never covers an open one either.

Per character: the last kill (the chapel's peace) counts from when the character came in, and a stillness under way does not
carry over (`RQS.s`). A step completes only if it is the current one. A relic is never "unappraised" (`apr:1`; `aprNeed`
skips slot `rl`).

| Relic | 1 | 2 | 3 | Vault |
|---|---|---|---|---|
| God Hand | Bairan quarry stele: 50,000 gold. ⚒ | Kobold King's Den, split anvil: a weapon in hand at +7 or more. ✋ | Hills north of Titan, merchant's cairn: by day. ☀ | Pangea, strongbox in the wall |
| Baal | North Hill, cracked tomb: by night. ☾ | Abyss L1, black altar: asks for 30 demons, counted after. ✶ | Hell's demonkin village, lectern: pay half your health (at 80%+). ♆ | the 25th Hell |
| Rebecca | Central Plains shrine: at dawn (5–8 h). ✧ | Northern Snowfields statue: 20 red herbs, 10 moonflowers. ☘ | ruined chapel south-east of the Vatican: no kill in 5 minutes. ✠ | Ruins of Yatan's Temple |
| Giant | Frost Plains footprint: four boulders with 1–4 notches, touch from fewest to most (b, d, a, c). ❄ | Giants' Land throne: asks for the Frost Giant, counted after. ⚔ | Glacier Lakes ice shrine: during snow or storm. ☗ | Northern Highlands |
| Evil King | Kesan Canyon eye: by night. ◉ | Sunken Fen, three pools: weeps (black), sleeps (lidded), sees (clear). ☉ | Abyss L2 bone crown: asks for 3 bosses, counted after. ♛ | Abyss L3 |
| Dragon | Red Dragon's Peak egg: 3 dragon scales. ♨ | the same egg: Trauka once more, counted after. ✦ | Red Badlands stain: at noon (11–14 h). ⚚ | Chaos Mountains, 4th ridge |
| Gourd | Kingdom of Cho gourd rock: wood 10, fire essence 1, ore 10, mithril 3, fish 10. ☯ | Kingdom of Xing hermit's stone: sit 60 s, unmoved (40 px) and unhit. ☁ | Kaya, five stones in the generating cycle (wood, fire, earth, metal, water), starting from any of them (`cyc`). ✿ | the mountains of Pa |
| Core | Reidan's Western Sands machine: 20 mana stones. ⚙ | Dran Valley dead engine: asks for 20 golems (any `/golem/`), counted after. ⚡ | Taturan plains, three pylons from low to high: c, a, b. ⚛ | Suaz Mountains |

**Site placement.** Every site is clear for 2 tiles around and reachable from where people stand (or through a gate). Each is at
least 7 tiles from any NPC and 16 from any boss. The probe is `rlsites.cjs`, kept in the session notes.

**Time of day.** The hour is the world clock (`dnHour`). The weather is `wxHere()`, where the north turns rain to snow.

## State

These keys are durable (`src/core/state.js`):

| Key | Holds |
|---|---|
| `S.rqs` | each chain's step |
| `S.rqx` | the step's progress: a hunt's `go` and count, a sequence so far |
| `S.rqL` | the vaults' locks |
| `S.rqo` | the vaults opened |
| `S.rqgp` | a relic given while the page closed |
| `S.rqw` | the rumour heard |

## Tests

`tests/regression/relics.test.cjs` (6) covers:
- the stones' places;
- Rebecca's chain end to end, with the dial and its lock;
- one relic, and letting it go;
- the puzzles (sequence, hunt, stillness, blood);
- the powers;
- the review's fixes: a record and its relic kept in step, spent dodges, the whisper, the cycle.

`jewelry.test.cjs` counts the new slot.
