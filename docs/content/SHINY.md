# Shiny things and the Scholar's Stew (v3.05)

Requested by the player Suki through the owner (2026-10-25): "Add different shiny variants of fish and ores. Same with food,
like golden apples. Each item cooked/crafted/smith/caught being shiny grants special modifiers to your food armor or
weapons… The addition of exp boosting food will also be appreciated." This is GAME_ORIGINAL.

## What can be shiny (`SHB`, `SHP` = 3%)

Each unit of a gathering is shiny 3% of the time (`shAdd`):
- **Fish:** the eleven kinds of v3.03. Glow bait doubles the chance.
- **Mining:** ore and mithril from the veins.
- **Herbs:** herbs and moonflowers.
- **Harvests:** wheat, straw, melons, pumpkins and cabbages.

Wood and everything else is never shiny.

A shiny material's key is `shn` + its key (for example `shnfish`), so the auction's keys stay lowercase letters (its rules
want `^[a-z]{2,12}$`). Its name is ✨ and the plain name (no adjective, since Arabic would need its gender). It sells for four
times the plain price, the day's market takes 3 of each at full price, and it can go to the auction.

## Using one (`shHave`, `shTake`)

A shiny material counts as its plain kind, and a shiny common fish counts wherever `fish` is asked for. A shiny dish counts
as its dish for a quest (`lf5`'s Grilled Fish).
- **A dish, or a piece with ATK or DEF** (`shCan`), takes one shiny first (one is enough), then the plain ones. If one went
  in, the result is shiny.
- **Everything else** takes the plain ones first: potions, arrows, accessories without ATK or DEF, sewing and quests.

| Result | What shiny means |
|---|---|
| Dish (`DISH['shn'+k]`, for every dish the campfire cooks) | food ×1.5 (up to 100), healing ×1.5, its buff twice as long. A perfect strike at the pot is also shiny 12% of the time (`SHPP`). |
| Piece of gear (`i.sh`) | ATK or DEF ×1.1 (`iAtk`/`iDef`), ✨ before its name, a line in its tooltip. A Legendary piece is also shiny 10% of the time. |

## The Scholar's Stew (`sstew`)

The Scholar's Stew is cooked at any campfire, from 1 fish, 2 moonflowers and 1 wheat. Like `might`'s +10%, its +25% is
still under the per-kill XP cap from level 100:
- food +40 and health +10%;
- the `sage` buff for 600 s (1,200 s when shiny): +25% experience from monsters, in the kill XP sum next to `might`'s +10%;
- the buff replaces another dish's, since there is one food buff at a time.

The "golden apple" in the request is read as shiny food in general: the game has no apples, and its fruit (melons,
pumpkins, strawberries) can be shiny.
