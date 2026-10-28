"""The belly's detail (wall3d_belly), after hull 46's underbelly armour: a near straight run's face dressed as D3's
look 1, laid along the run tile by tile and clipped to each part it reaches (a corner's, a join's), so the pattern
runs on round them as it does along the run.

A design is in face px: u along the face (0 its end at the tile's front corner, a tile 32 across: the +x face's
screen-left end, the +y face's screen-right one, as hull 46 mirrors its art), v down the armour from the cut
(vertical: an art px of height a px). Each mark is painted (a flat inlay just proud of the face)."""
from mathutils import Vector

from . import core
from . import hull_outline as HO
from . import wall3d as T
from .wall3d_ext_geom import YS

LIT, DARK = YS[4], YS[1]
# D3 look 1 (u0, u1, v0, v1, tone): the lit lip under the cut, a seam across the side plates (dark, lit under it),
# the raised centre panel (its lit top and bottom edges, a dark line across it, its dark sides), the lit foot.
LOOK1 = [
    (0, 32, 0, 1, LIT),
    (0, 8, 13, 14, DARK), (0, 8, 14, 15, LIT), (27, 32, 13, 14, DARK), (27, 32, 14, 15, LIT),
    (8, 27, 10, 11, LIT), (9, 26, 16, 17, DARK), (8, 27, 27, 28, LIT),
    (8, 9, 10, 28, DARK), (26, 27, 10, 28, DARK),
    (0, 32, 31, 32, LIT),
]
RUNS = {(1, 0), (0, 1)}             # the near runs' fronts (a design is drawn on their faces)
CAP_SEAM = (2, 1, "bD")             # the cut's seam: this many px in from its back edge on screen, this many wide


def _px():
    """An art px of height, in tiles (the scale the sprites render at)."""
    return core.ART_SCALE / core.ZPX


def _clip(pts, planes):
    """A convex polygon cut to each half-space (n . p <= c)."""
    for n, c in planes:
        out = []
        for p, q in zip(pts, pts[1:] + pts[:1]):
            a, b = n.dot(p) - c, n.dot(q) - c
            if a <= 1e-9:
                out.append(p)
            if (a < -1e-9 < b) or (b < -1e-9 < a):
                out.append(p + (q - p) * (a / (a - b)))
        pts = [p for i, p in enumerate(out) if (p - out[i - 1]).length > 1e-7]   # (a cut on a corner: no repeats)
        if len(pts) < 3:
            return []
    return pts


def run(rel, f, planes, ztop, design=LOOK1):
    """Paint a design on the face of a near run's part (front f: (s, c in 32nds)), its armour's top at ztop, clipped to
    the part's planes (bar its own face's: the paint stands just proud of it)."""
    s, c = f
    if s not in RUNS:
        return
    sv = Vector((s[0], s[1], 0.0))
    face = c / 32 + T.PAINT                         # (s . p of the paint)
    clip = [(n, k) for n, k in planes if not (abs(n.z) < 1e-9 and (n.normalized() - sv).length < 1e-6)]
    px = _px()

    def at(u, v):
        along = 0.5 - u / 32
        x, y = (face, along) if s == (1, 0) else (along, face)
        return Vector((x, y, ztop - v * px))
    for u0, u1, v0, v1, tone in design:
        pts = _clip([at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], clip)
        if pts:
            rel.poly(pts, "steel", 3, sv, fixed=T.SEAM_PASS or tone)


def cap(rel, f, planes, ztop):
    """The cut's seam on a part's top (CAP_SEAM), along its back (the hull's inner edge, toward the rooms; each part its
    own: they mitre where they meet), clipped to the part's planes (bar its top's)."""
    s, c = f
    inset, w, tone = CAP_SEAM
    sv = Vector((s[0], s[1], 0.0))
    b = c / 32 - HO.back(s)                         # (s . p of the back; a tile deep is 16 px on screen, along any
    band = [(sv, b + (inset + w) / 16), (-sv, -b - inset / 16)]     # front: s . p terms)
    top = ztop + T.PAINT
    clip = [(n, k) for n, k in planes if not (n.z > 0.99 and abs(n.x) + abs(n.y) < 1e-9)] + band
    span = 2.0                                      # (a square past the tile, cut to the band and the part)
    pts = _clip([Vector((-span, -span, top)), Vector((span, -span, top)), Vector((span, span, top)),
                 Vector((-span, span, top))], clip)
    if pts:
        rel.poly(pts, "steel", 3, Vector((0, 0, 1)), fixed=T.SEAM_PASS or tone)
