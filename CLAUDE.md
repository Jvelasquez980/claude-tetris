# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla Tetris — HTML5 Canvas + CSS + JS, no dependencies, no build step, no package.json. Just three files: `index.html`, `style.css`, `game.js`.

## Running

Open `index.html` directly in a browser, or serve statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no test suite, linter, or build/watch command — verify changes by loading the page in a browser and playing.

## Architecture (`game.js`)

Single-file game, no modules/bundler. Everything is global state + functions operating on it.

- **Board**: `board` is a `ROWS × COLS` (20×10) matrix; each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: `PIECES` are 4×4 (or smaller) matrices of color indices. Rotation (`rotateCW`) is a transpose + row-reverse, not stored per-piece states.
- **Collision** (`collide`): bounds + board-overlap check, used for movement, rotation, and ghost-piece projection.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns until one doesn't collide.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row once `dropAccum >= dropInterval`.
- **Line clears** (`clearLines`): scans bottom-up, splices full rows out and unshifts empty rows in; updates score/lines/level and recomputes `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × current level; hard drop adds 2 pts/row dropped, soft drop 1 pt/row.
- **Ghost piece** (`ghostY`): projects current piece straight down via `collide` and renders it at `globalAlpha = 0.2`.

Flow: `init()` → `createBoard()`, seed `next`, `spawn()` (promotes `next` to `current`, generates new `next`, calls `endGame()` if the new piece immediately collides) → `requestAnimationFrame(loop)`. Input is handled by a single `keydown` listener switching on `e.code` (arrows, `X` to rotate, `Space` for hard drop, `P` to pause).

Tunable constants live at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS×BLOCK` × `ROWS×BLOCK`).
