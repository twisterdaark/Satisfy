# Sentient weapons, the egos (v3.73; 2026-10-28)

The owner, 2026-10-27 23:50: "Sentient Weapons (Ego Weapons) are legendary, living gear. They grant unique passive traits,
combat triggers, and active abilities. Players may only equip 1 Sentient Weapon at a time. These weapons will always be
legendary or 'Unique' rarity ... An ego weapon may replace a normal weapon drop with a 0.5% drop rate. Pagma's successor may be
able to craft an ego weapon but it will cost them 50 levels per weapon. Ego's are permutations to any weapons."

## What an ego is

`it.ego`: one of `EGOK`, on any weapon (`slot:'w'`). The ego is a string field, so trades, the ground, the guild vault and links
keep it (`tradeItemIn` copies strings of 40 characters or less). An item that names an unknown ego does nothing.

- **One in hand.** Only `weapon()` counts (`egoOf`). The game has one weapon slot, so only one is ever equipped; a spirit in
  the bag does nothing.
- **Rating.** A weapon that takes an ego is raised to Unique (3) at least, and a quarter of the time to Legendary (4)
  (`egoMake`). `egoRate` scales what the piece already has by the ratings' ratio, so a crafted bonus, a creation's numbers or
  a breath feat stay:
  - attack and `mpb` by `MULT[new]/MULT[old]`, and `as`/`ms`/`dm` the same way at half strength;
  - adds weapon passives up to what the rating gives;
  - raises the sockets to the rating's least.
- **Only the eight.** `egoK` checks the name as an own key of `EGO`, so a traded `'constructor'` is no spirit.
- **Its own dice.** `EGORNG`, so no other roll in the game moves. A recorded run (`simBegin`) reseeds it from the run's seed, so
  a replay stays in step.
- **Icons.** Reaper's Command and Dragon Spirit Strike have their own skill icons (`SKICO`).

## The eight spirits (the owner's numbers)

| Ego | Numbers | Trigger or skill |
|---|---|---|
| Greed `greed` | +20% damage (`dmgMult`), 15% of a critical blow back as health (`lsCap`) | Gluttonous Instinct: 15% that a blow leaving an ordinary foe under 10% health takes the rest (`egoExec`, before the damage is applied, so online it is one blow). Not a boss, a world boss, anything of 5 million health or more, or the Behengo crown (only critical hits and skills hurt it) |
| Aegis `aegis` | +25% defence (`defV`, which covers magic too) | +15% block and parry: an unguarded blow is blocked to 25% (`egoGuard`); while guarding, 15% more chance that a block is a parry (`egoPar`). Sentient Deflection: once every 15 s, a blow from behind or the side (more than 60° off where you face) lands nothing and is answered with a 100% blow |
| Reaper `reaper` | +20% critical damage, +10% penetration | Reaper's Command `egreap`: 350% dark around you (84 px); ordinary foes flee for 5 s (`m.flee`, `m.fear`), a boss staggers 0.6 s. 60 s, 40 MP |
| Frostfang `frost` | +20% attack speed (`atkCD`), +15% cold (the `water` element: ice, frost, snow, cold skills) | Sentient Precision: +2% critical chance for each hit after the first on the same foe, up to +20% |
| Whispering Archmage `arch` | +25% magic (`rzAtk`'s rule: a skill of a mage or with an element), -10% skill cooldowns | Auto-Cast Reflex: 10% that an attack skill casts again 0.35 s later, free, at half strength |
| Dragon King `dragon` | +20% damage, +15% penetration | Dragon Spirit Strike `egdrag`: 300% through every foe on a 240 px line, and they take 20% more for 8 s (`m.egDefU`). 90 s, 50 MP |
| Phantom Stalker `stalker` | +25% move speed | Shadow Guard: 12% that a killing blow finds you in stealth, untouchable for 1.5 s; once every 3 minutes |
| Iron Monarch `monarch` | +30% strength (`stat('str')`) | +20% guard break: a soldier's guard fails a fifth of the time (`egoGb`). Crushing Weight: every third basic swing knocks its targets down 1.5 s. A boss only staggers 0.4 s with its attack going on, at most once in 8 s (`m.egKdT`), or it would be stunned nearly all the time. The knockdown rides on that swing's own blows (this frame) and the shots it lets fly (`p.kd`) |

### How some of these are read

- **Penetration** works like the races' armour penetration. Against a stronger foe the level-gap penalty `lvF` counts for
  less: `×lvF^-pen`.
- **Cast speed.** Spells here have no cast time, so Frostfang's "cast speed" has nothing to act on beyond the attack speed (a
  staff's attacks use `atkCD` too).
- **Defence down.** Monsters have no defence stat in the damage formula, so Dragon Spirit Strike's 20% defence cut is 20% more
  damage taken from you.
- **The echo** applies only to attack skills (`skKind==='atk'`) that strike in their own body and touch nothing of yours
  (`egoSafe`).
  - About 89 skills qualify. The body has a blow, blast or shot, and no assignment to `P.*` or `S.*`, no `move(P`, no
    cooldown, mana or loot call, and no hand-off to a dance runner.
  - A dash, a dance, a self-cost or a timed stance never echoes. Re-casting a buff, a heal or a summon "at 50%" has no clear
    meaning here.
  - The skill's cooldown is kept (the larger of before and after), and a raw blow (a share of health) is halved too. An echo runs the skill as `castSk` does, through `skCarry`. `egoEchoRun` swaps `setTimeout` so every later step
  of the skill also runs with `EGOE` set (`egoAtk` halves those blows), and every shot it creates gets half its `mul`. It uses
  no mana and no cooldown, and an echo never echoes.
- **Actives.** `SKD` entries with `cls:'ego'` and `ego:<k>`. `clsSkills` puts one on the bar while that spirit is in your hand,
  and its cache key includes `egoOf()`.

## Where they come from

- **Drops.** `egoDrop(it)` runs on every weapon drop, with a 0.5% chance (`EGOP`):
  - `rareDrop`
  - `namedDrop`
  - both of `bChestGive`'s items
  - `lootWon` (the party roll)
  - the Behengo dark knights' weapons (`bhDKDown`)

  It binds a random spirit and announces it. The feed and log now show the item's final rating.
- **Pagma's Successor.** The anvil has "Bind a weapon spirit" (`fEgo` → `egoForge`), for Pagma's Successor only:
  1. Choose one of your weapons without a spirit (the best ten).
  2. Choose the spirit.
  3. Confirm.

  `egoCraft` needs Lv 51 or more. It calls `epLvDown(50, ptsLv())`, so the points go as they came (15 a level for a legendary
  class, +2 with a second class): unspent points first, then stat points from the highest stat. Without this, a bind and re-level
  cycle left +250 points. The weapon is marked `egc:1`, and its tip says so.

## A fix on the way

`bChestGive` could roll a rating of 5 (`Math.min(5,r)`), but `MULT` has five entries (0..4), so `mkItem` gave the item an
attack of `NaN`. It is capped at 4 now. `egoFix` mends old saves once each: such a piece goes back to 4 with its attack or
defence recomputed.

## Known and left

- Shadow Guard's stealth also gives the next blow the rogue's sneak bonus (`rgAtk`), at most once in 3 minutes.
- Its cooldown and Sentient Deflection's live on `P`, so a reload resets them.

Test: `tests/regression/ego.test.cjs` (6).
