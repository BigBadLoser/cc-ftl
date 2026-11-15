"""The boxes in the civil window's ramp notch (wall3d_iwin_civil_notch; ref 428's lower layer), built as geometry (the
user's polish pass: no painted details): each stands on the notch's ledge, its back on the notch's back, symmetric about
the window's middle. Upright fronts have their top front edge bevelled BEVEL px; details are pits cut straight back into
a front (their back, bottom wall and sides): the low boxes' vent slits, the small boxes' screens (a dim glow line in
them), the grooves down the middle box's ramp. Coordinates as the civil module's: +y is the near side."""
import os

from mathutils import Vector

from . import walls as W
from . import wall3d_iwin_drone_vents as VT

BOXES = (("low", 13, 27, 5, 5, None), ("small", 28, 37, 4, 6, None), ("mid", 38, 58, 3, None, 6),
         ("small", 59, 68, 4, 6, None), ("low", 69, 83, 5, 5, None))
                            # kind, px along the window (0 its left end), top depth px, height art px (None: RISE over
                            # the window's floor), the foot of a ramped front px out (None: an upright front) (the
                            # user: symmetric; the middle one's front a ramp, its top 1 px over the floor)
MOCK = os.environ.get("CIVIL_NOTCH_MOCK", "B")   # the user's three directions as quick mocks (A one built-in console,
                            # B the c10 boxes plumbed in, C a framed bay of repeated units): pick one, then drop this
MOCKS = {"A": (("panel", 12, 38, 4, 6, None), ("mid", 38, 58, 3, None, 6), ("panel", 58, 84, 4, 6, None)),
         "B": BOXES,
         "C": (("unit", 14, 20, 4, 6, None), ("unit", 22, 28, 4, 6, None), ("unit", 30, 36, 4, 6, None),
               ("mid", 38, 58, 3, None, 6),
               ("unit", 60, 66, 4, 6, None), ("unit", 68, 74, 4, 6, None), ("unit", 76, 82, 4, 6, None))}
PIPE = (1, 8, (20, 32))     # B: the pipe along the notch's back: radius px, centre art px over the ledge, drops into the
                            # boxes' tops at these px (the right ones mirrored)
CURB = (2, 1)               # C: the lip along the ledge's front edge: px in from it, art px high
RISE = 1                    # art px: the middle box's top over the window's floor (the user)
BEVEL = 1                   # px (and art px): the upright fronts' top edge bevelled
PIT = 1                     # px: the pits' depth, straight back
PITS = {"low": ((3, 5), (6, 8), (9, 11), 1, 3, "vent"),              # the low boxes' vent slits (2 px, 1 apart)
        "small": ((2, 7), 2, 4, "screen"),                            # the small boxes' screens
        "mid": ((6, 7), (13, 14), 1, -1, "groove"),                   # the middle box's grooves (6 px panels)
        "panel": ((1, 5), (6, 10), (11, 15), (16, 20), (21, 25), 1, 4, "panel"),   # A: five 4 px panels, 1 px borders
        "unit": ((1, 5), 2, 4, "screen")}                             # C: each unit's screen
                            # (x0, x1) px from the box's left end (a right one's mirrored), then from / to art px over
                            # the ledge (to < 0: under the box's top), then their kind
GLOW = (1, 3, 4)            # the screens' glow line: px in from each side, from / to art px over the ledge
WALL = {"top": 1, "bevel": 1, "front": 2, "ramp": 2, "side": 4,     # steps of the look's wall ramp (civil v1 fC1W:
        "pit_floor": 4, "pit_side": 5, "groove": 5, "panel": 4}                 # the slope is W2)
SHADE = {"vent": 5, "screen": 5, "glow": 1}
PIPE_TONES = ((0.85, 1), (0.6, 2), (0.3, 3), (-2.0, 4))             # B's pipe: shade ramp steps by its light                         # steps of its shade ramp (civil v1 fC1X: the dark
                            # navy of the ref's end blocks) for the vents' and screens' backs, the glow line


def _col(name):
    from .restyle import _LOOK
    r = _LOOK[-1][0].ramps
    return f"{r['wall']}{WALL[name]}" if name in WALL else f"{r['wall'][:-1]}X{SHADE[name]}"


def _c():
    from . import wall3d_iwin_civil as C
    return C


def _mirror(kind, pa, pb):
    """A box's pits in px along the window: as listed from its left end, mirrored for a box right of the middle."""
    spec = PITS.get(kind)
    if spec is None:
        return [], 0, 0, None
    *xs, z0, z1, what = spec
    if pa > 48:
        xs = sorted((pb - pa - b, pb - pa - a) for a, b in xs)
    return [(pa + a, pa + b) for a, b in xs], z0, z1, what


def boxes(k, part, yl, z1):
    C = _c()
    o = {"l": -0.5, "m": -1.5, "r": -2.5}[part]
    for kind, pa, pb, d, h, ramp in MOCKS[MOCK]:
        if min(o + pb * C.PX, 0.5) - max(o + pa * C.PX, -0.5) < 1e-9:
            continue
        _box(k, o, kind, pa, pb, yl, yl + d * C.PX, z1, h, ramp)
    if MOCK == "B":
        _pipe(k, o, yl, z1)
    if MOCK == "C":
        _curb(k, o, z1)


def _pipe(k, o, yl, z1):
    """B: a round pipe along the notch's back from each end into the middle box's side, dropping into the boxes' tops."""
    C = _c()
    P, Z = C.PX, 1 / W.ZART
    r, zc, drops = PIPE[0] * P, z1 + PIPE[1] * Z, PIPE[2]
    y = yl + r
    tops = {p: z1 + h * Z for _, a, b, d, h, _r in BOXES if h is not None for p in range(a, b + 1)}

    def col(out):
        from .restyle import _LOOK
        lt = Vector((0.3, 0.5, 0.8)).normalized().dot(Vector(out).normalized())
        return f"{_LOOK[-1][0].ramps['wall'][:-1]}X{next(c for t, c in PIPE_TONES if lt > t)}"
    for a, b in ((12, 38), (58, 84)):
        xa, xb = o + a * P, o + b * P
        a, b = max(xa, -0.5), min(xb, 0.5)
        if b - a > 1e-9:
            VT.tube(k, [(a, y, zc), (b, y, zc)], r, (0.0, 1.0, 0.0), col)
    for p in drops + tuple(96 - p for p in drops):
        x = o + p * P
        if -0.5 + r < x < 0.5 - r:
            VT.tube(k, [(x, y, zc), (x, y, tops[p])], r, (1.0, 0.0, 0.0), col)


def _curb(k, o, z1):
    """C: a lip standing on the ledge along its front edge, across the notch: its front and top."""
    C = _c()
    P, Z = C.PX, 1 / W.ZART
    yf, zh = C._out(z1) - CURB[0] * P, z1 + CURB[1] * Z
    xa, xb = o + 12 * P, o + 84 * P
    _quad(k, xa, xb, lambda x: [(x, yf, z1), (x, yf, zh)], Vector((0, 1, 0)), "front")
    _quad(k, xa, xb, lambda x: [(x, yf - P, zh), (x, yf, zh)], Vector((0, 0, 1)), "top")


def _box(k, o, kind, pa, pb, yl, yt, z1, h, ramp):
    C = _c()
    P, Z = C.PX, 1 / W.ZART
    xa, xb = o + pa * P, o + pb * P
    zh = C._zf() + RISE * Z if h is None else z1 + h * Z
    if ramp is None:                                        # an upright front, its top edge bevelled
        zf, yc = zh - BEVEL * Z, yt - BEVEL * P
        prof = [(yl, z1), (yt, z1), (yt, zf), (yc, zh), (yl, zh)]
        face = (lambda x, z: Vector((x, yt, z))), Vector((0, 1, 0)), "front"
        _quad(k, xa, xb, lambda x: [(x, yt, zf), (x, yc, zh)], Vector((0, BEVEL * Z, BEVEL * P)), "bevel")
    else:                                                   # a ramped front, from the top's front edge to its foot
        yb, zf, yc = yl + ramp * P, zh, yt
        prof = [(yl, z1), (yb, z1), (yt, zh), (yl, zh)]
        face = (lambda x, z: Vector((x, yb + (yt - yb) * (z - z1) / (zh - z1), z))), \
            Vector((0, zh - z1, yb - yt)).normalized(), "ramp"
    _quad(k, xa, xb, lambda x: [(x, yl, zh), (x, yc, zh)], Vector((0, 0, 1)), "top")
    for u, sd, p in ((xa, -1, pa), (xb, 1, pb)):
        if -0.5 < u < 0.5 and p not in (C.BLOCK, 96 - C.BLOCK):        # (not on the notch's own end walls)
            C._quad(k, [(u, y, z) for y, z in prof], (sd, 0, 0), _col("side"))
    xs, p0, p1, what = _mirror(kind, pa, pb)
    pits = [(o + a * P, o + b * P) for a, b in xs]
    glow = (z1 + GLOW[1] * Z, z1 + GLOW[2] * Z)
    _face(k, face, xa, xb, z1, zf, pits, z1 + p0 * Z, (zf + p1 * Z) if p1 < 0 else z1 + p1 * Z, what, glow)


def _quad(k, xa, xb, ends, n, col):
    """A face across x from xa to xb (clipped to the tile): ends(x) -> its edge's points at x."""
    a, b = max(xa, -0.5), min(xb, 0.5)
    if b - a > 1e-9:
        e0, e1 = ends(a), ends(b)
        _c()._quad(k, [e0[0], e1[0], e1[1], e0[1]], tuple(n), _col(col) if isinstance(col, str) else col)


def _face(k, face, xa, xb, za, zb, pits, z0, z1, what, glow):
    """A box's front (face: (P(x, z), its normal, its colour)) from za to zb, with pits cut PIT px straight back
    across [x0, x1] x [z0, z1] (one row): the face's strips round them, then each pit's back, bottom wall and sides."""
    pt, n, col = face

    def strip(x0, x1, zl, zu, c=col, back=0.0):
        _quad(k, x0, x1, lambda x: [tuple(pt(x, zl) - Vector((0, back, 0))), tuple(pt(x, zu) - Vector((0, back, 0)))],
              n, c)
    if not pits:
        strip(xa, xb, za, zb)
        return
    strip(xa, xb, za, z0)
    strip(xa, xb, z1, zb)
    edges = [xa] + [x for p in pits for x in p] + [xb]
    for x0, x1 in zip(edges[::2], edges[1::2]):
        strip(x0, x1, z0, z1)
    d = PIT * _c().PX
    for x0, x1 in pits:
        strip(x0, x1, z0, z1, what, d)
        _quad(k, x0, x1, lambda x: [tuple(pt(x, z0)), tuple(pt(x, z0) - Vector((0, d, 0)))], Vector((0, 0, 1)),
              "pit_floor")
        for u, sd in ((x0, 1), (x1, -1)):
            if -0.5 < u < 0.5:
                _c()._quad(k, [tuple(pt(u, z0)), tuple(pt(u, z1)), tuple(pt(u, z1) - Vector((0, d, 0))),
                               tuple(pt(u, z0) - Vector((0, d, 0)))], (sd, 0, 0), _col("pit_side"))
        if what == "screen":                                # (its glow line just off the screen's back)
            g, e = GLOW[0] * _c().PX, d - 0.002
            _quad(k, x0 + g, x1 - g, lambda x: [tuple(pt(x, glow[0]) - Vector((0, e, 0))),
                                                tuple(pt(x, glow[1]) - Vector((0, e, 0)))], n, "glow")
