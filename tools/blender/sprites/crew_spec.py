"""Crew sprite spec: the data the crew build reads. NOT part of any render-cache hash on purpose: adding a clip or
changing a clip's fps/loop re-renders nothing that already exists (a clip's frame count is part of that clip's keys).

FRAME is one fixed size for EVERY crew layer, so a bigger new item never changes an existing sheet. It is the render
canvas plus a 1 px pad on each side (the pad keeps room for the runtime outline). Size it with margin: the largest
current gear (EVA pack/helmet, sleeping poses) reaches 76 px above the feet, 15 below and 52 to each side, so this
frame has 94 above, 26 below and 64 each side. Changing any constant here re-renders ALL crew (it is in the global
cache hash)."""

FRAME_W, FRAME_H = 128, 120
ANCHOR = (64, 94)                       # feet position inside a frame (x, y from top)
W, H = FRAME_W - 2, FRAME_H - 2         # render canvas
ORIGIN = (ANCHOR[0] - 1, ANCHOR[1] - 1)  # feet position in the render canvas

ORDER = {"body": 0, "eyes": 10, "legs": 20, "torso": 30, "gear.belt": 40, "arm.R": 50, "arm.L": 51, "gear.shoulder": 53, "gear.holster": 54, "hair": 60,
         "gear.hand": 55, "implant.temple": 65, "gear.head": 70, "gear.back": 80}       # gear.hand: held weapons
# (clip, frames, fps, loop). Every clip gets its own sheet per item (crew_build.item_clips says which items get it).
CLIPS = [("idle", 4, 4, True), ("walk", 8, 10, True), ("work", 6, 8, True), ("sleep", 3, 2, True), ("sit_idle", 4, 3, True),
         ("sit_work", 6, 8, True), ("eva_float", 4, 4, True),
         ("aim_1h", 2, 3, True), ("fire_1h", 3, 12, False), ("aim_2h", 2, 3, True), ("fire_2h", 3, 12, False),
         ("aim_heavy", 2, 3, True), ("fire_heavy", 4, 12, True), ("walk_aim_1h", 8, 10, True),
         ("walk_aim_2h", 8, 10, True), ("walk_heavy", 8, 7, True), ("ready_1m", 2, 3, True),
         ("swing_1m", 5, 12, False), ("ready_2m", 2, 3, True), ("swing_2m", 6, 12, False), ("crouch_idle", 2, 3, True),
         ("crouch_walk", 6, 8, True), ("crouch_aim_1h", 2, 3, True), ("crouch_fire_1h", 3, 12, False),
         ("crouch_aim_2h", 2, 3, True), ("crouch_fire_2h", 3, 12, False), ("crouch_fire_heavy", 4, 12, True),
         ("crouch_ready_1m", 2, 3, True), ("lean_l_1h", 2, 3, True), ("lean_r_1h", 2, 3, True),
         ("lean_l_2h", 2, 3, True), ("lean_r_2h", 2, 3, True)]
