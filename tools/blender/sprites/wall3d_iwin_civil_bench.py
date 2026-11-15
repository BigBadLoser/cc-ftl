"""The window bench in the civil window's ramp notch (wall3d_iwin_civil_notch; the user: a window bench, the notch's
boxes didn't read as anything): a white plinth along the notch, padded seat cushions on it and back cushions standing
against the notch's back, each run of cushions split into CUSHIONS with 1 px seams, their front edges rounded; the
cushions in the look's shade ramp (civil's muted navy) toned by their facing, so the curves read. Coordinates as the
civil module's: +y is the near side."""
import math

from mathutils import Vector

from . import walls as W

SPAN = (12, 84)             # px along the window (0 its left end): the notch, end to end
CUSHIONS = ((14, 36), (37, 59), (60, 82))     # px: three cushions, 1 px seams, 2 px in from the notch's ends
PLINTH = (6, 3)             # px deep, art px high: the base the seat stands on
SEAT = (7, 3, 2)            # px deep (1 px over the plinth's front), art px thick, its front top edge's radius px
BACK = (3, 5, 2)            # px thick, art px high over the seat, its top front edge's radius px
STEPS = 4                   # a rounded edge's steps
PLINTH_COL = {"front": 3, "top": 2, "side": 4}    # steps of the look's wall ramp (civil v1 fC1W)
LIGHT = (0.3, 0.5, 0.8)
TONES = ((0.85, 0), (0.6, 1), (0.3, 2), (-2.0, 3))  # the cushions: shade ramp steps by their light (civil v1 fC1X)


def _c():
    from . import wall3d_iwin_civil as C
    return C


def _ramps():
    from .restyle import _LOOK
    return _LOOK[-1][0].ramps


def _cushion_col(n):
    lt = Vector(LIGHT).normalized().dot(Vector(n).normalized())
    return f"{_ramps()['wall'][:-1]}X{next(c for t, c in TONES if lt > t)}"


def _wall_col(name):
    return f"{_ramps()['wall']}{PLINTH_COL[name]}"


def _round(prof, i, ry, rz):
    """prof's corner i replaced by a quarter ellipse ry x rz (y, z units) tangent to both its edges."""
    p, a, b = Vector(prof[i]), Vector(prof[i - 1]), Vector(prof[(i + 1) % len(prof)])
    da, db = (a - p).normalized(), (b - p).normalized()
    c = p + Vector((da.x * ry + db.x * ry, da.y * rz + db.y * rz))
    sa, sb = p + Vector((da.x * ry, da.y * rz)), p + Vector((db.x * ry, db.y * rz))
    arc = [c + (sa - c) * math.cos(t) + (sb - c) * math.sin(t)
           for t in (j * math.pi / 2 / STEPS for j in range(STEPS + 1))]
    return prof[:i] + [tuple(q) for q in arc] + prof[i + 1:]


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
    seat = [(yl, zp), (ys, zp), (ys, zs), (yl, zs)]
    seat = _round(seat, 2, SEAT[2] * P, SEAT[2] * Z)
    zb, yb = zs + BACK[1] * Z, yl + BACK[0] * P
    back = _round([(yl, zs), (yb, zs), (yb, zb), (yl, zb)], 2, BACK[2] * P, BACK[2] * Z)
    for a, b in CUSHIONS:
        _extrude(k, x(a), x(b), seat, _cushion_col)
        _extrude(k, x(a), x(b), back, _cushion_col)
