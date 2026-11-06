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
gap = 1
sheet = np.zeros((crew_marks.H, len(its) * (crew_marks.W + gap), 4), np.uint8)
frames = {}
for i, it in enumerate(its):
    x = i * (crew_marks.W + gap)
    sheet[:, x:x + crew_marks.W] = it["rgba"]
    frames[it["id"]] = {"x": x, "y": 0, "w": crew_marks.W, "h": crew_marks.H, "ax": it["ax"], "ay": it["ay"]}
post.write_png(out / "marks.png", sheet)
(out / "marks.json").write_text(json.dumps({"fps": crew_marks.FPS, "frames": frames}, indent=1))
print("MARKS_PREVIEW", out, len(its))
