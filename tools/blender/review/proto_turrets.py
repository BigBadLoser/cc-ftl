"""Render the turret concepts (runs in Blender) to .npz pixel sprites for turrets_composite.py, plus Blender review cells.
  blender -b --factory-startup --python tools/blender/review/proto_turrets.py -- <out dir> <job> [<job> ...]
Jobs: t:<H|S|R>:<driver|laser>:<hot 0|1>:<d 0..7>   turret sprite at aim d
      bay:<H|S|R>                                    mass driver bay (idle)
      dep:<H|S|R>                                    stowed + deploy frames f0..f4 (driver, d0)
      roof:<n>  walls                                roof patch (n x n at ZR) / full-height back walls at ZR
      cell:<H|S|R>                                   Blender renders: turrets on a roof patch, bay + turret"""
import sys
from pathlib import Path
import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, env_build, roofs, walls, turret_concepts as TC, turret_bays as TB  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
OUT.mkdir(parents=True, exist_ok=True)
SAMPLES = next((int(a[2:]) for a in args if a.startswith("s=")), 64)     # s=20: quick preview (denoised)
roofs.ZR = walls.HF = TC.ZR        # LOCAL override (see turret_concepts.ZR)
_src = Path(__file__).with_name("blender_cells.py").read_text().rsplit("\nmain()", 1)[0]
_ns = {"__name__": "blender_cells_lib", "__file__": str(Path(__file__).with_name("blender_cells.py"))}
exec(compile(_src, "blender_cells.py", "exec"), _ns)


def region_mask(x, y, lo, hi):
    ins = lambda a, b: lo <= a <= hi and lo <= b <= hi  # noqa: E731
    return (1 if ins(x, y - 1) else 0) | (2 if ins(x + 1, y) else 0) | (4 if ins(x, y + 1) else 0) | (8 if ins(x - 1, y) else 0)


def roof_patch(n, c=None):
    c = (n - 1) / 2 if c is None else c
    objs = []
    for x in range(n):
        for y in range(n):
            m = core.Mesh(f"roof_{x}_{y}", flat=True)
            roofs._tile(m, region_mask(x, y, 0, n - 1))
            m.v = [(vx + x - c, vy - (y - c), vz) for vx, vy, vz in m.v]
            objs.append(m.build())
    return objs


def pixel(tag, kind, fn):
    core.setup_scene()
    sc = core._state["scene"]
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = SAMPLES < 64
    core.clear_scene_meshes()
    post.select(True)
    c, op, g, ox, oy, _ = env_build.render_sprite("x", kind, fn())
    np.savez(OUT / f"{tag}.npz", rgba=post.to_rgba(c, op), glow=g, ox=ox, oy=oy)
    print("pixel", tag, flush=True)


def cell(tag, fn, W, H, kind="block"):
    _ns["setup"]()
    sc = core._state["scene"]
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    col, glow = _ns["render_cell"](tag, fn, kind, W, H)
    arr = _ns["finish"](col, glow, kind)
    post.write_png(OUT / f"{tag}.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))
    print("cell", tag, flush=True)


def turret(d_, kind, hot, d, **kw):
    return TC.place(TC.TURRETS[(d_, kind)](hot), d, **kw)


def full_walls():
    """Back walls of a room x, y in -1..n (full height): pieces keyed by mask."""
    return {m: (lambda m=m: walls.block(m, "wall", None, f"wf{m}", True)) for m in (10, 5, 6, 12, 3)}


def shifted(objs, dx, dy):
    from mathutils import Matrix
    for ob in objs:
        ob.matrix_world = Matrix.Translation(core.G(dx, dy, 0)) @ ob.matrix_world
    return objs


for job in [a for a in args[1:] if not a.startswith("s=")]:
    p = job.split(":")
    if p[0] == "t":
        pixel(f"t_{p[1]}_{p[2]}_{p[3]}_d{p[4]}", "prop", lambda p=p: turret(p[1], p[2], p[3] == "1", int(p[4])))
    elif p[0] == "bay":
        pixel(f"bay_{p[1]}", "prop", lambda p=p: TB.BAYS[p[1]]())
    elif p[0] == "dep":
        pixel(f"dep_{p[1]}_stowed", "prop", lambda p=p: TB.deploy(p[1], -1))
        for k in range(5):
            pixel(f"dep_{p[1]}_f{k}", "prop", lambda p=p, k=k: TB.deploy(p[1], k))
    elif p[0] == "roof":
        pixel(f"roof_{p[1]}", "block", lambda p=p: roof_patch(int(p[1])))
    elif p[0] == "walls":
        for m, fn in full_walls().items():
            pixel(f"wallf_{m}", "block", fn)
    elif p[0] == "cell":
        d_ = p[1]
        cell(f"blender_{d_}_turrets", lambda: roof_patch(7, 3) + shifted(turret(d_, "driver", True, 7), 1.0, 1.0)
             + shifted(turret(d_, "laser", True, 7), -0.9, -1.4), 900, 640)
        cell(f"blender_{d_}_bay", lambda: TB.BAYS[d_]() + turret(d_, "driver", True, 7), 760, 760, kind="prop")
