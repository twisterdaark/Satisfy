# Art contract: character sheets, monster sheets and VFX (SAT-ART-001)

Owner: Claude-B. Integrator: Claude-A. Status: proposal. Nothing here is wired into `index.html` yet.

## What exists

| File | What it is |
|---|---|
| `sprites-original/chars.js` | Parametric character renderer v2. It reads the same style configs as `figure()` in `index.html` (`FIG`, `lookFig`). |
| `sprites-original/monsters.js` | Monster sheet renderer for the 9 non-humanoid types `drawMon` paints by hand (`wolf pwolf boar bear gbear rabbit golem cgolem guardian`). Colors come from a `PAL` snapshot (PER_CODE); a test fails if it drifts. |
| `sprites-original/vfx.js` | Data-driven cosmetic VFX presets with a tiny particle engine |
| `sprites-original/fig-data.js` | Snapshot of `FIG`/`LOOK`/`lookFig` from `index.html` @ `ce29772` (PER_CODE). A test fails if `FIG` drifts. |
| `sprites-original/legacy-figure.js` | Snapshot of today's `figure()`, used only for the side-by-side preview |
| `sprites-original/sheets/*.png` + `manifest.json` | Exported sheets: every `FIG` entry plus each player hair style, with and without armor. `sheets/monsters/*.png` are listed under `manifest.monsters`. |
| `sprites-original/preview.html` | Open it locally to see legacy and new side by side, with every VFX preset |
| `sprites-original/tools/export-sheets.cjs` | Regenerates the PNGs and the manifest (Playwright) |
| `tests/content/art.test.cjs` | `node --test`: layout, manifest/PNG sizes, hand anchors, FIG and PAL drift, monster coverage and anchors, VFX lifecycle |

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
