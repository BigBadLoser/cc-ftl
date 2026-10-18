"""v9 BLOCKOUT: full-footprint shuttle bay + the real art/shuttle shuttle (needs shuttle_craft.py and lib/transport_*.py from
origin/art/shuttle in the tree). Shuttle bay prototype renders (runs in Blender): pixel sprites as .npz for proto_bay_composite.py, and one
clean Cycles review render.
  blender -b --factory-startup --python tools/blender/review/proto_bay.py -- <out dir> [jobs...]
jobs: bay (r0 hatch frames), shuttle (placeholder parked r0), rots (bay + placeholder r1..r3), cell (Blender review render),
launch / fly (placeholder shuttle only; the real shuttle is made elsewhere)."""
import math
import sys
from pathlib import Path
import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, env_build, shuttle_bay as B  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
JOBS = args[1:] or ["bay", "shuttle"]
OUT.mkdir(parents=True, exist_ok=True)
SAMPLES = 16
FRAMES = (0.0, 0.2, 0.66)


def render(tag, objs, kind, holdouts=()):
    """Like env_build.render_sprite, but the canvas comes from the visible objects only (holdouts may be huge)."""
    for ob in holdouts:
        ob.is_holdout = True
    vis = [o for o in objs if o not in holdouts]
    xmin, xmax, ymin, ymax = core.extent_px(vis)
    W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, core.SS, 8, True)
    if kind == "prop":
        c, op = post.outline(c, op, True)
    else:
        c, op = env_build._pad1(c), env_build._pad1(op)
    grgb, _ = core.render(W, H, "glow")
    g = env_build._pad1(post.glow_down(grgb, core.SS, 3))
    np.savez(OUT / f"{tag}.npz", rgba=post.to_rgba(c, op), glow=g, ox=(W + 2) // 2, oy=(H + 2) // 2)
    print("pixel", tag, c.shape, flush=True)


def shuttle_ob(rot):
    """The real parked shuttle (art/shuttle transport_shuttle), centred on the pit, nose +v at r0 so the hatch faces +u (the
    long side that faces the camera), hanging in the cradle arms, feet at z = FEET_Z (PIT - LIFT). Review livery colours stand in for the export keys."""
    from lib import palette
    from sprites import shuttle_craft as SC
    palette._data["mkP"], palette._data["mkS"] = {"hex": "#527593"}, {"hex": "#c7a15e"}
    obs = SC.transport_shuttle(math.pi / 2 + rot * math.pi / 2, "parked", dz=B.FEET_Z)
    c = B.BayFrame(None, rot).pt(0.0, 0.0, 0.0)
    for ob in obs:
        ob.location = (ob.location.x + c.x, ob.location.y + c.y, ob.location.z)
    return obs


def fresh():
    core.setup_scene()
    core._state["scene"].cycles.samples = SAMPLES
    core.clear_scene_meshes()
    post.select(True)


def main():
    if "bay" in JOBS or "rots" in JOBS:
        for rot in ((0, 1, 2, 3) if "rots" in JOBS else (0,)):
            for t in (FRAMES if rot == 0 and "bay" in JOBS else (0.0,)):
                fresh()
                objs = B.bay(rot, t)
                render(f"bay_r{rot}_t{int(t * 100)}", objs, "block", objs[1:])
    if "shuttle" in JOBS or "rots" in JOBS:
        for rot in ((0, 1, 2, 3) if "rots" in JOBS else (0,)):
            fresh()
            hold = B.bay(rot, 0.0)
            render(f"shuttle_parked_r{rot}", shuttle_ob(rot) + hold, "prop", hold)


main()
