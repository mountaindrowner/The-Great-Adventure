# The Great Adventure

A Mario Party-style board game for The Crossroads kids ministry. A
multi-week quest themed on the Wilderness / Exodus season, played live
on the kids-room LED screen with a tech-room operator driving the action
and the children acting as the controller (shouting answers, picking
moves, etc.).

## Phase 1 prototype (this branch)

This is the static, single-HTML-file prototype that proves out the full
turn loop end-to-end. No persistence yet; everything resets on reload.

- 20-space hand-laid board with three space types: Question, Treasure, Mini-game
- 3 tribes: **Lions** (K-1), **Eagles** (2-3), **Doves** (4-5) — each draws from its own age-tiered question bank
- Dice 1-6, with a **Strategic 6** prompt (forward 6 / back 6 / stay)
- 4 power-ups: Double Roll, Stumble, Sanctuary (Shield), Mulligan
- Subtle rubber-banding for trailing tribes
- Mini-game spaces spin a wheel and pick from the existing live library (Mirror Mirror, Memory Verse Scramble, Bible Says, Memory Verse Match) — host runs it, operator awards the winner
- Single contextual primary button (label changes by phase) + MC answer buttons + Undo + Mute
- Web Audio-synthesized SFX + light background music loop
- Designed at 1920×1080, auto-scaled to fullscreen

## Run

Open `index.html` in any modern browser. No build step, no server, no
dependencies. For the kids-room screen, press `F` once loaded to go
fullscreen.

## Operator keys (mirrored on screen)

| Key | Action |
|---|---|
| `SPACE` | Primary contextual action (roll / continue) |
| `1` `2` `3` `4` | Pick answer A/B/C/D (or pick tribe during mini-game) |
| `↵` Enter | Mark answer correct |
| `⌫` Backspace | Mark answer wrong |
| `←` `→` `↓` | Strategic 6: back / forward / stay |
| `Q` / `W` | −1 / +1 score for active tribe (manual override) |
| `U` | Undo last action |
| `M` | Mute / unmute audio |
| `F` | Toggle fullscreen |
| `Tab` | Toggle HUD detail |

## Roadmap

- **Phase 2** — full 50-space board, more space types (Trial, Choice,
  Story, Sabotage, Sanctuary), localStorage save/load + JSON export
- **Phase 3** — Admin page for editing question banks and board layout
  without touching code
- **Phase 4** — Real mini-game module integration, blessing card
  meta-collection across the quarter, end-of-season celebration

Detailed planning notes live in
`/root/.claude/plans/build-prompt-the-great-melodic-hamming.md` (local to
the dev environment).
