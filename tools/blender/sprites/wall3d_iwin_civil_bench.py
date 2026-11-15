"""The window bench in the civil window's ramp notch (wall3d_iwin_civil_notch; the user: a window bench, the notch's
boxes didn't read as anything): a white plinth along the notch, padded seat cushions on it (no backrests, the user),
split into CUSHIONS with 1 px seams, set 1 px behind the plinth's front (a white base under red pads, the user's
go); each a soft pad: its front corners chamfered and its top edges bevelled CHAMFER px (a flat top, one highlight line,
then its front); the cushions in the look's trim ramp (civil's red, the user) toned by their facing. Coordinates as the civil module's: +y is the near side."""
from mathutils import Vector

from . import walls as W
from .wall3d_iwin import _clip

SPAN = (12, 84)             # px along the window (0 its left end): the notch, end to end
CUSHIONS = ((14, 36), (37, 59), (60, 82))     # px: three cushions, 1 px seams, 2 px in from the notch's ends
PLINTH = (7, 3)             # px deep, art px high: the base the seat stands on
SEAT = (6, 3)               # px deep (1 px behind the plinth's front), art px thick
CHAMFER = 1                 # px (and art px): the cushions' front corners and top edges
PLINTH_COL = {"front": 3, "top": 2, "side": 4}    # steps of the look's wall ramp (civil v1 fC1W)
LIGHT = (0.3, 0.5, 0.8)
TONES = ((0.85, 1), (0.6, 2), (0.3, 3), (-2.0, 4))  # the cushions: trim ramp steps by their light (civil v1 fC1T)


def _c():
    from . import wall3d_iwin_civil as C
    return C


def _ramps():
    from .restyle import _LOOK
    return _LOOK[-1][0].ramps


def _cushion_col(n):
    lt = Vector(LIGHT).normalized().dot(Vector(n).normalized())
    return f"{_ramps()['trim']}{next(c for t, c in TONES if lt > t)}"


def _wall_col(name):
    return f"{_ramps()['wall']}{PLINTH_COL[name]}"


def _poly(k, pts, n, col):
    """A face clipped to the tile across x."""
    q = _clip([tuple(p) for p in pts], [(0, -0.5, 1), (0, 0.5, -1)])
    if len(q) >= 3:
        _c()._quad(k, q, tuple(n), col)


def _meet(p, d, q, e):
    """Where the line p + t d meets the line q + s e (2D)."""
    den = d.x * e.y - d.y * e.x
    t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / den
    return p + d * t


def _cushion(k, a, b, yl, yf, z0, z1):
    """A pad over [a, b] x [yl, yf] from z0 to z1: its plan's front corners chamfered CHAMFER, its top edges bevelled
    CHAMFER in and down (but along its back, on the notch's back)."""
    C = _c()
    c, cz = CHAMFER * C.PX, CHAMFER / W.ZART
    O = [Vector(p) for p in ((a, yl), (b, yl), (b, yf - c), (b - c, yf), (a + c, yf), (a, yf - c))]  # (counter-clockwise)
    off = [0.0] + [c] * (len(O) - 1)                                                                 # (not its back)
    lines = []
    for i, p in enumerate(O):
        d = O[(i + 1) % len(O)] - p
        n = Vector((d.y, -d.x)).normalized()
        lines.append((p - n * off[i], d))
    I = [_meet(*lines[i - 1], *lines[i]) for i in range(len(O))]
    zb, mid = z1 - cz, Vector(((a + b) / 2, (yl + yf) / 2, (z0 + z1) / 2))

    def face(pts):
        pts = [Vector(p) for p in pts]
        n = (pts[1] - pts[0]).cross(pts[2] - pts[1])
        if n.length < 1e-12:
            n = (pts[2] - pts[0]).cross(pts[3] - pts[0])
        if n.dot(sum(pts, Vector()) / len(pts) - mid) < 0:
            n = -n
        _poly(k, pts, n, _cushion_col(n))
    for i in range(1, len(O)):
        p, q = O[i], O[(i + 1) % len(O)]
        face([(p.x, p.y, z0), (q.x, q.y, z0), (q.x, q.y, zb), (p.x, p.y, zb)])
        ip, iq = I[i], I[(i + 1) % len(O)]
        face([(p.x, p.y, zb), (q.x, q.y, zb), (iq.x, iq.y, z1), (ip.x, ip.y, z1)])
    face([(p.x, p.y, z1) for p in I])


def _extrude(k, x0, x1, prof, col):
    """A prism along x over [x0, x1] (clipped to the tile) of the (y, z) profile prof (counter-clockwise seen from +x):
    its faces round the profile and its two ends; col(normal) -> palette name."""
    C = _c()
    a, b = max(x0, -0.5), min(x1, 0.5)
    if b - a < 1e-9:
        return
    for (ya, za), (yb, zb) in zip(prof, prof[1:] + prof[:1]):
        n = Vector((0.0, zb - za, -(yb - ya)))
        if n.length < 1e-12:
            continue
        C._quad(k, [(a, ya, za), (b, ya, za), (b, yb, zb), (a, yb, zb)], tuple(n), col(n))
    for u, sd in ((x0, -1), (x1, 1)):
        if -0.5 < u < 0.5:
            C._quad(k, [(u, y, z) for y, z in prof], (sd, 0, 0), col(Vector((sd, 0, 0))))


def bench(k, part, yl, z1):
    C = _c()
    P, Z = C.PX, 1 / W.ZART
    o = {"l": -0.5, "m": -1.5, "r": -2.5}[part]
    x = lambda p: o + p * P                                                 # noqa: E731
    zp = z1 + PLINTH[1] * Z
    yp = yl + PLINTH[0] * P
    face = {(0, 1): "front", (1, 0): "top"}

    def plinth_col(n):
        n = n.normalized()
        return _wall_col("side" if abs(n.x) > 0.5 else face.get((round(n.y), round(n.z)), "front"))
    _extrude(k, x(SPAN[0]), x(SPAN[1]), [(yl, z1), (yp, z1), (yp, zp), (yl, zp)], plinth_col)
    zs, ys = zp + SEAT[1] * Z, yl + SEAT[0] * P
    for a, b in CUSHIONS:
        _cushion(k, x(a), x(b), yl, ys, zp, zs)
