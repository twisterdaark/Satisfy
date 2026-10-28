# Bloodline keepers and the Races page (v3.71; 2026-10-28)

The owner, 2026-10-27 23:50: "Bloodline Quest for each race should be separated into their own npc, so it's not all a part of
the menu and people have to explore. Please add all races to the index and variants, for players to see what each one offers.
Give a vague explanation or one may find the quest giver. For rare variants make the quest harder."

The races and their bloodlines are Claude-B's (v3.64, v3.69, v3.70: `RZ`, `RZQ`, `RVQ`, `rz*`). This release changes only who
gives the bloodline quests, how they end, the rare ones' difficulty, and adds the Index page.

## Keepers (`RVK`, `rvk*`)

Twenty NPCs, one for each race and bloodline: `['rvkHu1','human','v1',x,y,[quests]]`. They are GAME_ORIGINAL people standing at the
game's own places; none of them is credited to the novel. Their dialogs are `NPCT.rvkXx={hi,idle,low,noGift}`.

| Keeper | Bloodline | Where | Quests |
|---|---|---|---|
| The Watchtower's Last Knight | Human · Royal Blood | Old Watchtower (`zRuin`) | rvhu1 |
| The Swordsman Past His Limits | Human · Transcendent | Muller's Sword Hill (`zMull`) | rvhu2a → rvhu2 |
| Elder of the Whitepine | Elf · High Elf | Whitepine Forest (`zWPine`) | rvel1 |
| The Shade of the Darkwood | Elf · Void Elf | The Darkwood (`zSWood`) | rvel2a → rvel2 |
| The Sirens' Handmaid | Merfolk · Royal Siren | East Coast (`zESea`) | rvme1 |
| The Drowned Bell-Keeper | Merfolk · Abyssal Leviathan | South Sea Coast, far west (`zSSea`) | rvme2a → rvme2 |
| The Old Rune Carver | Dwarf · Runesmith | Reidan Mines L1 (`zMine1`) | rvdw1 |
| The Ash-Bearded Smith | Dwarf · Dark Dwarf | Red Badlands (`zSDes`) | rvdw2a → rvdw2 |
| The Old Chief | Orc · War Chief | Frostlight Orc Village (`zOrc`) | rvor1 |
| The Bone-Talker | Orc · Ancestral Shaman | North Hill (`zGrave`) | rvor2a → rvor2 |
| The Exiled Seer | Evil Eye · King's Lineage | Kesan Canyon (`zKesan`) | rvee1 |
| The Blind Overseer | Evil Eye · Overlord's Eye | The Abyss, 3rd level (`zAbyss3`) | rvee2a → rvee2 |
| The Ice-Rimed Giant | Giant · Frost Giant | Glacier Lakes (`zGlac`) | rvgi1 |
| The Titan Who Sleeps Standing | Giant · Ancient Titan | Giants' Land, far east (`zGiantL`) | rvgi2a → rvgi2 |
| The Ember Hermit | Half-Draconian · Elder Drake | Red Dragon's Peak (`zPeak`) | rvdr1 |
| The Scaled Wanderer | Half-Draconian · True Dragonkin | Chaos Mountains, 4th ridge (`zChaos4`) | rvdr2a → rvdr2 |
| The Envoy of Heaven | Yangban · Heavenly Official | Kingdom of Cho (`zEaCho`) | rvya1 |
| The Martial Hermit | Yangban · Martial Deity | Kingdom of Xing (`zEaXing`) | rvya2a → rvya2 |
| The Horned Matron | Demonkin · Archdemon Blood | Hell, the Demonkin Village (`zHellV`) | rvde1 |
| The Throne-Watcher | Demonkin · Hell Prince | Hell, the Empty Throne (`zHell9`) | rvde2a → rvde2 |

Every spot is open ground and reachable. Each is at least 13 tiles from a boss's spawn and at least 6 from any monster's
spawn point, and far from Winston (the title's camera and minimap). The keepers are added after the map's NPC clearing, so no
tile changes; `ogSpawn`'s "no monster within 3 tiles of an NPC" check is outside every keeper's area. They join `NPCS` at
the very end of the script, after every other NPC: an NPC's index travels online (`npcKOSay`), so no NPC before them moves.

## How a keeper's quest works

- **Offered** by `talkNPC` like any quest. `qAvail` has one more condition for a quest with `rv` (the last quest of a bloodline) or
  `rvp` (a rare bloodline's first quest): `rvkOk(q)`, your own race with its powers awake (`rzR()`), not the bloodline you have,
  never the uncommon one if you have the rare one, and for a first quest, its second not taken yet. Under its level a keeper says when to come back (`rvkLow`); to another race it
  speaks of the blood (`rvkId_*`).
- **Taken back** at the keeper (`*_d`, then `completeQ`), and only from its own race (`rvkTurn`): if you changed race
  meanwhile, the quest waits. The races' tick no longer finishes them by itself. The quests stay
  `hid:1` (not in the quest book), so `rvkTick` toasts "Return to …" once a session when one is ready.
- **The last quest** keeps `rv`, so `completeQ` still calls `rzVarGain`. A keeper warns you, in the offer, when the new bloodline
  would replace yours (`rvkWarn`).
- **A whisper**: when your race could take a bloodline's quest at your level and you have not met its keeper, a toast says
  someone knows of it, and points to the Index, not to a place. One whisper every 30 minutes for all bloodlines, the first 5
  minutes into a session.

## The rare bloodlines' two quests

The first quest is the old one (its objective), the second is new and harder (GAME_BALANCE):

| Bloodline | First (`*2a`) | Second (`*2`) |
|---|---|---|
| Transcendent Human | 500 monsters above your level | 3 bosses above your level (`bosshi`) |
| Void Elf | 300 dodges | 60 dodges with a boss within 160 px (`bdodge`, `rvkDodge`) |
| Abyssal Leviathan | 500 monsters in water or rain | the Kraken twice |
| Dark Dwarf | 300 fire monsters | 3 pieces of unique rating or better |
| Ancestral Shaman Orc | 500 undead or evil spirits | 5 undead or evil bosses (`spboss`) |
| Overlord's Eye | 1,000 demons | Belial |
| Ancient Titan | 10 bosses of Lv 300+ | 5 bosses of Lv 400+ (`boss4`) |
| True Dragonkin | 300 half-draconians | the Blue Dragon twice |
| Martial Deity | 500 blocks or parries | each of the Four Auspicious Beasts (`sbeast2`) |
| Hell Prince | Marchosias and Leraje, each once (`hll2`) | Marchosias 3 times |

`sbeast2` and `hll2` keep their own distinct-kill lists in `S.rzq`, so a Yangban who did the race trial (`sbeast`) or a demonkin
who did `rzh2` (`hll`) still counts them again. The quest pointer leads to one not yet counted.

**Old saves** (`rvkMig`, once a character: `S.rvkM`):
- A rare bloodline's quest carried from the old menu, when its old objective is now the first quest's, becomes the first quest
  with its progress (Transcendent, Void Elf, Dark Dwarf, Ancestral Shaman, Ancient Titan, Martial Deity).
- If the first quest already exists, the second starts from zero.
- The others keep their quest, but its count starts again, because their objective changed.

The Runesmith's objective line said "rare rating or better" while it asked for epic (`r:2`); it says epic now.

## The Index's Races page (`IXV==='race'`, `rvkIx`)

Thirteen cards: Human, Elf, Dark Elf, Merfolk, Dwarf, Twilight Orc, Frostlight Orc, Evil Eye, Giant, Half-Draconian, Yangban,
Demonkin, Vampire. It opens on your own. Each shows its description, its racial skill, how it is had (a base race's free pick;
an unlockable race's trial place as a vague hint, `rzH_*`, with its level; the vampire's covenant), and both bloodlines: what they
give, their odds as the race is taken (`rzPv`), how many quests and from which level, and the keeper as a vague hint
(`rvkH_*`) until you have met it (`S.met`), then by name and zone. Search finds races and bloodlines by name.

Test: `tests/regression/bloodkeepers.test.cjs` (6). `races.test.cjs`'s bloodline step now goes back to its keeper.
