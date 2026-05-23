// Headless smoke test — loads index.html into jsdom, simulates a full
// 12-turn game with two teams (Red / Blue), and verifies the game
// completes without JS errors and produces a coin-based result.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { errors.push('jsdomError: ' + (e.stack || e.message)); });
vc.on('error', (msg) => { errors.push('console.error: ' + msg); });
vc.on('log', (...args) => console.log('[page]', ...args));

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

setTimeout(async () => {
  const win = dom.window;
  function assert(cond, msg) { if (!cond) errors.push('ASSERT FAILED: ' + msg); }
  function tick(ms) { return new Promise(r => setTimeout(r, ms)); }

  try {
    // Initial render sanity
    const tiles = win.document.querySelectorAll('.tile');
    const tokens = win.document.querySelectorAll('.token');
    assert(tiles.length === 30, `expected 30 tiles, got ${tiles.length}`);
    assert(tokens.length === 2,  `expected 2 tokens, got ${tokens.length}`);

    // Primary button label
    const pb = win.document.getElementById('primary-btn');
    assert(pb.textContent.includes('ROLL'), `primary should say ROLL, got "${pb.textContent}"`);

    let safety = 0;
    while (!win.__game.state.won && safety < 400) {
      const state = win.__game.state;
      const phase = state.phase;
      safety++;
      if (phase === 'awaiting-roll') {
        win.__game.rollDice();
        await tick(2500);
      } else if (phase === 'awaiting-path-pick') {
        // Pick the first option (KEEP GOING) via DOM
        const btn = win.document.querySelector('[data-path]');
        if (btn) btn.click();
        await tick(500);
      } else if (phase === 'awaiting-tf' || phase === 'awaiting-judgment') {
        const correctAnswer = state.currentTrivia.a;
        win.__game.pickTF(correctAnswer);
        win.__game.judgeTrivia(true);
        await tick(2000);
      } else if (phase === 'mg-instructions') {
        const b = win.document.getElementById('mg-next-1');
        if (b) b.click();
        await tick(400);
      } else if (phase === 'mg-start-gate') {
        const b = win.document.getElementById('mg-start');
        if (b) b.click();
        await tick(400);
      } else if (phase === 'mg-in-game') {
        // Hit the end button for both Slow Reveal and host-led placeholder
        const end = win.document.getElementById('sr-end') || win.document.getElementById('mg-end');
        if (end) end.click();
        await tick(400);
      } else if (phase === 'mg-score-award') {
        const winnerBtn = win.document.querySelector('[data-winner="0"]');
        if (winnerBtn) winnerBtn.click();
        await tick(1500);
      } else if (phase === 'rolling' || phase === 'moving' || phase === 'resolving') {
        await tick(800);
      } else {
        await tick(300);
      }
    }

    const s = win.__game.state;
    assert(s.won, `game should end within 400 cycles (ended in phase=${s.phase}, turn=${s.turn})`);
    if (s.won) {
      const [red, blue] = s.teams;
      const winnerName = s.winner === -1 ? 'TIE' : s.teams[s.winner].name;
      console.log(`✓ Result after turn ${s.turn}: Red ${red.coins} vs Blue ${blue.coins} → ${winnerName}`);
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
