"""Quick preview of the station holograms (starmap_holo.py), for the render lab's `holo` panel before they join the sheets.

  SPRITE_PREVIEW=1 blender -b --factory-startup --python tools/blender/review/holo_preview.py -- <out dir> [kind,...]

Writes <out dir>/holo.png (the frames side by side) and <out dir>/holo.json ({ "frames": { id: {x, y, w, h,
points: {name: [x, y]}} } }). Scratch output only: the real sheet comes from `npm run sprites`."""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, starmap_holo  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = Path(argv[0] if argv else ".cache/holo-preview")
kinds = argv[1].split(",") if len(argv) > 1 else starmap_holo.KINDS
out.mkdir(parents=True, exist_ok=True)
core.setup_scene()
items = [starmap_holo.holo_item(k) for k in kinds]
gap = 2
sheet = np.zeros((starmap_holo.H, len(items) * (starmap_holo.W + gap), 4), np.uint8)
frames = {}
for i, it in enumerate(items):
    x = i * (starmap_holo.W + gap)
    h, w = it["rgba"].shape[:2]
    sheet[:h, x:x + w] = it["rgba"]
    frames[it["id"]] = {"x": x, "y": 0, "w": w, "h": h, "points": it["points"]}
post.write_png(out / "holo.png", sheet)
(out / "holo.json").write_text(json.dumps({"frames": frames}, indent=1))
print("HOLO_PREVIEW", out, len(items), flush=True)
