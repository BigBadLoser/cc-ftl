# Prompt: faction structure variants (hull, interior walls, floors) for cc-ftl

(Paste `common.md` above this prompt. Base `art/structure` on `main`.)

**Task:** give each ship faction its own structural look, so a navy warship, a drone, a civilian freighter and a scrapper read differently from their hull and walls alone, before you see a single module. This is the next step in ship variety. The ship generator (`src/sim/shipgen/`) already tags every generated ship with a faction (`ship.gen.faction`: `faction.navy`, `faction.drones`, `faction.civilian`, `faction.scrapper`), and the beam art already switches look by faction. The walls and hull should do the same.

**Read first:**
- `tools/blender/sprites/walls.py`, `hull.py`, `wallart.py` and `floors.py`, plus the roof livery files (`roof_livery.py`, `roof_variants.py`), for how the current tiles and liveries are built;
- `src/render/tiles.ts`, for how the renderer picks sprites;
- the `tile.hull.*`, `tile.wall.*` and `tile.floor.*` entries in the manifest.

Tiles are chosen through **fallback chains**: the first id in the list that exists is drawn. So faction sets must use the **same ids with a faction segment**, which lets the renderer try the faction id first and fall back to today's default:
- `tile.hull.<faction>.o<o>.m<mask>`, `tile.hull.<faction>.belly...`, `tile.hull.<faction>.drop...`
- `tile.wall.<faction>.<level>...` for the interior walls, at every level and with every end piece
- optionally `tile.floor.<faction>...`

`<faction>` is `navy`, `drone`, `civil` or `scrap`. Keep every geometry, mask, height and cutaway rule exactly as the default set: same silhouettes, same `walls.HF`, same ghost and cutaway behaviour. Only the surface treatment changes. A faction set can leave out any id it doesn't need to change, and the default fills in.

**Looks:**
1. **Navy.** Clean, heavy, military. Thick armour panels with strong bevelled seams, hazard or number stencils used sparingly, a cool grey-blue with a restrained accent. The hull belly should look armoured, with ribs and plate overlaps. Interior walls are tidy, with paneled bulkheads and maybe a thin accent stripe.
2. **Drone.** Machine-built, no crew comfort. Dark, near-black machined panels, a hex or circuit inlay, thin cyan status lines (on the glow sheet, sparingly), no stencils or text. It should feel uninhabited. Interior walls are mostly exposed conduit and frames rather than finished panels.
3. **Civilian.** Plain and commercial, and the family that needs **more variants** most: freighters, liners, miners and stations all share it. Make 3–4 colour and pattern variants (`.v1`..`.v4`: for example cream with orange trim, faded green, corporate white with blue, industrial yellow-grey), picked per ship, plus the existing per-tile subtle variation. Panels are simple and a bit cheap.
4. **Scrapper: a post-process pass, not a new hand-built set.** Write a reusable Blender or image post-processor that takes any finished tile set (default or another faction's) and makes a patched, rusted version:
   - rust streaks and stains;
   - welded seams;
   - mismatched replacement plates in other factions' colours (salvaged);
   - bolted patches;
   - occasional exposed ribs.

   Generate it as `tile.*.scrap.*`, with several per-tile variants (`.p1`..`.p4`), so a hull run doesn't repeat. Keep it at least 2 px per detail and **no texture noise**. Big clear patch shapes, a few streaks, readable at 1x. Ideally the same post-processor can later be pointed at module sprites too, to make scrapper versions of modules. Design it with that in mind and say how it would work.

**Preview first, then stop:**
- one small test room (about 8×6, with an outer hull corner, a straight hull run, an interior wall with a door, and a concave step) rendered in each look: navy, drone, civil `.v1` and `.v2`, scrap (post-processed from default);
- a crew member for scale;
- the cutaway view and the roofed or full-wall view;
- at 1x and 3x.

No full builds. Render quickly, then wait for feedback.

**Integration note for later (not your job):** the renderer will pass the ship's faction look into `wallPieces` and the floor and hull chains in `src/render/tiles.ts`, the same way `beamLookFor(ship.gen.faction)` picks beams. List the exact id patterns you produce so that wiring is mechanical.
