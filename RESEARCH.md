# Research notes — webcam AR / interactive-floor games

Synthesized from a multi-source web research pass (MediaPipe/TF.js body-seg, Three.js AR
compositing, camera→floor calibration, the interactive-floor genre, and the no-build coding
format). Legend: ✅ already doing · ⚠️ partial · ❌ gap/opportunity. "High-confidence" =
corroborated by 2+ independent angles.

## Headline
Our core choices (4-corner homography, single-focal pose, transparent stage over a room
canvas, cutouts as a top overlay, no-build single file, an FSM) are independently
recommended by practitioners. Risks are specific & known, not architectural.

## 1. Body segmentation & performance
- **High-confidence** — Decouple inference from render; segment ~10–20 Hz, render full-rate.
  ✅ now throttled to ~20 Hz. — developers.google.com/mediapipe/solutions/vision/image_segmenter/web_js
- ⚠️ iOS GPU delegate scrambles `selfie_multiclass` categories → force CPU on iOS if a
  cutout looks wrong. We use a GPU→CPU fallback only on hard failure. — github.com/google-ai-edge/mediapipe/issues/6142
- ⚠️ WebGL context loss on iOS backgrounding (17+). Need lost(`preventDefault`)+restored
  handlers. ✅ added on the Three canvas (MediaPipe-side recovery still a gap). — bugs.webkit.org/show_bug.cgi?id=261331
- ✅ Must `mask.close()` each frame or leak GPU memory. We do. — ai.google.dev/edge/api/mediapipe/js/tasks-vision.mpmask
- ❌→✅ Edge flicker is inherent (per-frame masks); fix is temporal smoothing (EMA blend with
  previous mask). Added EMA on alpha. — github.com/tensorflow/tfjs/issues/3902
- Confidence (float) mask > category mask for soft edges (we feather a category mask instead;
  kept category to avoid iOS risk). — developers.google.com/mediapipe/api/solutions/js/tasks-vision.imagesegmenterresult
- Selfie Segmentation = ONE mask for everyone, tuned for a single person <2 m. Real
  multiplayer needs BodyPix `multiSegmentation` or a multi-person model. Our column-split is a
  pragmatic hack. — github.com/tensorflow/tfjs-models/blob/master/body-segmentation/README.md

## 2. Three.js + camera compositing
- ✅ Room canvas *under* a transparent Three stage + cutouts as a top 2D overlay = the
  recommended cheapest layering (skips a per-frame texture upload). — discourse.threejs.org/t/10277
- ✅ `setViewOffset` is the correct cover-crop tool; fit math must be aspect-aware (portrait
  phones are the failure case — the bug we fixed). — threejs.org/docs PerspectiveCamera.setViewOffset
- Cutout↔3D occlusion isn't solved by sorting; sort by foot point, accept whole-sprite
  granularity. — discourse.threejs.org/t/6504
- Dark edge halos → edge-dilate the texture and/or `premultipliedAlpha:false`. — discourse.threejs.org/t/24064
- **High-confidence** mobile budget: cap pixelRatio 1.5 (✅), `antialias:false` (✅), no
  realtime shadows (✅), particles as one Points/instanced (✅), <100 draw calls; consider
  InstancedMesh for blocks at 7×7. — moldstud.com, utsubo.com/blog/threejs-best-practices-100-tips
- Fog is ~free (in-shader); vignette costs a pass — we use CSS vignette + fog (cheap). ✅

## 3. Calibration & perspective
- ✅ [VALIDATES] 4-corner `getPerspectiveTransform`; square pixels + centered principal point
  + single focal is the accepted, more-stable simplification. — galliot.us/blog/camera-calibration-using-homography-estimation
- ⚠️ [WARNS] FOV-from-one-homography is under-constrained; near-overhead/centered square quads
  are a known degeneracy → clamp + fall back to default FOV (we clamp 25–110° + fallback). — inria.hal.science/inria-00548325/document
- ❌ Highest-leverage accuracy wins not yet done: sub-pixel corner refinement (let users
  zoom/drag) and lens-distortion correction. — docs.opencv.org/4.x/dc/dbb/tutorial_py_calibration.html
- Reject near-collinear/non-convex quads (we check area). Manual calibration is a legit,
  deterministic alternative to WebXR plane detection (which drifts/fails on blank floors). — doc.babylonjs.com webXR

## 4. Interactive-floor genre
- Short auto-resetting rounds (~3–4 min), operator-tunable → throughput + replay. — valomotion.com/valoarena
- Hook = "your body is the controller, no instructions" + instant feedback **with sound**
  (❌ we have no audio — notable gap). — eyeclick.com, zsprojector.com
- Content variety is a hard requirement (limited modes get repetitive). — zsprojector.com
- LED-mirror approach inherits free wins: no projector shadows/occlusion, no walked-on screen
  wear, display robust to ambient light. — mtprojection.com/avoid-shadows...
- **Crowd scale is the hard part**: Ideum DinoStomp (8'×20' LED wall) used 3 fused Kinects +
  custom calibration + persistent per-person IDs. Our "whole crowd" goal needs multi-camera
  fusion + identity tracking, not just a wider webcam. — ideum.com/news/interactive-video-wall-build
- Design around a per-player zone/avatar (iGYM "peripersonal circle") for fairness across
  distance/height/mobility. — igym.solutions chiplay19.pdf
- Control lighting on the *players* (#1 camera failure mode); target <50 ms latency. — mtprojection.com, var.psu.edu

## 5. Coding format (no-build single file)
- ✅ Sound for this project (few big libs → negligible "waterfall" penalty; portability gets
  it onto an iPhone instantly). — mxb.dev/blog/buildless, vite.dev/guide/why
- ✅ Pin exact versions (never `@latest`/major aliases — jsDelivr caches those for days). — discoverthreejs.com
- ⚠️ MediaPipe is the most fragile dep: JS + `/wasm` path + `.task` model must all match one
  version; real breakage shipped (0.10.16 without wasm). Test the exact trio on iOS. — github.com/google-ai-edge/mediapipe/issues/5647
- ⚠️ `raw.githack` is a convenience proxy, not infra → move the `docs/` copy to GitHub Pages
  for a durable link. — github.com/orgs/community/discussions/144037
- Longevity upgrades: a jspm lockfile + integrity hashes (import maps can't use SRI), and a
  fully-vendored/inlined archive copy. — jspm.org, github.com/WICG/import-maps/issues/174
- ✅ An FSM keeps one big file maintainable (js13kGames proves single-file games ship). — gameprogrammingpatterns.com/state.html

## Prioritized action list
Quick (low effort): ✅ temporal EMA · ✅ ~20 Hz inference · ✅ pixelRatio 1.5 · ✅ context-loss
restore · ⬜ move docs/ to GitHub Pages.
Medium: ⬜ audio · ⬜ sub-pixel corner placement UX · ⬜ iOS-specific CPU delegate guard ·
⬜ vendored/inlined archive + version lockfile.
Strategic (crowd dream): ⬜ multi-person model or multi-camera fusion + persistent per-person
IDs (DinoStomp template) · ⬜ per-player interaction zones (iGYM) for fairness.
