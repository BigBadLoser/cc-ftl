# Profiling (for agents)

Issue #188. Layers report timings through a `Probe` (`src/sim/probe.ts`: `begin(label)`, `end(label)`, `count(label, n)`). The sim only
sees the type and a no-op, so it stays pure; the real probe with the clock is `src/app/profiler/`. Labels are slash-hierarchical.
Costs are reported as **self ms** (time in the label, minus nested labels) and total ms.

## Run it

| Goal | Command |
| --- | --- |
| Per-system sim cost, no browser, deterministic work | `npm run profile:sim -- --ticks 5000 --seed 1` |
| Whole game in headless Chromium | `npm run profile -- --scenario log --seconds 20 --speed 3 --seed 1` |
| Colony baseline (no scenario) | `npm run profile -- --seconds 20` |
| In a browser tab | open `/?perf` (optionally `&scenario=..&seed=..`), press **F3** for the panel |

Both scripts print the text report to stdout and write the JSON summary (`--out`, default `profile.json` / `profile-sim.json`, git-ignored).
`profile` starts its own dev server on a free port and stops it by PID when done (`--url` uses a running one instead). It uses the dev
server on purpose: system labels come from function names, which a minified build mangles.

Scenarios are the `?scenario=` values in `src/main.ts`, passed straight through: currently `log` (a raider arrives, fire breaks out, speed 3),
`hullplan`, `handover`, `bounty`, `survey`. `fight` and `damage` arrive with #184. `none` or no flag is the colony baseline.
`--speed 1|2|3` presses the speed key after load; `--warmup 2` seconds run before the tally resets and the recording starts.

Headless Chromium renders with software WebGL (SwiftShader): `render/present`, `render/gl` and `render/combatPass` are inflated by it and
the frame rate is low. Trust the CPU-side labels (`sim/*`, `ui/*`, `render/scenes`, `render/sync`, `render/views`) and the counters; compare
GPU-bound numbers only between runs on the same machine.

## `window.__perf` (with `?perf`)

`enable()`, `disable()`, `reset()`, `startRecording()`, `stopRecording()`, `summary(topN?)`, `report(rows?)`.

- `report()` is a short aligned text table sorted by self time, then counters, then (after a recording) the worst frames.
- `summary()` is compact JSON: `frames`, `work` and `interval` (mean/p95/max ms, fps), `overBudget` and `overPct` against 16.67 ms of
  work per frame, `bySelf` / `byTotal` rows (`label, calls, total, self, mean, p95, max`), `counts`, `mem` (Chrome only), and `recording`.
- A recording keeps per-frame label totals. `recording.worst` lists the worst frames with the labels that dominated each, and
  `recording.culprits` ranks the labels that topped them. Use it to tell "always slow" (high mean self) from "occasional spike" (high max,
  low mean, a culprit in `worst`).

## Reading the report

- `loop/frame` is the work done per frame (sim ticks, render, ui). `interval` is the real time between frames (fps).
- Labels: `sim/tick` (whole tick, children are `sim/<system>` and `sim/commands`), `render/{sync,scenes,views,fx,combatPass,gl,present,main}`,
  `ui/{bridge,events,upkeep}`, `loop/frame`.
- Counters: `loop/ticks` (sim ticks per frame), `loop/interval`, `render/drawCalls` (WebGL draws per frame), `render/sprites`,
  `render/sceneCount`.
- p95 is over the most recent 1024 samples; mean and max cover everything since the last `reset()`.

## Add a probe label

```ts
probe.begin('render/myPass');
doTheWork();
probe.end('render/myPass'); // same string, properly nested
```

Get a probe without importing the profiler: take a `Probe` as a parameter or option (the loop and renderer have `probe` / `setProbe`;
`main.ts` holds the live one and swaps in the no-op when profiling is off). New sim systems need nothing: `pipeline.ts` labels each
system `sim/<exported function name minus "System">` automatically. Keep labels few and stable; per-entity labels cost more than they tell.
