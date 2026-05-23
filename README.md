# The Great Adventure

A kid-friendly, two-team party board game for The Crossroads kids
ministry. Played live on the kids-room LED screen — the tech-room
engineer drives the game; the crowd is the controller. Inspired by
**Mario Party, Pummel Party, classroom team games, and PowerPoint-style
live event games**.

## How it plays

**Red Team 🦊 vs Blue Team 🐬.** Each team takes turns rolling, moving
along a branching treasure-map board, and earning **Adventure Coins**.
After 12 turns per team, whoever has the most coins wins.

### Spaces
- **Coin** 💰 — +5 Adventure Coins (sometimes drops a bonus power-up).
- **Trivia** ❓ — True/False Bible question. Correct → +3 coins.
- **Sanctuary** 🛡️ — safe space. Immune from coin loss and traps until
  the next turn ends.
- **Mini-game** 🎮 — picker spins, lands on a game. Engineer drives the
  game start-to-finish; winner gets +10 coins and a power-up.

### Branching paths
At the **fork tile** the engineer picks the team's path on the kids'
behalf (KEEP GOING along the outer loop, or TAKE SHORTCUT down through
the inner path).

### Power-ups
Drop from coin spaces, trivia wins, and mini-game wins. Used before
rolling.

| Icon | Name | Effect |
|---|---|---|
| ❄️ | Freeze | Opponent skips their next turn. |
| 🍌 | Banana Trap | Place on any tile (within 10 ahead of opponent). Enemy crossing loses 4 coins. |
| 💸 | Coin Drop | Opponent loses 5 coins, scattered ahead as pickups. |
| 🌀 | Warp | Teleport to any non-Sanctuary tile. |
| ⚡ | Speed Boost | +3 to your next dice roll. |

### Mini-game catalog
Six games — five host-led, one in-app (Slow Reveal).

1. 🪞 **Mirror Mirror** — teams form a shape with their bodies before
   the presenter ends the round.
2. 📖 **Bible Says** — America Says-style fill-in-the-blank.
3. 🧩 **Memory Verse Match** — match scripture pieces.
4. 💣 **Bomb Pass** — T/F hot-potato; timer expires → holder loses.
5. 🖼️ **Slow Reveal** *(in-app)* — a blurred Bible-scene emoji
   gradually clarifies; teams guess before the reveal completes.
6. 😆 **Funny Face Challenge** — make the other team laugh.

Every mini-game flows through a fixed 4-step framework: **instructions →
start gate → in-game → score award**. The engineer drives every
transition. No auto-advance.

## Run

Open `index.html` in any modern browser. No build step, no server, no
dependencies. Press `F` once loaded to go fullscreen.

## Operator keys (mirrored on screen)

| Key | Action |
|---|---|
| `SPACE` | Primary contextual action (roll, next, start, end) |
| `T` / `F` | Pick TRUE / FALSE (trivia) |
| `↵` Enter | Mark answer correct |
| `⌫` Backspace | Mark answer wrong |
| `←` / `→` | Pick branch at fork · reveal more (Slow Reveal) |
| `1` / `2` | Award mini-game winner — Red / Blue |
| `Esc` | Cancel a pending power-up pick (warp / trap) |
| `Q` / `W` | −1 / +1 coin for active team (manual override) |
| `U` | Undo last action |
| `M` | Mute / unmute audio |
| `F` | Toggle fullscreen (only outside trivia) |
| `Tab` | Toggle HUD detail |

Click any power-up chip in the team panel (during that team's
awaiting-roll phase) to use it.

## Roadmap

- **Phase 2** — three more in-app mini-games (Bomb Pass, Memory Verse
  Match, Mirror Mirror), 100+ trivia bank with topic tags, sudden-death
  tie-break, visual coin pickups.
- **Phase 3** — admin/content editor, custom cartoon sprites, per-zone
  background art, sampled SFX + ambient music per region, optional
  intra-session save/resume.

Roadmap details: see the dev plan in
`/root/.claude/plans/build-prompt-the-great-melodic-hamming.md` (local
to the dev environment).
