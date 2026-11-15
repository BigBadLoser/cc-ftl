"""The civil window's ramp notch (wall3d_iwin_civil; ref 428's lower layer): a long pocket cut into the near ramp's slope,
across the window from where the end blocks' slopes start (their top edge, BLOCK in from its ends), from BELOW sprite px
over the ramp's edge (where the slope meets the foot) up to where the ramp itself ends (its top line, where it meets
the wall: past the window floor's front, the user): its back upright there, from the surface over it (the window's
floor, the end blocks' slopes) straight down to a ledge along its foot (the user); in the look's own wall ramp, darker
than the slope (the wall family's levels all come out the slope's white in civil). Coordinates as the civil module's:
+y is the near side, the mesh's -y (core.G)."""
from mathutils import Vector

from . import walls as W
from .wall3d_iwin_drone_vents import _carve

BELOW = 7                   # sprite px: the slope left under it, over the ramp's edge (the ref's 8)
MODULES = ((14, 30, 5, 4), (32, 41, 4, 6), (44, 66, 4, 8), (68, 82, 4, 6))  # boxes on its ledge against its back
                            # (ref 428's: a long low one, a small one, the big one mid, one right): px along the window
                            # (0 its left end), depth px, height art px (each kept inside the slope's line)
STEP = {"back": 3, "ledge": 5, "side": 6, "m_top": 1, "m_front": 2, "m_side": 5}  # steps of the look's wall ramp (civil v1: the slope is fC1W2; the ref's
                                            # back, floor and end wall c1cac8, 9ea9ad, 68737f)


def _col(part):
    from .restyle import _LOOK
    return f"{_LOOK[-1][0].ramps['wall']}{STEP[part]}"


def _c():
    from . import wall3d_iwin_civil as C
    return C


def _span(part):
    i = _c().BLOCK / 32
    return {"l": (-0.5 + i, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - i)}[part]


def _rows(f):
    """Sprite rows a unit of height down the slope: ZART, plus GN / 2 a unit out over its fall."""
    return W.ZART + W.GN / 2 / f


def _foot_z():
    return W.foot() + BELOW / _rows(_c()._fall())


def notch(k, part, cells):
    """cells: the window's floor under the opening (wall3d_iwin_civil._cells): the back's top at each x."""
    C = _c()
    zt, yl = C._zt(), C._line()
    z1 = _foot_z()
    u0, u1 = _span(part)
    _carve(k, [(0, u0, 1), (0, u1, -1), (2, z1, 1), (2, zt + 1e-4, -1), (1, -yl, -1)])   # (mesh y: in front of the back)
    ys1 = C._out(z1)
    for xa, xb, z in cells:
        a, b = max(xa, u0, -0.5), min(xb, u1, 0.5)
        if b - a < 1e-9:
            continue
        C._quad(k, [(a, yl, z(a)), (b, yl, z(b)), (b, yl, z1), (a, yl, z1)], (0, 1, 0), _col("back"))
        C._quad(k, [(a, yl, z1), (b, yl, z1), (b, ys1, z1), (a, ys1, z1)], (0, 0, 1), _col("ledge"))
    _modules(k, part, yl, z1)
    for u, sd in ((u0, 1), (u1, -1)):
        if not -0.5 < u < 0.5:
            continue
        zu = next(z(u) for xa, xb, z in cells if xa - 1e-9 <= u <= xb + 1e-9)
        pts = [(u, yl, zu), (u, C._out(zu), zu), (u, ys1, z1), (u, yl, z1)]
        pts = [p for i, p in enumerate(pts) if (Vector(p) - Vector(pts[i - 1])).length > 1e-9]
        C._quad(k, pts, (sd, 0, 0), _col("side"))


def _modules(k, part, yl, z1):
    """MODULES: boxes standing on the ledge, their backs on the notch's back."""
    C = _c()
    o = {"l": -0.5, "m": -1.5, "r": -2.5}[part]
    for pa, pb, d, h in MODULES:
        xa, xb = o + pa * C.PX, o + pb * C.PX
        a, b = max(xa, -0.5), min(xb, 0.5)
        if b - a < 1e-9:
            continue
        yf, zh = yl + d * C.PX, z1 + h / W.ZART
        C._quad(k, [(a, yf, z1), (b, yf, z1), (b, yf, zh), (a, yf, zh)], (0, 1, 0), _col("m_front"))
        C._quad(k, [(a, yl, zh), (b, yl, zh), (b, yf, zh), (a, yf, zh)], (0, 0, 1), _col("m_top"))
        for u, sd in ((xa, -1), (xb, 1)):
            if -0.5 < u < 0.5:
                C._quad(k, [(u, yl, z1), (u, yf, z1), (u, yf, zh), (u, yl, zh)], (sd, 0, 0), _col("m_side"))
