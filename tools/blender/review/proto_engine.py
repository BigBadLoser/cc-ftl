"""Style prototype render (runs in Blender): Blender cell + final pixel sprite of the 4x5 engine, composited on floor
tiles with a hull wall and a crew member for scale, plus a 3x zoom.
  blender -b --factory-startup --python tools/blender/review/proto_engine.py -- <out dir> [rot]"""
import sys
from pathlib import Path
import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, env_build, engine_proto  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
ROTS = [int(a) for a in args[1:]] or [1]
OUT.mkdir(parents=True, exist_ok=True)

# reuse the review cell renderer (setup / render_cell / finish) without running its main()
_src = Path(__file__).with_name("blender_cells.py").read_text().rsplit("\nmain()", 1)[0]
_ns = {"__name__": "blender_cells_lib", "__file__": str(Path(__file__).with_name("blender_cells.py"))}
exec(compile(_src, "blender_cells.py", "exec"), _ns)


def pixel_sprite(rot, hot):
    core.setup_scene()
    core.clear_scene_meshes()
    post.select(True)
    c, op, g, ox, oy, _ = env_build.render_sprite("x", "prop", engine_proto.engine4x5(rot, hot))
    rgba = post.to_rgba(c, op)
    return rgba, g, ox, oy


def main():
    _ns["setup"]()
    for rot in ROTS:
        for hot in (False, True):
            tag = f"r{rot}{'_active' if hot else ''}_v2"
            col, glow = _ns["render_cell"](tag, lambda: engine_proto.engine4x5(rot, hot), "prop", 760, 620)
            arr = _ns["finish"](col, glow, "prop")
            post.write_png(OUT / f"blender_{tag}.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))
            core.setup_scene()
            rgba, g, ox, oy = pixel_sprite(rot, hot)
            tag = f"r{rot}{'_active' if hot else ''}_v2"
            np.savez(OUT / f"px_{tag}.npz", rgba=rgba, glow=g, ox=ox, oy=oy)
            print("pixel", tag, rgba.shape, flush=True)


main()
