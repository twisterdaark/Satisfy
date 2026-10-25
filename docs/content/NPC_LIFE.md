# NPC life, first discoveries and the field's secret quest (v2.88, 2026-10-25)

Owner's request (2026-10-25, encyclopedia §93-§95; the player Suki: "some NPCs are boring and say little, add secret
quests and a reward for meeting people and exploring"): depth for people who already exist, through the systems that
already exist. Nothing new is saved: `S.met` (what was said and chosen, as `S.met['who#key']`), `S.aff` (the gifts'
affinity, tiers 30/60/90), `S.rep` (the town's ranks), `S.qs`, `S.books` (the discoveries), `S.dly` (the day's field work).

## Provenance

| What | Source | Label |
|---|---|---|
| Khan, the Winston blacksmith | ch 1-30 | the person CANON; every line ORIGINAL_SIDE_STORY |
| Earl Ashur of Patrian, his daughter Irene | ch 1-60 | the person CANON; every line ORIGINAL_SIDE_STORY |
| Piaro, the farmer who once held a sword | the novel's Piaro | the person CANON; every line ORIGINAL_SIDE_STORY |
| The farmers' field work and their affinity opening a hidden quest of a special character with low odds | ch 856 (Agriculture Development) | the mechanic CANON |
| The Field at Night (the Burrow Queen in Piaro's field) | written for the game | ORIGINAL_SIDE_STORY |
| Huroi's secret quest (ch 32-33: the orator, Apostle of Justice, Unbreakable Justice) | ch 32-33 | already in the game (`apjus`), not built again |
| Administrator Rabbit's Call (ch 856) | ch 856 | not built: no Rabbit in the game yet |
| Khan's grandfather's vein, the cave at the northern end | landmarks already in the world (`lmMine`, `lmNEnd`) | the places existing; the stories ORIGINAL_SIDE_STORY |
| Field Burrower, Burrow Queen, Bandit Scout, Echo Bat Swarm, Mossback Snapper | written for the game | GAME_ORIGINAL (levels are game balance) |

No line is taken from a translation of the novel.

## The people (`NLD` in index.html)

Each of Khan, Ashur, Piaro and the Patrian farmer has:
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

Online: what a screen shows is worked out from shared things (the world clock, where it spawned, its health); in a
group the host's copy leads (`m.led`), and every blow goes out as the game's usual bite so a follower is hurt by the same
blow. A companion's blow goes through the same rules as yours. Spawned last, each kind with its own dice, so older
monsters keep their ids and places.

## Tests

`tests/regression/npclife.test.cjs` (7): Khan's lines and his words once; a word kept until it is said; topics, choices
remembered, affinity once, trust locks, gifts not spammable; a rumour then the place, a discovery once and kept through
a reload; the field work, the farmer's word, the burrow, Piaro's refusal mended, the night quest (spawn at night only,
dawn sends her back and takes her monsters out of the world, completion); the monsters spawn outside the towns; the
monsters' rules (underground, a companion's blow, the swarm's bats, the shell).
