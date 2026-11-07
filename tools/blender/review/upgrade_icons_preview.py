"""Quick preview of the weapon upgrade icons (sprites/upgrade_icons.py) for the render lab's `upgrades` panel. Plain python3 + numpy:

  python3 -I tools/blender/review/upgrade_icons_preview.py [<out dir>]     (default .cache/upgrade-icons-preview)

Writes <out>/icons.png (every icon in a row) and <out>/icons.json ({ "frames": { id: {x, y, w, h, ax, ay} } }). Scratch output only."""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import post, upgrade_icons  # noqa: E402

out = Path(sys.argv[1] if len(sys.argv) > 1 else ".cache/upgrade-icons-preview")
out.mkdir(parents=True, exist_ok=True)
its = upgrade_icons.items()
n = upgrade_icons.N
sheet = np.zeros((n, (n + 1) * len(its), 4), np.uint8)
frames = {}
for i, it in enumerate(its):
    x = i * (n + 1)
    sheet[:, x:x + n] = it["rgba"]
    frames[it["id"]] = {"x": x, "y": 0, "w": n, "h": n, "ax": it["ax"], "ay": it["ay"]}
post.write_png(out / "icons.png", sheet)
(out / "icons.json").write_text(json.dumps({"frames": frames}, indent=1))
print("UPGRADE_ICONS_PREVIEW", out, len(its))
