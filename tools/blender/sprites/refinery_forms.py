"""Refinery stage 2, the sub-forms on the blockout (refinery.py): corner armour wrapping each corner, a triangular frame
across each end, pilasters between the bays, ribs round the rollers, a rail along the rim, collars, lips and window slits
on the stacks, a belt and ribs on the spine, the hatches' insides and a louvred panel on the terminal. Still grey; the
armour (what turns orange) is a warm light grey (ARM) so it reads apart."""
import math

from mathutils import Vector

from . import refinery as R
from .steelkit import face, tube

ARM = "lvW2"                          # the armour, orange at stage 3
T = 0.035                             # how proud the armour stands


def _n(i):
    """The outward horizontal normal of the hull's octagon edge i."""
    (a, b), (c, d) = R.LO[i], R.LO[(i + 1) % 8]
    n = Vector((d - b, -(c - a), 0)).normalized()
    return n if n.dot(Vector(((a + c) / 2, (b + d) / 2, 0))) > 0 else -n


def corner_armour(k, i, wrap=0.12):
    """Armour over the corner chamfer (octagon edge i, odd) and wrapping onto the faces either side, mitred."""
    h, j, nx = (i - 1) % 8, (i + 1) % 8, (i + 2) % 8
    lo = [Vector((*R.LO[i], 0)) + (Vector((*R.LO[h], 0)) - Vector((*R.LO[i], 0))).normalized() * wrap,
          Vector((*R.LO[i], 0)), Vector((*R.LO[j], 0)),
          Vector((*R.LO[j], 0)) + (Vector((*R.LO[nx], 0)) - Vector((*R.LO[j], 0))).normalized() * wrap]
    hi = [Vector((*R.HI[i], R.HT)) + (Vector((*R.HI[h], 0)) - Vector((*R.HI[i], 0))).normalized() * wrap,
          Vector((*R.HI[i], R.HT)), Vector((*R.HI[j], R.HT)),
          Vector((*R.HI[j], R.HT)) + (Vector((*R.HI[nx], 0)) - Vector((*R.HI[j], 0))).normalized() * wrap]
    segs = [_n(h), _n(i), _n(j)]
    vn = [segs[0], (segs[0] + segs[1]).normalized() / math.cos(math.pi / 8), (segs[1] + segs[2]).normalized() /
          math.cos(math.pi / 8), segs[2]]
    lo_o = [p + n * T for p, n in zip(lo, vn)]
    hi_o = [p + n * T for p, n in zip(hi, vn)]
    for a in range(3):
        face(k, [lo_o[a], lo_o[a + 1], hi_o[a + 1], hi_o[a]], segs[a], ARM)
        face(k, [hi[a], hi[a + 1], hi_o[a + 1], hi_o[a]], (0, 0, 1), ARM)
    for e, d in ((0, lo[0] - lo[1]), (3, lo[3] - lo[2])):
        face(k, [lo[e], lo_o[e], hi_o[e], hi[e]], d, ARM)


def proud(k, P, n, poly, t, col, cap=None):
    """A plate t proud of a face: P(x, y) maps the face's own coordinates to a point on it, n is its outward normal,
    poly a convex outline in (x, y)."""
    n = Vector(n).normalized()
    inner = [Vector(P(x, y)) for x, y in poly]
    outer = [p + n * t for p in inner]
    c = sum(inner, Vector()) / len(inner)
    face(k, outer, n, col)
    for a in range(len(poly)):
        b = (a + 1) % len(poly)
        face(k, [inner[a], inner[b], outer[b], outer[a]], (inner[a] + inner[b]) / 2 - c, cap or col)


def long_P(s):
    return lambda v, z: (R.wall_u(s, z), v, z)


def end_P(sv):
    return lambda u, z: (u, sv * (R.V - R.B * z / R.HT), z)


def end_frame(k, sv):
    """The triangular frame across an end: two legs leaning in from the bottom corners, a bar along the top."""
    P, n = end_P(sv), (0, sv, R.B / R.HT)
    xb, xt, w, top = 0.92, 0.3, 0.12, R.HT - 0.08
    for e in (-1, 1):
        proud(k, P, n, sorted_quad([(e * xb, 0.02), (e * (xb - w * 1.3), 0.02), (e * (xt - w), top), (e * xt, top)]), T,
              ARM)
    proud(k, P, n, [(-xt - 0.02, top), (xt + 0.02, top), (xt + 0.02, R.HT - 0.01), (-xt - 0.02, R.HT - 0.01)], T, ARM)


def sorted_quad(q):
    """A quad's corners in counter-clockwise order (they come mirrored on one side)."""
    c = (sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4)
    return sorted(q, key=lambda p: math.atan2(p[1] - c[1], p[0] - c[0]))


def pilasters(k):
    """Ribs leaning with the long sides, between the far side's bays and either side of the terminal's slot."""
    for s, xs in ((-1, (-0.48, 0.48)), (1, (-0.55, 0.55))):
        for x in xs:
            w = 0.06 if s < 0 else 0.065
            proud(k, long_P(s), (s, 0, R.B / R.HT), [(x - w, 0.0), (x + w, 0.0), (x + w, R.HT - 0.01),
                                                     (x - w, R.HT - 0.01)], T, ARM)


def roller_ribs(k):
    for v0, v1, kind in R.BAYS[-1]:
        for z, r in ((0.27, 0.14), (0.55, 0.13)):
            u = R.wall_u(-1, z) + (R.D - r - 0.01)
            n = max(2, int((v1 - v0) / 0.13))
            for i in range(1, n):
                v = v0 + (v1 - v0) * i / n
                tube(k, (u, v - 0.018, z), (u, v + 0.018, z), r + 0.018, R.G, sides=14, cap=R.GD)


def rim_rail(k):
    """A rail along the rim's outer edge, all round but the terminal's slot."""
    ring = [Vector((*p, R.HT)) for p in R.HI]
    inset = 0.05
    c = Vector((0, 0, R.HT))
    for i in range(8):
        a, b = ring[i], ring[(i + 1) % 8]
        if i == 2:
            parts = [(a, Vector((a.x, -R.TS, R.HT))), (Vector((b.x, R.TS, R.HT)), b)]
        else:
            parts = [(a, b)]
        for p, q in parts:
            pi, qi = p + (c - p).normalized() * inset, q + (c - q).normalized() * inset
            up = Vector((0, 0, 0.05))
            face(k, [p + up, q + up, qi + up, pi + up], (0, 0, 1), ARM)
            face(k, [p, q, q + up, p + up], p + q - 2 * c, ARM)
            face(k, [pi, qi, qi + up, pi + up], 2 * c - p - q, R.GD)


def stack_forms(k, u, v, z0, z1, r):
    """A collar at the stack's foot, a lip at its top, two window slits on its crew side."""
    k.cyl(u, v, z0, r + 0.05, 0.12, ARM, top=ARM, sides=20)
    annulus(k, u, v, z1 - 0.06, z1 + 0.005, r + 0.03, 0.26, ARM)
    for a in (-0.42, 0.42):
        cu, cv = u + (r + 0.004) * math.cos(a), v + (r + 0.004) * math.sin(a)
        k.box(cu, cv, z0 + 0.2, 0.03, 0.09, 0.22, R.HOLE, rz=a)


def annulus(k, u, v, z0, z1, ro, ri, col, n=20):
    """A ring: its outer wall and its top, open in the middle."""
    ring = lambda rad, z: [Vector((u + rad * math.cos(i * math.tau / n), v + rad * math.sin(i * math.tau / n), z))   # noqa: E731
                           for i in range(n)]
    o0, o1, i1 = ring(ro, z0), ring(ro, z1), ring(ri, z1)
    for i in range(n):
        j = (i + 1) % n
        out = (o0[i] + o0[j]) / 2 - Vector((u, v, (o0[i].z)))
        face(k, [o0[i], o0[j], o1[j], o1[i]], out, col)
        face(k, [o1[i], o1[j], i1[j], i1[i]], (0, 0, 1), col)


def spine_forms(k, u0, u1, v0, v1, z0, z1):
    """A belt round the spine and ribs on its long faces between the stacks."""
    k.box((u0 + u1) / 2, (v0 + v1) / 2, z0 + 0.3, u1 - u0 + 0.06, v1 - v0 + 0.06, 0.06, R.G, top=R.GT)
    for u in (u0, u1):
        for v in (-0.47, 0.47):
            k.box(u, v, z0, 0.05, 0.1, z1 - z0, R.G, top=R.GT)


def hatches(k):
    """The input's mouth, a chute sloping into it inside its recess; the output's door on its recess's back wall."""
    for v0, v1, kind in R.BAYS[1]:
        if kind == "terminal":
            continue
        z0, z1 = R.BZ
        ub = R.wall_u(1, z0) - R.D
        c, w = (v0 + v1) / 2, v1 - v0
        if kind == "input":
            k.box(ub + 0.004, c, z0 + 0.22, 0.01, w - 0.2, 0.3, R.HOLE)
            face(k, [(ub, c - w / 2 + 0.06, z0 + 0.22), (ub, c + w / 2 - 0.06, z0 + 0.22),
                     (ub + R.D * 0.7, c + w / 2 - 0.06, z0 + 0.04), (ub + R.D * 0.7, c - w / 2 + 0.06, z0 + 0.04)],
                 (0.6, 0, 1), R.GT)
        else:
            k.box(ub + 0.015, c, z0 + 0.05, 0.03, w - 0.16, z1 - z0 - 0.1, R.G, top=R.GT)
            k.box(ub + 0.032, c, (z0 + z1) / 2 - 0.01, 0.006, w - 0.16, 0.02, R.GD)
            k.box(ub + 0.04, c + w / 2 - 0.16, (z0 + z1) / 2 - 0.06, 0.02, 0.05, 0.1, R.GT)


def terminal_forms(k):
    """A louvred panel low on the terminal's front."""
    uf = R.U - 0.02
    k.box(uf + 0.004, 0, 0.08, 0.01, 0.34, 0.34, R.GD)
    for i in range(4):
        k.box(uf + 0.012, 0, 0.11 + i * 0.075, 0.02, 0.3, 0.025, R.G, top=R.GT)


def forms(k):
    for i in (1, 3, 5, 7):
        corner_armour(k, i)
    for sv in (-1, 1):
        end_frame(k, sv)
    pilasters(k)
    roller_ribs(k)
    rim_rail(k)
    hatches(k)
    terminal_forms(k)
