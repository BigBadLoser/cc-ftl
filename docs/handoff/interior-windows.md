# Handoff: interior windows (wall styles)

Branch `art/hull-windows`. Read this before touching interior windows. Keep it current: add a line at every step.

## What an interior window is
A straight partition (mask 10, along x) opened between its end posts, with a beam over the opening and a see-through
pane. Pieces per look: `tile.wall.<look>.full.m10.win.l` (post at -x), `.win.m` (open across), `.win.r` (post at +x).
A 2-tile window is l + r, a 3-tile one l + m + r, a 4-tile one l + m + m + r.

## Refs (user uploads; unzip into the scratchpad before use)
Uploads dir: `/root/.claude/uploads/d90bd30e-5bfe-51f0-9d45-019095d96471/`.
- `fe3a3595-Space_Haven_Interior_Windows_Tiles_v2.zip` (same as `b4deef86-...`): the main set.
  `wall_style_<id>/<n>_tile_window_<wid>/{full,small}/`: `tile_0N_W1/W2/W3.png` (each tile rendered on its own),
  `assembled_from_tiles.png`, `placement.csv`. `all_tiles_manifest.csv` lists every tile.
  - **`full` = the T layer (upper: posts, beam, the cap's black with the two blue lines).**
  - **`small` = the B layer (lower: the ramps under the opening, the pane).**
  - **The whole window is both layers. Always show and compare both, never `full` alone** (the user: "that's half
    the ref, where are the ramps?").
- `b40ae0cd-Space_Haven_Interior_Wall_Windows_Attachment.zip`: the same windows as single assembled PNGs
  (`wall_<wid>_full.png`, `wall_<wid>_small.png`), `source_manifest.csv`, and `far_hull_window_inside_example.png`.
- Plain wall refs (not windows): scratchpad of the cc-ftl session, `walls/ref_zip/wall_<set>_0N.png` + `manifest.csv`
  (set -> object id: 2=44, 3=43, 4=122, 5=423, 6=428, 7=3168, 8=3295).

## Style -> our look -> status
| Ref style (set) | Our look | Window ids (2/3/4 tiles) | Status |
|---|---|---|---|
| 43 (set 3) | tan | 2768 / 2767 / 2866 | built: `sprites/wall3d_iwin.py` |
| 3168 (set 7) | default teal (`tile.wall.full.m10`) | 3173 / 3174 / 3175 | built: `sprites/wall3d_iwin_def.py` |
| 44 (set 2) | slate | 2757 / 115 / 2861 | to do |
| 122 (set 4) | navy | 2772 / 2771 / 2862 | to do |
| 423 (set 5) | drone | 2765 / 2764 / 2863 | to do |
| 428 (set 6) | civil | 2770 / 2769 / 2864 | to do |
| 3295 (set 8) | bastion | 3296 / 3297 / 3298 | to do |
| none | scrap | | no ref |

Slate's ref (44) at a glance. T layer: grey posts with a stepped foot; a blue beam with a raised block over the
middle tile; the cap's black with two blue lines. B layer: a grey ramp block under the opening, its top dished down
between the posts, recessed pockets on its front (lit blue floors, two per middle tile), blue end blocks at the posts,
an amber strip on the floor in front, the pane standing on the ramp's top. Needs its own module, not the default's.
Ref sheet with both layers per tile: scratchpad `iwref/ref44_layers.png` (built from the v2 zip).

## Reuse across the refs (from the 3-tile refs, both layers; overview sheet: scratchpad `iwref/all_window_refs.png`)
- Common to every window: end posts on the l / r tiles, a beam across, a ramp block under the opening with the pane
  standing on it, an amber strip on the floor in front. Two blue lines on the cap: all but civil.
  So the machinery (`window()` / hook wrapper, `_cut` + `_clip`, pane edges, `GLASS` + the glass kind, cap lines) is
  shared. It is duplicated now in `wall3d_iwin.py` and `wall3d_iwin_def.py`: factor a common core before adding five.
- Slate (44) is the default (3168) almost shape for shape. Lower layer: the same dished top, pockets on the front and
  end blocks with dark openings; the amber end blocks become blue, the pockets' floors lit blue. Upper layer:
  rectangular opening, posts with a stepped foot like the default's; the beam one raised block over the middle tile
  (the default's has several). Build it as the default's module with look parameters.
- Bastion (3295): upper layer rectangular like the default's (dark, bricked posts, beam blocks); lower layer dark
  panels. The default's structure again, own detailing.
- Navy (122): upper layer rectangular, posts with a flared foot, a red light strip along the beam with clamps;
  lower layer differs: tall end blocks over a low middle with pockets, red stripes.
- Drone (423): upper layer a white pipe beam with clamps, posts with a red block and a flared foot; lower layer red
  boxes either side of a middle console.
- Civil (428): the odd one: posts curve into the beam (rounded inner corners: tan's arch code is the closest start),
  no blue cap lines, a red edge along the beam; lower layer a white ramp with a recessed panel, a red stripe low.
- Suggested order: slate, bastion, navy, drone, civil.
- The amber floor strip in every ref's lower layer: ours leave it out (the user: "it's fine").

## How the built ones work
- `wall3d.block` calls `T.PRE_HOOK(sp)` as a piece starts and `T.HOOK(k, sp)` on its Relief before it builds.
  `window(fn, part)` sets them while its piece builds; `hook()` cuts the opening (`_cut`, Sutherland-Hodgman `_clip`),
  closes the cut (posts' sides, sill top, beam underside), adds the pane edges and the two blue lines on the cap, and
  builds the pane as a separate Relief (`GLASS`).
- Render kind "glass" (scratchpad `scripts/jobs_window.py` patches `env_build.render_sprite`): solids as usual, the
  pane in its own pass, tinted (`TINT`, `ALPHA`).
- Job scripts, now in the repo (`tools/blender/preview/`): `jobs_window.py` (the glass kind), `jobs_iwin.py` (tan),
  `jobs_dwin.py` (default), `jobs_swin.py` (slate). Sheet of our run beside both ref layers: `win_sheet.py`
  (`python3 -I win_sheet.py out.png 3 "<npz dir>:tile.wall.slate.full.m10:44"`; its REF path is the scratchpad's
  `iwref`, unzip the v2 zip there first).
- Render: `cd tools/blender/preview && SPRITE_SS=4 blender -b --factory-startup --python render.py -- <repo> <out>
  <jobs.py> [ids]`.

## Known breakage (fixed)
- Commit b30dfa9d (join rule: `envtiles._with_runs` builds only the north/west runs) cut the copies a piece build
  makes from 3 (own, +x, -x) to 2 (own, -x). Both `window()` wrappers asserted 3 calls, so **tan and default windows
  no longer render on this branch** (AssertionError(2)).
- Fixed (committed; default windows render again, SS=1 check): in both `wall3d_iwin.py` and
  `wall3d_iwin_def.py`, `seq = (part, "m" if part in "mr" else None)` (the piece, then its -x copy) and
  `assert calls[0] == len(seq)`. Tan not re-rendered yet.

## Next (the user's plan, 2026-11-08)
1. Slate's ramp (the lower layer) first, starting from the default window's geometry (a good start, it lacks
   detail), detailed to ref 44's lower layer. Show both ref layers next to our render.
2. Then port that ramp geometry back to the default window.
3. Then slate's upper layer, and the other looks.

## Slate window (`sprites/wall3d_iwin_slate.py`)
- Wraps the default window: `window()` runs `wall3d_iwin_def.hook` (opening, sill, beam, pane), then `detail()`.
- `detail()`: splits the piece at the opening's ends; under the opening the near ramp's blue-plate polygons recoloured
  `GREY` (fGS2; matched by their linear colour, Mesh faces store colours, not names); pockets carved into the ramp's
  front (`_carve`: a box out of the mesh, Sutherland-Hodgman pieces kept) with a floor (`FLOOR_LIT`: fGS0 on the end
  tiles, fGT0 on the middle), back (fGT6), sides and lintel (fGS4). `POCKETS` px per part: l (15, 27), m (3, 14) and
  (17, 28), r (4, 16). `POCKET_TOP` 2 px under the sill's level top, `POCKET_FOOT` 1 px over the ramp's foot.
- Pocket depth `POCKET_IN` 6/32 (was 3/32: the back sits just inside the wall core's face, in the sill). Floor slopes
  up `FLOOR_RISE` = 4 px from the ramp's front to the back. With both, the floor fills the view and the dark back is
  hidden behind the lintel (sw6).
- `RAISE` = 3: `build()` lowers `D.FLOOR` by 3 px while slate builds (restored in `finally`), so the window's floor
  (the sill's level top) stands 3 px higher than the default's. The pockets' tops follow it (still `POCKET_TOP` under
  it), their floors stay at `POCKET_FOOT`, so they run 3 px deeper.
- The grey recolour only touches faces with max z <= `W.skirt_top()`: without that it also caught the header's blue
  rail over the opening (sw4 showed the header grey there).

## Log
- 2026-11-08: refs found and mapped; note written. Slate ref shown (full layer only: wrong), then both layers.
- 2026-11-08: all seven 3-tile refs compared for reuse (section above); overview sheet sent to the user.
- 2026-11-08: slate window blockout v1 (sw4): grey ramp front under the opening, pockets 1 / 2 / 1. Shown.
- 2026-11-08: sw5: window floor up 3 px, pockets up 3 and 3 px deeper; header recolour bug fixed. Shown.
- 2026-11-08: sw6: pockets' backs deeper (POCKET_IN 6/32), floors slope up 4 px. Shown; the dark back no longer shows.
