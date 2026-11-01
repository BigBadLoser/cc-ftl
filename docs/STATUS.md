# Project status and handoff

Living document: update it whenever a milestone lands, a decision is made, or a session ends.
Last updated: 2026-10-27 (main at PR #124).

**History:** completed-work logs, past PR notes and superseded decisions are in [STATUS_ARCHIVE.md](STATUS_ARCHIVE.md). Standing decisions that live there:
- Sector grid (user, 2026-10-19): each sector becomes one large chunked grid; ships never move or dock with each other; a jump takes the player's ship plus anything docked to it. Plan: "Sector grid (planned)" in ARCHITECTURE.md; user answers in the archive section "Sector grid decision".
- Art pipeline and look decisions from the M4 art rework (session 2026-10-17): archive section "M4 art rework".


**Ship generator:** a separate shipgen session works on ships, stations and room layout. See
[SHIPGEN_HANDOFF.md](SHIPGEN_HANDOFF.md) (scope, file map, sheet commands, backlog) and [SHIPGEN.md](SHIPGEN.md).

## On `main` now (PRs #97 to #124)

- **#97 progression phase 1:** blueprints, tiers, research stations.
- **#98 playtest UI** and **#100 playtest render:** playtest fixes to the HUD and the renderer.
- **#106 shield and reactor tier art:** Mk II/III art for shields and reactors.
- **#113 GPU texture fix:** invisible sprites.
- **#114 research tree:** nodes inspectable only when researchable.
- **#115 trade trips and the combat panel,** now on the left.
- **#117 combat:** roof fog of war, aiming from the main view, derelict ending, station relief.
- **#118 drafted-crew control.**
- **#121 floating windows.**
- **#124 PixiJS starmap.**

## In progress

- **Hull width rule and hull plan brushes (branch `build/footprint-width`, #143):** no part of a ship narrower than 3 tiles (3x3 opening, struts exempt); generated
  ships, stations and wrecks obey it; the Hull plan tool gets rectangle (min 3x3, must touch the ship), erase and line-cut brushes with mirror, a world grid, a cursor
  ghost and a collapsing Build menu; `hull.plan` and the yard quote refuse a narrow plan. Playtest with `?scenario=hullplan`. No save change (stays v64). See "Hull width rule
  and the hull plan brushes" in [ARCHITECTURE.md](ARCHITECTURE.md). Open: the line cut's slope set is one list (`LINE_SLOPES`) pending the user's call on 1:2 and 1:3.

- **Progression phase 5 (branch `progression-5`, #125):** plan the outer hull in the build tools (Hull plan, any time, saved with the ship), buy it at a yard
  (station panel quote, contractors build up to the visit cap in EVA, the rest stays planned). Size (interior area inside the outer hull) is the readout everywhere (ship panel, engine
  capacity, jobs screen); the yard prices and caps by tiles built, outline plus floor (station cap 40, hub 100, 10 credits and 0.75 metal a tile). Engine capacity is Mk I 330 / Mk II 495 / Mk III 700 per engine (starter 416 / 660); There is no ship maximum: engine capacity (summed over any number of engines) is the only size limit. Yards truss the whole plan first (real `Struct.Beam` tiles, 2 credits a tile planning fee, outside the cap), then turn trusses into hull row by row up to the cap; leftovers stay as scaffolding for the next yard. The plan's ghost tiles show only in the Hull plan tool or a Shipyard tab. Waiting on screenshot approval.
  See "Engine capacity and the shipyard" in [ARCHITECTURE.md](ARCHITECTURE.md). **Temporary:** NPC ships ignore engine capacity until shipgen gives big hulls enough
  engines (#129).

- **Progression phase 2b slice 2 (branch `progression-2b-market`, #136):** contraband, navy/corporation scans (surrender or bribe), the cartel fence, black-market
  service sets (lesser wired to pirate-held and lawless stations; cartel, zealot and mercenary sets ready to attach but not spawned), shady crew and the node truce.
  Save v63. See "Black markets" in [ARCHITECTURE.md](ARCHITECTURE.md). Waiting on screenshot approval of the scan prompt and the trade screens. Deferred: spawning the named markets
  (station generation belongs to the shipgen session), pirate dens as conquerable stations, shady-crew drawback traits.

## Decisions (user)

- Desktop only; no phone layout work.
- GitHub issues track work.
- Shield tiers are 2x2, 2x3 and 3x3. Reactors are 2x2, 2x3 and 2x4.
- The derelict ending kills everyone aboard. Prisoners wait for the black market phase (#116).
- Enemy roofs can't be lifted without a future scanning upgrade.
- The balance-test cap is 12 minutes.
- Research nodes are inspectable only when researchable.
- Drafted-crew colour is lime `#7ae64a`.

## Open work, in order

1. Engine Mk II/III art (#105).
2. Renderer follow-ups (#123): render on demand, cached static layers, per-sprite culling.
3. Station intruder bug (#107).
4. Build order: phase 5 shipyard, then phases 2/2b pirate factions and black market (#116), then phase 4 upgrade slots.
5. Shipgen session (separate): generator backlog (#119), room layout audit (#122), hull glitches (#103).

Other open issues: #65 sim performance, #60, #59, #54, #53, #52, #51, #50, #49, #48, #47.

## Where things are

**Core systems art (`art/core-systems`):** final Blender art for the reactor (2x2) and life support (1x2): 4 rotations x healthy,
`.unpowered`, `.damaged`, `.damaged.flicker` (dark) and `.destroyed` (60 manifest entries with aliases; sheets `reactor`, `life_support`).
Footprints unchanged. `stateArt` (render) now also picks them generically by hp: destroyed at 0, damaged under half hp (flickering
340 ms lit / 170 ms dark while powered, dark variant while unpowered), then unpowered. Pipeline in `tools/blender/export_core_systems.py`
(see ARCHITECTURE "Core systems"). Awaiting visual approval of the live states before the PR.

**Crew portraits (branch `feat/crew-portraits`, PR open):** the crew bar cards show a face: a front-facing Blender render of the
crew member's real layers (head and shoulders, 58x62 px at 1x), palette-swapped like the world figure. New `portraits` sprite
family (`portrait_render.py`), `render/portrait.ts`, `UiApi.portrait`. The isometric crop was tried first and rejected (a tilted,
tiny head); a 2x render and tall cards were mocked and not taken. Bar cards are about 142x88 px, so `--hdr` grew to 100 / 180 px.
Not done: the legacy `tools/blender/build.py` (old `npm run assets` crew pipeline) has no portraits.

**Art sets:** the 2x set (`public/assets/2x/`), the `?art=` choice and the 2x fallback are gone. `public/assets/1x/` (64x32 art
drawn as hard 2x2 blocks) is the only art set; see "One art set" in [ARCHITECTURE.md](ARCHITECTURE.md). Older notes below that
mention 2x art describe the earlier state.

## Decisions log (beyond DESIGN.md)

- **Workflow:**
  - Visual work: send the user screenshots (default + zoomed) and get approval before merging to
    main.
  - Assets: the user reviews **both** the Blender renders and the pixel sprites before integration.
  - **Preview first:** for art feedback, agents stop at a quick preview (one rotation, low samples
    + denoise, one test scene at 1x/3x, a Blender render) and report. No full sprite builds,
    manifests, extra rotations or wiring until the user approves the look.
  - The cloud container has 4 cores: run at most ~3 Blender-rendering agents at once, one Blender
    process each.
- **Art:**
  - Pixel art pre-rendered from Blender. Models use clean shapes and smooth shading quantised to
    flat bands, with no faceting and no noise.
  - Third-party screenshots the user shares are visual reference only: never trace them, ship
    them, or copy them into `public/` or the pipeline. With the user's permission they are kept in
    `docs/refs/` (see its README): a Space Haven whole-ship shot in the shortest cutaway view, a
    Space Haven walls/doors/hull shot, a Space Haven engine, Space Haven consoles, a Saturn V F-1
    photo, and the user's Sol test renders (the quality bar).
- **Walls:**
  - Interior walls and far exterior walls use the cut-away look in Auto mode.
  - Exterior walls nearest the camera are ghosts: an angled dark footing plus short glass.
  - Doors are always tall.
- **Combat:**
  - No movement or maneuvering. Distance only affects projectile travel time.
  - Combat overlay; consoles (weapons/shields/helm) instead of manning each weapon; the AI core
    runs point defence.
  - Shield generators can sit inside the ship; weapons and engines must touch the hull.
  - **Roofed enemy view** instead of fog: special roof tiles mark weapons, shields and engines
    (`ModuleDef.roofAsset`).
- **Sectors:**
  - A sector is a playable grid holding ships, stations, asteroids and derelicts.
  - A **deploy modal** (simplified sector map) chooses the ship position on entry. It is planned
    for M6.
- **Economy follow-up:**
  - Ship-wide **stock targets** (keep N of item X) that auto-queue crafts on any capable
    fabricator.
  - A UI pass when the user is at their PC.
- **Known art TODOs:**
  - The crew "work" clip renders odd half-bodies.
  - The cyber eye is faint.
  - The fabricator inspector covers the cargo room.
  - Wall corner artifact: the user said "good enough for now".

## Agent workflow (user decision, 2026-10-18)

- **Default model:** subagents run on Sonnet (or Haiku for trivial work).
- **Opus:** only with the user's sign-off. Say why the task needs it and ask first.
- **M4 art follow-ups:** move to a fresh Sonnet agent once the current Opus engine pass lands.
- **Opus exceptions:** the ship generator (`shipgen`) and robots (`robots`) are already approved for Opus.

## Environment notes

- Blender 4.2 LTS headless: `tools/blender/setup.sh` installs it to `/opt/tools`. Previews render
  with Cycles CPU (EEVEE needs a GPU).
- Screenshots use `node_modules/playwright-core` 1.56 with
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, args
  `--use-gl=swiftshader --enable-unsafe-swiftshader`, against `npx vite preview --port <n>`.
- The pipeline's source body model is `tools/blender/source/base_cc0.glb` (CC0, see THIRD_PARTY.md).
- Agents work in separate git worktrees so they don't collide. Commit and push WIP often: sessions
  hit usage limits and the container can restart.

