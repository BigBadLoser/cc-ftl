# Project status and handoff

Living document: update it whenever a milestone lands, a decision is made, or a session ends.
Last updated: 2026-11-01.

**History:** completed-work logs, past PR notes and superseded decisions are in [STATUS_ARCHIVE.md](STATUS_ARCHIVE.md). Standing decisions that live there:
- Sector grid (user, 2026-10-19): each sector becomes one large chunked grid; ships never move or dock with each other; a jump takes the player's ship plus anything docked to it. Plan: "Sector grid (planned)" in ARCHITECTURE.md; user answers in the archive section "Sector grid decision".
- Art pipeline and look decisions from the M4 art rework (session 2026-10-17): archive section "M4 art rework".


**Ship generator:** a separate shipgen session works on ships, stations and room layout. See
[SHIPGEN_HANDOFF.md](SHIPGEN_HANDOFF.md) (scope, file map, sheet commands, backlog) and [SHIPGEN.md](SHIPGEN.md).

## On `main` now (merged PRs through #251)

- **Progression:** blueprints, tiers, research stations (#97); per-faction standing and relations (#128); pirate factions (#137); contraband, scans, fence and
  black-market services (#141); hull planner, shipyard and engine capacity (#134); hull width rule and hull plan brushes (#145).
- **Combat and boarding:** combat rounds 1-2 with pacing, flee, telegraph, damage control, heat and the combat view (#184); readability and the steel palette (#211);
  boarding sim and HUD (#210, #214, #226); stuck-fight fixes (#231); drafted-crew control, roof fog of war, derelict ending (#117, #118).
- **Crew:** traits core with rolled skills and crew card (#243); tabbed crew inspector (#246); skill XP from routine work (#251); new-game flow with title screen,
  ship pick and crew roll (#249); three starter ships, Spine Hauler default (#247).
- **Crew AI:** Phase 0 profiling/baseline (#200), Phase 1 executor, task API and scheduler stub (#207); scheduling and bed-search perf (#196, #228).
- **Economy and world:** station jobs by type (#182); mining and refining as income (#229); trade trips (#115); PixiJS starmap (#124); space backdrop and body art (#219, #221).
- **UI:** ship's log, urgent alerts (#183); lessons engine, combat and trade lessons (#213, #227); Esc menu, settings, rebindable keys, save slots (#216);
  rotating autosaves in IndexedDB, game-over summary (#223); onboarding markers (#220); floating windows (#121); research tree (#114).
- **Tooling:** in-game bug report (#159, #230); gameplay wiki (#161); performance profiler (#189); faster test suite (#235); CI skips drafts and main pushes (#198);
  manual GitHub Pages deploy (#147).
- **Bug batches:** #206, #218, #199, #232.

## In progress

- **Now:** #265 new-game ship preview (shared sheet cache across renderers, branch `fix/newgame-preview-265`); #149 silent save
  failures (branch `fix/save-failures-149`); #266 loading screen while sprites load (prototype, branch `ui/loading-screen-266`).
- **Next, in order (user, 2026-11-01):** derelict salvage (#268, design in DESIGN.md "Salvaging derelicts"), then #194 Crew AI
  Phase 3 (utility AI plus hazard interrupts), then mental breaks ([TRAITS.md](TRAITS.md) section 5b), relationships, addictions.
- **Recently merged:** Crew AI Phase 2 scheduler (#263), pixel-perfect camera at every zoom and DPR (#267, closes #187, #264),
  roof and turret clipping (#262).
- **Temporary:** NPC ships ignore engine capacity until shipgen gives big hulls enough engines (#129).

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

1. The "In progress" list above.
2. Engine Mk II/III art (#105).
3. Renderer follow-ups (#123): render on demand, cached static layers, per-sprite culling.
4. Station intruder bug (#107); prisoners and prizes (#116).
5. Shipgen session (separate): generator backlog (#119), room layout audit (#122), hull glitches (#103), NPC engine capacity (#129).

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

