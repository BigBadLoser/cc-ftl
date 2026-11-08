# Handoff: slate wall look (Space Haven set 2) and its variants

**State as of 2026-11-07.** Branch `art/hull-windows`, worktree `/home/user/cc-ftl-windows`, last commit `2d66122c`, all
pushed. No PR. The user merges; never push to main.

## Rules the user set (this thread)
- Commit and push after every step. Commit messages: no attribution, no model name.
- **Always show renders next to the ref**, and say they are "Blender renders put together as 2D composites".
- **Check runs of tiles, not just one tile** (holes at joins only show in a run). Use `scripts/run_comp.py` (below).
- **Measure the ref's proportions, not its pixels**: our wall is taller than the ref's. The ref's tile face is ~34 px
  wide against our 32; its header is ~17 of ~37 px of wall.
- The user specifies in px; land every edge on whole px. Make only what was asked; they dislike extra changes.
- RENDER_VERSION: bump only for engine-file pixel changes (core, post, env_build, scale, geom_digest, sprite_cache).
  slate.py, wall3d.py, envtiles.py are not engine files.
- New colours go in palette_extra.json with `"set": "slate"`, edited by hand. Each entry adds 5 shades that the
  quantizer can snap to (fGSb/fGSc moved the corner's shade-side ramp lit edge #6c7da3 -> #73819f; user: "no issues").
- Don't run check:fast for Python art changes. Don't `pkill -f`.
- Waits for the user: #49, the tan re-render, window wiring, and re-rendering the shipped wall sheets (below).

## Files
- `tools/blender/sprites/faction/slate.py`: the look. `slate(hull)` face factory; `SlateTones`; `slate_plate`
  (ramp blue panel), `slate_grey_panel` (ramp B1-2); `slate_boxes` (header), `slate_panel` (wall);
  `SLATE_TOPS`, `SLATE_RAMPS`; `Slate.relief` (Style: joint=1, ramp_bands with a fixed "fGT0" lit edge, tops, ramps).
- `tools/blender/sprites/wall3d.py`: `_lvl` / `_bands` (a band level may be a palette name: fixed colour, per face
  axis pair), ramp design hook `rv(...)` takes `fixed=`.
- `tools/blender/sprites/envtiles.py`: `_with_runs` + `BEFORE = (1, 8)` (see "Join rule").
- `tools/blender/palette_extra.json`: slate set adds fGTs #4874c8 (aa slate.blue), fGTw #bcd0f0 (aa slate.blue),
  fGSb #92a0ba, fGSc #76849c. The lip's seams (`_seam`, `_seam_col`): fGS5 both sides, over
  the lip's top fGS5 / fGS6 (tried: level 0 near-black; fGSs #2c4258 "way too blue", #2c3844 still too light; dropped). Trim ramp: fGT0 #8ca4d4, fGT1 #5c84d4, fGT2 #3464c4 (front), fGT3 #2c54a4,
  fGT4 #24447c, fGT5 #142c5c, fGT6 #0c1c3c. Face greys fGS0..6 (fGS1 #748c9c, fGS2 #5c6c7c).

## Variants (designs)
- Faction.pairs = every top x every ramp but (0, 0) -> ids `tile.wall.slate.full.m10.aN` (also m5). With tops
  (plain, boxes+panel) and ramps (plates, grey panel): a1 = plain x grey panel, a2 = boxes+panel x plates,
  a3 = boxes+panel x grey panel, a4 = door x plates, a5 = door x grey panel, a6 = hatches (T1-7) x plates, a7 = hatches x grey panel, a8 = panel+box (T1-8) x plates, a9 = panel+box x grey panel, a10 = boxes+console (T1-3) x plates, a11 = boxes+console x grey panel, a12 = boxes+console+boxes (T1-4) x plates, a13 = T1-4 x grey panel.
- Slots in slate's face: `T.fill("header")` -> fn(k, ax, plane, a, b, z0, z1, mit) replaces rail+stripe
  (z0 = zst - 6*PZ the stripe's foot, z1 = rail top); `T.fill("wall")` -> fn(k, ax, plane, a, b, top, foot)
  replaces the faint face line (top = header foot, foot = zg + PZ, the seam over the lip's top).
- The user thinks of the ref's 8 tops as header x wall:
  | top | header | wall |
  |---|---|---|
  | 1 | rail (base) | plain (base) |
  | 2 | three boxes | outlined panel |  <- built (a2/a3)
  | 3 | three boxes | control panel with lights |
  | 4 | one tall blue block | control panel + the three boxes low down (same box part, lower) |
  | 5 | two tall lockers + box | plain |
  | 6 | flat band, stripe cut by doors | double door |
  | 7 | rail | two small doors through the stripe |
  | 8 | rail | outlined panel |
- Ramps: B1 base (blue plate, seam panel), B1-2 = grey panel: seams down the grey in line with the blue panel's
  sides, two 6 px vents (dark, level 0) 2 px apart, a px up the slope from the middle.

### Top 2 as it stands (header signed off by the user at 4fda4d0a)
- Header `slate_boxes`: `BOXES = ((2, 9, False), (13, 6, True), (21, 9, False))` px a tile: 2 px gaps at both ends
  and between; boxes stand 2 px up off the backing's foot (zb = z0 + 2*PZ; on screen the front, RAIL_D out, shows 2 px lower and hides the gap: the user tried 4 px + a shadow and said revert) to z1 at depth RAIL_D, fronts flush;
  corners rounded a px (`_steps`: only each corner's px left out; the middle box's top corners square); middle top slopes
  `MID_SLOPE = 4*PZ` to its front, top colour fGT1 (x: fGT2); visible +u side caps fGT4 (x: fGT5); front top edge lit
  fGT0 (x: fGT1); a seam across each box 7 px over z0, edge to edge, in the sides' tone (fixed fGT4, x: fGT5; lvl 1 was too dark, lvl 2 too light); each front's bottom px in the sides' tone (fGT4, x: fGT5; a BLUE lvl 2 paint snaps to the front's own tone); end boxes: 4 px handle slot 3 px under the top.
  Backing in the stripe's blue (BLUE lvl 3) z0..z1+0.031; no line under it.
- Wall `slate_panel`: outlined rect 22 px wide (c +- 11 LINE), 15 px tall, foot 5 px over the lip seam,
  corners rounded (corner px left out), outline FACE lvl 1; lit bar 14 px wide, 3 px tall, 2 px under the top line;
  ticks 1 px wide at c +- 7 px from a px under the foot up 4 px; bar and ticks fGSb (x: fGSc), drawn at 2*PAINT.
  The wall slot returns the spans [a, b] it leaves free; the face draws its faint line (zst-18*PZ, `_faint`) on them,
  so it runs on behind the panel (the slot gets the line's z as a 7th arg) (the user tried starting the right span a px later, then said revert)
### Top 5 (lockers), first pass at the commit above
- `_box_header(boxes, seam, slot)` builds both headers; boxes = (px from tile start, width incl. the 2 px +u side,
  top slope px (0 = flat, top corners rounded), handle?). T1-2: `BOXES`, seam, slot (4, 3, None) (pixel-identical).
- T1-5: `LOCKERS = ((0, 11, 2, True), (12, 7, 4, False), (20, 11, 2, True))`, no seam, slot (2 wide, 2 px under the
  front's top, 3 px from the box start). Wall: none (the faint line). From ref 09: lockers 8+3 px side, box 4+3, 1 px
  gaps; the ref's lockers also have a lit right-edge column and a 3 px side (ours 2: RAIL_D), not built.
### T1-6 wall (double door), first pass at the commit above
- The user wanted T1-6's wall, not T1-5's lockers header (that repeats T1-2's boxes; built by mistake, reverted).
- `slate_door` (wall slot; base header) + slot `cut=door_cuts` (u c-8..c+9 px a tile): the face leaves the stripe
  (split with `_minus`, cut ends not "out") and the lip's middle recess out there. The door: dark lines (FACE lvl 1,
  T.paint on 0) at c-8, c, c+8, z foot..zst; each leaf's right px lit fGS2 (x: fGS3), top px fGS1 (x: fGS2) (1 px;
  prisms at 2*PAINT); handles 2 px (lit fGS1, dark) at c-4 and c+2, 9/20 of the door down, 5/20 tall
  (ref 11: door rows 18-37, handles 27-31). Faint line gapped. Lesson: anything standing more than ~2*PAINT out
  lands a fraction of a px aside on screen (4*PAINT: half a px, a 1 px line shows 2 px).
- The lip is the base lip (the user tried removing its middle section, then said revert).

## Join rule (changed this session, commit b30dfa9d)
- Wall pieces render "wide": runs of the plain wall beside the piece are holdouts; the piece keeps only px in front
  of them. The east/south stand-ins cut every tile's header 2 px short of its right end (the base rail's end stands
  proud over it), so a variant without that protrusion left holes at joins.
- Now `_with_runs` builds only north/west runs (drawn before: renderer depthKey = x + y, back to front). The tile
  drawn after (east/south) is always the one in front and paints over. Mixed variant runs: no holes.
- Cost: base runs change ~10 px per join by one tone (edge px anti-alias against own samples only). The exact fix
  needs an env_build pass (RENDER_VERSION bump, ~6 h full re-render). Not done.
- **Not shipped**: every look's wall sheets need re-rendering for the rule to reach the game. Waits for the user.
- (Rejected as a band-aid: a dark block in the tile's first 2 px.)

## Lessons
- The base rail's shadow paint runs zst..z0 (up behind the rail): a block end standing out showed a px of face grey
  under its corner (every tile, the middle -> right end block, and the run's end). Test runs: end them with m2 / m8
  (jobs_slate_ends.py), not m10.
- A 1 px seam on a slope needs AA mid-tones between it and the plate (fGT2 seam with fGTs between).
- Flat palette entries never get AA (LUT never picks them).
- Slope tone rule: n.z < 0.3 drops a step (steepening a top darkens it).
- Prism caps: the camera sees +u ends; mitre a lit edge strip with its block (else a false chamfer at corners).
- Shade-side ramp plate joints use the darkest tone unless Style.joint is set (slate: joint=1).

## Commands
```
S=/tmp/claude-0/-home-user/d90bd30e-5bfe-51f0-9d45-019095d96471/scratchpad
R=/tmp/claude-0/-home-user/4e9116e4-3367-4940-9b50-a37888f701dc/scratchpad/handoff/faction_walls_handoff/refs/variants
cd /home/user/cc-ftl-windows/tools/blender/preview && SPRITE_SS=4 timeout 2400 /opt/tools/blender-4.2.9-linux-x64/blender \
  -b --factory-startup --python render.py -- /home/user/cc-ftl-windows $S/sNN $S/scripts/jobs_slate10.py [id,id]
```
- Jobs: `jobs_slate10.py` (m10 + its variants), `jobs_slate.py` (m10, m9 corner + variants). A 4th arg picks ids,
  e.g. `tile.wall.slate.full.m10.a2`.
- Compose (run from /tmp, `python3 -I`):
  - `scripts/zoom2.py out.png 6 a.npz b.npz ref.png ...` side by side.
  - `scripts/top_cmp.py S R out.png x.npz ref.png` 10x header/wall beside the ref.
  - `scripts/run_comp.py out.png 4 a.npz,b.npz,c.npz ...` runs of tiles placed by anchor (step 32, 16), one row per arg.
  - `scripts/slate_prev.sh before after outprefix` m10/m9 beside the ref.
- Refs: `$R/2wall_variant_NN.png` (odd = B1, even = B1-2; tops in pairs: 01/02 T1, 03/04 T1-2, ... 15/16 T1-8).
- Latest renders: `$S/s77` (new rule: m10, m9, a1..a3), `$S/s79` (m10, a2 at 91df8d50).

### T1-7 wall (two small panels, "hatches"), first pass
- User: the T1-6 door is "good enough"; picked T1-7 next. `slate_panel`'s drawing moved into `_panels(rects)` (T1-2
  a3 checked pixel-identical). `slate_hatches`: rects (-13, -4, 2), (4, 13, 2), lift=5 (user: each 2 px out, 2 px up, then 3 px more up): 9 px wide, 8 px apart (6 across a tile join), 5 px higher than T1-2's;
  bar 5 px (2 px in), ticks under the bar's ends; same heights as T1-2. Ref 13 also has a small block
  between/under the two panels (two ticks, into the lip); not built (T1-2's lower box wasn't either).
- Renders: `$S/s103` (a6 now), `$S/s101` (a3, a6, a7 first pass), ends `$S/s99`.
- User: T1-7 "good" at f782c427.
### T1-8 wall (panel + box in the lip), first pass
- Design("panel, box", wall=slate_panel, lip=box_cuts). New face slot `lip`: fn(a, b) -> spans where the lip (its
  prism and lit top px) is left out and the recess skipped; a dark line (FACE lvl 1) up each side from the lip's foot
  to the seam over it (the seam is the box's top). box_cuts: c-4..c+4 px (the recess's span). Base m10 and a6
  checked pixel-identical. Ref 15's panel tucks right under the stripe (its stripe's bottom 2 px dark over the panel's
  span); ours sits at T1-2's height. Not done, ask.
- Renders: `$S/s104` (m10, a6, a8, a9).
- User round 1: panel up 3 px (`slate_panel_box`, lift=3); a seam where the box's floor meets the face; "the end cap
  follows the default ramp geometry and ignores our lip" -> the box showed the ramp's slope under the lip; now a
  prism fills it from the shelf to the lip's foot (top lit top_, no caps) and `_seam` zl-PZ..zl on the face over it.
  Renders: `$S/s105` (a8).
- User round 2: box 1 px wider each side (box_cuts c-5..c+5). "End cap" meant the run's END PIECE (m8's end face):
  it was shell._end_section's straight slope from the wall's foot (zs). Now slate's own `_end_cap` (slate.py): three
  convex polys (the slope from the shelf's edge + the back ramp; a band from the shelf up to zs across the wall; the
  lip's section, LIP_D out, shelf..lip top), the lit edges: up the front from zs, down the slope from the shelf's edge.
  The lip prisms' cap at the run's end (end1) left open (cap False) so the section shows. m10, m9, a3, a6 identical;
  m8 ~70 px. (s99's m2/m8 predate 2671c2ff: their header dither diffs are that, not this.) Renders: `$S/s106` (all).
- User round 3: the end's bottom was tan (wall lvl 2, fGW4 #545c5c) -> all grey: END_COL = "fGS4" (#34444c, the wall
  end's own grey) as `fixed` on _end_cap's polys and SlateTones.end_tone (the ramps' caps at free ends). Slope lit
  edge removed; the corner's vertical lit edge (front edge, zs..zt) kept (asked the user). Only m8 changes (m10, m2,
  a8 identical). Renders: `$S/s107` (m10 + variants, m2, m8).
- User round 4: the vertical lit edge up the end's front corner removed too (_end_cap draws no lit edges; its zt arg
  dropped). Only m8 changes. Renders: `$S/s108` (m10, m2, m8).
- User: T1-8 done ("next variant") at a190c7fd.
### T1-3 (boxes header + console), first pass
- Design("boxes, console", header=slate_boxes, wall=slate_console). CONSOLE: ref 05's screen extracted px for px
  (deskewed with (x+1)//2, nearest of 13 sampled colours), 28 x 13, with 2 blank rows over (1 above the top dots, 1
  under) and 3 under (our wall is taller): 28 x 18, u c-14..c+14, top at the header's foot; a FACE lvl 1 row under.
  Each px via tan_tops._px (a square on the sprite grid; the face's rows step a px every 2 across) at depth 2*PAINT;
  checked: every px lands where the art says (pairing (x+1)//2 matches the ref). Mirrored on x faces (as tan).
- Palette: fGK0..fGKc (slate set). Quantising moves a few: Y #eecb00 -> #d1d100, p -> #34344c, '.' (some) ->
  #22293e, y -> #824b1e, d -> #004c4c. m10 checked identical after the palette add.
- Renders: `$S/s110` (a10).
- User round 1: screen 3 px down (zt = top - 3PZ) + a bezel. Tried a raised bezel (prisms RAIL_D out): its front
  lands ~2 px back along -u and ~1.5 rows lower (debug render with each bar in its own colour, s114), so its edges
  dither and its sides cover the screen's edge px (no backface culling: every cap draws). Now flat: 1 px ring at
  2*PAINT, top fGS1 / left (as seen) lit, foot and right fGS5 (x: fGS2 / fGS6, left/right swapped on x faces).
  console_cuts c-15..c+15. All art visible but its last (blank) row, under the bottom bar (the _px squares sit a
  fraction of a row off the face rows). Renders: `$S/s115` (a10).
- User round 2: bezel all the lit tone (fGS1, x: fGS2), "making it more readable is important" (they liked the
  bevel but it read faint). Renders: `$S/s116` (a10).
- User: T1-3 "good" at 8b3f95f9. Left in the 2-wall refs: T1-4 (ref 07: full blue box header, a console, blue cabinets low).
### T1-4, first pass
- User: "the screen is exactly the same as the last, and the bottom section is exactly the 3 boxes header, just
  placed on the shelf instead of the lip". Design("boxes, console, boxes", header=slate_boxes, wall=slate_console,
  foot=slate_foot_boxes). New face slot `foot`: fn(k, ax, plane, a, b, shelf_z, mit), drawn in place of the lip (no
  lip prisms, seam over it, recess, thirds seams). slate_foot_boxes = slate_boxes(z0=shelf, z1=shelf+HEADER_H (16 px),
  back=0.0: its backing stops at its top). m10, a10 identical. Our wall is taller, so the foot boxes sit under the
  screen (the ref's cover its buttons row). Renders: `$S/s117` (m10, a10, a12, a13).
- User: "this one has a new header". `slate_big_boxes` (header): BIG_BOXES (0,8),(9,14 mid),(24,8) px, a dark px
  (backing BLUE lvl 1) between; depth BIG_D = 2*PX (tops show 2 rows, ref 07); z0 (stripe foot) to z1, middle top
  a px lower; front top edge lit fGT0/1, foot edge side tone, +u cap side tone; square, no seam/handle. Design now
  "big boxes, console, boxes". Renders: `$S/s118` (a12, a13).
- User: "it's supposed to just be the normal header extended down to the paint line". slate_big_boxes dropped. The
  face's rail loop is now `_rail(k, ax, plane, a, b, z0, z1, mit)` (m10, a6 identical); `slate_tall_rail` header =
  BLUE lvl 1 paint z0..z1 behind + _rail from the stripe's foot (z0 = zst-6PZ) to z1. Design "tall rail, console,
  boxes". Mixed run (a12, m10, a12) joins cleanly. Renders: `$S/s119` (m10, a6, a12, a13).
- User: needs a shadow or a dark line at the header's foot -> each tall-rail block's foot edge (zb..zb+PZ at d+PAINT) in fGT4/fGT5, as T1-2's boxes. Renders: `$S/s120` (a12).
- User: darken the side faces a shade -> _rail(shade=1) for the tall rail: inner sides fGT4 (x: fGT5); base m10 identical. Renders: `$S/s121` (m10, a12).
- User: no, not the lines: the literal side face, at the tile's edge (only one visible). Reverted shade; _rail(outer=...) fixes the end blocks' caps at the tile edge: fGT3 (x: fGT4) for the tall rail (was shaded = the front's fGT2). Base m10 identical. Renders: `$S/s122` (m10, a12).
- User: 2 stray light px in the foot line -> the foot edge prisms' caps (default: shaded lvl 4, lit) at the middle block's and right block's -u end; cap=False. 7 px change. Renders: `$S/s123` (a12).

## Test room (after 2d66122c)
- Layout: $S/scripts/slate_room_layout.py (15x11, two rooms + hall, door at (7,3), free run y=8 x=8..11; VAR maps tiles to a<n>).
- Jobs: $S/scripts/jobs_slate_room.py (structure.jobs, slate, floor + m0..m15 with variants). Render ids = `python3 -I slate_room_layout.py`.
- Renders in $S/slate_room/; compose: `cd /tmp && python3 -I $S/scripts/slate_room_compose.py` -> $S/slate_room_{1,2,4}x.png (door from public assets).
- Sent to user (2x + 4x crops); awaiting feedback. No repo changes.
- f91e3429 / cfff085d: T1-4 foot cabinets: slate_boxes(backing=False) for the foot (face grey between/under boxes, no 2 px blue at tile ends); slate_foot_boxes draws _seam at shelf+9PZ over the 2 px end gaps (the plain lip's seam carried to the cabinet). Room renders refreshed in $S/slate_room.
- Open: the user flagged the T1-4 header at its joint with a plain wall (m5 side: 2 px dark side of the tall rail against the plain stripe); asked them what to change, no answer yet. A header-only tweak (dark side only under the plain rail) changed almost nothing and was reverted.
- (next commit) T1-4 cabinets 1 px down (zh-PZ); slate_boxes(mtop=) — foot's middle top fGT1 on ax x (shade side). Header boxes (T1-2/T1-3) still use fGT2 there.
- slate_boxes middle top fGT1 on both sides for all designs (mtop param dropped).
- T1-4 tall rail shadow paint z0..z1-RAIL_H (top edge AA now matches plain). Remaining top diffs: the outer dark cap at the hidden (-u) end, cols 54-55 (m5) / 8-9 (m10).
- T1-4: seam on the front at u=b-LINE..b over z1-RAIL_H..z1-PZ at the seen end (no L with the plain rail's end block).
- T1-4 seen end: _rail(seen=(zs, LINE)) splits the b end block (upper full, lower a px short), seam at b-LINE over the plain rail height; foot edge a px short too. Line straight from top to foot.
- T1-4: _rail(cut=True) adds a 2PZ seam over the lit edge at the end block by the middle (u0 at END_W).
- boxes header lit top edge fGTw (slate_boxes edge=); foot passes edge=None.
- e8ccbcda: boxes header backing stopped at z1 (back=0.0); the black cut top's edge now sits on the same row as the plain wall's. Room npz updated from sr14 (m10.a10, m10.a2, m5.a3, m5.a11). Awaiting user's look.
- c3b6fc58: boxes header lid (lid=True; foot cabinets lid=False): full-width 2 px top strip fGT1 at z1, over gaps/rounded corners. Room npz from sr15. a12 identical. Awaiting user's look.
- f4fd25ff: boxes header seam = dark (fGT4 y / fGT3 x) over lit fGT1 at SEAM_Z=8PZ (on the plain line's row, m10 checked; dark renders 294688 vs plain 24447c). Foot cabinets keep old seam (lid=False). Room npz from sr17. Awaiting user.
- 1fb08b53: seam tones stepped up (dark fGT5 y/fGT4 x, lit fGT0): on the box fronts the 1 px diagonal AA'd lighter than plain's line; sub-row z offsets tested (sdz*), none solid; kept SEAM_Z=8PZ. Room npz from sr18.
- 9e49ccbf: reverted f4fd25ff+1fb08b53 (user: line on boxes was fine); seam now carried over the END gap (last box -> tile edge) on the backing (depth 0..PAINT, z0+6PZ..7PZ, side tone). Interior gaps untouched (side faces fill them). Room npz from sr22.
- 81f09f37: end-gap seam gets its lit px under (fGT0 at z0+5PZ, renders ~8ca4d4). Room npz from sr24.
- fa663f49: end-gap line now T.paint BLUE 1 (dark) / BLUE 4 (lit) at PAINT, as plain's: lit renders 5c84d4 like plain. Room npz from sr25.
- User OK with fa663f49 end-gap line ('missing ~1 px of AA, good enough'). Boxes header thread closed.
