"""Interior windows on navy (walls up; Space Haven wall style 122, windows #2772 / #2771 / #2862): its own build, not
the default's. A straight partition (mask 10, along x) opened between its posts down to the ramp's top, the pane
standing on it; between the end blocks (the ramp left standing, half a tile at each end) the ramp is cut down: a flat
sill level with the ramp's shelf, its front edge where the slope falls to it, running across the wall: the pane stands
on it, and its far half shows through the glass. The same cut on the far side. The opening runs up to the header's foot.

Shared with the other windows: the hook wrapper (wall3d.HOOK on a piece's Relief), the Sutherland-Hodgman clip
(wall3d_iwin._clip), the pane's edges and the glass Relief (the "glass" render kind).
PART: "l" (the post at the -x end), "m" (open across), "r" (the post at the +x end)."""
from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .faction import navy as NV
from .faction.parts import PAINT
from .wall3d_iwin import _clip

PX = 1 / 32                 # an art px across or along the wall
POST = 11                   # px: a post, in from the window's end (the ref's 11)
END = 16                    # px: an end block, in from the window's end (the ref's 16: half a tile)
SLOT_BACK = 4               # art px: a slot's floor at its back over the foot's top, sloping down to it at the front
                            # (the user)
BLOCK_UP = 5                # art px: an end block's top over the wall's top against its post, falling along the wall
                            # to the sill where the sill starts (the user)
POCKETS = ((11, 34), (62, 85))  # px along the window from its -x end: the slots in the front either side of the middle
                                # panel, their outer edges in line with the posts' (the user); the panel 28 px (the
                                # ref's, edges included, read up its slope: 28-30; its red face 20), the slots 23
WHITE, LINE_C = "fNW1", "fNW7"  # the middle block's front: a white edge either side, a plate outlined in the panel
                                # line's tone (navy's seam_tone) between (the user)
RED = "fNT2"                # the face's band (navy_band: ochre 3, its lit tone), wrapped round the posts (the user)
COL = {"sill": "fNW1", "top": "fNW2", "end": "fNW4", "post": "fNW3", "under": "fNS4",
       "p_floor": "fNW2", "p_back": "fNW3", "p_side": "fNS2"}
OFF = {"l": 0, "m": 1, "r": 2}  # a piece's tiles from the window's -x end
PANE_EDGE = "fTX6"
PANE_T = 1 / 32
PANE_OUT = 0.003
PART = None
GLASS = None


def _span(part):
    """(x0, x1): the opening, between the posts (past the tile where it runs on)."""
    p = POST * PX
    return {"l": (-0.5 + p, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - p)}[part]


def _sill(part):
    """(c0, c1): the cut, between the end blocks."""
    e = END * PX
    return {"l": (-0.5 + e, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - e)}[part]


def _line():
    """The wall's line (the ramp's top edge), from the pane (the wall's middle)."""
    return W.wall_back() - 0.5 + W.TW


def _zr(d):
    """The plain ramp's top d out from the wall's line: navy's shelf (wall3d.lip_heights), then its fall (Style.ramp_px)
    down to the foot at the run's end (shell._zsurf's)."""
    f, ft = T.ramp_fall(), W.foot()
    return max(ft, min(_zh(), ft + (W.skirt_run() - d) * f))


def _zh():
    return T.lip_heights(_zt())[0]


def _d_at(z):
    """How far out the slope is down to z (under the shelf)."""
    return W.skirt_run() - (z - W.foot()) / T.ramp_fall()


def _zt():
    return W.skirt_top()


def _zs():
    """The sill: level with navy's shelf (the user, simpler; was cut 8, 13, then 10 art px under the wall's top)."""
    return _zh()


def _front():
    """The sill's front edge, from the pane: where the slope falls to it."""
    return _line() + _d_at(_zs())


def _shelf_end():
    """The shelf's front edge, from the pane: where the slope starts."""
    return _line() + _d_at(_zh())


def _zb():
    return _zt() + BLOCK_UP / W.ZART


def _cells(x0, x1, c0, c1):
    """The opening along x: (xa, xb, z, sill), z(x) the floor: under an end block the wall taken down to a top falling
    along the wall from _zb() at its post to the sill's height where the sill starts; over the cut down to the sill,
    across the whole wall (the pane stands on it; its far half shows through the glass)."""
    zs = _zs()

    def block(xp, xe):                                  # (xp its post, xe the sill's end)
        if abs(xp - xe) < 1e-12:
            return lambda x: zs
        return lambda x: zs + (_zb() - zs) * (x - xe) / (xp - xe)
    out = []
    for xa, xb, z, sill in ((x0, c0, block(x0, c0), False), (c0, c1, lambda x: zs, True),
                            (c1, x1, block(x1, c1), False)):
        a, b = max(xa, x0), min(xb, x1)
        if b - a > 1e-9:
            out.append((a, b, z, sill))
    return out


def _under(xa, xb, z):
    """The clip plane keeping what lies under the floor z(x) between xa and xb (wall3d_iwin._side's (n, c))."""
    s = (z(xb) - z(xa)) / (xb - xa)
    return ((s, 0.0, -1.0), s * xa - z(xa))


def _cut(k, x0, x1, z1, cells):
    """Take everything over the cells' steps and under z1 (the header's foot) out over the opening."""
    yb, ye = -_front(), _front()
    inx = [(0, x0, 1), (0, x1, -1)]
    regions = [[(0, x0, -1)], [(0, x1, 1)], inx + [(1, ye, 1)], inx + [(1, yb, -1)],
               inx + [(1, yb, 1), (1, ye, -1), (2, z1, 1)]]
    for xa, xb, z, _ in cells:
        regions.append([(0, xa, 1), (0, xb, -1), (1, yb, 1), (1, ye, -1), _under(xa, xb, z)])
    zlo = min(min(z(xa), z(xb)) for xa, xb, z, _ in cells)
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            xs, ys, zs = [p[0] for p in pts], [p[1] for p in pts], [p[2] for p in pts]
            if (max(xs) <= x0 + 1e-9 or min(xs) >= x1 - 1e-9 or max(zs) <= zlo + 1e-9 or min(zs) >= z1 - 1e-9 or
                    max(ys) <= yb + 1e-9 or min(ys) >= ye - 1e-9):
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


def _pockets_x(part):
    """The slots along x in a piece's frame (past the tile where they run on)."""
    o = -0.5 - OFF[part]
    return [(o + a * PX, o + b * PX) for a, b in POCKETS]


def _slot_z(y):
    """A slot's floor |y| from the pane (grid): SLOT_BACK over the foot's top at the wall's line, down to it at the
    tile's edge."""
    yl, zf = _line(), W.foot()
    return zf + SLOT_BACK / W.ZART * (0.5 - abs(y)) / (0.5 - yl)


def _pocket_cut(k, pa, pb):
    """Take the ramp's front out between pa and pb: everything out past the wall's line (the near side: mesh -y; the
    slot's back in line with the slope's top end, the user) over the slot's floor (the foot's top) and under the sill
    (not the header's tube, out past it high up)."""
    ye, zf, zs = -_line(), W.foot(), _zt()
    inx = [(0, pa, 1), (0, pb, -1)]
    s = (_slot_z(_line()) - zf) / (0.5 - _line())                  # (the floor in mesh y: zf at -0.5, rising inward)
    floor = ((0.0, s, -1.0), -(zf + 0.5 * s))                       # (kept: under it)
    regions = [[(0, pa, -1)], [(0, pb, 1)], inx + [(1, ye, 1)], inx + [(1, ye, -1), floor],
               inx + [(1, ye, -1), (2, zs, 1)]]
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            xs, ys, zs = [p[0] for p in pts], [p[1] for p in pts], [p[2] for p in pts]
            if (max(xs) <= pa + 1e-9 or min(xs) >= pb - 1e-9 or min(ys) >= ye - 1e-9 or max(zs) <= zf + 1e-9 or
                    min(zs) >= _zt() - 1e-9):
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


def _pocket(k, pa, pb):
    """A slot's faces: its floor (_slot_z: sloped) out to the ramp's foot, its back at the wall's line up to the cut over it (the sill,
    or the ramp's top under an end block: the slot takes the slope there whole), its sides (the section over the
    floor). The near side: grid +y (mesh -y, as _pocket_cut works)."""
    yl, ye, zf, zs, zt, yf = _line(), _front(), W.foot(), _zs(), _zt(), 0.5
    c0, c1 = _sill(PART)
    a, b = max(pa, -0.5), min(pb, 0.5)
    if b - a < 1e-9:
        return
    zk, zx = _slot_z(yl), _slot_z(ye)                   # (the floor at the back, and under the sill's front edge)
    _quad(k, [(a, yl, zk), (b, yl, zk), (b, yf, zf), (a, yf, zf)], (0, 0, 1), COL["p_floor"])
    for u0, u1, z in ((a, min(b, c0), zt), (max(a, c0), min(b, c1), zs), (max(a, c1), b, zt)):
        if u1 - u0 > 1e-9:
            _quad(k, [(u0, yl, zk), (u1, yl, zk), (u1, yl, z), (u0, yl, z)], (0, 1, 0), COL["p_back"])
    for u, sd in ((pa, 1), (pb, -1)):
        if not -0.5 < u < 0.5:
            continue
        if c0 - 1e-9 <= u <= c1 + 1e-9:                 # (by the sill: its height, then the slope)
            _quad(k, [(u, yl, zk), (u, ye, zx), (u, ye, zs), (u, yl, zs)], (sd, 0, 0), COL["p_side"])
            _quad(k, [(u, ye, zx), (u, yf, zf), (u, ye, zs)], (sd, 0, 0), COL["p_side"])
        else:                                           # (under an end block: the ramp's section, shelf and slope)
            _quad(k, [(u, yl, zk), (u, yf, zf), (u, _shelf_end(), _zh()), (u, yl, _zh())], (sd, 0, 0), COL["p_side"])


def _plate(k):
    """The middle block's front (the ramp's slope between the slots): 2 px white down either side, sill to foot; between
    them a plate outlined 1 px in the panel line's tone, its top at the sill (the shelf's edge), its bottom at the toe."""
    o = -0.5 - OFF[PART]
    m0, m1 = o + POCKETS[0][1] * PX, o + POCKETS[1][0] * PX
    if m1 <= -0.5 or m0 >= 0.5:
        return
    f, yl, run = T.ramp_fall(), _line(), W.skirt_run()
    d0, d1 = _d_at(_zh()), run - PX                     # (the slope's top, the toe's top)
    t = 1.5 / (16 + f * W.ZART)                         # (1.5 screen px down the slope (16 a unit across, f*ZART
    #   down): at 1 the line straddled two rows and dashed)
    n = Vector((0.0, f, 1.0)).normalized()

    def strip(u0, u1, da, db, col):
        u0, u1 = max(u0, -0.5), min(u1, 0.5)
        if u1 - u0 > 1e-9:
            k.poly([Vector((u, yl + d, _zr(d))) + n * 3 * PAINT for u, d in ((u0, da), (u1, da), (u1, db), (u0, db))],
                   "wall", 2, n, fixed=col)
    a, b = m0 + 2 * PX, m1 - 2 * PX
    strip(m0, a, d0, run, WHITE)
    strip(b, m1, d0, run, WHITE)
    strip(a, a + PX, d0, d1, LINE_C)
    strip(b - PX, b, d0, d1, LINE_C)
    strip(a, b, d0, d0 + t, LINE_C)
    strip(a, b, d1 - t, d1, LINE_C)


def _quad(k, pts, out, col):
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def _tops(k, cells):
    """The cut's floors: the sill across the wall between the end blocks, the wall's top (between its lines) over an
    end block."""
    for xa, xb, z, sill in cells:
        a, b = max(xa, -0.5), min(xb, 0.5)
        if b - a < 1e-9:
            continue
        y = _front() if sill else _line()
        _quad(k, [(a, -y, z(a)), (b, -y, z(b)), (b, y, z(b)), (a, y, z(a))], (0, 0, 1), COL["sill" if sill else "top"])


def _ends(k, x0, x1, z1, cells):
    """The opening's ends: the posts' sides from the end block's top up to z1; the end blocks' sides facing the cut
    out past the wall, from the sill up to the ramp's section (each in convex strips across the wall; between the
    wall's lines a block's top falls to the sill there: no side)."""
    yl, ye, zs = _line(), _front(), _zs()
    zr, yr = z1 - 0.33 * (_wall_top() - _zt()), yl + 2.5 * PAINT     # (the band: navy_band's height, out over the
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):       # cover and the band's depth)
        if on:
            _quad(k, [(u, -yl, _zb()), (u, yl, _zb()), (u, yl, zr), (u, -yl, zr)], (sd, 0, 0), COL["post"])
            _quad(k, [(u, -yr, zr), (u, yr, zr), (u, yr, z1), (u, -yr, z1)], (sd, 0, 0), RED)
    for (_, u, _, sa), (_, _, _, sb) in zip(cells, cells[1:]):
        if not -0.5 < u < 0.5:
            continue
        sd = 1 if sb else -1                            # (it faces the sill's side)
        for s_ in (1, -1):
            if s_ > 0 and any(pa - 1e-9 <= u <= pb + 1e-9 for pa, pb in _pockets_x(PART)):
                continue                                # (a slot takes the slope there)
            _quad(k, [(u, s_ * yl, zs), (u, s_ * ye, zs), (u, s_ * _shelf_end(), _zh()), (u, s_ * yl, _zh())],
                  (sd, 0, 0), COL["end"])                # (the ramp's section over the sill: slope, then shelf)


def hook(k, sp, own=True):
    x0, x1 = _span(PART)
    c0, c1 = _sill(PART)
    z1 = _header_foot()
    cells = _cells(x0, x1, c0, c1)
    k.side = None
    _cut(k, x0, x1, z1, cells)
    _tops(k, cells)
    _ends(k, x0, x1, z1, cells)
    for pa, pb in _pockets_x(PART):
        _pocket_cut(k, pa, pb)
        _pocket(k, pa, pb)
    _plate(k)
    a, b = max(x0, -0.5), min(x1, 0.5)
    yl = _line()
    _quad(k, [(a, -yl, z1), (b, -yl, z1), (b, yl, z1), (a, yl, z1)], (0, 0, -1), COL["under"])
    if not own:                                         # (a copy past the tile: no pane)
        return
    h, e = PANE_T / 2, PANE_OUT                         # the pane's edges, its foot on each cell's floor
    global GLASS
    GLASS = T.Relief("iwin_navy_glass")
    for xa, xb, zl, _ in cells:
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
            _quad(k, [(v, -h, _zb()), (v, h, _zb()), (v, h, z1), (v, -h, z1)], (sd, 0, 0), PANE_EDGE)


def _wall_top():
    return W.wall_top("wall", "up")


def _header_foot():
    """The dark header's foot (faction.navy: a quarter of the wall's height under its top, on a partition's height)."""
    zs = W.skirt_top()
    rt = W.wall_top("wall", "up")
    return rt - 0.25 * (rt - zs)


def window(fn, part):
    """fn: navy's straight piece builder (tile.wall.navy.full.m10). (own, wide, pane objects)."""
    calls = [0]
    seq = (part, {"m": "l", "r": "m"}.get(part))       # the piece; its copy one tile on at -x (envtiles._with_runs
    #   builds only the runs drawn before it): the window's tile there, else plain

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
        NV.SEAMLESS = True                              # (no seams on a window's pieces: the user)
        try:
            own, wide = fn()
            assert calls[0] == len(seq), calls[0]
            return own, wide, GLASS.build()
        finally:
            PART, T.HOOK, NV.SEAMLESS = None, None, False
    return build
