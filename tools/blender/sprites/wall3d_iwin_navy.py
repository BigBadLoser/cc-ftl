"""Interior windows on navy (walls up; Space Haven wall style 122, windows #2772 / #2771 / #2862): its own build, not
the default's. A straight partition (mask 10, along x) opened between its posts down to the ramp's top, the pane
standing on it; between the end blocks (the ramp left standing, half a tile at each end) the ramp is cut down: a flat
sill CUT_Z under the ramp's top, its front edge where the slope falls to it, running across the wall: the pane stands
on it, and its far half shows through the glass. The same cut on the far side. The opening runs up to the header's foot.

Shared with the other windows: the hook wrapper (wall3d.HOOK on a piece's Relief), the Sutherland-Hodgman clip
(wall3d_iwin._clip), the pane's edges and the glass Relief (the "glass" render kind).
PART: "l" (the post at the -x end), "m" (open across), "r" (the post at the +x end)."""
from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .wall3d_iwin import _clip

PX = 1 / 32                 # an art px across or along the wall
POST = 11                   # px: a post, in from the window's end (the ref's 11)
END = 16                    # px: an end block, in from the window's end (the ref's 16: half a tile)
CUT_Z = 8                   # art px up: the sill under the ramp's top (the ref's cut: 8 of its 30 rows, ~30%; ours 8 of 26)
POCKETS = ((11, 34), (62, 85))  # px along the window from its -x end: the slots in the front either side of the middle
                                # panel, their outer edges in line with the posts' (the user); the panel 28 px (the
                                # ref's, edges included, read up its slope: 28-30; its red face 20), the slots 23
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


def _slope():
    """The ramp's fall per unit out from the wall's line (its sloped part: RAMP_PX art px a cell)."""
    return W.RAMP_PX / W.ZART / PX


def _zt():
    return W.skirt_top()


def _zs():
    return W.skirt_top() - CUT_Z / W.ZART


def _front():
    """The sill's front edge, from the pane: where the slope falls to it."""
    return _line() + CUT_Z / W.ZART / _slope()


def _ramp_z(y):
    """The plain ramp's top at |y| from the pane."""
    return _zt() - max(0.0, abs(y) - _line()) * _slope()


def _cells(x0, x1, c0, c1):
    """The opening along x: (xa, xb, z, sill): under an end block the wall taken down to the ramp's top; over the cut
    down to the sill, across the whole wall (the pane stands on it; its far half shows through the glass)."""
    out = []
    for xa, xb, z, sill in ((x0, c0, _zt(), False), (c0, c1, _zs(), True), (c1, x1, _zt(), False)):
        a, b = max(xa, x0), min(xb, x1)
        if b - a > 1e-9:
            out.append((a, b, z, sill))
    return out


def _cut(k, x0, x1, z1, cells):
    """Take everything over the cells' steps and under z1 (the header's foot) out over the opening."""
    yb, ye = -_front(), _front()
    inx = [(0, x0, 1), (0, x1, -1)]
    regions = [[(0, x0, -1)], [(0, x1, 1)], inx + [(1, ye, 1)], inx + [(1, yb, -1)],
               inx + [(1, yb, 1), (1, ye, -1), (2, z1, 1)]]
    for xa, xb, z, _ in cells:
        regions.append([(0, xa, 1), (0, xb, -1), (1, yb, 1), (1, ye, -1), (2, z, -1)])
    zlo = min(z for _, _, z, _ in cells)
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


def _pocket_cut(k, pa, pb):
    """Take the ramp's front out between pa and pb: everything out past the wall's line (the near side: mesh -y; the
    slot's back in line with the slope's top end, the user) over the slot's floor (the foot's top) and under the sill
    (not the header's tube, out past it high up)."""
    ye, zf, zs = -_line(), W.foot(), _zt()
    inx = [(0, pa, 1), (0, pb, -1)]
    regions = [[(0, pa, -1)], [(0, pb, 1)], inx + [(1, ye, 1)], inx + [(1, ye, -1), (2, zf, -1)],
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
    """A slot's faces: its floor out to the ramp's foot, its back at the wall's line up to the cut over it (the sill,
    or the ramp's top under an end block: the slot takes the slope there whole), its sides (the section over the
    floor). The near side: grid +y (mesh -y, as _pocket_cut works)."""
    yl, ye, zf, zs, zt, yf = _line(), _front(), W.foot(), _zs(), _zt(), 0.5
    c0, c1 = _sill(PART)
    a, b = max(pa, -0.5), min(pb, 0.5)
    if b - a < 1e-9:
        return
    _quad(k, [(a, yl, zf), (b, yl, zf), (b, yf, zf), (a, yf, zf)], (0, 0, 1), COL["p_floor"])
    for u0, u1, z in ((a, min(b, c0), zt), (max(a, c0), min(b, c1), zs), (max(a, c1), b, zt)):
        if u1 - u0 > 1e-9:
            _quad(k, [(u0, yl, zf), (u1, yl, zf), (u1, yl, z), (u0, yl, z)], (0, 1, 0), COL["p_back"])
    for u, sd in ((pa, 1), (pb, -1)):
        if not -0.5 < u < 0.5:
            continue
        if c0 - 1e-9 <= u <= c1 + 1e-9:                 # (by the sill: its height, then the slope)
            _quad(k, [(u, yl, zf), (u, ye, zf), (u, ye, zs), (u, yl, zs)], (sd, 0, 0), COL["p_side"])
            _quad(k, [(u, ye, zf), (u, yf, zf), (u, ye, zs)], (sd, 0, 0), COL["p_side"])
        else:                                           # (under an end block: the slope from its top)
            _quad(k, [(u, yl, zf), (u, yf, zf), (u, yl, zt)], (sd, 0, 0), COL["p_side"])


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
        _quad(k, [(a, -y, z), (b, -y, z), (b, y, z), (a, y, z)], (0, 0, 1), COL["sill" if sill else "top"])


def _ends(k, x0, x1, z1, cells):
    """The opening's ends: the posts' sides from the wall's top up to z1; the end blocks' sides facing the cut, from
    the sill up to the ramp's section (each in convex strips across the wall)."""
    yl, ye, zt, zs = _line(), _front(), _zt(), _zs()
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):
        if on:
            _quad(k, [(u, -yl, zt), (u, yl, zt), (u, yl, z1), (u, -yl, z1)], (sd, 0, 0), COL["post"])
    for (_, u, _, sa), (_, _, _, sb) in zip(cells, cells[1:]):
        if not -0.5 < u < 0.5:
            continue
        sd = 1 if sb else -1                            # (it faces the sill's side)
        _quad(k, [(u, -yl, zs), (u, yl, zs), (u, yl, zt), (u, -yl, zt)], (sd, 0, 0), COL["end"])
        for s_ in (1, -1):
            if s_ > 0 and any(pa - 1e-9 <= u <= pb + 1e-9 for pa, pb in _pockets_x(PART)):
                continue                                # (a slot takes the slope there)
            _quad(k, [(u, s_ * yl, zs), (u, s_ * ye, zs), (u, s_ * yl, zt)], (sd, 0, 0), COL["end"])


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
        _quad(k, [(a, -h, zl + e), (b, -h, zl + e), (b, h, zl + e), (a, h, zl + e)], (0, 0, 1), PANE_EDGE)
        _quad(k, [(a, -h, z1 - e), (b, -h, z1 - e), (b, h, z1 - e), (a, h, z1 - e)], (0, 0, -1), PANE_EDGE)
        GLASS.poly([Vector((a, 0.0, zl)), Vector((b, 0.0, zl)), Vector((b, 0.0, z1)), Vector((a, 0.0, z1))],
                   "wall", 2, Vector((0, 1, 0)), fixed="glassL")
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):
        if on:
            v = u + sd * e
            _quad(k, [(v, -h, _zt()), (v, h, _zt()), (v, h, z1), (v, -h, z1)], (sd, 0, 0), PANE_EDGE)


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
        try:
            own, wide = fn()
            assert calls[0] == len(seq), calls[0]
            return own, wide, GLASS.build()
        finally:
            PART, T.HOOK = None, None
    return build
