# cc-ftl

A persistent, isometric ship-colony game for the browser: Space Haven's simulation with FTL's
combat, crew species and encounters.

- Play (main): https://bigbadloser.github.io/cc-ftl/ (published by hand with the "Deploy game and wiki to GitHub Pages" workflow)
- Gameplay wiki: https://bigbadloser.github.io/cc-ftl/wiki/ (published alongside the game)

Design: [docs/DESIGN.md](docs/DESIGN.md) · Architecture and milestones: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

```sh
npm install
npm run dev     # local dev server
npm run check   # lint, typecheck, tests
```

Wiki development and generated gameplay references: [wiki/README.md](wiki/README.md).

## Playtesting with AI agents (`?agent`)

Open the game with `?agent` in the URL (for example `http://localhost:5173/?agent=1&seed=7`; it combines with other params) and the page gets
`window.__play`, a small API for AI models that drive a headless browser. They think for 10 to 60 s a turn while the game runs in real time, and many cannot
read screenshots, so the API freezes time and describes the game as text. Without `?agent` nothing is installed and the game is unchanged. It has no cheats and
never changes game state apart from time control; `?hook` (`window.__cc`) is a separate developer tool with cheats, not for playtesters.

A plain page load opens the title screen, where `__play` does not exist yet: click through it with real clicks, or add `seed=N` to start a game directly. `__play`
appears once the game is running (wait for `window.__play`). Every method returns plain JSON.

| Method | What it does |
| --- | --- |
| `help()` | A short string listing the methods. Call it first. |
| `pause()`, `resume()`, `isPaused()`, `setSpeed(1\|2\|3)` | The player's pause and speed controls (Space, 1 2 3), so the UI shows the same state. Return `{paused, speed, t}`. |
| `step(seconds)` | While paused, advance the game by that much game time (at most 10 s) tick by tick, deterministically; pauses first if running. Stays paused and returns `state()` plus `stepped` (seconds run) and `stopped` (why it ended early: a decision opened, game over). |
| `state()` | Compact JSON snapshot (about 2 to 4 KB): `screen` (`game`, `combat`, `starmap`, `hyperspace`, `deploy`, `decision`, `gameover`), game time `t` and `tick`, `paused`, `speed`, the open `decision` with its choices, the player's `ship` (hull, shields, credits, fuel, power, food, oxygen, FTL, stock), damaged or unpowered `modules`, `weapons` with charge, `crew` (where, health, job, needs, mood, flags), `enemies` with what the combat panel shows, `incoming` fire, `boarders`, `nearby` ships and stations, `alerts`, the current tutorial `goals`, and a `travel` trip. Only what the player can see. |
| `describe()` | The same as a few lines of plain English, for models that read text only. |
| `elements()` | The controls clickable right now: `{label, kind, enabled, box: {x, y, w, h}, at: {x, y}, id?, value?}` in CSS pixels of the page. Buttons and other DOM controls that are visible and not covered, plus ship modules, crew and hostile ships on the canvas (`kind` `module`, `crew`, `ship`). Click `at`. |
| `log(sinceId?)` | Game events that matter to a player (fires, breaches, damage, crew hurt or dead, refused commands, events, jumps) as `{id, t, text}` after `sinceId`; the last 300 are kept. Pass the last `id` you saw. |

The play loop: `pause()`, read `state()` or `describe()`, act through real clicks (`elements()` gives the coordinates) or key presses, `step(2)`, read `log(lastId)`,
repeat. Game time only moves when you `step()` or `resume()`, so a slow model never loses a fight to its own thinking time. Left running, a decision pauses the game as it
does for a player; `step()` stops there.
