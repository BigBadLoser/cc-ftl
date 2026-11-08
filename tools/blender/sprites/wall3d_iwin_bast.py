"""Interior windows on bastion (walls up; Space Haven wall style 3295, windows #3296 / #3297 / #3298): its own build,
not the default's. A straight partition (mask 10, along x) opened between its posts down to a channel under the pane:
from the pane out, a ledge the pane stands on, a step down to the channel's floor, a dark groove, and the front's lit
rim, which runs out onto the ramp's slope (the ramp under it kept). The same channel on the far side. The opening runs
up to the cornice's foot.

Shared with the other windows: the hook wrapper (wall3d.HOOK on a piece's Relief), the Sutherland-Hodgman clip
(wall3d_iwin._clip), the pane's edges, the glass Relief (the "glass" render kind) and the two blue lines on the cap.
PART: "l" (the post at the -x end), "m" (open across), "r" (the post at the +x end)."""
from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .faction.bastion import BAST_HB, BAST_P, darker
from .faction.parts import PZ
from .wall3d_iwin import _clip

PX = 1 / 32                 # an art px across or along the wall
LEDGE = 3                   # px: the ledge either side of the pane (its top LEDGE_Z PZ under the ramp's top)
LEDGE_Z = -6
FLOOR = 6                   # px from the pane: the channel's floor runs out to here (FLOOR_Z) ...
FLOOR_Z = -9
GROOVE = 7                  # ... then the groove (GROOVE_Z) ...
GROOVE_Z = -11
RIM = 10                    # ... then the front's top (RIM_Z) out to here, an upright face (FRONT) down from its edge
RIM_Z = -9                  #   to the ramp's slope (the ref's proportions: 3 : 4 : 1.5 : 4 px, ~12 deep, all within
                            #   ~2 px of one height; ours 10 deep, on a ramp twice the ref's height)
COL = {"far": "fBW5", "ledge": "fBW2", "step": "fBW4", "floor": "fBW7", "groove": "fBW6", "rim": "fBW0", "front": "fBW8",
       "end": darker("fBW2"),
       "under": "fBW5"}
LINES = 3 / 32              # the pane's top edges on the cap: this apart, about the wall's middle
LINE_W = 1 / 32
LINE_COL = "fTG0"           # (blue)
PANE_EDGE = "fTX6"
PANE_T = 1 / 32
PANE_OUT = 0.003
PART = None
GLASS = None


def _span(part):
    return {"l": (-0.5 + BAST_P, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - BAST_P)}[part]


def _line():
    """The wall's line (the ramp's top edge), from the pane (the wall's middle)."""
    return W.wall_back() - 0.5 + W.TW


def _slope():
    """The ramp's fall per unit out from the wall's line."""
    return W.skirt_top() / W.skirt_run()


def _rim_out():
    """The front's top edge, from the pane."""
    return RIM * PX


def _ramp_z(y):
    """The plain ramp's top at |y| from the pane (its slope past the wall's line)."""
    return W.skirt_top() - max(0.0, abs(y) - _line()) * _slope()


def _steps():
    """The channel's floor across the wall: (y0, y1, z, kind), y from -rim_out to rim_out (the far side mirrored, its
    parts kind "far": seen only through the glass, one flat tone, or they showed as more stripes over the ledge)."""
    zs, ye = W.skirt_top(), _rim_out()
    near = [(LEDGE * PX, FLOOR * PX, zs + FLOOR_Z * PZ, "floor"), (FLOOR * PX, GROOVE * PX, zs + GROOVE_Z * PZ, "groove"),
            (GROOVE * PX, ye, zs + RIM_Z * PZ, "rim")]
    return ([(-y1, -y0, z, "far") for y0, y1, z, _ in reversed(near)] +
            [(-LEDGE * PX, LEDGE * PX, zs + LEDGE_Z * PZ, "ledge")] + near)


def _cut(k, x0, x1, z1):
    """Take everything over the channel's floor and under z1 (the cornice's foot) out over the opening."""
    yb, ye = -_rim_out(), _rim_out()
    inx = [(0, x0, 1), (0, x1, -1)]
    regions = [[(0, x0, -1)], [(0, x1, 1)], inx + [(1, ye, 1)], inx + [(1, yb, -1)],
               inx + [(1, yb, 1), (1, ye, -1), (2, z1, 1)]]
    regions += [inx + [(1, y0, 1), (1, y1, -1), (2, z, -1)] for y0, y1, z, _ in _steps()]
    zlo = min(z for _, _, z, _ in _steps())
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


def _section_top(y, z1):
    """The plain wall's section at a post's side, y across the wall: its top (the post and the body behind it up to
    z1; the ramp's top and slope past the lower wall's front)."""
    yl = _line()
    if abs(y) <= yl - 2 * PX + 1e-9 or y < 0 and abs(y) <= yl + 1e-9:
        return z1
    return _ramp_z(y)


def _ends(k, x0, x1, z1):
    """The opening's ends, in strips across the wall (each convex): the posts' sides down through the channel's
    section where the plain wall stands over the channel, and the channel's block's own ends where it stands over
    the plain ramp (its front past where the slope falls under it)."""
    yl = _line()
    br = sorted({y for y0, y1, _, _ in _steps() for y in (y0, y1)} | {yl - 2 * PX, yl, -yl} |
                {yl + (W.skirt_top() - z) / _slope() for _, _, z, kd in _steps() if kd == "rim"})
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):
        if not on:
            continue
        for y0, y1 in zip(br, br[1:]):
            ym = (y0 + y1) / 2
            z = next(z for a, b, z, _ in _steps() if a - 1e-9 <= ym <= b + 1e-9)
            t0, t1 = _section_top(y0 + 1e-6, z1), _section_top(y1 - 1e-6, z1)
            if min(t0, t1) >= z - 1e-9 and max(t0, t1) > z + 1e-9:
                _quad(k, [(u, y0, z), (u, y1, z), (u, y1, t1), (u, y0, t0)], (sd, 0, 0), COL["end"])
            elif max(t0, t1) <= z + 1e-9 and min(t0, t1) < z - 1e-9:
                _quad(k, [(u, y0, t0), (u, y1, t1), (u, y1, z), (u, y0, z)], (-sd, 0, 0), COL["end"])


def _channel(k, a, b):
    """The channel's surfaces between a and b: the floors (tops), and the steps between them (faces across)."""
    st = _steps()
    for y0, y1, z, kind in st:
        _quad(k, [(a, y0, z), (b, y0, z), (b, y1, z), (a, y1, z)], (0, 0, 1), COL[kind])
    for (_, y, za, ka), (_, _, zb, kb) in zip(st, st[1:]):     # (the step at y between two floors: it faces the
        if abs(za - zb) < 1e-9:                                 # lower one)
            continue
        lo, hi = min(za, zb), max(za, zb)
        sd = 1 if zb < za else -1
        col = COL["far"] if y < 0 else COL["step"] if "ledge" in (ka, kb) else COL["groove"]
        _quad(k, [(a, y, lo), (b, y, lo), (b, y, hi), (a, y, hi)], (0, sd, 0), col)
    zr = W.skirt_top() + RIM_Z * PZ                     # the front's upright face, down from its top edge to the
    y = _rim_out()                                      # slope
    _quad(k, [(a, y, _ramp_z(y)), (b, y, _ramp_z(y)), (b, y, zr), (a, y, zr)], (0, 1, 0), COL["front"])


def hook(k, sp, own=True):
    x0, x1 = _span(PART)
    z1 = W.HF - BAST_HB                                 # (the cornice's foot)
    k.side = None
    _cut(k, x0, x1, z1)
    a, b = max(x0, -0.5), min(x1, 0.5)
    _channel(k, a, b)
    _ends(k, x0, x1, z1)
    yl = _line()
    _quad(k, [(a, -yl, z1), (b, -yl, z1), (b, yl + PX, z1), (a, yl + PX, z1)], (0, 0, -1), COL["under"])
    zt = max(v[2] for v in k.m.v) + 0.002               # the pane's top edges on the cap
    for c in (-LINES / 2, LINES / 2):
        y0, y1 = -c - LINE_W / 2, -c + LINE_W / 2
        _quad(k, [(a, y0, zt), (b, y0, zt), (b, y1, zt), (a, y1, zt)], (0, 0, 1), LINE_COL)
    if not own:                                         # (a copy past the tile: no pane)
        return
    zl = W.skirt_top() + LEDGE_Z * PZ
    h, e = PANE_T / 2, PANE_OUT                         # the pane's edges
    _quad(k, [(a, -h, zl + e), (b, -h, zl + e), (b, h, zl + e), (a, h, zl + e)], (0, 0, 1), PANE_EDGE)
    _quad(k, [(a, -h, z1 - e), (b, -h, z1 - e), (b, h, z1 - e), (a, h, z1 - e)], (0, 0, -1), PANE_EDGE)
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):
        if on:
            v = u + sd * e
            _quad(k, [(v, -h, zl), (v, h, zl), (v, h, z1), (v, -h, z1)], (sd, 0, 0), PANE_EDGE)
    global GLASS
    GLASS = T.Relief("iwin_bast_glass")
    GLASS.poly([Vector((a, 0.0, zl)), Vector((b, 0.0, zl)), Vector((b, 0.0, z1)), Vector((a, 0.0, z1))],
               "wall", 2, Vector((0, 1, 0)), fixed="glassL")


def window(fn, part):
    """fn: bastion's straight piece builder (tile.wall.bastion.full.m10). (own, wide, pane objects)."""
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
