"""Interior windows on slate (walls up; Space Haven wall style 44, windows #2757 / #115 / #2861): the default walls'
window (wall3d_iwin_def: the opening, sill, beam, pane) and on its ramp the ref's lower layer: under the opening the
ramp's front grey (its blue plate only under the posts), recessed pockets in it (one on an end tile, two on a middle
one), their floors lit. A first blockout; the default window takes this ramp over once it is right.

PART: "l" (the post at the -x end), "m" (open across), "r" (the post at the +x end), as wall3d_iwin_def."""
from mathutils import Vector

from . import core
from . import wall3d as T
from . import walls as W
from . import wall3d_iwin_def as D
from .faction import slate as S
from .faction.parts import PAINT, PZ
from .wall3d_iwin import _clip

L = 1 / 32                              # an art px along the wall
POCKETS = {"l": ((18, 28),), "m": ((2, 14), (17, 29)), "r": ((3, 13),)}   # px from the tile's start: each pocket
RIBS = {"m": ((15, 16),)}               # px: a rib between pockets cut upright, its face under the pockets' top edge
POCKET_TOP = 3                          # its top this many px under the sill's level top
POCKET_FOOT = 1                         # its floor this many px over the ramp's foot (so it runs RAISE px deeper)
POCKET_IN = 4 / 32                      # how far it runs back into the ramp, from the slope at its top
FLOOR_RISE = 2                          # px its floor climbs from the ramp's front to its back
FLOOR_LIT = {"l": "fGS0", "m": "fGS0", "r": "fGS0"}   # its floor: lit grey ...
FLOOR_PAINT = {"m": "fGT1"}             # ... on the middle tile a block of the slope's blue painted on it, ...
PAINT_SIDE, PAINT_BACK = 4, 3           # ... this many px in from each side and from its back (top) edge
FLOOR_SHADE = "fGS2"                    # its floor under the pocket's roof (from its back to the roof's edge): shade
PAINT_SHADE = "fGT3"                    # ... and the paint block there
BACK = "fGT6"                           # its back (dark navy)
SIDE = "fGS4"                           # its sides
GREY = "fGW2"                           # the ramp's front under the opening, in place of the blue plate: the slope's
                                        # tone over it
TOE = "fGS2"                            # under the opening the ramp from the pockets' floors down (the toe)
PLATES = {"l": ((21, 28),), "m": ((10, 22),), "r": ((4, 14),)}   # px: dark metal plates wrapped over the sill's
                                        # front edge: ref 44's three, on screen (at its edge they measure l 24 - m 2,
                                        # m 16-28, r 10-20; ours stands further back than its pockets, so 6 px toward
                                        # -x; l's from the dip's foot); the lighter stretches between are the floor
PLATE_D = 6                             # px back over the sill's top from its front edge ...
PLATE_DN = 2                            # ... and PZ down the face over the pockets past it
PLATE = "fGS2"                          # its top (the vertical wall's greys: its face fGS3, fGS2) ...
PLATE_FRONT = "fGS3"                    # ... its front, down the face
BLOCK = 13                              # px: the blue end blocks under the posts run this far in from the run's ends
END_STRIP = 3                           # px: the strip closing the joined end under the floor's edge
SHADOW = 3                              # px: the rail's shadow band under the header (its lowest px shows)
LIT_UNDER = 1                           # px: the stripe's lit top kept under the header's dark edge over the window
BLUE = "ochre"                          # (the trim's: the stripe's, faction.slate.BLUE)
PANEL = 0.25                            # the plate's seam panel: the middle half of a tile (faction.slate.slate_plate)
DIP = 0                                 # px past the post where the sill's crest starts down (the ref's: on screen over
                                        # the end pocket's outer edge; the crest stands further back, so 0 here)
SLOPE = 9                               # px: the sill's crest from there down to the window's floor
RAISE = 3                               # px the window's floor (the sill's level top) stands over the default's


def _k():
    return W.GN * W.RAMP_PX / W.ZART


def _slope_y(z, yf):
    """The near ramp's slope: how far out (grid y) it is at height z."""
    return yf + W.skirt_run() - (z - W.foot()) / _k()


def _split_x(m, xs):
    """Split every polygon of mesh m at the planes x = xs (mesh space: x as grid x)."""
    for x in xs:
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            lo, hi = min(p[0] for p in pts), max(p[0] for p in pts)
            if not (lo < x - 1e-9 and hi > x + 1e-9):
                out.append(f)
                continue
            for pl in ((0, x, -1), (0, x, 1)):
                q = _clip(pts, [pl])
                if len(q) < 3:
                    continue
                base = len(m.v)
                m.v += [tuple(p) for p in q]
                out.append((list(range(base, base + len(q))),) + tuple(f[1:]))
        m.f = out


def _carve(m, x0, x1, ya, yb, z0, z1):
    """Take the box x0..x1, ya..yb (mesh space y), z0..z1 out of mesh m (what is left of a polygon, in pieces)."""
    ix = [(0, x0, 1), (0, x1, -1)]
    iy = ix + [(1, ya, 1), (1, yb, -1)]
    regions = [[(0, x0, -1)], [(0, x1, 1)], ix + [(1, ya, -1)], ix + [(1, yb, 1)],
               iy + [(2, z0, -1)], iy + [(2, z1, 1)]]
    out = []
    for f in m.f:
        pts = [m.v[i] for i in f[0]]
        if (max(p[0] for p in pts) <= x0 + 1e-9 or min(p[0] for p in pts) >= x1 - 1e-9 or
                max(p[1] for p in pts) <= ya + 1e-9 or min(p[1] for p in pts) >= yb - 1e-9 or
                max(p[2] for p in pts) <= z0 + 1e-9 or min(p[2] for p in pts) >= z1 - 1e-9):
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


def detail(k, part):
    x0, x1 = D._span(part)
    a, b = max(x0 + BLOCK * L - D.POST, -0.5), min(x1 - BLOCK * L + D.POST, 0.5)   # (between the end blocks)
    yf = W.wall_back() - 0.5 + W.TW
    zf = D._dip()[1]                                    # (the sill's level top: its floor)
    m = k.m
    _split_x(m, [u for u in (a, b) if -0.5 < u < 0.5])
    blues = {tuple(round(c, 5) for c in core.lin(f"fGT{s}")) for s in "0123456sw"}
    grey = m._cols(GREY)                                # the ramp's front under the opening grey: its blue plate's
    for i, f in enumerate(m.f):                         # polygons there (near side: mesh y < 0) take the grey
        pts = [m.v[j] for j in f[0]]
        cx = sum(p[0] for p in pts) / len(pts)
        c = tuple(round(v, 5) for v in f[2])
        if (a < cx < b and max(p[1] for p in pts) < -yf + 1e-6 and c in blues and
                max(p[2] for p in pts) <= W.skirt_top() + 1e-6):     # (the ramp's only: not the header's rail)
            m.f[i] = (f[0],) + grey
    if part in "lm":                                    # the run goes on at +x: the wall's end there open under the
        h = D._sill(0.5, x0, x1)                        # sill (it shows inside, dark): a strip under the floor's edge
        v = yf + (W.skirt_top() - h) / _k()             # there in its tone (across the floor, 3 px down), so the
        u = 0.5 - 1e-4                                  # floor's px on that edge stay the floor's; the next piece
        _quad(k, [(u, -v, h - END_STRIP * PZ), (u, v, h - END_STRIP * PZ), (u, v, h), (u, -v, h)], (1, 0, 0),
              D.SILL_TOP)                               # paints over the rest
    if any(-PANEL < u < PANEL for u in (a, b)):         # the plate's seam panel (the middle half of a tile) cut by
        seam = {tuple(round(c, 5) for c in core.lin(s)) for s in ("fGT2", "fGTs")}   # an end block's edge: gone
        m.f = [f for f in m.f if not (tuple(round(c, 5) for c in f[2]) in seam and
                                      all(-PANEL - 1e-6 < m.v[j][0] < PANEL + 1e-6 and m.v[j][1] < -yf + 1e-6 and
                                          m.v[j][2] <= W.skirt_top() + 1e-6 for j in f[0]))]
    zt = W.foot() + POCKET_FOOT * PZ                    # the toe: the near ramp under the opening from the pockets'
    toe = m._cols(TOE)                                  # floors' front edge down, a tone of its own
    out = []
    for f in m.f:
        pts = [m.v[j] for j in f[0]]
        cx = sum(p[0] for p in pts) / len(pts)
        if not (a < cx < b and max(p[1] for p in pts) < -yf + 1e-6 and min(p[2] for p in pts) < zt - 1e-9):
            out.append(f)
            continue
        for pl, col in (((2, zt, -1), toe), ((2, zt, 1), tuple(f[1:]))):
            q = _clip(pts, [pl])
            if len(q) < 3:
                continue
            base = len(m.v)
            m.v += [tuple(p) for p in q]
            out.append((list(range(base, base + len(q))),) + col)
    m.f = out
    ye = yf + (W.skirt_top() - zf) / _k()               # the plates: the sill's front edge (its level top meets
    e = 3 * T.PAINT                                     # the ramp), a hair proud of it and of its lit edge
    n = Vector((0, _k(), 1)).normalized() * e
    yd = ye + PLATE_DN * PZ / _k()
    for p0, p1 in PLATES.get(part, ()):                 # (on both sides of the wall: the far one mirrored)
        u0, u1 = -0.5 + p0 * L, -0.5 + (p1 + 1) * L
        for sg in (1, -1):
            _quad(k, [(u0, sg * (ye - PLATE_D * L), zf + e), (u1, sg * (ye - PLATE_D * L), zf + e),
                      (u1, sg * ye, zf + e), (u0, sg * ye, zf + e)], (0, 0, 1), PLATE)
            _quad(k, [(u0, sg * (ye + n.y), zf + n.z), (u1, sg * (ye + n.y), zf + n.z),
                      (u1, sg * (yd + n.y), zf - PLATE_DN * PZ + n.z), (u0, sg * (yd + n.y), zf - PLATE_DN * PZ + n.z)],
                  (0, sg * _k(), 1), PLATE_FRONT)
    z0, z1 = W.foot() + POCKET_FOOT * PZ, zf - POCKET_TOP * PZ   # (a pocket's floor at the front, its top)
    yb = _slope_y(z1, yf) - POCKET_IN                   # (its back, grid y)
    y0, y1 = _slope_y(z0, yf), _slope_y(z1, yf)         # (the slope at its floor, at its top)
    zb = z0 + FLOOR_RISE * PZ                           # (the floor's back edge: it slopes up into the ramp)

    def fl(y):                                          # the floor's height at y
        return z0 + (zb - z0) * (y0 - y) / (y0 - yb)
    ribs = [(-0.5 + r0 * L, -0.5 + (r1 + 1) * L) for r0, r1 in RIBS.get(part, ())]
    edges = {u for r in ribs for u in r}
    for u0, u1 in ribs:                                 # a rib: upright at y1 over the floor run on under it
        _carve(m, u0, u1, -(y0 + 0.05), -y1, z0, z1)
        _quad(k, [(u0, y1, fl(y1)), (u1, y1, fl(y1)), (u1, y0, z0), (u0, y0, z0)], (0, zb - z0, y0 - yb),
              FLOOR_LIT[part])
        _quad(k, [(u0, y1, fl(y1)), (u1, y1, fl(y1)), (u1, y1, z1), (u0, y1, z1)], (0, 1, 0), GREY)
    for p0, p1 in POCKETS[part]:                        # the pockets
        u0, u1 = -0.5 + p0 * L, -0.5 + (p1 + 1) * L
        _carve(m, u0, u1, -(y0 + 0.05), -yb, z0, z1)
        _quad(k, [(u0, yb, zb), (u1, yb, zb), (u1, y1, fl(y1)), (u0, y1, fl(y1))], (0, zb - z0, y0 - yb), FLOOR_SHADE)
        _quad(k, [(u0, y1, fl(y1)), (u1, y1, fl(y1)), (u1, y0, z0), (u0, y0, z0)], (0, zb - z0, y0 - yb), FLOOR_LIT[part])
        _quad(k, [(u0, yb, zb), (u1, yb, zb), (u1, yb, z1), (u0, yb, z1)], (0, 1, 0), BACK)
        for u, sd in ((u0, 1), (u1, -1)):
            if any(abs(u - e) < 1e-9 for e in edges):   # (on a rib: its side only behind the rib's face)
                _quad(k, [(u, yb, zb), (u, y1, fl(y1)), (u, y1, z1), (u, yb, z1)], (sd, 0, 0), SIDE)
            else:
                _quad(k, [(u, yb, zb), (u, y0, z0), (u, y1, z1), (u, yb, z1)], (sd, 0, 0), SIDE)
        _quad(k, [(u0, yb, z1), (u1, yb, z1), (u1, y1, z1), (u0, y1, z1)], (0, 0, -1), SIDE)
    if part in FLOOR_PAINT:                             # the paint block (after the carving): one across the floor,
        nf = Vector((0, zb - z0, y0 - yb)).normalized() * 2 * T.PAINT   # the pockets' and in front of the ribs, a
        #   hair proud
        ps = POCKETS[part]
        g0, g1 = -0.5 + ps[0][0] * L + PAINT_SIDE * L, -0.5 + (ps[-1][1] + 1) * L - PAINT_SIDE * L
        yp = yb + PAINT_BACK * L
        spans = [(-0.5 + p0 * L, -0.5 + (p1 + 1) * L, yp) for p0, p1 in ps] + [(u0, u1, y1) for u0, u1 in ribs]
        for v0, v1, ya in spans:
            v0, v1 = max(v0, g0), min(v1, g1)
            if v1 > v0:                                 # (under the pocket's roof in the shade's blue)
                for ys, ye2, col in ((ya, min(y1, y0), PAINT_SHADE), (max(ya, y1), y0, FLOOR_PAINT[part])):
                    if ye2 > ys:
                        _quad(k, [(v0, ys + nf.y, fl(ys) + nf.z), (v1, ys + nf.y, fl(ys) + nf.z),
                                  (v1, ye2 + nf.y, fl(ye2) + nf.z), (v0, ye2 + nf.y, fl(ye2) + nf.z)],
                              (0, zb - z0, y0 - yb), col)
    _rail_seam(k, x1)


def _rail_seam(k, x1):
    """No rail seam by the right post (slate._rail's line on its end block's front, a px wide, 3 px past the post:
    by the left post that edge faces the camera and shows none)."""
    if x1 >= 0.5:
        return
    m = k.m
    g3 = tuple(round(c, 5) for c in core.lin("fGT3"))
    e = 0.5 - S.END_W
    m.f = [f for f in m.f if not (tuple(round(c, 5) for c in f[2]) == g3 and
                                  abs(min(m.v[j][0] for j in f[0]) - e) < 1e-6 and
                                  abs(max(m.v[j][0] for j in f[0]) - e - L) < 1e-6)]


def window(fn, part):
    """fn: slate's straight piece builder (tile.wall.slate.full.m10). (own, wide, pane objects)."""
    calls = [0]
    seq = (part, "m" if part in "mr" else None)        # the piece; its copy one tile on at -x (envtiles._with_runs)
    pre = [0]

    def bare(sp):
        T.BARE = bool(pre[0] < len(seq) and seq[pre[0]])
        T.OPEN = D._span(seq[pre[0]]) if T.BARE else None
        pre[0] += 1

    def each(k, sp):
        i = calls[0]
        calls[0] += 1
        if i < len(seq) and seq[i]:
            D.PART = seq[i]
            D.hook(k, sp, own=i == 0)
            detail(k, seq[i])

    def build():
        calls[0] = pre[0] = 0
        T.HOOK, T.PRE_HOOK = each, bare
        keep = D.FLOOR, D.SILL_OFF, D.RUN, D.END, D.BEAM_DROP
        D.BEAM_DROP = (SHADOW + LIT_UNDER) * PZ         # the opening's top under the rail's shadow band and the
        #   stripe's lit top px: the header's foot as on the wall over it (the band's lowest px under every block, its
        #   dark bottom edge, over the lit px as on the wall)
        D.FLOOR = D.FLOOR - RAISE * PZ
        D.SILL_OFF = DIP * L
        D.RUN, D.END = D.RUN * SLOPE * L / D.END, SLOPE * L
        try:
            own, wide = fn()
            assert calls[0] == len(seq), calls[0]
            return own, wide, D.GLASS.build()
        finally:
            D.FLOOR, D.SILL_OFF, D.RUN, D.END, D.BEAM_DROP = keep
            D.PART, T.HOOK, T.PRE_HOOK, T.BARE, T.OPEN = None, None, None, False, None
    return build
