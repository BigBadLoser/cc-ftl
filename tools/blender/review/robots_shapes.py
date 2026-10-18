"""Blender shape render of the robot crew in the neutral standing pose, idle frame 0 (smooth, unquantised, 4x game scale), for reviewing the
basic forms before animation. Writes robots-shapes-<type>-<dir>.png (RGBA) into the out dir.

  blender -b --factory-startup --python tools/blender/review/robots_shapes.py -- <out dir>"""
import math
import os
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, robots  # noqa: E402
from sprites import human_render as hr  # noqa: E402
from sprites.robot_render import pose  # noqa: E402

Z = 4                                       # zoom over game scale
W, H, ORIGIN = 124 * Z, 100 * Z, (62 * Z, 88 * Z)
DIRS = {"SE": 0, "S": 1, "SW": 2, "NW": 4}
# Livery keys shown in faction colours (preview only; the sprites keep the palette-swap keys). ROBOT_ROGUE=1: the
# rogue AI's crimson livery and red eyes.
ROGUE = bool(os.environ.get("ROBOT_ROGUE"))
CLIP, _, _F = os.environ.get("ROBOT_POSE", "idle:0").partition(":")       # ROBOT_POSE=work:3 renders that frame instead
FRAME = int(_F or 0)
LIVERY = ({"team.cloth": (132, 38, 42), "team.accent": (44, 44, 52)} if ROGUE else
          {"team.cloth": (186, 182, 166), "team.accent": (205, 140, 40)})
_lin = core.lin


def _livery_lin(name):
    base = name.partition("*")[0]
    if base in LIVERY:
        return tuple(((c / 255) ** 2.2) for c in LIVERY[base])
    if ROGUE and name == "cyan":
        return _lin("red")
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
            pose(rig, CLIP, FRAME)
            rgb, a = core.render(W, H, "color", ORIGIN)
            g, _ = core.render(W, H, "glow", ORIGIN)
            rgba = np.dstack([np.clip(rgb + g * 0.6, 0, 255), a * 255]).astype(np.uint8)
            post.write_png(out / f"robots-shapes-{kind}-{name}{'-rogue' if ROGUE else ''}{'-' + CLIP if CLIP != 'idle' else ''}.png", rgba)
            print("shape", kind, name, flush=True)
    core.SS = ss


def bpy_scene_samples(n):
    import bpy
    bpy.context.scene.cycles.samples = n
    bpy.context.scene.cycles.filter_width = 1.0


main()
