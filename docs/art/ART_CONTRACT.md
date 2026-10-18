# Art contract: characters, monsters, terrain, buildings and VFX (SAT-ART-001)

Owner: Claude-B. Integrator: Claude-A. Status: proposal. Nothing here is wired into `index.html` yet.

## What exists

| File | What it is |
|---|---|
| `sprites-original/chars.js` | Parametric character renderer v2. It reads the same style configs as `figure()` in `index.html` (`FIG`, `lookFig`). |
| `sprites-original/monsters.js` | Monster sheet renderer for the 9 non-humanoid types `drawMon` paints by hand (`wolf pwolf boar bear gbear rabbit golem cgolem guardian`). Colors come from a `PAL` snapshot (PER_CODE); a test fails if it drifts. |
| `sprites-original/tiles.js` | Terrain renderer v2 for the same 15 tile ids as `index.html` (`GR FL PA TR WA CF CW BL WL SN DR RK FW IW PL`), plus new tree trunk and canopy art (green and snowy) |
| `sprites-original/legacy-tiles.js` | Snapshot of today's `drawTile`, `grassTile`, `treeTrunk` and `treeCanopy`. It's used only for the side-by-side preview, and a test fails if `drawTile` drifts. |
| `sprites-original/buildings.js` | Buildings v2 for all 8 kinds (walls, windows with shutters, doors, signs, shingle roofs, chimneys), plus world props (anvil, well, board, tent, grave) and room props (bed, table, chest, shelf, counter, rack, barrel) |
| `sprites-original/legacy-buildings.js` | Snapshot of today's `drawBuilding` and prop code, for the preview. A test fails if `drawBuilding` drifts. |
| `sprites-original/vfx.js` | Data-driven cosmetic VFX presets with a tiny particle engine |
| `sprites-original/fig-data.js` | Snapshot of `FIG`/`LOOK`/`lookFig` from `index.html` @ `ce29772` (PER_CODE). A test fails if `FIG` drifts. |
| `sprites-original/legacy-figure.js` | Snapshot of today's `figure()`, used only for the side-by-side preview |
| `sprites-original/sheets/*.png` + `manifest.json` | Exported sheets: every `FIG` entry plus each player hair style, with and without armor. `sheets/monsters/*.png` are listed under `manifest.monsters`. |
| `sprites-original/preview.html` | Open it locally to see legacy and new side by side, with every VFX preset |
| `sprites-original/tools/export-sheets.cjs` | Regenerates the PNGs and the manifest (Playwright) |
| `tests/content/art.test.cjs` | `node --test`: layout, manifest/PNG sizes, hand anchors, FIG, PAL, drawTile and drawBuilding drift, monster coverage and anchors, tile ids, full opaque tiles, building boxes, doors and roof line, prop coverage, VFX lifecycle |

All scripts are classic scripts that attach to `window.SatArt` (or `globalThis` in Node). They need no DOM to load; only drawing needs a canvas.

## Character sheet layout

- Frame: **16×24**. Anchor: **(8, 24)**, the bottom-centre between the feet. That matches today's `drawChar` (`drawImage(c, x-8, y-24)`), so hitboxes and the shadow position do not change.
- Rows: `d` (front), `u` (back), `s` (side facing right). Left is `s` mirrored, exactly as `drawChar` does today.
- Columns (10): `idle0 idle1(blink) walk0 walk1 walk2 walk3 atk0(windup) atk1(strike) atk2(recover) hurt0`.
- Timing in seconds: `idle [2.6, 0.12]`, `walk 0.11×4`, `atk [0.07, 0.06, 0.09]`, `hurt [0.2]`.
- `hands[dir][pose][f] = {x, y}`: the pixel in frame coordinates where the weapon should be held. Today `weapPix` uses a fixed offset. With hands it can follow the attack arc.

## Proposed adapter (Claude-A's side, for review)

```js
// AssetResolver: sheet frame if available, legacy figure() otherwise (doc D5)
function charFrame(name, dir, pose, f) {
  const S = window.SatArt && SatArt.chars;
  if (S && SHEETS[name]) {                       // SHEETS[name] = S.buildSheet(FIG[name]) or a loaded PNG
    const r = S.rect(DIRK4[dir], pose, f);       // DIRK4 = ['d','u','s','l']
    return { img: SHEETS[name].canvas, ...r };
  }
  return { img: SPR[name][DIRK[dir]][f % 2], sx: 0, sy: 0, sw: 16, sh: 24, flip: dir === 3 };
}
```

- The player look can be rebuilt on demand: `SatArt.chars.buildSheet(lookFig(S.look, armored))`. That replaces `buildMe`.
- Pose selection stays in the engine: `idle` when still, `walk` while `mvd`, `atk` during `P.slash` / `acd`, `hurt` while `inv > 0`.
- Feature flag suggestion: `S.opt.art = 'v2' | 'legacy'`, default `legacy` until playtested.

## Monster sheet layout

- One row per pose: `idle` (2), `walk` (4), `atk` (2, windup then strike), `hurt` (1). The sheet is 4 frames wide.
- Timing: `idle [0.5, 0.5]`, `walk 0.1×4`, `atk [0.12, 0.16]`, `hurt [0.2]`.
- Each kind has its own frame size and anchor. The anchor is the feet point, and the sheet faces right; flip it for left.

| kind | frame | anchor | scale |
|---|---|---|---|
| rabbit | 16×14 | 8,14 | 1 |
| wolf, pwolf | 36×22 | 15,22 | 1 |
| boar | 38×20 | 15,20 | 1.15 |
| bear, gbear | 42×28 | 17,28 | 1.5 |
| golem, cgolem | 32×36 | 16,36 | 1 |
| guardian | 64×72 | 32,72 | 1 |

- `scale` is `PAL[type][3]`, the factor the game already applies to the bear and boar bodies. The other kinds use 1.
- Humanoid monsters (`goblin gchief merman outlaw praga forc fochief`) already use `FIG`, so they get character sheets, not monster sheets.

Proposed adapter (Claude-A's side). It keeps today's painters as the fallback:

```js
function drawMonSheet(m, x, y) {               // returns false to fall back to drawWolf/drawGolem/...
  const M = window.SatArt && SatArt.monsters, s = MSHEETS[m.type];
  if (!M || !s) return false;                  // MSHEETS[type] = M.buildSheet(type), built once
  const pose = m.hurtT > 0 ? 'hurt' : m.atkT > 0 ? 'atk' : m.moving ? 'walk' : 'idle';
  const r = M.rect(m.type, s.W, s.H, pose, frameOf(pose, m.animT));   // frameOf uses M.TIMING
  ctx.save(); ctx.translate(x, y); if (m.face < 0) ctx.scale(-1, 1);
  ctx.drawImage(s.canvas, r.sx, r.sy, r.sw, r.sh, -s.anchor.x * s.scale, -s.anchor.y * s.scale, s.W * s.scale, s.H * s.scale);
  ctx.restore(); return true;
}
```

The field names (`hurtT`, `atkT`, `moving`, `animT`, `face`) are placeholders. Claude-A maps them to whatever the monster state really holds.

## Terrain (tiles.js)

`tiles.js` uses the same `env` that today's `drawTile` already closes over, so the swap is local:

```js
const env = { gg, og, at, snowAt, WMH, TS, tree: (x, y) => VT.push(vtree(x, y, mulberry32(x*73856093 ^ y*19349663))) };
if (S.opt.art === 'v2' && window.SatArt && SatArt.tiles) SatArt.tiles.drawMap(env, MW, MH, 0);
else for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) drawTile(x, y);
```

- `drawMap` writes the whole ground layer in a single `putImageData`, then draws overlays (cliff lips, wall tops, palisade logs) on `og` with `fillRect`. Transparent gaps between logs stay transparent.
- `drawTile(env, x, y, frame)` does the same for one tile. Use it if a tile changes at runtime.
- `ground(env, x, y, frame)` returns the tile's raw 16×16 RGBA and needs no DOM. That's what the tests use.
- Colors come from short ramps chosen by world-space noise plus 4×4 ordered dithering, so grass and snow patches flow across tile borders instead of repeating per tile.
- Paths get wobbly grass or snow edges, a shadow line and inner corners. Water gets a sand bank, foam, and a shallow band near the shore.
- Water has 4 shimmer frames (`frame` 0..3). The engine can either redraw only the water tiles every ~0.2s or keep frame 0.
- Trees: `trunkCanvas()` replaces `TRK` (16×16). `canopyCanvas(seed, snowy)` replaces `CNV` and `CNS` (28×26, the same offset). Snowy canopies get snow on the lit tops instead of a white band.
- Cost: the full 160×144 map takes about 0.9 s, measured once at load in headless Chromium with software rendering. The legacy painter takes about 0.27 s. It's a one-time prerender, like today's.

## Buildings and props (buildings.js)

- `drawBuilding(env, b)` takes the same `b = {x, y, w, h, k}` as today. It keeps the footprint, the wall box (`py+30` to `py+h`), the door at the bottom centre (12×16), the windows at `px+8` and `px+w-20`, and the roof line ending at `py+34`. Collision, door triggers and room entry don't change.
- Walls and roofs are built as RGBA (`wallRGBA`, `roofRGBA`, testable in Node) and drawn with `drawImage`. The translucent ground shadow and anything already on `og` stay intact.
- Wall style per kind:
  - `house`: planks with flower boxes;
  - `shop`, `inn`, `hall`: plaster with timber beams;
  - `lodge`: logs;
  - `tower`, `armory`, `forge`: stone.
- Every wall has a stone foundation. Shutter colors follow the roof.
- Roof colors are the PER_CODE `rc` table from `drawBuilding`, turned into 5-step ramps. Shingles are offset per row, lit from the left, with a ridge highlight and an eave shadow. Houses and the inn get a brick chimney, and the forge keeps its stone stack.
- The forge's furnace mouth now has a hot core.
- `drawWorld(env, {ANVILS, WELLS, BOARD, TENTS, GRAVE, PROPS})` draws every world and room prop from the same lists the engine already has. Each prop is a rect list `[x, y, w, h, color, layer]` (layer 0 = `gg`, 1 = `og`), so the over/under split matches today's.

```js
if (S.opt.art === 'v2' && window.SatArt && SatArt.buildings) {
  buildings.forEach(b => SatArt.buildings.drawBuilding({ gg, og }, b));
  SatArt.buildings.drawWorld({ gg, og }, { ANVILS, WELLS, BOARD, TENTS, GRAVE, PROPS });
} else { buildings.forEach(drawBuilding); /* + today's prop code */ }
```

## VFX API

```js
const fx = SatArt.vfx.create();
fx.spawn(kind, x, y, { angle, rarity /*0..4*/, x1, y1 /*bolt target*/, life, n, seed });
fx.update(dt); fx.draw(ctx);   // draw inside the world transform, before the darkness overlay
```

Kinds: `slash hit crit block fire frost bolt heal mana levelup loot dust death forge blood stun rage shadow`.

Suggested hook points in today's engine (no code changed by Claude-B):

| Engine event | VFX |
|---|---|
| `tryAttack` swing | `slash` with the weapon's `r` as rarity |
| `hitMon` normal / crit | `hit` / `crit` |
| fireball boom, `nova`, `bolt` skill | `fire`, `frost`, `bolt` |
| `gainXP` level up | `levelup` |
| item drop of rarity ≥ 1 | `loot` |
| forge strike | `forge` |
| `killMon` | `death` |
| footsteps every 4th walk frame | `dust` |

Cosmetic only: `fx` never touches `S`, damage, loot or timers, so it is safe for online (client-side only).

## Rights

Everything here is drawn by code in this repo. No manhwa or official images are copied (doc D5).
