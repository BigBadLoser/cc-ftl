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
ROTS = [int(a) for a in args[1:] if a.isdigit()] or [1]
OUT.mkdir(parents=True, exist_ok=True)

# reuse the review cell renderer (setup / render_cell / finish) without running its main()
_src = Path(__file__).with_name("blender_cells.py").read_text().rsplit("\nmain()", 1)[0]
_ns = {"__name__": "blender_cells_lib", "__file__": str(Path(__file__).with_name("blender_cells.py"))}
exec(compile(_src, "blender_cells.py", "exec"), _ns)


def pixel_sprite(rot, hot, part):
    core.setup_scene()
    core._state["scene"].cycles.samples = 64      # the pipeline's 4 samples leave a speckle on tilted cones; 64 renders clean
    core.clear_scene_meshes()
    post.select(True)
    kind = "block" if part == "hull" else "prop"
    c, op, g, ox, oy, _ = env_build.render_sprite("x", kind, engine_proto.engine4x5(rot, hot, part))
    return post.to_rgba(c, op), g, ox, oy


def main():
    _ns["setup"]()
    for rot in ROTS:
        specs = [(False, "hull"), (False, "machine"), (True, "machine")]
        for hot, part in specs:
            if "--machine" in args and part == "hull":
                continue
            rgba, g, ox, oy = pixel_sprite(rot, hot, part)
            tag = f"r{rot}_{part}{'_active' if hot else ''}_v7"
            np.savez(OUT / f"px_{tag}.npz", rgba=rgba, glow=g, ox=ox, oy=oy)
            print("pixel", tag, rgba.shape, flush=True)
        if rot == 1 and "--cell" in args:
            _ns["setup"]()
            core._state["scene"].cycles.samples = 128
            try:
                core._state["scene"].cycles.use_denoising = True
            except Exception:
                pass
            core.clear_scene_meshes()
            col, glow = _ns["render_cell"]("cell", lambda: engine_proto.engine4x5(1, True, "cell"), "prop", 760, 620)
            arr = _ns["finish"](col, glow, "prop")
            post.write_png(OUT / "blender_r1_active_v7.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))


main()
