"""The station hull bay's machinery (station_hull_bay; designs 5 to 7 try three fills of small ductwork, design
reference only):
  5  a grid: thin pipes across at several heights and depths, two square ducts up near its ends, boxes where they meet
  6  a manifold: a duct up its middle, thin pipes branching from it to either end, a valve box on the floor
  7  bundles: two runs of three thin pipes stacked tight across it, elbow boxes at their ends, small units under"""
import math

from . import core
from . import wall3d as T
from . import station_hull_designs as SD
from .wall3d_ext_geom import D, F, LINE

PIPE_COLS = ((0.7, "stH"), (0.2, "stL"), (-0.3, "stS"), (-0.8, "stM"), (-2, "stD"))   # by the facet's up-ness


def machinery(f, design, u0, u1, zf, zl, back):
    """Design `design`'s fill of the bay [u0, u1] x [zf, zl], its back at d = back."""
    {5: _grid, 6: _manifold, 7: _bundles}[design](f, u0, u1, zf, zl, back, 1 / core.ZPX)


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


def _duct(f, u, w, z0, z1, d0, d1):
    """A square duct up the bay, w px across from u."""
    _box(f, u, u + w * LINE, z0, z1, d0, d1, "stS", "stL", "stM")


def _knot(f, uc, zc, d, n=2):
    """A junction box n px round (u, z) on whatever runs through it, its front at d."""
    px = 1 / core.ZPX
    _box(f, uc - n * LINE, uc + n * LINE, zc - n * px, zc + n * px, d - 2 * n * LINE, d, "stM", "stH", "stD")


def _grid(f, u0, u1, zf, zl, back, px):
    for zc, dc in ((7, 3), (13, 5), (20, 2.5), (28, 4), (35, 3), (43, 5)):
        _pipe(f, u0, u1, zf + zc * px, D - dc * LINE, 1.5, 8)
    for u, d in ((u0 + 2 * LINE, D - 6 * LINE), (u1 - 5 * LINE, D - 8 * LINE)):
        _duct(f, u, 3, zf, zl, back, d)
    for uc, zc, d in ((u0 + 3.5 * LINE, 20, 1), (u1 - 3.5 * LINE, 28, 2), (u0 + 3.5 * LINE, 35, 1)):
        _knot(f, uc, zf + zc * px, D - d * LINE)
    _box(f, u0 + 6 * LINE, u1 - 6 * LINE, zf, zf + 3 * px, back, D - 3 * LINE, "stM", "stL", "stD")


def _manifold(f, u0, u1, zf, zl, back, px):
    m = (u0 + u1) / 2
    _duct(f, m - 2 * LINE, 4, zf, zl, back, D - 3 * LINE)
    for zc, side, dc in ((9, 0, 4), (16, 1, 6), (24, 0, 3.5), (31, 1, 5), (39, 0, 6), (46, 1, 4)):
        a, b = (u0, m) if side else (m, u1)
        _pipe(f, a, b, zf + zc * px, D - dc * LINE, 1.5, 8)
        _knot(f, m, zf + zc * px, D - 2 * LINE, 1)
    _box(f, u0 + LINE, m - 3 * LINE, zf, zf + 5 * px, back, D - 3 * LINE, "stM", "stL", "stD")   # (a valve box)
    _box(f, u0 + 2 * LINE, u0 + 4 * LINE, zf + 5 * px, zf + 7 * px, D - 6 * LINE, D - 4 * LINE, "stS", "stH", "stM")


def _bundles(f, u0, u1, zf, zl, back, px):
    for z0, dc in ((14, 3), (34, 4)):
        for k in range(3):                                  # (three pipes stacked tight, the lowest out front)
            _pipe(f, u0 + 2 * LINE, u1 - 2 * LINE, zf + (z0 + 3 * k) * px, D - (dc + k) * LINE, 1.5, 8)
        for u in (u0 + LINE, u1 - 3 * LINE):               # (elbow boxes at their ends, into the walls)
            _box(f, u, u + 2 * LINE, zf + (z0 - 2) * px, zf + (z0 + 8) * px, back, D - (dc - 2) * LINE, "stM", "stL",
                 "stD")
    for u, w, h in ((u0 + LINE, 5, 6), (u0 + 7 * LINE, 6, 4)):   # (small units on the floor)
        _box(f, u, u + w * LINE, zf, zf + h * px, back, D - 3 * LINE, "stS", "stL", "stM")
        SD._rect(f, u, u + w * LINE, zf + (h - 1) * px, zf + h * px, D - 3 * LINE + 0.001, "stH")
