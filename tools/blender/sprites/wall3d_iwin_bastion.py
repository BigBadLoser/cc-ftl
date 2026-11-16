"""Interior windows on bastion (walls up; Space Haven wall style 3295, windows #3296 / #3297 / #3298), revisited (the
user, 2026-11-16: the first try, bw4-bw8, was dropped as a bad job, not as a no). Set up as civil's (wall3d_iwin_civil)
first: a straight partition (mask 10, along x) opened between its posts up to the cornice's foot; between the end
blocks the wall cut down to a flat floor FLOOR_DOWN under the ramp's top, across the wall out to where the ramp's slope
falls to it; the pane stands on it. PART: "l", "m", "r" as drone's and civil's."""
from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .faction.bastion import BAST_HB, BAST_P
from . import wall3d_iwin_bastion_front as BF
from .wall3d_iwin import _clip

PX = 1 / 32                 # an art px across or along the wall
POST = round(BAST_P * 32)   # px: a post's front, in from the window's end (bastion's own posts)
BLOCK = 12                  # px: an end block's flat top, in from the window's end
END = 16                    # px: the end block's slope reaches the floor
FLOOR_DOWN = 6              # art px: the floor under the ramp's top
LVL = {"floor": 3, "top": 3, "slope": 3, "side": 1, "under": 1}   # the wall family's levels (toned by facing)
PANE_EDGE = "fTX6"
PANE_T = 1 / 32
PANE_OUT = 0.003
PART = None
GLASS = None


def _span(part):
    p = POST * PX
    return {"l": (-0.5 + p, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - p)}[part]


def _marks(part):
    b, e = BLOCK * PX, END * PX
    return {"l": (-0.5 + b, -0.5 + e, 1.5, 2.0), "m": (-2.0, -1.5, 1.5, 2.0),
            "r": (-2.0, -1.5, 0.5 - e, 0.5 - b)}[part]


def _line():
    return W.wall_back() - 0.5 + W.TW


def _zt():
    return W.skirt_top()


def _fall():
    return W.GN * W.RAMP_PX / W.ZART


def _zf():
    return _zt() - FLOOR_DOWN / W.ZART


def _out(z):
    return _line() + (_zt() - z) / _fall()


def _front():
    return _out(_zf())


def _cells(x0, x1):
    b0, c0, c1, b1 = _marks(PART)
    zt, zf = _zt(), _zf()

    def lin(xa, za, xb, zb):
        return lambda x: za + (zb - za) * (x - xa) / (xb - xa)
    out = []
    for xa, xb, z in ((x0, b0, lambda x: zt), (b0, c0, lin(b0, zt, c0, zf)), (c0, c1, lambda x: zf),
                      (c1, b1, lin(c1, zf, b1, zt)), (b1, x1, lambda x: zt)):
        a, b = max(xa, x0), min(xb, x1)
        if b - a > 1e-9:
            out.append((a, b, z))
    return out


def _under(xa, xb, z):
    s = (z(xb) - z(xa)) / (xb - xa)
    return ((s, 0.0, -1.0), s * xa - z(xa))


def _cut(k, x0, x1, z1, cells):
    """Take everything out over the opening (as drone's): under z1 and over the ramp's top right through the tile,
    over the cells' floors under it out to the floor's front."""
    yb, ye, zt = -_front(), _front(), _zt()
    inx = [(0, x0, 1), (0, x1, -1)]
    regions = [[(0, x0, -1)], [(0, x1, 1)], inx + [(2, z1, 1)], inx + [(2, zt, -1), (1, ye, 1)],
               inx + [(2, zt, -1), (1, yb, -1)]]
    for xa, xb, z in cells:
        regions.append([(0, xa, 1), (0, xb, -1), (1, yb, 1), (1, ye, -1), (2, zt, -1), _under(xa, xb, z)])
    zlo = _zf()
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            xs, ys, zs = [p[0] for p in pts], [p[1] for p in pts], [p[2] for p in pts]
            if (max(xs) <= x0 + 1e-9 or min(xs) >= x1 - 1e-9 or max(zs) <= zlo + 1e-9 or min(zs) >= z1 - 1e-9 or
                    (max(zs) <= zt + 1e-9 and (max(ys) <= yb + 1e-9 or min(ys) >= ye - 1e-9))):
                out.append(f)
                continue
            for r in regions:
                q = _clip(pts, r)
                if len(q) < 3:
                    continue
                n = Vector(q[1]) - Vector(q[0])
                if max((Vector(a) - Vector(q[0])).cross(n).length for a in q) < 1e-10:
                    continue
                base = len(m.v)
                m.v += [tuple(p) for p in q]
                out.append((list(range(base, base + len(q))),) + tuple(f[1:]))
        m.f = out


def _quad(k, pts, out, col):
    """col: a level of the wall family (toned by facing), or a palette name."""
    if isinstance(col, int):
        k.poly([Vector(p) for p in pts], "wall", col, Vector(out))
    else:
        k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def _tops(k, cells):
    zt = _zt()
    for xa, xb, z in cells:
        a, b = max(xa, -0.5), min(xb, 0.5)
        if b - a < 1e-9:
            continue
        za, zb = z(a), z(b)
        ya, yb = _out(za), _out(zb)
        col = LVL["top"] if za >= zt - 1e-9 and zb >= zt - 1e-9 else LVL["floor"] if abs(za - zb) < 1e-9 else \
            LVL["slope"]
        _quad(k, [(a, -ya, za), (b, -yb, zb), (b, yb, zb), (a, ya, za)], (0, 0, 1), col)


def _top():
    """The opening's top: the cornice's foot."""
    return W.wall_top("wall", "up") - BAST_HB


def hook(k, sp, own=True):
    x0, x1 = _span(PART)
    z1 = _top()
    cells = _cells(x0, x1)
    k.side = None
    _cut(k, x0, x1, z1, cells)
    _tops(k, cells)
    BF.front(k, PART, cells)                                            # (the struts along the front, the user)
    yl, zt = _line(), _zt()
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):          # the posts' sides
        if on:
            _quad(k, [(u, -yl, zt), (u, yl, zt), (u, yl, z1), (u, -yl, z1)], (sd, 0, 0), LVL["side"])
    a, b = max(x0, -0.5), min(x1, 0.5)
    if b > a:
        _quad(k, [(a, -yl, z1), (b, -yl, z1), (b, yl, z1), (a, yl, z1)], (0, 0, -1), LVL["under"])
    if not own:
        return
    h, e = PANE_T / 2, PANE_OUT
    global GLASS
    GLASS = T.Relief("iwin_bastion_glass")
    for xa, xb, zl in cells:
        a, b = max(xa, -0.5), min(xb, 0.5)
        if b - a < 1e-9:
            continue
        za, zb = zl(a), zl(b)
        _quad(k, [(a, -h, za + e), (b, -h, zb + e), (b, h, zb + e), (a, h, za + e)], (0, 0, 1), PANE_EDGE)
        GLASS.poly([Vector((a, 0.0, za)), Vector((b, 0.0, zb)), Vector((b, 0.0, z1)), Vector((a, 0.0, z1))],
                   "wall", 2, Vector((0, 1, 0)), fixed="glassL")
    zt = _zt()
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):       # the pane's edge up the posts
        if on:
            v = u + sd * e
            _quad(k, [(v, -h, zt), (v, h, zt), (v, h, z1), (v, -h, z1)], (sd, 0, 0), PANE_EDGE)


def window(fn, part):
    """fn: bastion's straight piece builder. (own, wide, pane objects)."""
    calls = [0]
    seq = (part, {"m": "l", "r": "m"}.get(part))

    def each(k, sp):
        global PART
        i = calls[0]
        calls[0] += 1
        if i < len(seq) and seq[i]:
            PART = seq[i]
            hook(k, sp, own=i == 0)

    def build():
        global PART
        calls[0] = 0
        T.HOOK = each
        try:
            own, wide = fn()
            assert calls[0] == len(seq), calls[0]
            return own, wide, GLASS.build()
        finally:
            PART, T.HOOK = None, None
    return build
