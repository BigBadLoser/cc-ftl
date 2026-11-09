"""Interior windows on drone (walls up; Space Haven wall style 423, windows #2765 / #2764 / #2863): its own build. A
straight partition (mask 10, along x) opened between its posts; between the end blocks the wall is cut down to a flat
floor FLOOR_DOWN under the ramp's top, across the wall out to where the ramp's slope falls to it (the ramp's front
slopes down onto it: the user); the pane stands on it. The end blocks: the wall's top left standing BLOCK px in from
the window's end, then a slope along the wall down to the floor at END. The same cut on the far side. The opening runs
up to the header's foot.

Shared with the other windows: the hook wrapper (wall3d.HOOK on a piece's Relief), the clip (wall3d_iwin._clip), the
pane's edges and the glass Relief (the "glass" render kind). PART: "l", "m", "r" as wall3d_iwin_navy's."""
from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .faction import drone as DR
from .wall3d_iwin import _clip

PX = 1 / 32                 # an art px across or along the wall
POST = 11                   # px: a post, in from the window's end
BLOCK = 12                  # px: an end block's flat top, in from the window's end (the ref's ~10-12)
END = 16                    # px: the end block's slope reaches the floor (the ref's 3-4 px slope along the wall)
FLOOR_DOWN = 6              # art px: the floor under the ramp's top (the ref's 4-5 of its ~17 px slope; ours 22: deeper,
                            # the user)
COL = {"floor": "fDW4", "top": "fDW2", "slope": "fDW3", "side": "fDX2", "post": "fDW3", "under": "fDF3"}
OFF = {"l": 0, "m": 1, "r": 2}
# The front (the near ramp), in px along the window from its -x end (96: the ref's, measured on its deskewed front):
BOXES = ((17, 30), (66, 79))   # the red boxes: upright fronts at the toe, tops BOX_DOWN under the sill, back to it
                               # (2 px wider toward the middle than the ref's 17-28, 68-79: the user)
BOX_DOWN = 2                # art px: their tops under the sill (the window's floor), running back to it, the ramp cut
                            # away over them there: a step up to the sill at its front edge (the user)
BOX_OUT = 0.1               # art px: the boxes' fronts past the toe (at it, a hair proud: behind it the foot hid their
                            # bottoms), upright from the floor (they stay put: the user)
OUT = 2                     # art px: the ribs' fronts past the toe, upright down to the toe's top (the foot's height),
                            # their bottom sloping from there back to the toe on the floor (the user)
SLOT = (34, 62)             # the middle slot (in place of the console): its sides 4 px in from the red boxes, its
SLOT_BACK = 4               # floor flat at the toe's top (the foot's height), from the toe back past the slope's top
                            # end SLOT_BACK px into the sill (the user)
RIBS = ((13, 17), (79, 83))  # a 4 px rib on each red box's outside: its top flat, level with the window's floor, out
                             # from where the slope falls to it; its front in the toe's tone, OUT past it (the user)
VENTS = ((3, 13), (83, 93))  # the end blocks' vents: dark panels down their slope
FRONT = {"box": "fDM2", "box_top": "fDM1", "box_side": "fDM3", "slot_floor": "fDW3", "slot_back": "fDX3",
         "slot_side": "fDX2",
         "vent": "fDS3", "rib_top": "fDW2", "rib_side": "fDW4", "step": "fDW3"}
PANE_EDGE = "fTX6"
PANE_T = 1 / 32
PANE_OUT = 0.003
PART = None
GLASS = None


def _span(part):
    """(x0, x1): the opening, between the posts (past the tile where it runs on)."""
    p = POST * PX
    return {"l": (-0.5 + p, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - p)}[part]


def _marks(part):
    """(b0, c0, c1, b1): the end blocks' flat tops end at b0 / b1, the floor runs c0..c1."""
    b, e = BLOCK * PX, END * PX
    return {"l": (-0.5 + b, -0.5 + e, 1.5, 2.0), "m": (-2.0, -1.5, 1.5, 2.0),
            "r": (-2.0, -1.5, 0.5 - e, 0.5 - b)}[part]


def _line():
    """The wall's line (the ramp's top edge), from the pane (the wall's middle)."""
    return W.wall_back() - 0.5 + W.TW


def _zt():
    return W.skirt_top()


def _fall():
    """The ramp's fall a unit out (the default ramp: RAMP_PX a cell, from the top)."""
    return W.GN * W.RAMP_PX / W.ZART


def _zf():
    return _zt() - FLOOR_DOWN / W.ZART


def _out(z):
    """From the pane, how far out the ramp's slope is down to z."""
    return _line() + (_zt() - z) / _fall()


def _front():
    return _out(_zf())


def _cells(x0, x1):
    """The opening along x: (xa, xb, z) with z(x) linear: the blocks' flat tops, their slopes, the floor."""
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
    """Take everything out over the opening: under z1 (the header's foot) and over the ramp's top right through the
    tile (drone's face panels stand proud of the ramp's line), over the cells' floors under it out to the floor's
    front."""
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
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def _tops(k, cells):
    """The cut's floors: each cell's top across the wall out to where the ramp falls to it (the block's flat top
    between the wall's lines, its slope widening to the floor's front, the floor out to its front)."""
    zt = _zt()
    for xa, xb, z in cells:
        a, b = max(xa, -0.5), min(xb, 0.5)
        if b - a < 1e-9:
            continue
        za, zb = z(a), z(b)
        ya, yb = _out(za), _out(zb)
        col = COL["top"] if za >= zt - 1e-9 and zb >= zt - 1e-9 else COL["floor"] if abs(za - zb) < 1e-9 else COL["slope"]
        _quad(k, [(a, -ya, za), (b, -yb, zb), (b, yb, zb), (a, ya, za)], (0, 0, 1), col)


def _x(px):
    return -0.5 - OFF[PART] + px * PX


def _slope(k, p0, p1, da, db, col):
    """Paint along the window p0..p1 px down the near ramp's slope, da..db out from the wall's line (3 PAINT proud)."""
    from .faction.parts import PAINT
    u0, u1 = max(_x(p0), -0.5), min(_x(p1), 0.5)
    if u1 - u0 < 1e-9:
        return
    yl, zt, f = _line(), _zt(), _fall()
    n = Vector((0.0, f, 1.0)).normalized()
    pts = [Vector((u, yl + d, zt - d * f)) + n * 3 * PAINT for u, d in ((u0, da), (u1, da), (u1, db), (u0, db))]
    k.poly(pts, "wall", 2, n, fixed=col)


def _front_parts(k):
    """The near ramp's dressing: the end blocks' vents, the red boxes and their ribs."""
    run, d0 = W.skirt_run(), (_zt() - _zf()) / _fall()
    dz = (_zt() - W.foot()) / _fall()                   # (where the slope meets the foot)
    for a, b in VENTS:
        _slope(k, a, b, 1 * PX, dz - 1 * PX, FRONT["vent"])
    zb = _zf() - BOX_DOWN / W.ZART
    for a, b in BOXES:
        _block(k, a, b, 0.5 + BOX_OUT * PX, zb, FRONT["box"], FRONT["box_top"], FRONT["box_side"], False, _front())
        u0, u1 = max(_x(a), -0.5), min(_x(b), 0.5)
        if u1 - u0 > 1e-9:                              # (the sill's front edge over the box: the step up to it)
            y = _front()
            _quad(k, [(u0, y, zb), (u1, y, zb), (u1, y, _zf()), (u0, y, _zf())], (0, 1, 0), FRONT["step"])
    for a, b in RIBS:
        _block(k, a, b, 0.5 + OUT * PX, _zf(), None, FRONT["rib_top"], FRONT["rib_side"])


def _box_cuts(k):
    """Take the near ramp away over each red box, out from the sill's front edge, down to the box's top; and over the
    slot, out from SLOT_BACK into the sill, down to the toe's top (mesh -y: the near side, core.G)."""
    zb = _zf() - BOX_DOWN / W.ZART
    for a, b, ye, z in [(a, b, -_front(), zb) for a, b in BOXES] + [SLOT + (-_slot_back(), W.foot())]:
        _notch(k, _x(a), _x(b), ye, z)


def _slot_back():
    return _front() - SLOT_BACK * PX


def _slot(k):
    """The slot's faces: its floor at the toe's top from its back to the toe, its back up to the sill, its sides (the
    sill's section, then the slope's, down to the toe's top)."""
    pa, pb = _x(SLOT[0]), _x(SLOT[1])
    a, b = max(pa, -0.5), min(pb, 0.5)
    if b - a < 1e-9:
        return
    yk, yf, zf, zs = _slot_back(), _front(), W.foot(), _zf()
    _quad(k, [(a, yk, zf), (b, yk, zf), (b, 0.5, zf), (a, 0.5, zf)], (0, 0, 1), FRONT["slot_floor"])
    _quad(k, [(a, yk, zf), (b, yk, zf), (b, yk, zs), (a, yk, zs)], (0, 1, 0), FRONT["slot_back"])
    for u, sd in ((pa, 1), (pb, -1)):
        if -0.5 < u < 0.5:
            _quad(k, [(u, yk, zf), (u, 0.5, zf), (u, yf, zs), (u, yk, zs)], (sd, 0, 0), FRONT["slot_side"])


def _notch(k, pa, pb, ye, zb):
    """Take everything out between pa and pb, out past mesh y ye (the near side), over zb."""
    if pb <= -0.5 or pa >= 0.5:
        return
    inx = [(0, pa, 1), (0, pb, -1)]
    regions = [[(0, pa, -1)], [(0, pb, 1)], inx + [(1, ye, 1)], inx + [(1, ye, -1), (2, zb, -1)]]
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            xs, ys, zs = [p[0] for p in pts], [p[1] for p in pts], [p[2] for p in pts]
            if max(xs) <= pa + 1e-9 or min(xs) >= pb - 1e-9 or min(ys) >= ye - 1e-9 or max(zs) <= zb + 1e-9:
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


def _block(k, a, b, yf, zb, front, top, side, under=True, back=None):
    """A block on the near ramp a..b px along the window: its front upright at yf (past the toe) up to zb, from the
    foot's height with its bottom sloping from there back to the toe on the floor (under), else from the floor; its top
    flat back to the slope (the slope's own height there). front None: the toe's tone (the wall's, as the foot's)."""
    yb, yt, zf = _out(zb) if back is None else back, 0.5, W.foot() if under else 0.0
    u0, u1 = _x(a), _x(b)
    a_, b_ = max(u0, -0.5), min(u1, 0.5)
    if b_ - a_ < 1e-9:
        return
    nu = Vector((0.0, zf, -(yf - yt))).normalized() if under else None
    for pts, n, col in (([(a_, yf, zf), (b_, yf, zf), (b_, yf, zb), (a_, yf, zb)], Vector((0, 1, 0)), front),
                        ([(a_, yt, 0.0), (b_, yt, 0.0), (b_, yf, zf), (a_, yf, zf)], nu, front))[:2 if under else 1]:
        if col:
            _quad(k, pts, n, col)
        else:
            k.poly([Vector(p) for p in pts], "wall", 3, n)
    _quad(k, [(a_, yb, zb), (a_, yf, zb), (b_, yf, zb), (b_, yb, zb)], (0, 0, 1), top)
    for u, sd in ((u0, -1), (u1, 1)):
        if -0.5 < u < 0.5:
            sec = [(u, yb, 0.0), (u, yt, 0.0), (u, yf, zf), (u, yf, zb), (u, yb, zb)] if under else \
                [(u, yb, 0.0), (u, yf, 0.0), (u, yf, zb), (u, yb, zb)]
            _quad(k, sec, (sd, 0, 0), side)


def hook(k, sp, own=True):
    x0, x1 = _span(PART)
    z1 = _header_foot()
    cells = _cells(x0, x1)
    k.side = None
    _cut(k, x0, x1, z1, cells)
    _tops(k, cells)
    yl, zt = _line(), _zt()
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):          # the posts' sides, the block's top up
        if on:
            _quad(k, [(u, -yl, zt), (u, yl, zt), (u, yl, z1), (u, -yl, z1)], (sd, 0, 0), COL["post"])
    a, b = max(x0, -0.5), min(x1, 0.5)
    _quad(k, [(a, -yl, z1), (b, -yl, z1), (b, yl, z1), (a, yl, z1)], (0, 0, -1), COL["under"])
    _box_cuts(k)
    _slot(k)
    _front_parts(k)
    if not own:                                         # (a copy past the tile: no pane)
        return
    h, e = PANE_T / 2, PANE_OUT                         # the pane's edges, its foot on each cell's floor
    global GLASS
    GLASS = T.Relief("iwin_drone_glass")
    for xa, xb, zl in cells:
        a, b = max(xa, -0.5), min(xb, 0.5)
        if b - a < 1e-9:
            continue
        za, zb = zl(a), zl(b)
        _quad(k, [(a, -h, za + e), (b, -h, zb + e), (b, h, zb + e), (a, h, za + e)], (0, 0, 1), PANE_EDGE)
        _quad(k, [(a, -h, z1 - e), (b, -h, z1 - e), (b, h, z1 - e), (a, h, z1 - e)], (0, 0, -1), PANE_EDGE)
        GLASS.poly([Vector((a, 0.0, za)), Vector((b, 0.0, zb)), Vector((b, 0.0, z1)), Vector((a, 0.0, z1))],
                   "wall", 2, Vector((0, 1, 0)), fixed="glassL")
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):
        if on:
            v = u + sd * e
            _quad(k, [(v, -h, zt), (v, h, zt), (v, h, z1), (v, -h, z1)], (sd, 0, 0), PANE_EDGE)


def _header_foot():
    """The opening's top: a quarter of the wall's height over the ramp under its top (the beam's foot, for now)."""
    zs = W.skirt_top()
    rt = W.wall_top("wall", "up")
    return rt - 0.25 * (rt - zs)


def window(fn, part):
    """fn: drone's straight piece builder (tile.wall.drone.full.m10). (own, wide, pane objects)."""
    calls = [0]
    seq = (part, {"m": "l", "r": "m"}.get(part))       # the piece; its copy one tile on at -x (as navy's)

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
        DR.BLANK = True                                 # (blank posts and header for now; the ramp bare: no
        #   seams, outline or handle slots, the user)
        try:
            own, wide = fn()
            assert calls[0] == len(seq), calls[0]
            return own, wide, GLASS.build()
        finally:
            PART, T.HOOK, DR.BLANK = None, None, False
    return build
