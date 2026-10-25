# XP balance: the caps (v2.87, 2026-10-25)

Owner's request (2026-10-25, encyclopedia §96, which supersedes §88): Level 480 should be an achievement, a level near
480 a few hours of varied play (2 to 4 as a first target), not a wall and not a time gate. The XP needed per level
(`xpNeed`), the player's level, stored XP, gear and points are untouched; what changes is how much one source can give.

All numbers here are GAME_BALANCE, not the novel's. Where the novel fixes a reward (a level grant, a special effect) it is
given exactly as before (`gainXP(n, 1)`, no cap).

## The caps (after every multiplier)

The final XP of one reward, after XPMUL (1.2), the XP buff, Marn, the season bonus, titles, pets and the level gap, is at
most a share of the XP the player's current level needs (`XPC` in index.html, `xpCapP`):

| Source | Below 100 | 100-199 | 200-299 | 300-399 | 400-479 | 480+ |
|---|---|---|---|---|---|---|
| Normal monster (`mob`), a spar | none | 2.0% | 1.5% | 1.1% | 0.9% | 0.8% |
| Elite (`elite`) | none | none | none | none | eased | 2.5% |
| Boss, first win (`boss1`) | none | none | none | none | eased | 10% |
| Boss again (`bossR`) | none | none | none | none | eased | 1.5% |
| Repeatable quests, dailies, the Tower's daily test, the arena, an event's reward (`rquest`) | none | none | none | none | eased | 2% |
| Story and secret quests (`squest`) | none | none | none | none | eased | 8% |
| The Tower's weekly watch (`weekly`) | none | none | none | none | eased | 12% |
| Charting a zone the first time (`disc`) | none | none | none | none | eased | 1.5% |

"Eased": from level 400 the cap comes in a little at a time, from 70% of a level at 400 down to the 480 value
(`v * (0.7 / v) ^ ((480 - L) / 80)`), so there is no wall at 480. At 440 a story quest is at most 23.7% of the level, at
460 13.8%, at 470 10.5%.

A reward under its cap is exactly what it was (nothing is raised). Below level 100 nothing changed at all.

- **Elite**: a non-boss worth five times or more the median XP of the other monsters within 15 levels of it (with fewer
  than three of those, 3% or more of its own level's need, from level 200).
- **Boss, first win**: the first kill of that boss type on this character (`S.bfc`, and any earlier kill in `S.kills`
  counts as the first already). A second kill of the same boss within 45 s (`S.bkt`, kept in the save) is the same kill
  and gives no XP: a disconnect and reconnect, or a reload, cannot claim it twice. Drops and quest credit are unchanged.
- **Party share** (25% to members near a kill) is capped by the same kind as the kill; bosses still share nothing.
- **The inn's rest** doubles a kill only as far as its cap leaves room, and the rest is not spent beyond that.
- **Not capped** (exact grants, the novel's or a special effect): Behen's purification levels, the Madra book, the
  East Continent's Arube choice, levels from a legendary class quest.

## Before and after (`node tools/xppace.cjs`)

Model, stated by the tool: a character of the level with the best melee weapon and armour it may wear, stats of its
level, basic attacks only (skills only make a kill shorter), 4 s between kills (walking to the next, pulling it), the
best normal monster for XP an hour (bosses, elites and the rare critters that never fight left out), the kill XP the game
really gives, the average of 200 real hits. A party of four kills four times as fast; each member lands a quarter of the
kills and gets the 25% share of the others'.

### Normal monsters, solo and in a party of four

| Level | XP needed | before: monster, % a kill, h/level solo, party | after: monster, % a kill, h/level solo, party |
|---|---|---|---|
| 150 | 385,652 | wraith 3.42%, 0.07 h, 0.09 h | wraith 2.0%, 0.12 h, 0.16 h |
| 250 | 3,208,010 | Red Knight 2.24%, 0.27 h, 0.24 h | Old Golem 1.5%, 0.37 h, 0.34 h |
| 300 | 6,493,825 | Royal Archer 0.88%, 0.39 h, 0.44 h | the same (under its cap) |
| 400 | 22,046,308 | Noble Vampire 1.63%, 0.46 h, 0.38 h | Abyss Prisoner 0.87%, 0.47 h, 0.49 h |
| 450 | 38,405,440 | Immortal Ghost 1.03%, 0.56 h, 0.50 h | Immortal Ghost 0.9%, 0.64 h, 0.58 h |
| 479 | 48,940,587 | Immortal Ghost (470) 0.59%, 1.10 h, 0.95 h | the same (under its cap) |
| 480 | 49,338,544 | Immortal Ghost (470) 0.56%, 1.19 h, 1.02 h | the same (under its cap) |
| 500 | 57,816,720 | Immortal Ghost (470) 0.07%, 7.2 h, 6.9 h | the same: no normal monster above 470 |

At 480 the normal monsters were already under the 0.8% cap, so grinding there is as it was: about 1.2 h a level in the
model. Real play is slower (travel, rests, deaths, repairs, bag trips) and faster with skills; the caps alone cannot make
it 2 to 4 h without lowering rewards that are under them, which the request rules out. At 500 the problem is the
opposite: nothing normal stands above 470 (see v2.89, the Fourth Ridge).

### Bosses: one kill, the first time and again

| Player Lv | Boss (its Lv) | before: first / again | after: first / again |
|---|---|---|---|
| 400 | True Blood Earl, city 6 (400) | 70.8% / 70.8% | 70% / 70% |
| 400 | Hydra (480), Belial (480), Fenrir (490), Marie Rose (470), the city 3 earl (445), Berith (450) | a level or more each time | 70% / 70% |
| 400 | fourth Sanju (500) | two levels each time | 70% / 70% |
| 480 | True Blood Earl, city 6 (400) | 3.16% / 3.16% | 3.16% / 1.5% |
| 480 | True Blood Earl, city 3 (445) | 4.38% / 4.38% | 4.38% / 1.5% |
| 480 | Berith (450) | 4.86% / 4.86% | 4.86% / 1.5% |
| 480 | Marie Rose (470) | 40.9% / 40.9% | 10% / 1.5% |
| 480 | Belial (480) | 63.2% / 63.2% | 10% (4,933,854) / 1.5% (740,078) |
| 480 | **Hydra (480)** | **60.8% / 60.8%** | **10% / 1.5%** |
| 480 | **Fenrir (490)** | **88.5% / 88.5%** | **10% / 1.5%** |
| 480 | fourth Sanju (500) | 94.9% / 94.9% | 10% / 1.5% |

The bosses' levels, health, drops and quest credit are unchanged.

### Quests at their own level

| Quest | Lv | before | after |
|---|---|---|---|
| East Continent chain ea0-ea10 | 300-360 | 55-147% of a level | the same (no quest cap below 400) |
| gj10 (main story) | 400 | 65.3% | 65.3% (under the eased 70%) |
| gj11 | 440 | 68.2% | 23.7% |
| gj13 | 450 | 93.7% | 18.0% |
| gj15, ti4 | 460 | 91.8%, 86.1% | 13.8% |
| gj16 | 470 | 89.7% | 10.5% |
| gj17 (main story, Belial) | 480 | 121.6% | 8% (3,947,084) |
| a daily at 480 | 480 | its table XP | at most 2% |

### Other sources at 480 (before, after)

| Source | before | after |
|---|---|---|
| Sparring a townsperson (repeatable) | 3.6% a win | 0.8% (a fight: the normal cap) |
| The Tower's daily test | 2.4% | 2% |
| The Tower's weekly watch | 30% | 12% |
| Arena champion | 2.2% | 2% |
| Charting a new zone | 7.2% | 1.5% |
| An event's reward (half the event's XP) | unbounded | 2% (the event's kills are capped one by one) |
| First discoveries (v2.88) | 0.4-1% once | the same (under §95's 0.2-1.5%) |

## Saves

No save is converted. `S.lv`, `S.xp`, `S.pts`, gear and items load exactly as they were (test: *a level 480 save loads as
it was*). Two new durable fields: `S.bfc` (the bosses beaten once, for the first-win cap) and `S.bkt` (the time of the last
boss kill per type, for the 45 s rule).

## Tests

`tests/regression/xpcap.test.cjs` (the bands, the first and repeat boss, the 45 s rule across a reload, the inn's rest,
quests and dailies, exact grants, the 480 save), `levelpace`, `partyxp`, `raid`, `raidloot`, `save`, `bosssync`,
`nanguard`, `gradnan`, `reputation`, `balance`, `innrest`, `dailyweek`, `bossscale`, `worldboss`, `belial`, `berith`.
