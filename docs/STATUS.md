# Project status and handoff

Living document: update it whenever a milestone lands, a decision is made, or a session ends.
Last updated: 2026-10-17.

## Where things are

**On `main`** (live at https://cc-ftl.bigbadloser.workers.dev):
- **M0–M2:** the core sim (ECS, grids, commands, saves), crew, jobs, priorities and drafting.
- **R1:** the PixiJS isometric pixel-art renderer with the Blender sprite pipeline. Tiles are 64x32.
- **Walls:** autotiled, with low cut-away blocks, full-height versions, ghosts for the exterior walls
  nearest the camera, and tall door frames. Floors use one main plate plus rare variants.
- **Crew art (A1):**
  - Body: the CC0 Quaternius base, variant D (stylised and upright).
  - Settings: 4 shading bands, smooth shading, no eyes, one composite outline plus a cool rim
    (renderer filter).
  - Engineers get the cyan cyber eye.
- **M3a ship systems:** power, per-tile atmosphere, fire, light, temperature, vitals,
  downed→bleed-out→death, rescue to beds, overlays, alerts, the module inspector and the build menu.
- **M3b economy:** items, storage with filters, hauling, build costs with delivery, the fabricator
  (orders: make N / keep N), the stock drawer, and item and fabricator sprites.

**In progress** (not merged; each branch has its own worktree):

| Branch | Worktree | What | State |
|---|---|---|---|
| `m4-combat` | (base) | M4 combat **sim** (sector, ships, weapons, shields, consoles, AI core, projectiles, enemy AI, wrecks, flee) | Done, 138 tests. Not merged because its modules have no sprites yet. |
| `m4-assets` | `/home/user/cc-ftl-m4art` | M4 sprites: weapons, engine, shield gen, consoles, AI core, roof tiles, projectile and fx sprites. Review sheets in the scratchpad `m4art/` | Done, pushed (3 commits). Review sheets sent to user, awaiting approval. Integration notes: small shield gen def must use `module.shield_gen_small`; moduleArt needs `.charged` (weapons) and `.active` (engine) suffixes; roofs are `roof.<kind>.m<mask>` (N1 E2 S4 W8); projectiles point screen-right (renderer rotates) |
| `m4-ui` | `/home/user/cc-ftl-m4` | M4 combat overlay, targeting, projectiles, fx, roofed enemies, Spawn raider debug. Fallback sprites via `src/render/assets/fallback.ts` (real ids swap in automatically once in the manifest) | Built, pushed (08e9d7c). Fixed: transparent hole in overlay preview, roofed enemy hides interior (fallback roof = light slate, red/cyan/amber module roofs), bigger fallback projectiles. Open: phone sheet slightly translucent; preview 0.5 scale breaks integer zoom; raider downs player crew in ~2 min (tune in m4-combat) |

NEXT (handoff): user has NOT yet approved the m4-assets sheets (review sheets: re-render with `tools/blender/review/` if needed). Reviewer flagged: roof floats above hull walls in the roofed mock; roof markers quiet. After approval: swap the fallback ids for the real ones, take screenshots, get user approval, then merge
m4-combat + m4-assets + m4-ui to main.

Old branches (`m0`…`m3b-ui`, `r1-*`, `walls-*`, `asset-pipeline`, `crew-art`, `a1-readability`)
are already merged or superseded. Don't build on them.

## M4 art rework (session 2026-10-17, supersedes the m4-assets sheets)

The user did not approve the first m4-assets sheets: modules were far too small. Agreed direction:
- **Style:** ENGINES ONLY get the Space Haven-like industrial detail (brass, pipes, bolts, valves,
  greebles; helpers in `tools/blender/sprites/detail.py` and `greeble.py`). Consoles and weapons
  stay clean and sleek (smooth panels, seams, colour from screens/lights/emissive strips). Every
  detail >= 2 px at game scale; flat bands, no texture noise. Run the overlap check
  (`overlap.py`) on every new model.
- **Consoles:** the user likes the chairs and screens of the `m4-art-consoles` prototype.
- **No module floor slabs:** modules sit directly on the ship floor (no plinth/deck plate).
- **Walls redesign** (branch `walls-tall`, not merged): height alone was not the problem (tried 2.2
  and 3.0; settled ~2.4, crew are 1.5). Space Haven-like profile: base covers the whole tile, thin
  top, ONE slope that always faces the camera, vertical back. Hull is a separate chunky
  colour-blocked armour band. Interior walls get their own colour and subtle seams (lockers and
  lights are placeable modules, not wall art). Doors are deep recessed portals in a strong colour,
  ~1.5x crew height; a lower cutaway variant exists.
- **Engine:** the v7 bell is approved. Add real rocket plumbing (torus manifold, turbopump,
  ducts, tubes down the bell); no valve wheels on posts.
- **Weapons picked** (Opus concepts, branch `opus-weapons`): burst laser = S Sponson, mass driver =
  H Halo, R Revolver's six-barrel rotary = point-defence turret asset. Bay core column runs full
  height to the roof. Engine stays with Sol (the Opus engine preview on `opus-engine` is reference).
- **Roof:** v1 (`roof-art`) rejected as random; v2 must follow ship structure (ribs along walls
  below, one panel per room, one colour rule, purposeful details only).
- **Engine and weapons art handed to Sol** (user's choice, 2026-10-18) using the prompts in this
  session's scratchpad `sol/` (shared context + engine + weapons). All of our engine passes and
  weapon concepts were rejected; keep them only as code reference.
- **Weapons (history):** square-barrel prototype rejected. Restarting with round barrels; concept sheet
  with 3 directions for the user to pick.
- **Roof parts fold away:** turrets, shield-gen dishes and the AI core mast stow into their
  modules when not in use and deploy (~2 s, 5 frames) through a roof hatch. Turrets and dishes
  deploy in combat or with an enemy in range; the AI mast whenever powered; unpowered stows.
  Gameplay effect (for now, tunable): weapons can't fire and shields don't come up until fully
  deployed. Ghosted on the player's ship only while deployed.
- **Consoles APPROVED** (branch `m4-art-consoles`, pass 5 plus pass 6 cabinet removal): helm 3x2,
  weapons 2x2, shield 3x2 with counter ending at the projector, seat centred on the monitors, and
  one empty walkable tile inside the footprint (modules can have several walkable tiles).
- **Sizes:** engine 4x5 (4 along the hull); helm 3x2, shield console 3x2, weapons console 2x2, each
  with its chair as a walkable access tile inside the footprint (needs per-tile solidity in the sim);
  light weapons 2x2, heavy 3x3; shield gen 2x3, small shield gen 2x2, AI core 2x2. Ships get bigger
  (starter ~30x20, raider ~24x16 with fewer modules).
- **Engines replace the hull wall** where placed and carry their own armoured bulkhead (it
  is always full height: it never collapses in the cutaway view). One big bell per engine
  (~2.6 tiles), in the cleaner v5 bell style (few rings). Bells protrude into space. Engines may block the view. A destroyed
  engine just stops working (no breach).
- **Weapons:** a floor module (the bay: breech, feed, loader) anywhere under the roof, plus a turret
  on the ROOF above it that aims (8 pre-rendered directions) and fires. On the player's own ship
  the turret is drawn semi-transparent at roof height. Shield gens and the AI core also get roof
  parts (emitter dish, antenna mast). These roof parts replace the quiet roof markers.
- **Process:** engine prototype first (`tools/blender/sprites/engine_proto.py`,
  `tools/blender/review/proto_*.py`), user approves the look, then the other modules, then sim and
  layout changes, then balance tuning (raider currently wipes the crew in ~2 min).

**m4-combat sim updated** (075b63a, 5993855, 1b0e482): `ModuleDef.openTiles` (walkable tiles in a
footprint), `hullEdge` engines that replace the hull wall (airtight, no breach), weapons as floor
bays with `WeaponC.aim` 0..7 (`turretSystem`, `turretPosition()`), new footprints, starter 30x20,
raider 24x16, save v5. Balance tuned with fixed-seed scenario tests (manned player wins, no deaths
in 4 min unmanned). User approved: repair rate 12 → 3/s, starter ion cannon → second burst laser.

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
  - Third-party game sprites the user shared (in the scratchpad `ref-walls/`) are visual reference
    only. **Never copy or commit them.**
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

## Environment notes

- Blender 4.2 LTS headless: `tools/blender/setup.sh` installs it to `/opt/tools`. Previews render
  with Cycles CPU (EEVEE needs a GPU).
- Screenshots use `node_modules/playwright-core` 1.56 with
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, args
  `--use-gl=swiftshader --enable-unsafe-swiftshader`, against `npx vite preview --port <n>`.
- The pipeline's source body model is `tools/blender/source/base_cc0.glb` (CC0, see THIRD_PARTY.md).
- Agents work in separate git worktrees so they don't collide. Commit and push WIP often: sessions
  hit usage limits and the container can restart.

## Next milestones

- **Finish M4** (above).
- **M5:** boarding and derelicts. Portal graph across grids, airlocks and teleporters, EVA,
  crew-vs-crew combat, capture, exploring wrecks.
- **M6:** galaxy and sectors. Deploy modal, events, stores, factions.
