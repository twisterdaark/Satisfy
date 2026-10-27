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
  (`egoMake`). `egoRate` recomputes the rating's numbers from the recipe: attack, `as`/`ms`/`dm`, `mpb`, and the weapon
  passives if it had fewer than the rating gives.
- **Its own dice.** `EGORNG`, so no other roll in the game moves. A recorded run (`simBegin`) reseeds it from the run's seed, so
  a replay stays in step.
- **Icons.** Reaper's Command and Dragon Spirit Strike have their own skill icons (`SKICO`).

## The eight spirits (the owner's numbers)

| Ego | Numbers | Trigger or skill |
|---|---|---|
| Greed `greed` | +20% damage (`dmgMult`), 15% of a critical blow back as health (`lsCap`) | Gluttonous Instinct: 15% that a blow leaving an ordinary foe under 10% health takes the rest (`egoExec`, before the damage is applied, so online it is one blow) |
| Aegis `aegis` | +25% defence (`defV`, which covers magic too) | +15% block and parry: an unguarded blow is blocked to 25% (`egoGuard`); while guarding, 15% more chance that a block is a parry (`egoPar`). Sentient Deflection: once every 15 s, a blow from behind or the side (more than 60° off where you face) lands nothing and is answered with a 100% blow |
| Reaper `reaper` | +20% critical damage, +10% penetration | Reaper's Command `egreap`: 350% dark around you (84 px); ordinary foes flee for 5 s (`m.flee`, `m.fear`), a boss staggers 0.6 s. 60 s, 40 MP |
| Frostfang `frost` | +20% attack speed (`atkCD`), +15% cold (the `water` element: ice, frost, snow, cold skills) | Sentient Precision: +2% critical chance for each hit after the first on the same foe, up to +20% |
| Whispering Archmage `arch` | +25% magic (`rzAtk`'s rule: a skill of a mage or with an element), -10% skill cooldowns | Auto-Cast Reflex: 10% that an attack skill casts again 0.35 s later, free, at half strength |
| Dragon King `dragon` | +20% damage, +15% penetration | Dragon Spirit Strike `egdrag`: 300% through every foe on a 240 px line, and they take 20% more for 8 s (`m.egDefU`). 90 s, 50 MP |
| Phantom Stalker `stalker` | +25% move speed | Shadow Guard: 12% that a killing blow finds you in stealth, untouchable for 1.5 s; once every 3 minutes |
| Iron Monarch `monarch` | +30% strength (`stat('str')`) | +20% guard break: a soldier's guard fails a fifth of the time (`egoGb`). Crushing Weight: every third basic swing knocks its targets down 1.5 s (a boss 0.4 s) |

### How some of these are read

- **Penetration** works like the races' armour penetration. Against a stronger foe the level-gap penalty `lvF` counts for
  less: `×lvF^-pen`.
- **Cast speed.** Spells here have no cast time, so Frostfang's "cast speed" has nothing to act on beyond the attack speed (a
  staff's attacks use `atkCD` too).
- **Defence down.** Monsters have no defence stat in the damage formula, so Dragon Spirit Strike's 20% defence cut is 20% more
  damage taken from you.
- **The echo** applies only to attack skills (`skKind==='atk'`). Re-casting a buff, a heal or a summon "at 50%" has no clear
  meaning here. An echo runs the skill as `castSk` does, through `skCarry`. `egoEchoRun` swaps `setTimeout` so every later step
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

  It binds a random spirit and announces it. The feed and log now show the item's final rating.
- **Pagma's Successor.** The anvil has "Bind a weapon spirit" (`fEgo` → `egoForge`), for Pagma's Successor only:
  1. Choose one of your weapons without a spirit (the best ten).
  2. Choose the spirit.
  3. Confirm.

  `egoCraft` needs Lv 51 or more. It calls `epLvDown(50)`, so unspent points go first, then stat points from the highest stat.
  The weapon is marked `egc:1`, and its tip says so.

## A fix on the way

`bChestGive` could roll a rating of 5 (`Math.min(5,r)`), but `MULT` has five entries (0..4), so `mkItem` gave the item an
attack of `NaN`. It is capped at 4 now.

Test: `tests/regression/ego.test.cjs` (5).
