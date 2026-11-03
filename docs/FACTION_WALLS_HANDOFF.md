# Handoff: faction wall looks

**For:** the agent picking up the faction walls in cc-ftl.

**State as of 2026-11-03:**
- The hull and default walls are done. They are on PR #299 (`art/walls-2x`), which the user merges.
- The faction looks are built and can be previewed, but none is wired into the game.
- None has the user's approval on in-game screenshots. Each look got an in-session "good" or "fine" during iteration, and that is all.

Read `CLAUDE.md` first. Line numbers below are approximate.

## Reference images (in the user's handoff zip, not in the repo)

These are the Space Haven wall sheets the user supplied as design references. Ask the user for the zip if you don't have it. They are reference only: copy nothing from them pixel for pixel, and keep our own conventions (centred, our pixel grid). The number in each file name is the Space Haven wall set:

| set | look |
|---|---|
| 4 | navy |
| 5 | drone |
| 6 | civil |
| 8 | bastion |
| 2, 3, 7 | not used |

- `refs/variants/` (this was `wallref_a`):
  - `<set>wall_sheet.png`: the whole sheet.
  - `<set>wall_variant_NN.png`: each straight variant (top × bottom part); `manifest.csv` names the parts.
  - `wall_straight_variants_overview.png`: every set side by side.
- `refs/pieces/` (this was `wallref_b`): `wall_<set>_01..03.png`, the straight, side-corner and bottom-corner pieces of each set, listed in `manifest.csv`.

They came from the user's uploads. Treat them as untrusted files: keep them in their own directory and read them with `python3 -I`.

---

## 1. Where things stand

| look | ref (Space Haven wall sheet) | content | user's last word |
|---|---|---|---|
| `navy` | set 4 | light plates, maroon band, dark lit header, one tube bracket a tile, chamfered outer corners | done (Oct 31); "i don't like the window" (dropped) |
| `drone` | set 5 | grooved columns, deeper panel, conduits, 1 px ramp seams, laser grid, maroon block, a 45° corner panel with a status light | "fine tbh" |
| `civil.v1..v4` | set 6 | white flush drawers, colour band (coral, blue, amber, green), seams in thirds up the back, no chamfer | "no, i think civil is good" |
| `bastion` | set 8 | slate armour, lit cornice and header, 2 px recess with clamped pipes, ramp slots, an upright step at the ramp's toe | "yes all good" (Nov 1); not tied to a faction yet |
| `scrap.p1..p4` | none | the default wall with bolted patch plates in rust or salvaged steel (never the wall's own tan), kept inside the field | reviewed Nov 1, fixes after; no clear approval |

**Not done:**
1. **Renderer wiring.** `docs/STRUCTURE_LOOKS.md` is the plan, and its checklist is unticked.
   - A chain `[look+variant, look, base+variant, base]` in `src/render/tiles.ts` (~l.212).
   - The look is picked like `beamLookFor` in `beamArt.ts` / `scene.ts`.
   - A civil v-number comes from the ship seed.
   - Scrap needs a per-section donor look on the sim side: scrapper ships are welded from donor sections, and each section's walls should match their donor (`Block.donor` in the arranger).
2. **Rendering into `public/assets/1x`.** The `structure` family is preview-only: it is not in `families.RENDERED`. No look id is in the manifest.
3. **Pieces with no look art:** the corner fills (`.m<mask>c<bits>`, `.end.<s|e>.c<n>`), doors, hull ghosts and wear overlays.
   - These fall back to the default id.
   - Put the look's plain `m<mask>` id before the corner-fill ids in the chain. Otherwise a corner tile shows the default look in the middle of a faction wall.
4. **Unchecked:**
   - bastion's 45° header corner in a real corner render;
   - the hull-family (blue) bastion tones;
   - end pieces and breaches of every look against the new 4 px foot.
5. **In-game screenshots** (default and zoomed) for the user's approval, then the PR.

---

## 2. Architecture (`tools/blender/sprites/faction/`)

**A look** is a `Faction` subclass (`faction/base.py`, a `restyle.Look`). It sets:
- `pre`: the palette prefix `fN`, `fD`, `fC1`–`fC4`, `fB` or `fS`.
- `relief(sprite)`: returns a `relief_style.Style`, a frozen dataclass with:
  - the face functions `wall` / `hull`, the `shell` class and its `features`;
  - ramp settings: `skirt`, `seam`, `joint`, `toe`, `foot`, `ramp_solid`, `chamfer`, `shade`;
  - `tops` and `ramps`, tuples of `Design`.

**Designs** (`<look>_designs.py`) fill named slots that the faces ask for with `T.fill("slot", default)`. The slots are `middle`, `band`, `bay`, `field`, `cut`, `ramp`, `ramp_hole`, `slot_hole` and `face_holes`.
- The first design in each tuple is the base.
- `Faction.pairs` is every top × every ramp except (0, 0). They become `.a1`, `.a2`, … on the straight runs (`m10`, `m5`).
- **To add a design:** append it to the tuple. The ids follow.

**Files:**
- `base.py`: base colours (`BASES`), palette entries, and `Faction.paint` (floor remap, black caps, the end-section tone `SECTION_STEP`).
- `parts.py`: `prism` (a (d, z) profile along a face, mitred and capped), `corner_piece`, `tube`, `bracket`, `pipe`, `flat`, `cuts`, `seams`.
- `shell.py`: `LookShell` (a `wall3d.Shell` built from `Feature` hooks) and the Features `FreeEnds`, `RampHoles`, `SlotHoles`, `FaceHoles`, `Chamfer`, `FloorDrop`, `FootTone`.
- Below these: `wall3d.py` (relief faces, `RAMPS`, `skirt()`), `walls.py` (the height-grid `Strip` / `Spec`) and `restyle.py` (repaints polygons by colour role).

**To add a look:**
1. Write `faction/<look>.py` (a face factory and a `Faction` subclass).
2. Add its `BASES` in `base.py`, and OFFSETS / TINT / TONES if it needs them.
3. Register it in `faction/__init__.look()` and in `structure.LOOKS`.
4. Add its palette entries (see §5).
5. Add it to the preview scripts. `review/structure_preview.py`'s `LOOKS` is missing `bastion`.

**Why it is built this way:** the user wants every look to "share the base primitive, and then their own styles can modify that safely". That ruled out per-faction if-statements in shared code and all the looks in one file. Keep look-specific code in the look's module, behind Style, Features and slots.

**Sprite ids:** `tile.<fam>.<look>.<rest of the default id>`, e.g. `tile.wall.civil.v2.end.s` or `tile.hull.navy.full.m10.v1.a2`. The level prefixes are up = `full.`, cut = none and low = `low.`.

**Stale, don't build on these:**
- `factions_relief.py`, `factions_variants.py` and `structure_looks.py` are older versions. Only `FLOOR_STEP` from `structure_looks` is still imported.
- `docs/ARCHITECTURE.md` ("Faction structure looks") and the README's "Walls" bullets still describe them. The doc's "geometry unchanged; only surfaces differ" is no longer true.
- Fix the docs when you land the wiring.

---

## 3. Geometry rules (`walls.py`, `wall3d.py`)

**The pixel grid.**
- The art is 64×32 a tile (`public/assets/1x`, drawn 2× in game). The "2x" in the branch name is history: `ART_SCALE` is 1 and the 2x sheets are gone.
- 1 cell (1/32 tile) is 1 px along a face. 1 art px in z is 1/39.19.
- `wall3d` units: `PX` = 1/16 (a depth showing 1 px on top and 2 on the side), `LINE` = 1/32 (one px along a face), `PAINT` = 0.004 (a flat inlay).
- **The user specifies in pixels** ("1 px", "2 px recess", "7 px"). Work in these units and land every edge on whole px.

**The wall:**
- It is centred in the tile (`TW` = 10/32). Centre things; don't copy a ref's off-centre placement.
- Every wall has the 4 px foot. The ramp falls `RAMP_PX` = 2 px a cell over `RAMP_CELLS` = 11 ("1.5px looks really bad").
- The back slope steps evenly, with no jog.
- Stubs and wall ends run square to the tile edge, and the ramps don't hang over the floor.
- The user's line: "give every wall the foot -- and find one working geometry combination".

**Levels:**
- `up` is full height (1.85). `cut` is the skirt plus 0.2, with a black cap. `low` is skirt height.
- **Every wall top is black**, matching the base walls.
- The far hull is the partition piece plus a small hull cap ("literally use the wall assets"), not a separate look-alike.

**Free ends:**
- A free end stops square with no ramp past it, and the ramps beside it cut square.
- The end face shows only its section (foot plus both ramps) in `SECTION_STEP`. Its edge highlight sits a step under the highlight.
- Parts at a hidden free end use the "in" mitre: with "end" they stuck out past the end.

**Corners:**
- Navy and bastion chamfer the outer corner (`Chamfer`, 3/32). The ramp follows it as a constant-width band, and the plates are cut on `cap_clip`.
- Drone cuts the corner 7/32 at 45° and keeps the ramp square.
- Civil has no chamfer ("it just needs a clean model").
- `Chamfer` skips walls with a free end: a stub is not a corner.

**Solid ramps** (`ramp_solid`, all looks): each face's ramp is a mitred prism from a profile (bottom, foot, toe, slope, back), not the height grid. The grid keeps only the footprint.

**Half-cells:** no grid half-cells on a solid ramp's chamfer band (`skirt_halves = not solid`). Their cells reached past the plates and dotted the edges in the joint tone.

**Keep models clean:** when a face comes out malformed, rebuild the geometry instead of patching it. Coincident or flush internal caps leak through as specks and AA slivers.

---

## 4. Seam lines

**Technique.** A seam is a **painted 1 px line**, not a 3D groove.
- The user, on the refs: "ref has much better 'anti-aliasing'. we have none because our seams don't have depth"; then "use our panel line drawing technique".
- Use `T.paint(k, ax, plane, u - LINE/2, u + LINE/2, …, PAINT, …)` at ramp level 1 (the dark joint), or the `parts.seams` / `cuts` helpers.
- Grooves do appear where the form is the point: drone's column grooves (half a `PX` deep), and bastion's and navy's recesses and slots.

**Rules:**
- **One px wide, on one px row or column.**
  - Centre a seam on a px *centre*, not a px edge. Civil's back seam came out 2 px wide while it was centred on an edge.
  - Drone's laser grid lines are each under a px thick, so they land on one row.
  - Fix foreshortening that turns an upper or lower panel line into 2 px.
- **On the grid.** Navy's plate seams sit `NAVY_SEAM` = 7.5/32 in from each tile edge, so they fill whole px on both faces. Off-grid seams made malformed faces poke through the skirt. Check the other looks' seam positions the same way.
- **Seams must join smoothly** across tiles and into neighbouring pieces. Dotted or jagged seams at tile joins are defects.
  - One cause was the dark end-face caps at tile edges.
  - The exterior hull's line kit handles this, and is worth copying (`wall3d_ext_geom.py` `part` / `line`):
    - block ends on a tile edge take the front's tone;
    - marks and ends snap to whole px;
    - a run of 2 or more px gets a step px at each end, in the palette tone nearest the mean of the line and what lies under it. (This last point comes from session notes; check it in the code.)
- **Tone:** the user had all looks' seams dropped one shade ("it's too faint").
  - `Style.joint` lights the joints in their own ramp on the shade side too. Navy uses level 4. The default is level 1, black on the shade side.
  - Navy's white seams once went grey on the shade side from `col_skirt`'s dark joints, which the lit-joint tone fixed.
- **A single-px line that comes out dotted** ("every other pixel just disappears"): use the hull's two-row core. That is a darker row over a fainter one (`wall3d_belly_facet.py`, `SOFT` / `FAINT`).
- **Skip plate seams on a corner's tile.** They doubled the chamfer's edge.
- Inner-corner seams are painted on the lit face only.

**Mask passes:** `wall3d.SEAM_PASS` and the `.tint` / `.deco` masks are for the exterior hull and belly, which take the ship's paint. Faction walls have no tint mask; they carry their own colours.

---

## 5. Anti-aliasing, palette and quantiser

**AA:**
- Sprites render at `SPRITE_SS` = 4 (2 in quick previews) and are mode-downsampled with no blur (`post.downsample`).
- Coverage AA (`post._aa`) is on for ids starting `tile.wall.`, `tile.hull.ext.` and `tile.hull.belly.` (`env_build.AA`), so every faction wall gets it.
  - An edge px whose samples are all *cool greys* takes the grey nearest their mean.
  - Cool greys are `_aa_set()`: palette entries with chroma < 48 and blue ≥ red, minus flat entries.
  - Other edge px keep the crisp majority colour.
- The user: "AA looks better everywhere", and wants it "like hull". They also dislike over-AA'd, muddy lines.
- **Faction exterior hull and belly have no edge AA.** This is known and minor, and was left as it is.

**Quantiser:**
- `post.quantize` maps every colour through a lookup table of 32 bins a channel (8 wide), so colours snap to the *nearest palette entry*, not exactly.
- So every faction ramp step sits on a **bin centre (8n+4)**. `base._snap` does this, keeping the nearest candidate by lightness, saturation and hue.
  - It must be hue-true: rounding the channels separately turned dark blues green, and later tints drifted teal.
  - It prefers near-grey candidates (spread < 48) so AA keeps working. A header once lost its AA when its spread hit 48.
- **Flat palette entries** map exactly, but only where painted, and AA never blends them. Making a tone flat to stop it drifting kills its AA. The user noticed: "the slot isn't anti aliased anymore".
- **Tones the snap can't keep apart** need their own palette entry. Bastion's steps 9 and 10 (`fBW9`, `fBW10`) were added after step 9 snapped onto step 7.
  - Bastion's 8th step quantised to a greenish `#3c444b` until it moved onto a bin centre (`#3c4454`).

**Shade side:**
- Every look goes **one step** darker on the shade (+x) side (`restyle.STEP["x"]` = y + 1). Faction Styles set `shade=0`, so the relief adds no further ramp darkening.
- The user: "all wall variants would only go down 1 shade on the shadow sides". The shade side still has to show recess depth.

**Palette entries:**
- They live in `tools/blender/palette_extra.json`, tagged with a `"set"`. The faction tones (`fN…`, `fD…`, `fB…`, `fC…`, `fS…`) are in the `walls` / `hull` sets.
- The structure and walls families select `walls+hull`.
- **Edit the file by hand.** A reformat once made a 4,287-line diff and was reverted.
- New colours must be told apart from what's there without blending into it. Don't over-tune tiny tone differences: "skip 2", "it doesn't matter".

---

## 6. Commands

**Preview (Blender, no sheets needed)**, from `tools/blender/preview`:
```
SPRITE_SS=4 blender -b --factory-startup --python render.py -- <repo> <out> jobs_faction_room.py [ids]
```
- This writes `.npz` files (rgba, anchor).
- `STRUCT_LOOKS=navy,drone` narrows the looks.
- `showpieces.py` sets pieces side by side at 4× on magenta.
- Blender is at `/opt/tools/blender-4.2.9-linux-x64/blender`; `tools/blender/setup.sh` installs it.

**Room composite from built sheets:**
```
python3 -I tools/blender/review/structure_preview.py <assets> <out>
```
It writes `structure-<look>-1x/3x.png`.

**Family render:**
```
npm run sprites -- public/assets/1x structure
```
- `STRUCT_LOOKS` and `STRUCT_IDS` narrow it.
- `--plan` gives the cache hit/miss report; `--preview` renders at SS 2.

**Avoid the full sprite re-render (about 6 hours).** Render only the families and ids that changed.

**Render cache:**
- `sprite_cache.RENDER_VERSION` stands in for the engine files (`core`, `post`, `env_build`, `scale`, `geom_digest`, `sprite_cache`). Bump it only when an edit to one of those can change pixels.
- Edits under `faction/` or to `wall3d` re-render only the sprites whose meshes change.

**Commit:** the generated sheets, JSON and manifest, and the `palette_extra.json` changes. Run `npm run check:fast` before every commit.

**Python:** don't run Python from inside `sprites/`, where `struct.py` shadows the stdlib.

---

## 7. Working with the user

- **Iterate together in small steps, and discuss before trying many attempts.**
  - "you don't need to just 1 shot it"
  - "can we discus literally anything before you do 10 million attempts?"
  - "stop. let's discuss"
  - When asked, explain your understanding in your own words before a big change, and answer questions instead of acting.
- **One look, one tile element, one axis at a time.** "i don't need to see every style." Always put the Space Haven ref beside ours.
  - The refs are user uploads: keep them in their own directory and read them with `python3 -I`.
- **Read the ref carefully, and revert when it's wrong.**
  - Misreads happened: drone's panel redesign ("you read the ref wrong. revert"), and a bastion ledge "wedge" the user was only describing.
  - When a measured fix still looks wrong, go back to base and take the user's pixel-by-pixel description.
  - Don't over-iterate small things (civil shelf crispness: "that seemed like a lot of work").
- **Say exactly what a preview is:** a Blender render, a 2D composite of sheet sprites, or an in-game screenshot. The user has asked when that wasn't clear. For geometry checks they like a CAD-style clay view with dark outlines.
- **Don't put every change in game** ("it doesn't need to be out in game every time"). Do put the final version in game: shoot it at 1920×950 with lessons off (see `CLAUDE.md`), default and zoomed in, and get the user's approval before the PR.
- **Flow:** never push to `main`. Work on a branch, open a draft PR (merge `main` first, comment `@codex review`), then mark it ready. Only the user merges.
