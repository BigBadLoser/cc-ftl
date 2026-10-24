"""crew_trim: cropping to the union box, idempotence, and re-padding a cell to the full layer frame."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sprites import crew_trim as ct  # noqa: E402

FW, FH, FRAMES = 20, 16, 3
img = np.zeros((8 * FH, FRAMES * FW, 4), np.uint8)
gl = np.zeros_like(img)
img[2 * FH + 5, 1 * FW + 7] = (9, 9, 9, 255)            # direction 2, frame 1
img[5 * FH + 9, 2 * FW + 12] = (8, 8, 8, 255)           # direction 5, frame 2
gl[0 * FH + 3, 0 * FW + 4] = (7, 7, 7, 255)             # glow reaches further up-left
asset = {"frameW": FW, "frameH": FH}

t, g, box = ct.trim_sheet(img, gl, FW, FH)
assert box == (4, 3, 13, 10), box
assert t.shape == (8 * 7, FRAMES * 9, 4) and g.shape == t.shape
clip = {}
ct.apply_trim(clip, asset, box)
assert (clip["cw"], clip["ch"], clip["ox"], clip["oy"]) == (9, 7, 4, 3)

# the cell re-padded to the full frame is exactly the original cell
for d in range(8):
    for col in range(FRAMES):
        want = img[d * FH:(d + 1) * FH, col * FW:(col + 1) * FW]
        assert (ct.full_cell(t, asset, clip, d, col) == want).all(), (d, col)

# idempotent: trimming again changes nothing and the offsets stay put
t2, _, box2 = ct.trim_sheet(t, g, clip["cw"], clip["ch"])
assert box2 == (0, 0, 9, 7) and (t2 == t).all()
clip2 = dict(clip)
ct.apply_trim(clip2, asset, box2)
assert clip2 == clip

# an empty sheet keeps one transparent pixel per cell
e, _, ebox = ct.trim_sheet(np.zeros_like(img), None, FW, FH)
assert ebox == (0, 0, 1, 1) and e.shape == (8, FRAMES, 4)
print("crew_trim ok")
