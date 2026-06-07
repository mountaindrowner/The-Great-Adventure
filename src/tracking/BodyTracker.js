import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

/**
 * BodyTracker — the reusable, crowd-ready "engine" core.
 *
 * It does exactly two things and nothing game-specific:
 *   1. Opens the webcam into a hidden <video>.
 *   2. Each frame, runs MediaPipe's ImageSegmenter to produce a full-frame
 *      "person / not-person" mask covering EVERY human in view.
 *
 * Because the mask is whole-frame (not per-skeleton), the exact same code
 * works for one player or a whole crowd — that's the property that lets the
 * demo scale to the eventual "crowd on a big LED stage" without a rewrite.
 *
 * The game layer reads getMask() + getVideo() and decides what to draw and
 * what counts as a collision. This class never imports Phaser.
 */
export class BodyTracker {
  constructor(videoEl) {
    this.video = videoEl;
    this.segmenter = null;
    this.ready = false;

    // Latest result, cached so the render loop can read it any time.
    this.mask = null;          // Float32Array | Uint8Array of category values
    this.maskWidth = 0;
    this.maskHeight = 0;

    this._lastVideoTime = -1;
    this._personCategoryIndex = null; // resolved from model metadata on first result
  }

  /**
   * Load the model + start the camera. Resolves once both are live.
   * Throws on camera-permission denial or model-load failure so the caller
   * can surface a clear on-screen error.
   */
  async init() {
    // 1) Camera first — if this fails (no webcam / denied), fail loudly and early.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
    // Wait until the video actually has dimensions, or the mask math is garbage.
    if (!this.video.videoWidth) {
      await new Promise((resolve) => {
        this.video.onloadeddata = () => resolve();
      });
    }

    // 2) Load MediaPipe WASM + the selfie multiclass segmentation model.
    //    These come from a CDN on first run (needs network); can be self-hosted later.
    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    this.segmenter = await ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });

    this.ready = true;
  }

  /**
   * Run segmentation for the current video frame (if it's a new frame).
   * Cheap to call every render tick — it no-ops when the frame hasn't advanced.
   * @param {number} timestampMs - monotonic timestamp (e.g. performance.now()).
   */
  detect(timestampMs) {
    if (!this.ready || this.video.currentTime === this._lastVideoTime) return;
    this._lastVideoTime = this.video.currentTime;

    this.segmenter.segmentForVideo(this.video, timestampMs, (result) => {
      const categoryMask = result.categoryMask;
      if (!categoryMask) return;
      this.maskWidth = categoryMask.width;
      this.maskHeight = categoryMask.height;
      this.mask = categoryMask.getAsUint8Array();
      // The selfie_multiclass model labels: 0 background, then body parts
      // (hair, body-skin, face-skin, clothes, others). Everything non-zero is
      // "a person", which is exactly the silhouette we want.
      categoryMask.close();
    });
  }

  /** True once a person pixel has been seen this frame anywhere in the mask. */
  hasPerson() {
    if (!this.mask) return false;
    // Sample sparsely — we only need to know "is anyone there", cheaply.
    for (let i = 0; i < this.mask.length; i += 97) {
      if (this.mask[i] !== 0) return true;
    }
    return false;
  }

  getMask() {
    return this.mask;
  }

  getVideo() {
    return this.video;
  }

  isReady() {
    return this.ready;
  }
}

/**
 * Helper: is a mask value a "person" pixel?
 * Background is category 0 in the selfie multiclass model; anything else is body.
 */
export function isPersonValue(v) {
  return v !== 0;
}
