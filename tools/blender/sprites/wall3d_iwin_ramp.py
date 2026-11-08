"""The interior window's ramp (the lower layer, after Space Haven's wall styles 44 and 3168): on the default walls'
window (wall3d_iwin_def: the opening, sill, beam, pane) a raised floor with a steeper crest down to it, and on the near
ramp under the opening recessed pockets (one on an end tile, two on a middle one, a rib between), their floors lit
along the front and shaded under their roofs, dark metal plates wrapped over the sill's edges (near and far), the toe
under the pockets a tone of its own. A look's colours come in a Look; slate's and the default's (TEAL) use it.

PART: "l" (the post at the -x end), "m" (open across), "r" (the post at the +x end), as wall3d_iwin_def."""
from dataclasses import dataclass, field
from typing import Callable, Optional

from mathutils import Vector

from . import core
from . import wall3d as T
from . import walls as W
from . import wall3d_iwin_def as D
from .faction.parts import PZ
from .wall3d_iwin import _clip

L = 1 / 32                              # an art px along the wall
POST0 = D.POST                          # the default walls' end posts (a look's post_in from it)
POCKETS = {"l": ((18, 28),), "m": ((2, 14), (17, 29)), "r": ((3, 13),)}   # px from the tile's start: each pocket
RIBS = {"m": ((15, 16),)}               # px: a rib between pockets cut upright, its face under the pockets' top edge
POCKET_TOP = 3                          # its top this many px under the sill's level top
POCKET_FOOT = 1                         # its floor this many px over the ramp's foot (so it runs RAISE px deeper)
POCKET_IN = 4 / 32                      # how far it runs back into the ramp, from the slope at its top
FLOOR_RISE = 2                          # px its floor climbs from the ramp's front to its back
PAINT_SIDE, PAINT_BACK = 4, 3           # a look's paint block on a pocket's floor: this many px in from each side and
                                        # from its back (top) edge
LIP = 1                                 # px: the floor's front edge lit
PLATES = {"l": ((21, 28),), "m": ((10, 22),), "r": ((4, 14),)}   # px: dark metal plates wrapped over the sill's
                                        # front edge: ref 44's three, on screen (at its edge they measure l 24 - m 2,
                                        # m 16-28, r 10-20; ours stands further back than its pockets, so 6 px toward
                                        # -x; l's from the dip's foot); the lighter stretches between are the floor
PLATE_D = 6                             # px back over the sill's top from its front edge ...
PLATE_DN = 2                            # ... and PZ down the face over the pockets past it
BLOCK = 13                              # px: the end blocks under the posts run this far in from the run's ends
SLOT_W, SLOT_H, SLOT_TOP = 7, 2, 2      # px: a look's dark slot on an end block (wide, tall, under the slope's top)
END_STRIP = 3                           # px: the strip closing the joined end under the floor's edge
DIP = 0                                 # px past the post where the sill's crest starts down (the ref's: on screen over
                                        # the end pocket's outer edge; the crest stands further back, so 0 here)
SLOPE = 9                               # px: the sill's crest from there down to the window's floor
RAISE = 3                               # px the window's floor (the sill's level top) stands over the default's


@dataclass
class Look:
    """A look's ramp colours (palette names) and its own touches."""
    floor_lit: str                      # a pocket's floor, lit
    floor_shade: str                    # ... under its roof (from its back to the roof's edge)
    lip_lit: str                        # ... its front edge (LIP px)
    back: str                           # a pocket's back
    side: str                           # its sides and its roof's underside
    rib: str                            # a rib's face (the ramp's front tone over it)
    toe: str                            # the near ramp under the opening from the pockets' floors down
    plate: str                          # a plate's top ...
    plate_front: str                    # ... and its front, down the face
    floor_paint: dict = field(default_factory=dict)   # part -> a block painted across the pockets' floors ...
    paint_shade: str = ""               # ... under the roof ...
    lip_paint: str = ""                 # ... and its lit front edge
    beam_drop: float = 0.0              # the beam's underside under the rail's foot (wall3d_iwin_def.BEAM_DROP)
    toe_drop: int = 0                   # px: the toe's top this far under the pockets' floors (the slope's own tone
                                        # between)
    blocks: str = ""                    # a wall3d.RAMPS family: the end blocks under the posts (the near ramp from the
                                        # run's ends BLOCK px in) recoloured from the default walls' ramp into it
    block_slot: str = ""                # a dark slot on each end block's slope
    post_in: int = 0                    # px: the opening's ends (the side slopes, the end blocks' inner edges) this far
                                        # further out, the posts that much thinner
    pre: Optional[Callable] = None      # f(k, part, a, b, yf): before the ramp (a, b: between the end blocks)
    post: Optional[Callable] = None     # f(k, part): after it


TEAL = Look(floor_lit="wH", floor_shade="wS", lip_lit="wHW", back="wXD", side="wD", rib="wL", toe="wM",
            plate="wM", plate_front="wD", toe_drop=1, blocks="ochre", block_slot="oK", post_in=2)   # (the floors lit over the ramp's front, wL;
#   their lit edge a step over wH, the "window" palette set's)


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


def _end_strip(k, part, x0, x1, yf):
    """The run goes on at +x (l, m): the wall's end there is open under the sill (it shows inside, dark). A strip under
    the floor's edge there in its tone (across the floor, END_STRIP px down), so the floor's px on that edge stay the
    floor's; the next piece paints over the rest."""
    if part not in "lm":
        return
    h = D._sill(0.5, x0, x1)
    v = yf + (W.skirt_top() - h) / _k()
    u = 0.5 - 1e-4
    _quad(k, [(u, -v, h - END_STRIP * PZ), (u, v, h - END_STRIP * PZ), (u, v, h), (u, -v, h)], (1, 0, 0), D.SILL_TOP)


def _toe(k, look, a, b, yf):
    """The near ramp under the opening, from the pockets' floors down, in the toe's tone."""
    m = k.m
    zt = W.foot() + (POCKET_FOOT - look.toe_drop) * PZ
    toe = m._cols(look.toe)
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


def _blocks(k, look, a, b, yf):
    """The end blocks: the near ramp outside a..b (on the tile), from the foot up to its top, in the look's blocks
    family (each of the default walls' ramp colours to the same level of it, lit and shaded faces): the slope only,
    the shelf and lip over it left as they are; on it a dark slot (SLOT_W px wide, SLOT_H tall, SLOT_TOP under the
    slope's top)."""
    if not look.blocks:
        return
    m = k.m
    key = {}
    for src, dst in zip(T.RAMPS["wall"], T.RAMPS[look.blocks]):
        for s_, d_ in zip(src, dst):
            key.setdefault(tuple(round(c, 5) for c in core.lin(s_)), d_)
    top = None
    for i, f in enumerate(m.f):
        pts = [m.v[j] for j in f[0]]
        cx = sum(p[0] for p in pts) / len(pts)
        c = tuple(round(v, 5) for v in f[2])
        if (c in key and -0.5 < cx < 0.5 and not a < cx < b and max(p[1] for p in pts) < -yf + 1e-6 and
                max(p[2] for p in pts) <= W.skirt_top() + 1e-6 and min(p[2] for p in pts) >= W.foot() - 1e-6):
            n = (Vector(pts[1]) - Vector(pts[0])).cross(Vector(pts[2]) - Vector(pts[0]))
            if 0.3 * n.length < abs(n.y) < 0.95 * n.length:   # (the slope's: it faces out and up, the shelf
                m.f[i] = (f[0],) + m._cols(key[c])          # up, the lip's front out)
                top = max(top or -9.0, max(p[2] for p in pts))
    if not look.block_slot or top is None:
        return
    z1 = top - SLOT_TOP * PZ
    z0 = z1 - SLOT_H * PZ
    e = Vector((0, _k(), 1)).normalized() * 2 * T.PAINT
    for u0, u1 in ((-0.5, a), (b, 0.5)):
        if u1 - u0 < SLOT_W * L or not (-0.5 <= u0 and u1 <= 0.5):
            continue
        c = (u0 + u1) / 2
        v0, v1 = c - SLOT_W * L / 2, c + SLOT_W * L / 2
        _quad(k, [(v0, _slope_y(z1, yf) + e.y, z1 + e.z), (v1, _slope_y(z1, yf) + e.y, z1 + e.z),
                  (v1, _slope_y(z0, yf) + e.y, z0 + e.z), (v0, _slope_y(z0, yf) + e.y, z0 + e.z)], (0, _k(), 1),
              look.block_slot)


def _plates(k, look, part, yf, zf):
    """The plates over the sill's front edge (its level top meets the ramp), a hair proud of it and of its lit edge,
    on both sides of the wall (the far one mirrored)."""
    ye = yf + (W.skirt_top() - zf) / _k()
    e = 3 * T.PAINT
    n = Vector((0, _k(), 1)).normalized() * e
    yd = ye + PLATE_DN * PZ / _k()
    for p0, p1 in PLATES.get(part, ()):
        u0, u1 = -0.5 + p0 * L, -0.5 + (p1 + 1) * L
        for sg in (1, -1):
            _quad(k, [(u0, sg * (ye - PLATE_D * L), zf + e), (u1, sg * (ye - PLATE_D * L), zf + e),
                      (u1, sg * ye, zf + e), (u0, sg * ye, zf + e)], (0, 0, 1), look.plate)
            _quad(k, [(u0, sg * (ye + n.y), zf + n.z), (u1, sg * (ye + n.y), zf + n.z),
                      (u1, sg * (yd + n.y), zf - PLATE_DN * PZ + n.z), (u0, sg * (yd + n.y), zf - PLATE_DN * PZ + n.z)],
                  (0, sg * _k(), 1), look.plate_front)


def _pockets(k, look, part, yf, zf):
    m = k.m
    z0, z1 = W.foot() + POCKET_FOOT * PZ, zf - POCKET_TOP * PZ   # (a pocket's floor at the front, its top)
    yb = _slope_y(z1, yf) - POCKET_IN                   # (its back, grid y)
    y0, y1 = _slope_y(z0, yf), _slope_y(z1, yf)         # (the slope at its floor, at its top)
    zb = z0 + FLOOR_RISE * PZ                           # (the floor's back edge: it slopes up into the ramp)
    fn = (0, zb - z0, y0 - yb)                          # (the floor's normal)

    def fl(y):                                          # the floor's height at y
        return z0 + (zb - z0) * (y0 - y) / (y0 - yb)
    ribs = [(-0.5 + r0 * L, -0.5 + (r1 + 1) * L) for r0, r1 in RIBS.get(part, ())]
    edges = {u for r in ribs for u in r}
    for u0, u1 in ribs:                                 # a rib: upright at y1 over the floor run on under it
        _carve(m, u0, u1, -(y0 + 0.05), -y1, z0, z1)
        _quad(k, [(u0, y1, fl(y1)), (u1, y1, fl(y1)), (u1, y0, z0), (u0, y0, z0)], fn, look.floor_lit)
        _quad(k, [(u0, y1, fl(y1)), (u1, y1, fl(y1)), (u1, y1, z1), (u0, y1, z1)], (0, 1, 0), look.rib)
    ps = POCKETS[part]
    for p0, p1 in ps:                                   # the pockets
        u0, u1 = -0.5 + p0 * L, -0.5 + (p1 + 1) * L
        _carve(m, u0, u1, -(y0 + 0.05), -yb, z0, z1)
        _quad(k, [(u0, yb, zb), (u1, yb, zb), (u1, y1, fl(y1)), (u0, y1, fl(y1))], fn, look.floor_shade)
        _quad(k, [(u0, y1, fl(y1)), (u1, y1, fl(y1)), (u1, y0, z0), (u0, y0, z0)], fn, look.floor_lit)
        _quad(k, [(u0, yb, zb), (u1, yb, zb), (u1, yb, z1), (u0, yb, z1)], (0, 1, 0), look.back)
        for u, sd in ((u0, 1), (u1, -1)):
            if any(abs(u - e) < 1e-9 for e in edges):   # (on a rib: its side only behind the rib's face)
                _quad(k, [(u, yb, zb), (u, y1, fl(y1)), (u, y1, z1), (u, yb, z1)], (sd, 0, 0), look.side)
            else:
                _quad(k, [(u, yb, zb), (u, y0, z0), (u, y1, z1), (u, yb, z1)], (sd, 0, 0), look.side)
        _quad(k, [(u0, yb, z1), (u1, yb, z1), (u1, y1, z1), (u0, y1, z1)], (0, 0, -1), look.side)
    g0, g1 = -0.5 + ps[0][0] * L + PAINT_SIDE * L, -0.5 + (ps[-1][1] + 1) * L - PAINT_SIDE * L
    paint = look.floor_paint.get(part)
    if paint:                                           # the paint block (after the carving): one across the floor,
        nf = Vector(fn).normalized() * 2 * T.PAINT      # the pockets' and in front of the ribs, a hair proud
        yp = yb + PAINT_BACK * L
        spans = [(-0.5 + p0 * L, -0.5 + (p1 + 1) * L, yp) for p0, p1 in ps] + [(u0, u1, y1) for u0, u1 in ribs]
        for v0, v1, ya in spans:
            v0, v1 = max(v0, g0), min(v1, g1)
            if v1 > v0:                                 # (under the pocket's roof in the shade's tone)
                for ys, ye2, col in ((ya, min(y1, y0), look.paint_shade), (max(ya, y1), y0, paint)):
                    if ye2 > ys:
                        _quad(k, [(v0, ys + nf.y, fl(ys) + nf.z), (v1, ys + nf.y, fl(ys) + nf.z),
                                  (v1, ye2 + nf.y, fl(ye2) + nf.z), (v0, ye2 + nf.y, fl(ye2) + nf.z)], fn, col)
    nh = Vector(fn).normalized() * 3 * T.PAINT          # the floors' front edge lit: LIP px back from it on the
    cuts = [g0, g1] if paint else []                    # pockets' and ribs' floors, over the paint block
    yl = y0 - LIP * L
    for v0, v1 in [(-0.5 + p0 * L, -0.5 + (p1 + 1) * L) for p0, p1 in ps] + ribs:
        xs = sorted({v0, v1} | {c for c in cuts if v0 < c < v1})
        for w0, w1 in zip(xs, xs[1:]):
            col = look.lip_paint if cuts and g0 - 1e-9 <= w0 and w1 <= g1 + 1e-9 else look.lip_lit
            _quad(k, [(w0, yl + nh.y, fl(yl) + nh.z), (w1, yl + nh.y, fl(yl) + nh.z), (w1, y0 + nh.y, z0 + nh.z),
                      (w0, y0 + nh.y, z0 + nh.z)], fn, col)


def detail(k, part, look):
    x0, x1 = D._span(part)
    a, b = max(x0 + BLOCK * L - POST0, -0.5), min(x1 - BLOCK * L + POST0, 0.5)   # (between the end blocks: they
    #   move with the opening's ends)
    yf = W.wall_back() - 0.5 + W.TW
    zf = D._dip()[1]                                    # (the sill's level top: its floor)
    _split_x(k.m, [u for u in (a, b) if -0.5 < u < 0.5])
    if look.pre:
        look.pre(k, part, a, b, yf)
    _end_strip(k, part, x0, x1, yf)
    _blocks(k, look, a, b, yf)
    _toe(k, look, a, b, yf)
    _plates(k, look, part, yf, zf)
    _pockets(k, look, part, yf, zf)
    if look.post:
        look.post(k, part)


def window(fn, part, look):
    """fn: a look's straight piece builder (tile.wall[.look].full.m10). (own, wide, pane objects)."""
    calls = [0]
    seq = (part, "m" if part in "mr" else None)        # the piece; its copy one tile on at -x (envtiles._with_runs
    pre = [0]                                           # builds only the runs drawn before it): the window running on
    #   into it, else plain

    def bare(sp):                                       # (a window tile's ramp built bare: its panel left out)
        T.BARE = bool(pre[0] < len(seq) and seq[pre[0]])
        T.OPEN = D._span(seq[pre[0]]) if T.BARE else None
        pre[0] += 1

    def each(k, sp):
        i = calls[0]
        calls[0] += 1
        if i < len(seq) and seq[i]:
            D.PART = seq[i]
            D.hook(k, sp, own=i == 0)
            detail(k, seq[i], look)

    def build():
        calls[0] = pre[0] = 0
        T.HOOK, T.PRE_HOOK = each, bare
        keep = D.FLOOR, D.SILL_OFF, D.RUN, D.END, D.BEAM_DROP, D.POST
        D.BEAM_DROP = look.beam_drop
        D.POST = POST0 - look.post_in * L
        D.FLOOR = D.FLOOR - RAISE * PZ
        D.SILL_OFF = DIP * L
        D.RUN, D.END = D.RUN * SLOPE * L / D.END, SLOPE * L
        try:
            own, wide = fn()
            assert calls[0] == len(seq), calls[0]
            return own, wide, D.GLASS.build()
        finally:
            D.FLOOR, D.SILL_OFF, D.RUN, D.END, D.BEAM_DROP, D.POST = keep
            D.PART, T.HOOK, T.PRE_HOOK, T.BARE, T.OPEN = None, None, None, False, None
    return build
