"""Render a jobs file's sprites as .npz (rgba, anchor) at the art scale (64x32 tiles), without the sprite sheets:
$BLENDER -b --factory-startup --python render.py -- <repo> <out dir> <jobs.py> [ids,...]
A jobs file defines JOBS = {sprite id: (kind, build)} as env_build takes them (kind "block" or "wide"). A job that
fails prints FAIL and the rest go on; one with nothing visible prints EMPTY. SPRITE_SS=4 for the real quality."""
import math
import runpy
import sys
from pathlib import Path

import numpy as np

A_ = sys.argv[sys.argv.index("--") + 1:]
sys.path.insert(0, str(Path(A_[0]) / "tools/blender"))
from sprites import scale  # noqa: E402
scale.TILE_W, scale.TILE_H, scale.ART_SCALE = 64, 32, 1
from sprites import core  # noqa: E402
core.TILE_W, core.TILE_H, core.ART_SCALE = 64, 32, 1
core.PXU = core.TILE_W / math.sqrt(2)
core.ZPX = core.PXU * math.cos(math.radians(30))
from sprites import post, env_build  # noqa: E402

JOBS = runpy.run_path(A_[2])["JOBS"]
want = A_[3].split(",") if len(A_) > 3 and A_[3] else list(JOBS)
core.setup_scene()
out = Path(A_[1])
out.mkdir(parents=True, exist_ok=True)
for k in want:
    kind, fn = JOBS[k]
    core.clear_scene_meshes()
    post.select(True)
    objs = fn()
    try:
        it = env_build.crop_item(k, (1, 1), *env_build.render_sprite(k, kind, objs)) if objs else None
    except Exception as e:                          # (one failing job reported, the rest go on)
        print("FAIL", k, repr(e), flush=True)
        continue
    if it is None:
        print("EMPTY", k, flush=True)
        continue
    np.savez_compressed(out / (k + ".npz"), rgba=it["rgba"], g=it["g"], a=np.array([it["ax"], it["ay"]]))
    print("ITEM", k, it["rgba"].shape, flush=True)
print("DONE")
