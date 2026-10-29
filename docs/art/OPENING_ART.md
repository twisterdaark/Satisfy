# Opening art: title scene and intro shots

Status: **wired in since v3.79** (title parallax behind `#titleScreen`, intro shots in `#cardP` via `card(keys, skippable, pics)` and `cardShot()` in `index.html`; test `tests/regression/opening.test.cjs`). It was drawn on 2026-10-29 for the Roblox port's opening. The owner felt it suits this web game better than Roblox, so it was kept here and added to Satisfy.

All files live in `sprites-original/opening/` (listed in `docs/art/provenance.json`). It is 2D pixel art drawn by PIL scripts at 480x270 and exported at 2x (nearest), so the scenes are 960x540 (16:9). Two exceptions: `in_legend.png` is a 400x400 square, and the walk frames are 64x112 (exported at 4x).

## The files

### Title scene: a parallax night landscape

Six full-frame layers, bottom to top (every layer above the sky has transparency).

| File | What it shows |
|---|---|
| `ts_sky.png` | Night sky gradient, stars, the full moon with a dithered halo |
| `ts_mtn.png` | Snow-tipped purple mountains |
| `ts_castle.png` | The castle on its hill, lit windows, red-and-gold flags and a lantern path up the hill |
| `ts_trees.png` | The pine forest line in front of the castle |
| `ts_fog.png` | A dithered fog band over the forest |
| `ts_front.png` | Dark grassy rise with big pines at the edges and fireflies (closest layer) |

`previews/ts_preview.png` and `previews/ts_preview2.png` show the layers composed.

### Intro shots: four scenes (six images)

| File | Scene |
|---|---|
| `in_grid.png` | VR boot: a light-blue perspective grid going to the horizon (transparent above it), where a player counter fits (Satisfy's "over 2 billion players") |
| `in_gate.png` | Winston's gate at dawn: town wall, banners, torches, the open lit gate, a dirt road |
| `in_walk1.png`, `in_walk2.png` | Two walk frames of the new player on that road, walking into the gate |
| `in_rumor.png` | A hooded smith (Grid) at a glowing forge and anvil, hammer up, glowing eyes, sparks |
| `in_legend.png` | A legendary-class silhouette (cloaked, holding a long blade) with glowing eyes inside a gold dithered aura; square, transparent outside the aura |

`previews/in_preview.png` shows the four scenes in a 2x2 grid.

### Generators

`tools/title_scene.py` draws the six `ts_*` layers and `tools/intro_panels.py` the `in_*` images (Python + Pillow). They write to `../sat/ui` relative to their own folder (the port's layout): change `OUT` before running them here.

## Intended opening flow

1. **Title screen.** `#titleScreen` gets the parallax scene behind the logo and buttons: each layer drifts sideways at its own speed (sky slowest, `ts_front` fastest), with a slow sway on the fog. It replaces or sits under today's background; the logo float, shine and embers stay.
2. **Intro after a new character.** Today the game shows three text cards (`w1`, `w2`, `w3`). Each card gets its picture, the text stays as it is:
   - `w1` (Satisfy, a VR game with over 2 billion players) over `in_grid`, the player counter counting up on the horizon.
   - `w2` ({n} logs in for the first time in Winston) over `in_gate`, with `in_walk1`/`in_walk2` alternating as the player walks to the gate.
   - `w3` (the rumour about Grid's legendary class) over `in_rumor`, then a fade to `in_legend`.
3. Skip and click-to-advance stay as they are now.

As built: the intro is one shot per text (Continue / Enter / Space goes to the next shot and closes on the last, Skip or Escape closes at once); the counter runs 0 to 2,000,000,000 in 3 s and then keeps ticking; the walker goes from the road's foot to the gate in 5 s; the rumour fades to the legend after 2.8 s. Layers drift by CSS animation only (no mouse parallax); reduced motion stops the drift.

## TODO to add it (done in v3.79)

- [x] Load the images from the repository (no outside hosts; `tests/unit/provenance.test.cjs` checks this).
- [x] Title: stack the six layers in `#titleScreen` with `image-rendering: pixelated`, scaled to cover; parallax by CSS animation (or by mouse position on PC).
- [x] Intro: show each card's picture above its text; cross-fades between shots; the walk frames swap about every 0.25 s.
- [x] Mobile: the scenes are 16:9, so crop from the centre on tall screens.
- [x] Changelog entry (Arabic and English) when it ships.
