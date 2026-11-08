# Handoff: interior windows (wall styles)

Branch `art/hull-windows`. Read this before touching interior windows. Keep it current: add a line at every step.

## What an interior window is
A straight partition (mask 10, along x) opened between its end posts, with a beam over the opening and a see-through
pane. Pieces per look: `tile.wall.<look>.full.m10.win.l` (post at -x), `.win.m` (open across), `.win.r` (post at +x).
A 2-tile window is l + r, a 3-tile one l + m + r, a 4-tile one l + m + m + r.

## Showing work
- Show the user the normal render (our run beside both ref layers, or a before / after zoom). The deskewed views are
  for measuring only: don't send them (the user: "idc about that").

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
| 3168 (set 7) | default teal (`tile.wall.full.m10`) | 3173 / 3174 / 3175 | built: `sprites/wall3d_iwin_def.py`; slate's ramp ported (dp2), awaiting the user |
| 44 (set 2) | slate | 2757 / 115 / 2861 | done: `sprites/wall3d_iwin_slate.py` (lower layer approved through sw46; upper kept as it renders now, the user) |
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
3. Then slate's upper layer, and the other looks. (2026-11-08: the user keeps slate's upper layer as it renders now;
   slate is done. Next: step 2.)

## The ramp (`sprites/wall3d_iwin_ramp.py`, shared)
- Slate's ramp moved here (2026-11-08) so the default window gets it too: the raised floor and steeper crest
  (`RAISE`, `DIP`, `SLOPE`), the pockets and rib (shaded under their roofs, lit front edge), the plates (near and far),
  the toe, `END_STRIP`. A look's colours and own touches come in a `Look` (`pre` / `post` hooks, `floor_paint`,
  `beam_drop`); `ramp.window(fn, part, look)` builds a piece. Slate: `wall3d_iwin_slate.LOOK` (its grey recolour,
  seam panel and rail seam as hooks, its blue paint block, the lowered beam), pixel-identical to sw46 (sw47 checked).
  Default: `ramp.TEAL`, used by `wall3d_iwin_def.window`; beam not lowered (`beam_drop` 0), no paint block.
- TEAL colours: floors wH (lit over the ramp's front, wL), shade wS, lit edge `wHW` #80bcae (a step over wH, in a
  new palette set "window": a new walls colour would re-quantise every wall; `preview/render.py` selects
  "walls+hull+window" for default `.win.` pieces, and the pipeline needs the same when windows ship, #49), back wXD,
  sides wD, rib wL, toe wM (`toe_drop` 1: its top a px under the pockets' floors), plates wM / wD (dp4: wS blended
  with the sill's slope, wS). End blocks under the posts (`blocks` "ochre": the near ramp's slope from the run's ends
  BLOCK px in, foot up to the shelf (faces facing out and up: not the shelf, not the lip's front), each teal ramp colour
  to the same level of wall3d.RAMPS["ochre"]); on each a dark slot `block_slot` oK, SLOT_W 7 x SLOT_H 2 px, SLOT_TOP 2
  under the slope's top.
- `post_in` (TEAL 2): the opening's ends 2 px further out each side (`D.POST` = POST0 - 2 px while a piece builds: the
  posts 2 px thinner, the side slopes moved out); the end blocks' inner edges move with them (`a`, `b` from POST0), so
  teal's blocks are 11 px wide from the tile's edge. dp1 tried floors wL / lip wH: flat; dp2 lip fC4T0: too green (the user).
- wall3d.py: on the default walls a window tile's bare ramp (`T.BARE`) keeps the panel's seam line, on across the
  tile (no panel); the pockets cut it (the user: carry the ramp's seam to the pocket). Plain walls only; slate and
  the base tiles pixel-identical (sw48, dp3 checked).

## Slate window (`sprites/wall3d_iwin_slate.py`)
- Wraps the default window: `window()` runs `wall3d_iwin_def.hook` (opening, sill, beam, pane), then `detail()`.
- `detail()`: splits the piece at the end blocks' inner edges (`BLOCK`); between them the near ramp's blue-plate
  polygons recoloured `GREY` (fGW2; matched by their linear colour, Mesh faces store colours, not names); the plate's
  seam panel (fGT2/fGTs, the middle half of a tile, `PANEL`) dropped where an end block's edge cuts it (sw29); on l
  and m (the run goes on at +x) a strip `END_STRIP` 3 px tall in the floor's tone (`D.SILL_TOP`) closes the wall's
  end under the floor's +x edge (sw30: open there, the inside showed dark, and the floor's edge px blended with it
  into dotted marks across the floor's back at each join, which the next piece doesn't paint; the default window
  has the same open end and needs the same strip when the ramp is ported); the opening's top corners square (sw31-42 tried 45-degree chamfers, `_chamfers`, 9 then 10 px, with a left
  post seam and dark bottom edges; the user dropped them in sw43); `_rail_seam`: no rail seam by the right post (the
  fGT3 line slate._rail draws on its end block's front, 3 px past the post; sw42); the opening's top `D.BEAM_DROP` = `SHADOW` + `LIT_UNDER` (3 + 1 = 4 px) under the rail's foot (sw37; 3 px
  in sw36, where the dark px sat on the glass and read harsh: now on the stripe's lit top px as on the wall) (the cut
  stops there, so over the window the header keeps the wall's own foot, the rail's shadow band and the set-back middle
  blocks' lower px, and the band's lowest px reads as the header's dark bottom edge in one straight line, as on the
  wall; sw34 hung a stand-in band (2 px under the middle blocks, 1 under the ends) and sw35 painted the blocks' fronts
  at their two depths: both jumped); `wall3d_iwin_def.BEAM_DROP` is 0 for the default window; with
  it set the beam's underside stops at the face (yf), not the posts' relief (sw41);
  pockets
  carved into the ramp's front (`_carve`: a box out of the mesh, Sutherland-Hodgman pieces kept) with a floor
  (`FLOOR_LIT`: fGS0; on the middle tile a paint block `FLOOR_PAINT` fGT1 (the slope's blue) on it, PAINT_SIDE 4 (sw25; 2 in sw24)
  px in from the floor's two outer ends (one block across the pockets and the floor in front of the rib, not one per
  pocket) and PAINT_BACK 3 px from its back (top) edge, to its front edge; drawn after the carving or the carve cuts it;
  sw24), back (fGT6), sides and lintel
  (fGS4). Current `POCKETS` / `RIBS` / plates: see the sw13 and plates notes below.
- Pocket depth `POCKET_IN` 4/32 since sw11 (sw10 3/32, sw6-sw9 6/32: the back sits just inside the wall core's face, in the sill). Floor slopes
  up `FLOOR_RISE` (now 2 px; sw6 had 4) from the ramp's front to the back. With both, the floor fills the view and the dark back is
  hidden behind the lintel (sw6). sw7: `POCKET_TOP` 3 (top 1 px lower), `FLOOR_RISE` 2.
- Toe: under the opening the near ramp from the pockets' floor line (foot + `POCKET_FOOT`) down is split off and
  painted `TOE`. sw8 tried fGT6 (dark navy): the user: "looks like poop". sw9: the toe fGS2 (the face's old tone) and
  the face (`GREY`) fGW2, the tone of the slope over it (the ramp's front under the opening: fGS2 face z 5-11.6 px,
  fGW2 slope z 12.4-16, fGW0 its lit top edge; found by dumping the faces' palette names).
- `RIBS` px per part (now only m's middle rib, (15, 16)): cut upright, its face (`GREY`) at y1 (the slope at the
  pockets' top edge), the pockets' sloped floor run on under it in front; the pockets' sides on a rib only behind y1.
- sw13, the widths and dip to ref 44 (mirrored, the ref is symmetric within its +-1): `BLOCK` 18 (the blue end blocks
  l 0-17, r 14-31: the grey face, toe and recolour only between them), `POCKETS` l (18, 28), m (2, 14) (17, 29), r
  (3, 13), rib m (15, 16). The dip: `wall3d_iwin_def.SILL_OFF` (new, 0 for the default: pixel-identical by
  construction) keeps the crest at the lip's top that far in from the post; slate sets it from `DIP` (sw13: BLOCK - POST,
  6.75 px; sw14: 0, see the log), END to `SLOPE` 9 px and RUN scaled with it (5 * 9 / 11.5), restored in `finally`.
- Plates over the sill's front edge: ref 44's DARK plates (the lighter stretches between them are the floor, not
  plates: the user), wrapped from the floor's top over its front edge down the face. `PLATES` px per part: a top
  PLATE_D 6 px back on the sill's level top (`PLATE` fGS2: the vertical wall's greys, the user: its face is fGS3 / fGS2; fGWp dropped), then PLATE_DN 2 px down the face
  (`PLATE_FRONT` fGS3), each a hair proud (3 PAINT) of the sill and its lit edge. The same plates mirrored across the
  wall onto the sill's far edge (sw44, the user). Ref tones: plate top #8f949b on a
  #9ba0a5 floor (0.92), plate front ~0.82 of the face between. At the ref's edge they measure l 24 - m 2, m 16-28,
  r 10-20; ours sit 6 px toward -x (our sill's edge stands further back than its pockets): l 21-28 (from the dip's
  foot), m 10-22, r 4-14 (sw19).
- Quantising: post.quantize looks colours up in a 32-step LUT, so a new colour can land on a neighbour (fGWp
  #92989f came out #959d98, greenish). Check a new hex round-trips first: `post.select('walls+hull+slate')`, then
  `post.PALETTE[post.quantize(np.array([[r, g, b]], float))[0]]` (python3 -I with tools/blender on sys.path).
- `RAISE` = 3: `build()` lowers `D.FLOOR` by 3 px while slate builds (restored in `finally`), so the window's floor
  (the sill's level top) stands 3 px higher than the default's. The pockets' tops follow it (still `POCKET_TOP` under
  it), their floors stay at `POCKET_FOOT`, so they run 3 px deeper.
- The grey recolour only touches faces with max z <= `W.skirt_top()`: without that it also caught the header's blue
  rail over the opening (sw4 showed the header grey there).

## Widths vs ref 44 (deskewed, sw12)
- Deskew: `tools/blender/preview/deskew_win.py <npz dir> tile.wall.slate.full.m10 <ref 3_tile_window dir> <out>`
  shifts column x up by (x+1)//2, so lines along the wall run level; one column = one art px along the wall. A step
  into the ramp (grid y) moves 1 col left per row down, so sloped faces' edges lean: measure within one row, from
  the front face's left end in that row (the tile boundary, +-1 px). Ref rows 61-67 of the deskewed ref.
- Ref 44 lower layer, tile px (l 0-31 | m 0-31 | r 0-31), at its pocket floor row:
  blue end block l 0-17 (18) | pocket l 18-28 (11) | rib l29-m1 (5) | pocket m 2-28 with a 2 px divider about m 16-18
  (it leans: m 15-16 low, m 18-19 high) | rib m29-r1 (5) | pocket r 2-12 (11) | blue end block r 13-30 (18).
- Ours (sw12): post block (blue) 0-11 (12) | grey 12-14 | pocket l 15-27 (13) | rib l28-m2 (7) | pockets m 3-14,
  rib 15-16, 17-28 | rib m29-r3 (7) | pocket r 4-16 (13) | grey 17-19 | post block r 20-31 (12).

## Log
- 2026-11-08: refs found and mapped; note written. Slate ref shown (full layer only: wrong), then both layers.
- 2026-11-08: all seven 3-tile refs compared for reuse (section above); overview sheet sent to the user.
- 2026-11-08: slate window blockout v1 (sw4): grey ramp front under the opening, pockets 1 / 2 / 1. Shown.
- 2026-11-08: sw5: window floor up 3 px, pockets up 3 and 3 px deeper; header recolour bug fixed. Shown.
- 2026-11-08: sw6: pockets' backs deeper (POCKET_IN 6/32), floors slope up 4 px. Shown; the dark back no longer shows.
- 2026-11-08: sw7: pocket tops 1 px lower (POCKET_TOP 3), floor's back 2 px lower (FLOOR_RISE 2; its front can't drop). Shown.
- 2026-11-08: sw8: dark toe under the opening (TOE fGT6). Shown.
- 2026-11-08: sw9: toe fGS2, face fGW2 (the slope's tone). Shown.
- 2026-11-08: sw10: pockets' backs pulled in 3 px (POCKET_IN 3/32): the dark back shows again as a line over the floor. Shown.
- 2026-11-08: sw11: pocket backs 2 px in from sw9 instead (POCKET_IN 4/32). Shown.
- 2026-11-08: sw12: the middle tile's rib between its pockets upright at the pockets' top edge. Shown. The ribs across
  the tile seams are still sloped.
- 2026-11-08: deskewed sw12 vs ref 44 and measured the widths (section above); deskew_win.py added to preview/.
- 2026-11-08: sw13: end blocks 18 px, pockets / ribs to the ref's widths, the dip starts at the end block's edge and
  reaches the floor 9 px on. Shown.
- 2026-11-08: sw14: the user: the ref's slope starts at the end pocket's outer edge. On screen (deskewed, l end) the
  ref's dip starts over that edge; sw13's started ~8 cols right of it (the crest stands further back than the pockets,
  and depth shifts it right on screen). DIP 0 (the dip from the post, as the default) lands it within ~1-2 cols. Shown.
- 2026-11-08: sw15-17: the plates over the sill's edge (sw15 fGW1 didn't read: same as the sill's top; sw16 lighter;
  sw17 6 px toward -x to sit as the ref's on screen). Shown.
- 2026-11-08: sw18-19: the plates are the dark parts (the user); three dark plates wrapped over the edge, fGWh dropped,
  fGWp #91969b (round-trips the quantiser). Shown.
- 2026-11-08: sw20: plates in the wall greys (the user): top fGW2 (a step under the floor's fGW1), front fGW3; fGWp
  removed from palette_extra. Shown.
- 2026-11-08: sw21: plates in the vertical wall's greys (the user: "the darker greys that the vertical walls use";
  the plain wall's face renders fGS3 #4c5464 / fGS2): top fGS2, front fGS3. Shown.
- 2026-11-08: sw22: middle pocket floors in the slope's blue (fGT1, the end blocks' slope; was fGT0). Shown.
- 2026-11-08: sw23: the middle floors aren't all blue (the user): grey (fGS0) with a paint block of fGT1, 2 px in from
  each side, 3 px from the back edge. Shown.
- 2026-11-08: sw24: one paint block across the middle floor (sw23 broke it at the rib: inset at each pocket's side and
  none under the rib). Shown.
- 2026-11-08: sw25: paint block 2 px more off either side (PAINT_SIDE 4). Shown.
- 2026-11-08: the user approved slate's lower layer at sw25 ("looks good to me"). Next per the plan: port the ramp
  geometry to the default window, then slate's upper layer.
- 2026-11-08: sw26: the blue end blocks pulled back 3 px from the end pockets (BLOCK 15, was 18): grey face between. Shown.
- 2026-11-08: sw27: that gap the ribs' width (the user): 5 px, as the seam ribs (BLOCK 13). Shown.
- 2026-11-08: sw29: the seam panel the end blocks' edge cut in half dropped (plain blue end blocks). A neighbour-pane
  glass tint pass was tried for the dotted marks across the floor's back at the tile joins and did nothing (reverted):
  the user's read is that the far floor's edge at the tile edge is anti-aliased unlike the others. Next.
- 2026-11-08: sw30: that edge: the wall's end under the floor is open at x = +0.5 and the floor's edge px blended
  with the dark inside. A strip in the floor's tone closes it on l and m (a full cap showed through the next
  piece's glass). The dots are gone. Shown.
- 2026-11-08: sw31: the opening's top corners chamfered at 45 degrees (the user), 9 px, the blue under the header. Shown.
- 2026-11-08: sw32: the chamfer's dark top block (the rail's whole shadow band) down to its lowest px; the rail's seam
  mirrored on the left of the opening. Shown: the user preferred the block (back in sw33) and meant another seam.
- 2026-11-08: sw33: the seam they meant: down the blue at the post's edge (marked image sent), added on the left. Shown.
- 2026-11-08: sw34: that seam a px right (in line with the post's corner line); the dark line under the header carried
  across the window (the shadow band under the beam). Shown: didn't read.
- 2026-11-08: sw35: instead the header's bottom px over the window dark (a bottom edge highlight); the left seam in the
  post's corner line's grey (fGW5). Shown: the line jumped.
- 2026-11-08: sw36: the opening's top 3 px lower (BEAM_DROP), so the header keeps the wall's foot over it: the dark
  bottom edge straight. Shown: still harsher than the wall's.
- 2026-11-08: sw37: a px more (4): the stripe's lit top px under the dark one, as on the wall (columns now match the
  wall's to that px). Shown.
- 2026-11-08: sw38: the line carried through the corners (the user): the chamfers end at the beam (BEAM_DROP), 5 px
  instead of 9, the wall's own header foot over them; their dark top block gone with it. Shown.
- 2026-11-08: sw39: the corners twice as tall (the user): 10 px up the post from the beam, blue where level with the
  blue, the wall's face grey under it. Shown.
- 2026-11-08: sw41: the extra dark row under the header's line gone: the beam's underside (wK) reached out to the
  posts' relief (yf + T.FR), a px proud of the face it now sits under, and showed; with BEAM_DROP it stops at the face
  (yf) (wall3d_iwin_def; the default window, BEAM_DROP 0, unchanged). The chamfers' fronts on the face too (out at the
  relief their top edge showed their dark underside as specks on the line). Shown.
- 2026-11-08: sw42: the chamfers' bottom edge a dark px line (EDGE_BLUE fGT4 level with the blue, EDGE_FACE fGS4
  under it); the rail's seam by the right post (slate._rail's fGT3 front line on the end block, 3 px past the post)
  dropped on r. sw42b: the same with LIT_UNDER 0 (no lit px under the header's dark edge over the window), to
  compare. Shown both; LIT_UNDER stays 1 until the user picks.
- 2026-11-08: sw43: the user kept the lit line (LIT_UNDER 1) and dropped the corners: `_chamfers` gone (with the left
  post's seam and the corners' edges); `_rail_seam` keeps the right post's rail seam off. The opening's corners square
  again under the lowered beam. Shown.
- 2026-11-08: sw44: the sill's plates mirrored to its far edge, at the same x (the user). Shown.
- 2026-11-08: sw45: the pockets' floors shaded under their roofs (from the back to the roof's edge): `FLOOR_SHADE`
  fGS2, and `PAINT_SHADE` fGT3 on the middle tile's paint block there (the user). Shown.
- 2026-11-08: sw46: the pockets' (and the rib's) floors lit along their front edge: `LIP` 1 px back, `LIP_LIT` fGW0,
  `LIP_PAINT` fGT0 over the paint block (the user). Shown.
- 2026-11-08: the user: sw46 "good enough"; slate's upper layer stays as it renders now. Slate done; next the port
  of the ramp to the default window (step 2).
- 2026-11-08: the user: port everything (shape, pockets, plates) to the default window. Ramp moved to
  `wall3d_iwin_ramp.py`; slate pixel-identical (sw47); teal dp1 (flat), dp2 (floors wH, lip fC4T0). Shown, waiting.
- 2026-11-08: dp3 (the user on dp2): toe a px shorter (`toe_drop`), lip `wHW`, ochre end blocks, the ramp's seam
  carried across the window tiles to the pockets. Upper layer next. Shown.
- 2026-11-08: dp4/dp5 (the user on dp3): the ochre stops at the shelf (dp4 still took the lip's front; dp5
  slope faces only), plates wM / wD off the slope's wS, a dark slot on each block. Shown.
- 2026-11-08: dp6 (the user): teal's side slopes 2 px out each side, posts 2 px thinner, the blocks' inner edges
  2 px out with them (`post_in`). Shown.
