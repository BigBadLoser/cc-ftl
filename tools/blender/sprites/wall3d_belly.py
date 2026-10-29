"""The hull's cutaway pieces, the belly (after hull 46's belly set): what an unroofed ship shows of its hull, one piece
per tile from its key (hull_outline), cut low so the rooms show. Primitives: flat tones by facing, no detail yet.

The hull runs from its outline back to the tile's inner edge (hull_outline.back), each part of it the hull nearest one
front (so a convex corner's parts meet on its bisector, an L at the back corners), a concave corner split as the
exterior's (wall3d_ext_diag). Its top is the cut (walls.CUT's tone). The sides facing the camera are near: cut at the
ghost rim's height (walls.ZG) and hung under the deck in hull 46's section, upright armour ARMOUR deep, then a slope
back under the ship (SLOPE: in, down); a convex near corner is chamfered as the exterior's (wall3d_ext_t3.CORNER_C),
its facet a front of its own with the same section. The far sides (the side diagonals too: edge-on, a belly under one
shows only where it hangs over the rooms' floor) stand on the deck, cut at `far` (ZG in the shortest view level, the
hull's full height where the far hull stays up), their inner faces (the hull's inside, toward the rooms) dark. Where a
part ends past its neighbour (a far part over a near one, a near one's belly past a far one's floor) its end shows.

Each piece is two sprites, as hull 46's two belly layers: `under`, all of it under the deck, drawn before the floors
(a floor in front of a belly hides it: at a concave corner a run's belly hangs behind the next room's floor), and
`over`, the rest (the rim and the walls), sorted with everything else."""
import math
import os

from mathutils import Vector

from . import hull_outline as HO
from . import wall3d as T
from . import walls as W
from .wall3d_ext_diag import UP, WIDE, _lift, _seam, _solid, _tile
from .wall3d_ext_geom import BELLY_SLOPE, YS
from .wall3d_ext_t3 import CORNER_C

ZG = W.ZG
ARMOUR = 0.77                       # tiles: the near armour's upright drop under the cut (hull 46 D3's: 31 px at 64
SLOPE = (0.375, 0.638)              # px tiles; its Bottom draws 33, but the two meet), then its slope in (square to its
                                    # front) and down under the ship: a px column shows 13 px of it on a run (39.2 h
                                    # - 32 r: hull 46 D3's 11 and 2 more, as the lip hangs over its top), its end at
                                    # the tile's side a 12 px taper (32 r), 16 px on a facet facing the camera (39.2 h
                                    # - 16 r sqrt 2)
SLOPE_TONE = BELLY_SLOPE
OUTER = YS[2]                       # the outer faces (both near faces alike, as the exterior's)
END = YS[1]                         # a part's end where it shows past its neighbour
INNER = ("nvF1", "nvF3")            # the hull's inside, facing +y / +x (the machinery, later)
BOTTOM = YS[0]
# (the belly proper, the slope under the ship and its lines, a step darker: hbX*, 0.68 of each;
DARK = ("hbSlope", "hbRim", "hbSlopeLn", "hbSlopeLit")
REMAP = {n: "hbX" + n for n in DARK}  # the face above it keeps the hull's tones)
if os.environ.get("BELLY_DEBUG"):                   # (each role its own colour: which face is which)
    SLOPE_TONE, OUTER, END, INNER = "lampY", "green", "dbgR", ("blueN", "blueN")


def near(s):
    """Whether a front's side hangs a belly and is cut at the rim: it faces the camera."""
    return s[0] + s[1] > 0


def span(s, far):
    """A front's part's heights: (bottom, top)."""
    return (ZG - ARMOUR - SLOPE[1], ZG) if near(s) else (0.0, far)


def _slope(s, c):
    """The slope under a front (s, c: s . p <= c, tile units): from the armour's foot SLOPE in (square to the front:
    s . p terms scaled by |s|, so a facet's slope matches a run's) and down."""
    (r, h), z = SLOPE, ZG - ARMOUR
    r *= s.length
    return [(Vector((h * s.x, h * s.y, -r)), h * c - r * z)]


def _chamfer(g):
    """A convex stretch's fronts with each convex near corner (a +x run then a +y one) chamfered: its facet a front
    between them."""
    out = []
    for f in g:
        if out and out[-1][0] == (1, 0) and f[0] == (0, 1):
            out.append(((1, 1), out[-1][1] + f[1] - round(32 * CORNER_C)))
        out.append(f)
    return out


def _parts(key, far, margin=0.0):
    """The key's parts: [(front, planes, its fronts' count, [(plane, neighbour front)], cuts)], each the hull nearest
    its front; planes: the tile's sides (4, `margin` out), top, bottom, back, the fronts' outer faces, their slopes,
    the splits; cuts: what bounds it but its own front (a near run's art cut to it: the tile's sides, the other fronts'
    faces and slopes, the splits)."""
    out = []
    for stretch in HO.parse(key):
        for g, before, after in HO.groups(stretch):
            g = _chamfer(g)
            side = [(_lift(HO.nearer(o, f)), o) for o, f in ((before, g[0]), (after, g[-1])) if o]
            outer = [(Vector((s[0], s[1], 0.0)), c / 32) for s, c in g]
            slopes = [_slope(v, cc) if near(s) else [] for (s, c), (v, cc) in zip(g, outer)]
            arcs = [q for qs in slopes for q in qs]
            for i, f in enumerate(g):
                lo, hi = span(f[0], far)
                a, b, c = HO.at_least(f, HO.back(f[0]))
                split = [(_lift(HO.nearer(f, h)), h) for h in g if h is not f]
                tile = _tile(margin)
                planes = tile + [(UP, hi), (-UP, -lo), (Vector((-a, -b, 0.0)), -c)] + outer + arcs
                cuts = tile + [q for j in range(len(g)) if j != i for q in [outer[j]] + slopes[j]]
                out.append((f, planes + [q for q, _ in split + side], len(g), split + side,
                            cuts + [q for q, _ in split + side]))
    return out


def _tone(m, i, n, s):
    """A face's tone by its plane (i, of a part with n fronts: _parts), facing and its part's front s: the back is
    found by facing (it may lie on a tile side: _solid keeps the first of two planes alike)."""
    if m.z > 0.85:
        return T.CUT
    if m.z < -0.85:
        return BOTTOM
    if m.z < -0.1:
        return SLOPE_TONE
    if abs(m.z) < 0.1 and m.x * s[0] + m.y * s[1] < -0.99 * math.hypot(*s):    # (the back: the hull's inside)
        return INNER[0 if m.y >= m.x else 1]
    if i < 4:                                           # (the tile's own sides: where a run runs on)
        return END
    if 7 <= i < 7 + n:
        return OUTER
    return END


LAYERS = {"under": (UP, 0.0), "over": (-UP, 0.0)}   # (a layer's cut: under the deck, over it)


def piece(key, far=ZG, layer="over", margin=0.0, look=20):
    """A layer (LAYERS) of the belly piece of a tile with this key: a near run's part the run's own art (wall3d_belly
    _run, as the exterior's pieces take the run set's), cut to it; each other part a solid, its faces toned by facing
    (a face shared with a neighbour part drawn only where it rises over or hangs under that part, else it is inside
    the hull), the top's seam on its cut (the exterior's). `margin`: its sides that far out (WIDE: the solid its
    colours come from, env_build "wide"); look: its runs' (wall3d_belly_run.build)."""
    from . import core
    was, core.REMAP = core.REMAP, REMAP
    try:
        return _piece(key, far, layer, margin, look)
    finally:
        core.REMAP = was


def _piece(key, far, layer, margin, look):
    from . import wall3d_belly_run as BR
    rel, art = T.Relief(f"belly_{layer}_{HO.name(key)}"), []
    for f, planes, n, shared, cuts in _parts(key, far, margin):
        lo, hi = span(f[0], far)
        if (-lo if layer == "under" else hi) <= 0.0:
            continue                                    # (none of it in this layer)
        if f[0] in BR.RUNS:
            art += BR.art(f, cuts + [LAYERS[layer]], wide=margin > 0, look=look)
            continue
        planes = planes + [LAYERS[layer]]
        own = {id(q[0]): h for q, h in shared}
        for pts, m, i in _solid(planes):
            if i == len(planes) - 1:                    # (the deck, where the layers meet: the over layer draws
                if layer == "under" and near(f[0]):     # none of it, or anti-aliasing leaks its tone along the seam;
                    rel.poly(pts, "steel", 3, m, fixed=OUTER)   # the under one closes its cut in the face's tone)
                continue
            h = own.get(id(planes[i][0]))
            if h is None:
                rel.poly(pts, "steel", 3, m, fixed=_tone(m, i, n, f[0]))
                continue
            lo, hi = span(h[0], far)                    # (only where it shows past its neighbour)
            for cut in ((-UP, -hi), (UP, lo)):
                for p2, m2, j in _solid(planes + [cut]):
                    if j == i:
                        rel.poly(p2, "steel", 3, m2, fixed=END)
        if near(f[0]):                                  # (the bay looks' frame, as the runs carry it)
            _frame(rel, f, planes)
        if layer == "over":
            _seam(rel, ([], [q for q in planes if abs(q[0].z) < 1e-9]), [f], span(f[0], far)[1])
    return (rel.build() if rel.m.f else []) + art       # (none: a far side has nothing under the deck)


def _frame(rel, f, planes):
    """The bay looks' shared frame on a near part that is not a run (wall3d_belly_facet), on its own face and slope."""
    from . import wall3d_belly_facet as BF
    v, c = Vector((f[0][0], f[0][1], 0.0)), f[1] / 32

    def find(q):
        return next(p for p in planes if (p[0] - q[0]).length < 1e-9 and abs(p[1] - q[1]) < 1e-9)
    foot = ZG - ARMOUR
    BF.dress(rel, _solid, planes, find((v, c)), find(_slope(v, c)[0]), ZG, foot, foot - SLOPE[1])


def wide(key, far=ZG, layer="over", look=20):
    """A piece as env_build's "wide" kind: (its own, the same run on past the tile's edges); none if it is empty. A
    piece of more than one front (a corner) takes its colours from itself: pushed out past the tile it is another
    shape (as the exterior's, whose corners are "block" pieces)."""
    own = piece(key, far, layer, look=look)
    if not own:
        return []
    return (own, piece(key, far, layer, WIDE, look) if ";" not in key else piece(key, far, layer, look=look))
