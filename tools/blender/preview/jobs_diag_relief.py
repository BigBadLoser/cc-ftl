"""Diagonal walls look test: the straight run's relief piece (wall3d.block mask 10, walls up) turned 45 degrees onto the
camera-facing diagonal of jobs_diag_mock's A, its panels squeezed to one per staircase tile (s ~0.71) or stretched to one
per two (s ~1.41), between straight runs."""
import math
import sys
from pathlib import Path

from mathutils import Matrix

from sprites import core
from sprites import wall3d as T

sys.path.insert(0, str(Path(__file__).parent))
from jobs_diag_mock import YC, floor  # noqa: E402

R2 = math.sqrt(2)


def _place(objs, gx, gy, ang, sx):
    """Objects built at the tile origin: scaled sx along the run, turned ang (degrees, ccw in the grid) about z, moved
    so the run's centre line (local y = YC) lands on the grid point (gx, gy)."""
    a = math.radians(ang)
    ox, oy = -math.sin(a) * YC, math.cos(a) * YC                        # (local (0, YC) turned)
    m = Matrix.Translation(core.G(gx - ox, gy - oy, 0.0)) @ Matrix.Rotation(-a, 4, "Z") @ Matrix.Diagonal((sx, 1, 1, 1))
    for o in objs:                                                      # (baked into the mesh: the canvas is
        o.data.transform(m)                                             # sized from its vertices)
        o.data.update()
    return objs


def scene(s):
    objs = []
    for x in range(-3, 1):
        objs += _place(T.block(10, "wall", level="up"), x, YC, 0, 1)
    n = round(3 * R2 / s)
    for i in range(n):
        t = (i + 0.5) * s / R2
        objs += _place(T.block(10, "wall", level="up"), 0.5 + t, YC - t, -45, s)
    for x in range(4, 7):
        objs += _place(T.block(10, "wall", level="up"), x, YC - 3, 0, 1)
    m = core.Mesh(f"diag_floor_{s}", flat=True)
    floor(m, -3, 6, -4, 1, set())
    return objs + [m.build()]


JOBS = {"diag.relief.squeeze": ("block", lambda: scene(R2 / 2)), "diag.relief.stretch": ("block", lambda: scene(R2))}
