"""Interior windows on navy (walls up; Space Haven wall style 122, windows #2772 / #2771 / #2862): its own build, not
the default's. A straight partition (mask 10, along x) opened between its posts down to the ramp's top, the pane
standing on it; between the end blocks (the ramp left standing, half a tile at each end) the ramp is cut down: a flat
sill CUT_Z under the ramp's top, its front edge where the slope falls to it, its back a face rising to the pane's
ledge. The same cut on the far side. The opening runs up to the header's foot.

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
BACK = 1                    # px: the sill's back face, from the pane (its flat top runs from here out to the front)
COL = {"sill": "fNW1", "back": "fNW3", "ledge": "fNW2", "end": "fNW4", "post": "fNW3", "far": "fNS3",
       "under": "fNS4"}
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
    """The opening along x: (xa, xb, steps), steps (y0, y1, z) across the wall: under an end block the wall taken
    down to the ramp's top; over the cut the sill either side of the pane's ledge."""
    ye, yb, zt, zs = _front(), BACK * PX, _zt(), _zs()
    sill = [(-ye, -yb, zs), (-yb, yb, zt), (yb, ye, zs)]
    block = [(-ye, ye, zt)]
    out = []
    for xa, xb, st in ((x0, c0, block), (c0, c1, sill), (c1, x1, block)):
        a, b = max(xa, x0), min(xb, x1)
        if b - a > 1e-9:
            out.append((a, b, st))
    return out


def _cut(k, x0, x1, z1, cells):
    """Take everything over the cells' steps and under z1 (the header's foot) out over the opening."""
    yb, ye = -_front(), _front()
    inx = [(0, x0, 1), (0, x1, -1)]
    regions = [[(0, x0, -1)], [(0, x1, 1)], inx + [(1, ye, 1)], inx + [(1, yb, -1)],
               inx + [(1, yb, 1), (1, ye, -1), (2, z1, 1)]]
    for xa, xb, st in cells:
        regions += [[(0, xa, 1), (0, xb, -1), (1, y0, 1), (1, y1, -1), (2, z, -1)] for y0, y1, z in st]
    zlo = min(z for _, _, st in cells for _, _, z in st)
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


def _quad(k, pts, out, col):
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def _tops(k, cells):
    """The cut's floors: the sill's flat tops, the pane's ledge, the wall's top over an end block; and the sill's back
    faces up to the ledge."""
    yb, zt, zs = BACK * PX, _zt(), _zs()
    for xa, xb, st in cells:
        a, b = max(xa, -0.5), min(xb, 0.5)
        if b - a < 1e-9:
            continue
        for y0, y1, z in st:
            kind = "sill" if z < zt - 1e-9 else "ledge"
            if kind == "ledge" and len(st) == 1:        # (over an end block: the wall's top, between its lines)
                y0, y1 = -_line(), _line()
            _quad(k, [(a, y0, z), (b, y0, z), (b, y1, z), (a, y1, z)], (0, 0, 1),
                  COL["far"] if kind == "sill" and y1 <= 0 else COL[kind])
        if len(st) > 1:
            for y, sd in ((yb, 1), (-yb, -1)):
                _quad(k, [(a, y, zs), (b, y, zs), (b, y, zt), (a, y, zt)], (0, sd, 0), COL["back" if sd > 0 else "far"])


def _ends(k, x0, x1, z1, cells):
    """The opening's ends: the posts' sides from the wall's top up to z1; the end blocks' sides facing the cut, from
    the sill up to the ramp's section (each in convex strips across the wall)."""
    yl, ye, yb, zt, zs = _line(), _front(), BACK * PX, _zt(), _zs()
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):
        if on:
            _quad(k, [(u, -yl, zt), (u, yl, zt), (u, yl, z1), (u, -yl, z1)], (sd, 0, 0), COL["post"])
    for (xa, xb, sa), (_, _, sb) in zip(cells, cells[1:]):
        u = xb
        if not -0.5 < u < 0.5:
            continue
        sd = 1 if len(sb) > 1 else -1                   # (it faces the sill's side)
        for s in (1, -1):
            col = COL["end"] if s > 0 else COL["far"]
            _quad(k, [(u, s * yb, zs), (u, s * yl, zs), (u, s * yl, zt), (u, s * yb, zt)], (sd, 0, 0), col)
            _quad(k, [(u, s * yl, zs), (u, s * ye, zs), (u, s * yl, zt)], (sd, 0, 0), col)


def hook(k, sp, own=True):
    x0, x1 = _span(PART)
    c0, c1 = _sill(PART)
    z1 = _header_foot()
    cells = _cells(x0, x1, c0, c1)
    k.side = None
    _cut(k, x0, x1, z1, cells)
    _tops(k, cells)
    _ends(k, x0, x1, z1, cells)
    a, b = max(x0, -0.5), min(x1, 0.5)
    yl = _line()
    _quad(k, [(a, -yl, z1), (b, -yl, z1), (b, yl, z1), (a, yl, z1)], (0, 0, -1), COL["under"])
    if not own:                                         # (a copy past the tile: no pane)
        return
    zl = _zt()
    h, e = PANE_T / 2, PANE_OUT                         # the pane's edges
    _quad(k, [(a, -h, zl + e), (b, -h, zl + e), (b, h, zl + e), (a, h, zl + e)], (0, 0, 1), PANE_EDGE)
    _quad(k, [(a, -h, z1 - e), (b, -h, z1 - e), (b, h, z1 - e), (a, h, z1 - e)], (0, 0, -1), PANE_EDGE)
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):
        if on:
            v = u + sd * e
            _quad(k, [(v, -h, zl), (v, h, zl), (v, h, z1), (v, -h, z1)], (sd, 0, 0), PANE_EDGE)
    global GLASS
    GLASS = T.Relief("iwin_navy_glass")
    GLASS.poly([Vector((a, 0.0, zl)), Vector((b, 0.0, zl)), Vector((b, 0.0, z1)), Vector((a, 0.0, z1))],
               "wall", 2, Vector((0, 1, 0)), fixed="glassL")


def _header_foot():
    """The dark header's foot (faction.navy: a quarter of the wall's height under its top, on a partition's height)."""
    zs = W.skirt_top()
    rt = W.wall_top("wall", "up")
    return rt - 0.25 * (rt - zs)


def window(fn, part):
    """fn: navy's straight piece builder (tile.wall.navy.full.m10). (own, wide, pane objects)."""
    calls = [0]
    seq = (part, "m" if part in "mr" else None)        # the piece; its copy one tile on at -x (envtiles._with_runs
    #   builds only the runs drawn before it): the window running on into it, else plain

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
