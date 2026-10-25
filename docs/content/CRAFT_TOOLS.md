# The crafts' tools (v3.04)

Requested by Suki in the same message: "make smith's be able to buy hammers, each one helps you smith better, same principal
with spatulas for cooking. You can now buy a new item "portable stove" from any town inn. Allows you to place down a stove
and cook wherever you may be (Except dungeons or important quest areas)". This is GAME_ORIGINAL.

## Forge hammers (`CKH`, `S.smh`)

Khan sells them (`ckHamOpts`) to anyone who has finished `kh1` (his lessons), and to any Blacksmith. Each multiplies both
parts of the anvil in `zoneW` (the perfect part `p` and the good part `g`), on top of the passives. The parts are capped at
0.22 and 0.34 after everything, so they never get wider than the bar can draw.

| Hammer | Price | Smithing level | Both parts |
|---|---|---|---|
| The anvil's hammer | (everyone) | | ×1 |
| Iron Forge Hammer | 800 | 1 | ×1.1 |
| Steel Forge Hammer | 6,000 | 4 | ×1.2 |
| Mithril Forge Hammer | 30,000 | 7 | ×1.3 |

## Spatulas (`CKS`, `S.spt`)

Every inn sells them: each `inn*` NPC's own options get one line, 🍳 Cooking tools (`ckInnOpt`), that opens the spatulas
above yours and the stove (`ckInnMenu`). The line isn't in `tavOpts`, because the quest-ask branch of `talkNPC` builds its
options from `n.opts()` alone, and a single line keeps a phone's inn menu from growing to 17 options. In `cookStart`, the golden part `w` and its cap are
multiplied by `w`, and the time the pot takes to heat by `d`. Brewing has its own minigame (`mixStart`), and spatulas don't
change it.

| Spatula | Price | Cooking level | Golden part | Heating time |
|---|---|---|---|---|
| Your old spoon | (everyone) | | ×1 | ×1 |
| Wooden Spatula | 200 | 1 | ×1.1 | ×1.05 |
| Copper Spatula | 2,000 | 4 | ×1.2 | ×1.1 |
| Mithril Spatula | 12,000 | 7 | ×1.3 | ×1.15 |

The width and the heating time multiply: the time you have inside the golden part is about ×1.5 with the Mithril spatula
(the review found ×1.89 with the first numbers).

## The portable stove (`pstove`, `CKST`)

Every inn sells one for 1,500. You can own only one: one in the stash counts, and it can't be traded. It sells back for
300.

To set it down, click it in the bag or on the hotbar; it lands at your feet. Click it again to pick it up. While it is down,
E at the stove opens the stove's cooking menu (`campMenu(1)`, the campfire's with the stove's name and line), so you can
cook and brew there.

- The stove is chosen only when nothing else is in reach, so it never takes E from a person, an anvil or a door.
- You can't cook at it with a monster that fights back within 12 tiles (`ckFoe`), because cooking stops the world and that
  would be a pause in the middle of a fight. Fixed campfires stand in safe places.

It goes back to the bag by itself (`ckTick`) when any of these happens:
- you are more than 25 tiles away;
- you go under the map;
- you die (`die()`);
- you sell or stash it.

It is not saved, and only you can see it. It isn't in `CAMPS`, so it doesn't warm you on the Chaos Mountains.

It can't be set down (`ckWhy`):
- under the map: dungeons, mines, the kingdoms, the vampire cities and all rooms;
- on water or a solid tile;
- within 15 tiles of a living boss;
- in the story's places (`CKNO`): the Sword Grave and the Giants' hold (the race track is under the map already).

Earl Zebra's castle, Yatan's ruins and Red Dragon's Peak allow it more than 15 tiles from their boss. Cooking there is still
refused with a monster close by.
