"""Render the weapon prototypes (runs in Blender): pixel sprites (.npz) for bays and turrets, plus one Blender review cell
per weapon (bay + roof-height column + turret).
  blender -b --factory-startup --python tools/blender/review/proto_weapon.py -- <out dir>"""
import sys
from pathlib import Path
import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, env_build, weapon_proto as W  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
OUT.mkdir(parents=True, exist_ok=True)
_src = Path(__file__).with_name("blender_cells.py").read_text().rsplit("\nmain()", 1)[0]
_ns = {"__name__": "blender_cells_lib", "__file__": str(Path(__file__).with_name("blender_cells.py"))}
exec(compile(_src, "blender_cells.py", "exec"), _ns)


def pixel(tag, kind, hot=False, k=0):
    core.setup_scene()
    core.clear_scene_meshes()
    post.select(True)
    c, op, g, ox, oy, _ = env_build.render_sprite("x", "prop", W.build(kind, hot, k))
    np.savez(OUT / f"px_{tag}.npz", rgba=post.to_rgba(c, op), glow=g, ox=ox, oy=oy)
    print("pixel", tag, flush=True)


def main():
    for w in ("laser", "driver"):
        pixel(f"bay_{w}", f"bay_{w}")
        for k in (0, 1, 2):
            pixel(f"turret_{w}_k{k}", f"turret_{w}", False, k)
            pixel(f"turret_{w}_k{k}_charged", f"turret_{w}", True, k)
    for w, (cw, ch) in (("laser", (700, 640)), ("driver", (900, 800))):
        _ns["setup"]()
        core.clear_scene_meshes()
        col, glow = _ns["render_cell"](f"cell_{w}", lambda w=w: W.build(f"cell_{w}", True, 1), "prop", cw, ch)
        arr = _ns["finish"](col, glow, "prop")
        post.write_png(OUT / f"blender_{w}.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))
        print("cell", w, flush=True)


main()
