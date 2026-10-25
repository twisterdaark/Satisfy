# A weapon's Endurance (v3.07)

Requested by the player Suki through the owner (2026-10-25 22:27):

> Each weapon now has a new stat attached to it called: Endurance. The more you repair a weapon the higher endurance it
> gains. Endurance reduces the rate at which a weapon breaks down and you have to repair it again. To level endurance you
> can repair it to gain some endurance and you can also with a new option called "strengthen" use gemstones to make the
> weapon have overall more endurance. Endurance may also prevent your weapon from breaking if at high levels and restore
> 25% of it's durability.

This is GAME_ORIGINAL.

## Points and levels (`i.edr`, `EDRT`)

Every weapon (`slot 'w'`) keeps its own endurance in `i.edr`, counted in durability given back. `EDRU` = 25 of it make a
point, and the points give a level from 0 to 10. In Arabic it is «الصمود», because «التحمّل» is already the Stamina stat.

| Level | Points |
|---|---|
| 0 | 0 |
| 1 | 5 |
| 2 | 15 |
| 3 | 30 |
| 4 | 50 |
| 5 | 80 |
| 6 | 120 |
| 7 | 170 |
| 8 | 230 |
| 9 | 300 |
| 10 | 380 |

The endurance stays with the item, so it is saved, traded and stashed with it. A traded weapon's endurance is clamped to
0–9,500 (`tradeItemIn`).

## Gaining it

- **A repair** (`edrRep`) adds exactly the durability it gives back. Ten small repairs are worth one big one: the review
  found that a floor of one point made a repair of 1 durability worth 25 times its share. Repairs that count:
  - a smith's or the anvil's repair (`repairAll`);
  - a player smith's repair order;
  - the repair skills (`srep`, `lrep`).

  Armour gets nothing.
- **Strengthen** (`edrMenu`), at any smith (`svcOpts`) and on the anvil's 💎 button (the anvil's buttons wrap on a narrow
  screen): pick one of your weapons (the one in your hand first), then one gem. Armour is never offered.
  - It costs 1,000 gold (`EDRG`, after the shop discounts).
  - It gives 10 points, or 20 for a diamond or a thunderstone.

## What it does

- **Wear** (`wear`): the chance to lose durability is ×(1 − 0.05 × level), so half at level 10.
- **Holding** (from level 7): when a hit would bring the weapon to 0, it holds with a chance of 15% for each level past 6
  (60% at level 10). It comes back to 25 durability with the toast "… held and did not break".

The weapon's tooltip shows its level, the points to the next one, the slower wear and the chance to hold. The Index's
smithing guide has a line on it.

`tests/regression/endurance.test.cjs` covers it.
