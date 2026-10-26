# Auto production (v3.10)

Requested by the player Suki through the owner (2026-10-26 01:10):

> Add the Auto Production Button for Blacksmith, and for Production Classes just like the webnovel so you don't always have
> to do stuff with your own hand (But maybe make it get lower quality or lower rarity stuff so doing stuff yourself is still
> more valuable and valid)

The novel, ch 925 (CANON): "The time required for item auto production was affected by the level of the blacksmithing skill
and dexterity"; "It was rumored that the penalty of Pagma's Successor was that he couldn't make items automatically";
"Grid was someone who produced items manually". How plain the results are, the times and the experience are GAME_BALANCE.

## The switch (`S.autoP`, durable)

One switch for every kind of production, saved with the character:

- **At an anvil**: a button in the forge's service row, «⚙ Auto production: off / on». While it is on, every known recipe's
  button reads «⚙ Auto» and makes the recipe automatically. The Creation's own designs stay hand-made.
- **At a campfire or a stove** (cooking and alchemy) and **at the tailor's** (sewing): a line just before Leave, so the
  cursor still starts on a dish or a garment.

Pagma's Successor sees «⚙ Auto production» greyed: he cannot make items automatically at the anvil (the penalty, ch 925). He
cooks, brews and sews automatically like anyone.

## How it works (`autoStart`, `autoTick`, `autoMake`)

Choosing a recipe with the switch on closes the menu and starts making it while you stand still: a bar over your head, the
item's name and how many are done. Only plain materials are counted and taken: shiny ones stay for your hands. One item after another, while the materials last. Each item's materials are taken when
it is done, so a stop loses nothing. It stops when:

- the materials run out («Out of materials: N made»);
- you move more than a few steps' fraction, a blow lands on you, a dialog opens, the stove is packed away, or you die or
  load another character («Auto production stopped»).

## Time

One item takes `base / (1 + 0.08 × (level - 1) + dexterity / 2500)` seconds, never under 1.5:

| Production | Base | The level |
|---|---|---|
| Smithing | 9 s | smithing level |
| Cooking | 4 s | cooking |
| Alchemy | 5 s | alchemy |
| Sewing | 6 s | sewing |

## What comes out: plainer than your hands

| | By hand | Auto |
|---|---|---|
| Smithing | Normal to Legendary, by the mini-game | **Normal or Rare** only: the mini-game's part is fixed at an average 0.5, plus 0.025 a smithing level and the guild's and specialization's bonuses; never Epic or better |
| Cooking, alchemy | a perfect one gives an extra dish or potion | one each, never perfect, never failed |
| Sewing | Normal to Unique | Normal, or Rare half the time from sewing level 3 |
| Shiny | from shiny materials, or a lucky Legendary | never (only plain materials are used; shiny ones are left) |
| Experience | full | **half** (smithing, life skill, level and side) |
| First-craft stat points, patience, a recipe's understanding, titles, naming, the made-by-hand count (`S.made`) | yes | no |

What is made counts for quests (`qEvent('craft')`) like a hand-made one, but not for the National Competition's points
(`natEv` skips it while `AUTOQ` is set); a piece goes to the bag, nothing is put on by itself.

## Also in v3.10: Legendary by Pagma's hands alone

The owner (2026-10-26 01:31): "Make sure no other blacksmith than Pagma's can make legendary items and above". `legCap()`
is 4 for Pagma's Successor and 3 for anyone else: `maxRating()` never passes it, a divine beast's breath piece (`fix:4`,
always Legendary before) comes out Unique by anyone else's hands (`finishMG`, and `mkItem` for a made piece), and so the
Legendary Blacksmith and First Legendary Item Maker titles (both at a crafted Legendary) are his alone. Dropped and rewarded
Legendary items are unchanged, and pieces made before stay as they are. Auto production never makes a breath piece or a
Creation (by hand only).

## Also in v3.10: a failed take-apart breaks the item

The owner (2026-10-26): "When i failed to Take Apart a Weapon, i still kept it in my inventory". A failed take-apart
(`doSalv`) now destroys the piece with nothing back («[The disassembly has failed.] … broke apart and nothing came back.»), and the risk line says so
before you confirm.

## Tests

`tests/regression/autoprod.test.cjs` (2) and `dsets.test.cjs` (a blacksmith's breath piece Unique, Pagma's Legendary): the anvil's switch and button, three swords from the materials of three, a master
faster and still never Epic, moving stops it with nothing lost, a blow stops it, shiny materials kept and nothing counted as hand-made, Pagma's
Successor cannot; a dish from the camp's menu (never the perfect extra), garments Normal or Rare, the switch just before
Leave. `salvage.test.cjs`: a failed take-apart keeps nothing.
