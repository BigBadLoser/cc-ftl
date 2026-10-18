"""Engine review renders (runs in Blender): pixel sprites (hull layer, machine idle / active) per rotation plus the
neighbouring hull-wall sprites at the review wall height, as .npz for engine_composite.py; optionally a clean Blender
cell render.
  blender -b --factory-startup --python tools/blender/review/engine_review.py -- <out dir> [rots..] [--cell] [--samples=N]
  [--parts=hull,idle,active,walls]"""
import sys
from pathlib import Path
import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, env_build, engine, walls  # noqa: E402

walls.HF = 2.4       # local override: full walls are being raised to 2.4 on a parallel branch

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
ROTS = [int(a) for a in args[1:] if a.isdigit()] or [1]
SAMPLES = next((int(a.split("=")[1]) for a in args if a.startswith("--samples=")), 64)
PARTS = next((a.split("=")[1].split(",") for a in args if a.startswith("--parts=")), ["hull", "idle", "active", "walls"])
OUT.mkdir(parents=True, exist_ok=True)

_src = Path(__file__).with_name("blender_cells.py").read_text().rsplit("\nmain()", 1)[0]
_ns = {"__name__": "blender_cells_lib", "__file__": str(Path(__file__).with_name("blender_cells.py"))}
exec(compile(_src, "blender_cells.py", "exec"), _ns)


def pixel(tag, kind, build):
    core.setup_scene()
    core._state["scene"].cycles.samples = SAMPLES
    core.clear_scene_meshes()
    post.select(True)
    c, op, g, ox, oy, _ = env_build.render_sprite(tag, kind, build())
    np.savez(OUT / f"px_{tag}.npz", rgba=post.to_rgba(c, op), glow=g, ox=ox, oy=oy)
    print("pixel", tag, c.shape, flush=True)


def main():
    if "walls" in PARTS:
        for mask in (5, 10):
            for full in (True, False):
                pixel(f"wall_m{mask}_{'full' if full else 'low'}", "block", lambda m=mask, fu=full: walls.block(m, "hull", None, None, fu))
    for rot in ROTS:
        if "hull" in PARTS:
            pixel(f"r{rot}_hull", "block", lambda: engine.engine(rot, False, "hull"))
        for hot in (False, True):
            if ("active" if hot else "idle") in PARTS:
                pixel(f"r{rot}_machine{'_active' if hot else ''}", "prop", lambda h=hot: engine.engine(rot, h, "machine"))
        if "--cell" in args:
            for hot in (True,):
                _ns["setup"]()
                sc = core._state["scene"]
                sc.cycles.samples = max(SAMPLES, 24)
                sc.cycles.use_denoising = True
                core.clear_scene_meshes()
                col, glow = _ns["render_cell"]("cell", lambda h=hot: engine.engine(rot, h, "cell"), "prop", 900, 720)
                arr = _ns["finish"](col, glow, "prop")
                post.write_png(OUT / f"blender_r{rot}{'_active' if hot else ''}.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))
                print("cell", rot, flush=True)


main()
