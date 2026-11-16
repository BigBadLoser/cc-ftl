"""The station hull bay's machinery (station_hull_bay; design reference only): a coolant loop near the bay's mouth,
every run ending in a wall, the floor or the machine (_run: a pipe swept along a path through rounded elbows; _lathe: a
round body up the bay): a pump on the floor, an expansion tank lying across over it; the pump's line up off its top
and back into the wall, another off its side up into the tank, two more up off the tank's top and back into it, the
tank's return down out of it through a valve into the floor."""
import math

from . import core
from . import wall3d as T
from . import station_hull_designs as SD
from .wall3d_ext_geom import D, F, LINE


def machinery(f, u0, u1, zf, zl, back):
    """The bay's fill over [u0, u1] x [zf, zl], its back at d = back."""
    _coolant(f, u0, u1, zf, zl, back, 1 / core.ZPX)


RAMP = ("stK", "stE", "stDE", "stD", "stM", "stS", "stL", "stH", "stB", "stW")   # the station's tones, dark to light
SHADE = 1                           # every tone in the machinery this many steps down the ramp (it stands in the bay)


def _dk(col):
    return RAMP[max(0, RAMP.index(col) - SHADE)]


def _rect(f, u0, u1, z0, z1, d, col):
    SD._rect(f, u0, u1, z0, z1, d, _dk(col))


def _box(f, u0, u1, z0, z1, d0, d1, front, top, side):
    f.part(u0, u1, [(d0, z0), (d0, z1), (d1, z1), (d1, z0)], [None, _dk(top), _dk(front), None], _dk(side), end=False)


def _disc(f, uc, zc, r, d, col, n=24):
    px = 1 / core.ZPX
    f.k.poly([T.P(f.ax, f.plane, uc + r * LINE * math.cos(2 * math.pi * i / n), zc + r * px * math.sin(2 * math.pi * i / n),
                  d) for i in range(n)], F, 3, T.OUT(f.ax), fixed=T.SEAM_PASS or _dk(col))


def _fillet(pts, R, k=4):
    """A path through `pts` ((p, z, k) px) with its corners rounded R px."""
    out = [pts[0]]
    for A, B, C in zip(pts, pts[1:], pts[2:]):
        l0, l1 = math.dist(A, B), math.dist(B, C)
        r = min(R, l0 / 2, l1 / 2)
        p0 = [b + (a - b) * r / l0 for a, b in zip(A, B)]
        p1 = [b + (c - b) * r / l1 for b, c in zip(B, C)]
        for i in range(k + 1):                              # (a quadratic bend through the corner)
            t = i / k
            out.append(tuple((1 - t) ** 2 * x0 + 2 * t * (1 - t) * xb + t * t * x1 for x0, xb, x1 in zip(p0, B, p1)))
    return out + [pts[-1]]


def _run(f, u0, zf, dc, pts, r=1.5, R=3, n=10):
    """A pipe r px round swept along the path `pts` ((p px across from u0, z px over zf[, k px out from dc: < 0 back
    toward the bay's back])), its corners rounded R px; its facets toned by facing (up lit, the near end (+u) lit,
    down and the far end dark)."""
    px, o = 1 / core.ZPX, T.P(f.ax, 0, 0, 0, 0)
    path = _fillet([tuple(q) + (0.0,) * (3 - len(q)) for q in pts], R)
    rings = []
    for i, c in enumerate(path):
        a, b = path[max(i - 1, 0)], path[min(i + 1, len(path) - 1)]
        t = [y - x for x, y in zip(a, b)]
        ln = math.sqrt(sum(v * v for v in t)) or 1.0
        t = [v / ln for v in t]
        ref = (0.0, 0.0, 1.0) if abs(t[2]) < 0.9 else (0.0, 1.0, 0.0)   # (its frame: across the path, in (u, z, d))
        n1 = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]]
        l1 = math.sqrt(sum(v * v for v in n1))
        n1 = [v / l1 for v in n1]
        n2 = [t[1] * n1[2] - t[2] * n1[1], t[2] * n1[0] - t[0] * n1[2], t[0] * n1[1] - t[1] * n1[0]]
        ring = []
        for j in range(n):
            ca, sa = math.cos(2 * math.pi * j / n), math.sin(2 * math.pi * j / n)
            cm, sm = math.cos(2 * math.pi * (j + 0.5) / n), math.sin(2 * math.pi * (j + 0.5) / n)
            ring.append(tuple(c[k] + r * (n1[k] * ca + n2[k] * sa) for k in range(3))
                        + tuple(n1[k] * cm + n2[k] * sm for k in range(3)))
        rings.append(ring)
    w = lambda q: T.P(f.ax, f.plane, u0 + q[0] * LINE, zf + q[1] * px, dc + q[2] * LINE)   # noqa: E731
    for ra, rb in zip(rings, rings[1:]):
        for j in range(n):
            gu, gz, gd = ra[j][3:]
            if gd < -0.3:
                continue
            col = "stH" if gz > 0.6 else "stD" if gz < -0.6 else "stL" if gu > 0.5 else "stM" if gu < -0.5 else "stS"
            f.k.poly([w(ra[j]), w(ra[(j + 1) % n]), w(rb[(j + 1) % n]), w(rb[j])], F, 3,
                     (T.P(f.ax, 0, gu, gz, gd) - o).normalized(), fixed=T.SEAM_PASS or _dk(col))


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
            f.k.poly(q, F, 3, (T.P(f.ax, 0, gu, sz, gd) - o).normalized(), fixed=T.SEAM_PASS or _dk(col))


def _wheel(f, uc, zc, d, r=3):
    """A valve wheel facing out: its rim, its hub, a spoke across."""
    px = 1 / core.ZPX
    _disc(f, uc, zc, r, d, "stL")
    _disc(f, uc, zc, r - 1, d + 0.001, "stE")
    _rect(f, uc - (r - 1) * LINE, uc + (r - 1) * LINE, zc - px / 2, zc + px / 2, d + 0.002, "stS")
    _disc(f, uc, zc, 0.8, d + 0.003, "stH")


def _gauge(f, uc, zc, d):
    px = 1 / core.ZPX
    _disc(f, uc, zc, 1.5, d, "stB")
    _rect(f, uc, uc + 0.7 * LINE, zc, zc + px, d + 0.001, "stE")


def _coolant(f, u0, u1, zf, zl, back, px):
    W, top = (u1 - u0) / LINE, (zl - zf) / px
    dc = D - 5 * LINE
    _box(f, u0 + 2 * LINE, u0 + 9 * LINE, zf, zf + 2 * px, back, D - LINE, "stM", "stL", "stD")   # (the pump's skid)
    uc = u0 + 5.5 * LINE
    _lathe(f, uc, dc, [(zf + 2 * px, 3), (zf + 8 * px, 3), (zf + 9 * px, 2), (zf + 16 * px, 2), (zf + 17 * px, 0.5)])
    zt = top - 12                                           # (the tank, lying across, into either wall)
    _run(f, u0, zf, D - 6 * LINE, [(-1, zt), (W + 1, zt)], r=3.4)
    for p in (3, W - 2):                                    # (its straps)
        _run(f, u0, zf, D - 6 * LINE, [(p, zt), (p + 1, zt)], r=3.9)
    for p, h in ((5, 6), (W - 5, 4)):                       # (lines up off its top and back into the wall)
        _run(f, u0, zf, D - 6 * LINE, [(p, zt + 2), (p, zt + h), (p, zt + h, (back - D) / LINE + 7)], r=0.9, R=2)
    _run(f, u0, zf, dc, [(5.5, 16), (5.5, zt - 7), (5.5, zt - 7, (back - dc) / LINE + 1)], r=1.1, R=2)   # (the pump's
                                                            # line: up off its top, back into the wall)
    _run(f, u0, zf, dc, [(5.5, 5), (2, 5), (2, zt)], r=1.1, R=2)           # (off the pump's side up into the tank)
    _run(f, u0, zf, D - 3 * LINE, [(W - 3, zt), (W - 3, -1)], r=1.1)        # (the return down into the floor)
    _wheel(f, u0 + (W - 3) * LINE, zf + 14 * px, D - 2 * LINE + 0.002, 2.4)
    _gauge(f, u0 + (W / 2) * LINE, zf + (zt + 1) * px, D - 6 * LINE + 3.5 * LINE)
