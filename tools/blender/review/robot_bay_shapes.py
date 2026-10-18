"""Blender shape render of the robot bay (smooth, unquantised, 3x game scale): rotation 0 in each state, rotations 1-3
empty, then robots docked in their charge pose (fit check). Writes robot-bay-shapes.png into the out dir.

  blender -b --factory-startup --python tools/blender/review/robot_bay_shapes.py -- <out dir>"""
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, robot_bay, robots  # noqa: E402
from sprites import human_render as hr  # noqa: E402
from sprites.robot_render import pose  # noqa: E402

Z = 3
W, H = 120 * Z, 120 * Z
CELLS = [(0, s, None) for s in robot_bay.STATES if not s.startswith("assembling") or s.endswith(".f0")]
CELLS += [(r, "", None) for r in (1, 2, 3)]
CELLS += [(2, "charging", "worker"), (2, "charging", "security"), (2, "charging.drone", "repair"), (0, "charging", "worker"),
          (3, "charging", "security")]


def dock(rot, kind):
    """A robot of `kind` in its charge pose on the bay's cradle."""
    rig = robots.BUILD[kind]()
    (dx, dy), d = robot_bay.placement(rot)
    rig.root.rotation_euler = (0, 0, __import__("math").radians(hr.THETA[d]))
    pose(rig, "charge", 3)
    rig.root.location = (dx, -dy, rig.root.location.z)


def main():
    out = Path(sys.argv[sys.argv.index("--") + 1])
    out.mkdir(parents=True, exist_ok=True)
    core.setup_scene()
    import bpy
    bpy.context.scene.cycles.samples, bpy.context.scene.cycles.filter_width = 16, 1.0
    ss, core.SS = core.SS, 1
    tiles = []
    for rot, st, kind in CELLS:
        robot_bay.build(rot, st)
        if kind:
            dock(rot, kind)
        for ob in bpy.data.objects:
            if ob.type == "EMPTY" and ob.parent is None:
                ob.scale = tuple(v * Z for v in ob.scale)
                ob.location = tuple(v * Z for v in ob.location)
        rgb, a = core.render(W, H, "color", (W // 2, int(H * 0.8)))
        g, _ = core.render(W, H, "glow", (W // 2, int(H * 0.8)))
        tiles.append(np.dstack([np.clip(rgb + g * 0.6, 0, 255), a * 255]).astype(np.uint8))
        print("bay", rot, st, kind, flush=True)
    core.SS = ss
    cols = 5
    sheet = np.zeros((H * ((len(tiles) + cols - 1) // cols), W * cols, 4), np.uint8)
    sheet[..., :3], sheet[..., 3] = (40, 46, 56), 255
    for k, t in enumerate(tiles):
        sl = sheet[(k // cols) * H:(k // cols + 1) * H, (k % cols) * W:(k % cols + 1) * W]
        al = t[..., 3:4] / 255.0
        sl[..., :3] = (t[..., :3] * al + sl[..., :3] * (1 - al)).astype(np.uint8)
    post.write_png(out / "robot-bay-shapes.png", sheet)


main()
