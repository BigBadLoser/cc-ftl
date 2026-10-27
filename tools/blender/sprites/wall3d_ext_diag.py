"""The exterior hull as solid pieces, one per tile, from its key (hull_outline: the stretch of the ship's outline
that reaches it): the base T3's section (upright to the bend, leaning back to the top, a seam along the top) run
along every side of the outline, its straight runs and its 45 degree diagonals alike (after hull 46's BottomD / SideD /
Top / TopD; the far side, seen from behind, as caps of the same solid). Along a convex stretch a tile's solid is all
its fronts' at once (where two meet, a hip), at a concave corner either side's; each part the convex solid inside a set
of flat cuts, so every shape (a join, an end step, an inner step behind a deep diagonal) comes from one rule."""
import math
from itertools import combinations

from mathutils import Vector

from . import core
from . import hull_outline as HO
from . import wall3d as T
from . import walls as W
from .wall3d_ext_geom import D, E, LEAN_RISE, PAINT, TOP, YS
from .wall3d_ext_t3 import TOP_PX

assert abs(HO.E - E) < 1e-9
TOP_SEAM = (2 * TOP_PX, 2.75 * TOP_PX, YS[2])   # the run's seam along the top: this far in from the hull's back to
                                    # this, in this tone (in the same terms as the other depths: it runs on round
                                    # corners, diagonals and caps)
SLOPES = (0.0, 0.5, 1.0, 2.0, math.inf)   # the clean pixel-line slopes a ridge on the silhouette is trued to (within
SNAP = math.radians(8)              # this): a near-45 degree line jogs a px where its stair-steps slip
TILE = [(Vector((1, 0, 0)), 0.5), (Vector((-1, 0, 0)), 0.5), (Vector((0, 1, 0)), 0.5), (Vector((0, -1, 0)), 0.5)]
UP = Vector((0, 0, 1))


def _solid(planes):
    """The convex solid inside planes (n, c: n . p <= c) as faces [(points in order, outward normal, plane index)]."""
    pts = []
    for (n1, c1), (n2, c2), (n3, c3) in combinations(planes, 3):
        det = n1.dot(n2.cross(n3))
        if abs(det) < 1e-9:
            continue
        p = (c1 * n2.cross(n3) + c2 * n3.cross(n1) + c3 * n1.cross(n2)) / det
        if all(n.dot(p) <= c + 1e-6 for n, c in planes) and not any((p - q).length < 1e-6 for q in pts):
            pts.append(p)
    faces, seen = [], []
    for i, (n, c) in enumerate(planes):
        on = [p for p in pts if abs(n.dot(p) - c) < 1e-6]
        key = (n.normalized(), c / n.length)
        if len(on) < 3 or any((key[0] - m).length < 1e-9 and abs(key[1] - d) < 1e-9 for m, d in seen):
            continue                                                    # (a plane twice: its first, else they fight)
        seen.append(key)
        mid = sum(on, Vector()) / len(on)
        u = (on[0] - mid).normalized()
        v = n.normalized().cross(u)
        on.sort(key=lambda p: math.atan2((p - mid).dot(v), (p - mid).dot(u)))
        faces.append((on, n.normalized(), i))
    return faces


def _tone(m, fronts):
    """A face's tone by its facing: tops TOP, the lean near white, the upright faces the upright part's tone, the
    hull's back the top's (the roof's edge meets it there)."""
    if m.z > 0.85:
        return TOP
    if m.z > 0.3:
        return YS[5]
    if abs(m.z) < 0.3 and any(abs(m.dot(s.normalized()) - 1) < 1e-6 for s, _, _ in fronts):
        return YS[2]
    return TOP


def _emit(rel, parts, fronts, skip, tones=None):
    """Each part (ends: the planes its ends on tile edges lie on, rest: its other planes) as one solid, its faces
    toned by facing; its ends in a fan from their middle, each wedge in the tone of the face across its edge (the next
    piece hides an end, but anti-aliasing mixes it in along the join: so it reads as the surface it meets). Faces on
    a plane in `skip` (shared by two parts) left out, on one in `tones` (by id) in its tone."""
    for ends, rest in parts:
        planes = ends + rest
        faces = _solid(planes)

        def tone(m, i):
            return (tones or {}).get(id(planes[i])) or _tone(m, fronts)

        def across(p, q, j):                                            # (the face sharing the edge p q)
            for pts, m, i in faces:
                if i != j and any((p - r).length < 1e-6 for r in pts) and any((q - r).length < 1e-6 for r in pts):
                    return YS[2] if i < len(ends) else tone(m, i)
            return YS[2]
        for pts, m, i in faces:
            if any(planes[i] is q for q in skip):
                continue
            if i >= len(ends):
                rel.poly(pts, "steel", 3, m, fixed=tone(m, i))
                continue
            mid = sum(pts, Vector()) / len(pts)
            for p, q in zip(pts, pts[1:] + pts[:1]):
                rel.poly([mid, p, q], "steel", 3, m, fixed=across(p, q, i))


def _lift(h):
    """A plan half-plane (a, b, c) as an upright cut."""
    return (Vector((h[0], h[1], 0.0)), h[2])


def _front(f):
    """A front's (s, c, g) in tile units."""
    return Vector((f[0][0], f[0][1], 0.0)), f[1] / 32, HO.deep(f[0])


def _part(g, before, after, H):
    """A convex run's parts [(ends, rest)], the cuts they share, its fronts (s, c, g) and its ridge cuts (_ridges):
    all its fronts' upright faces and leans (D in at the top) cut it, and a concave corner's other side where their
    depths meet (that cut shared). No back: the roof (flush with the hull's top) lies over the rest (roof()), so the
    solid is never cut across a face seen (a cut leaks through anti-aliasing as a dotted line)."""
    k = D / LEAN_RISE
    fronts = [_front(f) for f in g]
    faces = [(UP, H), (-UP, 0.0)]
    for s, c, w in fronts:
        faces += [(s, c), (s + w * k * UP, c - w * D + w * k * H)]
    side = [_lift(HO.nearer(o, f)) for o, f in ((before, g[0]), (after, g[-1])) if o]
    ridges = _ridges(fronts, H, k)
    if not ridges:
        return [(TILE, faces + side)], side, fronts, ()
    under, over = (UP, H - LEAN_RISE), (-UP, LEAN_RISE - H)              # (split at the bend, a crease all round:
    return ([(TILE, faces + side + [under]), (TILE, faces + side + [over] + ridges)],    # the cuts only over it)
            side + [under, over], fronts, ridges)


def _screen(d):
    """A direction's on-screen px (x right, y up)."""
    return Vector(((d.x - d.y) * core.TILE_W / 2, -(d.x + d.y) * core.TILE_H / 2 + d.z * core.ZPX))


def _ridges(fronts, H, k):
    """Cuts truing the ridges on the silhouette: where two sides' leans meet at a convex corner, one facing the camera
    and one away, their ridge is the solid's outline on screen; a cut along the view through the bend's corner, at the
    nearest clean slope (SLOPES) that takes the sliver beyond the whole ridge, makes that outline a clean px line
    (edge-on, it shows no face; the part under the bend, uncut, meets it at that corner)."""
    view = Vector((1.0, 1.0, core.TILE_H / core.ZPX))                    # (the direction that projects to a point)
    zb, out = H - LEAN_RISE, []
    for (sa, ca, ga), (sb, cb, gb) in zip(fronts, fronts[1:]):
        lit = [(s + w * k * UP).dot(view) > 0 for s, w in ((sa, ga), (sb, gb))]
        det = sa.x * sb.y - sa.y * sb.x
        if lit[0] == lit[1] or abs(det) < 1e-9:
            continue

        def meet(a, b, z):
            return Vector(((a * sb.y - b * sa.y) / det, (sa.x * b - sb.x * a) / det, z))
        p0, p1 = meet(ca, cb, zb), meet(ca - ga * D, cb - gb * D, H)    # (the ridge: the bend's corner to the top's)
        d = _screen(p1 - p0)
        ang = math.atan2(abs(d.y), abs(d.x))
        inside = (p0 + p1) / 2 - (sa / sa.length + sb / sb.length) * 0.25
        for want in sorted(SLOPES, key=lambda m: abs(math.atan(m) - ang)):
            a = math.atan(want)
            if abs(a - ang) > SNAP or abs(a - ang) < 1e-4:
                break
            t = Vector((math.copysign(math.cos(a), d.x), math.copysign(math.sin(a), d.y)))
            u = Vector((t.x / (core.TILE_W / 2) - t.y / (core.TILE_H / 2),
                        -t.x / (core.TILE_W / 2) - t.y / (core.TILE_H / 2), 0.0)) / 2     # (level, drawn along t)
            n = u.cross(view).normalized()
            n = n if n.dot(inside - p0) < 0 else -n
            if n.dot(p1 - p0) >= -1e-9:                                 # (through the bend's corner, where the part
                out.append((n, n.dot(p0)))                              # under the bend meets it; the whole ridge
                break                                                   # on the cut side)
    return out


def _seam(rel, part, g, H):
    """The run's seam (TOP_SEAM) on the part's top, where the nearest front's depth is in its band."""
    a, b, col = TOP_SEAM
    lo, hi = HO.LIP - b, HO.LIP - a
    for ends, rest in [part]:
        cut = [q for q in ends + rest if abs(q[0].z) < 1e-9] + [(-UP, -H), (UP, H + PAINT)]
        cut += [_lift(HO.at_least(f, lo)) for f in g]
        for i, f in enumerate(g):
            band = [_lift(tuple(-v for v in HO.at_least(f, hi)))] + [_lift(HO.at_least(h, hi)) for h in g[:i]]
            for pts, m, _ in _solid(cut + band):
                if m.z > 0.85:
                    rel.poly(pts, "steel", 3, m, fixed=col)


def piece(key, H=None):
    """The hull piece of a tile with this key (hull_outline.key). Toned by facing (tops TOP, the lean near white, the
    upright faces the upright part's tone); its ends on the tile's edges
    in the tones of the surfaces they meet (the next piece hides them, but anti-aliasing mixes them in along the join:
    dark, they read as dotted seams)."""
    H = W.hull_top() if H is None else H
    rel = T.Relief(f"ext_solid_{HO.name(key)}")
    for stretch in HO.parse(key):
        for g, before, after in HO.groups(stretch):
            parts, shared, fronts, ridges = _part(g, before, after, H)
            _emit(rel, parts, fronts, shared, {id(q): YS[5] for q in ridges})
            _seam(rel, parts[-1], g, H)
    return rel.build()


def roof(key, H=None):
    """A stand-in for the roof over the rest of the tile (flush with the hull's top, drawn over its piece: nothing
    stands over the top to hide it): behind every back (hull_outline.back)."""
    H = W.hull_top() if H is None else H
    rel = T.Relief(f"roof_{HO.name(key)}")
    blocks = [[]]
    for stretch in HO.parse(key):
        blocks = []
        for g, before, after in HO.groups(stretch):
            side = [_lift(HO.nearer(o, f)) for o, f in ((before, g[0]), (after, g[-1])) if o]
            blocks.append(side + [_lift(HO.at_least(f)) for f in g] + [_lift(HO.at_least(f, HO.back(f[0]))) for f in g])
    faces = [f for cut in blocks for f in _solid(TILE + [(UP, H), (-UP, 0.0)] + cut)
             if f[1].z > 0.85 and sum(((p - f[0][0]).cross(q - f[0][0])).length for p, q in zip(f[0], f[0][1:])) > 1e-6]
    for pts, m, _ in faces:                                             # (its top only: an overlay)
        rel.poly(pts, "steel", 3, m, fixed=TOP)
    return rel.build() if faces else []                                 # (none: the hull covers the tile)
