"""The station hull bay's machinery (station_hull_bay; designs 5 to 7 try three fills, design reference only):
  5  a unit hung from the top, rungs down its front, over a stack of two boxes on the floor
  6  three pipes across the bay, a flange on each, over a junction box on the floor
  7  a cabinet on the floor, a round hatch in its front, a conduit across over it"""
import math

from . import core
from . import wall3d as T
from . import station_hull_designs as SD
from .wall3d_ext_geom import D, F, LINE

PIPE_COLS = ((0.7, "stH"), (0.2, "stL"), (-0.3, "stS"), (-0.8, "stM"), (-2, "stD"))   # by the facet's up-ness


def machinery(f, design, u0, u1, zf, zl, back):
    """Design `design`'s fill of the bay [u0, u1] x [zf, zl], its back at d = back."""
    {5: _hung, 6: _pipes, 7: _cabinet}[design](f, u0, u1, zf, zl, back, 1 / core.ZPX)


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


def _hung(f, u0, u1, zf, zl, back, px):
    # the floor's stack: a wide box, a narrower one on it
    d = D - 2 * LINE
    _box(f, u0 + LINE, u1 - LINE, zf, zf + 10 * px, back, d, "stS", "stL", "stM")
    SD._rect(f, u0 + LINE, u1 - LINE, zf + 5 * px, zf + 6 * px, d + 0.001, "stD")
    SD._rect(f, u0 + LINE, u1 - LINE, zf + 9 * px, zf + 10 * px, d + 0.001, "stH")
    _box(f, u0 + 3 * LINE, u1 - 3 * LINE, zf + 10 * px, zf + 16 * px, back, D - 4 * LINE, "stM", "stL", "stD")
    # the hung unit: rungs down its front, its near edge lit
    d = D - 4 * LINE
    z0 = zl - 26 * px
    _box(f, u0 + 2 * LINE, u1 - 2 * LINE, z0, zl, back, d, "stD", "stD", "stE")
    for k in range(3, 24, 3):
        SD._rect(f, u0 + 4 * LINE, u1 - 4 * LINE, zl - (k + 1) * px, zl - k * px, d + 0.001, "stM")
    SD._rect(f, u1 - 3 * LINE, u1 - 2 * LINE, z0, zl, d + 0.002, "stS")


def _pipes(f, u0, u1, zf, zl, back, px):
    _box(f, u0 + 2 * LINE, u1 - 2 * LINE, zf, zf + 5 * px, back, D - 3 * LINE, "stM", "stL", "stD")
    m = (u0 + u1) / 2
    for zc, dc, r in ((zf + 12 * px, D - 6 * LINE, 3), (zf + 25 * px, D - 8 * LINE, 2.5), (zf + 38 * px, D - 5 * LINE, 3)):
        _pipe(f, u0, u1, zc, dc, r)
        _pipe(f, m - LINE, m + LINE, zc, dc, r + 1)        # (a flange on it)


def _cabinet(f, u0, u1, zf, zl, back, px):
    d = D - 2 * LINE
    zt = zl - 8 * px
    _box(f, u0 + LINE, u1 - LINE, zf, zt, back, d, "stM", "stS", "stD")
    fd = d + 0.001
    SD._rect(f, u0 + LINE, u1 - LINE, zf + 4 * px, zf + 5 * px, fd, "stD")       # (a panel line across its foot)
    SD._rect(f, u1 - 4 * LINE, u1 - 3 * LINE, zf + 2 * px, zf + 3 * px, fd + 0.001, "stB")   # (a lit tell-tale)
    uc, zc, r = (u0 + u1) / 2, zt - 12 * px, 5
    _disc(f, uc, zc, r, fd, "stD")                         # the hatch: its rim dark, its lit lower lip, its face
    _disc(f, uc, zc, r - 1, fd + 0.001, "stL")
    _disc(f, uc, zc + px, r - 1, fd + 0.002, "stS")
    _pipe(f, u0, u1, zl - 4 * px, D - 5 * LINE, 2)         # the conduit over it
