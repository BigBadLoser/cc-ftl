"""Refinery stage 2, the sub-forms on the blockout (refinery.py): corner armour wrapping each corner, a triangular frame
across each end, pilasters between the bays, ribs round the rollers, a rail along the rim, collars, lips and window slits
on the stacks, the hatches' insides and a louvred panel on the terminal. Still grey; the
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
    hi = [Vector((*R.HI[i], RAIL[0])) + (Vector((*R.HI[h], 0)) - Vector((*R.HI[i], 0))).normalized() * wrap,
          Vector((*R.HI[i], RAIL[0])), Vector((*R.HI[j], RAIL[0])),
          Vector((*R.HI[j], RAIL[0])) + (Vector((*R.HI[nx], 0)) - Vector((*R.HI[j], 0))).normalized() * wrap]
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
    xb, xt, w, top = 0.92, 0.3, 0.12, RAIL[0] - 0.08
    for e in (-1, 1):
        proud(k, P, n, sorted_quad([(e * xb, 0.02), (e * (xb - w * 1.3), 0.02), (e * (xt - w), top), (e * xt, top)]), T,
              ARM)
    proud(k, P, n, [(-xt - 0.02, top), (xt + 0.02, top), (xt + 0.02, RAIL[0]), (-xt - 0.02, RAIL[0])], T, ARM)


def sorted_quad(q):
    """A quad's corners in counter-clockwise order (they come mirrored on one side)."""
    c = (sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4)
    return sorted(q, key=lambda p: math.atan2(p[1] - c[1], p[0] - c[0]))


def pilasters(k):
    """Ribs leaning with the long sides, between the far side's bays and either side of the terminal's slot."""
    for s, xs in ((-1, (-0.48, 0.48)), (1, (-0.55, 0.55))):
        for x in xs:
            w = 0.06 if s < 0 else 0.065
            proud(k, long_P(s), (s, 0, R.B / R.HT), [(x - w, 0.0), (x + w, 0.0), (x + w, RAIL[0]), (x - w, RAIL[0])], T,
                  ARM)


def roller_ribs(k):
    for v0, v1, kind in R.BAYS[-1]:
        for z, r in ((0.27, 0.14), (0.55, 0.13)):
            u = R.wall_u(-1, z) + (R.D - r - 0.01)
            n = max(2, int((v1 - v0) / 0.13))
            for i in range(1, n):
                v = v0 + (v1 - v0) * i / n
                tube(k, (u, v - 0.018, z), (u, v + 0.018, z), r + 0.018, R.G, sides=14, cap=R.GD)


RAIL = (R.HT - 0.04, R.HT + 0.05)        # the rim rail's foot and top: the armour rises into its underside


def rim_rail(k):
    """The armour cap's outer face round the rim (its top is the rim's own, refinery.deck), flush with the armour's face,
    so the corner plates, the pilasters and the end frames run up into it; its underside; its ends at the terminal's
    slot."""
    out = [Vector((*p, 0)) for p in R.rim_outline(T)]
    z0, z1 = RAIL[0], R.rim_top()
    up = lambda p, z: Vector((p.x, p.y, z))                                  # noqa: E731
    for i in range(8):
        j = (i + 1) % 8
        spans = [(0.0, 1.0)]
        if i == 2:                                                            # the +u side: the slot
            t0 = (-R.TS - out[i].y) / (out[j].y - out[i].y)
            t1 = (R.TS - out[i].y) / (out[j].y - out[i].y)
            spans = [(0.0, t0), (t1, 1.0)]
        for ta, tb in spans:
            oa, ob = out[i].lerp(out[j], ta), out[i].lerp(out[j], tb)
            ha = Vector((*R.HI[i], 0)).lerp(Vector((*R.HI[j], 0)), ta)
            hb = Vector((*R.HI[i], 0)).lerp(Vector((*R.HI[j], 0)), tb)
            face(k, [up(oa, z0), up(ob, z0), up(ob, z1), up(oa, z1)], _n(i), ARM)
            face(k, [up(oa, z0), up(ob, z0), up(hb, z0), up(ha, z0)], (0, 0, -1), R.GD)
            if i == 2:                                                        # its ends at the slot
                e, h = (oa, ha) if ta > 0 else (ob, hb)
                face(k, [up(e, z0), up(h, z0), up(h, z1), up(e, z1)], (0, 1 if ta > 0 else -1, 0), ARM)


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


def hatches(k):
    """Each hatch: a dark mouth in its recess's back wall, a chute sloping into it."""
    for v0, v1, kind in R.BAYS[1]:
        if kind == "terminal":
            continue
        z0, z1 = R.BZ
        ub = R.wall_u(1, z0) - R.D
        c, w = (v0 + v1) / 2, v1 - v0
        if kind in ("input", "output"):
            k.box(ub + 0.004, c, z0 + 0.22, 0.01, w - 0.2, 0.3, R.HOLE)
            face(k, [(ub, c - w / 2 + 0.06, z0 + 0.22), (ub, c + w / 2 - 0.06, z0 + 0.22),
                     (ub + R.D * 0.7, c + w / 2 - 0.06, z0 + 0.04), (ub + R.D * 0.7, c - w / 2 + 0.06, z0 + 0.04)],
                 (0.6, 0, 1), R.GT)


def terminal_forms(k):
    """A louvred panel low on the terminal's front."""
    uf = R.U - 0.02
    k.box(uf + 0.004, 0, 0.08, 0.01, 0.34, 0.34, R.GD)
    for i in range(4):
        k.box(uf + 0.012, 0, 0.11 + i * 0.075, 0.02, 0.3, 0.025, R.G, top=R.GT)


def conveyor(k):
    """The ore conveyor: a belt between side rails, on legs, rising along the deck from above the input hatch (the -v
    bay), turning on a turn plate at the top and running level into a feed port in the middle of the plinth."""
    w, uc, vt, zt = 0.26, 0.78, -0.12, R.H + 0.4                                    # width, line, the turn, its height
    lo, hi = Vector((uc, -1.34, R.H + 0.08)), Vector((uc, vt - 0.2, zt))
    d = hi - lo
    L, rx = d.length, math.atan2(d.z, d.y)
    mid = (lo + hi) / 2
    k.box(uc, mid.y, mid.z - 0.025, w, L, 0.05, R.HOLE, rx=rx)                      # the rising belt
    for e in (-1, 1):
        k.box(uc + e * (w / 2 + 0.02), mid.y, mid.z - 0.03, 0.04, L, 0.09, R.G, top=R.GT, rx=rx)
    for t in (0.25, 0.75):                                                          # its legs
        p = lo.lerp(hi, t)
        for e in (-1, 1):
            k.box(uc + e * (w / 2 + 0.02), p.y, R.H, 0.04, 0.04, p.z - R.H - 0.04, R.GD)
    k.box(uc, vt, zt - 0.08, w + 0.08, 0.4, 0.08, R.G, top=R.GT)                    # the turn plate
    k.box(uc, vt, zt - 0.002, w, w, 0.006, R.HOLE)
    k.cyl(uc, vt, zt + 0.004, 0.05, 0.02, R.GT, sides=10)                           # its pivot
    for e in (-1, 1):                                                               # and its legs
        k.box(uc + e * (w / 2 + 0.02), vt, R.H, 0.04, 0.04, zt - 0.08 - R.H, R.GD)
    u0, u1 = 0.48, uc - w / 2 - 0.04                                                # the level run into the port
    k.box((u0 + u1) / 2, vt, zt - 0.05, u1 - u0, w, 0.05, R.HOLE)
    for e in (-1, 1):
        k.box((u0 + u1) / 2, vt + e * (w / 2 + 0.02), zt - 0.06, u1 - u0, 0.04, 0.09, R.G, top=R.GT)
    k.box(0.44, vt, zt - 0.12, 0.06, 0.38, 0.26, R.G, top=R.GT)                     # the feed port's hood
    k.box(0.475, vt, zt - 0.06, 0.01, 0.3, 0.14, R.HOLE)                            # its mouth


def plinth_vents(k):
    """Heat vents let into the plinth's lower tier, under each stack and at its ends (they glow at stage 3)."""
    hw, hl = 0.56, R.V - R.B - R.RIM - 0.04
    for s in (-1, 1):
        for v in (-0.95, 0.0, 0.95):
            k.box(s * (hw - 0.012), v, R.H + 0.07, 0.03, 0.34, 0.1, R.HOLE)
        k.box(0, s * (hl - 0.012), R.H + 0.07, 0.5, 0.03, 0.1, R.HOLE)


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
    conveyor(k)
    plinth_vents(k)
