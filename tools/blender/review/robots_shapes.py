"""Blender shape render of the robot crew in the rest pose (smooth, unquantised, 4x game scale), for reviewing the
basic forms before animation. Writes robots-shapes-<type>-<dir>.png (RGBA) into the out dir.

  blender -b --factory-startup --python tools/blender/review/robots_shapes.py -- <out dir>"""
import math
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, robots  # noqa: E402
from sprites import human_render as hr  # noqa: E402
from sprites.robot_render import _state  # noqa: E402

Z = 4                                       # zoom over game scale
W, H, ORIGIN = 124 * Z, 100 * Z, (62 * Z, 88 * Z)
DIRS = {"SE": 0, "S": 1, "SW": 2, "NW": 4}
# Livery keys shown in the player colours (preview only; the sprites keep the palette-swap keys).
LIVERY = {"team.cloth": (186, 182, 166), "team.accent": (205, 140, 40)}
_lin = core.lin


def _livery_lin(name):
    base = name.partition("*")[0]
    if base in LIVERY:
        return tuple(((c / 255) ** 2.2) for c in LIVERY[base])
    return _lin(name)


core.lin = _livery_lin


def main():
    out = Path(sys.argv[sys.argv.index("--") + 1])
    out.mkdir(parents=True, exist_ok=True)
    ss = core.SS
    for kind, build in robots.BUILD.items():
        core.setup_scene()
        core.SS = 1
        bpy_scene_samples(16)
        rig = build()
        rig.root.scale = tuple(v * Z for v in rig.root.scale)
        for name, d in DIRS.items():
            rig.root.rotation_euler = (0, 0, math.radians(hr.THETA[d]))
            rig.rest()
            _state(rig, "idle", 0)
            if rig.kind != "drone":
                rig.ground_attached()
            rgb, a = core.render(W, H, "color", ORIGIN)
            g, _ = core.render(W, H, "glow", ORIGIN)
            rgba = np.dstack([np.clip(rgb + g * 0.6, 0, 255), a * 255]).astype(np.uint8)
            post.write_png(out / f"robots-shapes-{kind}-{name}.png", rgba)
            print("shape", kind, name, flush=True)
    core.SS = ss


def bpy_scene_samples(n):
    import bpy
    bpy.context.scene.cycles.samples = n
    bpy.context.scene.cycles.filter_width = 1.0


main()
