"""The hull's cutaway pieces, the belly (after hull 46's belly set): what an unroofed ship shows of its hull, one piece
per tile from its key (hull_outline), cut low so the rooms show. Primitives: flat tones by facing, no detail yet.

The hull runs from its outline back to the tile's inner edge (hull_outline.back), each part of it the hull nearest one
front (so a convex corner's parts meet on its bisector, an L at the back corners), a concave corner split as the
exterior's (wall3d_ext_diag). Its top is the cut (walls.CUT's tone). The sides facing the camera are near: cut at the
ghost rim's height (walls.ZG) and hung under the deck, DROP deep, the last CURVE of it curving back under the ship (as
the ghost hull's belly, hull.py). The far sides (the side diagonals too: edge-on, a belly under one shows only where it
hangs over the rooms' floor) stand on the deck, cut at `far` (ZG in the shortest view level, the hull's full height
where the far hull stays up), their inner faces (the hull's inside, toward the rooms) dark. Where a part ends past
its neighbour (a far part over a near one, a near one's belly past a far one's floor) its end shows.

Each piece is two sprites, as hull 46's two belly layers: `under`, all of it under the deck, drawn before the floors
(a floor in front of a belly hides it: at a concave corner a run's belly hangs behind the next room's floor), and
`over`, the rest (the rim and the walls), sorted with everything else."""
import math
import os

from mathutils import Vector

from . import hull_outline as HO
from . import wall3d as T
from . import walls as W
from .wall3d_ext_diag import UP, _lift, _solid, _tile
from .wall3d_ext_geom import YS

DROP, CURVE, ZG = W.DROP, W.CURVE, W.ZG
ARC = 3                             # the curve under the ship: this many facets
ARC_TONES = (YS[3], YS[1], YS[0])   # ... a lit chamfer, then into shadow
OUTER = YS[2]                       # the outer faces (both near faces alike, as the exterior's)
END = YS[1]                         # a part's end where it shows past its neighbour
INNER = ("nvF1", "nvF3")            # the hull's inside, facing +y / +x (the machinery, later)
BOTTOM = YS[0]
if os.environ.get("BELLY_DEBUG"):                   # (each role its own colour: which face is which)
    ARC_TONES, OUTER, END, INNER = ("lampY",) * 3, "green", "dbgR", ("blueN", "blueN")


def near(s):
    """Whether a front's side hangs a belly and is cut at the rim: it faces the camera."""
    return s[0] + s[1] > 0


def span(s, far):
    """A front's part's heights: (bottom, top)."""
    return (-DROP, ZG) if near(s) else (0.0, far)


def _arc(s, c):
    """The belly's curve under a front (s, c: s . p <= c, tile units) as tangent planes to a quarter circle CURVE across
    (in s . p terms, as the hull's depths), from upright at DROP - CURVE under the deck to level at DROP."""
    zb, out = DROP - CURVE, []
    for i in range(1, ARC + 1):
        t = (i - 0.5) / ARC * math.pi / 2
        u, z = c - CURVE * (1 - math.cos(t)), -zb - CURVE * math.sin(t)
        out.append((Vector((math.cos(t) * s.x, math.cos(t) * s.y, -math.sin(t))), math.cos(t) * u - math.sin(t) * z))
    return out


def _parts(key, far):
    """The key's parts: [(front, planes, its fronts' count, [(plane, neighbour front)])], each the hull nearest its
    front; planes: the tile's sides (4), top, bottom, back, the fronts' outer faces, their arcs, the splits."""
    out = []
    for stretch in HO.parse(key):
        for g, before, after in HO.groups(stretch):
            side = [(_lift(HO.nearer(o, f)), o) for o, f in ((before, g[0]), (after, g[-1])) if o]
            outer = [(Vector((s[0], s[1], 0.0)), c / 32) for s, c in g]
            arcs = [q for (s, c), (v, cc) in zip(g, outer) if near(s) for q in _arc(v, cc)]
            for f in g:
                lo, hi = span(f[0], far)
                a, b, c = HO.at_least(f, HO.back(f[0]))
                split = [(_lift(HO.nearer(f, h)), h) for h in g if h is not f]
                planes = _tile() + [(UP, hi), (-UP, -lo), (Vector((-a, -b, 0.0)), -c)] + outer + arcs
                out.append((f, planes + [q for q, _ in split + side], len(g), split + side))
    return out


def _tone(m, i, n, s):
    """A face's tone by its plane (i, of a part with n fronts: _parts), facing and its part's front s: the back is
    found by facing (it may lie on a tile side: _solid keeps the first of two planes alike)."""
    if m.z > 0.85:
        return T.CUT
    if m.z < -0.85:
        return BOTTOM
    if m.z < -0.1:
        return ARC_TONES[min(ARC - 1, int((math.atan2(-m.z, math.hypot(m.x, m.y)) / (math.pi / 2)) * ARC))]
    if abs(m.z) < 0.1 and m.x * s[0] + m.y * s[1] < -0.99 * math.hypot(*s):    # (the back: the hull's inside)
        return INNER[0 if m.y >= m.x else 1]
    if i < 4:                                           # (the tile's own sides: where a run runs on)
        return END
    if 7 <= i < 7 + n:
        return OUTER
    return END


LAYERS = {"under": (UP, 0.0), "over": (-UP, 0.0)}   # (a layer's cut: under the deck, over it)


def piece(key, far=ZG, layer="over"):
    """A layer (LAYERS) of the belly piece of a tile with this key: its parts, each face toned by facing; a face
    shared with a neighbour part drawn only where it rises over or hangs under that part (else it is inside the
    hull)."""
    rel = T.Relief(f"belly_{layer}_{HO.name(key)}")
    for f, planes, n, shared in _parts(key, far):
        lo, hi = span(f[0], far)
        if (-lo if layer == "under" else hi) <= 0.0:
            continue                                    # (none of it in this layer)
        planes = planes + [LAYERS[layer]]
        own = {id(q[0]): h for q, h in shared}
        for pts, m, i in _solid(planes):
            h = own.get(id(planes[i][0]))
            if h is None:
                rel.poly(pts, "steel", 3, m, fixed=_tone(m, i, n, f[0]))
                continue
            lo, hi = span(h[0], far)                    # (only where it shows past its neighbour)
            for cut in ((-UP, -hi), (UP, lo)):
                for p2, m2, j in _solid(planes + [cut]):
                    if j == i:
                        rel.poly(p2, "steel", 3, m2, fixed=END)
    return rel.build() if rel.m.f else []               # (none: a far side has nothing under the deck)
