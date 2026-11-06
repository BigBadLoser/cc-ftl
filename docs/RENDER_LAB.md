# Render lab

A dev-only page that draws any visual on its own, as a grid of cells each pinned to a moment, so one still shows every
frame of an effect. It is the default way to look at and screenshot visual work. Use the game itself (`?scenario=...`)
only when the thing to judge is how it sits in a real scene. Code: `tools/lab/` (never in `src/`); it imports from
`src/render` and draws through the same code as the game.

## Use it

| Goal | How |
| --- | --- |
| Look at it in a browser | `npm run dev`, open `/tools/lab/` (the index lists the panels and their options) |
| Screenshot a panel | `npm run lab -- --panel shield [--query "&effects=ion&zoom=0.5"] [--out file.png]` |
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
- `shield`: the combat shield dome (#301): layer counts at rest, then every effect as a strip of stills through its
  length (`effects=`, `frames=8`, `rx`, `ry`, `rot`, `rest=1,2,3,4`).

- `marks`: the overhead crew icons `crew.mark.*` (sheet `marks`; social cues, break symbols in their tier's thought bubble, downed,
  surrendered): every icon's frames at 1x and 3x, every break at the three tiers, each over a real crew figure on a lit and a
  dark floor, and a shouting pair. `&preview=1` reads the quick preview sheet instead of the manifest (`&src=`, default
  `/.cache/marks-preview/`, written by `python3 -I tools/blender/review/marks_preview.py`), to try a change before
  `npm run sprites -- -- public/assets/1x marks`.
- `comms`: not a Pixi panel but a DOM one (`tools/lab/commsLab.ts`, `CommsLab.svelte`): every piece of `src/ui/comms` on its own in its
  states (static, video, flicker and stutter held on, caller card, transcript, sensor panel with the real ship picture, decision bar), then
  composed as the signal window. Flickers are held with `force` so a still shows the glitch frame.

## Add a panel

A panel (`tools/lab/panel.ts`) is `{ id, title, help, zoom?, bg?, cells(ctx) }`. `cells` returns `LabCell`s: a label, a
size in world px, the time `at` it shows in a still (and `loop` for `&play`), and `mount(root, ctx)`, which builds the
display objects once and returns `(t) => void` to set them to a time. Put it in its own file in `tools/lab/` and list it
in `tools/lab/panels.ts`.

Drive a panel through the code the game uses (export a small pure helper from the render module if the logic sits
inside a view, as `paintDome` does for the shield), not a copy of it, so the lab can't drift from the game. Stand-in
drawing behind the subject (a placeholder hull, a grid) is fine: it is debug drawing.
