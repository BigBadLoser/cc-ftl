"""The station hull bay's machinery (station_hull_bay; designs 5 to 7 try three fills, design reference only), each
a machine near the bay's mouth (_run: a pipe swept along a path through rounded elbows; _lathe: a round body up the
bay):
  5  a pressure tank: domed, two hoops round it, a gauge on it; its outlet up into the top, a valve wheel at its foot
  6  an inline pump: its housing on the floor, the line through it across the bay, its finned motor stood on it; a
     control box over it, its lead down to the motor, a conduit up into the top
  7  an air handler: a box with a fan grille in its front, a square duct up from it into the top, a pipe down from it
     to an intake grille on the floor"""
import math

from . import core
from . import wall3d as T
from . import station_hull_designs as SD
from .wall3d_ext_geom import D, F, LINE

PIPE_COLS = ((0.7, "stH"), (0.2, "stL"), (-0.3, "stS"), (-0.8, "stM"), (-2, "stD"))   # by the facet's up-ness


def machinery(f, design, u0, u1, zf, zl, back):
    """Design `design`'s fill of the bay [u0, u1] x [zf, zl], its back at d = back."""
    {5: _tank, 6: _pump, 7: _handler}[design](f, u0, u1, zf, zl, back, 1 / core.ZPX)


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


MACHINE = ("stS", "stM", "stDE", "stD", "stE")   # a machine's tones by facing: up, lit (+u), front, dark (-u), down
                                    # (a step under the hull's: it stands in the bay's shade)


def _lathe(f, uc, dc, prof, n=14, tones=MACHINE):
    """A round body up the bay about (uc, dc): prof ((z, r px) from its foot up); its facets toned by facing."""
    px, o = 1 / core.ZPX, T.P(f.ax, 0, 0, 0, 0)
    for (za, ra), (zb, rb) in zip(prof, prof[1:]):
        dz, dr = (zb - za) / px, rb - ra
        ln = math.hypot(dz, dr) or 1.0
        c, sz = dz / ln, -dr / ln                           # (its facets' lean: out, up)
        for j in range(n):
            a0, a1, am = (2 * math.pi * k / n for k in (j, j + 1, j + 0.5))
            gu, gd = c * math.cos(am), c * math.sin(am)
            if gd < -0.3 and sz < 0.6:
                continue
            up, lit, fr, dk, dn = tones
            col = up if sz > 0.6 else dn if sz < -0.6 else lit if gu > 0.4 else dk if gu < -0.4 else fr
            q = [T.P(f.ax, f.plane, uc + r * LINE * math.cos(a), z, dc + r * LINE * math.sin(a))
                 for a, z, r in ((a0, za, ra), (a1, za, ra), (a1, zb, rb), (a0, zb, rb))]
            f.k.poly(q, F, 3, (T.P(f.ax, 0, gu, sz, gd) - o).normalized(), fixed=T.SEAM_PASS or col)


def _wheel(f, uc, zc, d, r=3):
    """A valve wheel facing out: its rim, its hub, a spoke across."""
    px = 1 / core.ZPX
    _disc(f, uc, zc, r, d, "stL")
    _disc(f, uc, zc, r - 1, d + 0.001, "stE")
    SD._rect(f, uc - (r - 1) * LINE, uc + (r - 1) * LINE, zc - px / 2, zc + px / 2, d + 0.002, "stS")
    _disc(f, uc, zc, 0.8, d + 0.003, "stH")


def _tank(f, u0, u1, zf, zl, back, px):
    W, top = (u1 - u0) / LINE, (zl - zf) / px
    uc, r, dc = u0 + (W / 2 + 0.5) * LINE, 5, D - 6 * LINE
    zt = top - 14                                           # (its shoulder; the dome over it)
    _box(f, uc - 5 * LINE, uc + 5 * LINE, zf, zf + 3 * px, back, D - LINE, "stM", "stL", "stD")   # (its plinth)
    prof = [(3, r), (zt, r)] + [(zt + 4 * math.sin(math.pi / 2 * k / 4), r * math.cos(math.pi / 2 * k / 4) + 0.01)
                               for k in range(1, 5)]
    _lathe(f, uc, dc, [(zf + z * px, rr) for z, rr in prof])
    for zc in (10, zt - 7):                                 # (hoops round it)
        _lathe(f, uc, dc, [(zf + zc * px, r + 0.6), (zf + (zc + 2) * px, r + 0.6)])
    gd = dc + r * LINE + 0.002                              # (a gauge on its front)
    SD._rect(f, uc + 2.5 * LINE, uc + 3.3 * LINE, zf + 5 * px, zf + (zt - 1) * px, dc + 4.2 * LINE, "stS")   # (its sheen)
    _disc(f, uc + 2 * LINE, zf + (zt - 3) * px, 1.6, gd, "stB")
    SD._rect(f, uc + 2 * LINE, uc + 2.6 * LINE, zf + (zt - 3) * px, zf + (zt - 2) * px, gd + 0.001, "stE")
    _run(f, u0, zf, dc, [((W / 2 + 0.5), zt + 3.5), ((W / 2 + 0.5), top - 4), (W / 2 + 4.5, top - 4),
                         (W / 2 + 4.5, top + 2)], r=1.2, R=2)
    _run(f, u0, zf, D - 2 * LINE, [(W / 2 + 0.5, 5), (1, 5)], r=1.2)   # (an outlet at its foot, a wheel on it)
    _wheel(f, u0 + 4 * LINE, zf + 9 * px, D - LINE)


def _pump(f, u0, u1, zf, zl, back, px):
    W, top = (u1 - u0) / LINE, (zl - zf) / px
    uc, dc = u0 + (W / 2 + 0.5) * LINE, D - 6 * LINE
    _box(f, uc - 5 * LINE, uc + 5 * LINE, zf, zf + 3 * px, back, D - LINE, "stM", "stL", "stD")   # (its skid)
    _lathe(f, uc, dc, [(zf + 3 * px, 4), (zf + 10 * px, 4), (zf + 11 * px, 3), (zf + 12 * px, 3)])   # (the housing)
    for p in (1, W):                                        # (the line in and out of it, across the bay)
        _run(f, u0, zf, dc, [(W / 2 + 0.5, 6.5), (p, 6.5)], r=1.6)
    _lathe(f, uc, dc, [(zf + 12 * px, 2.6), (zf + 26 * px, 2.6), (zf + 27 * px, 1.6), (zf + 28 * px, 0.4)])   # (its motor)
    for z in range(14, 26, 3):                              # (fins round it)
        _lathe(f, uc, dc, [(zf + z * px, 3.4), (zf + (z + 1) * px, 3.4)])
    _box(f, u0 + LINE, u1 - LINE, zf + 34 * px, zf + 42 * px, back, D - 3 * LINE, "stS", "stL", "stM")   # (a control
    fd = D - 3 * LINE + 0.001                                                                            # box)
    SD._rect(f, u1 - 3 * LINE, u1 - 2 * LINE, zf + 39 * px, zf + 40 * px, fd, "stB")
    SD._rect(f, u1 - 5 * LINE, u1 - 4 * LINE, zf + 39 * px, zf + 40 * px, fd, "stD")
    _run(f, u0, zf, D - 3 * LINE, [(4, 34), (4, 30), (W / 2 - 1, 28)], r=0.8, R=2)   # (its lead down to the motor)
    _run(f, u0, zf, D - 4 * LINE, [(W / 2 + 0.5, 42), (W / 2 + 0.5, top + 2)], r=1.6)   # (a conduit up)


def _handler(f, u0, u1, zf, zl, back, px):
    W, top = (u1 - u0) / LINE, (zl - zf) / px
    z0, z1 = 18, 34
    _box(f, u0 + LINE, u1 - LINE, zf + z0 * px, zf + z1 * px, back, D - LINE, "stS", "stL", "stM")
    fd = D - LINE + 0.001
    uc, zc = (u0 + u1) / 2, zf + (z0 + z1) / 2 * px
    _disc(f, uc, zc, 6, fd, "stD")                          # (the fan's grille: its rim, its blades, its hub)
    _disc(f, uc, zc, 5, fd + 0.001, "stE")
    for k in range(3):
        a = math.pi * k / 3
        f.k.poly([T.P(f.ax, f.plane, uc + x * LINE, zc + y * px, fd + 0.002) for x, y in
                  ((4.6 * math.cos(a) - 0.6 * math.sin(a), 4.6 * math.sin(a) + 0.6 * math.cos(a)),
                   (4.6 * math.cos(a) + 0.6 * math.sin(a), 4.6 * math.sin(a) - 0.6 * math.cos(a)),
                   (-4.6 * math.cos(a) + 0.6 * math.sin(a), -4.6 * math.sin(a) - 0.6 * math.cos(a)),
                   (-4.6 * math.cos(a) - 0.6 * math.sin(a), -4.6 * math.sin(a) + 0.6 * math.cos(a)))],
                 F, 3, T.OUT(f.ax), fixed=T.SEAM_PASS or "stM")
    _disc(f, uc, zc, 1.4, fd + 0.003, "stL")
    _box(f, u0 + 3 * LINE, u1 - 3 * LINE, zf + z1 * px, zl, back, D - 3 * LINE, "stM", "stL", "stD")   # (its duct)
    SD._rect(f, u0 + 3 * LINE, u1 - 3 * LINE, zf + (z1 + 6) * px, zf + (z1 + 7) * px, D - 3 * LINE + 0.001, "stD")
    _run(f, u0, zf, D - 4 * LINE, [(W - 4, z0), (W - 4, 8)], r=2)   # (down to the intake)
    _box(f, u0 + LINE, u1 - LINE, zf, zf + 6 * px, back, D - LINE, "stM", "stL", "stD")
    for k in range(1, 6):                                   # (its grille's slots)
        SD._rect(f, u0 + 2 * LINE, u1 - 2 * LINE, zf + k * px, zf + (k + 0.5) * px, D - LINE + 0.001, "stE")


