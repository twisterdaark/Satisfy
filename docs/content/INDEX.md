# The Index (v2.97; 2026-10-25)

The player Suki, through the owner: "Create a tab that opens with the N keybind, call this tab the index, include all
trainers in the game except legendary ones (those are for players to find), this index also include player classes..
most skills from classes and if a player owns a legendary class they may view other legendary ones. All possible drops in
the game that are relevant to players, no filler items such as potions etc... Also make sure to incorporate gems, smithing,
mage."

- **Opening**: N in play, unless a party invitation or a duel waits for its answer, where N is "no" (the key is the
  "Decline · Index" action of the controls screen); the `kN` key in the keys box opens and closes it itself (a tap is never
  "no"). Esc, or N with nothing waiting, closes it. Mode `idx`; you can walk with it open. Closing it leaves another mode
  (a dialog over it, death) alone, and death hides it.
- **Read only**: every page is built when the Index opens from the game's own tables, so it follows them as they change:
  - **Trainers**: the givers of the class trials in `QD` (`cls`, `promo`; never `sys`, the hidden offers) and of the
    specializations in `SEC`, with where they stand (their zone).
  - **Classes**: base (`cls`), advanced (`promo`, with the classes they come from and the mastery), hidden (`hcls`, the Fog
    Island books) and legendary (`LEGCL`). Each with how to get it, its weapon (from the mastery or its skills' `need`) and
    every skill of its own in `SKD` (level, the quest that opens it, MP, cooldown, the description). A line on how each
    base class plays. Hidden classes show only to one who holds a hidden class; legendary ones only to one who holds a
    legendary class; to everyone else each kind is one locked card, and no other page names them.
  - **Drops**: the named gear (`NDROP`) and the materials monsters carry (`MT[].drop`), without the plain ones (wood, ore,
    leather, herbs, fish, crops) and the gems (their own page), only from monsters with a spawn of their own (an event's,
    a siege's, the tower's or Behen's give no named gear). Each with who drops it (level, boss, zone; ??? for a monster you
    have not met, as in the Monster Book) and the odds as the kill rolls them: a named drop in its order, stopping at the
    first (`namedDrop`); a boss a quarter to a half of a count over 1, or 1.5 times a chance. What it goes into. One card
    for the bosses' chests, the enhancement stones, the return scroll and the recipe books bosses drop.
  - **Gems** (`GEMS`, `GEMC`), **Smithing** (every `RC` recipe that can be made, its materials and what it asks, read from
    its unlock: smithing level, the Blacksmith class or specialization, a quest, the pieces made first and how many,
    understanding, a recipe book) and **Magic**
    (mana, staffs, the magic trainer's paths, the elements in `BEL` and the breaths in `BTHK`).
- Search by name on every page. Arabic and English.

Test: `tests/regression/index.test.cjs` (2).
