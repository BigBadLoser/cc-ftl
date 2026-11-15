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
MODULES = (("low", 13, 27, 5, 4, None), ("small", 28, 37, 4, 6, None), ("mid", 38, 58, 3, None, 6),
           ("small", 59, 68, 4, 6, None), ("low", 69, 83, 5, 4, None))
                            # boxes on its ledge against its back, symmetric about the window's middle (48) (the user;
                            # ref 428's: a long low one and a small one each side, the big one mid): kind, px along the
                            # window (0 its left end), top depth px, height art px (None: RISE over the window's floor,
                            # the user), the foot of a ramped front px out (None: an upright front; the middle one's
                            # front a ramp, the user)
RISE = 1                    # art px: the middle box's top over the window's floor (the user)
SEAM = 2                    # px: the low boxes' top seam, centred (2: a 14 px box's middle on the px grid)
VENTS = (3, 2, 1, 2)        # the low boxes' front: slits (count, px wide, px apart, art px high), centred, 1 art px over
                            # the ledge
LIGHT = (3, 2)              # the small boxes' front: an indicator in the trim colour, px wide, art px high, 1 art px under
                            # the top, centred (3: a 9 px box's middle on the grid)
PANELS = 3                  # the middle box's ramp: split by 1 px seams into PANELS
DECAL = 0.002               # a detail's lift off its face
STEP = {"back": 3, "ledge": 5, "side": 6, "m_top": 1, "m_front": 2, "m_side": 5, "m_ramp": 3, "seam": 4, "vent": 6}
                            # steps of the look's wall ramp (civil v1: the slope is fC1W2; the ref's back, floor and end
                            # wall c1cac8, 9ea9ad, 68737f)
TRIM = 2                    # the indicator: the look's trim ramp's step


def _col(part):
    from .restyle import _LOOK
    if part == "light":
        return f"{_LOOK[-1][0].ramps['trim']}{TRIM}"
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
    """MODULES: boxes standing on the ledge, their backs on the notch's back; a ramped front runs from the top's front
    edge down to its foot on the ledge. Then each kind's details (_details)."""
    C = _c()
    o = {"l": -0.5, "m": -1.5, "r": -2.5}[part]
    for kind, pa, pb, d, h, ramp in MODULES:
        xa, xb = o + pa * C.PX, o + pb * C.PX
        a, b = max(xa, -0.5), min(xb, 0.5)
        if b - a < 1e-9:
            continue
        yt = yl + d * C.PX
        zh = C._zf() + RISE / W.ZART if h is None else z1 + h / W.ZART
        yb = yt if ramp is None else yl + ramp * C.PX
        C._quad(k, [(a, yb, z1), (b, yb, z1), (b, yt, zh), (a, yt, zh)], (0, zh - z1, yb - yt),
                _col("m_front" if ramp is None else "m_ramp"))
        C._quad(k, [(a, yl, zh), (b, yl, zh), (b, yt, zh), (a, yt, zh)], (0, 0, 1), _col("m_top"))
        for u, sd in ((xa, -1), (xb, 1)):
            if -0.5 < u < 0.5:
                C._quad(k, [(u, yl, z1), (u, yb, z1), (u, yt, zh), (u, yl, zh)], (sd, 0, 0), _col("m_side"))
        _details(k, kind, o, pa, pb, yl, yt, yb, z1, zh)


def _details(k, kind, o, pa, pb, yl, yt, yb, z1, zh):
    """The detail pass (the user: a little visual interest): the low boxes a seam across the top's middle and VENTS
    dark slits on the front; the small ones an indicator light; the middle one's ramp split into PANELS by seams."""
    C = _c()
    P = C.PX

    def rect(p0, p1, corner):
        """px p0..p1 along the window: corner(a, b) -> its points (clipped to the tile)."""
        a, b = max(o + p0 * P, -0.5), min(o + p1 * P, 0.5)
        return None if b - a < 1e-9 else corner(a, b)

    def centred(w):
        p0 = pa + (pb - pa - w) // 2
        return p0, p0 + w

    def front(x0, x1, z0, z2, col):
        q = rect(x0, x1, lambda a, b: [(a, yt + DECAL, z0), (b, yt + DECAL, z0), (b, yt + DECAL, z2),
                                       (a, yt + DECAL, z2)])
        if q:
            C._quad(k, q, (0, 1, 0), _col(col))
    if kind == "low":
        q = rect(*centred(SEAM), lambda a, b: [(a, yl, zh + DECAL), (b, yl, zh + DECAL), (b, yt, zh + DECAL),
                                                      (a, yt, zh + DECAL)])
        if q:
            C._quad(k, q, (0, 0, 1), _col("seam"))
        n, w, g, h = VENTS
        p0 = centred(n * w + (n - 1) * g)[0]
        for i in range(n):
            front(p0 + i * (w + g), p0 + i * (w + g) + w, z1 + 1 / W.ZART, z1 + (1 + h) / W.ZART, "vent")
    elif kind == "small":
        w, h = LIGHT
        front(*centred(w), zh - (1 + h) / W.ZART, zh - 1 / W.ZART, "light")
    elif kind == "mid":
        n = Vector((0.0, zh - z1, yb - yt)).normalized()
        w = (pb - pa - (PANELS - 1)) // PANELS                     # (20 px: 6 px panels, seams at 44, 51)
        for i in range(1, PANELS):
            x = pa + i * w + i - 1
            q = rect(x, x + 1, lambda a, b: [tuple(Vector(p) + n * DECAL) for p in
                                                          ((a, yb, z1), (b, yb, z1), (b, yt, zh), (a, yt, zh))])
            if q:
                C._quad(k, q, n, _col("seam"))
