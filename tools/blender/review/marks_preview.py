"""Quick preview of the overhead crew icons (sprites/crew_marks.py) for the render lab's `marks` panel, before they join
the sheets. Plain python3 + numpy (no Blender):

  python3 -I tools/blender/review/marks_preview.py [<out dir>]     (default .cache/marks-preview)

Writes <out>/marks.png (every frame in a row) and <out>/marks.json ({ "frames": { id: {x, y, w, h, ax, ay} }, "fps" }).
Scratch output only: the real sheet comes from `npm run sprites`."""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import crew_marks, crew_marks_tiers, post  # noqa: E402

out = Path(sys.argv[1] if len(sys.argv) > 1 else ".cache/marks-preview")
out.mkdir(parents=True, exist_ok=True)
its = crew_marks.items() + crew_marks_tiers.items()
gap, row_w, cell = 1, 1024, crew_marks.H + 1          # rows of at most 1024 px: a browser texture stays small
frames, x, y = {}, 0, 0
for it in its:
    h, w = it["rgba"].shape[:2]
    if x + w > row_w:
        x, y = 0, y + cell
    frames[it["id"]] = {"x": x, "y": y, "w": w, "h": h, "ax": it["ax"], "ay": it["ay"]}
    x += w + gap
sheet = np.zeros((y + cell, row_w, 4), np.uint8)
for it in its:
    f = frames[it["id"]]
    sheet[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]] = it["rgba"]
post.write_png(out / "marks.png", sheet)
(out / "marks.json").write_text(json.dumps({"fps": crew_marks.FPS, "frames": frames}, indent=1))
print("MARKS_PREVIEW", out, len(its))
