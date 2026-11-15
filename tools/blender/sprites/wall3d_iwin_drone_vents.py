"""The drone window's end vents (wall3d_iwin_drone): each a pocket cut RECESS px straight back into the near ramp's
slope (its back the dark panel, parallel to the slope; a lit ledge along its foot; its sides in the ramp's cut tone),
VENT_GAP clear of the window's end, the rib, the slope's top and its foot; dark pipes coming out of it that follow the
rib's profile beside it (flat out at the rib's top, down its front past the toe, back under to the floor) (the user).
Coordinates as the drone module's: here +y is the near side, the mesh's -y (core.G)."""
import math

from mathutils import Vector

from . import walls as W
from .wall3d_iwin import _clip

RECESS = 3                  # px: the pocket's depth, straight back into the slope
PIPES = ((6, 8), (9, 11), (85, 87), (88, 90))   # px along the window: 2 px pipes, in from the ribs (13-17, 79-83)
SIDES = 8                   # the pipes' section
COL = {"back": "fDS3", "ledge": "fDW2", "side": "fDX2",
       "pipe_top": "fDS2", "pipe_front": "fDS3", "pipe_side": "fDS4"}


def _d():
    from . import wall3d_iwin_drone as D
    return D


def _span(a, b):
    D = _d()
    return max(D._x(a), -0.5), min(D._x(b), 0.5)


def _heights():
    """(z0, z1): the pocket's top and foot (VENT_GAP down the slope from its top, up from its foot)."""
    D = _d()
    f, zt = D._fall(), D._zt()
    dz = (zt - W.foot()) / f
    return zt - D.VENT_GAP * D.PX * f, zt - (dz - D.VENT_GAP * D.PX) * f


def _back_y(z):
    """The pocket's back at height z: the slope's line RECESS px further in."""
    D = _d()
    return D._line() - RECESS * D.PX + (D._zt() - z) / D._fall()


def _carve(k, planes):
    """Take out everything inside every plane (wall3d_iwin._side >= 0), in convex pieces."""
    def neg(p):
        return (p[0], p[1], -p[2]) if len(p) == 3 else (tuple(-c for c in p[0]), -p[1])
    regions = [planes[:i] + [neg(p)] for i, p in enumerate(planes)]
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            if not all(max(_val(p, q) for q in pts) > 1e-9 for p in planes):    # (wholly outside one)
                out.append(f)
                continue
            for r in regions:
                q = _clip(pts, r)
                if len(q) < 3:
                    continue
                n = Vector(q[1]) - Vector(q[0])
                if max((Vector(c) - Vector(q[0])).cross(n).length for c in q) < 1e-10:
                    continue
                base = len(m.v)
                m.v += [tuple(p) for p in q]
                out.append((list(range(base, base + len(q))),) + tuple(f[1:]))
        m.f = out


def _val(pl, p):
    if len(pl) == 3:
        return pl[2] * (p[pl[0]] - pl[1])
    n, c = pl
    return n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - c


def recess(k):
    """Cut each vent's pocket and build its faces."""
    D = _d()
    f, zt, yl = D._fall(), D._zt(), D._line()
    z0, z1 = _heights()
    for a, b in D.VENTS:
        u0, u1 = _span(a, b)
        if u1 - u0 < 1e-9:
            continue
        # (the mesh's y is -y here): out of the pocket's back toward the near side
        back = ((0.0, -f, 1.0), zt + f * yl - RECESS * D.PX * f)
        _carve(k, [(0, u0, 1), (0, u1, -1), (2, z1, 1), (2, z0, -1), back])
        yb0, yb1 = _back_y(z0), _back_y(z1)
        ys0, ys1 = yb0 + RECESS * D.PX, yb1 + RECESS * D.PX
        D._quad(k, [(u0, yb0, z0), (u1, yb0, z0), (u1, yb1, z1), (u0, yb1, z1)], (0, f, 1), COL["back"])
        D._quad(k, [(u0, yb1, z1), (u1, yb1, z1), (u1, ys1, z1), (u0, ys1, z1)], (0, 0, 1), COL["ledge"])
        for u, sd in ((u0, 1), (u1, -1)):
            if -0.5 < u < 0.5:
                D._quad(k, [(u, yb0, z0), (u, ys0, z0), (u, ys1, z1), (u, yb1, z1)], (sd, 0, 0), COL["side"])


def _ring(c, nrm, x0, x1, r):
    """A pipe's section at c (y, z) on the plane spanned by x and nrm (y, z): its centre x (x0 + x1) / 2."""
    xc = (x0 + x1) / 2
    out = []
    for i in range(SIDES):
        t = (i + 0.5) * 2 * math.pi / SIDES
        out.append(Vector((xc + r * math.cos(t), c[0] + nrm[0] * math.sin(t), c[1] + nrm[1] * math.sin(t))))
    return out


def pipes(k):
    """Each pipe along the rib's profile: out of the pocket's back flat at the rib's top (less its radius), out to the
    rib's front, down it to the foot's height, then back under to the floor at the toe."""
    D = _d()
    r = D.PX
    zc = D._zf() - r
    yf = 0.5 + D.OUT * D.PX - r
    path = [(_back_y(zc) - r, zc), (yf, zc), (yf, W.foot()), (0.5 - r, r)]
    rings = []
    for i, p in enumerate(path):                        # (mitred: each bend's section on its bisector)
        ns = []
        segs = ([(path[i - 1], p)] if i else []) + ([(p, path[i + 1])] if i + 1 < len(path) else [])
        for a, b in segs:
            ty, tz = b[0] - a[0], b[1] - a[1]
            L = math.hypot(ty, tz)
            ns.append((-tz / L, ty / L))
        ny, nz = sum(n[0] for n in ns) / len(ns), sum(n[1] for n in ns) / len(ns)
        L = math.hypot(ny, nz)
        cos = (ny * ns[0][0] + nz * ns[0][1]) / L
        rings.append((p, (r * ny / L / cos, r * nz / L / cos)))
    for a, b in PIPES:
        u0, u1 = D._x(a), D._x(b)
        if u0 < -0.5 - 1e-9 or u1 > 0.5 + 1e-9:
            continue
        rs = [_ring(c, n, u0, u1, r) for c, n in rings]
        for ra, rb in zip(rs, rs[1:]):
            for i in range(SIDES):
                j = (i + 1) % SIDES
                pts = [ra[i], ra[j], rb[j], rb[i]]
                mid = sum(pts, Vector()) / 4
                out = mid - Vector(((u0 + u1) / 2, *_axis_point(ra, rb, mid)))
                col = COL["pipe_top"] if out.z > 0.6 * out.length else \
                    COL["pipe_front"] if out.y > 0.4 * out.length else COL["pipe_side"]
                k.poly(pts, "wall", 2, out, fixed=col)


def _axis_point(ra, rb, mid):
    """The pipe's centre line nearest mid (y, z): the segment between the two rings' centres."""
    ca = sum(ra, Vector()) / len(ra)
    cb = sum(rb, Vector()) / len(rb)
    d = cb - ca
    t = max(0.0, min(1.0, (mid - ca).dot(d) / d.dot(d)))
    c = ca + d * t
    return c.y, c.z
