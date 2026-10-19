# ADR-001 — Local save storage, schema version, backups

- **Status:** Proposed (SAT-ONLINE-001, issue #1)
- **Owner:** Claude-A
- **Baseline:** `main` @ `ce297728037e368fbfc5a9dce3e5d3eaefd3e17a`

## Context

The save lives in `localStorage['satisfy_proto_v4']` as `{S, P}`. Patch 4 raised the schema to
`S.v = 5` and kept the key, migrating v4 → v5 inside `load()`. History of the key:

| Commit | Key | Schema |
|---|---|---|
| `f7b5465` … `bd18940` (v0.1 – Patch 2) | `satisfy_proto_v1` … `v3` | no `S.v` |
| `a56c7ee` (Patch 3) | `satisfy_proto_v4` | 4 |
| `2550988` (Patch 4) → `ce29772` | `satisfy_proto_v4` | 5 |

Reviewing `load()`/`save()` on the baseline found that the key name itself is harmless (the
real version is `S.v`), but three paths lose player data. Each is reproduced by a regression
test that fails on the baseline (`tests/regression/save.test.cjs`, run with
`SATISFY_HTML=<baseline>`):

1. **Failed load → overwrite.** If `load()` fails (unparseable JSON, or an exception in
   `regBQ`/`buildMe`), `startGame` falls back to `freshState()` and the 20 s autosave writes the
   fresh game over the only copy of the old save.
2. **Migration without backup.** v4 → v5 refunds stats and moves the player; the original v4
   save is overwritten at the next save.
3. **Newer schema overwritten.** A save with `S.v > 5` (opened by an older cached build) is
   loaded best-effort and rewritten in the older shape.

## Decision

1. **Keep the key `satisfy_proto_v4`.** The name is historical; the schema is `S.v`.
   Renaming would need dual reads/writes and a precedence rule between two keys, and a
   rollback to an older build would read a stale key. Keeping it means any build, old or new,
   reads the same save. The key changes only when the online profile becomes canonical (R1).
2. **Version inside the payload.** Saves are still `{S, P}` (older builds read only these) plus
   `fmt: 1`, `schema: S.v`, `savedAt` (ms). `tests/regression/golden.test.cjs` proves a save written by
   this build loads unchanged in the baseline build (rollback path).
3. **Backups before any risky write**, verbatim, under `satisfy_proto_v4.backup.<reason>`:
   - `corrupt` — the save could not be decoded or `load()` threw.
   - `from-v<N>` — the save is being migrated from schema N (e.g. `from-v4`).
   - `newer-v<N>` — the save is from a newer schema N.

   The first copy per reason is kept and never replaced, so a later failure cannot overwrite the
   most valuable data. The live save key is never deleted by this code.
4. **Migration ladder** in `src/core/storage.js` (`STEPS`). Each step upgrades `S`/`P` in place and
   sets `S.v`. Game-specific values come through a context (`PTS_LV`, spawn point, `maxHP`), so the
   v4 → v5 step is byte-for-byte the original logic, and the golden test confirms the result matches
   the baseline.
5. **Classic scripts, no build step.** `src/core/storage.js` and `src/net/contracts.js` load with
   `<script src>` before the game script and attach to `window.Satisfy`. ES modules would break
   `file://` play (CORS); a bundler is not needed yet.

## Consequences

- No gameplay change: golden state, v4 migration result and rendered pixels match the baseline.
- Recovering a backup is manual for now (copy the backup value into the save key, e.g. from
  DevTools). A small in-game "restore backup" option can come later if players need it.
- `S` still mixes durable and run-time fields; splitting it (R0.4) and stable item ids (R0.5) are
  next, and must keep the same save format or add a ladder step.
- A malformed save with no `S` object is now treated as corrupt (backed up, fresh game). The
  baseline accepted it as an empty state with the saved `P`; both start a fresh game.
- The game now needs its `src/` folder next to `index.html` (true on GitHub Pages and in a clone).

## Not done here (follow-ups)

- Backup before *New Game* overwrites an existing save (player-initiated; needs a UX decision).
- Pruning old backups (each is a few KB; not needed yet).
- Old keys `satisfy_proto_v1..v3` are left untouched; those saves predate character creation.
