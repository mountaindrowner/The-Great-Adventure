# The Great Adventure — Floor-Is-Lava (webcam tech demo)

A browser-based, **mixed-reality "floor is lava"** proof of concept in the spirit of
ValoMotion's *Groundfall*: a camera films you, cuts your body out of the background,
and drops your **life-size silhouette** into a game where stepping on a lava tile
sets off the alarm. No headset, no floor sensors, no wearables — just a webcam, a
screen, and a browser.

This is the **tech-demo milestone**: the smallest thing that proves the whole pipeline
works. The art is deliberately plain blocks — the magic is *you, cut out and standing
inside the game*.

## What it proves

```
  webcam  ─►  body segmentation (every person → one silhouette)
              │
              ├─►  life-size, mirror-flipped CUTOUT composited over the board
              │
              └─►  collision: do any "person pixels" sit on a lava tile?  →  LAVA! / SAFE
```

## How it works

- **Phaser 3** draws the tile board, the cutout layer, and the HUD.
- **MediaPipe `ImageSegmenter`** (selfie *multiclass* model, GPU, ~30fps) produces a
  full-frame **person/not-person mask** every camera frame.
- The cutout = the **mirror-flipped** webcam frame with every non-person pixel made
  transparent using that mask. Move left → your silhouette moves left, like a mirror.
- **Collision is pixel-based, not skeleton-based:** for each lava tile we sample the
  mask over that tile and ask "are enough body pixels here?". This is *count-agnostic*
  — **one player or a whole crowd runs the exact same code.** That's the deliberate
  design choice that keeps the eventual "crowd on a big LED stage" goal open instead
  of boxing us into per-person tracking limits.

## Run it

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173/` URL **in Chrome** and **allow camera
access**. Stand back so your whole body is in frame, then step around the board.

- `npm run build` — production build into `dist/`
- `npm run preview` — serve the production build

### Requirements

- A webcam and a Chromium-based browser (desktop Chrome recommended).
- Camera access needs `http://localhost` (works as-is) **or** HTTPS. Opening the LAN
  URL from another device requires HTTPS for the camera to turn on.
- First run downloads the MediaPipe model + WASM from a CDN (needs network). These can
  be self-hosted later for an offline install.

## Layout

```
index.html              # mounts the Phaser canvas + a hidden <video> pixel source
src/main.js             # Phaser.Game config
src/tracking/BodyTracker.js  # webcam + MediaPipe segmentation (game-agnostic, crowd-ready)
src/scenes/GameScene.js      # tile board, cutout compositing, pixel collision, HUD
```

## Next milestones (intentionally NOT in this demo)

- Tile **spawn / crack / collapse** cycle and round timing
- Scoring, lives, and per-individual skeleton scoring (layer `PoseLandmarker` on top)
- Audio, attract/idle screen
- **Crowd + big LED stage:** calibration for a large screen and many simultaneous
  players. No architecture change is needed for *more bodies* — the segmentation +
  pixel-collision approach already treats everyone in frame as one silhouette; this
  step is about screen size, camera placement, and tuning.

## Tuning knobs

- `TOUCH_THRESHOLD` in `GameScene.js` — how much of a tile a body must cover to trip it.
- `BOARD` in `GameScene.js` — the lava/safe layout (`1` = lava, `0` = safe).
- Camera resolution in `BodyTracker.js` — lower it if framerate drops on a big screen.
