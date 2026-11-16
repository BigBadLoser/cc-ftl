"""The station hull bay's machinery (station_hull_bay; designs 5 to 7 try three fills, design reference only): pipe
runs up and across the bay near its mouth, turned through rounded elbows (_run: a pipe swept along a path, its corners
filleted), with boxes where they end or meet:
  5  two pipes up from the floor, across the bay and up again into the top, side by side
  6  a header across under the top, three drops elbowing down off it to a manifold box on the floor
  7  a square duct up the far end; a pipe out of it, down and back in (a loop), a second loop under; a valve"""
import math

from . import core
from . import wall3d as T
from . import station_hull_designs as SD
from .wall3d_ext_geom import D, F, LINE

PIPE_COLS = ((0.7, "stH"), (0.2, "stL"), (-0.3, "stS"), (-0.8, "stM"), (-2, "stD"))   # by the facet's up-ness


def machinery(f, design, u0, u1, zf, zl, back):
    """Design `design`'s fill of the bay [u0, u1] x [zf, zl], its back at d = back."""
    {5: _twin, 6: _header, 7: _loops}[design](f, u0, u1, zf, zl, back, 1 / core.ZPX)


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


def _fillet(pts, R, k=4):
    """A path through `pts` ((p, z) px) with its corners rounded R px."""
    out = [pts[0]]
    for (ax, az), (bx, bz), (cx, cz) in zip(pts, pts[1:], pts[2:]):
        l0, l1 = math.hypot(bx - ax, bz - az), math.hypot(cx - bx, cz - bz)
        r = min(R, l0 / 2, l1 / 2)
        p0 = (bx + (ax - bx) * r / l0, bz + (az - bz) * r / l0)
        p1 = (bx + (cx - bx) * r / l1, bz + (cz - bz) * r / l1)
        for i in range(k + 1):                              # (a quadratic bend through the corner)
            t = i / k
            out.append(((1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * bx + t * t * p1[0],
                        (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * bz + t * t * p1[1]))
    return out + [pts[-1]]


def _run(f, u0, zf, dc, pts, r=1.5, R=3, n=10):
    """A pipe r px round swept along the path `pts` ((p px across from u0, z px over zf)) at depth dc, its corners
    rounded R px; its facets toned by facing (up lit, the near end (+u) lit, down and the far end dark)."""
    px, o = 1 / core.ZPX, T.P(f.ax, 0, 0, 0, 0)
    path = _fillet(pts, R)
    rings = []
    for i, (p, z) in enumerate(path):
        a, b = path[max(i - 1, 0)], path[min(i + 1, len(path) - 1)]
        tu, tz = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(tu, tz) or 1.0
        nu, nz = -tz / ln, tu / ln                          # (the path's normal in the plane of the face)
        rings.append([(p + nu * r * math.cos(2 * math.pi * j / n), z + nz * r * math.cos(2 * math.pi * j / n),
                       r * math.sin(2 * math.pi * j / n), nu * math.cos(2 * math.pi * (j + 0.5) / n),
                       nz * math.cos(2 * math.pi * (j + 0.5) / n), math.sin(2 * math.pi * (j + 0.5) / n))
                      for j in range(n)])
    w = lambda q: T.P(f.ax, f.plane, u0 + q[0] * LINE, zf + q[1] * px, dc + q[2] * LINE)   # noqa: E731
    for ra, rb in zip(rings, rings[1:]):
        for j in range(n):
            gu, gz, gd = ra[j][3:]
            if gd < -0.3:
                continue
            col = "stH" if gz > 0.6 else "stD" if gz < -0.6 else "stL" if gu > 0.5 else "stM" if gu < -0.5 else "stS"
            f.k.poly([w(ra[j]), w(ra[(j + 1) % n]), w(rb[(j + 1) % n]), w(rb[j])], F, 3,
                     (T.P(f.ax, 0, gu, gz, gd) - o).normalized(), fixed=T.SEAM_PASS or col)


def _twin(f, u0, u1, zf, zl, back, px):
    W, top = (u1 - u0) / LINE, (zl - zf) / px
    for k, dc in ((0, 3), (3, 6)):                          # (two runs side by side, the second behind)
        _run(f, u0, zf, D - dc * LINE, [(3 + k, 0), (3 + k, 18 - k), (W - 4 + k, 18 - k), (W - 4 + k, top + 2)])
    _box(f, u0 + LINE, u1 - LINE, zf, zf + 2 * px, back, D - LINE, "stM", "stL", "stD")


def _header(f, u0, u1, zf, zl, back, px):
    W, top = (u1 - u0) / LINE, (zl - zf) / px
    zh = top - 6
    _run(f, u0, zf, D - 4 * LINE, [(-1, zh), (W + 1, zh)], r=2)
    for p, z1 in ((3, 6), (W / 2, 6), (W - 3, 6)):
        _run(f, u0, zf, D - 2 * LINE, [(p, z1), (p, zh - 6), (p + (2 if p < W / 2 else -2), zh - 3),
                                       (p + (2 if p < W / 2 else -2), zh)], r=1.2, R=2)
    _box(f, u0 + LINE, u1 - LINE, zf, zf + 6 * px, back, D, "stS", "stL", "stM")
    SD._rect(f, u0 + LINE, u1 - LINE, zf + 5 * px, zf + 6 * px, D + 0.001, "stH")


def _loops(f, u0, u1, zf, zl, back, px):
    W, top = (u1 - u0) / LINE, (zl - zf) / px
    _box(f, u0 + LINE, u0 + 5 * LINE, zf, zl, back, D - 2 * LINE, "stS", "stL", "stM")
    for z0, z1, p in ((34, 46, W - 3), (10, 24, W - 5)):
        _run(f, u0, zf, D - 4 * LINE, [(4, z1), (p, z1), (p, z0), (4, z0)], r=1.5, R=3)
    _box(f, u0 + (W - 7) * LINE, u0 + (W - 1) * LINE, zf + 27 * px, zf + 31 * px, D - 7 * LINE, D - LINE, "stM", "stH",
         "stD")
    _box(f, u0 + 5 * LINE, u1 - LINE, zf, zf + 3 * px, back, D - LINE, "stM", "stL", "stD")
