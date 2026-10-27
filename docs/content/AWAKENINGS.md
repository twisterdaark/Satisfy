# Awakenings (v3.72; 2026-10-28)

The owner, 2026-10-27 23:50: "Awakenings are major progression milestones that permanently boost character growth. These
awakenings serve the player as tiny buffs to make them reflect their power. Each awakening gives players an aura around
themselves. The color is randomized tho the appearance is different for each higher awakening, growing in size and effect. Add a
toggle to disable the aura (Visually) for anyone who does not like it, in the equipment menu."

## Tiers (`awk*`, GAME_BALANCE as the owner gave them)

| Tier | Reached | Gives |
|---|---|---|
| 1 First | Lv 100 | +5% all attributes (`stat`), +5% move speed, Combat Vitality: 1 HP and 1 MP a second in combat |
| 2 Second | Lv 200 | +5% physical and magic attack (`dmgMult`), -5% skill cooldowns (`skCdM`), Limit Break: 8% to shrug off CC |
| 3 Third | Lv 300 | +5% core stats, -10% skill mana (`mpC`), Supreme Poise: the guard loses 10% less per blow |
| 4 Fourth | Lv 400 | +8% core stats, Overwhelming Aura: foes within 110 px take 5% more |
| 5 Absolute | Lv 999 | +5% true damage on every blow, the skill World of Transcendence |

- **Stacking.** Every tier's numbers add up. Attributes are 1.05 + .05 + .08 = ×1.18 at the fourth.
- **Combat Vitality.** "Tiny buffs": one point of each, as written. In combat means you struck or were struck in the last 5 s
  (`P.hitT`, and `P.awkCt` set by every blow you strike).
- **Limit Break** works through `legResist()`, so it covers the stun, root, chill and other CC the game already lets a
  legendary resist. It uses its own random stream (`AWKRNG`), so the game's dice don't move.
- **Supreme Poise.** This game has no posture meter, so "posture gain" is the guard gauge (`P.gd`), which a blocked blow
  drains. `awkGdM` multiplies it like `rzGdM`.
- **Overwhelming Aura.** Monsters here have no defence stat in the damage formula. "5% defence" is applied as 5% more of your
  damage against a foe within 110 px.
- **True damage.** 5% of the blow ignores the level gap: the multiplier is `1 + .05/lvF`, so it's +5% at an even level and more
  against a stronger foe. Pure, raw and no-level hits are already gap-free, so they get exactly +5%.
- **World of Transcendence** (`awkworld`, an `SKD` entry with `awk:5`, on the bar from the absolute tier): +25% move speed and
  +15% critical chance for 4 s, with a 180 s cooldown and no mana cost.

## Kept, and the max level

`S.awk` keeps the highest tier reached, so `awkTier()` is the larger of `S.awk` and the tier your level gives. Losing a level on
death, the Hermit of Oblivion, or a legendary class's new Lv 1 keeps it.

`LVMAX=999`. The presence, balance and cloud rules and the network contracts already stopped at 999. `gainXP` now does too, and
past it the bar stays just short of a level.

## Reaching one

`awkTick` (in `p3Tick` beside the races) announces a new tier once you have been out of combat for 5 s and no dialog is open.
The window lists every new tier's numbers: an old save at Lv 450 gets the first four at once. Each awakening rolls the aura's hue
(`S.awc`, 0..359) from `AWKRNG`.

## The aura

`awkDraw(x,y,T,hue,alpha)` draws under the character (before the horse and the enhancement glow), from `gTime` only, with
`lighter` compositing:

| Tier | Aura |
|---|---|
| 1 | a glow at the feet |
| 2 | adds a ring and motes rising |
| 3 | adds a circle of sparks turning |
| 4 | adds a light up the body |
| 5 | adds a pillar and a faster outer circle |

Each tier is wider than the one before.

**Online.** `fx` carries `ak:<tier><hue in base 36>`. `fxIn` checks it against `/^ak:([1-5])([0-9a-z]{1,2})$/`. Nothing is sent
while you are stealthed or hiding auras. Others draw it under you unless you are dead or stealthed, or the viewer hides auras. No
rules or contracts change: `fx` is free text up to `FX_MAX`.

**The switch.** The equipment window's info line shows the awakening reached and a button (`data-awkv`) that sets `S.awh`. It
hides every awakening aura on your screen, yours too, and stops sending yours. The boosts stay. The status window has an
"Awakening" row whose tip lists every tier reached.

## State and tests

`S.awk`, `S.awc` and `S.awh` are durable (`src/core/state.js`). The harness sets `window.__awkPlain` so the older tests keep their
numbers at any level, as `__rzPlain` does for races. `tests/regression/awaken.test.cjs` (3) deletes it.
