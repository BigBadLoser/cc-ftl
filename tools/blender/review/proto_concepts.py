"""Render the weapon concepts (runs in Blender, 64 samples): pixel sprites (.npz) per direction A/B/C (charged turrets at aim 1,
idle bay) plus one Blender review cell per direction (mass driver bay + turret).
  blender -b --factory-startup --python tools/blender/review/proto_concepts.py -- <out dir>"""
import sys
from pathlib import Path
import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, env_build, weapon_concepts as W  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
OUT.mkdir(parents=True, exist_ok=True)
_src = Path(__file__).with_name("blender_cells.py").read_text().rsplit("\nmain()", 1)[0]
_ns = {"__name__": "blender_cells_lib", "__file__": str(Path(__file__).with_name("blender_cells.py"))}
exec(compile(_src, "blender_cells.py", "exec"), _ns)


def pixel(d, part, hot, k=0):
    if "cellonly" in args:
        return
    core.setup_scene()
    core._state["scene"].cycles.samples = 64
    core.clear_scene_meshes()
    post.select(True)
    c, op, g, ox, oy, _ = env_build.render_sprite("x", "prop", W.build(f"{d}:{part}", hot, k))
    np.savez(OUT / f"cx_{d}_{part}.npz", rgba=post.to_rgba(c, op), glow=g, ox=ox, oy=oy)
    print("pixel", d, part, flush=True)


def main():
    only = [a for a in args[1:] if a in ("A", "B", "C")] or list("ABC")
    for d in only:
        pixel(d, "turret_laser", True)
        pixel(d, "turret_driver", True)
        pixel(d, "bay_driver", False)
        if "nocell" in args:
            continue
        _ns["setup"]()
        _ns["core"].clear_scene_meshes()
        sc = core._state["scene"]
        sc.cycles.samples = 64
        col, glow = _ns["render_cell"](f"cell_{d}", lambda d=d: W.build(f"{d}:cell_driver", True, 0), "prop", 760, 680)
        arr = _ns["finish"](col, glow, "prop")
        post.write_png(OUT / f"blender_{d}.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))
        print("cell", d, flush=True)


main()
