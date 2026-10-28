# The Index's Materials (v3.12)

The owner (2026-10-26): "add to the index, Materials tab to know where to get each material for crafting".

A tab of the Index (N), «🧱 الخامات» / «🧱 Materials», between Drops and Gems. Read only, and made when the Index opens from
the game's own tables, so it stays true as they change. GAME_ORIGINAL.

## Which materials

Every material a recipe asks for (`ixMats`):

| Where it is used | Table |
|---|---|
| At the anvil | `RC` (a recipe the player can learn; the drop-only pieces, `unlock: () => false`, are left out) |
| At Elizabeth's | `RC` pieces with `jw: 1` |
| At the tailor's | `TRC` |
| At the fire | `COOK` |
| Alchemy | `BREW` |
| The Creation | `CREM` |

They are ordered as the bag orders them (`IXMO`: wood, ore, leather, mithril, the stones, the beasts' and demons' parts, the
gems, then fish, herbs and crops). The filters: All, Smithing (the anvil, Elizabeth and the Creation), Sewing, Cooking &
alchemy. The search finds a material by its name, or by the name of a monster you have met that carries it.

## Where to get it (`ixMatSrc`)

From the tables:

- **Gathering**: iron veins, mithril veins (and the ore they give half the time), herbs and blue herbs, each with the regions
  their nodes stand in (`ixNodeZ`, the five with the most); the rare herb from picking; trees; the veins of the Beware Dogs
  mine for the insane dragon's iron and stone.
- **Fishing**: the waters whose fish it is (`TKZ`); the Golden Fish in any water; for cooking's "fish", every common fish.
- **Piaro's field**: the crops, in their season.
- **The Tower**: a random gem the first time you clear a floor with a boss.
- **Quests** (`QD[q].mat`) and **first discoveries** (`FD[k].mat`), with how many.
- **Shops**: ore at Khan's and Bairan's smith, to a blacksmith only (`IXMSHOP`, `buyMat`, `isSm`); a town's merchant to one
  of rank (`HONS`: mana stones and Blessed stones when Honoured, Enhancement and Precious stones as Town Hero, a few a day);
  Radwolf's shop in the Tower of Wisdom (`TWSHOP`, for marks); the coachmen's rare herb to anyone with a mount (`HFOOD`).
- **The market** (`AUK`): other players, and for the merchants' own listings (`IXMNPC`, from `auWS`) the merchants too.
- **Taking apart**: a forged piece that needed two or more of it gives some back (one needed once never comes back); a
  Creation gives back all its materials (`creSalv`).
- The gem drop (`gemDrop`: any monster of Lv 60+ 0.4%, any boss 30%; a diamond one time in ten, the other four alike), a
  room's chest (ore, leather or wood, once), Piaro's digging game (herbs), an affinity reaching Devoted (3 mana stones).
- **The monsters that carry it** (`ixMatBy`, from `MT[k].drop`): the ones that live somewhere first, then by level; where
  they live, their level, boss or not, and the odds as the kill rolls them (`ixOdds`); a monster you haven't met is ???.
  The first 12, then how many more.

Kept by hand beside the code it describes (`IXMX`), because no table holds it:

| Material | Lines |
|---|---|
| Enhancement Stone | every boss of Lv 20+ (1 + 1 per 50 levels), any other monster of Lv 20+ now and then (up to 8%), a boss's chest (2-4), all of the day's tasks (1), the Tower's boss floors, every tenth (2), Berith and Belial (2 each for 5% of the fight), the Dark Bus (10) |
| Precious / Blessed Stone | every boss of Lv 20+ (12% / 25%), a boss's chest (50% / 60%) |
| Mana Stone | a boss's chest (2-4), the day's tasks (3), the Tower's fifth floors (1, 3 with a boss), a treasure map's chest (2), the Dark Bus (3), an affinity reaching Devoted (3) |
| Blue Orichalcum | a boss's chest (50%), a treasure map's chest (1), Berith (1 for 20%) |
| Ore, wood, leather | a boss's chest (3-6 of one of the three) |
| Mithril | Berith (10 for 5%) |
| Diamond | the gem drop (10% of gems), Berith and Belial (2 each for 20%) |
| Ruby, topaz, emerald, sapphire | the gem drop (20% of gems each) |
| Belial's Black Jewel / Horn | Belial (1 for 5% / 1 for 20% of the fight) |
| Dragon Scale | Hayate's mission in the Tower of Wisdom (3) |
| Thunder Stone | a smith takes a Thunder Bow apart (3) |
| Wyvern Egg | the wyvern nest |
| Red Phoenix's Breath | the East's quest `ea5` |

A material with no line and no monster says so and points to its description.

## What it makes

Each kind of work with its recipes' icons and names: the anvil, Elizabeth's, the tailor's, the fire, alchemy, and a line for
the Creation (the Blacksmith's and Pagma's Successor's). The stones also say they enhance gear at a smith, and what a pet
evolves with says so (`PEVO`).

## Tests

`tests/regression/matindex.test.cjs`: the tab and its cards; every material's page with where to get it and what it makes, no
placeholder left; ore's veins with their regions, its shops and the market; the veins, herbs and trees; the stones' bosses
and chests; cooking's any common fish; the field; Belial's jewel at Elizabeth's; leather's monsters and how many more; the
three filters; the search by a met monster's name; the gem drop, the merchant's rank stock, Radwolf's shop, the coachmen,
a Creation taken apart, enhancing, the Beware Dogs veins' rule and the digging game.
