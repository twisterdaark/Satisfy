# NPC life, first discoveries and the field's secret quest (v2.88, v2.90-v2.95; 2026-10-25)

Owner's request (2026-10-25, encyclopedia §93-§95; the player Suki: "some NPCs are boring and say little, add secret
quests and a reward for meeting people and exploring"): depth for people who already exist, through the systems that
already exist. Nothing new is saved: `S.met` (what was said and chosen, as `S.met['who#key']`), `S.aff` (the gifts'
affinity, tiers 30/60/90), `S.rep` (the town's ranks), `S.qs`, `S.books` (the discoveries), `S.dly` (the day's field work).

## Provenance

| What | Source | Label |
|---|---|---|
| Khan, the Winston blacksmith | ch 1-30 | the person CANON; every line ORIGINAL_SIDE_STORY |
| Earl Ashur ("the great magician Ashur", at the Gauss border) | ch 212-213 | the person CANON; every line ORIGINAL_SIDE_STORY |
| Irene, Earl Steim's daughter (only spoken of, by Ashur and Doran) | ch 117; the game's Irene quest (`irn`) | CANON. v2.88 had Ashur call her his own daughter; v2.90 corrects it |
| Doran, the shadow who secretly protects Earl Steim | the game's Irene quest | the person as the quest has him; every line ORIGINAL_SIDE_STORY |
| Han Seokbong, lord of Pangea under the Cho Kingdom | the game's East Continent quests (ea0-ea4) | the person as the quests have him; every line ORIGINAL_SIDE_STORY |
| Winston Castle, Earl Steim's seat ("80 servants working in Winston Castle"; "the great lord of the north, Earl Steim") | ch 116 | the place and the person CANON (v2.92); every line ORIGINAL_SIDE_STORY |
| Irene in Winston Castle, once home | ch 116-117 (Steim's only child; Bland de Ian her childhood friend; "shiny silver hair", ch 117, drawn so since v2.92) | CANON (v2.92); every line ORIGINAL_SIDE_STORY |
| Administrator Rabbit: the Mero Company's merchant at the smiths' contest in Winston, "a person who only moved for profit", uneasy with Valmont's ways, the first to see the level 21 Grid's talent and offer a partnership; out of a long prison stay, thin-rimmed glasses, "the people of Winston treating me as a hero"; Reidan's executive administrator; the daily Administrator Rabbit's Call, paid in gold | ch 38-41, 221-228, 856 | CANON (v2.92); the call's three errands (resources, security, a ledger to Lauel) GAME_BALANCE after ch 856's daily list |
| Piaro, the farmer who once held a sword | the novel's Piaro | the person CANON; every line ORIGINAL_SIDE_STORY |
| The farmers' field work and their affinity opening a hidden quest of a special character with low odds | ch 856 (Agriculture Development) | the mechanic CANON |
| The Field at Night (the Burrow Queen in Piaro's field) | written for the game | ORIGINAL_SIDE_STORY |
| Huroi's secret quest (ch 32-33: the orator, Apostle of Justice, Unbreakable Justice) | ch 32-33 | already in the game (`apjus`), not built again |
| Administrator Rabbit's Call (ch 856) | ch 856 | built in v2.92 (see Winston Castle above) |
| Khan's grandfather's vein, the cave at the northern end | landmarks already in the world (`lmMine`, `lmNEnd`) | the places existing; the stories ORIGINAL_SIDE_STORY |
| Field Burrower, Burrow Queen, Bandit Scout, Echo Bat Swarm, Mossback Snapper; Kobold Sapper, Dune Shellback, Thornback Sapling, Stone Sentinel (v2.91) | written for the game | GAME_ORIGINAL (levels are game balance) |
| Reidan's Western Sands: the land west of Reidan, turned to desert by the giant worms ten years ago ("this large territory suddenly became a desert"); "the desert city of Reidan"; the Hebend River through Reidan, the villages on its southern basin (in Rabbit's words) | ch 216, 217, 228, 360 | the place CANON (v2.93); its edge and size GAME_BALANCE |
| Giant worms ("the giant worms ravaging the land were so strong that they couldn't be subjugated"); "a small nest of giant worms below the mountain"; "dozens of desert toads" chasing | ch 217, 230 | the creatures and the nest CANON; how they fight, their levels and drops GAME_ORIGINAL / GAME_BALANCE |
| Rabbit's quests Restoring the West and The Nest below the Mountain | after ch 228 ("What if he destroyed the giant worms and restored the west?") | ORIGINAL_SIDE_STORY |
| Earl Zebra's castle and territory on the way from Reidan to Titan ("Lauel told me to stop here and get the Slaughterer's Eye Patch"; "Earl Zebra's castle"; "This is a bad place.") | ch 243 | the place and the person CANON (v2.94); where it stands (south of Titan by the western road) GAME_BALANCE; every line ORIGINAL_SIDE_STORY |
| The Slaughterer of Earl Zebra's underground ("a half human, half beast species he raised. But it was impossible to control"); the Slaughterer's Eye Patch ("just a black eye patch made of leather", Unique, "the skill 'Vital Spot Detection' will be generated") | ch 243-244 | CANON; its fight, level and the skill's +8% GAME_ORIGINAL / GAME_BALANCE |
| The Black Arrows ("the assassination ability of those who served Earl Zebra's family for generations was unmatched"; "dozens of daggers") | ch 245-246 | CANON; how they fight, their levels GAME_ORIGINAL / GAME_BALANCE |
| Lauel's errand The Slaughterer's Eye Patch | after ch 243 | ORIGINAL_SIDE_STORY |
| The Sword Grave: "an open plains area with 4,179 swords stabbed into the ground"; 599 significant swords that "rotated to the left or right"; a wrong turn resetting the earlier ones; "the plains turned into a hill"; Pagma's late works and Braham's grave in a glacier that "didn't tolerate any living thing" | ch 931, 937, 940 | the place and the puzzle's way CANON (v2.95); twelve swords, their order and directions, where it lies (the Glacier Lakes) and the rewards GAME_BALANCE |
| Skunk of Skunk's Expedition Group, a year and four months at the grave; the expedition made its name with the main Yatan temple | ch 931, 937 | the person CANON; every line ORIGINAL_SIDE_STORY |

No person's line is taken from a translation of the novel. The landmarks quote a sentence or two of their chapters, as
the game's landmarks always have (Kesan Canyon's, and since v2.93 the Western Sands' and the nest's).

## The people (`NLD` in index.html)

Each of Khan, Ashur, Piaro, the Patrian farmer (v2.88), Han Seokbong and Doran (v2.90) has:
- **lines for the moment**: night or day, your level, your class, the quests you did for them, your rank in their town.
  Never the same line twice running (`nlIdle`).
- **a word once** after each of their quests, and once for each new rank of your name in their town. A word kept for once
  is spent only when it is shown (not when a quest's own line is shown instead).
- **topics** behind a "Talk" option: choices that they remember (their next lines change with what you chose), affinity
  for a choice once, and the trusted topics locked until affinity 30, 60 or 90, saying how much more they need.
- **rumours** that lead to a place already in the world.

The gifts are the existing ones (once every 5 minutes of play).

## First discoveries (`FD`, encyclopedia §95)

Paid once per character, kept in `S.books['fd_'+id]`, never again after a reload or with a party; only after the clue:

| Discovery | Clue | Reward |
|---|---|---|
| The singing vein (the mountain mine's walls) | Khan's topic at affinity 60 | 0.4% of the level, 6 ore, Insight +1 |
| The cave at the northern end | Earl Ashur's topic at affinity 30 | 0.5% of the level, 3 mana stones, Insight +1 |
| The burrow under Piaro's field | the farmer's word (affinity 90) | 1% of the level, a rainbow potato, Insight +1 |
| Cork Island (v2.90) | Han Seokbong's sea road (affinity 30): the sailors' word | 0.5% of the level, 8 fish, Insight +1 |
| Kesan Canyon (v2.90) | Doran's errand (affinity 60) | 0.5% of the level, 4 mana stones, Insight +1 |

## v2.90: the second circle

- **Han Seokbong** (Pangea): his warning while the king may learn he hid you (after Arube, until the king's delivery)
  comes before the lines for the moment (after his once-words), never twice running; a word once after the third gateway (ea0) and once he is home from the Lava Prison (ea4); the Daoist (ea3) a line for the moment; Pangea's ranks; topics: Pangea
  (what the westerners trade, why they go home), the sea road (the rumour of Cork Island), the king (after Arube: what
  he risked), and at 90 Pangea's guest (Pangea +50, once; the title Guest of Pangea until v2.93).
- **Doran** (Earl Steim's shadow): takes gifts (likes a healing potion); a word once when the lady is home, another line if the rescue failed; topics: the Earl, the lady Irene (only after the
  rescue), Kesan Canyon (the rumour), and at 90 a shadow's work (his word; the title Known to the Shadows until v2.93).
- **Irene** (v2.92) is in Winston Castle once she is home. Before v2.92 she was only in her quest; Ashur and Doran speak of
  her, as they would to Earl Steim's son-in-law when that is you (the quest's 10%).

- **Earl Ashur** takes no gifts (an official sees one as a bribe), so his trust also follows your name in Patrian
  (`repTrust`): Respected opens his 30s, Honoured his 60s, Town Hero his 90. Before, his 60 and 90 topics were out of reach
  (three quests of his: 36).

## The secret quest loop (ch 856's mechanic)

1. **The field work** (daily, from level 40): the Patrian farmer asks you to put down 5 Field Burrowers in the fields
   outside the town wall. A rainbow potato (food +45, health +25%) and his affinity +3.
2. **The farmer's word**: Devoted to him (90), a day's work brings, one time in four, what he did not want to say:
   something digs under Piaro's field and Piaro sits by his rows at night with a hoe.
3. **The trace**: the burrow appears in Piaro's field; inspecting it is the third discovery.
4. **Piaro's answer**: the topic opens. Say it is not your business and he lets it go; come back and the topic asks if
   you changed your mind.
5. **The Field at Night** (`fq1`, level 45): at night by the burrow the Burrow Queen comes up with four of her brood. If
   dawn comes first she goes back under (Piaro says so) and you try the next night. Her monsters are shared like an
   event's (a follower in a group keeps its own) and are taken out of the world when the night or the quest ends.
6. **The reward**: 600 XP, 1,500 gold, 3 rainbow potatoes, the title Guardian of the Fields, and Piaro's word about it once.

## The new monsters (`OGB`, `OGD`, `ogImm`, `ogDmg`, `ogSpawn`)

| Monster | Lv | Where | How it fights |
|---|---|---|---|
| Field Burrower | 46-52 | the fields south of Patrian's wall | underground (cannot be hit) until you are near; 3 s under, 0.6 s of the ground cracking where it will come up, 2.4 s up; never follows anyone into a town |
| Burrow Queen | 55 | Piaro's field, at night, for the quest | the same, bigger; wakes her brood when she comes up |
| Bandit Scout | 38-42 | with the outlaws on the eastern road | keeps its distance; the first time it sees you it fires a flare and the 6 nearest monsters not already fighting come; badly hurt, it runs |
| Echo Bat Swarm | 100-106 | with the cave golems east of Bairan | six bats: one blow (not a skill) kills at most one, a third of single blows miss; it circles you and bites; it goes home past 300 px and never into a town |
| Mossback Snapper | 18-24 | the lake shore | its shell turns slowly; a blow from the front does a tenth |
| Kobold Sapper (v2.91) | 74-80 | the kobolds' mines | keeps away; plants a burning charge where you stand (a marked spot that bursts); badly hurt, it runs |
| Dune Shellback (v2.91) | 302-310 | the dunes round Pangea | runs round you sideways, then stops to pinch; from above or below its shell takes a quarter |
| Thornback Sapling (v2.91) | 100-106 | the Grey Forest | rooted; thorns from afar and a rain of thorns; close by it curls up and takes half |
| Stone Sentinel (v2.91) | 104-110 | the Grey Forest | stone (unhurt) until someone stands within 50 px; awake 12 s, then 4 s of stone that won't wake |
| Giant Worm (v2.93) | 154-160 | Reidan's Western Sands | a 7 s round on the world clock: 4.2 s under the sand (unhurt, it goes after you as a ridge of sand), 0.84 s of the sand heaving in a ring round it, then up: its bite on whoever is in the ring (its reach as every screen has it), 1.96 s of fighting (bites, spat sand); too far from home (260 px, 520 when the nest called it) it goes back under the sand; never under a town |
| Desert Toad (v2.93) | 148-154 | Reidan's Western Sands | hops; when one is fighting, every toad within 200 px not fighting yet comes too |
| Giant Worm Nest (v2.93) | 160 | below the rocks at the sands' north-west | rooted, does not fight; someone within 140 px wakes every worm within 320 px (every 3 s); while a worm lives within 220 px it takes half; back after 5 minutes |
| Black Arrow Assassin (v2.94) | 205-212 | Earl Zebra's court | comes from behind you (a blink behind), cuts twice, throws five daggers at once |
| The Slaughterer (v2.94, boss) | 215 | Earl Zebra's underground | tears (three cuts), charges; from its second phase a ring and a leap; in its last, a roar and a frenzy of cuts |

Online: what a screen shows is worked out from shared things (the world clock, where it spawned, its health); in a
group the host's copy leads (`m.led`), and every blow goes out as the game's usual bite so a follower is hurt by the same
blow. A companion's blow goes through the same rules as yours. Spawned last, each kind with its own dice, so older
monsters keep their ids and places.

## v2.92: Winston Castle and Reidan's administrator

- **Winston Castle**: Winston's hall beside Khan's smithy is Earl Steim's castle (drawn as a lord's residence), with a
  room of its own made apart from every other interior so none of them moves.
- **Earl Steim**: an official (no gifts), so his trust follows Winston's honour too; his word once after the rescue and
  after Khan's Mero Company fight (gj1); the Mero Company topic changes after Khan's contest (gj2); Irene's topic as he
  would say it to her rescuer or to his son-in-law; at 90 the castle's oath (Winston +50, once).
- **Irene**: there once she is home; takes gifts (a hairpin above all); her topics: the temple (gently, she chooses how
  much), her father, Bland de Ian; at 90 her own thanks (her word in Winston: Winston +30, once).
- **Administrator Rabbit** (Reidan, by Lauel; thin-rimmed glasses): his Mero Company past (the contest at Khan's
  smithy, as it ended for you; Valmont), Reidan (the ruin it was), prison and Winston calling him a hero, profit; an official, so Reidan's honour opens him; **Administrator Rabbit's
  Call** (ch 856), daily from level 150: by the day, securing the city's resources (20 wood or 20 ore or 12 leather),
  the city's security (8 monsters within 60 tiles of Reidan) or his ledger to Lauel and back; gold (1,500 + 60 a level),
  his trust +2, once a day.

## Fewer titles (v2.93)

The owner (2026-10-25): "fewer of the titles you hand out like sweets". From v2.93 the people's topics at 90 give no title:
Khan's dream (his word), Han Seokbong's guest (Pangea +50), Doran's shadow (his word), Earl Steim's oath (Winston +50),
Irene's thanks (Winston +30), Rabbit's ledger (20,000 gold); and the new quests give none. A title stays for what a title is
for: the secret quest of the field (Guardian of the Fields). Whoever already has one of the six keeps it (they stay in the
status window for their owners).

## v2.93: Reidan's Western Sands

- **The place**: tiles x 472-512, y 56-95, west of Reidan's wall (a zone of its own, `zWSand`, Lv 145+). The road from
  Patrian keeps its tiles; its grass and flowers are sand, its trees rocks (the old wood at its north-west is "the mountain"
  of the nest), and its edge is ragged. It is painted after the herbs and the trees are placed and keeps every tile as
  solid as it was, so no dice of the spawns or the herbs anywhere move; the trees standing on it are taken off, its herbs go
  to the grass west of it, and the boars, wolves and bears of the road that the old dice put on it go to the grass west of it
  (no dice).
- **Its creatures**: 12 desert toads, 9 giant worms (3 of them by the nest) and the nest, with their own dice; none in a
  town, none within 12 tiles of the road's waystation (its fire and its tents) and its guild banner; normal monsters for the
  XP caps. A region of its own (Lv 145+, with the warning for those below it): they do not count for Reidan's recommended
  level, nor for the strength of the invasion of Reidan.
- **Administrator Rabbit**: his Reidan topic now tells of the giant worms (the rumour for the first discovery of the sands);
  a topic of the west once you take his quest (the Hebend River, the nest: the rumour for the second); his word once the
  nest is gone. **Restoring the West** (Lv 150): 12 giant worms, 260,000 XP and 8,000 gold. **The Nest below the
  Mountain** (Lv 155, after it): the nest, 420,000 XP, 15,000 gold and 10 mana stones.
- **First discoveries** (once, after his word): the sands (`lmWSand`, 0.6% of the level and 5 mana stones) and the nest
  (`lmWNest`, 0.6% and 8 ore). The two landmarks quote ch 217, 228 and 230.

## v2.94: Earl Zebra's castle

- **The place**: tiles x 856-884, y 148-163 in the Saharan Empire's farmland south of Titan, below the western road (a zone
  of its own, `zZebra`, Lv 200+): walls with corner towers, a gate to the road, the keep (drawn as a lord's residence); the
  keep's door goes down to **Earl Zebra's underground** (`zZebraU`, an under-map cellar with its cells). Painted after the
  herbs are placed; no spawn's dice cover these tiles; the court's herbs go south of it. Its monsters (by kind, `APART`, with the
  Western Sands') set no town's recommended level and no invasion's strength. The Black Arrows keep to the court's south,
  away from the road.
- **Earl Zebra** before his keep: no gifts; his lines by night and day, while Lauel's errand is yours and after it; his
  topics, his pet and the Black Arrows.
- **Lauel's errand**, The Slaughterer's Eye Patch (Lv 205): defeat the Slaughterer; 700,000 XP, 20,000 gold and the
  **Slaughterer's Eye Patch** (an accessory, Unique, Lv 200 to wear: damage +3%, +4% at its Unique rating; Vital Spot Detection: critical
  chance +8%), once. The quest arrow follows the Slaughterer (the keep's door from outside). No title.
- **First discovery** (once, with the errand): the castle's landmark (ch 243's lines).

## v2.95: the Sword Grave

- **The place**: a snow plain among the Glacier Lakes (tiles x 520-556, y -24 to -8; `zSwordG`), its swords drawn on it (420
  of them, and the twelve that matter, larger and pale-ringed, their numbers shown near); no tile changed, so no dice move.
  Skunk's camp (a campfire) at its west.
- **The puzzle** (`S.books.swgp`, `swgd`): turn the swords in order (the first nearest the camp), each left or right: the
  right turn raises the plain a step; the wrong one sets every sword back (the hill sinks); out of order nothing moves.
  Solved, the plain is a hill with a door: the gate (`swg`) shows and opens for you only; a first discovery (2% of the level,
  4 mithril).
- **The glacier** (`zSwordGU`, Lv 300+): 1.2% of your health each second (not through invulnerability, nor while a dialog
  is open); whoever is there without having solved it (a recall to someone inside) is put back on the surface, and the
  coffin gives nothing to them. Dying anywhere under the map now wakes you in the town nearest its way out. The coffin of ice at its end: Braham's body and
  Pagma's late works; **Pagma's Late Work** (a Legendary sword, Lv 320) once. Braham's Successor and Pagma's Successor have
  their own line there.
- **Skunk**: takes gifts; his topics, the grave, the order (the first three swords' ways), a year and four months.

## Tests

`tests/regression/swordgrave.test.cjs` (2, v2.95): the puzzle in order, a wrong turn setting all back, out of order
nothing, solved once and the grave open; the gate sealed before, the glacier's cold, Pagma's Late Work once, Skunk's hints.

`tests/regression/zebra.test.cjs` (2, v2.94): the castle (zones, walls, gate, keep), the way down and up, the Black Arrows
and the Slaughterer where they live, Earl Zebra; their moves; the eye patch from Lauel's errand once and its Vital Spot
Detection; the first discovery; Earl Zebra's word.

`tests/regression/wsands.test.cjs` (4, v2.93): the sands (tiles, the road, the zone), their creatures where they live and
not in a town, the road's beasts moved off; the worm under the sand and up, its ring, the nest's guard and its waking, the
toads; Rabbit's two rumours and discoveries once, his two quests (no title), his word after. A region of its own: Reidan's recommended level and
its invasion's strength stay Reidan's, the waystation is clear, a worm too far from home goes back, the nest calms down.

`tests/regression/wcastle.test.cjs` (4, v2.92): the castle and its room (no other room moved), Irene there only once
home; Steim's words, his son-in-law, Winston's honour, the oath once (no title); Irene's thanks once (no title), gifts; Rabbit's call in its
three kinds once a day (every errand and material comes up over two months), his past; Irene still right after
Continue; Lauel talks as before unless he has the ledger.

`tests/regression/npclife2.test.cjs` (4, v2.90): Han Seokbong's lines, his warning, his words once, Pangea's ranks; the
sea road to Cork Island and the guest's honour once (no title); Doran's lady topic, his word, Kesan Canyon, the shadow's word (no title); Ashur's
Irene lines as Earl Steim's daughter.

`tests/regression/npclife.test.cjs` (7): Khan's lines and his words once; a word kept until it is said; topics, choices
remembered, affinity once, trust locks, gifts not spammable; a rumour then the place, a discovery once and kept through
a reload; the field work, the farmer's word, the burrow, Piaro's refusal mended, the night quest (spawn at night only,
dawn sends her back and takes her monsters out of the world, completion); the monsters spawn outside the towns; the
monsters' rules (underground, a companion's blow, the swarm's bats, the shell).
