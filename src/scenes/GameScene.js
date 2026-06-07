import Phaser from 'phaser';
import { BodyTracker, isPersonValue } from '../tracking/BodyTracker.js';

/*
 * 3D-perspective lava floor with the player standing on it.
 *
 * The floor is a grid drawn in perspective (recedes toward a horizon). The
 * player's webcam silhouette is cut out and drawn as an upright billboard
 * standing on their tile, scaled by depth, with a glowing ring under the feet
 * that turns red on lava. Collision = which tile the player's feet are over.
 */
const BOARD = [          // row 0 = far/back of the floor, row 4 = near/front
  [0, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 0],
  [0, 0, 0, 1, 0, 0],
  [1, 0, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 1],
];
const ROWS = BOARD.length;
const COLS = BOARD[0].length;
const HALF_W = 6;                 // floor spans worldX in [-6, 6]
const Z_NEAR = 7, Z_FAR = 22;     // world depth of the near and far edges
const MIN_PERSON_PIXELS = 60;

const C_SAFE = 0x2b7d52, C_SAFE_HOT = 0x49d98a, C_SAFE_LINE = 0x39b074;
const C_LAVA = 0x8a1f12, C_LAVA_HOT = 0xff6a2a, C_LAVA_LINE = 0xe0552a;

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init() {
    this.tracker = null;
    this.started = false;
    this.cutoutCanvas = document.createElement('canvas');
    this.cutoutCtx = this.cutoutCanvas.getContext('2d', { willReadFrequently: true });
    this.cutoutImage = null;
    this.player = null;
  }

  create() {
    const { width, height } = this.scale;
    this.floorGfx = this.add.graphics().setDepth(1);
    this.ringGfx = this.add.graphics().setDepth(5);

    this.buildHud(width, height);
    this.computeProjection(width, height);
    this.scale.on('resize', (s) => {
      this.computeProjection(s.width, s.height);
      this.layoutHud(s.width, s.height);
    });

    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startTracking(), { once: true });
    } else {
      // No start overlay (e.g. desktop dev build) — boot directly.
      this.startTracking();
    }
  }

  async startTracking() {
    if (this.started) return;
    this.started = true;
    const boot = document.getElementById('boot');
    if (boot) boot.innerHTML = '<div class="spinner">Loading model + starting camera…</div>';
    this.tracker = new BodyTracker(document.getElementById('webcam'));
    try {
      await this.tracker.init();
      if (boot) boot.style.display = 'none';
      this.statusText.setText('Step into view!');
    } catch (err) {
      if (boot) {
        boot.innerHTML =
          '<h1>Couldn\'t start the camera</h1><p>Allow camera access, and use an ' +
          'https:// link (iPhone) or Chrome (desktop).</p><small>' +
          (err && err.message ? err.message : err) + '</small>';
      }
      this.statusText.setText('Camera error');
    }
  }

  computeProjection(W, H) {
    const yNear = H * 0.97, yFar = H * 0.30;
    this.cx = W / 2;
    this.horizonY = (yFar * Z_FAR - yNear * Z_NEAR) / (Z_FAR - Z_NEAR);
    this.K = (yNear - this.horizonY) * Z_NEAR;
    this.backY = this.horizonY + this.K / Z_FAR;
    this.f = (0.47 * W) * Z_NEAR / HALF_W;
    this.screenH = H; this.screenW = W;

    this.lineZ = [];
    for (let k = 0; k <= ROWS; k++) this.lineZ.push(Z_FAR + (Z_NEAR - Z_FAR) * (k / ROWS));
    this.lineX = [];
    for (let c = 0; c <= COLS; c++) this.lineX.push(-HALF_W + (2 * HALF_W) * (c / COLS));

    this.tileGeom = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const zF = this.lineZ[r], zN = this.lineZ[r + 1];
        const xL = this.lineX[c], xR = this.lineX[c + 1];
        const poly = [
          this.project(xL, zF), this.project(xR, zF),
          this.project(xR, zN), this.project(xL, zN),
        ];
        this.tileGeom.push({ r, c, isLava: BOARD[r][c] === 1, poly });
      }
    }
  }

  project(worldX, Z) {
    return { x: this.cx + (worldX * this.f) / Z, y: this.horizonY + this.K / Z };
  }

  buildHud(W, H) {
    this.statusText = this.add.text(W / 2, 18, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 12, y: 7 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(100);
    this.verdictText = this.add.text(16, H - 16, 'SAFE', {
      fontFamily: 'system-ui, sans-serif', fontSize: '50px', fontStyle: 'bold',
      color: '#7CFC7C', backgroundColor: '#00000066', padding: { x: 14, y: 7 },
    }).setOrigin(0, 1).setDepth(100);
    this.infoText = this.add.text(16, 14, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#cfd6e4',
      backgroundColor: '#00000066', padding: { x: 9, y: 5 },
    }).setOrigin(0, 0).setDepth(100);
    this.startTime = this.time.now;
  }

  layoutHud(W, H) {
    this.statusText.setPosition(W / 2, 18);
    this.verdictText.setPosition(16, H - 16);
    this.infoText.setPosition(16, 14);
  }

  update(time) {
    if (!this.tracker || !this.tracker.isReady()) return;
    this.tracker.detect(performance.now());
    this.updateCutout();

    let onLava = false, pr = -1, pc = -1;
    if (this.player) {
      pc = Math.min(COLS - 1, Math.max(0, Math.floor(this.player.nfx * COLS)));
      pr = Math.min(ROWS - 1, Math.max(0, Math.floor(this.player.nfy * ROWS)));
      onLava = BOARD[pr][pc] === 1;
    }

    this.drawFloor(pr, pc);
    this.drawPlayer(onLava);
    this.updateHud(time, onLava);
  }

  updateCutout() {
    const t = this.tracker, video = t.getVideo(), mask = t.getMask();
    if (!mask || !video.videoWidth) { this.player = null; return; }
    const mw = t.maskWidth, mh = t.maskHeight;
    if (this.cutoutCanvas.width !== mw || this.cutoutCanvas.height !== mh) {
      this.cutoutCanvas.width = mw; this.cutoutCanvas.height = mh;
    }
    const ctx = this.cutoutCtx;
    ctx.save();
    ctx.setTransform(-1, 0, 0, 1, mw, 0);
    ctx.drawImage(video, 0, 0, mw, mh);
    ctx.restore();

    const frame = ctx.getImageData(0, 0, mw, mh);
    const px = frame.data;
    let minX = mw, minY = mh, maxX = -1, maxY = -1, count = 0;
    let footSumX = 0, footRow = -1, footCount = 0;
    for (let y = 0; y < mh; y++) {
      const rowOff = y * mw;
      for (let x = 0; x < mw; x++) {
        const maskVal = mask[rowOff + (mw - 1 - x)];
        const pi = (rowOff + x) * 4;
        if (!isPersonValue(maskVal)) { px[pi + 3] = 0; continue; }
        px[pi] = Math.min(255, px[pi] + 8);
        px[pi + 2] = Math.min(255, px[pi + 2] + 22);
        count++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (y > footRow) { footRow = y; footSumX = x; footCount = 1; }
        else if (y === footRow) { footSumX += x; footCount++; }
      }
    }
    ctx.putImageData(frame, 0, 0);

    if (!this.textures.exists('cutout')) this.textures.addCanvas('cutout', this.cutoutCanvas);
    this.textures.get('cutout').refresh();

    if (count < MIN_PERSON_PIXELS || maxX < 0) { this.player = null; return; }
    const footX = footSumX / footCount;
    this.player = {
      nfx: footX / mw, nfy: maxY / mh,
      bx: minX, by: minY, bw: (maxX - minX + 1), bh: (maxY - minY + 1),
    };
  }

  drawFloor(pr, pc) {
    const g = this.floorGfx;
    g.clear();
    g.fillStyle(0x0a0b12, 1).fillRect(0, 0, this.screenW, this.backY);
    g.fillStyle(0x3a1408, 0.7).fillRect(0, this.backY - 12, this.screenW, 14);
    for (const tile of this.tileGeom) {
      const isPlayerTile = tile.r === pr && tile.c === pc;
      let fill, line;
      if (tile.isLava) { fill = isPlayerTile ? C_LAVA_HOT : C_LAVA; line = C_LAVA_LINE; }
      else { fill = isPlayerTile ? C_SAFE_HOT : C_SAFE; line = C_SAFE_LINE; }
      g.fillStyle(fill, 1);
      g.fillPoints(tile.poly, true);
      g.lineStyle(2, line, 0.9);
      g.strokePoints(tile.poly, true);
    }
  }

  drawPlayer(onLava) {
    const ring = this.ringGfx;
    ring.clear();
    if (!this.player) { if (this.cutoutImage) this.cutoutImage.setVisible(false); return; }

    const p = this.player;
    const worldX = (p.nfx - 0.5) * 2 * HALF_W;
    const Z = Z_FAR + (Z_NEAR - Z_FAR) * p.nfy;
    const foot = this.project(worldX, Z);
    const depth = Z_NEAR / Z;

    const rx = (this.f / Z) * 1.15, ry = rx * 0.4;
    const glow = onLava ? 0xff6a2a : 0x49d98a;
    ring.fillStyle(glow, 0.22).fillEllipse(foot.x, foot.y, rx * 2.4, ry * 2.4);
    ring.fillStyle(glow, 0.45).fillEllipse(foot.x, foot.y, rx * 1.7, ry * 1.7);
    ring.lineStyle(Math.max(3, rx * 0.18), glow, 1).strokeEllipse(foot.x, foot.y, rx * 2, ry * 2);

    if (!this.cutoutImage && this.textures.exists('cutout')) {
      this.cutoutImage = this.add.image(0, 0, 'cutout').setOrigin(0, 0).setDepth(6);
    }
    if (this.cutoutImage) {
      const targetH = this.screenH * 0.55 * depth;
      const s = targetH / p.bh;
      const footY = foot.y + ry * 0.4;
      const X = foot.x - (p.bx + p.bw / 2) * s;
      const Y = footY - (p.by + p.bh) * s;
      this.cutoutImage.setVisible(true).setCrop(p.bx, p.by, p.bw, p.bh).setScale(s).setPosition(X, Y);
    }
  }

  updateHud(time, onLava) {
    const seconds = ((time - this.startTime) / 1000).toFixed(1);
    const present = !!this.player;
    this.infoText.setText(`person: ${present ? 'yes' : 'NO'}  |  ${seconds}s`);
    if (onLava) { this.verdictText.setText('LAVA!'); this.verdictText.setColor('#ff5a2a'); }
    else { this.verdictText.setText('SAFE'); this.verdictText.setColor('#7CFC7C'); }
    if (!present) this.statusText.setText('Step into the camera view…');
    else if (onLava) this.statusText.setText("You're on the LAVA! 🔥");
    else this.statusText.setText('Nice — stay on the safe tiles!');
  }
}
