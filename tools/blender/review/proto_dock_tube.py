"""Shuttle docking-tube preview renders (runs in Blender): the side-docked shuttle (legs up, wings folded) and, separately, its
telescoping tube at extension lengths from retracted to mated, per hull outward direction d (4 = west hull, 6 = north hull: the far hulls, where the hatch and tube are visible), as .npz with the
shuttle centre as the sprite origin (so they stack at the same position). Composited over an in-game crop by
proto_dock_tube_composite.py.
  blender -b --factory-startup --python tools/blender/review/proto_dock_tube.py -- <out dir>"""
import math
import sys
from pathlib import Path
import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, vehicle_bay as VB, shuttle_craft as SC  # noqa: E402
from lib import palette  # noqa: E402
from lib.transport_forms import FlightFrame  # noqa: E402

OUT = Path(sys.argv[sys.argv.index("--") + 1])
OUT.mkdir(parents=True, exist_ok=True)
for k, hx in VB.LIVERY.items():
    palette._data[k] = {"hex": hx}
HATCH_SURF, HATCH_U, HATCH_Z = 0.80, 1.40, 1.30      # hatch surface (out from the centre line), along the nose, axis height
LENGTHS = (0.1, 0.4, 0.7, 1.0)                        # extension from the hatch surface: retracted .. mated
RADII = (0.77, 0.68, 0.59)                            # nested segments, outermost first
BASE = 0.3                                            # the outer segment's fixed length


def tube(heading, length):
    """The telescoping tube from the hatch toward the hull, in a frame whose u axis is the hatch normal."""
    m = core.Mesh("dock_tube")
    f = FlightFrame(m, heading - math.pi / 2)
    u0 = HATCH_SURF - 0.04
    rest = max(0.0, length - BASE)
    ends = (u0 + BASE, u0 + BASE + rest / 2, u0 + BASE + rest)
    mats = (("gW1", "steelL"), ("steelL", "steel"), ("steel", "steelD"))
    for k, (r, e, (col, cap)) in enumerate(zip(RADII, ends, mats)):
        f.hcyl(u0 + 0.02 * k, e, HATCH_U, HATCH_Z, r, col, sides=20, cap=cap)
        f.hcyl(e - 0.012, e, HATCH_U, HATCH_Z, r + 0.015, "steelD", sides=20, cap="steelD")          # seam ring at each joint
    e = ends[-1]
    f.hcyl(e, e + 0.07, HATCH_U, HATCH_Z, RADII[-1] + 0.02, "hazY", sides=20, cap="hazY")             # mouth ring
    f.hcyl(e + 0.07, e + 0.09, HATCH_U, HATCH_Z, RADII[-1] - 0.06, "dark", sides=20, cap="dark")      # gasket
    for i in range(8):                                                                            # lamp studs round the mouth
        a = i * math.tau / 8
        f.box(e + 0.04, HATCH_U + (RADII[-1] + 0.02) * math.cos(a), HATCH_Z + (RADII[-1] + 0.02) * math.sin(a), 0.05, 0.05, 0.05, "cyan", top="cyan")
    return [m.build()]


core.setup_scene()
for d in (4, 6):
    h = d * math.pi / 4 - math.pi / 2                  # side-docked heading: the hatch faces -outward
    core.clear_scene_meshes()
    post.select(True)
    it = VB._render(f"dock_d{d}", "prop", SC.transport_shuttle(h, "docked"), [], (1, 1))
    np.savez(OUT / f"dock_d{d}.npz", rgba=it["rgba"], g=it["g"], ax=it["ax"], ay=it["ay"])
    for i, L in enumerate(LENGTHS):
        core.clear_scene_meshes()
        post.select(True)
        it = VB._render(f"tube_d{d}_{i}", "prop", tube(h, L), [], (1, 1))
        np.savez(OUT / f"tube_d{d}_{i}.npz", rgba=it["rgba"], g=it["g"], ax=it["ax"], ay=it["ay"])
        print("done", d, i, it["rgba"].shape, flush=True)
