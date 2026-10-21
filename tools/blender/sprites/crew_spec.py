"""Crew sprite spec: the data the crew build reads. NOT part of any render-cache hash on purpose: adding a clip or
changing a clip's fps/loop re-renders nothing that already exists (a clip's frame count is part of that clip's keys).

FRAME is one fixed size for EVERY crew layer, so a bigger new item never changes an existing sheet. It is the render
canvas plus a 1 px pad on each side (the pad keeps room for the runtime outline). Size it with margin: the largest
current gear (EVA pack/helmet, sleeping poses) reaches 76 px above the feet, 15 below and 52 to each side at the 64x32
baseline, so this frame has 94 above, 26 below and 64 each side, times ART_SCALE. Changing any constant here re-renders
ALL crew (it is in the global cache hash)."""

from .scale import ART_SCALE as _S

FRAME_W, FRAME_H = 128 * _S, 120 * _S    # 256 x 240 at the 128x64 tile (128 x 120 at the old 64x32)
ANCHOR = (64 * _S, 94 * _S)             # feet position inside a frame (x, y from top)
W, H = FRAME_W - 2, FRAME_H - 2         # render canvas
ORIGIN = (ANCHOR[0] - 1, ANCHOR[1] - 1)  # feet position in the render canvas

ORDER = {"body": 0, "eyes": 10, "legs": 20, "torso": 30, "gear.belt": 40, "arm.R": 50, "arm.L": 51, "hair": 60,
         "implant.temple": 65, "gear.head": 70, "gear.back": 80}
# (clip, frames, fps, loop). Every clip gets its own sheet per item (crew_build.item_clips says which items get it).
CLIPS = [("idle", 4, 4, True), ("walk", 8, 10, True), ("work", 6, 8, True), ("sleep", 3, 2, True), ("sit_idle", 4, 3, True),
         ("sit_work", 6, 8, True), ("eva_float", 4, 4, True)]
