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
HATCH_SURF, HATCH_U, HATCH_Z = 0.80, 1.40, 1.30      # hatch outer plane (out from the centre line), along the nose, axis height
LENGTHS = (0.0, 0.18, 0.34, 0.5)                      # extension from the hatch plane: retracted (no sprite) .. mated (one fixed length)
RADII = (0.78, 0.70, 0.62)                            # nested rings sized to the hatch opening (radius 0.80), outermost first
SIDES = 24


def _annulus(f, u, r0, r1, mat, v, z):
    """Flat ring at u between radii r0 < r1 (facing +u)."""
    a = [f.pt(u, v + r0 * math.cos(i * math.tau / SIDES), z + r0 * math.sin(i * math.tau / SIDES)) for i in range(SIDES)]
    b = [f.pt(u, v + r1 * math.cos(i * math.tau / SIDES), z + r1 * math.sin(i * math.tau / SIDES)) for i in range(SIDES)]
    for i in range(SIDES):
        j = (i + 1) % SIDES
        f.poly([a[i], b[i], b[j], a[j]], mat, flip=True)


def tube(heading, length):
    """The telescoping tube from the hatch toward the hull, in a frame whose u axis is the hatch normal. Open rings, no end
    discs: three nested shells that slide out of the hatch opening (ring k reaches k/3 of the length), a hazard mouth ring
    with lamp studs on the innermost and a dark bore."""
    m = core.Mesh("dock_tube")
    f = FlightFrame(m, heading - math.pi / 2)
    u0 = HATCH_SURF
    ends = [u0 + length * (k + 1) / 3 for k in range(3)]
    cols = ("gW1", "steelL", "steel")
    for k, (r, e, col) in enumerate(zip(RADII, ends, cols)):
        f.hcyl(u0, e, HATCH_U, HATCH_Z, r, col, sides=SIDES)
        _annulus(f, e, (RADII[k + 1] if k < 2 else r - 0.06), r, "steelD", HATCH_U, HATCH_Z)           # the step to the next ring / mouth lip
        f.hcyl(e, u0, HATCH_U, HATCH_Z, r - 0.025, "dark", sides=SIDES)                                  # inside (reversed faces): the bore
    e = ends[-1]
    _annulus(f, e + 0.001, RADII[-1] - 0.06, RADII[-1], "hazY", HATCH_U, HATCH_Z)                       # hazard mouth ring
    for i in range(8):
        a = i * math.tau / 8
        f.box(e, HATCH_U + (RADII[-1] - 0.03) * math.cos(a), HATCH_Z + (RADII[-1] - 0.03) * math.sin(a), 0.045, 0.045, 0.045, "cyan", top="cyan")
    return [m.build()]


core.setup_scene()
for d in (4, 6):
    h = d * math.pi / 4 - math.pi / 2                  # side-docked heading: the hatch faces -outward
    core.clear_scene_meshes()
    post.select(True)
    it = VB._render(f"dock_d{d}", "prop", SC.transport_shuttle(h, "docked"), [], (1, 1))
    np.savez(OUT / f"dock_d{d}.npz", rgba=it["rgba"], g=it["g"], ax=it["ax"], ay=it["ay"])
    for i, L in enumerate(LENGTHS):
        if L == 0.0:
            continue
        core.clear_scene_meshes()
        post.select(True)
        it = VB._render(f"tube_d{d}_{i}", "prop", tube(h, L), [], (1, 1))
        np.savez(OUT / f"tube_d{d}_{i}.npz", rgba=it["rgba"], g=it["g"], ax=it["ax"], ay=it["ay"])
        print("done", d, i, it["rgba"].shape, flush=True)
