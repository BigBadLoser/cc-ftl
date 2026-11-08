# Prompt: structural beam (truss) tiles for cc-ftl

(Paste `common.md` above this prompt. **Branch override:** base `art/trusses` on `shipgen`, not `m4-integration`. Only `shipgen` has the beam tile and the generator that places it. Don't touch `src/sim`.)

**Task:** final art for the exposed structural beam tile, `Struct.Beam`, which replaces the procedural stand-in in `src/render/beamPlaceholder.ts`.

**Read first:**
- `src/render/beamPlaceholder.ts` and the `Struct.Beam` branch in `src/render/gridView.ts`, to see how beams are drawn today;
- `beam()` in `src/sim/shipgen/droneBlocks.ts` and `civilFrames.ts`, to see how the generator lays beams out;
- `docs/SHIPGEN_HANDOFF.md`, for the generator overview and the sheet commands.

To see real layouts, render the structure-view sheets (`structure` view; beams show magenta). Factions to render:
- drones (all topologies);
- civilian mining (cage and boom);
- freighter (frame and tug);
- stations (lattice and spokes).

**What a beam is in the game:**
- Beams are unpressurised, non-walkable tiles outside the hull: open space framework, not rooms.
- They come in straight runs 1–3 tiles thick and up to about 20 long, horizontal or vertical on the grid, joined into L, T and + junctions. They end either free in space or against a hull wall.
- Pods, holds, engines and gun mounts attach along a beam's sides. Their hull walls touch the beam; the beam never passes through them.
- Crew don't walk on beams. Robot crawlways are ordinary narrow rooms, so they're not part of this job.
- Beams are seen from above at every wall view (up, cutaway and low), so the art must read the same in all three and must never hide crew or modules behind it.

**Sprites:**
- The tile is a 64x32 iso tile. Use a 4-neighbour connection mask like walls and roofs: `struct.beam.m<mask>` with N1, E2, S4, W8, so all 16 masks join seamlessly into runs, corners and junctions.
- Add a few variants per straight mask (`.v0..v2`) so long runs don't repeat.
- **End caps:** the mask already gives a free end. Also make a distinct capped-end look, and a mounting-flange look where the beam meets a hull wall.
- **Height:** low and open. It is a lattice truss (chords plus diagonals) whose top sits well under the wall height, about 0.5–0.8 units, so it reads as framework and not a wall. Ships seen from above have to show their beam skeletons clearly.
- **Faction looks**, sharing one mask layout:
  - `navy`: clean box truss;
  - `drone`: dark machined spar with a few cyan status lights;
  - `civil`: cheap industrial lattice with hazard bands at the joints;
  - `scrap`: patched, mismatched beams.
- If one look works for everything, say so and we may drop the variants.
- **No floor slab under beams.** Space shows through the lattice.

**First preview:**
- a test layout at 1x and 3x, showing a straight run, an L, a T, a + junction, a free end and a hull-wall flange, with one pod module and a crew member inside a nearby room for scale;
- the drone and civil looks only.

Render quickly, then wait for feedback.
