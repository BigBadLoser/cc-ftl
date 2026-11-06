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
from sprites import crew_marks, crew_marks_bubbles, post  # noqa: E402

out = Path(sys.argv[1] if len(sys.argv) > 1 else ".cache/marks-preview")
out.mkdir(parents=True, exist_ok=True)
its = crew_marks.items()
gap, row_w, cell = 1, 1024, crew_marks.H + 1         # rows of at most 1024 px: a browser texture stays small
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

# Checks: a break symbol must sit inside its bubble with a px to spare, and nothing coloured may touch the canvas edge
# (its outline would be cut off).
problems = []
for kind, (fn, n) in crew_marks.BREAKS.items():
    for f in range(n):
        sym = fn(f)
        room = crew_marks_bubbles.shrink(crew_marks_bubbles.SHAPES[kind](crew_marks.Canvas(), f), crew_marks_bubbles.RIM + 1)
        over = int(((sym.k != "") & (sym.k != "t") & (sym.k != "T") & ~room).sum())   # T/t: tier parts that reach the rim
        if over:
            problems.append(f"{kind}.{f}: {over} px over the bubble's inside margin")
dark = np.array(crew_marks.rgb(crew_marks.COL["K"]))
for it in its:
    a = it["rgba"]
    col = (a[..., 3] > 0) & ~(a[..., :3] == dark).all(-1)
    if col[0].any() or col[-1].any() or col[:, 0].any() or col[:, -1].any():
        problems.append(f"{it['id']}: touches the canvas edge (outline cut)")
print("\n".join(problems) if problems else "checks: every symbol inside its bubble, no outline cut")
