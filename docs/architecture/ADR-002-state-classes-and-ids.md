# ADR-002 — State classes, stable ids, domain events

- **Status:** Proposed (SAT-ONLINE-005, issue #16)
- **Owner:** Claude-A
- **Plan doc:** §05 R0.4 (durable/volatile split), R0.5 (stable ids, a UUID per craft/kill/claim),
  gate R0.6 (single player intact, old saves load, no duplicated rewards, no auth offline);
  §26 PR3 (state adapters); §10 (quest credit as domain events, idempotent rewards).

## Context

Everything the game keeps lives in one object `S` (saved) plus `P` (the player body) and a set of
UI globals. An online version has to know, for every field, who owns it: the character's cloud
profile, this device only, or nobody (UI). Without that list, the first sync either uploads
cooldowns and a raid flag as "truth" or silently drops progress.

Items had only a local counter id (`uid`, 1, 2, 3, …). Two characters on two devices both own
"item 2", so the number can't key an item on a server. Kills, crafts and quest turn-ins happened
as direct state changes with no id, so nothing could tell a retried request from a new one.

One concrete duplication existed already: `completeQ()` paid again if it ran twice (a dialog
callback firing twice, a double click on the quest board), and it took materials even if they had
been sold while the dialog was open.

## Decision

1. **Classes** (`src/core/state.js`). Every `S` key is `durable`, `session` or `meta`
   (lists in the file). `P` is volatile, UI state is ephemeral, `WS` is world state. Unknown keys
   are treated as durable. A unit test scans `index.html` and fails if a key the game writes is
   not listed, so adding a key is a one-line, reviewed decision.
2. **One character id: `S.pid`.** Claude-B's guilds (SAT-GUILD-001) already created `S.pid` on
   first use. Rather than add a second id, `Satisfy.ids.ensure(S)` now gives every character a
   `pid` at its first save or load and never replaces an existing one.
3. **Item ids are derived, not random:** `iid = 'it_' + pid + '_' + uid`. The numeric `uid` stays
   the in-game reference (equipment slots point at it) and becomes the legacy id the doc talks
   about. Because the id is a function of data already in the save, backfilling is idempotent: an
   old save that is loaded twice before its next save gets the same ids both times.
4. **Domain events** (`src/core/events.js`): `monster.kill`, `craft.item.created`,
   `quest.reward.claimed`, each with a UUID request id and, where the game has a natural counter,
   an idempotency key (`pid:kill:<type>:<count>`, `pid:craft:item:<uid>`, `pid:claim:<quest>`). An
   emitter drops a key it has already seen. The log is in memory only. Nothing reads it for
   gameplay yet; it is the shape a server ledger (§26 PR10) will consume.
5. **Quests pay once:** `completeQ()` starts with `claimQ(id)`, which requires the quest to still be
   active and ready. A characterization test shows the baseline paying twice.

## Consequences

- No save format change and no schema bump: `pid` and `iid` are additive fields. Older builds keep
  them when they re-save (rollback test).
- Golden comparisons with the baseline ignore `S.pid` and `item.iid` (random per character);
  `tests/regression/ids.test.cjs` checks them directly.
- Claude-B: a new `S` key needs one line in `src/core/state.js`; the failing test says which key.
- Not done here: moving rewards to a server, persisting the event log, or deduplicating repeatable
  quest claims (their key is `null`; the quest state itself already prevents a double payout).
