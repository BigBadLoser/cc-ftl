"""Single-view Cycles look renders of the arcade cabinet and the water purifier (runs in Blender), one clean image per
state with the glow bloomed, for look reviews (the blender_cells.py treatment).
  blender -b --factory-startup --python tools/blender/review/leisure_water_preview.py -- <out dir> [rot]"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_cells as bc  # noqa: E402  (its OUT is the same dir)
from sprites import arcade, post, purifier  # noqa: E402

ROT = int(sys.argv[sys.argv.index("--") + 2]) if len(sys.argv) > sys.argv.index("--") + 2 else 0
JOBS = [(f"arcade.{s}", lambda s=s: arcade.arcade(s, ROT, 1), 420, 560) for s in ("idle", "active", "unpowered")] + \
       [(f"purifier.{s}", lambda s=s: purifier.purifier(s, ROT, 1), 620, 480) for s in ("idle", "active", "unpowered")]


def main():
    bc.setup()
    for sid, fn, W, H in JOBS:
        col, glow = bc.render_cell(sid, fn, "prop", W, H)
        arr = bc.finish(col, glow, "prop")
        post.write_png(bc.OUT / f"{sid}.r{ROT}.png", bc.np.dstack([arr, bc.np.full(arr.shape[:2], 255, bc.np.uint8)]))
        print("cell", sid, flush=True)


main()
