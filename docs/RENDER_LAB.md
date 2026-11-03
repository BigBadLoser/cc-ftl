# Render lab

A dev-only page that draws any visual on its own, as a grid of cells each pinned to a moment, so one still shows every
frame of an effect. It is the default way to look at and screenshot visual work. Use the game itself (`?scenario=...`)
only when the thing to judge is how it sits in a real scene. Code: `tools/lab/` (never in `src/`); it imports from
`src/render` and draws through the same code as the game.

## Use it

| Goal | How |
| --- | --- |
| Look at it in a browser | `npm run dev`, open `/tools/lab/` (the index lists the panels and their options) |
| Screenshot a panel | `npm run lab -- --panel sprites [--query "&ids=fx.&zoom=2"] [--out file.png]` |
| Several shots in one browser | `npm run lab -- --batch shots.json` (a list of `{ panel, query, out }`) |
| Use a dev server already running | add `--url http://localhost:5173/` (otherwise it starts one on a free port and stops it by PID) |

Shots are 1920 css px wide at 2x (`--width`, `--scale`), full page. A still is drawn once and the page then sits idle, so
even headless software GL takes seconds per shot, not minutes.

Every panel takes `&zoom=` (css px per world px; at 2x, 0.25 still draws one art px as one device px), `&cols=N`,
`&bg=0a0d12`, and `&play` (each cell loops through its own time instead of holding its pinned moment, for watching it
move in a browser).

## Panels

- `sprites`: any static sprites by id prefix (`ids=fx.shield_,fx.hit`), each animation on its own row with a playing
  cell and then every frame, anchors lined up; `glow=on|off|only`, `anchor`, `fps=14`.

## Add a panel

A panel (`tools/lab/panel.ts`) is `{ id, title, help, zoom?, bg?, cells(ctx) }`. `cells` returns `LabCell`s: a label, a
size in world px, the time `at` it shows in a still (and `loop` for `&play`), and `mount(root, ctx)`, which builds the
display objects once and returns `(t) => void` to set them to a time. Put it in its own file in `tools/lab/` and list it
in `tools/lab/panels.ts`.

Drive a panel through the code the game uses (export a small pure helper from the render module if the logic sits
inside a view), not a copy of it, so the lab can't drift from the game. Stand-in
drawing behind the subject (a placeholder hull, a grid) is fine: it is debug drawing.
