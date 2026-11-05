"""Interior windows (walls up): a straight partition (mask 10, along x) opened between its posts, a beam over the
opening and a glass pane in it. A window piece is the look's own straight piece cut open: its body between the sill
(the lip's top over the ramp) and the beam (under the header's shadow) taken out over the opening, the cut closed (the
post's section, the sill's top, the beam's underside), the pane in the wall's middle plane, and the pane's top edges
two blue lines along the beam's top. The ramp runs on under the opening as the sill.

wall3d.block calls HOOK(k, sp) on a piece's Relief before it builds; window() sets it while its piece builds.
PART: "l" (the post at the -x end, open on past +x), "m" (open across), "r" (the post at the +x end)."""
import math

from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .faction import base as FB
from .faction import tan as TAN
from .faction import tan_ramps as TR
from .faction.parts import PZ

POST_L = 11.25 / 32     # the end posts' inner edges, across the tile: each post's front a groove, the slats, a groove
POST_R = 21.25 / 32     # (the face's grooves at px 0, 10, 21; a px column's edges sit a quarter px past the 32nds)
LINES = 3 / 32          # the pane's top edges on the beam: this apart, about the wall's middle
LINE_W = 1 / 32
LINE_COL = "fTG0"
SILL_COL = "fTG1"       # the sill's top and the beam's underside: the cap's black
PART = None
RAMP_ONLY = False       # (a preview of the ramp alone: the wall over its top, the beam and the pane left out)
CLOSE = False           # (a preview of a piece on its own: its open end closed, the half arch's sections shown)
DIP = 12 * PZ           # the window's ramp: its crest this far under the wall's ramp (ref #2767 B layer: ~7 px of a
                        # ~16 px ramp; ours is 26 px) ...
DIP_RUN = 11 / 32       # ... reached this far along the wall from a post (a sloped crest), then level (the middle
                        # tiles level all across)
EDGE_OUT = 0.0          # (the cut top out to the ramps' slope, no further)
POST_IN = "fTS3"        # the post's inner side (into the opening): the face's tan, a step into the shade
ARCH_CUT = 5 * PZ       # the arch: the opening up into the header cushion (its front 11 px) by about half of it,
ARCH_SLOPE = (5 / 7, 5 / 7)  # from the cushion's foot at each post's edge, rising (px up per px along) at the -x
                        # post, the +x one: mirrored, over 7 px
PANE_EDGE = "fTX6"      # the pane's edges (as the hull window's): its outline faces, a pane PANE_T thick, opaque
PANE_T = 1 / 32         # and a hair proud of the frame (PANE_OUT), so each draws a dark line where the glass meets
PANE_OUT = 0.003        # it (none where the pane runs on into the next tile)
JOINT_CURVE = 1         # their ends' corners: the curve's radius, px (tan's cushions: 3), the end cushions'
                        # ends at the tile's edges too (the next tile's cushion keeps its 3)
SLOPE_BACK = 2          # the slope's start: this many px back on the post from its edge (at the joint there)
JOINT_BACK = 2          # the header split into cushions at each shoulder's ends: a joint (as the cushions' at a
                        # tile's edge) this many px back on the post from its edge, and one where the slope ends
HEAD_EDGE = "fTS7"      # the cushion's cut foot over the opening: a brown edge, so it reads against the pane
POST_SEAM = (5, 26)     # the posts' fronts: a groove up each one's middle, lip to header (px columns: left post's,
POST_PLAIN = "fTS3"     # right's), the slats gone from its half nearest the window (the face's plain tan)
LIP_END = "fTS8"        # the face's foot lip's end there: a step darker than its front, so it reads apart
SLOPE_TOP = "fTW2"      # the sill's top where it slopes down from a post, a step under the level part's
RAMP_FACE = ("fTW2", "fTW3")    # the window tile's ramps' tan block, plain (lit, shade side) under its own lines
SLOPE_LIT = "fTS0"       # the lit edge across a sill slope's top, at the post
SEAM = "fTS4"           # the seam where the slope meets the level part (the cushions' joint brown)
SILL_TOP = "fTW1"       # the sill's top: the cushions' lit tan
FB.TOP_KEEP.update((LINE_COL, SILL_COL, SILL_TOP, SLOPE_TOP, SEAM, SLOPE_LIT, LIP_END, PANE_EDGE) + RAMP_FACE)
GLASS = None            # the pane's Relief, built by the piece (the glass render kind's second list)


def _heights():
    """(sill top, beam underside): the ramp's top (no lip over the opening: the pane down to the ramp); under
    the header cushion's shadow bands."""
    zs = W.skirt_top()
    z1 = W.HF - 0.031                                   # (tan: the header's top under the cap's black)
    zs0 = z1 - TAN.HEAD_H - TAN._hid(TAN.HEAD_D)
    return zs, zs0 - 2 * PZ


def _zh0():
    """The header cushion's front's foot."""
    return W.HF - 0.031 - TAN.HEAD_H


def _arch_runs():
    """How far along each shoulder runs (at the -x post, the +x one)."""
    return tuple(ARCH_CUT / (s * PZ * 32) for s in ARCH_SLOPE)


def _top(x, x0, x1):
    """The opening's top at x: ARCH_CUT up into the header cushion over the opening, down at ARCH_SLOPE to the
    cushion's foot at each post's edge."""
    ra, rb = _arch_runs()
    s0, s1 = _slope_starts(x0, x1)
    f = min([1.0] + ([max(0.0, x - s0) / ra] if x0 > -0.5 else []) + ([max(0.0, s1 - x) / rb] if x1 < 0.5 else []))
    return _zh0() + ARCH_CUT * f


def _slope_starts(x0, x1):
    return x0 - SLOPE_BACK * T.LINE, x1 + SLOPE_BACK * T.LINE


def _arch_bends(x0, x1):
    ra, rb = _arch_runs()
    s0, s1 = _slope_starts(x0, x1)
    return s0 + ra, s1 - rb


def _sill(x, x0, x1):
    """The ramp's crest under the opening at x: the wall's ramp top at a post, down DIP over DIP_RUN from it."""
    zs = W.skirt_top()
    d = min(([x - x0] if x0 > -0.5 else []) + ([x1 - x] if x1 < 0.5 else []) + [9.0])
    return zs - DIP * min(1.0, max(0.0, d) / DIP_RUN)


def _span(part):
    return {"l": (-0.5 + POST_L, 1.5), "m": (-1.5, 1.5), "r": (-1.5, -0.5 + POST_R)}[part]


def _side(pl, p):
    if len(pl) == 3:                                    # (i, v, s): s * (p[i] - v)
        return pl[2] * (p[pl[0]] - pl[1])
    n, c = pl                                           # (n, c): n . p - c
    return n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - c


def _clip(pts, planes):
    """Sutherland-Hodgman: pts (tuples) kept where each plane's side (_side) >= 0."""
    for pl in planes:
        out = []
        for p, q in zip(pts, pts[1:] + pts[:1]):
            fp, fq = _side(pl, p), _side(pl, q)
            if fp >= -1e-9:
                out.append(p)
            if (fp >= -1e-9) != (fq >= -1e-9) and abs(fq - fp) > 1e-12:
                t = fp / (fp - fq)
                out.append(tuple(a + (b - a) * t for a, b in zip(p, q)))
        pts = out
        if len(pts) < 3:
            return []
    return pts


def _slabs(x0, x1):
    """The opening along x as slabs between the crest's bends: (u0, u1, h0, h1), past the tile where it runs on."""
    xa, xb = (x0 if x0 > -0.5 else -2.0), (x1 if x1 < 0.5 else 2.0)
    us = sorted({xa, xb} | {u for u in (x0 + DIP_RUN, x1 - DIP_RUN) + _arch_bends(x0, x1) if xa < u < xb})
    return [(u0, u1, _sill(u0, x0, x1), _sill(u1, x0, x1)) for u0, u1 in zip(us, us[1:])]


def _cut(k, x0, x1, z1):
    """Take everything over the window's crest and under the beam (z1) out over the opening, wall and ramps alike
    (what is left of a polygon, in convex pieces): the ramps cut level with the crest along it."""
    sl = _slabs(x0, x1)
    xa, xb, hmin = sl[0][0], sl[-1][1], min(min(h0, h1) for _, _, h0, h1 in sl)
    z1 = max(max(_top(u0, x0, x1), _top(u1, x0, x1)) for u0, u1, _, _ in sl)     # (the arch's crown)
    regions = [[(0, xa, -1)], [(0, xb, 1)]]
    for u0, u1, h0, h1 in sl:
        g = (h1 - h0) / (u1 - u0)
        t0, t1 = _top(u0, x0, x1), _top(u1, x0, x1)
        gt = (t1 - t0) / (u1 - u0)
        inx = [(0, u0, 1), (0, u1, -1)]
        regions += [inx + [((-gt, 0.0, 1.0), t0 - gt * u0)], inx + [((g, 0.0, -1.0), g * u0 - h0)]]
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            xs, zs = [p[0] for p in pts], [p[2] for p in pts]
            if max(xs) <= xa + 1e-9 or min(xs) >= xb - 1e-9 or max(zs) <= hmin + 1e-9 or min(zs) >= z1 - 1e-9:
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


def _block_end():
    """How far out from the wall the ramps' tan block runs (tan_ramps: the cushions' end, over the blue toe)."""
    return W.skirt_run() - TR.TOE_GAP


def _plain(k, yf):
    """The ramps' tan block on a window tile in plain tan, for the window's own lines (RAMP_LINES): the old cushions,
    their joints and the blue line along the crest gone; the blue toe band and the foot under it kept. Polygons are
    split where the block ends, the part over it drawn again (RAMP_FACE: lit, shade side)."""
    yc, zs = yf + _block_end(), W.skirt_top()
    for m in (k.m, k.ns):
        if m is None:
            continue
        keep, redo = [], []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            ays = [abs(p[1]) for p in pts]
            if min(ays) < yf + 1e-4 or min(ays) >= yc - 1e-9 or min(p[2] for p in pts) >= zs - 1e-3:   # (not the
                                                                                    # face's painted bands over it)
                keep.append(f)
                continue
            sg = 1 if sum(p[1] for p in pts) > 0 else -1
            for r, near in (([(1, sg * yc, -sg)], True), ([(1, sg * yc, sg)], False)):
                q = _clip(pts, r)
                if len(q) < 3:
                    continue
                if near:
                    redo.append([Vector((p[0], -p[1], p[2])) for p in q])     # (back in grid space)
                else:
                    base = len(m.v)
                    m.v += [tuple(p) for p in q]
                    keep.append((list(range(base, base + len(q))),) + tuple(f[1:]))
        m.f = keep
        sl = W.GN * W.RAMP_PX / W.ZART
        for pts in redo:
            n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
            if n.length < 1e-12:
                continue
            n.normalize()
            sn = Vector((0.0, sl if sum(p.y for p in pts) > 0 else -sl, 1.0)).normalized()
            if abs(n.dot(sn)) < 0.9:                    # (the old plates' sides: gone, the block flat)
                continue
            k.poly(pts, "wall", 2, n, fixed=RAMP_FACE[0])


def _ramp_lines(k, x0, x1, yf):
    """The window's lines on its ramps' tan block (a px each, in SEAM): round the block (its crest, or the cut
    top's edge over the opening; its end over the toe; half a px at each tile edge) and one down the slope at each
    post, where the window's slope starts."""
    sl, zs = W.GN * W.RAMP_PX / W.ZART, W.skirt_top()
    de, E, L, off = _block_end(), 0.4 / 32, LINE_W, 4 * TAN.PAINT

    def top(x):                                         # (the block's top edge: the crest, or the cut's)
        return max(0.0, _reach(_sill(x, x0, x1), yf) - yf) if x0 < x < x1 else 0.0

    def strip(pts):                                     # ((u, d) on both ramps' slopes)
        for sg in (1, -1):
            n = Vector((0.0, sg * sl, 1.0)).normalized()
            k.poly([Vector((u, sg * (yf + d), zs - d * sl)) + n * off for u, d in pts], "wall", 2, n, fixed=SEAM)
    a, b = -0.5, 0.5
    us = sorted({a, b} | {u for u in (x0, x0 + DIP_RUN, x1 - DIP_RUN, x1) if a < u < b})
    for u0, u1 in zip(us, us[1:]):
        t0, t1 = top(u0 + 1e-6), top(u1 - 1e-6)
        strip([(u0, t0), (u1, t1), (u1, t1 + E), (u0, t0 + E)])         # (along the top)
        strip([(u0, de - E), (u1, de - E), (u1, de), (u0, de)])         # (along the end)
    if x0 > a:                                          # (the tile edges, but where the window runs on into the
        strip([(a, top(a)), (a + L / 2, top(a)), (a + L / 2, de), (a, de)])     # next window tile)
    if x1 < b:
        strip([(b - L / 2, top(b)), (b, top(b)), (b, de), (b - L / 2, de)])
    for u, sd in ((x0, -1), (x1, 1)):                   # (down the slope at each post, on the post's side)
        if a < u < b:
            strip([(min(u, u + sd * L), 0.0), (max(u, u + sd * L), 0.0), (max(u, u + sd * L), de),
                   (min(u, u + sd * L), de)])


def _reach(h, yf):
    """How far out of the wall's middle the ramps' slope is at height h (the cut top's half width)."""
    sl = W.GN * W.RAMP_PX / W.ZART                     # (the ramps' slope: z per unit out)
    return yf + (W.skirt_top() - h) / sl


def _quad(k, pts, out, col):
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def hook(k, sp, own=True):
    x0, x1 = _span(PART)
    z0, z1 = _heights()
    yb, yf = W.wall_back() - 0.5, W.wall_back() - 0.5 + W.TW
    _joints(k, x0, x1, yf)
    _cut(k, x0, x1, z1)
    _plain(k, yf)
    _ramp_lines(k, x0, x1, yf)
    a, b = max(x0, -0.5), min(x1, 0.5)
    bends = [u for u in (x0 + DIP_RUN, x1 - DIP_RUN) if a < u < b]
    k.side = None
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):     # the posts' sections, the lip's end on each
        if on:
            zp = _top(u, x0, x1)
            _quad(k, [(u, yb, z0), (u, yf, z0), (u, yf, zp), (u, yb, zp)], (sd, 0, 0), POST_IN)
    _posts(k, x0, x1, yb, yf, z0)
    us = [a] + bends + [b]                              # the sill's top (the cut along the crest, out to the ramps'
    for u0, u1 in zip(us, us[1:]):                      # slopes: wider as it drops) and the beam's underside
        h0, h1 = _sill(u0, x0, x1), _sill(u1, x0, x1)
        r0, r1 = _reach(h0, yf) + EDGE_OUT, _reach(h1, yf) + EDGE_OUT
        _quad(k, [(u0, -r0, h0), (u1, -r1, h1), (u1, r1, h1), (u0, r0, h0)], (0, 0, 1),
              SILL_TOP if abs(h1 - h0) < 1e-9 else SLOPE_TOP)
    for u in bends:                                     # (a seam a px wide where a slope meets the level part)
        h, r = _sill(u, x0, x1) + 0.002, _reach(_sill(u, x0, x1), yf)
        w = LINE_W if _sill(u + 1e-3, x0, x1) < _sill(u - 1e-3, x0, x1) else -LINE_W    # (on the level side)
        _quad(k, [(u, -r, h), (u + w, -r, h), (u + w, r, h), (u, r, h)], (0, 0, 1), SEAM)
    for u0, u1 in zip(us, us[1:]):                      # the sill top's far edge (the slopes' and the level part's) a
        h0, h1 = _sill(u0, x0, x1) + 0.002, _sill(u1, x0, x1) + 0.002     # seam; a lit edge along each slope's
        r0, r1 = _reach(h0 - 0.002, yf), _reach(h1 - 0.002, yf)          # top edge, at the post
        _quad(k, [(u0, -r0, h0), (u1, -r1, h1), (u1, -r1 + LINE_W, h1), (u0, -r0 + LINE_W, h0)], (0, 0, 1), SEAM)
    for u, sd in ((x0, 1), (x1, -1)):                   # a lit edge across each slope's top, at its post
        if a <= u <= b:
            ua, ub = u, u + sd * LINE_W
            ha, hb = _sill(ua, x0, x1) + 0.003, _sill(ub, x0, x1) + 0.003
            ra, rb = _reach(ha - 0.003, yf), _reach(hb - 0.003, yf)
            _quad(k, [(ua, -ra, ha), (ub, -rb, hb), (ub, rb, hb), (ua, ra, ha)], (0, 0, 1), SLOPE_LIT)
    ts = sorted({a, b} | {u for u in _arch_bends(x0, x1) if a < u < b})  # the opening's top: its underside
    s0, s1 = _slope_starts(x0, x1)                                                 # (the beam's, the header's cut;
    tc = ([s0] if x0 > -0.5 else []) + ts + ([s1] if x1 < 0.5 else [])            # the cushion's on over the post)
    for u0, u1 in zip(tc, tc[1:]):
        t0, t1 = _top(u0, x0, x1), _top(u1, x0, x1)
        on_post = u1 <= a + 1e-9 or u0 >= b - 1e-9
        uc = SILL_COL if abs(t1 - t0) < 1e-9 else POST_IN                       # (a shoulder's cut faces the
        if not on_post:                                                          # opening, as the posts')
            _quad(k, [(u0, yb, t0), (u1, yb, t1), (u1, yf, t1), (u0, yf, t0)], (0, 0, -1), uc)
        zh0, yh = W.HF - 0.031 - TAN.HEAD_H, yf + TAN.HEAD_D                      # (and the cushion's, where cut)
        q = _clip([(u0, yf, t0), (u1, yf, t1), (u1, yh, t1), (u0, yh, t0)], [(2, zh0, 1)])
        if len(q) >= 3:
            _quad(k, q, (0, 0, -1), uc)
        ye = yh + T.PAINT                                                         # (the cushion's cut foot: a
        _quad(k, [(u0, ye, t0), (u1, ye, t1), (u1, ye, t1 + PZ), (u0, ye, t0 + PZ)], (0, 1, 0), HEAD_EDGE)  # brown edge)
    if CLOSE and own and x1 > 0.5:
        _close(k, yf, _sill(0.5, x0, x1), z1)
    zt = max(v[2] for v in k.m.v) + 0.002                # the pane's top edges on the beam's top
    for c in (-LINES / 2, LINES / 2):
        y0, y1 = -c - LINE_W / 2, -c + LINE_W / 2       # (grid y; G flips it, symmetric anyway)
        _quad(k, [(a, y0, zt), (b, y0, zt), (b, y1, zt), (a, y1, zt)], (0, 0, 1), LINE_COL)
    if RAMP_ONLY:
        _ramp_only(k, a, x0, x1, yb, yf)
    if not own:                                         # (a copy past the tile: no pane)
        return
    h, e = PANE_T / 2, PANE_OUT                         # the pane's edges
    for u0, u1 in zip(us, us[1:]):
        z0_, z1_ = _sill(u0, x0, x1) + e, _sill(u1, x0, x1) + e
        _quad(k, [(u0, -h, z0_), (u1, -h, z1_), (u1, h, z1_), (u0, h, z0_)], (0, 0, -1), PANE_EDGE)
    for u0, u1 in zip(ts, ts[1:]):
        z0_, z1_ = _top(u0, x0, x1) - e, _top(u1, x0, x1) - e
        _quad(k, [(u0, -h, z0_), (u1, -h, z1_), (u1, h, z1_), (u0, h, z0_)], (0, 0, 1), PANE_EDGE)
    zl1 = z0 + TAN.LIP_TOP
    for xp, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):     # (up each post's side, over the lip wrapped
        if on:                                                      # round it: across its top, down its front)
            u, ul = xp + sd * e, xp + sd * (TAN.LIP_D + e)
            za, zb = zl1 + e, _top(u, x0, x1) - e
            _quad(k, [(u, -h, za), (u, h, za), (u, h, zb), (u, -h, zb)], (-sd, 0, 0), PANE_EDGE)
            _quad(k, [(xp, -h, za), (ul, -h, za), (ul, h, za), (xp, h, za)], (0, 0, 1), PANE_EDGE)
            zc = _sill(ul, x0, x1) + e
            _quad(k, [(ul, -h, zc), (ul, h, zc), (ul, h, za), (ul, -h, za)], (-sd, 0, 0), PANE_EDGE)
    global GLASS
    GLASS = T.Relief("iwin_glass")                      # (the pane down to the crest)
    GLASS.poly([Vector((u, 0.0, _sill(u, x0, x1))) for u in us] + [Vector((u, 0.0, _top(u, x0, x1))) for u in ts[::-1]],
               "wall", 2, Vector((0, 1, 0)), fixed="glassL")


def _cushion_parts(k, yf, keep):
    """Clip the header cushion's parts (its block, its bands: proud of the face, between its foot and its top) to the
    regions keep (lists of _clip planes; a part kept wherever it is in one of them)."""
    z1h = W.HF - 0.031
    zh0 = z1h - TAN.HEAD_H
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            zs = [p[2] for p in pts]
            if max(abs(p[1]) for p in pts) < yf + TAN.HEAD_D / 2 or min(zs) < zh0 - 1e-3 or max(zs) > z1h + 1e-3:
                out.append(f)
                continue
            for r in keep:
                q = _clip(pts, r)
                if len(q) >= 3 and max(abs(a - b) for p0 in q for a, b in zip(p0, q[0])) > 1e-9:
                    base = len(m.v)
                    m.v += [tuple(p) for p in q]
                    out.append((list(range(base, base + len(q))),) + tuple(f[1:]))
        m.f = out


def _cushion_end(k, yf, e, sd):
    """A cushion's end at e (where its gap starts), the cushion on side sd: rebuilt over tan's curve's length
    (HEAD_CURVE px), curved in over JOINT_CURVE px (as TAN._header's slices), full height on from there."""
    from .faction.parts import prism, flat
    L, C, R = T.LINE, JOINT_CURVE, TAN.HEAD_CURVE
    z1h = W.HF - 0.031
    zh0 = z1h - TAN.HEAD_H
    lo, hi = sorted((e, e + sd * R * L))
    _cushion_parts(k, yf, [[(0, lo, -1)], [(0, hi, 1)]])

    def ins(x):
        return (C - math.sqrt(max(0.0, C * C - (C - x) ** 2))) * PZ

    def part(u0, u1, r):
        u0, u1 = sorted((u0, u1))
        prism(k, "y", yf, u0, u1, [(0.0, zh0 + r), (TAN.HEAD_D, zh0 + r), (TAN.HEAD_D, z1h - r), (0.0, z1h - r)],
              TAN.FACE, 3, cols=[False, None, "fTS0", False], cap=TAN.HEAD_END)
        flat(k, "y", yf, u0, u1, z1h - r - PZ, z1h - r, TAN.HEAD_D + T.PAINT, "fTS1")
    for i in range(2 * C):                              # (half px slices, curved in)
        part(e + sd * i * L / 2, e + sd * (i + 1) * L / 2, ins((i + 0.5) / 2))
    if R > C:
        part(e + sd * C * L, e + sd * R * L, 0.0)


def _joints(k, x0, x1, yf):
    """The header cushion split at each shoulder's ends (a 1 px gap, the face behind it and the curves dark, as tan's
    joints), every cushion end there and at the tile's edges by the posts curved in over JOINT_CURVE px; and the
    slope's start, back on the post: the cushion there cut up along it."""
    from .faction.parts import flat
    L = T.LINE
    z1h = W.HF - 0.031
    zh0 = z1h - TAN.HEAD_H
    zg = zh0 - TAN._hid(TAN.HEAD_D)
    ba, bb = _arch_bends(x0, x1)
    s0, s1 = _slope_starts(x0, x1)
    g = ARCH_CUT / _arch_runs()[0]
    for xp, sd, on, jx, xb, ss in ((x0, 1, x0 > -0.5, x0 - (JOINT_BACK + 0.5) * L, ba + L / 2, s0),
                                   (x1, -1, x1 < 0.5, x1 + (JOINT_BACK + 0.5) * L, bb - L / 2, s1)):
        if not on:
            continue
        for j in (jx, xb):
            _cushion_parts(k, yf, [[(0, j - L / 2, -1)], [(0, j + L / 2, 1)]])
            flat(k, "y", yf, j - L / 2 - L, j + L / 2 + L, zg, z1h, T.PAINT, TAN.OUTER)   # (behind gap, curves)
            _cushion_end(k, yf, j - L / 2, -1)
            _cushion_end(k, yf, j + L / 2, 1)
        _cushion_end(k, yf, -0.5 * sd + sd * L / 2, sd)     # (the end cushion's other end, at the tile's edge)
        lo, hi = sorted((ss, xp))                           # the slope's start on the post: the cushion cut up
        n, c = ((-g, 0.0, 1.0), zh0 - g * ss) if sd > 0 else ((g, 0.0, 1.0), zh0 + g * ss)
        _cushion_parts(k, yf, [[(0, lo, -1)], [(0, hi, 1)], [(0, lo, 1), (0, hi, -1), (n, c)]])


def _posts(k, x0, x1, yb, yf, z0):
    """Each post: on its front a groove up its middle from the lip to the header (as the face's grooves), its half
    nearest the window plain (the slats gone) but for the seam over the lip and two across it in thirds; the lip
    wrapped round onto its side in the opening (its front there LIP_END, its foot's dark line on round), and the seam
    over it and the thirds' carried round that side too."""
    zl1, zt = z0 + TAN.LIP_TOP, W.HF - 0.031 - TAN.HEAD_H - TAN._hid(TAN.HEAD_D) - 3 * PZ   # (lip top; face's plain
    zms = [zl1 + round((zt - zl1) * f / TAN.SLAT) * TAN.SLAT for f in (1 / 3, 2 / 3)]    # top under the shadow;
                                                                                        # on the slats' seams)
    P, D = T.PAINT, TAN.LIP_D
    zs0 = zt + 3 * PZ

    def col(n):
        return -0.5 + (n + 0.3) / 32, -0.5 + (n + 1.0) / 32         # (TAN._col: a px column's groove)

    def front(ua, ub, za, zb, d, c):                                # (a strip on the post's front)
        _quad(k, [(ua, yf + d, za), (ub, yf + d, za), (ub, yf + d, zb), (ua, yf + d, zb)], (0, 1, 0), c)

    def side(u, sd, ya, yb_, za, zb, c):                            # (on its side, facing the opening)
        _quad(k, [(u, ya, za), (u, yb_, za), (u, yb_, zb), (u, ya, zb)], (sd, 0, 0), c)
    for on, xp, sd, n, (pa, pb) in ((x0 > -0.5, x0, 1, POST_SEAM[0], (col(POST_SEAM[0])[1], col(10)[0])),
                                    (x1 < 0.5, x1, -1, POST_SEAM[1], (col(21)[1], col(POST_SEAM[1])[0]))):
        if not on:
            continue
        front(pa, pb, zl1 + PZ, zt, 3 * P, POST_PLAIN)              # (the slats gone; the seam over the lip kept)
        g0, g1 = col(n)
        front(g0, g1, zl1, zs0, 4 * P, "fTS4")                      # the groove up its middle
        ha, hb = (col(n)[1], xp) if sd > 0 else (xp, col(n)[0])
        for zm in zms:                                              # the seams across it in thirds
            front(ha, hb, zm, zm + PZ, 4 * P, "fTS4")
        xs, ys = xp + sd * P, yb + T.LINE                           # (on the side: to a px short of its back)
        for zm in zms:                                              # (round onto the side: they, the seam over the
            side(xs, sd, ys, yf, zm, zm + PZ, "fTS4")
        side(xs, sd, ys, yf, zl1, zl1 + PZ, "fTS4")                 # lip; the shadow under the header, filled on up
        zp = _top(xp, x0, x1)                                       # to the cut on the side and on the front over
        side(xp + sd * PANE_OUT / 2, sd, ys, yf, zt, zp, "fTS7")    # the slope's start, one shadow, not bent:
                                                                    # under the pane's edge up the side)
        ss = _slope_starts(x0, x1)[0 if sd > 0 else 1]
        _quad(k, [(ss, yf + 3 * P, zs0), (xp, yf + 3 * P, zs0), (xp, yf + 3 * P, zp), (ss, yf + 3 * P, _zh0())],
              (0, 1, 0), "fTS7")
        c0, c1 = col(10 if sd > 0 else 21)                          # (the face's groove at the post's corner: on up
        _quad(k, [(c0, yf + 4 * P, zt), (c1, yf + 4 * P, zt), (c1, yf + 4 * P, _top(c1, x0, x1)),   # through it to
                  (c0, yf + 4 * P, _top(c0, x0, x1))], (0, 1, 0), "fTS4")                         # the cushion)
        xl = xp + sd * D                                            # the lip round the corner: its front facing the
        side(xl, sd, yb, yf + D, z0, zl1, LIP_END)                  # opening, its top, the corner's front, the dark
        side(xl + sd * P, sd, yb, yf + D, z0, z0 + PZ, "fTS4")      # line along its foot
        _quad(k, [(xp, yb, zl1), (xl, yb, zl1), (xl, yf + D, zl1), (xp, yf + D, zl1)], (0, 0, 1), "fTS1")
        lo, hi = min(xp, xl), max(xp, xl)
        front(lo, hi, z0, zl1, D, "fTS3")
        front(lo, hi, z0, z0 + PZ, D + P, "fTS4")


def _close(k, yf, h, z1):
    """The piece's +x end as a free end's, in the free ends' slate: the foot and the ramps' section cut level at the
    window's crest h, and the beam's over the opening (with the header cushion's, proud of the face)."""
    col, edge = TAN.END["x"], TAN.END_EDGE["x"]
    run, ft, top = W.skirt_run(), W.FOOT_PX / W.ZART, W.HF
    sl = W.GN * W.RAMP_PX / W.ZART
    dl = min(run, (W.skirt_top() - ft) / sl)
    re, yt, yl = _reach(h, yf), yf + run, yf + dl
    sec = [(-yt, 0.0035), (yt, 0.0035), (yt, ft), (yl, ft), (re, h), (-re, h), (-yl, ft), (-yt, ft)]
    k.poly([T.P("x", 0.5, u, z, 0.0) for u, z in sec], "wall", 2, T.OUT("x"), fixed=col)
    k.poly([T.P("x", 0.5, u, z, TAN.PAINT) for u, z in ((-yt, 0.0035), (yt, 0.0035), (yt, ft), (-yt, ft))],
           "wall", 2, T.OUT("x"), fixed=T.style().toe or col)
    zh1 = top - 0.031
    zh0 = zh1 - TAN.HEAD_H
    for y0, y1, za, zb in ((-yf, yf, z1, top), (yf, yf + TAN.HEAD_D, zh0, zh1)):
        _quad(k, [(0.5, y0, za), (0.5, y1, za), (0.5, y1, zb), (0.5, y0, zb)], (1, 0, 0), col)
    _quad(k, [(0.5 + 0.004, yf + TAN.HEAD_D - 1 / 32, zh0), (0.5 + 0.004, yf + TAN.HEAD_D, zh0),
              (0.5 + 0.004, yf + TAN.HEAD_D, zh1), (0.5 + 0.004, yf + TAN.HEAD_D - 1 / 32, zh1)], (1, 0, 0), edge)


def _ramp_only(k, a, x0, x1, yb, yf):
    """Everything over the ramps' top out (the cushions standing over it kept), the post cut there in the cap's
    black."""
    zs, yc, rise = W.skirt_top(), yf + TAN.LIP_D + 1e-4, 0.12
    regions = [[(2, zs, -1)], [(2, zs, 1), (2, zs + rise, -1), (1, yc, 1)],
               [(2, zs, 1), (2, zs + rise, -1), (1, -yc, -1)]]
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            if max(p[2] for p in pts) <= zs + 1e-9:
                out.append(f)
                continue
            for r in regions:
                q = _clip(pts, r)
                if len(q) >= 3:
                    n = Vector(q[1]) - Vector(q[0])
                    if max((Vector(c) - Vector(q[0])).cross(n).length for c in q) < 1e-10:
                        continue
                    base = len(m.v)
                    m.v += [tuple(p) for p in q]
                    out.append((list(range(base, base + len(q))),) + tuple(f[1:]))
        m.f = out
    if x0 > -0.5:
        _quad(k, [(-0.5, yb, zs), (x0, yb, zs), (x0, yf, zs), (-0.5, yf, zs)], (0, 0, 1), SILL_COL)


def window(fn, part):
    """fn: the look's straight piece builder (tile.wall.<look>.full.m10). (own, wide, pane objects); (own, wide)
    ramp only."""
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
            r = fn()
            assert calls[0] == 3, calls[0]
            own, wide = r if isinstance(r, tuple) else (r, None)
            if RAMP_ONLY:
                return r
            return own, wide, GLASS.build()             # (wide: the piece's copies past the tile, hiding its ends)
        finally:
            PART, T.HOOK = None, None
    return build
