import Phaser from 'phaser';
import { BodyTracker, isPersonValue } from '../tracking/BodyTracker.js';

// Demo board: a fixed grid of tiles. `1` = lava, `0` = safe.
// Static for the proof — the spawn/crack/collapse cycle is the next milestone.
const BOARD = [
  [0, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 0],
  [0, 0, 0, 1, 0, 0],
  [1, 0, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 1],
];

// Fraction of a tile that must be covered by person-pixels to count as "stepped on".
// Low enough to feel responsive, high enough to ignore a stray fingertip.
const TOUCH_THRESHOLD = 0.08;

const COLOR_SAFE = 0x1f6f4a;
const COLOR_SAFE_LINE = 0x2fa06a;
const COLOR_LAVA = 0x7a1414;
const COLOR_LAVA_LINE = 0xd84a2a;
const COLOR_LAVA_HOT = 0xff5a2a;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init() {
    this.tracker = null;
    this.errorMessage = null;

    // Offscreen canvas where we composite the mirror-flipped, background-removed cutout.
    this.cutoutCanvas = document.createElement('canvas');
    this.cutoutCtx = this.cutoutCanvas.getContext('2d', { willReadFrequently: false });

    this.tiles = [];        // { rect, gfx, isLava, col, row }
    this.cols = BOARD[0].length;
    this.rows = BOARD.length;
  }

  async create() {
    const { width, height } = this.scale;

    // --- Board layout: fill the screen with the tile grid ---
    this.buildBoard(width, height);

    // --- Cutout layer: a single image stretched full-screen, fed from a CanvasTexture ---
    this.textures.addCanvas('cutout', this.cutoutCanvas);
    this.cutoutImage = this.add.image(0, 0, 'cutout').setOrigin(0, 0);
    this.cutoutImage.setDisplaySize(width, height);
    this.cutoutImage.setDepth(10);

    // --- HUD ---
    this.buildHud(width, height);

    // --- Boot the camera + segmentation engine ---
    const videoEl = document.getElementById('webcam');
    this.tracker = new BodyTracker(videoEl);
    try {
      this.statusText.setText('Loading model + camera…');
      await this.tracker.init();
      this.statusText.setText('Step onto the board!');
    } catch (err) {
      this.errorMessage =
        'Camera/model failed to start.\n' +
        'Allow camera access and use Chrome on http://localhost.\n\n' +
        `(${err && err.message ? err.message : err})`;
      this.showError();
    }
  }

  buildBoard(width, height) {
    const tileW = width / this.cols;
    const tileH = height / this.rows;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const isLava = BOARD[row][col] === 1;
        const x = col * tileW;
        const y = row * tileH;

        const gfx = this.add.graphics();
        gfx.setDepth(1);
        const rect = new Phaser.Geom.Rectangle(x, y, tileW, tileH);
        this.tiles.push({ rect, gfx, isLava, col, row, touched: false });
        this.paintTile(this.tiles[this.tiles.length - 1], false);
      }
    }
  }

  paintTile(tile, hot) {
    const { gfx, rect, isLava } = tile;
    gfx.clear();
    let fill, line;
    if (isLava) {
      fill = hot ? COLOR_LAVA_HOT : COLOR_LAVA;
      line = COLOR_LAVA_LINE;
    } else {
      fill = COLOR_SAFE;
      line = COLOR_SAFE_LINE;
    }
    gfx.fillStyle(fill, 1);
    gfx.fillRect(rect.x, rect.y, rect.width, rect.height);
    gfx.lineStyle(2, line, 0.8);
    gfx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  }

  buildHud(width, height) {
    this.statusText = this.add
      .text(width / 2, 28, 'Starting…', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setDepth(100);

    // Big verdict in the corner: LAVA! / SAFE
    this.verdictText = this.add
      .text(20, height - 20, 'SAFE', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#7CFC7C',
        backgroundColor: '#00000066',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0, 1)
      .setDepth(100);

    // Camera / person indicator + timer, top-left.
    this.infoText = this.add
      .text(20, 20, 'camera: starting', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#cfd6e4',
        backgroundColor: '#00000066',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0, 0)
      .setDepth(100);

    this.startTime = this.time.now;
  }

  showError() {
    if (this.errorText) this.errorText.destroy();
    this.errorText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, this.errorMessage, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffd7d7',
        backgroundColor: '#000000cc',
        align: 'center',
        padding: { x: 24, y: 20 },
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.statusText.setText('Error');
  }

  update(time) {
    if (!this.tracker || !this.tracker.isReady()) return;

    // 1) Advance segmentation for the current camera frame.
    this.tracker.detect(performance.now());

    // 2) Paint the live, mirror-flipped, background-removed cutout.
    this.drawCutout();

    // 3) Run pixel-based collision: any person-pixels sitting on a lava tile?
    const onLava = this.checkCollisions();

    // 4) Update HUD.
    this.updateHud(time, onLava);
  }

  /**
   * Composite the cutout: mirror-flip the webcam frame, then knock out every
   * non-person pixel using the segmentation mask as an alpha stencil.
   */
  drawCutout() {
    const tracker = this.tracker;
    const video = tracker.getVideo();
    const mask = tracker.getMask();
    if (!mask || !video.videoWidth) return;

    const mw = tracker.maskWidth;
    const mh = tracker.maskHeight;

    // Keep the offscreen canvas at the mask resolution (small, fast to read/write).
    if (this.cutoutCanvas.width !== mw || this.cutoutCanvas.height !== mh) {
      this.cutoutCanvas.width = mw;
      this.cutoutCanvas.height = mh;
    }
    const ctx = this.cutoutCtx;

    // Draw the video mirror-flipped (translate + negative scale) at mask size.
    ctx.save();
    ctx.setTransform(-1, 0, 0, 1, mw, 0); // flip horizontally
    ctx.drawImage(video, 0, 0, mw, mh);
    ctx.restore();

    // Apply the mask (also mirror-flipped, so it lines up) as alpha.
    const frame = ctx.getImageData(0, 0, mw, mh);
    const px = frame.data;
    for (let y = 0; y < mh; y++) {
      const rowOff = y * mw;
      for (let x = 0; x < mw; x++) {
        // Mirror the mask lookup to match the flipped video.
        const maskVal = mask[rowOff + (mw - 1 - x)];
        const pi = (rowOff + x) * 4;
        if (!isPersonValue(maskVal)) {
          px[pi + 3] = 0; // transparent background
        } else {
          // Slight cyan rim tint so the cutout reads clearly against the board.
          px[pi] = Math.min(255, px[pi] + 10);
          px[pi + 2] = Math.min(255, px[pi + 2] + 25);
        }
      }
    }
    ctx.putImageData(frame, 0, 0);

    // Push the updated pixels to the GPU texture Phaser is drawing.
    const tex = this.textures.get('cutout');
    tex.refresh();
  }

  /**
   * For each lava tile, sample the (mirror-flipped) mask over the tile's screen
   * rectangle. If the fraction of person-pixels exceeds the threshold, it's touched.
   * This is count-agnostic: 1 player or 30, same logic.
   * Returns true if ANY lava tile is currently touched.
   */
  checkCollisions() {
    const tracker = this.tracker;
    const mask = tracker.getMask();
    if (!mask) return false;

    const mw = tracker.maskWidth;
    const mh = tracker.maskHeight;
    const { width: sw, height: sh } = this.scale;

    let anyLava = false;
    const SAMPLE_STEP = 3; // sample every 3rd pixel for speed

    for (const tile of this.tiles) {
      if (!tile.isLava) continue;

      // Map this tile's screen rect into mask space, mirroring X to match cutout.
      const r = tile.rect;
      const mx0 = Math.floor(((sw - (r.x + r.width)) / sw) * mw);
      const mx1 = Math.ceil(((sw - r.x) / sw) * mw);
      const my0 = Math.floor((r.y / sh) * mh);
      const my1 = Math.ceil(((r.y + r.height) / sh) * mh);

      let person = 0;
      let total = 0;
      for (let y = my0; y < my1; y += SAMPLE_STEP) {
        if (y < 0 || y >= mh) continue;
        const rowOff = y * mw;
        for (let x = mx0; x < mx1; x += SAMPLE_STEP) {
          if (x < 0 || x >= mw) continue;
          total++;
          if (isPersonValue(mask[rowOff + x])) person++;
        }
      }

      const touched = total > 0 && person / total >= TOUCH_THRESHOLD;
      if (touched !== tile.touched) {
        tile.touched = touched;
        this.paintTile(tile, touched);
      }
      if (touched) anyLava = true;
    }

    return anyLava;
  }

  updateHud(time, onLava) {
    const seconds = ((time - this.startTime) / 1000).toFixed(1);
    const hasPerson = this.tracker.hasPerson();

    this.infoText.setText(
      `camera: ok   |   person in view: ${hasPerson ? 'yes' : 'NO'}   |   time: ${seconds}s`
    );

    if (onLava) {
      this.verdictText.setText('LAVA!');
      this.verdictText.setColor('#ff5a2a');
    } else {
      this.verdictText.setText('SAFE');
      this.verdictText.setColor('#7CFC7C');
    }

    if (!hasPerson) {
      this.statusText.setText('Step into view of the camera…');
    } else if (onLava) {
      this.statusText.setText("You're on the LAVA! 🔥");
    } else {
      this.statusText.setText('Nice — stay on the safe tiles!');
    }
  }
}
