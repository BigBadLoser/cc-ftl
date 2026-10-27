"""The exterior hull as solid primitives (after hull 46's BottomD / SideD / Top / TopD): the base T3's section (upright
to the bend, leaning back to the top) run along each side of a tile that faces space, along its edge or its diagonal.
A stair-stepped 45 degree outline reads as one slanted wall (consecutive steps' pieces meet on the tile corners the
diagonal runs through), and the far side, seen from behind, as caps of the same solid. Each piece is the convex solid
inside a set of flat cuts (the tile's column, and for each side the outline's upright face, the lean, the hull's back),
so the shapes come straight from the run's own numbers."""
import math
from itertools import combinations

from mathutils import Vector

from . import core
from . import wall3d as T
from . import walls as W
from .wall3d_ext_geom import D, E, LEAN_RISE, PAINT, TOP, YS
from .wall3d_ext_t3 import TOP_PX

PIECES = {                          # each piece's sides facing space (x, y): along an edge, or the diagonal
    "bd1": [(1, 1)],                # BottomD1: the near diagonal, facing the camera
    "sd1": [(1, -1)],               # SideD1, SideD2: the ship's right and left diagonals
    "sd2": [(-1, 1)],
    "td1": [(-1, -1)],              # TopD1: the far diagonal (a cap: seen from behind)
    "tx": [(0, -1)],                # the far runs (along x, along y) and the far corner (Top): caps
    "ty": [(-1, 0)],
    "tc": [(-1, 0), (0, -1)],
    "t0": [],                       # a hull tile with no side on space (behind a concave corner): a plain cap
}
                                    # (".in" on a diagonal: the inner step behind two steps, the outline across its
                                    # outer corner a tile further out)
TOP_SEAM = (2 * TOP_PX, 2.75 * TOP_PX, YS[2])   # the run's seam along the top: this far in from the hull's back to
                                    # this, in this tone (in the same terms as the other depths: it runs on round
                                    # corners, diagonals and caps)




def outline(s):
    """Where a side's outline runs: s . p = this. A straight run's a cell short of the tile's edge; a diagonal's meets
    it on the tile's edge."""
    return E + 0.5 - 0.5 * (abs(s[0]) + abs(s[1]))


def deep(s):
    """A side's depths' scale (the lean's, the top's, the seam's; s . p per the run's depth): 1 along an edge; on a
    diagonal, so its bands are as thick on screen across their edges as a run's (a run's edges slant at the tile's
    angle, a camera-facing diagonal's run level and recede half as fast, a side diagonal's stand upright)."""
    if abs(s[0]) + abs(s[1]) < 2:
        return 1.0
    cos = math.cos(math.atan2(core.TILE_H, core.TILE_W))
    return 2 * cos if s[0] == s[1] else cos


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


JOINS = {"bd1": [(0, 1), (1, 0)], "sd1": [(1, 0), (0, -1)], "sd2": [(0, 1), (-1, 0)], "td1": [(-1, 0), (0, -1)]}
                                    # the straight runs each diagonal meets: a join piece ("<diag>.j<x><y>", the run's
                                    # side) on the run's tile next to the diagonal's end step


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


def _emit(rel, parts, fronts, skip):
    """Each part (ends: the planes its ends on tile edges lie on, rest: its other planes) as one solid, its faces
    toned by facing; its ends in a fan from their middle, each wedge in the tone of the face across its edge (the next
    piece hides an end, but anti-aliasing mixes it in along the join: so it reads as the surface it meets). Faces on
    a plane in `skip` (shared by two parts) left out."""
    for ends, rest in parts:
        planes = ends + rest
        faces = _solid(planes)

        def across(p, q, j):                                            # (the face sharing the edge p q)
            for pts, m, i in faces:
                if i != j and any((p - r).length < 1e-6 for r in pts) and any((q - r).length < 1e-6 for r in pts):
                    return YS[2] if i < len(ends) else _tone(m, fronts)
            return YS[2]
        for pts, m, i in faces:
            if any(planes[i] is q for q in skip):
                continue
            if i >= len(ends):
                rel.poly(pts, "steel", 3, m, fixed=_tone(m, fronts))
                continue
            mid = sum(pts, Vector()) / len(pts)
            for p, q in zip(pts, pts[1:] + pts[:1]):
                rel.poly([mid, p, q], "steel", 3, m, fixed=across(p, q, i))


def _seam(rel, part, s, c, g, H, up, clip=()):
    """The run's seam along a side's back (TOP_SEAM, g times its depths), on the top of a part, clipped."""
    a, b, col = TOP_SEAM
    band = [(s, c - g * (E + 0.5 - b)), (-s, g * (E + 0.5 - a) - c), (-up, -H), (up, H + PAINT)]
    for pts, m, _ in _solid([q for q in part if abs(q[0].z) < 1e-9] + band + list(clip)):
        if m.z > 0.85:
            rel.poly(pts, "steel", 3, m, fixed=col)


def piece(kind, H=None):
    """The piece `kind` as a primitive: PIECES' (".in": a diagonal's inner step), or a join ("<diag>.j<x><y>": the
    run's tile next to the diagonal's end step, its run's side (x, y), JOINS). The tile's column cut, for each side
    facing space, by the outline's upright face, the lean (D in at the top) and the hull's back; its top the hull's.
    Toned by facing (tops TOP, the lean near white, the upright faces the upright part's tone, the hull's back the
    top's: the roof meets it); its ends on the tile's edges in the tones of the surfaces they meet (the next piece hides
    them, but anti-aliasing mixes them in along the join: dark, they read as dotted seams).
    An inner step's hull runs on over the front corners of the two tiles behind it (its slice along the diagonal its
    own); a join is the run's piece and the diagonal's inner step at once: both sides' fronts cut it (meeting in a
    hip), and its hull reaches back to the deeper of their backs, so the slope's top, the seam and the back turn
    from the run's depth to the diagonal's on it. On a diagonal shallower than the run (a side one) that hip runs on
    a little into the end step: "<diag>.k<x><y>" is that step, carrying the run's cut and seam."""
    H = W.hull_top() if H is None else H
    base, *mods = kind.split(".")
    inner = mods == ["in"]
    join = mods[0][1:] if mods and mods[0][0] in "jk" else None
    step = bool(join) and mods[0][0] == "k"                             # (a step carrying the run's cut)
    k, up = D / LEAN_RISE, Vector((0, 0, 1))
    tile = [(Vector((1, 0, 0)), 0.5), (Vector((-1, 0, 0)), 0.5), (Vector((0, 1, 0)), 0.5), (Vector((0, -1, 0)), 0.5)]
    sides = PIECES[base]
    if join:
        run = (int(join[0]) if join[0] != "m" else -1, int(join[1]) if join[1] != "m" else -1)
        sides = [run] + sides
    fronts = []
    for sx, sy in sides:
        g = deep((sx, sy))
        diag = abs(sx) + abs(sy) == 2
        fronts.append((Vector((sx, sy, 0.0)), outline((sx, sy)) + (1 if diag and (inner or join and not step) else 0),
                       g))
    faces = [(up, H), (-up, 0.0)]
    for s, c, g in fronts:
        faces += [(s, c), (s + g * k * up, c - g * D + g * k * H)]      # its upright face, its lean (g D in at top)
    backs = [(-s, max(g, 1.0) * (E + 0.5) - c) for s, c, g in fronts]    # (the hull's back: never short of the
                                                                        # run's, so a tile is never left open)
    rel = T.Relief(f"ext_solid_{kind}")
    if not (inner or join):
        part = (tile, faces + backs)
        _emit(rel, [part], fronts, ())
        for s, c, g in fronts:
            _seam(rel, tile + faces + backs, s, c, g, H, up, [(s, c - g * D)])
        return rel.build()
    sd, cd, gd = fronts[-1]                                             # (the diagonal: its slice behind)
    t = Vector((sd.y, -sd.x, 0.0))
    lateral = [(t, 1.0), (-t, 1.0)]
    if inner:
        ends = [(n, c) for n, c in tile if n.dot(sd) > 0] + lateral
        part = (ends, faces + backs)
        _emit(rel, [part], fronts, ())
        _seam(rel, ends + faces + backs, sd, cd, gd, H, up, [(sd, cd - gd * D)])
        return rel.build()
    sr, cr, _ = fronts[0]
    edge = (-sr, E + 0.5 - cr)                                          # (the run's back: the tile's edge)
    beyond = (sr, cr - (E + 0.5))
    tops = [(s, c - g * D) for s, c, g in fronts]
    a_part = (tile, faces + [edge] + (backs[-1:] if step else []))     # (the run's tile, and the diagonal's hull
    b_part = ([(n, c) for n, c in tile if abs(n.dot(sr)) < 1e-9] + lateral, faces + [beyond, backs[-1]])  # behind it
    parts = [a_part, b_part] if gd > 1 and not step else [a_part]       # where that runs deeper)
    _emit(rel, parts, fronts, [beyond])
    a, b, _ = TOP_SEAM
    for planes in (p[0] + p[1] for p in parts):
        _seam(rel, planes + tops, sr, cr, 1, H, up, [(sd, cd - gd * (E + 0.5 - b))])
        _seam(rel, planes + tops, sd, cd, gd, H, up, [(sr, cr - (E + 0.5 - b))])
    return rel.build()
