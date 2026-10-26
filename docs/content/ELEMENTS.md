# Elemental resistance and monster defence (v3.16)

The owner (2026-10-26): "make elemental resistance as in the novel"; "make the game 1:1 with the novel as far as you
can". Until v3.16 the game's monsters had an attribute (`BEL`: the Four Beasts, the elementals, Belial...) that only
shaped their own attacks and the breath protections (`BTHK`); nothing resisted a player's attribute.

## The attributes

The game's attributes are BEL's: fire, water (ice is water here, as the Ice Elemental is), thunder and earth, plus wind,
holy, darkness and poison. A monster's own attribute is `BEL[k]`, or `MELX[k]` for monsters BEL doesn't list (the
Frostlight Orcs and the Eti are water, the wyverns wind, the Half-Draconians fire).

## A monster's resistance (`monResK(type, attribute)`, GAME_BALANCE numbers)

- It resists its own attribute by 50%; an elemental made of it (`ELEMT`) by 80%.
- It takes 30% more from the attribute that beats its own (`ELBEAT`): water beats fire, thunder water, earth thunder,
  wind earth, fire wind.
- The undead, the demons and the vampires (`monEvil`) resist darkness by 50% and take 40% more holy damage.
- The undead, golems and elementals are immune to poison.
- The result is kept between −60% and 100%.

## A blow's attribute (`skEl(skill)`)

- A skill's attribute comes from its name, matched as whole words (Fireball fire, Lightning Fist thunder, Ice Prison
  water, Holy Light holy, Curse dark, Poison Blade poison), or from the `SKELX` table.
- A plain blow has none, and a passive or buff has none.
- A projectile keeps the attribute of the skill that shot it. A fire bolt with no skill behind it is fire.
- The Demon Slayer's skills and the Saintess' Holy Impact keep the novel's own numbers against evil. They get no extra
  weakness on top, so `SKELX` sets them to none.

`elDmg(m, o)` in `hitMon` multiplies the damage by `1 − resistance`. A hit marked `pure` (Kill Peak) skips it. The first
direct hit every 1.5 s shows "{attribute} resisted" (50% or more) or "Weak to {attribute}!".

The Sword Saint's Body as a Blade (the owner's design): under 30% health, a sword ignores half of the resistance. Until
v3.16 it ignored half of a raised guard instead, because there were no resistances. A guard is a guard again.

## Defence (`monDef(m)`)

CANON: monsters have defence. The Condemnation Sword hits with "attack power equivalent to 100% of the target's defense"
(ch 772).

- A monster's defence is its table's `def`, or half its attack when the table has none.
- The game's damage still comes from the level gap (`lvF`). Defence is shown in the Index and used by the skills that
  read it.
- **Condemnation Sword** (`sscond`, the Sword Saint's, level 250, 90 MP, 60 s cooldown, a sword): one cut of 800%, with
  your attack raised by the target's whole defence (`hitMon`'s `addAtk`).

## The Index

Every monster's page shows "Defence N · Resists: ... · Weak to: ..." (`mbResLine`).

## Tests

`tests/regression/elements316.test.cjs` checks:
- the numbers, and the skills' attributes;
- a fire elemental taking a fifth of a fire blow, and 30% more from water;
- Body as a Blade's half;
- the Condemnation Sword growing with the target's defence.
