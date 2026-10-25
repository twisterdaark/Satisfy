# Fishing (v3.03)

Requested by the player Suki through the owner (2026-10-25): "Add new sprites to multiple fishes, more fish species.
Different fishing rods that can be sold by a vendor in winston… Add different bait type's for fishermen and each one with
different benefits. Redistribute fish species across the entire map, each biome with its own rare and "common" fish."

All of it is GAME_ORIGINAL: none of these fish, rods or baits are credited to the novel.

## The waters (`TKZ`, `tkReg`)

The water tile you cast into decides the water. They are checked in this order:

| Water | Where | Common | Rare |
|---|---|---|---|
| `east` | the East Continent's own water (x ≥ `WMW`, but not its open sea or the Red Sea) | Eastern Carp `ecarp` | Jade Koi `jadekoi` |
| `snow` | `snowAt`, the Glacier Lakes, the Frost Plains | Snow Trout `sfish` | Ice Pike `icepike` |
| `swamp` | `swampAt`, Haalrune Swamp, Ashur Marsh, the Sunken Fen | Swamp Catfish `catfish` | Bog Eel `bogeel` |
| `sea` | the South Sea, the East Coast, Kraken waters, Cork Island, the harbour, the Red Sea, the East Continent's open sea | Mackerel `mackerel` | Red Snapper `snapper` |
| `fresh` | everything else: the Lake, rivers, ponds | Fish `fish` | Rainbow Trout `rtrout` |

The Golden Fish (`gfish`) bites in every water.

A water census of the surface (every water tile from y −140 down, x −400 to 3200) gave these tile counts:

| Water | Tiles |
|---|---|
| sea | 73,015 |
| east | 5,153 |
| fresh | 1,546 |
| snow | 1,207 |
| swamp | 954 |

## A catch (`tkPick`)

1. The Golden Fish is rolled first. Its chance is `(.02 + Fishing × .008)`, multiplied by:
   - the Fisherman specialization;
   - the festival (×3);
   - rain (×1.5);
   - the rod;
   - the bait.

   It is capped at 75%.
2. If that misses, the rare fish is rolled. Its chance is `(.05 + Fishing × .01)`, multiplied by:
   - the specialization;
   - the rod;
   - the bait;
   - rain (×1.25).

   It is capped at 60%.
3. If both miss, you catch the water's common fish.

A rare fish gives 12 Fishing points, a common one 6 and the Golden Fish 25.

## Rods (`TKR`, `S.rod`)

All rods are sold by Winston's merchant. He lists only the rods above yours.

| Rod | Price | Fishing level | Time to reel in | Rare | Golden |
|---|---|---|---|---|---|
| Old Rod | (you start with it) | | ×1 | ×1 | ×1 |
| Oak Rod | 300 | 1 | ×1.25 | ×1.2 | ×1 |
| Steel Rod | 3,000 | 4 | ×1.5 | ×1.4 | ×1.2 |
| Mithril Rod | 20,000 | 7 | ×1.8 | ×1.7 | ×1.4 |

## Bait (`TKB`, `S.bait`)

Bait is a material. You click it in the bag (or its hotbar slot) to put it on your hook, and again to take it off. Each cast
takes one. The last one comes off the hook with it, and a bait you no longer have (sold, stashed) comes off at the next
cast. The bait on your hook is marked in the bag, but it still sells, stashes and drops like any bait.

| Bait | Price | Effect |
|---|---|---|
| Worms `bworm` | 3 | the bite comes at ×0.6 of the wait |
| Shrimp `bshrimp` | 8 | rare ×1.5 |
| Glow Bait `bglow` | 50 | Golden ×2, rare ×1.2 |

Bait is sold at its own price, with no discounts, and sells back for 1, 2 and 12. With the shop discounts (they add up to
55%), a discounted Worm sold back for more than it cost (a review finding).

## Common fish together (`TKC`, `tkN`, `tkTake`)

Wherever a recipe or a quest asks for `fish`, any common fish counts. This covers:
- the cooking recipes;
- the Lake Fisherman's and Brinichi's quests;
- the cat.

They are taken in this order: Fish, then Snow Trout, Mackerel, Swamp Catfish and Eastern Carp. Rare fish are never taken
for it.

## Prices and the market

These are the `MATP` prices. The day's market quota (`MKQ`) is in brackets.

| Fish | Price (quota) |
|---|---|
| Mackerel | 5 (40) |
| Swamp Catfish | 6 (25) |
| Eastern Carp | 7 (25) |
| Rainbow Trout | 25 (6) |
| Red Snapper | 30 (6) |
| Bog Eel | 30 (6) |
| Ice Pike | 35 (6) |
| Jade Koi | 45 (6) |

All of them can go to the auction.

## The festival board

`backend/database.rules.json` (`fishFest`) knows every kind and its top weight. The top weight is `ceil(max kg × 1.2 × 10)`,
the most a kind can weigh at Fishing 10, in tenths:

| Fish | Top weight (tenths of a kg) |
|---|---|
| Fish | 32 |
| Mackerel | 34 |
| Eastern Carp | 39 |
| Snow Trout | 41 |
| Swamp Catfish | 48 |
| Rainbow Trout | 51 |
| Bog Eel | 56 |
| Red Snapper | 60 |
| Jade Koi | 63 |
| Golden Fish | 66 |
| Ice Pike | 72 |

`tests/regression/fishing3.test.cjs` checks this table against the game's own weights. If the game ships before these
rules are deployed, the board refuses a new kind; the game tries it three times and gives up for that festival.

## The Index

The Index has a 🎣 Fishing page with these cards:
- how fishing works;
- one card per water, with its common and rare fish (a rare fish you haven't caught shows as ???);
- the rods;
- the bait.
