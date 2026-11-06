"""Interior windows on the default walls (walls up; after Space Haven's family #3168, windows #3173-#3175): a
straight partition (mask 10, along x) opened between its posts. The opening runs from the low band's top (the sill)
to the header's foot (the beam), the posts at the window's ends kept, the ones between taken out with the panels; a
glass pane in the wall's middle plane, its top edges two blue lines along the cap.

The same hook as wall3d_iwin (tan): wall3d.block calls HOOK(k, sp) on a piece's Relief before it builds.
PART: "l" (the post at the -x end, open on past +x), "m" (open across), "r" (the post at the +x end)."""
from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .wall3d_iwin import _clip

SILL_UP = 0.2           # the sill: the low band's top over the face's foot (wall3d.wall_face)
BEAM_DOWN = 0.15        # the beam's underside: the header's foot under the wall's top (wall3d.wall_face)
LINES = 3 / 32          # the pane's top edges on the cap: this apart, about the wall's middle
LINE_W = 1 / 32
LINE_COL = "fTG0"       # (blue)
POST_IN = "wM"          # the posts' sides into the opening
SILL_TOP = "wL"         # the sill's top
BEAM_UNDER = "wK"       # the beam's underside
PANE_EDGE = "fTX6"      # the pane's edges: a pane PANE_T thick, opaque, a hair proud of the frame (PANE_OUT)
PANE_T = 1 / 32
PANE_OUT = 0.003
POST_W = 9 / 32         # the end posts: this wide along the wall (the window's opening between them)
POST_SLOT = (2, 2)      # a dark slot down each post's front: this many px in from its inner edge, this wide
FOOT_H = 0.1            # each post's foot: this tall, standing PX further out, FOOT_OUT on into the opening
FOOT_OUT = 2 / 32
BEAM_OUT = T.PX         # the beam's blocks: this far proud of the header, split at the header's joints (a px gap)
AMBER = (0.5 / 32, 0.03)  # the sill's amber block under each post: this far in from the post's sides, from the ramp's
                        # ends
PART = None
GLASS = None            # the pane's Relief, built by the piece (the glass render kind's second list)


def _span(part):
    return {"l": (-0.5 + POST_W, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - POST_W)}[part]


def _quad(k, pts, out, col):
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def _cut(k, x0, x1, z0, z1):
    """Take everything between the sill (z0) and the beam (z1) out over the opening [x0, x1], both faces alike."""
    regions = [[(0, x0, -1)], [(0, x1, 1)], [(0, x0, 1), (0, x1, -1), (2, z0, -1)],
               [(0, x0, 1), (0, x1, -1), (2, z1, 1)]]
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            xs, zs = [p[0] for p in pts], [p[2] for p in pts]
            if max(xs) <= x0 + 1e-9 or min(xs) >= x1 - 1e-9 or max(zs) <= z0 + 1e-9 or min(zs) >= z1 - 1e-9:
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


def hook(k, sp, own=True):
    x0, x1 = _span(PART)
    z0, z1 = sp.zs + SILL_UP, W.HF - BEAM_DOWN
    yf = W.wall_back() - 0.5 + W.TW
    yr = yf + T.FR                                      # (the face's relief: the posts', the band's, the header's)
    _cut(k, x0, x1, z0, z1)
    a, b = max(x0, -0.5), min(x1, 0.5)
    k.side = None
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):     # the posts' sides into the opening
        if on:
            _quad(k, [(u, -yr, z0), (u, yr, z0), (u, yr, z1), (u, -yr, z1)], (sd, 0, 0), POST_IN)
    _quad(k, [(a, -yr, z0), (b, -yr, z0), (b, yr, z0), (a, yr, z0)], (0, 0, 1), SILL_TOP)      # the sill's top
    _quad(k, [(a, -yr, z1), (b, -yr, z1), (b, yr, z1), (a, yr, z1)], (0, 0, -1), BEAM_UNDER)   # the beam's underside
    _beam(k, z1)
    for u, sd, on in ((x0, -1, x0 > -0.5), (x1, 1, x1 < 0.5)):     # the end posts, their amber sill blocks
        if on:
            _post(k, u, sd, sp.zs, z0, z1, yf)
    zt = max(v[2] for v in k.m.v) + 0.002               # the pane's top edges on the cap
    for c in (-LINES / 2, LINES / 2):
        y0, y1 = -c - LINE_W / 2, -c + LINE_W / 2
        _quad(k, [(a, y0, zt), (b, y0, zt), (b, y1, zt), (a, y1, zt)], (0, 0, 1), LINE_COL)
    if not own:                                         # (a copy past the tile: no pane)
        return
    h, e = PANE_T / 2, PANE_OUT                         # the pane's edges
    _quad(k, [(a, -h, z0 + e), (b, -h, z0 + e), (b, h, z0 + e), (a, h, z0 + e)], (0, 0, 1), PANE_EDGE)
    _quad(k, [(a, -h, z1 - e), (b, -h, z1 - e), (b, h, z1 - e), (a, h, z1 - e)], (0, 0, -1), PANE_EDGE)
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):
        if on:
            v = u + sd * e
            _quad(k, [(v, -h, z0), (v, h, z0), (v, h, z1), (v, -h, z1)], (sd, 0, 0), PANE_EDGE)
    global GLASS
    GLASS = T.Relief("iwin_def_glass")
    GLASS.poly([Vector((a, 0.0, z0)), Vector((b, 0.0, z0)), Vector((b, 0.0, z1)), Vector((a, 0.0, z1))],
               "wall", 2, Vector((0, 1, 0)), fixed="glassL")


def _beam(k, z1):
    """The beam's blocks over the whole tile: the header (wall3d.wall_face) stood BEAM_OUT further out, split at its
    joints (header_marks: a long middle block, the end blocks across the tile's edges) by a px gap."""
    yf = W.wall_back() - 0.5 + W.TW
    zt = W.HF - 0.02
    cuts = [-0.5, -0.18, 0.18 - T.LINE, 0.5]
    for u0, u1 in zip(cuts, cuts[1:]):
        a = u0 + (T.LINE if u0 > -0.5 else 0.0)
        b = u1 - (0.0 if u1 >= 0.5 else 0.0)
        T.slab(k, "y", yf, a, b, z1, zt, T.FR + BEAM_OUT, "wall", 3, ends=(u0 > -0.5, u1 < 0.5))


def _post(k, u, sd, zs, z0, z1, yf):
    """An end post from the tile's edge to u (the opening's edge; sd: the way to the edge), a dark slot down its
    front, a foot; under it on the ramp an amber block."""
    e = u + sd * POST_W                                  # (the tile's edge)
    lo, hi = sorted((u, e))
    T.slab(k, "y", yf, lo, hi, z0, z1, T.FR, "wall", 3, ends=(sd < 0, sd > 0))
    s0 = u + sd * POST_SLOT[0] * T.LINE
    s1 = s0 + sd * POST_SLOT[1] * T.LINE
    T.paint(k, "y", yf, min(s0, s1), max(s0, s1), z0 + FOOT_H + 0.04, z1 - 0.06, T.FR, "wall", 0)
    f0, f1 = sorted((e, u - sd * FOOT_OUT))
    T.slab(k, "y", yf, f0, f1, z0, z0 + FOOT_H, T.FR + T.PX, "wall", 3, ends=(sd < 0, sd > 0))
    sl, run = W.GN * W.RAMP_PX / W.ZART, W.skirt_run()     # the amber block on the ramp's slope
    zr = W.skirt_top()
    a0, a1 = lo + AMBER[0], hi - AMBER[0]
    d0, d1 = AMBER[1], run - AMBER[1]
    n = Vector((0.0, sl, 1.0)).normalized()
    off = 4 * T.PAINT
    k.poly([Vector((x, yf + d, zr - d * sl)) + n * off for x, d in ((a0, d0), (a1, d0), (a1, d1), (a0, d1))],
           "ochre", 3, n)


def window(fn, part):
    """fn: the default straight piece's builder (tile.wall.full.m10, env_build "wide"). (own, wide, pane objects)."""
    calls = [0]
    seq = (part, "m" if part in "lm" else None, "m" if part in "mr" else None)  # the piece; its copies one tile on
    #   at +x, at -x (envtiles._with_runs builds them in that order): the window running on into them, else plain

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
            assert calls[0] == 3, calls[0]
            return own, wide, GLASS.build()
        finally:
            PART, T.HOOK = None, None
    return build
