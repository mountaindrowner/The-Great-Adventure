import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0d12',
  scale: {
    mode: Phaser.Scale.RESIZE, // fill the window; great for a big stage screen later
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  scene: [GameScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
