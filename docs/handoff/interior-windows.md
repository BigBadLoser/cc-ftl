# Handoff: interior windows (wall styles)

Branch `art/hull-windows`. Read this before touching interior windows. Keep it current: add a line at every step.

## Pick up here (state at 2026-11-08, end of session)
- Done and approved: slate (sw46; upper layer kept as it renders) and default teal (dp16). Tan renders again and its
  join dots are fixed (iw42, shown to the user, no reply needed). Branch pushed; last commits: 7cdd360b (tan's end
  strip), 874eb469 (teal header), f40dabf4 (teal's cut slot).
- Bastion: no window (the user, 2026-11-08, after bw8: "so bad that bastion gets no window"). Its module and jobs
  file removed (last in c1a8589a: `sprites/wall3d_iwin_bast.py`, `preview/jobs_bwin.py`); the notes below kept for
  the record.
- Navy: N0 built and shown (render scratchpad `/tmp/claude-0/-home-user/62f72465-c138-4e94-9892-01799f49ef8a/scratchpad/nw3c`); N1 dropped (the posts stand on the blocks); slots (N3) built and shown (last render `nw3f`). Then drone, civil; each its own
  module (only the machinery is shared). Process (the user, for bastion): deskew, measure, plan, ramp first; use the
  ref's proportions where its pixel sizes won't fit ours.
- Waiting on the user's go (don't start unasked): #49 (window pieces into the sprite pipeline, with the "window"
  palette set for default `.win.` pieces), hull window wiring, re-rendering the shipped wall sheets.
- The user's standing rules for this work: commit and push after every step to `art/hull-windows` (never main; the
  user merges); commit messages carry no attribution and name no model; label images "Blender renders put together
  as 2D composites"; don't send deskewed views; whole px only; change only what's asked; new colours in
  `palette_extra.json` in a set (`slate`, or `window` for the default's window pieces), prefer the wall's own greys;
  bump `sprite_cache.RENDER_VERSION` only for engine files; no `check:fast` for Python art; don't `pkill -f`; when
  intent is ambiguous, ask with a marked image and send it; each change: render, show before / after (zoom and a
  close-up), log a line here.
- Working loop (scratchpad S=`/tmp/claude-0/-home-user/d90bd30e-5bfe-51f0-9d45-019095d96471/scratchpad`):
  render `cd tools/blender/preview && SPRITE_SS=4 timeout 1500 /opt/tools/blender-4.2.9-linux-x64/blender -b
  --factory-startup --python render.py -- /home/user/cc-ftl-windows $S/<out> jobs_<dwin|swin|iwin>.py [id,id,...]`
  (ids comma-separated; none = every job); sheet `cd /tmp && python3 -I $S/scripts/win_sheet.py $S/AvB.png 5
  "$S/A:<prefix>:<ref>" "$S/B:<prefix>:<ref>"` (prefix `tile.wall.full.m10` / `tile.wall.slate.full.m10` /
  `tile.wall.tan.full.m10`; ref 3168 / 44 / 43); zoom = its rows at 0.05-0.47 H and 0.54-0.96 H, x 0-0.4 W, side by
  side; 1x run composite `$S/scripts/run1x.py` (`run(dir, prefix)`), crop and scale it for close-ups. Last renders:
  teal dp16, slate sw49, tan iw42. Pixel-identical checks: compare npz files (`rgba`, `a`) with numpy.

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
| 43 (set 3) | tan | 2768 / 2767 / 2866 | built: `sprites/wall3d_iwin.py` (renders again; join dots fixed, iw42) |
| 3168 (set 7) | default teal (`tile.wall.full.m10`) | 3173 / 3174 / 3175 | done: `sprites/wall3d_iwin_def.py` + `wall3d_iwin_ramp.py` `TEAL` (approved at dp16, the user: "good enough") |
| 44 (set 2) | slate | 2757 / 115 / 2861 | done: `sprites/wall3d_iwin_slate.py` (lower layer approved through sw46; upper kept as it renders now, the user) |
| 122 (set 4) | navy | 2772 / 2771 / 2862 | N0 built, shown (see "Navy window") |
| 423 (set 5) | drone | 2765 / 2764 / 2863 | to do |
| 428 (set 6) | civil | 2770 / 2769 / 2864 | to do |
| 3295 (set 8) | bastion | 3296 / 3297 / 3298 | no window (the user) |
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
  shared. Only slate and teal share `wall3d_iwin_def.hook` + `wall3d_iwin_ramp` (a `Look` each); tan's
  `wall3d_iwin.py` is its own (arch, cushions), and so is every other look (the user, 2026-11-08: bastion and navy
  don't share the default's shape, upper or lower; the default-shaped reading below was wrong for them).
- Slate (44) is the default (3168) almost shape for shape. Lower layer: the same dished top, pockets on the front and
  end blocks with dark openings; the amber end blocks become blue, the pockets' floors lit blue. Upper layer:
  rectangular opening, posts with a stepped foot like the default's; the beam one raised block over the middle tile
  (the default's has several). Build it as the default's module with look parameters.
- Bastion (3295): its own build (see "Bastion window"). Upper layer: rectangular opening, bricked posts, a beam
  with raised blocks, the cap's blue lines. Lower layer: a channel under the pane and an armour-plated front, no
  pockets.
- Navy (122): upper layer rectangular, posts with a flared foot, a red light strip along the beam with clamps;
  lower layer differs: tall end blocks over a low middle with pockets, red stripes.
- Drone (423): upper layer a white pipe beam with clamps, posts with a red block and a flared foot; lower layer red
  boxes either side of a middle console.
- Civil (428): the odd one: posts curve into the beam (rounded inner corners: tan's arch code is the closest start),
  no blue cap lines, a red edge along the beam; lower layer a white ramp with a recessed panel, a red stripe low.
- Order: slate (done), bastion (dropped: no window), then navy, drone, civil.
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

## Known breakage (all fixed)
- Commit b30dfa9d (join rule: `envtiles._with_runs` builds only the north/west runs) cut the copies a piece build
  makes from 3 (own, +x, -x) to 2 (own, -x). Both `window()` wrappers asserted 3 calls, so **tan and default windows
  no longer render on this branch** (AssertionError(2)).
- Fixed (committed; default windows render again, SS=1 check): in both `wall3d_iwin.py` and
  `wall3d_iwin_def.py`, `seq = (part, "m" if part in "mr" else None)` (the piece, then its -x copy) and
  `assert calls[0] == len(seq)`. Tan re-rendered 2026-11-08 (iw41): renders; since the join rule it showed dotted
  marks across the far floor at each join (no +x run), fixed in iw42 by the ramp's end strip (`wall3d_iwin.END_STRIP`:
  on l and m, a strip in `SILL_TOP` 3 px down at the +x end under the floor's edge; base and r pixel-identical).

## Next (the user's plan, 2026-11-08)
1. Slate's ramp (the lower layer) first, starting from the default window's geometry (a good start, it lacks
   detail), detailed to ref 44's lower layer. Show both ref layers next to our render.
2. Then port that ramp geometry back to the default window.
3. Then slate's upper layer, and the other looks. (2026-11-08: the user keeps slate's upper layer as it renders now;
   slate is done. Step 2 done too: teal approved at dp16. Next: the other looks.)

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
  to the same level of wall3d.RAMPS["ochre"]; the ramp's seam line, level 2 wM / wXM, left off them); in each a slot
  cut SLOT_IN 3 px back into the ramp, SLOT_W 7 x SLOT_H 3 px, SLOT_TOP 2 under the slope's top (`block_slot`: back
  oXK, floor oXD, sides oK, the floor's front edge lit oH). dp8-dp10 tried 2 px tall, lit floors: a flat patch.
  dp1 tried floors wL / lip wH: flat; dp2 lip fC4T0: too green (the user).
- `post_in` (TEAL 2): the opening's ends 2 px further out each side (`D.POST` = POST0 - 2 px while a piece builds: the
  posts 2 px thinner, the side slopes moved out); the end blocks' inner edges move with them (`a`, `b` from POST0), so
  teal's blocks are 11 px wide from the tile's edge. The lip's seams by the posts (`_thirds`: 10.3 / 21.3 px, a px outside the default
  opening's ends) move out with it (`wall3d.LIP_OUT` = post_in while a piece builds): cut by the widened opening,
  the lip's end lost its dark line and the slope seemed to clip it (dp6, the user).
- `header_centre` (TEAL): the rail over a window (`rail_layout(part)` as `wall3d.RAIL_LAYOUT` while a piece builds, in
  place of faction.slate._blocks): l raised over its post (END_W) then set back to its +x edge, m set back with a raised
  half tile at its centre, r mirrors l; the tiles round a piece laid out as a 3-tile window's (a sprite shows a little
  of its neighbours: m's -x neighbour as l, else a joint showed over l). So a 3-tile window has one raised block, at its
  middle; a 2-tile window none (set back from post to post), a 4-tile one two. wall3d._rail draws no seam and no end
  where a set-back block runs on into another. Known: a faint 1 px darker mark where set-back blocks meet at a tile
  edge (neither sprite covers that edge px whole: the l sprite's edge px blends; m's alpha 0 there); the user accepted
  it ("good enough"). Tried without effect: overlapping the blocks across the edge (0.004, then a px).
- wall3d.py: on the default walls a window tile's bare ramp (`T.BARE`) keeps the panel's seam line, on across the
  tile (no panel); the pockets cut it (the user: carry the ramp's seam to the pocket). Plain walls only; slate and
  the base tiles pixel-identical (sw48, dp3 checked).

## Slate window (`sprites/wall3d_iwin_slate.py`)
- Now `LOOK` on the shared ramp (`wall3d_iwin_ramp.window(fn, part, LOOK)`: `wall3d_iwin_def.hook`, then
  `ramp.detail`); slate's own touches are `_pre` (grey ramp front, seam panel) and `_post` (`_rail_seam`). The notes
  below on `detail()` describe what is now in the ramp module.
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

## Bastion window (ref 3295): dropped, no window (the user); notes kept for the record
Our wall: `factions_relief.bastion` (face parts: lower wall band, posts `BAST_P`, the cut, cornice) on the `Recessed`
shell; its ramp's design is `factions_variants.bastion_ramp` (base: the outlined panel). Plain wall render for
comparison: SS=4 npz `/tmp/claude-0/-home-user/62f72465-c138-4e94-9892-01799f49ef8a/scratchpad/bw1/tile.wall.bastion.full.m10.npz` (jobs `/tmp/claude-0/-home-user/62f72465-c138-4e94-9892-01799f49ef8a/scratchpad/jobs_bwall.py`).
Marked ref image (normal view, sent to the user): `/tmp/claude-0/-home-user/62f72465-c138-4e94-9892-01799f49ef8a/scratchpad/bast/ref3295_lower_marked.png`, numbers below.

Measured (ref 3297, lower layer, deskewed with `preview/deskew_ref.py <refdir> small <out> 6 [phase]`, read with
`preview/ascii_map.py <npy> x0 x1 y0 y1`; ref px, +-1; rows mix height and depth on the flat faces):
- The front stands on the plain wall's ramp: the same lean (1 col per ~3 rows) and height (~26 rows) as ref
  wall_8_01's ramp. So the window's front is our bastion ramp's slope; the channel sits where the lower wall is.
- Tile edges: at the pane's plane cols 55 | 86 | 118 | 150 (32 each); at the front's foot 35 | 67 | 99 | 131.
- Cross-section from the pane down, rows at a mid column: pane foot dark 1; channel (2): a mid-dark ledge 3, a dark
  step 3, a mid-dark floor 4; the dark groove (3) 2; the front's lit top (4) 4 (brightest band); upper plate row (5)
  5; a mid seam 2; lower plate row (6) 3; a lit line 3; base band (8) 6 (as the plain ramp's base, 6 rows); dark
  bottom edge 1.
- Plates: dark joints 3-4 px at the tile edges; the upper row one more joint per tile (m at its middle ~15-16, l ~9,
  r ~6), the lower row staggered (l ~13, m ~22, r ~8); a darker step block ~6 px before each tile-edge joint.
- Base band notch (7): 4 px wide, one per tile at its middle (local ~14-17; l ~12-15).
- End blocks: l (1) raised ~5-6 px over the channel's ledge, ~12-13 px along the wall from the tile's -x edge (at the
  pane's plane), its inner face sloping down into the channel; r (10) the same top, its inner face hidden.
- Box (9): one per middle tile (none on the 2-tile window, two on the 4-tile one), standing in the channel against
  its back, ~8-10 px wide at local ~15-24, top ~4-5 px over the ledge.
- Upper layer (later, own build too): cap black with two blue lines; beam: lit top edge, two raised blocks ~16 px
  (cols 9-24 and 73-88 of the deskewed full layer), the rest set back, dark undersides; posts ~17 px, bricked.

Plan (each step: render SS=4, before / after with both ref layers, zoom and close-up, a log line, commit, push):
- B0: `sprites/wall3d_iwin_bast.py` + `preview/jobs_bwin.py`: bastion m10 with the opening cut plain between the
  posts (shared machinery only: `window()` wrapper, `_cut` / `_clip`, pane, glass kind, cap lines), the ramp as is.
- B1: the channel blockout under the opening: ledge, dark step, floor, groove, the front's lit top; the wall's own
  greys (its `RAMPS` levels).
- B2: the front: the ramp's outlined panel replaced under the opening by the two staggered plate rows and the lit
  line; the base band kept, a notch per tile.
- B3: the end blocks at the posts (l and r).
- B4: the box on m.
- B5: a tone pass against the ref. Then the upper layer (own posts, beam, blocks).

Built (`sprites/wall3d_iwin_bast.py`): the opening between the posts' inner edges (`BAST_P` in from the tile's edge)
up to the cornice's foot (`HF - BAST_HB`), cut down to the channel's profile across the wall (`_steps`: (y0, y1, z,
kind), mirrored on the far side) with `_cut` (convex regions, `wall3d_iwin._clip`). bw5, from the pane (px; z in PZ
under the ramp's top): ledge 0-3 at `LEDGE_Z` -6, floor 3-6 at `FLOOR_Z` -9, groove 6-7 at `GROOVE_Z` -11, the
front's top 7-10 (`RIM`) at `RIM_Z` -9 (bw8; -8 in bw5 hid the groove behind it), an upright face (`front` fBW10) from its edge down to the slope (the wall's line
is 5 px from the pane, the slope falls 2.36 PZ a px). Why: the ref's channel (measured on its right end's section) is
~12 px from the front's edge to the pane, nearly level (within ~2 px of the ramp's top), on a ramp ~14 px tall, 9 px
run; ours is 26 PZ tall, 11 px run, so the ref's px sizes don't fit: its proportions (3 : 4 : 1.5 : 4) over 10 px,
the front's top 8 PZ down (the front 18 PZ, ~70% of the ramp; the ref's ~90%). bw4 had it 7.5 px deep, 3-8 PZ down
(the user: "why is our ramp cut so shallow"). Tones `COL` (bw8, to the ref's: ledge fBW2, step fBW4, floor fBW7, groove fBW6, front's top
fBW0, its upright face fBW8, the ends darker(fBW2), under the cornice fBW5; the far side's parts (kind "far") all fBW5:
seen through the glass they showed as more stripes over the ledge). Rendered lum at a middle column, from the pane
down: pane 18, far side 26, pane edge 46, ledge 68, step 38-46, floor 55-60, groove 23, front's top 101-130, its face
99, ramp 82 (the ref's: 42 / 64 / 40 / 64 / 25 / 110-128). A flat-colour part map for showing: a jobs file that
patches `COL` (scratchpad `jobs_bwin_map.py`). Tried: the far side as one flat ledge (no channel) hid the near
floor in the render (cause not found; the cut's regions with an uneven profile); kept mirrored instead. The posts' sides and the channel's section at the opening's ends in
convex strips (`_ends`, both ways: the plain wall over the channel, the channel's block over the plain slope). Pane
from the ledge to the cornice's foot; cap lines; glass. The ramp's outlined panels kept (B2 replaces them).

## Navy window (ref 122, 3-tile 2771): `sprites/wall3d_iwin_navy.py`, jobs `preview/jobs_nwin.py`; N0 built
Marked ref (both layers, numbered): scratchpad
`/tmp/claude-0/-home-user/62f72465-c138-4e94-9892-01799f49ef8a/scratchpad/navy/n_marked.png`; deskews in the same
`navy/` (`n_small_desk.npy`, `n_full_desk.npy`; classified map script `cls.py` one level up). Ref px, tile = 32.
- Scale (deskewed, rows; 1 row = 1 px of depth or about 1 PZ of height; the ref's plain wall `wall_4_01` against
  our plain navy run; scratchpad `navy/ref4_desk.npy`, `navy/ours_run_desk.npy`, `navy/ours_t_desk.npy`):
  - Ref ramp: 30 rows, 10 px run (one slope, no upright foot): a bright top edge 6 rows, the slope 16, a red stripe
    5 painted on the slope, a base line 3. The ref window is cut into this ramp (the user): its end blocks are the
    plain ramp left standing (same slope, red stripe, base; the r block shows the ramp's navy end face, 9), and
    between them the ramp's top is cut down to the sill and the pockets are cut into its front.
  - Our ramp: 37 rows, 11 px run: a 1-row top highlight, the slope 26 rows, then an upright foot of 8 (a light strip
    4, the red foot 4). So ours is 37/30 = about 1.23 times the ref's height, with about the same run.
  - Wall face (for the upper layer): ref red band 11 rows + white 14 = 25; ours red band 14 + white 20 = 34 (1.36x).
  - Rule: widths along the wall stay in ref px (the tile is 32 px in both); depth stays in px (runs 10 vs 11);
    heights scale by 1.23 on the ramp; a part that lines up with a band of the ref's plain wall (its red stripe, its
    red band) lines up with our matching band instead of being scaled.
- Lower layer, along the front's foot from the window's left end (96 px): l end block 0-15 (16, half a tile) | l pocket
  16-37 | m panel 38-57 (20, centred on m) | r pocket 58-79 | r end block 80-95 (16). The ref's pockets read 21 and 25
  (its lean); ours 22 each. The pockets straddle the l|m and m|r tile edges: each piece builds its share.
- End blocks (1, 2, 8, 9): our plain navy ramp, unchanged in profile (its slope, upright foot and red foot), with a
  recessed dark navy tray let into its top (a 2-row light rim, the tray 7 rows deep).
- The cut between the blocks (re-measured; the first reading took the sill's top for its front): the blocks' front
  runs the full 30 rows (45-75 deskewed); the sill's front edge is at row 53, 8 rows down the 30 (27%; the user: at
  least 30%) -> ours 11 rows down our 37. The sill's top is flat, 8 px deep back from that edge (bright, rows 45-53),
  then a grey slope (6) of 8 rows rises to the pane's foot -> ours: the same 8 px of depth, about 8 rows of slope.
- M panel (4): the ramp's front left standing in the cut (20 px, centred on m), with our red foot under it and a seam
  down its middle.
- Pockets (3, 7): cut into the front: the ref's lower 20 of 30 rows -> our lower 25 of 37, a white strip of 10 rows
  left above (ref 8); our red foot cut away there too. A 2 px dark navy side wall on the block side, a grey back, a
  floor with a step / vent detail.
- Upper layer (later): a beam: a dark top with two blue light lines (B), a front with an orange light strip (A) and
  white clamps (C, ~5 px) at the 4 tile edges; posts 11 px wide: a red band (D, 12 rows), white (E, 14), a flared foot
  (F, 5). Our plain navy wall already has the orange pipe, white clamps and red band: reuse those tones, and line the
  posts' red band up with our wall's red band (14 rows) rather than scaling it.
- Plan (ramp first; each step rendered and shown, before / after, both ref layers):
  - N0: `sprites/wall3d_iwin_navy.py` + `preview/jobs_nwin.py` (pieces `tile.wall.navy.full.m10.win.{l,m,r}`), the
    shared window wrapper, pane and glass; our navy ramp kept under the opening and cut: the sill's front edge 11 rows
    down our 37 between the end blocks, its flat top 8 px deep, the grey slope to the pane.
  - N1: dropped (the user: when the ref renders, the posts sit on top of the blocks; part 2 is under them).
    N2: m panel (4) with its seam. N3: pockets (3, 7): built (nw3c). N3b (the user, after the
    slots): the end blocks' sides facing the cut sloped down to the sill, as the ref's (ours are upright).
  - N4: upper layer: beam (A, B, C), then posts (D, E, F).

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
- 2026-11-08: dp7 (the user: the slope clips the lip oddly): the lip's seams by the posts move out with the
  widened opening (`wall3d.LIP_OUT`). Base tile pixel-identical. Shown.
- 2026-11-08: dp11 (the user on dp7): no seam line on the yellow blocks; their slot cut into the ramp (3 px back,
  3 px tall, dark inside, lit front edge). Shown.
- 2026-11-08: dp16 (the user: one big header block, in the centre): `header_centre`, `rail_layout`. Base tiles and
  slate pixel-identical (sw49). Shown.
- 2026-11-08: the user approved teal at dp16 ("this is good enough"). Next: the other looks (navy, drone, civil,
  bastion; tan's re-render), each a `Look`.
- 2026-11-08: iw41: tan's window re-rendered (l, m, r; the user: the normal view only): it renders. New since iw40
  (the join rule): dotted marks on the far floor at each join, the strip fix not ported to tan yet. Shown.
- 2026-11-08: iw42: tan's join dots fixed (`END_STRIP` on l and m, as the ramp's). Handoff section "Pick up here"
  written for a fresh session.
- 2026-11-08: the user: bastion and navy don't share the default's shape (upper or lower). Bastion's ref measured
  (deskew_ref.py, ascii_map.py added to preview/), plan B0-B5 written, marked ref image sent. Waiting on the go.
- 2026-11-08: bw4: B0+B1 in one pass (the user): bastion's own window module, the opening cut down to a channel
  (ledge, step, floor, groove, rim), the pane, cap lines; the ramp's panels kept. Shown.
- 2026-11-08: bw5 (the user: the cut too shallow; use the ref's proportions where its sizes won't fit, option 3): the
  channel 10 px deep (3 : 3 : 1 : 3), the front's top 8 PZ down with an upright face to the slope. Shown.
- 2026-11-08: bw8 (the user: can't tell what's what with these colours): a part map with a legend; the far side
  (through the glass) dark in one tone, the near parts toned to the ref's contrast, the front's top level with the floor
  so the groove shows. Shown.
- 2026-11-08: the user on bw8: bastion gets no window. Module and jobs file removed; next navy.
- 2026-11-08: navy's ref (2771) measured, both layers; marked ref and plan N0-N4 written ("Navy window"); waiting on
  the user's go.
- 2026-11-08: the user: ours is different; deskewed our plain navy and re-measured: our ramp 37 rows (11 run, upright
  foot 8) vs the ref's 30 (10 run, one slope); heights x1.23, widths and depth in px; plan numbers updated.
- 2026-11-08: the user: the ref's window cuts into the ramp. Plan reworked: the end blocks are the ramp left standing, the
  sill is cut 5 rows down between them, the pockets cut into the front.
- 2026-11-08: the user: the cut is at least 30% of the ramp's height. Re-measured: 8 of 30 rows (27%; I had read the
  sill's top as its front) -> ours 11 of 37.
- 2026-11-08: navy N0 (nw0): own module; opening between 11 px posts up to the header's foot, the pane on the ramp's
  top; between the 16 px end blocks the ramp cut 8 art px down to a flat sill (front edge 4 px out on the slope), its
  back face at 1 px from the pane; the far side mirrored, dark. Shown before / after with both ref layers.
- 2026-11-08: the user on N0: a white block where the glass should be. nw1w: the back face and ledge gone; the sill runs
  across the wall, the pane stands on it, its far half shows grey through the glass as in the ref.
- 2026-11-08: the user on nw1w: the end blocks' sides lack the ref's slope down to the sill; to do after the slots (N3b).
- 2026-11-08: N1 dropped (the posts sit on the blocks). N3 slots (nw3c): window px 16-38 and 58-80, the ramp's front cut
  out past the sill's front edge, between the foot's top and the sill; a floor (fNW2), a back (fNW3) up to the sill's
  edge, sides the slope's section (fNS2). Note: the clip works in mesh coords (near side mesh -y), the quads in grid
  coords (core.G flips y: near side grid +y). The red foot still runs under the slots.
- 2026-11-08: the user on nw3c: the slots' outer edges in line with the posts' (window px 11-38 and 58-85), their backs in
  line with the slope's top end (the wall's line, 5 px out; were at the sill's front edge, 9 px). nw3d: under an end
  block (11-16 px) the slope stays over the slot as a lintel, its underside drawn.
- 2026-11-08: the user on nw3d: cut the part above too. nw3e: under an end block the slot takes the slope whole (back up
  to the ramp's top, side the slope's section), no lintel.
- 2026-11-08: the user on nw3e: the middle panel wider, on the measurement. Re-read up the ref's slope (deskewed row 56):
  slots 19 | panel 28 (its chamfered edges included; 28-30 lower down, its red face 20) | 19. nw3f: panel 34-62 (28 px,
  centred), slots 11-34 and 62-85 (23).
- 2026-11-08: window paused (the user) for navy's base wall: its ramp given the default's and slate's geometry, all
  shelf, no lip (faction/navy.py: Style shelf=slate.SHELF (4 px, 8 art px under the ramp's top), shelf_lvl 2,
  shelf_back (0, 1); navy's face and its plate seams down to the shelf; PlateTones' foot outline at the shelf).
  Renders: scratchpad ns0 (before) / ns2 (after). Note for the window: the shelf's height is the sill's (CUT_Z 8);
  wall3d_iwin_navy still assumes the slope runs up to the wall.
- 2026-11-08: the user: turn AA on (navy). Coverage AA (post._aa) already covered navy's cool greys; its red (fNT*) and
  navy tones (fNS*, fNX*) now join opt-in groups "navy.red" / "navy.blue" in palette_extra.json (as teal's and
  slate.blue). ns3: the red band's edges and the navy faces' blend. Every navy sprite (walls, hull) changes on re-render.
- 2026-11-08: the user, navy's ramp: seams dark (joint 4 -> 1), the toe in the slope's tone (toe_lvl pairs per face:
  fNW2 / fNW3; wall3d skirt and shell ramp now take a (y, x) pair), the red moved off the foot onto the slope just over
  the toe (ramp_bands from 8 px of 11; the foot FootTone("wall", 2); toe_at 8/11 so a corner's chamfer and an end's ramp
  band match; _end_section foot= param: navy's feet the section's). Renders ns5.
- 2026-11-08: the user: red band down onto the toe's edge. RED_AT 9/11 and the toe (the slope's last px) in the band's
  tones (toe_lvl fNT2 / fNT4): the red from 9 px out down to the foot. ns7. Shelf vs slate's: both SHELF 4 px; slate's
  reads bigger because its upper slope down to SPLIT (0.655 of the run, ~7 px) is grey like the shelf, the blue below.
- 2026-11-08: the user: navy's shelf should be slate's shelf + lip, with no lip. NAVY_SHELF = SHELF + LIP_D (6/32, was
  4/32), all of it flat shelf; the wall face's foot and the ramp seams follow it down. ns8. Corners and ends checked. The
  window (wall3d_iwin_navy) still cuts from the old ramp top: CUT_Z 8 and `_front()` need re-fitting to the shelf.
- 2026-11-08: the user: the ramp read short under the shelf; the shelf up. Style.ramp_px (a look's own fall a cell, up
  from the toe; wall3d.ramp_fall) and navy's NAVY_FALL 3: the shelf at 19 px (was 14), the slope 15 px over its 5 cells
  (was 10). The ramp's top at the wall (skirt_top, 26 px) and its foot unchanged, so doors, breaches, the airlock, wall
  props and the cutaway still line up. The solid ramp capped at the shelf's height (its unseen sides too) and the end
  section follows the shelf. Other looks unchanged (ramp_px 0). ns10.
- 2026-11-08: the user: the ramp's seams down to the toe and up over the shelf to the back wall. Style.seam_wrap
  (wall3d._seam_wrap): each seam between the slope's plates carried over the toe strip to the foot and across the
  shelf's flat top to the wall, the gap's width, in the joint's tone (RAMPS[fam][face][joint]). Navy only. ns11.
- 2026-11-08: the user: the header behind the pipes a shade lighter; every seam a shade darker. Header "rose" 1 -> 2
  (on screen 131c2d -> 24344a, fNS4 -> fNS3 look). Ramp seams: joint 1 -> 0 (9fa7b9 -> 7687a1; the wrap and the
  chamfer's joint line with them). Face seams: navy._seam, level 0 on the x face (7b8ba1 -> 5b718a); on the lit y face
  level 0 read two shades down, so fixed fNW6, which reads one (8797aa -> 7687a1). ns12.
- 2026-11-08: the user: the wall and slope colour swapped with the shelf top's. navy.NAVY_FACE 2 (was 3): the face, the
  chamfer cells and the corner's lit strip a level down; the slope's plates Style.ramp_lvl (new; the first band's level)
  1 (was 2); the shelf's top shelf_lvl 3 (was 2). On screen: y face and slope c1c9d5 -> a9b4c4, shelf a9b4c4 -> c1c9d5;
  x face a9b4c4 -> 8e9cb1, shelf 8e9cb1 -> a9b4c4. shell._ramp_chamfer takes a level (civil keeps 3). ns13.
- 2026-11-08: the user: the corner. (1) The shade side's red was two tones (the band fNT2, the toe fNT4): the toe's x tone
  fNT2 too. (2) The chamfer kept the old ramp line (zs straight down to the floor): shell._ramp_chamfer follows a look's
  own fall (the shelf's height, from its edge down to the foot; its red band and toe in the toe's tone) and
  LookShell._band carries the shelf round the corner (a step lighter than the y face's shelf) with its top at the shelf.
  The corner strip between the shelf and the old ramp top (navy face's corner piece, uncovered by the shelf) a step
  lighter, as the strip over it. Other looks unchanged (gated on ramp_px). ns14.
- 2026-11-08: the user: the shelf's seam line (its dark back crease) and its lit edge on round the chamfer.
  LookShell._band's shelf: its back px, top and lit edge as the faces' (_prof), each a step lighter than the y face's.
  The chamfer's own wall/slope colour (a shade over the lit face) the user finds off; options A-D shown, waiting. ns15.
- 2026-11-08: the user picked option C: the chamfer between the lit and shade faces' tones, and its crease and lit edge
  likewise. navy.NAVY_MID fBT1 (9cacbc) on the chamfer's wall strip (PlateTones "d" cells, the face's corner piece),
  slope (_ramp_chamfer tone=) and band; Style.chamfer_shelf (new) NAVY_MID_SHELF fBW0, fBT8 (crease), fBT0 (top),
  fNH1 (lit edge). Existing palette tones: new ones (9ca8bb ..) snapped to these in quantisation, so none added. ns16.
- 2026-11-08: the user: fix navy's ramp variants for the new ramp. Pipes (navy_pipes): the recess, its floor and the
  pipes on the shell's own surface (T.SHELL._zsurf: the shelf flat, the steeper slope; the slope's fall for the pipes'
  sink) instead of zs straight to the floor; the seam wrap stops at a ramp hole's edge. Split plates (navy_split): from
  the shelf's edge to a px over the red band, fixed a shade under the slope (fNW4 y / fNW5 x; after the face/slope swap
  level 1 matched the plates). wall3d.skirt's slope point no higher than the shelf (a design's parts on it lie flat).
  The plain walls and the top-only variants pixel-identical. nv1.
- 2026-11-08: navy cover rebuild, steps 1-2 (plain wall): one panel line a tile, NAVY_SEAM (7.5/32) in from its high edge (the
  ref's), in line on the wall and the ramp, in place of the two seams; the cover plate on its low side, a narrow strip
  on its high (Style.one_seam: wall3d.skirt's fields (cover, strip); RampHoles keeps a design's hole in the cover,
  clear of the line). The line's lit px on the strip side (the ref's b2bbcc): a level over the face, over the band's
  red a level over the red (band designs list their red as .reds). Variants: pipes and split plates now in the
  wider cover (step 3 reworks them). ns18.
- 2026-11-08: the user: leave the line's red over the band and the strip's longer red band for now. Render less: work
  out the base geometry on the plain pieces only (a handful of ids: full.m10, full.m5, an outer corner, an inner
  corner, an end), then render and adjust all the variants once.
- 2026-11-08: the user: build the covers as real plates; test renders of full.m10 only. The wall's face is now plates
  (navy.face): per tile a cover, then (with the panel line) a strip, flat fronts at COVER (PAINT) from the shelf to
  under the header, each carrying its part of the band (band designs at navy_designs.BAND, 1.5 PAINT); the line and
  its lit px stay at 2 PAINT (further out they slip off the px grid and blur). A plate a variant takes off (`off`, empty
  for now) shows the dark frame (FRAME, rose 2) in its place; a frame behind the covers peeked out at the tile edge,
  and slab sides darkened the edge column, so the covers are front-only sheets (T.run under a breach's CLIP). The
  old face run's faint lit line at zs is gone; else m10 matches ns18 bar a few px at a run's open end. The ramp's
  covers were already plates (wall3d.skirt's fields, each with its band). ns22.
- 2026-11-08: the user: a slight line between tiles. The covers stopped at the tile edge and the face behind showed a
  shade darker there (95a4b4; the old run's side gave a fainter a4b1c1): the covers now run on by their depth at a
  "cont" end, and the band with them (else the edge px went a lighter red). The edge column is the face's tone now,
  over the face and the band. ns24.
- 2026-11-08: navy cover rebuild step 3, the variants on the covers (m10 only rendered, nv6). Top designs with a
  "middle" (boxes, lockers) take the wall cover off: the dark frame (rose 2) in its place, the design in the opening
  (zf .. zh, inset 0.04); the strip keeps its band, line and lit px (navy_recess gone). Lockers: one tall locker (the
  ref's). Thin band: on the cover only, the strip keeps navy_band. Pipes: the ramp cover off, its band with it
  (RampHoles, one_seam: from the shelf's edge to the toe strip, clear of the line); shell._prof keeps the shelf's
  tones and lit edge when a hole starts at the shelf's edge (it painted the shelf in the slope's tone); the recess
  floor and the pipes sunk square to the steep slope (straight down buried them / slid them under the toe), rows
  at 0.3 and 0.8 of the opening, the silver pipe between them. Split plates: in the cover, unchanged. Plain m10
  pixel-identical to ns24.
- 2026-11-08: the user: push the pipes opening's top strip (the shelf over it) back 4 px. RampHoles (one_seam): the
  hole from hd[0] back into the shelf (navy pipes: 4/32, a 2 px ledge left, its lit edge kept: shell._prof gives a
  piece ending in the shelf its shelf tones, one_seam only); the pipe rows on the slope from the shelf's edge (on
  the opened flat they rose over the shelf). Plain m10 unchanged. nv8.
- 2026-11-08: the user: move the pipes slot, seam line and all, 2 px right; all ramp lines move 2 px, the walls'
  stay. Style.ramp_seam (navy NAVY_RAMP_SEAM 5.5/32): the ramp's line (and its wrap over the shelf and toe) 2 px
  further along than the wall's; RampHoles shifts the slot with it (a 2 px rim of cover left on its low side). nv9.
- 2026-11-08: the user: add 2 px back to the top strip: the pipes slot 2 px back into the shelf (ramp_hole 2/32, a
  4 px ledge over it). nv10. Open: the ref's seam and slot run on down to the floor (through the toe and foot); the
  user is unsure whether to follow it.
- 2026-11-08: the user: open the slot to the toe, not to the floor. RampHoles (one_seam): the hole on through the
  toe px (navy's toe is red: it read as a band under the slot) to run - 0.002, the foot kept (a sliver of ramp in
  front of the hole carries it); the pipe rows still spaced over the slope to the toe's edge. nv12.
- 2026-11-08: the user: the back wall darker and parallel to the slope face. navy_pipes: its back one plane parallel
  to the slope (the slope's line run on up under the shelf, h under it; no flat floor), cut under the floor along
  the line behind the foot's bottom edge on screen (none of it shows under the foot), all in the dark back's tone
  (CAV[1] 141c2c, was the floor's 1c2c44); the thin silver pipe between the rows gone (at this size it read as a lit
  back wall). nv14.
- 2026-11-08: the user: there should be no red left under the slot. The red under it was the foot's lit top edge
  (wall3d.skirt, upright foot: the toe strip in Style.toe_lvl, navy's red), drawn the tile's full width over holes;
  it now leaves out a hole opened through the toe. Plain m10 unchanged (as nv9). nv15.
- 2026-11-08: the user: move the bottom pipe down and make room for the silver pipe. The lower pipe row now sits by
  the foot (d1 − 0.015), and the silver pipe is back between the two rows, rs + 0.04 into the slope. nv16.
- 2026-11-08: the user: top pipe up 1, silver pipe down 1. Moved along the slope by one screen px each
  (1 / (16 + 39.19·fall) in d); checked in the pixels: top row and its collars up 1 px, silver down 1 px, lower row
  unchanged. nv17.
- 2026-11-08: the user: the little bands between the pipes come towards the camera, above the silver pipe. The bars
  between the collars now sit out of the slope (0.02 deep instead of on the pipes' centre line), in front of the
  silver pipe, which no longer cuts them. Pipes and collars unchanged. nv18.
- 2026-11-08: the user: the bands look jagged. The bars (a lit top and a dark side, ~1.3 px wide) are now flat steel
  straps lying out of the slope, 2 px wide (u ± 1/32, centred on the px grid) in one tone (fSH0). Still over the
  silver pipe. Unused _bar removed. nv19.
- 2026-11-08: the user: the straps should be flat on top, not dip between the pipes. They sat 0.02 into the slope, under
  the collars' tops, so each sank between its two collars; now they lie on the collars' tops (lift dp + 0.003), one flat
  strap from collar to collar. nv20.
- 2026-11-08: the user: no collars. The collars round the pipes are gone (and the unused _collar / _steel helpers);
  the straps stay as they were. The pipes now run unbroken and cover the straps' ends, so a strap shows only between
  the pipes. nv21.
- 2026-11-08: the user: the slot's top and side edges should anti-alias. The cavity tones (fNC0/fNC1, flat) were left
  out of coverage AA, so their edges against the wall greys stayed hard. post._aa_groups now lets a flat entry join
  a group by name (a flat "aa": true stays out; no such entry existed, so nothing else changes), and fNC0/fNC1 join
  "navy.cav". The lip and sides now blend; the cavity's inner corners blend too (one dark step, no grey speckle).
  Plain m10 identical to nv9. No RENDER_VERSION bump: the palette key (post.palette_digest) changes with the entries,
  which re-keys every sprite whose palette takes the hull set. nv22.
