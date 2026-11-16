"""The station hull bay's machinery (station_hull_bay; designs 5 to 7 try three fills, design reference only). The
bay is tall, narrow and deep and seen from over its near end, so its runs go up it, near its mouth:
  5  risers: three pipes up the bay side by side, clamped across at two heights, into a plinth on the floor
  6  a square duct up its far end and a pipe up its near end, short pipes across between them, a valve on the pipe
  7  a cabinet at its back, two conduits up in front of it into a junction box, a unit on the floor"""
import math

from . import core
from . import wall3d as T
from . import station_hull_designs as SD
from .wall3d_ext_geom import D, F, LINE

PIPE_COLS = ((0.7, "stH"), (0.2, "stL"), (-0.3, "stS"), (-0.8, "stM"), (-2, "stD"))   # by the facet's up-ness


def machinery(f, design, u0, u1, zf, zl, back):
    """Design `design`'s fill of the bay [u0, u1] x [zf, zl], its back at d = back."""
    {5: _risers, 6: _duct_pipe, 7: _cabinet_conduits}[design](f, u0, u1, zf, zl, back, 1 / core.ZPX)


def _box(f, u0, u1, z0, z1, d0, d1, front, top, side):
    f.part(u0, u1, [(d0, z0), (d0, z1), (d1, z1), (d1, z0)], [None, top, front, None], side, end=False)


def _pipe(f, u0, u1, zc, dc, r, n=12):
    """A pipe across [u0, u1], r px round (its facets toned by how far up they face)."""
    px = 1 / core.ZPX
    pts = [(dc + r * LINE * math.cos(math.pi - 2 * math.pi * i / n), zc + r * px * math.sin(math.pi - 2 * math.pi * i / n))
           for i in range(n)]
    cols = []
    for i in range(n):
        a = math.pi - 2 * math.pi * (i + 0.5) / n
        up, out = math.sin(a), math.cos(a)
        cols.append(None if out < -0.6 else next(c for t, c in PIPE_COLS if up >= t))
    f.part(u0, u1, pts, cols, None, end=False)


def _disc(f, uc, zc, r, d, col, n=24):
    px = 1 / core.ZPX
    f.k.poly([T.P(f.ax, f.plane, uc + r * LINE * math.cos(2 * math.pi * i / n), zc + r * px * math.sin(2 * math.pi * i / n),
                  d) for i in range(n)], F, 3, T.OUT(f.ax), fixed=T.SEAM_PASS or col)


def _vpipe(f, uc, dc, z0, z1, r, n=10):
    """A pipe up the bay at (uc, dc), r px round: its facets toned by facing (the near end, +u, lit), its top capped."""
    o = T.P(f.ax, 0, 0, 0, 0)
    for i in range(n):
        a0, a1, am = (2 * math.pi * k / n for k in (i, i + 1, i + 0.5))
        nu, nd = math.cos(am), math.sin(am)
        if nd < -0.3:
            continue
        col = "stL" if nu > 0.5 else "stM" if nu < -0.5 else "stS"
        q = [T.P(f.ax, f.plane, uc + r * LINE * math.cos(a), z, dc + r * LINE * math.sin(a))
             for a, z in ((a0, z0), (a1, z0), (a1, z1), (a0, z1))]
        f.k.poly(q, F, 3, (T.P(f.ax, 0, nu, 0, nd) - o).normalized(), fixed=T.SEAM_PASS or col)
    f.k.poly([T.P(f.ax, f.plane, uc + r * LINE * math.cos(2 * math.pi * k / n), z1, dc + r * LINE * math.sin(2 * math.pi * k / n))
              for k in range(n)], F, 3, core.Vector((0, 0, 1)), fixed=T.SEAM_PASS or "stH")


def _risers(f, u0, u1, zf, zl, back, px):
    _box(f, u0 + LINE, u1 - LINE, zf, zf + 3 * px, back, D - LINE, "stM", "stL", "stD")
    w = (u1 - u0) / 3
    for k in range(3):
        _vpipe(f, u0 + w * (k + 0.5), D - 3 * LINE, zf + 3 * px, zl, 1.6)
    for zc in (14, 38):                                     # (clamps across them)
        _box(f, u0 + LINE, u1 - LINE, zf + zc * px, zf + (zc + 2) * px, D - 6 * LINE, D - LINE, "stM", "stL", "stD")


def _duct_pipe(f, u0, u1, zf, zl, back, px):
    _box(f, u0 + LINE, u0 + 5 * LINE, zf, zl, back, D - 2 * LINE, "stS", "stL", "stM")   # (the duct, its far end)
    SD._rect(f, u0 + LINE, u0 + 5 * LINE, zf + 24 * px, zf + 25 * px, D - 2 * LINE + 0.001, "stD")
    up = u1 - 3 * LINE
    _vpipe(f, up, D - 3 * LINE, zf, zl, 2)
    for zc in (12, 26, 40):                                 # (short pipes across between them)
        _pipe(f, u0 + 5 * LINE, up, zf + zc * px, D - 3 * LINE, 1, 8)
    _box(f, up - 3 * LINE, up + 3 * LINE, zf + 17 * px, zf + 21 * px, D - 6 * LINE, D, "stM", "stH", "stD")   # (a valve)


def _cabinet_conduits(f, u0, u1, zf, zl, back, px):
    _box(f, u0 + LINE, u1 - LINE, zf, zl - 6 * px, back, D - 7 * LINE, "stM", "stS", "stD")
    for zc in range(8, 40, 6):
        SD._rect(f, u0 + 2 * LINE, u1 - 2 * LINE, zf + zc * px, zf + (zc + 1) * px, D - 7 * LINE + 0.001, "stD")
    m = (u0 + u1) / 2
    for uc in (m - 2.5 * LINE, m + 2.5 * LINE):
        _vpipe(f, uc, D - 2 * LINE, zf + 6 * px, zl, 1.2)
    _box(f, m - 5 * LINE, m + 5 * LINE, zf + 22 * px, zf + 28 * px, D - 5 * LINE, D - LINE, "stS", "stL", "stM")
    SD._rect(f, m + 3 * LINE, m + 4 * LINE, zf + 24 * px, zf + 25 * px, D - LINE + 0.001, "stB")
    _box(f, u0 + LINE, u1 - LINE, zf, zf + 6 * px, back, D - LINE, "stS", "stL", "stM")
    SD._rect(f, u0 + LINE, u1 - LINE, zf + 5 * px, zf + 6 * px, D - LINE + 0.001, "stH")
