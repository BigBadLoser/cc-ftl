"""The drone window's end vents and the slot's handle (wall3d_iwin_drone): each a pocket cut RECESS px straight back into the near ramp's
slope (its back the dark panel, parallel to the slope; a dark ledge along its foot; its sides in the ramp's cut tone),
VENT_GAP clear of the window's end, the rib, the slope's top and its foot; dark pipes coming out of it, centred,
flat out then straight down, inside the pocket from its top to its bottom (the user).
Coordinates as the drone module's: here +y is the near side, the mesh's -y (core.G)."""
import math

from mathutils import Vector

from . import walls as W
from .wall3d_iwin import _clip

RECESS = 3                  # px: the pocket's depth, straight back into the slope
BELOW = 2                   # sprite px: the slope left between the pocket's bottom edge and the ramp's edge (where the
                            # slope meets the foot) (the user)
PIPES = ((3, 6), (7, 10), (86, 89), (90, 93))   # px along the window: PIPE px pipes, centred in each vent (2-11, 85-94)
PIPE = 3                    # px: the pipes' thickness (the user: larger)
PIPE_GAP = 1                # art px: their ends clear of the pocket's bottom
FACE_PITS = 3               # the slot block's front: equal recesses behind the handle, FACE_BORDER round and between them
FACE_BORDER = 1             # px (the user)
FACE_DEPTH = 2              # px: their depth
HANDLE = 2                  # px: the slot's handle bar's thickness
HANDLE_IN = 1               # px: its legs in from the slot's sides
HANDLE_BEND = 2             # px: its corners' radius (its centre line)
PIPE_TOP = 4                # art px: their flat run's top under the pocket's top (1, then 3 lower: the two runs nearer
                            # equal, the user)
SIDES = 16                  # the pipes' section (round: the user)
BEND = 3                    # px: the elbow's radius (the pipe's centre line; curved: the user)
BEND_STEPS = 6
LIGHT = (0.3, 0.5, 0.8)     # the pipes' tones by their faces' turn to this (x, y near, z up)
PIPE_TONES = ((0.85, "fDS1"), (0.6, "fDS2"), (0.3, "fDS3"), (-2.0, "fDS4"))
COL = {"back": "fDS3", "ledge": "fDS2", "side": "fDX2"}


def _d():
    from . import wall3d_iwin_drone as D
    return D


def _span(a, b):
    D = _d()
    return max(D._x(a), -0.5), min(D._x(b), 0.5)


def _heights():
    """(z0, z1): the pocket's top (VENT_GAP down the slope from its top) and foot (BELOW sprite px up the slope from the
    ramp's edge: down the slope a unit of height is ZART rows, plus GN / 2 a unit out over its fall)."""
    D = _d()
    f = D._fall()
    return D._zt() - D.VENT_GAP * D.PX * f, W.foot() + BELOW / (W.ZART + W.GN / 2 / f)


def _surface(z0, z1):
    """The near ramp's outline from z0 down to z1 (y, z): down the slope, then the foot's upright face."""
    D = _d()
    yl, zt, f, zk = D._line(), D._zt(), D._fall(), W.foot()
    toe = yl + (zt - zk) / f
    pts = [(yl + (zt - z0) / f, z0)]
    if z1 < zk < z0:
        pts.append((toe, zk))
    pts.append((toe if z1 <= zk else yl + (zt - z1) / f, z1))
    return pts


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
        sf = _surface(z0, z1)
        ys1 = sf[-1][0]
        D._quad(k, [(u0, yb0, z0), (u1, yb0, z0), (u1, yb1, z1), (u0, yb1, z1)], (0, f, 1), COL["back"])
        D._quad(k, [(u0, yb1, z1), (u1, yb1, z1), (u1, ys1, z1), (u0, ys1, z1)], (0, 0, 1), COL["ledge"])
        for u, sd in ((u0, 1), (u1, -1)):
            if -0.5 < u < 0.5:
                D._quad(k, [(u, yb0, z0)] + [(u, y, z) for y, z in sf] + [(u, yb1, z1)], (sd, 0, 0), COL["side"])


def pipes(k):
    """Each pipe inside the pocket: out of the back PIPE_TOP under its top, flat out to over the pocket's bottom edge,
    round a BEND elbow, then straight down to PIPE_GAP over its bottom (the user). Its bottom end is left open (it
    faces down, out of the camera's sight)."""
    D = _d()
    r = PIPE / 2 * D.PX
    z0, z1 = _heights()
    zc = z0 - PIPE_TOP / W.ZART - r
    yf = _surface(z0, z1)[-1][0] - r
    R = BEND * D.PX                                     # (the elbow: a quarter circle round (yf - R, zc - R))
    arc = [(yf - R + R * math.sin(a), zc - R + R * math.cos(a))
           for a in (i * math.pi / 2 / BEND_STEPS for i in range(BEND_STEPS + 1))]
    path = [(_back_y(zc) - r, zc)] + arc + [(yf, z1 + PIPE_GAP / W.ZART)]
    for a, b in PIPES:
        u0, u1 = D._x(a), D._x(b)
        if u0 < -0.5 - 1e-9 or u1 > 0.5 + 1e-9:
            continue
        xc = (u0 + u1) / 2
        tube(k, [(xc, y, z) for y, z in path], r, (1.0, 0.0, 0.0))


def slot_face(k, yo, zlo, zhi, col):
    """The slot block's front (at yo, zlo..zhi, across the slot) as a FACE_BORDER frame round FACE_PITS equal recesses
    FACE_DEPTH deep (their backs, ledges and sides in the vents' tones)."""
    D = _d()
    e, ez = FACE_BORDER * D.PX, FACE_BORDER / W.ZART
    p0, p1 = D._x(D.SLOT[0]), D._x(D.SLOT[1])
    w = (p1 - p0 - (FACE_PITS + 1) * e) / FACE_PITS
    za, zb, yb = zlo + ez, zhi - ez, yo - FACE_DEPTH * D.PX

    def quad(pts, n, c):
        a, b = max(min(p[0] for p in pts), -0.5), min(max(p[0] for p in pts), 0.5)
        if b - a > 1e-9:
            D._quad(k, [(min(max(p[0], -0.5), 0.5),) + tuple(p[1:]) for p in pts], n, c)
    quad([(p0, yo, zlo), (p1, yo, zlo), (p1, yo, za), (p0, yo, za)], (0, 1, 0), col)
    quad([(p0, yo, zb), (p1, yo, zb), (p1, yo, zhi), (p0, yo, zhi)], (0, 1, 0), col)
    for i in range(FACE_PITS + 1):
        x = p0 + i * (w + e)
        quad([(x, yo, za), (x + e, yo, za), (x + e, yo, zb), (x, yo, zb)], (0, 1, 0), col)
    for i in range(FACE_PITS):
        x0 = p0 + e + i * (w + e)
        x1 = x0 + w
        quad([(x0, yb, za), (x1, yb, za), (x1, yb, zb), (x0, yb, zb)], (0, 1, 0), COL["back"])
        quad([(x0, yb, za), (x1, yb, za), (x1, yo, za), (x0, yo, za)], (0, 0, 1), COL["ledge"])
        for u, sd in ((x0, 1), (x1, -1)):
            if -0.5 < u < 0.5:
                D._quad(k, [(u, yb, za), (u, yo, za), (u, yo, zb), (u, yb, zb)], (sd, 0, 0), COL["side"])


def handle(k, yface, zlo, zhi):
    """The slot block's handle bar (its front at yface, zlo..zhi): a round bar out of the face from HANDLE_IN in from
    the slot's sides, out to level with the red boxes' fronts, across, rounded corners (the user)."""
    D = _d()
    r, R = HANDLE / 2 * D.PX, HANDLE_BEND * D.PX
    xa, xb = D._x(D.SLOT[0] + HANDLE_IN) + r, D._x(D.SLOT[1] - HANDLE_IN) - r
    if xa - r < -0.5 - 1e-9 or xb + r > 0.5 + 1e-9:
        return
    zh, yc = (zlo + zhi) / 2, 0.5 + D.BOX_OUT * D.PX - r
    q = [i * math.pi / 2 / BEND_STEPS for i in range(BEND_STEPS + 1)]
    path = ([(xa, yface - r)] + [(xa + R - R * math.cos(a), yc - R + R * math.sin(a)) for a in q] +
            [(xb - R + R * math.sin(a), yc - R + R * math.cos(a)) for a in q] + [(xb, yface - r)])
    tube(k, [(x, y, zh) for x, y in path], r, (0.0, 0.0, 1.0))


def tube(k, path, r, up):
    """A round tube (SIDES) along a path lying in the plane square to up, mitred at each bend (its section on the
    bisector); its faces in PIPE_TONES by their turn to LIGHT. Its ends are left open."""
    up = Vector(up).normalized()
    P = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(P):
        ns = [up.cross(b - a).normalized() for a, b in ([(P[i - 1], p)] if i else []) +
              ([(p, P[i + 1])] if i + 1 < len(P) else [])]
        n = sum(ns, Vector()).normalized()
        n = n / n.dot(ns[0])
        rings.append([p + up * r * math.cos(t) + n * r * math.sin(t)
                      for t in ((j + 0.5) * 2 * math.pi / SIDES for j in range(SIDES))])
    light = Vector(LIGHT).normalized()
    for (ra, rb), (pa, pb) in zip(zip(rings, rings[1:]), zip(P, P[1:])):
        for i in range(SIDES):
            j = (i + 1) % SIDES
            pts = [ra[i], ra[j], rb[j], rb[i]]
            mid = sum(pts, Vector()) / 4
            d = pb - pa
            out = mid - (pa + d * max(0.0, min(1.0, (mid - pa).dot(d) / d.dot(d))))
            col = next(c for t, c in PIPE_TONES if light.dot(out.normalized()) > t)
            k.poly(pts, "wall", 2, out, fixed=col)
