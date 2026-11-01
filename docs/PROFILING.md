# Profiling (for agents)

Issue #188. Layers report timings through a `Probe` (`src/sim/probe.ts`: `begin(label)`, `end(label)`, `count(label, n)`). The sim only
sees the type and a no-op, so it stays pure; the real probe with the clock is `src/app/profiler/`. Labels are slash-hierarchical.
Costs are reported as **self ms** (time in the label, minus nested labels) and total ms.

## Run it

| Goal | Command |
| --- | --- |
| Per-system sim cost, no browser, deterministic work | `npm run profile:sim -- --ticks 5000 --seed 1` |
| Same on a built scenario (crew AI) | `npm run profile:sim -- --scenario storm --seed 1` (`--scenario list` shows them) |
| Baseline table for every scenario and seed | `npm run profile:baseline -- --seeds 1,2,3` |
| Record or compare crew decisions | `npm run ai:diff -- --record ...`, `npm run ai:diff -- --a x.jsonl --b y.jsonl` |
| Whole game in headless Chromium | `npm run profile -- --scenario log --seconds 20 --speed 3 --seed 1` |
| Colony baseline (no scenario) | `npm run profile -- --seconds 20` |
| In a browser tab | open `/?perf` (optionally `&scenario=..&seed=..`), press **F3** for the panel |

Both scripts print the text report to stdout and write the JSON summary (`--out`, default `profile.json` / `profile-sim.json`, git-ignored).
`profile` starts its own dev server on a free port and stops it by PID when done (`--url` uses a running one instead). It uses the dev
server on purpose: system labels come from function names, which a minified build mangles.

Scenarios are the `?scenario=` values in `src/main.ts`, passed straight through: currently `log` (a raider arrives, fire breaks out, speed 3),
`hullplan`, `handover`, `bounty`, `survey`, `fight` (a raider beside the ship, game running; add `far` for engagement distance, which exercises the combat view and inset) and `damage` (a fire, a breach and a damaged reactor). `none` or no flag is the colony baseline.
`--speed 1|2|3` presses the speed key after load; `--warmup 2` seconds run before the tally resets and the recording starts.

Headless Chromium renders with software WebGL (SwiftShader): `render/present`, `render/gl` and `render/inset` are inflated by it and
the frame rate is low. Trust the CPU-side labels (`sim/*`, `ui/*`, `render/scenes`, `render/sync`, `render/views`) and the counters; compare
GPU-bound numbers only between runs on the same machine.

## Crew-AI tooling (Phase 0 of `docs/CREW_AI.md`, issue #194)

All of it lives in `tools/profile/` (never in `src/`), reads the sim after each step and changes nothing in it. Scenarios are a `newGame` plus existing
debug commands, so any run is reproducible from `--scenario` and `--seed`.

### `profile:sim --scenario <name>`

`npm run profile:sim -- --scenario <name> [--ticks N] [--seed 1] [--out file.json] [--no-metrics] [--stride 25] [--record-decisions f.jsonl] [--dump-board <tick> --board-out f.json]`.
`--ticks` defaults to the scenario's own count; `--empty` and no scenario keep the old start-node run. The text report ends with the metrics block and the
JSON summary has `scenario`, `seed` and `metrics`. The observers (metrics, decision recorder) read the sim from inside probe calls and after each step; their time is measured under `profile/observe` with `Profiler.excluded` (`Tally.excluded`) and removed from every enclosing span, so `sim/tick`, `loop/frame`, the over-budget counts and the `decide` self times are the sim's own. It is printed on its own "instrument time" line (`summary.excluded`). `--no-metrics` and no `--record-decisions` give the plain timing run (the observers still allocate, which shows up as GC noise, not as span time).

| Scenario | What it builds | Default ticks |
| --- | --- | --- |
| `colony` | the populated start node, no extra work | 5000 |
| `hullplan` | a trading hub, an outer hull plan ordered at its yard (hull ring, EVA, thin air), 100+ build jobs on the ship | 5000 |
| `log` | the browser `?scenario=log`: a raider (combat) and a fire at the first crew member | 5000 |
| `hub` | a 44-crew trading hub beside the ship (patrols, big grid) | 5000 |
| `storm` | the six side rooms of the starter ship sealed (doors become walls, crew moved out first), 160+ jobs inside, none reachable | 1500 |
| `haul` | 500 item stacks on the floors of the ship and a hub, few storages | 2500 |
| `multiship` | the ship, a trading station and a navy derelict (salvage; ~100 repair jobs on the wreck, mostly out of reach) | 5000 |

TODO: `fight` and `damage` arrive with PR #184. A prize or a yard crew run is not in `multiship` yet. To add a scenario, append an entry (`name`, `description`,
`ticks`, `populate`, `setup(sim)`) to `SCENARIOS` in `tools/profile/scenarios.ts`: `exec(sim, commands, steps)` queues commands and steps the sim, and tallies
rejected commands in `setupRejections` (a test can assert that the commands that matter went through). Scenario setup ticks count in `sim.tick`.

Costs to expect (one machine, see the baseline in `docs/CREW_AI.md` 7.4): `storm` and `haul` stress `sim/schedule` (`sim/decide` before crew AI Phase 1; `sim/interrupt` is the forced-state detector). They cost tens of ms per tick on the legacy picker and about
0.2 and 0.5 ms since the Phase 2 scheduler, which is the point of them. The other scenarios are quick.

### Metrics (`tools/profile/metrics.ts`)

Ticks, not wall time, so they repeat exactly for a seed (check with `profile:baseline`, which reruns the first seed and compares). They cover the warm-up too.
Definitions, and which field is read before `sim/work` (through the probe) and which after the step, are in the file header; in short:

- **oldest open job age**: per tick the age of the oldest unreserved job (errands and `operate` jobs excluded); `max`, `p95` over ticks, `atEnd`.
- **time to assign**: first seen to first reserved, per job (`p50`, `p95`, `max`); `neverAssigned` = jobs still open at the end.
- **completion**: `crew.jobDone` events by category and per 1000 ticks.
- **idle-with-work** (approximate): every `--stride` ticks (default 25), a crew member who is idle (not drafted, down, eating, claiming a bed, holding a job)
  with an open job of an enabled category that `jobTakeable` accepts (same ship, funded, a walk exists, suit available for thin air). `crewTicks` = samples x
  stride. Not checked: operate/relief rules, and the one tick of lag before the next decide pass.

### Board recorder

`--dump-board <tick> --board-out board.json` writes the board when `sim.tick` reaches `<tick>` (setup ticks count; the run log prints where the run started). The JSON
(`cc-ftl-board/1`, `tools/profile/board.ts`) has per ship the rectangle and run-length encoded nav layers (struct, jam, thin air, module-blocked; `unrle`
decodes), every job, every crew member (position, activity, priorities, job, flags, suit), airlock suit stock and the reservations. `meta` has the scenario and seed, so
the same state can be rebuilt. It is the input for replaying a scheduler candidate offline.

### Decision diff

`--record-decisions run.jsonl` on `profile:sim`, or `npm run ai:diff -- --record --scenario <name> [--seed 1] [--ticks N] [--note "rev abc"] --out run.jsonl`, writes one line
per assignment change `{t, c, job, kind, cat, x, y, name}` (`job` 0 = released) after a header line. The tick is the one the step ran at. Assignments are captured as `sim/work` begins (through the `Probe`, so a job taken and finished in one step still shows) and again after the step.
Record on two revisions (check out each, record, compare) or with two flags, then:

`npm run ai:diff -- --a old.jsonl --b new.jsonl [--context 5] [--match id|site]`

It prints `IDENTICAL` (exit 0) or the first divergence (exit 1) with the decisions before it, the two differing decisions, what only one run decided at that
tick, and what follows in each. Order inside a tick does not matter. `--match site` compares kind and tile instead of job ids, for runs where entity ids may
have shifted. It warns when the scenario, seed or ticks of the two files differ. This is the acceptance tool for the later phases: a refactor that must not
change behaviour records identical files, and a deliberate change shows where it first differs.

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
- Labels: `sim/tick` (whole tick, children are `sim/<system>` and `sim/commands`), `render/{sync,scenes,views,fx,inset,gl,present,main}`,
  `ui/{bridge,events,upkeep}`, `loop/frame`.
- Counters: `loop/ticks` (sim ticks per frame), `loop/interval`, `render/drawCalls` (WebGL draws per frame), `render/sprites`,
  `render/sceneCount`.
- p95 is over the most recent 1024 samples; mean and max cover everything since the last `reset()`.

## Excluded spans (instrument time)

Code that watches the sim from inside a probe call (an observer scanning jobs as `sim/work` begins) calls `profiler.excluded('profile/observe', () => ...)`. The time is reported
on its own (`summary().excluded`, the "instrument time" line of the report) and subtracted from every span open around it, in total and self time, so it never inflates
`sim/tick`, `loop/frame` or the over-budget count. Nested excluded spans count once, under the outermost label; disabled, the function just runs. Do not use it for work
the game really does.

## Add a probe label

```ts
probe.begin('render/myPass');
doTheWork();
probe.end('render/myPass'); // same string, properly nested
```

Get a probe without importing the profiler: take a `Probe` as a parameter or option (the loop and renderer have `probe` / `setProbe`;
`main.ts` holds the live one and swaps in the no-op when profiling is off). New sim systems need nothing: `pipeline.ts` labels each
system `sim/<exported function name minus "System">` automatically. Keep labels few and stable; per-entity labels cost more than they tell.
