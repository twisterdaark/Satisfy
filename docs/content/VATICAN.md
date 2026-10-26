# The Vatican (v3.11)

The owner (2026-10-25): "add any place or region of the novel that has an effect". The first place of the places audit
(the novel's places the game did not have, by their weight in the story): the Vatican, the Holy See of the Rebecca Church.

## The novel (CANON)

| What | Where |
|---|---|
| "if he headed south for half a day, he would finally arrive at the Vatican" | the game's landmark at Rolling |
| Rebecca's priests are mostly NPCs whom parties hire for donations; Drevigo, the 13th pope, nearly 60, corrupt; the paladins include "Rebecca's Daughters", Isabel (master of the Lifael Spear) and Rin | ch 118 |
| "The Vatican. Dozens of senior paladins and priests watched as one of Rebecca's Daughters, Rin was questioned"; those who spoke out were demoted to remote temples; "Reform was needed." | ch 122 |
| the Vatican's backyard, where Isabel cries; its front door; Rin (19), Isabel (17, platinum hair, Lifael's Spear), Luna (14, purple hair, Everiel's Shield: "It is impossible to break Everiel's Shield"); the Daughters treated as weapons the church can replace; [Help the Rebecca Church!]: "Kill Pope Drevigo!", its reward Goddess Rebecca's blessing | ch 123 |
| Isabel hears the goddess tell her to believe in him | ch 124 |
| "I am Pope Drevigo!"; he answers a blade with light | ch 125 |
| "Goddess' Breath!" heals him | ch 126 |
| Damian ties up the paladins' feet so the pope can be fought alone | ch 127 |
| the Daughters let the one who killed him keep Franz's treasures (the 5th Pope Franz's Holy Light Crown, Armor and Gloves); the Rebecca Church "like a parent to the Judar and Dominion churches" | ch 128 |

Where it stands, its look, the fight, the numbers, the blessings' strength and the priests' service are GAME_ORIGINAL /
GAME_BALANCE; every person's line is ORIGINAL_SIDE_STORY.

## The place (`VAT`)

- Tiles x 817-851, y 196-228, in Dran Valley's south, east of the river: half a day south of Rolling. A zone and a **town**
  of its own (`zVatican`: a safe zone, no monster fights there), its recommended level from Dran Valley's beasts.
- Two-tile walls with corner towers; a gate in the north wall and a lane up to the southern road.
- Inside: the street from the gate, the **back garden** behind the cathedral (Isabel), the **great cathedral** (drawn as a
  temple; its door goes down to the papal hall), the **square** before it with two statues of the goddess (praying works as
  at Rolling's; they are the Vatican's own, `vat:1`, besides the seven statues by each god's people), a well and two priests' houses.
- **The papal hall** (`zVatH`, under the map at x 1252-1292): a long hall of pillars with a red carpet to the throne. Rin
  kneels before it; Damian waits at the entrance.
- The map's label; a landmark at the gate quoting ch 122 (and a first discovery: 0.8% of the level, 6 mana stones).
- **No dice moved**: the generator keeps the ground it paints over, and its lane (`VAT0`); the field spawns and the fire
  elementals' (`p3Spawn`) test that old ground (`atV0`/`solV0`), so every monster keeps its id and its place. The six the dice
  put inside the walls (a salamander, two lizards, three fire elementals) are moved out past the east wall, each to a tile of
  its own (`vatOut`: a monster's online key is its type and spawn tile), and the bandit rings read where the dice put them
  (`m.vo`), so no ring changes its kind. The Vatican has no bandit ring of its own (its paladins keep it).
- Explorer caches: none in a town, so Dran Valley's one cache whose cell is now inside the walls (`103_49`) gives way to
  another of Dran's cells (`99_39`); the number of caches is the same.

## The people

| Who | Where | |
|---|---|---|
| Isabel | the back garden | the quest; her topics: Rebecca's Daughters, Lifael's Spear, Pope Drevigo |
| Luna | by the cathedral's door | keeps the door shut until the quest is yours (no gifts); her topic: Everiel's Shield |
| A priest of the Vatican | the square | the goddess's blessing on a weapon; a gift is a bribe to him |
| Rin | the papal hall | judged; free after |
| Damian | the papal hall | binds the paladins' feet in the fight |

## Help the Rebecca Church! (`vat1`, Isabel, Lv 195)

"Kill Pope Drevigo!" Through the cathedral's door (Luna lets you in once the quest is yours), the papal hall: **Pope Drevigo**
(Lv 205 boss) and **two paladins** (Lv 200-204) appear for you alone (`m.vat`: never shared online, `mobOk`; never back
once he is dead). They wait until you come near (280 px) and follow you through the whole hall (leash 720 px).

- The pope answers with light: bolts, a ring of light, pillars of light falling around you; under 35% of his health,
  **Goddess' Breath** heals him by a quarter, once.
- The paladins: a sword, a charge behind the shield, the shield raised.
- When the pope turns on you, **Damian binds the paladins' feet** (8 s, then 5 s every 25 s).
- Leave the hall or fall and the judgment starts over. When he falls by your hand (the quest's kill counted), the paladins
  kneel (gone) and Rin speaks; a pope gone any other way, or a fight from another character, starts over.
- The paladins are the goddess's own, not corrupt beings: the Saintess's and the blessing's bonuses do not count on them.
- The Monster Book: one kill of the pope masters him (`mb1`), and he shows no boss chest (a quest's boss has none).

Back to Isabel: 650,000 XP and 18,000 gold, and

- **Goddess Rebecca's blessing** (`S.vatB`, for good): +10% damage to corrupt beings (demons, the undead, vampires: the
  Saintess's set), and the goddess's statues bless you half again as much (as a priest or a paladin of hers). It shows in the
  status window.
- **Franz's treasures**, Unique, Lv 195: the Holy Light Crown (defence 22, health +6%), Armor (defence 50, health +6%) and
  Gloves (defence 14, attack speed +6%); the set: 2 pieces health regeneration +10%, 3 health +8% and damage +5%.

No title.

## The priest's blessing on a weapon (`i.bls`)

At the priest on the square: a weapon gets the goddess's blessing, +15% damage to corrupt beings, for good (it trades with
the weapon). The donation is the pope's decree, **100,000 gold**, until the church is set right (your quest done), then
**8,000** (both less the usual discounts; the priest names the price you pay). A weapon blessed once cannot be blessed again.

## Tests

`tests/regression/vatican.test.cjs` (2): the place (zones, walls, gate, lane, cathedral), its people where they stand, no
beast inside, the door and the way up; the quest: Luna's door, the pope and his paladins for you, his moves, Damian's binding,
his fall, the hall forgetting the fight, the blessing and Franz's treasures, the weapon's blessing and its price.
`gods.test.cjs` counts the Vatican's two statues apart from the seven.
