"""Shipped crew sheets match the manifest: each per-clip sheet is 8 rows x frames of (cw x ch) cells, glow twin the same
size. Run: python3 tools/blender/test_crew_sheets.py [assets dir]"""
import json
import sys
from pathlib import Path

from PIL import Image

assets = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "public" / "assets"
m = json.loads((assets / "manifest.json").read_text())
n = 0
for lid, a in m["assets"].items():
    if a["kind"] != "crew.layer":
        continue
    for cn, c in a["clips"].items():
        if not c.get("sheet"):
            continue
        sh = m["sheets"][c["sheet"]]
        cw, ch = c.get("cw", a["frameW"]), c.get("ch", a["frameH"])
        size = Image.open(assets / sh["image"]).size
        assert size == ((c["start"] + c["frames"]) * cw, 8 * ch), (lid, cn, size, cw, ch)
        if "glow" in sh:
            assert Image.open(assets / sh["glow"]).size == size, (lid, cn, "glow")
        n += 1
assert n > 100
print(f"crew sheets ok ({n} clips)")
