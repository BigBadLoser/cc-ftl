"""Shuttle bay + shuttle prototype renders (runs in Blender): pixel sprites as .npz for proto_bay_composite.py, and one
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
from sprites import core, post, env_build, shuttle_bay as B, shuttle as S  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
JOBS = args[1:] or ["bay", "shuttle"]
OUT.mkdir(parents=True, exist_ok=True)
SAMPLES = 64
FRAMES = (0.0, 0.33, 0.66, 1.0)


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


PH_K = 0.88                       # placeholder scale (it is wider than the 3-wide well at 1:1)


def placeholder_xf(rot):
    """(centre (x, y) in Blender space, scale, z lift) that puts the PLACEHOLDER on the doors, centred in the well."""
    c = B.BayFrame(None, rot).pt(B.UC, 0.0, 0.0)
    return (c.x, c.y), PH_K, -B.PIT + 0.05 - 0.04 * PH_K


def placeholder(rot):
    """The PLACEHOLDER shuttle (shuttle.py, for scale only), length along the well's 5-tile axis, standing on the rails."""
    m = core.Mesh(f"shuttle_placeholder_r{rot}")
    S.build(B.BayFrame(m, rot, off=(B.UC, 0.0)), "parked")
    ob = m.build()
    (cx, cy), k, lz = placeholder_xf(rot)
    ob.scale = (k, k, k)
    ob.location = (cx * (1 - k), cy * (1 - k), lz)
    return [ob]


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
            render(f"shuttle_parked_r{rot}", placeholder(rot) + hold, "prop", hold)
    if "launch" in JOBS:
        for k, (dz, t) in enumerate(((S.PARK_DZ + 0.3, 0.0), (S.PARK_DZ - 0.45, 1.0), (S.PARK_DZ - 0.95, 1.0))):
            fresh()
            sh = S.launch(0, dz)
            hold = B.bay(0, t)
            render(f"shuttle_launch_{k}", sh + hold, "prop", hold)
    if "fly" in JOBS:
        for d in (0, 1, 2, 3, 4, 5, 6, 7):
            fresh()
            render(f"shuttle_fly_d{d}", S.fly(d), "prop")
    if "cell" in JOBS:
        src = Path(__file__).with_name("blender_cells.py").read_text().rsplit("\nmain()", 1)[0]
        ns = {"__name__": "blender_cells_lib", "__file__": str(Path(__file__).with_name("blender_cells.py"))}
        exec(compile(src.replace("OUT = Path(sys.argv[sys.argv.index(\"--\") + 1])", f"OUT = Path({str(OUT)!r})"), "blender_cells.py", "exec"), ns)
        ns["setup"]()
        sc = core._state["scene"]
        sc.cycles.samples = 64
        try:
            sc.cycles.use_denoising = True
        except Exception:
            pass
        core.clear_scene_meshes()
        def scene():
            B.floor_holdout(0, False, "plateA")                 # deck with the well cut out (not counted in the framing)
            return B.bay(0, 0.0)[:1] + placeholder(0)
        col, glow = ns["render_cell"]("cell", scene, "block", 760, 560)
        arr = ns["finish"](col, glow, "prop")
        post.write_png(OUT / "blender_bay_shuttle_r0.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))
        print("cell done", flush=True)


main()
