// Headless smoke test — loads index.html into jsdom, simulates many turns,
// and verifies no JS errors and that the game reaches a winner.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { errors.push('jsdomError: ' + (e.stack || e.message)); });
vc.on('error', (msg) => { errors.push('console.error: ' + msg); });
vc.on('log', (...args) => { console.log('[page]', ...args); });

// Stub AudioContext so the audio code paths don't blow up
const audioStub = function () {
  return {
    currentTime: 0,
    destination: {},
    createOscillator: () => ({ frequency: { value: 0 }, type: '', connect: () => {}, start: () => {}, stop: () => {} }),
    createGain: () => ({ gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }),
  };
};

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.AudioContext = audioStub;
    window.webkitAudioContext = audioStub;
    window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  },
});

// Wait briefly for boot
setTimeout(async () => {
  const win = dom.window;

  function assert(cond, msg) {
    if (!cond) { errors.push('ASSERT FAILED: ' + msg); }
  }

  try {
    // 1. Initial render: 21 tiles, 3 tokens
    const tiles = win.document.querySelectorAll('.tile');
    const tokens = win.document.querySelectorAll('.token');
    assert(tiles.length === 21, `expected 21 tiles, got ${tiles.length}`);
    assert(tokens.length === 3, `expected 3 tokens, got ${tokens.length}`);

    // 2. Primary button label
    const pb = win.document.getElementById('primary-btn');
    assert(pb.textContent.includes('ROLL'), `primary should say ROLL, got "${pb.textContent}"`);

    // 3. Simulate many turn cycles: keep clicking primary, picking answers, judging, etc.
    // We override Math.random so we can control flow a bit
    let turns = 0;
    let maxTurns = 200;
    while (turns < maxTurns) {
      const state = win.__game.state;
      if (state.won) break;
      const phase = state.phase;
      if (phase === 'awaiting-roll') {
        win.__game.rollDice();
        // fast-forward all timers
        await tick(win, 3000);
      } else if (phase === 'awaiting-strategic-6') {
        win.__game.resolveStrategic('forward');
        await tick(win, 5000);
      } else if (phase === 'awaiting-answer' || phase === 'awaiting-judgment') {
        win.__game.pickAnswer(state.currentQuestion.c); // pick correct
        win.__game.judgeAnswer(true);
        await tick(win, 2000);
      } else if (phase === 'awaiting-treasure') {
        const btn = win.document.getElementById('treasure-continue');
        if (btn) btn.click();
        await tick(win, 1000);
      } else if (phase === 'awaiting-minigame') {
        // wait for the wheel to settle then pick a winner
        await tick(win, 5000);
        const btn = win.document.querySelector('[data-winner="0"]');
        if (btn) btn.click();
        await tick(win, 1500);
      } else if (phase === 'rolling' || phase === 'moving' || phase === 'resolving') {
        await tick(win, 2000);
      } else {
        // unknown phase — fast-forward
        await tick(win, 500);
      }
      turns++;
    }

    assert(win.__game.state.won, `game should have produced a winner within ${maxTurns} action cycles, ended in phase=${win.__game.state.phase}, positions=${JSON.stringify(win.__game.state.teams.map(t=>t.position))}`);
    if (win.__game.state.won) {
      console.log(`✓ Winner: ${win.__game.state.teams[win.__game.state.winner].name} after ${win.__game.state.turn} turns`);
    }

    if (errors.length) {
      console.error('\n=== ERRORS ===');
      errors.forEach(e => console.error(e));
      process.exit(1);
    } else {
      console.log('\n✓ All smoketests passed');
      process.exit(0);
    }
  } catch (e) {
    console.error('TEST RUNNER ERROR:', e.stack || e);
    process.exit(1);
  }
}, 200);

function tick(win, ms) {
  // jsdom uses real timers, so just await
  return new Promise(r => setTimeout(r, ms));
}
