# The Sword Saint's new arts (v3.13)

The owner (2026-10-26) sent the wiki's [Swordsmanship Creation] page (CANON, ch 571-572, Kraugel) and six skills of his own
design for the Sword Saint (GAME_ORIGINAL: his names and his numbers). All are the class's from level 1 (a legendary class
starts over at level 1). A metre is a tile, 16 px, as the Demon Slayer's 26 m.

## Swordsmanship Creation (`sscre`) and Complete Sword Mastery (`sscsm`), CANON

ch 572, verbatim: "[Swordsmanship Creation] You can create new sword techniques. The number of times it can be created will
increase every time the level of 'Complete Sword Mastery' increases. * The term sword techniques refers to skills that can be
used when wearing sword type weapons. * There are six factors that determine the power of the created sword technique. *
Passive skills can't be created. Number of sword techniques that can be created: 3/4". Kraugel created Splitting the Sky,
Passing the Sky, Thunderbolt (ch 1320) and Twin Fang Strike with it. Their system windows weren't reachable (wuxiaworld shows
each chapter's opening only), so their numbers here are the game's.

The game's way (GAME_ORIGINAL):

- The skill on the bar opens a window: "[Swordsmanship Creation] Number of sword techniques that can be created: a/b".
- Pick a form, or start from one of Kraugel's four (a preset that names it after his technique):

| Form | Kraugel's | What it does | Preset (power, reach, breadth, strikes, swiftness, economy) |
|---|---|---|---|
| Split | Splitting the Sky | a blade of sword energy flies ahead, through all in its path, to the first wall | 8, 9, 3, 2, 4, 4 |
| Pass | Passing the Sky | you cross the distance in a flash (a moment untouchable) and cut all you pass | 6, 8, 4, 4, 4, 4 |
| Bolt | Thunderbolt | sword energy falls from above on the nearest foes ahead (2 + breadth/12 of them) | 9, 6, 5, 3, 3, 4 |
| Fang | Twin Fang Strike | two crossing cuts close in front, a lighter second fang each strike | 7, 3, 4, 8, 5, 3 |

- The six factors share 30 points, 10 at most each (a slider stops at the points left). `swcStats`: damage per strike
  `k × (0.6 + 0.12 × power) × (1 + 0.04 × (Complete Sword Mastery − 1))` (k: Split 1.6, Pass 1.4, Bolt 1.5, Fang 1.1);
  strikes `1 + strikes/3`; reach and breadth by form; cooldown `form × (1 − 0.05 × swiftness)`, at least 4 s; mana
  `form × (1 − 0.06 × economy) × (1 + (power + strikes)/25)`.
- Name it (24 letters, the chat's cleaner, no `<>&"'` so a name can't carry markup) and create it: the use can't be taken back. It becomes a skill of the bar,
  `swc_<id>`, needing a sword, its description written from its numbers, and it is this character's alone (`skOK`;
  `swcReg` takes another character's away). Saved in `S.swc`.
- As many techniques as Complete Sword Mastery's level (a Sword Saint's only). Complete Sword Mastery is a passive that rises with every sword strike
  that lands (and with kills, as every passive): sword damage +2% a level.

## The owner's six (GAME_ORIGINAL)

| Skill | MP / cooldown | In the game |
|---|---|---|
| Body as a Blade (`ssblade`, passive) | | defence and movement speed +15%; under 30% health the critical chance doubles (its cap from 50% to 90%) and a sword ignores half of a monster's elemental resistance (v3.16, `elDmg`; until v3.16 the game had no resistances and it ignored half of a raised guard) |
| Transcendent Sword Mastery (`sstsm`, passive) | | attack speed +1% for every character level (`atkCD / (1 + Lv/100)`; every attack waits 0.1 s at least, ten swings a second, as the frame rate decided past that); every fifth sword strike in a row (at most 2 s apart) sends a 5 m shockwave of 150% |
| Pinnacle Counter (`sspc`) | 40 / 15 s | 1.2 s: the first monster's blow that lands does nothing (not a tick, a fall, the weather, a reflection or a blow you'd have dodged anyway), and a spatial slash answers it, 800% and a 1.5 s stun on the attacker |
| Kill Peak (`sskp`) | 100 / 90 s | 0.8 s, then a 20 m line (to the first wall) of 2,500% fixed damage: no level gap, no guard, no immunity (`o.pure`), no crit, no spread. What it cuts is Cleft for 6 s: it can't heal (`clHp`) or raise a guard. Online, on a monster another player hosts, the Cleft holds on the host's screen only. |
| Conqueror of the Mind: Sword Field (`ssfield`) | 80 / 60 s | 10 s, 15 m round you: foes inside move 40% slower and their attack cooldowns tick at half speed (`m.sfU`); you and your party inside deal 25% more and shrug off crowd control (the 'W' status, `phAtk`, `saImm`) |
| Shadowless Thousand Sword Storm (`ssstorm`) | 70 / 45 s | needs Control Sword's swords out; 20 cuts over 3 s on the nearest foe ahead (or a spot), 300% each, each shredding 5% of its armour, up to 100%, for 10 s. Armour is the level gap's toll on your damage (`lvF`): shred undoes it as Pagma's Pinnacle does. |
| Condemnation Sword (`sscond`, v3.16, CANON ch 772) | 90 / 60 s | level 250, a sword: one cut of 800% with your attack raised by the target's whole defence (`monDef`, docs/content/ELEMENTS.md) |

## Tests

`tests/regression/swordsaint2.test.cjs` (2): the six learned, the passives' numbers, Pinnacle Counter (the blow nullified,
the attacker cut and stunned, only the first), Kill Peak (the wind-up, the hit through a guard, the Cleft holding its
health), the Sword Field on a foe, the Storm refused without Control Sword and shredding to 100% with it, the fifth strike;
the Creation from a preset, the 30-point cap, the skill made and learned and named, its cut, the use spent, another
character without it.
