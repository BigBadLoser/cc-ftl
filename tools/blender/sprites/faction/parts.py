"""The parts the faction faces are built from (each look's face function lays them on wall3d's faces): prisms along a
face, corner pieces round a chamfer, tubes, pipes, brackets, painted patches. Families: wall / blue (the look's wall
/ hull ramp), ochre (its trim), rose (its second tone)."""
import math

from mathutils import Vector

from .. import wall3d as T

PX, PAINT, LINE = T.PX, T.PAINT, T.LINE


PZ = 1 / 39                         # one art px up


def body(hull):
    return "blue" if hull else "wall"


def glow(k, ax, plane, u0, u1, z0, z1, col, on=PAINT):
    """An emissive strip (palette name col) on a part standing `on` proud."""
    k.poly([T.P(ax, plane, u, z, on + PAINT) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], "wall", 0,
           T.OUT(ax), fixed=col)


def ALONG(ax):
    return Vector((1, 0, 0)) if ax == "y" else Vector((0, 1, 0))


def prism(k, ax, plane, u0, u1, prof, fam, lvl, cols=None, cap=None, mitre=(False, False)):
    """A part over [u0, u1] with a (d, z) cross-section (a convex polygon); cols: a fixed palette name per edge (edge
    i runs from prof[i] to prof[i + 1]), cap: one for its two ends (or a pair: its u0 end's, its u1 end's). A mitred
    end (an outer corner at u0 / u1) runs on by each point's depth (times the mitre: True / 1 for a square corner, its
    diagonal; sqrt 2 - 1 for a 45-degree chamfer, the 135-degree joint's bisector), so it meets the next part."""
    o, up = T.OUT(ax), Vector((0, 0, 1))
    ua = [u0 - (mitre[0](d, z) if callable(mitre[0]) else d * float(mitre[0])) for d, z in prof]  # (a callable:
    ub = [u1 + (mitre[1](d, z) if callable(mitre[1]) else d * float(mitre[1])) for d, z in prof]  # the run-on)
    n = len(prof)
    dc, zc = sum(q[0] for q in prof) / n, sum(q[1] for q in prof) / n
    for i in range(n):
        (d0, z0), (d1, z1) = prof[i], prof[(i + 1) % n]
        pd, pz = z1 - z0, d0 - d1
        if pd * ((d0 + d1) / 2 - dc) + pz * ((z0 + z1) / 2 - zc) < 0:
            pd, pz = -pd, -pz
        j = (i + 1) % n
        k.poly([T.P(ax, plane, ua[i], z0, d0), T.P(ax, plane, ub[i], z0, d0), T.P(ax, plane, ub[j], z1, d1),
                T.P(ax, plane, ua[j], z1, d1)], fam, lvl, o * pd + up * pz, fixed=cols[i] if cols else None)
    caps = cap if isinstance(cap, tuple) else (cap, cap)
    for us, sg, cp in ((ua, -1, caps[0]), (ub, 1, caps[1])):
        k.poly([T.P(ax, plane, u, z, d) for u, (d, z) in zip(us, prof)], fam, lvl, ALONG(ax) * sg + o * 0.01, fixed=cp)


def tube_prof(dc, zc, r, n=8):
    """A round lit tube's section and its edge colours: a lit orange front line, plain orange round it, darker
    underneath."""
    prof = [(dc + r * math.cos(2 * math.pi * i / n + math.pi / n), zc + r * math.sin(2 * math.pi * i / n + math.pi / n))
            for i in range(n)]
    cols = []
    for i in range(n):
        s = math.sin(2 * math.pi * (i + 1) / n)
        c = math.cos(2 * math.pi * (i + 1) / n)
        cols.append("fxO" if c > 0.9 else "orL" if s > -0.2 else "orM")
    return prof, cols


def tube(k, ax, plane, u0, u1, dc, zc, r, n=8, mitre=(0.0, 0.0)):
    """A round lit tube along the face (tube_prof)."""
    prof, cols = tube_prof(dc, zc, r, n)
    prism(k, ax, plane, u0, u1, prof, "wall", 0, cols, "or", mitre=mitre)


def bracket(k, ax, plane, u0, u1, dc, zc, rb, zlo, zhi, fam, lvl, cap=None):
    """An arm from the face out over a tube, rounded over its top, its front straight down a little past the axis and
    its underside flat back to the face (any facet turned down toward the camera meets it near edge-on and breaks
    into specks at the art's size). zlo is unused."""
    arc = [(dc + rb * math.cos(math.radians(t)), zc + rb * math.sin(math.radians(t))) for t in (90, 45, 0)]
    zb = zc - 0.4 * rb
    prism(k, ax, plane, u0, u1, [(0.0, zhi)] + arc + [(dc + rb, zb), (0.0, zb)], fam, lvl, cap=cap)


def cuts(a, b, off):
    """Seams `off` in from each tile edge, per tile part of [a, b] (as wall3d.skirt lays its plates)."""
    return [u for s0, s1 in T.spans(a, b) if s1 - s0 > 2 * off + 1e-3 for u in (s0 + off, s1 - off)]


def seams(a, b):
    """The tile seams strictly inside [a, b]."""
    return [c - 0.5 for c in range(-1, 3) if a + 1e-6 < c - 0.5 < b - 1e-6]


OPP = {"+x": "-x", "-x": "+x", "+y": "-y", "-y": "+y"}


def _slab(z0, z1, d):
    return [(0.0, z0), (d, z0), (d, z1), (0.0, z1)]


def pipe(k, pts, r, fam, lvl, n=6, flat=None):
    """A round pipe along a horizontal polyline (one height), r its radius. flat = (top, sides): a thin pipe drawn
    square in section, its top one palette name and its sides another, so it reads as a clean lit line at the art's
    size (round facets each take their own shade and speckle)."""
    up = Vector((0, 0, 1))
    off = math.pi / n if flat else 0.0
    rings = []
    for i, p_ in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = t.cross(up).normalized()
        rings.append([p_ + (side * math.cos(2 * math.pi * j / n + off) + up * math.sin(2 * math.pi * j / n + off)) * r
                      for j in range(n)])
    for a_, b_, pa, pb in zip(rings, rings[1:], pts, pts[1:]):
        c = (pa + pb) / 2
        for j in range(n):
            q = [a_[j], b_[j], b_[(j + 1) % n], a_[(j + 1) % n]]
            o = sum(q, Vector()) / 4 - c
            k.poly(q, fam, lvl, o, fixed=(flat[0] if o.normalized().z > 0.5 else flat[1]) if flat else None)


def bezier(p0, p1, p2, n=8):
    return [p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t for t in (i / n for i in range(n + 1))]


R2 = 2 ** -0.5


def corner_piece(k, X, Y, C, prof, fam, lvl, cols=None, cap=None, t=(0.0, 1.0)):
    """A face part's profile ((d, z): d out from the wall's line) carried round an outer corner chamfered C along each
    axis: each point runs from (X - C + d, Y + d) on the y face to (X + d, Y - C + d) on the x face. So every
    chamfer on the corner, at any depth, has the same width and the same two edges on screen (the joints run along
    x = y, straight at the camera), and it meets the faces' parts (prism with mitre=True at u = X - C). t: only
    that part of the chamfer's width (0 its y face's edge, 1 its x face's)."""
    n_, up = Vector((R2, R2, 0)), Vector((0, 0, 1))
    c = C if callable(C) else (lambda z: C)             # (C a callable: the chamfer by height)
    J1, J2 = ([Vector((X - (1 - s) * c(z) + d, Y + d - s * c(z), z)) for d, z in prof] for s in t)
    m = len(prof)
    dc, zc = sum(q[0] for q in prof) / m, sum(q[1] for q in prof) / m
    for i in range(m):
        j = (i + 1) % m
        (d0, z0), (d1, z1) = prof[i], prof[j]
        pd, pz = z1 - z0, d0 - d1
        if pd * ((d0 + d1) / 2 - dc) + pz * ((z0 + z1) / 2 - zc) < 0:
            pd, pz = -pd, -pz
        k.poly([J1[i], J2[i], J2[j], J1[j]], fam, lvl, n_ * pd + up * pz, fixed=cols[i] if cols else None)
    k.poly(J1, fam, lvl, Vector((-1, 0, 0)), fixed=cap)
    k.poly(J2, fam, lvl, Vector((0, -1, 0)), fixed=cap)


PX, PAINT, LINE = T.PX, T.PAINT, T.LINE


def flat(k, ax, plane, u0, u1, z0, z1, d, col):
    """A patch of one palette name (col: a fixed colour, lit or not) standing d proud."""
    k.poly([T.P(ax, plane, u, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], "wall", 0, T.OUT(ax),
           fixed=col)
