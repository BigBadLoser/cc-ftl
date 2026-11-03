"""Scrapper module (4x2, solid crafting workstation): grey blockout, 4 rotations.

Built as continuous shells, not one block per tile. Authoring frame: L 0..4 along the machine from the hatch end, D 0..2
across it (0 back, 2 front: the access side), z up; 1 unit = 1 tile; on the grid x = L, y = D. Rotation 3 shows it as the
reference's R0 view (hatch end lower left, front lower right).

Massing (heights in tiles; profile along L confirmed with the user):
  body         one profile along L for both rows, symmetric end to end: end wall 0.62, slope to 1.16 at 0.5 in, flat;
               the centre two tiles (L 1..3) at 1.33, with a short slope up inside each end of them
  bay          L 2..3, front row: cut out of the body; the shredder drum (top 0.74) on a low cradle
Origin of the sprite = centre of the front-most footprint tile (like the refinery). Rotation r turns the machine as the sim
does: (x, y) -> (H - y, x) per step, W and H swapping.
"""
import math
import os

from . import core

FOOTPRINT = (4, 2)
ACCESS = (1, 2)

STEEL, STEEL_T, DARK, GM, GMD, PLATE, LIGHT, LIT = "steel", "steelL", "dark", "gm", "gmD", "plate", "medWhite", "cyan"
BODY, BODY_D = "scBody", "scBodyD"   # the body is coloured (palette set "scrapper"); details stay grey while blocked out
RUST, RUST_D = "rust", "rustD"  # the drum and yoke (dark) with lighter raised bands
BODY_S2 = "scBodyS2"  # a step below BODY_S: the recess frame
BODY_S = "scBodyS"   # the body's sloped faces: one ramp step below BODY (its 0.82 shade), so slopes read apart from tops
BASE = 0.06          # dark plinth band


def rotated_point(x, y, rotation):
    w, h = FOOTPRINT
    for _ in range(rotation):
        x, y = h - 1 - y, x
        w, h = h, w
    return x, y


def _normal(pts):
    n = [0.0, 0.0, 0.0]
    for i in range(len(pts)):
        p, q = pts[i], pts[(i + 1) % len(pts)]
        n[0] += (p[1] - q[1]) * (p[2] + q[2])
        n[1] += (p[2] - q[2]) * (p[0] + q[0])
        n[2] += (p[0] - q[0]) * (p[1] + q[1])
    return n


class _Build:
    def __init__(self, rot, name):
        self.rot, self.m = rot, core.Mesh(name)
        self.W, self.H = FOOTPRINT
        for _ in range(rot):
            self.W, self.H = self.H, self.W

    def P(self, L, D, z):
        """Authoring point (L, D, z) -> mesh-space (x, y, z): rotate, centre on the front-most tile."""
        x, y = L, D
        w, h = FOOTPRINT
        for _ in range(self.rot):
            x, y = h - y, x
            w, h = h, w
        return (x - (self.W - 0.5), y - (self.H - 0.5), z)

    def face(self, pts, col, out, top=None):
        """A polygon of mesh-space points wound so its normal points along `out`; `top` colours it if it faces up."""
        n = _normal(pts)
        if n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0:
            pts, n = pts[::-1], [-v for v in n]
        ln = math.sqrt(sum(v * v for v in n)) or 1.0
        self.m.poly([core.G(*p) for p in pts], top if top and n[2] / ln > 0.7 else col, flip=True)

    def loft(self, rings, col=BODY, top=None, caps=(True, True), skip=()):
        """A shell swept along L through cross-sections across D: rings = [(L, [(d, z), ...]), ...], L increasing, every
        ring with the same number of points (bottom-back corner first, round the top, bottom-front corner last). A
        point pair that coincides in one ring and not the next makes a triangle (a step's side wall). caps, per end:
        True closes the whole end, False leaves it open (another piece carries on), a [(d, z), ...] closes that part.
        skip lists (segment, side) faces to leave out, for a wall that is built with an opening in it."""
        dm = sum(d for d, _ in rings[0][1]) / len(rings[0][1])
        # Every side face is wound the same way by the ring order, so one sign (from the back wall, which faces -D)
        # orients them all: a centroid test cannot tell which way a wall on the row boundary faces.
        (La, ra), (Lb, rb) = rings[0], rings[1]
        w = [self.P(La, *ra[0]), self.P(La, *ra[1]), self.P(Lb, *rb[1]), self.P(Lb, *rb[0])]
        n0, o0 = _normal(w), [x - y for x, y in zip(self.P(La, ra[0][0] - 1, 0.5), self.P(La, ra[0][0], 0.5))]
        sign = 1 if sum(x * y for x, y in zip(n0, o0)) > 0 else -1
        for k, ((La, ra), (Lb, rb)) in enumerate(zip(rings, rings[1:])):
            for j in range(len(ra) - 1):
                if (k, j) in skip:
                    continue
                q = [self.P(La, *ra[j]), self.P(La, *ra[j + 1]), self.P(Lb, *rb[j + 1]), self.P(Lb, *rb[j])]
                q = [p for i, p in enumerate(q) if math.dist(p, q[i - 1]) > 1e-9]
                if len(q) < 3:
                    continue
                n = [sign * v for v in _normal(q)]
                nz = n[2] / (math.sqrt(sum(v * v for v in n)) or 1.0)
                self.face(q, BODY_S if col == BODY and 0.05 < nz < 0.95 else col, n, top)
        for (L, r), s, cap in ((rings[0], -1, caps[0]), (rings[-1], 1, caps[1])):
            if cap is False:
                continue
            poly = r if cap is True else cap
            poly = [p for i, p in enumerate(poly) if math.dist(p, poly[i - 1]) > 1e-9]
            a, b = self.P(L, dm, 0.5), self.P(L + s, dm, 0.5)
            self.face([self.P(L, d, z) for d, z in poly], col, (b[0] - a[0], b[1] - a[1], b[2] - a[2]), top)

    def prism_D(self, prof, D0, D1, col, top=None):
        """A convex (L, z) profile extruded across D from D0 to D1."""
        a = [self.P(L, D0, z) for L, z in prof]
        b = [self.P(L, D1, z) for L, z in prof]
        n = len(prof)
        ce = [sum(p[k] for p in a + b) / (2 * n) for k in range(3)]
        for i in range(n):
            q = [a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]]
            c = [sum(p[k] for p in q) / 4 for k in range(3)]
            self.face(q, col, (c[0] - ce[0], c[1] - ce[1], c[2] - ce[2]), top)
        for f in (a, b):
            c = [sum(p[k] for p in f) / n for k in range(3)]
            self.face(f, col, (c[0] - ce[0], c[1] - ce[1], c[2] - ce[2]), top)

    def box(self, L0, L1, D0, D1, z0, z1, col, top=None):
        """An axis-aligned box in authoring coordinates."""
        c = ((L0, D0), (L1, D0), (L1, D1), (L0, D1))
        lo = [self.P(L, D, z0) for L, D in c]
        hi = [self.P(L, D, z1) for L, D in c]
        mid = self.P((L0 + L1) / 2, (D0 + D1) / 2, (z0 + z1) / 2)
        self.face(hi, top or col, (0, 0, 1))
        for i in range(4):
            q = [lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]]
            c3 = [sum(p[k] for p in q) / 4 for k in range(3)]
            self.face(q, col, (c3[0] - mid[0], c3[1] - mid[1], 0))

    def cyl_L(self, D, z, r, L0, L1, col, sides=16):
        """A cylinder lying along L (the drum)."""
        ring = lambda L: [self.P(L, D + r * math.cos((i + .5) * math.tau / sides), z + r * math.sin((i + .5) * math.tau / sides)) for i in range(sides)]  # noqa: E731
        a, b = ring(L0), ring(L1)
        ax = self.P((L0 + L1) / 2, D, z)
        for i in range(sides):
            j = (i + 1) % sides
            q = [a[i], a[j], b[j], b[i]]
            c = [sum(p[k] for p in q) / 4 for k in range(3)]
            self.face(q, col, (c[0] - ax[0], c[1] - ax[1], c[2] - ax[2]))
        e0, e1 = self.P(L0, D, z), self.P(L1, D, z)
        dv = (e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2])
        self.face(a, col, (-dv[0], -dv[1], -dv[2]))
        self.face(b, col, dv)


WALL, EDGE, TOP, STEP = 0.62, 1.16, 1.33, 0.15


def _rrect(sc, dc, hs, hd, r, seg=3):
    """A rounded rectangle in the slope's (s, D) plane, counter-clockwise: centre, half extents, corner radius."""
    pts = []
    for cs, cd, a0 in ((hs - r, hd - r, 0.0), (-hs + r, hd - r, 0.5), (-hs + r, -hd + r, 1.0), (hs - r, -hd + r, 1.5)):
        for k in range(seg + 1):
            a = (a0 + 0.5 * k / seg) * math.pi
            pts.append((sc + cs + r * math.cos(a), dc + cd + r * math.sin(a)))
    return pts


def slope_cyl(b, A, B, s, d, r, t0, t1, col, sides=16, top=None):
    """A cylinder standing on the slope from A to B (L, z points): axis along the slope's normal at (s along, D = d),
    ends parallel to the slope from t0 to t1 out of it, so its foot sits flat on the slope. r may be a (foot, top)
    pair of radii for a frustum (a chamfer)."""
    ln = math.dist(A, B)
    u = ((B[0] - A[0]) / ln, (B[1] - A[1]) / ln)
    n = (-u[1], u[0]) if u[0] > 0 else (u[1], -u[0])
    S = lambda s_, d_, t: b.P(A[0] + u[0] * s_ + n[0] * t, d_, A[1] + u[1] * s_ + n[1] * t)   # noqa: E731
    r0, r1 = r if isinstance(r, tuple) else (r, r)
    ring = lambda t, r: [S(s + r * math.cos((i + .5) * math.tau / sides), d + r * math.sin((i + .5) * math.tau / sides), t)  # noqa: E731
                         for i in range(sides)]
    a_, b_ = ring(t0, r0), ring(t1, r1)
    ax = S(s, d, (t0 + t1) / 2)
    for i in range(sides):
        j = (i + 1) % sides
        q = [a_[i], a_[j], b_[j], b_[i]]
        c = [sum(p[k] for p in q) / 4 for k in range(3)]
        b.face(q, col, (c[0] - ax[0], c[1] - ax[1], c[2] - ax[2]))
    e0, e1 = S(s, d, t0), S(s, d, t1)
    dv = (e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2])
    b.face(a_, col, (-dv[0], -dv[1], -dv[2]))
    b.face(b_, top or col, dv)


HOUSING_S0, HOUSING_H, HOUSING_BACK, HOUSING_TAIL = 0.56, 0.21, 0.17, 0.12


def exhaust_housing(A, B):
    """The exhaust housing's (L, z) side profile on the slope from A (foot) to B (crest), one solid read as three
    shapes: a block lying on the upper slope (its underside on the slope, from HOUSING_S0 up to the crest, HOUSING_H
    thick); a block on the flat top whose top runs back level from the first one's top edge and whose underside reaches
    HOUSING_BACK (about 6 px) past the crest; and a short slope (HOUSING_TAIL long) down to the top at its back end."""
    ln = math.dist(A, B)
    u = ((B[0] - A[0]) / ln, (B[1] - A[1]) / ln)
    n = (-u[1], u[0]) if u[0] > 0 else (u[1], -u[0])
    back = -1 if B[0] < A[0] else 1                                    # from the crest away from the end
    on = lambda s_, t: (A[0] + u[0] * s_ + n[0] * t, A[1] + u[1] * s_ + n[1] * t)   # noqa: E731
    top = on(ln, HOUSING_H)
    pts = [on(HOUSING_S0, 0), on(HOUSING_S0, HOUSING_H), top, (B[0] + back * HOUSING_BACK, top[1]),
           (B[0] + back * (HOUSING_BACK + HOUSING_TAIL), B[1]), B]
    return pts


def hatch(b, A, B, r0, r1):
    """A hatch on the slope from A to B (L, z points), in the row r0 .. r1: a raised frame 2 px wide with rounded
    corners standing proud of the slope, and inside it, recessed below the frame's lip, two sliding door leaves on a
    dark backing with a seam between them running up the slope."""
    ln = math.dist(A, B)
    u = ((B[0] - A[0]) / ln, (B[1] - A[1]) / ln)                       # up the slope
    n = (-u[1], u[0]) if u[0] > 0 else (u[1], -u[0])                   # out of it (up, and away from the body)
    S = lambda s, d, t: b.P(A[0] + u[0] * s + n[0] * t, d, A[1] + u[1] * s + n[1] * t)   # noqa: E731  s along, t out
    def out(s, d, t, ds, dd, dt):
        p, q = S(s, d, t), S(s + ds, d + dd, t + dt)
        return (q[0] - p[0], q[1] - p[1], q[2] - p[2])
    sc, dc = ln * 0.5, (r0 + r1) / 2
    hs, hd = ln * 0.45, (r1 - r0) * 0.41                               # outer half extents: most of the slope and row
    ws, wd, rad, lip = 0.045, 0.055, 0.06, 0.035                        # frame width (2 px each way), corner radius, height
    outer = _rrect(sc, dc, hs, hd, rad)
    inner = _rrect(sc, dc, hs - ws, hd - wd, rad - min(ws, wd) * 0.5)
    m = len(outer)
    for i in range(m):                                                  # frame: top, outer wall, inner wall
        j = (i + 1) % m
        (os_, od), (os2, od2), (is_, id_), (is2, id2) = outer[i], outer[j], inner[i], inner[j]
        b.face([S(os_, od, lip), S(os2, od2, lip), S(is2, id2, lip), S(is_, id_, lip)], GMD, out(sc, dc, 0, 0, 0, 1))
        b.face([S(os_, od, 0), S(os2, od2, 0), S(os2, od2, lip), S(os_, od, lip)], GMD,
               out(sc, dc, lip / 2, (os_ + os2) / 2 - sc, (od + od2) / 2 - dc, 0))
        b.face([S(is_, id_, 0), S(is2, id2, 0), S(is2, id2, lip), S(is_, id_, lip)], GMD,
               out((is_ + is2) / 2, (id_ + id2) / 2, lip / 2, sc - (is_ + is2) / 2, dc - (id_ + id2) / 2, 0))
    b.face([S(s_, d_, 0.004) for s_, d_ in inner], DARK, out(sc, dc, 0, 0, 0, 1))      # backing, the seam shows it
    ls, ld, gap = hs - ws, hd - wd, 0.009                                   # leaves fill the opening, recessed
    for d0, d1 in ((dc - ld, dc - gap), (dc + gap, dc + ld)):
        pr = [(sc - ls, 0.004), (sc + ls, 0.004), (sc + ls, 0.016), (sc - ls, 0.016)]
        c = [(s_, t) for s_, t in pr]
        L_z = [(A[0] + u[0] * s_ + n[0] * t, A[1] + u[1] * s_ + n[1] * t) for s_, t in c]
        b.prism_D(L_z, d0, d1, PLATE)


def rr_prism_L(b, L0, L1, dc, zc, h, r, col, cap0=None):
    """A rounded square (half size h, corner radius r) in the (D, z) plane centred on (dc, zc), extruded along L from L0
    to L1. cap0 colours the L0 end (the mouth face) when given."""
    ring = _rrect(dc, zc, h, h, r)
    a, c = [b.P(L0, d, z) for d, z in ring], [b.P(L1, d, z) for d, z in ring]
    ax = b.P((L0 + L1) / 2, dc, zc)
    m = len(ring)
    for i in range(m):
        j = (i + 1) % m
        q = [a[i], a[j], c[j], c[i]]
        ce = [sum(p[k] for p in q) / 4 for k in range(3)]
        b.face(q, col, (ce[0] - ax[0], ce[1] - ax[1], ce[2] - ax[2]))
    e0, e1 = b.P(L0, dc, zc), b.P(L1, dc, zc)
    dv = (e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2])
    b.face(a, cap0 or col, (-dv[0], -dv[1], -dv[2]))
    b.face(c, col, dv)


def plate_L(b, poly, L0, L1, col, caps):
    """A flat (D, z) outline, which may be concave, extruded along L from L0 to L1. Sides are built per edge; each end
    cap is laid as the given convex pieces (index lists into poly), so no faces sit inside the solid."""
    area = sum(poly[i][0] * poly[i - 1][1] - poly[i - 1][0] * poly[i][1] for i in range(len(poly)))
    sg = 1 if area < 0 else -1                                          # outward = sg * (dz, -dD) for edge (dD, dz)
    for i in range(len(poly)):
        (d0, z0), (d1, z1) = poly[i - 1], poly[i]
        q = [b.P(L0, d0, z0), b.P(L0, d1, z1), b.P(L1, d1, z1), b.P(L1, d0, z0)]
        o0, o1 = b.P(L0, (d0 + d1) / 2, (z0 + z1) / 2), b.P(L0, (d0 + d1) / 2 + sg * (z1 - z0), (z0 + z1) / 2 - sg * (d1 - d0))
        b.face(q, col, (o1[0] - o0[0], o1[1] - o0[1], o1[2] - o0[2]))
    e0, e1 = b.P(L0, 0, 0), b.P(L1, 0, 0)
    dv = (e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2])
    for piece in caps:
        b.face([b.P(L0, *poly[k]) for k in piece], col, (-dv[0], -dv[1], -dv[2]))
        b.face([b.P(L1, *poly[k]) for k in piece], col, dv)


def plate_z(b, poly, z0, z1, col, caps):
    """A flat (L, D) outline, which may be concave, extruded up from z0 to z1; caps as in plate_L. z1 may be a
    function of L for a top that slopes along L, and z0 likewise for a bent plate (each cap piece must then lie where
    they are linear)."""
    top = z1 if callable(z1) else (lambda L: z1)  # noqa: E731
    bot = z0 if callable(z0) else (lambda L: z0)  # noqa: E731
    area = sum(poly[i][0] * poly[i - 1][1] - poly[i - 1][0] * poly[i][1] for i in range(len(poly)))
    sg = 1 if area < 0 else -1
    for i in range(len(poly)):
        (l0, d0), (l1, d1) = poly[i - 1], poly[i]
        q = [b.P(l0, d0, bot(l0)), b.P(l1, d1, bot(l1)), b.P(l1, d1, top(l1)), b.P(l0, d0, top(l0))]
        o0, o1 = b.P((l0 + l1) / 2, (d0 + d1) / 2, 0), b.P((l0 + l1) / 2 + sg * (d1 - d0), (d0 + d1) / 2 - sg * (l1 - l0), 0)
        b.face(q, col, (o1[0] - o0[0], o1[1] - o0[1], o1[2] - o0[2]))
    for piece in caps:
        b.face([b.P(*poly[k], top(poly[k][0])) for k in piece], col, (0, 0, 1))
        b.face([b.P(*poly[k], bot(poly[k][0])) for k in piece], col, (0, 0, -1))


def mouth(b, L0, L1, depth, h=0.365, r=0.12, wall=0.075):
    """The mouth shroud: a rounded-square tube, its open face at L0 and its rim wall thick, hollow to depth, where a
    dark back wall closes it; the outside runs on to L1, where it is capped."""
    outer = _rrect(DRUM_D, DRUM_Z, h, h, r)
    inner = _rrect(DRUM_D, DRUM_Z, h - wall, h - wall, r - wall / 2)
    ax = lambda L: b.P(L, DRUM_D, DRUM_Z)  # noqa: E731
    e0, e1 = ax(L0), ax(L1)
    fwd = (e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2])                # +L
    back = (-fwd[0], -fwd[1], -fwd[2])
    m = len(outer)
    for i in range(m):
        j = (i + 1) % m
        (od, oz), (od2, oz2), (id_, iz), (id2, iz2) = outer[i], outer[j], inner[i], inner[j]
        b.face([b.P(L0, od, oz), b.P(L0, od2, oz2), b.P(L0, id2, iz2), b.P(L0, id_, iz)], RUST_D, back)           # rim
        q = [b.P(L0, od, oz), b.P(L0, od2, oz2), b.P(L1, od2, oz2), b.P(L1, od, oz)]                         # outside
        c, a_ = [sum(p[k] for p in q) / 4 for k in range(3)], ax((L0 + L1) / 2)
        b.face(q, RUST_D, (c[0] - a_[0], c[1] - a_[1], c[2] - a_[2]))
        q = [b.P(L0, id_, iz), b.P(L0, id2, iz2), b.P(L0 + depth, id2, iz2), b.P(L0 + depth, id_, iz)]       # bore
        c, a_ = [sum(p[k] for p in q) / 4 for k in range(3)], ax(L0 + depth / 2)
        b.face(q, DARK, (a_[0] - c[0], a_[1] - c[1], a_[2] - c[2]))
    b.face([b.P(L0 + depth, d, z) for d, z in inner], DARK, back)                                         # back wall
    b.face([b.P(L1, d, z) for d, z in outer], RUST_D, fwd)                                                   # outer cap


RECESS_W, RECESS_Z, RECESS_DEPTH = 0.55, (0.52, 1.06), 0.9
RECESS_BANDS = (0.0, 0.2, 0.27, 0.36)           # depths where the passage walls step darker
RECESS_FADE = ("scRec1", "scRec2", "scRec3", "scRec4")
RECESS_L = (2.5 - RECESS_W / 2, 2.5 + RECESS_W / 2)                    # centred in the bay's back wall


def _bay_back_h(L):
    """Height of the block behind the bay at L: TOP, sloping down to EDGE over the last STEP before L 3."""
    return TOP if L <= 3.0 - STEP else TOP + (EDGE - TOP) * (L - (3.0 - STEP)) / STEP


def recess(b, DM):
    """The opening in the bay's back wall (the hopper's, placed after the ref's hopper tile, link 07, but centred in
    the wall): the wall at D = DM around it, and a passage running deep enough into the block (RECESS_DEPTH) that its
    end never shows, its walls white, in a raised frame."""
    (L0, L1), (z0, z1), d = RECESS_L, RECESS_Z, RECESS_DEPTH
    def wall(pts, col, n):                                              # pts as (L, D, z); n = normal in (L, D, z)
        a, c = b.P(*pts[0]), b.P(pts[0][0] + n[0], pts[0][1] + n[1], pts[0][2] + n[2])
        b.face([b.P(*p) for p in pts], col, (c[0] - a[0], c[1] - a[1], c[2] - a[2]))
    fwd = (0, 1, 0)                                                     # the bay wall faces +D
    knee = [(3.0 - STEP, DM, TOP)] if L0 < 3.0 - STEP < L1 else []
    wall([(L0, DM, BASE), (L1, DM, BASE), (L1, DM, z0), (L0, DM, z0)], BODY, fwd)                 # below
    wall([(L0, DM, z1), (L1, DM, z1), (L1, DM, _bay_back_h(L1)), *knee, (L0, DM, _bay_back_h(L0))], BODY, fwd)
    wall([(L0, DM - d, z0), (L1, DM - d, z0), (L1, DM - d, z1), (L0, DM - d, z1)], RECESS_FADE[-1], fwd)  # far end
    # the passage fades into the dark as it runs in: its walls in bands, each a step darker than the last
    cuts = [*RECESS_BANDS, d]
    for (a, c), col in zip(zip(cuts, cuts[1:]), RECESS_FADE):
        f, n = DM - c, DM - a                                           # far and near D of this band
        wall([(L0, f, z0), (L1, f, z0), (L1, n, z0), (L0, n, z0)], col, (0, 0, 1))      # floor
        wall([(L0, f, z1), (L1, f, z1), (L1, n, z1), (L0, n, z1)], col, (0, 0, -1))     # ceiling
        wall([(L0, f, z0), (L0, n, z0), (L0, n, z1), (L0, f, z1)], col, (1, 0, 0))      # sides
        wall([(L1, f, z0), (L1, n, z0), (L1, n, z1), (L1, f, z1)], col, (-1, 0, 0))
    # a raised frame round the opening, 2 px wide each way, standing `lip` proud of the wall
    wl, wz, lip = 0.056, 0.051, 0.035
    inner = [(L0, z0), (L1, z0), (L1, z1), (L0, z1)]
    outer = [(L0 - wl, z0 - wz), (L1 + wl, z0 - wz), (L1 + wl, z1 + wz), (L0 - wl, z1 + wz)]
    for i in range(4):
        j = (i + 1) % 4
        (oa, ob), (oc, od), (ia, ib), (ic, id_) = outer[i], outer[j], inner[i], inner[j]
        wall([(oa, DM + lip, ob), (oc, DM + lip, od), (ic, DM + lip, id_), (ia, DM + lip, ib)], BODY_S2, fwd)   # face
        mo = ((oa + oc) / 2 - 2.5, 0, (ob + od) / 2 - (z0 + z1) / 2)                                     # outward
        wall([(oa, DM, ob), (oc, DM, od), (oc, DM + lip, od), (oa, DM + lip, ob)], BODY_S2,
             (mo[0] if i % 2 else 0, 0, 0 if i % 2 else mo[2]))
        wall([(ia, DM, ib), (ic, DM, id_), (ic, DM + lip, id_), (ia, DM + lip, ib)], BODY_S2,
             (-mo[0] if i % 2 else 0, 0, 0 if i % 2 else -mo[2]))


def screen(b, D1):
    """The screen on the hatch-end block's front face beside the bay (placed after the ref's R0 view): a wedge-shaped
    housing like a sun shade, standing out 1 px at its foot and further at its top, its sides sloping between them, on
    a dark mounting plate flush with the wall about 3 px bigger all round with a screw in each corner; the screen is
    set into its front inside a bezel."""
    L0, L1, z0, z1, top, bot = 1.28, 1.80, 0.849, 1.18, 0.122, 0.028   # how far the top and foot edges stand out
    m = 0.082                                                           # mounting plate margin, about 3 px
    plate = [b.P(L, D1 + 0.002, z) for L, z in ((L0 - m, z0 - m), (L1 + m, z0 - m), (L1 + m, z1 + m), (L0 - m, z1 + m))]
    fwd = [x - y for x, y in zip(b.P(L0, D1 + 1, z0), b.P(L0, D1, z0))]
    b.face(plate, DARK, fwd)
    sl, sz = 0.02, 0.018                                                # a screw head: about 1 px, at each corner
    for L in (L0 - m / 2, L1 + m / 2):
        for z in (z0 - m / 2, z1 + m / 2):
            b.face([b.P(L + u, D1 + 0.004, z + v) for u, v in ((-sl, -sz), (sl, -sz), (sl, sz), (-sl, sz))], GM, fwd)
    f0, f1 = (L0, D1 + bot, z0), (L1, D1 + bot, z0)                     # the foot's front edge
    g0, g1 = (L0, D1, z0), (L1, D1, z0)                                 # the foot's back edge, on the wall
    t0, t1 = (L0, D1 + top, z1), (L1, D1 + top, z1)                     # the top's front edge
    w0, w1 = (L0, D1, z1), (L1, D1, z1)                                 # the top's back edge, on the wall
    vec = lambda a, c: [x - y for x, y in zip(b.P(*c), b.P(*a))]  # noqa: E731
    b.face([b.P(*p) for p in (w0, w1, t1, t0)], GM, (0, 0, 1))                              # top
    b.face([b.P(*p) for p in (g0, f0, t0, w0)], GMD, vec((L0, D1, z0), (L0 - 1, D1, z0)))   # sides
    b.face([b.P(*p) for p in (g1, f1, t1, w1)], GMD, vec((L1, D1, z0), (L1 + 1, D1, z0)))
    b.face([b.P(*p) for p in (g0, g1, f1, f0)], GMD, (0, 0, -1))                            # foot
    h, dd = z1 - z0, top - bot
    ln = math.hypot(dd, h)
    nd, nz = h / ln, -dd / ln                                           # the front's normal: out, and down
    b.face([b.P(*p) for p in (f0, f1, t1, t0)], GMD, vec((L0, D1, z0), (L0, D1 + nd, z0 + nz)))   # front
    i, e = 0.045, 0.003                                                 # bezel (about 2 px); lift off the front
    on = lambda L, t: b.P(L, D1 + bot + dd * t + nd * e, z0 + h * t + nz * e)   # noqa: E731  t: 0..1 up the front
    tb = i / ln
    b.face([on(L0 + i, tb), on(L1 - i, tb), on(L1 - i, 1 - tb), on(L0 + i, 1 - tb)], DARK,
           vec((L0, D1, z0), (L0, D1 + nd, z0 + nz)))


DOOR_W, DOOR_H = 0.58, 0.435
DOOR_DEPTH = 0.3
DOOR_L = [(c - DOOR_W / 2, c + DOOR_W / 2) for c in (1.5, 3.5)]        # front row, each centred in its tile


def doorway(b, L0, L1, D1, wall_h, knee=None, depth=DOOR_DEPTH):
    """A doorway in the front wall (measured on the ref's tiles, links 03 and 08; centred in its tile): the wall above
    it, a dark passage running in at floor level, and a raised frame 2 px wide round its sides and top."""
    zt = DOOR_H
    def wall(pts, col, n):                                              # pts as (L, D, z); n = normal in (L, D, z)
        a, c = b.P(*pts[0]), b.P(pts[0][0] + n[0], pts[0][1] + n[1], pts[0][2] + n[2])
        b.face([b.P(*p) for p in pts], col, (c[0] - a[0], c[1] - a[1], c[2] - a[2]))
    kn = [(knee[0], D1, knee[1])] if knee and L0 < knee[0] < L1 else []
    wall([(L0, D1, zt), (L1, D1, zt), (L1, D1, wall_h(L1)), *kn, (L0, D1, wall_h(L0))], BODY, (0, 1, 0))   # above
    Db = D1 - depth
    fl = 0.003                                                          # the floor, just off the ground
    wall([(L0, Db, fl), (L1, Db, fl), (L1, Db, zt), (L0, Db, zt)], DARK, (0, 1, 0))                        # back
    wall([(L0, Db, fl), (L1, Db, fl), (L1, D1, fl), (L0, D1, fl)], DARK, (0, 0, 1))                        # floor
    wall([(L0, Db, zt), (L1, Db, zt), (L1, D1, zt), (L0, D1, zt)], DARK, (0, 0, -1))                       # ceiling
    s0, s1 = L0 + 0.003, L1 - 0.003                                     # sides, just in front of the plinth's ends
    wall([(s0, Db, fl), (s0, D1, fl), (s0, D1, zt), (s0, Db, zt)], DARK, (1, 0, 0))
    wall([(s1, Db, fl), (s1, D1, fl), (s1, D1, zt), (s1, Db, zt)], DARK, (-1, 0, 0))
    wl, wz, lip = 0.056, 0.051, 0.063                                   # frame: 2 px each way, 2 px proud of the wall
    for prof in ([(L0 - wl, 0), (L0, 0), (L0, zt), (L0 - wl, zt)],
                 [(L1, 0), (L1 + wl, 0), (L1 + wl, zt), (L1, zt)],
                 [(L0 - wl, zt), (L1 + wl, zt), (L1 + wl, zt + wz), (L0 - wl, zt + wz)]):
        b.prism_D(prof, D1, D1 + lip, GMD)


def dial(b, Lc=1.5, Dc=0.5, r=0.3, h=0.16, rim=0.08, sink=0.03, flare=0.04, chamfer=0.09):
    """The dial on top of the hatch-end block (after the ref's tile, link 04, centred on the back-row tile): a square
    housing with small cut corners standing h above the top, its sides sloping out (flare) to its foot, its gauge face
    sunk into it inside a rim. Its foot stays on the flat top (L 1 + STEP .. 2 - STEP), clear of the slopes."""
    def oct_(rr):                                                       # a square, half size rr, corners cut by ch
        ch = chamfer + (rr - r) * (math.sqrt(2) - 1)                    # (parallel offsets keep the cuts at 45 deg)
        return [(Lc + x, Dc + y) for x, y in ((rr, -rr + ch), (rr, rr - ch), (rr - ch, rr), (-rr + ch, rr),
                                              (-rr, rr - ch), (-rr, -rr + ch), (-rr + ch, -rr), (rr - ch, -rr))]
    outer, inner, foot = oct_(r), oct_(r - rim), oct_(r + flare)
    z1, zf = TOP + h, TOP + h - sink
    ce = b.P(Lc, Dc, TOP)
    for i in range(8):
        j = (i + 1) % 8
        (a0, a1), (c0, c1), (e0, e1), (f0, f1) = outer[i], outer[j], inner[i], inner[j]
        b.face([b.P(a0, a1, z1), b.P(c0, c1, z1), b.P(f0, f1, z1), b.P(e0, e1, z1)], GMD, (0, 0, 1))       # rim top
        (g0, g1), (h0, h1) = foot[i], foot[j]
        q = [b.P(g0, g1, TOP), b.P(h0, h1, TOP), b.P(c0, c1, z1), b.P(a0, a1, z1)]                         # outside
        m = [sum(p[x] for p in q) / 4 for x in range(3)]
        b.face(q, GMD, (m[0] - ce[0], m[1] - ce[1], 0))
        q = [b.P(e0, e1, zf), b.P(f0, f1, zf), b.P(f0, f1, z1), b.P(e0, e1, z1)]                           # inside
        m = [sum(p[x] for p in q) / 4 for x in range(3)]
        b.face(q, GMD, (ce[0] - m[0], ce[1] - m[1], 0))
    b.face([b.P(d0, d1, zf) for d0, d1 in inner], LIGHT, (0, 0, 1))                                      # gauge face


def cyl_z(b, L, D, z0, z1, r, col, top=None, sides=16):
    """An upright cylinder standing on the top from z0 to z1."""
    ring = lambda z: [b.P(L + r * math.cos((i + .5) * math.tau / sides), D + r * math.sin((i + .5) * math.tau / sides), z)  # noqa: E731
                      for i in range(sides)]
    lo, hi, ce = ring(z0), ring(z1), b.P(L, D, z0)
    for i in range(sides):
        j = (i + 1) % sides
        q = [lo[i], lo[j], hi[j], hi[i]]
        m = [sum(p[x] for p in q) / 4 for x in range(3)]
        b.face(q, col, (m[0] - ce[0], m[1] - ce[1], 0))
    b.face(hi, top or col, (0, 0, 1))


def vent(b, L=2.3, D=0.5, r=0.17):
    """The round vent on top of the block behind the bay (after the ref's hopper tile, link 07: toward the hatch end,
    clear of the linkage at the front; in line with the dial across the machine): a low rim round a dark grille."""
    cyl_z(b, L, D, TOP, TOP + 0.03, r, GMD, GM)
    cyl_z(b, L, D, TOP + 0.03, TOP + 0.033, r - 0.04, DARK)


def piston(b, L0=2.0 + STEP - 0.084, L1=3.0 - STEP, r=0.135, wall=1.0, sink=0.077):
    """The piston lying along the front edge of the top behind the bay, above the recess (after the ref's hopper
    tile), running to where the top slopes away at its far end and as far the other way, centred over the recess:
    its hatch end 3 px longer, sunk about 3 px into the top, where it meets the top along the top's front edge (D = wall), so it bulges out
    over the bay's back wall above it; a dark knob caps its hatch-end side."""
    z = TOP + r - sink
    D = wall - math.sqrt(r * r - (r - sink) ** 2)                      # its line on the top falls on the front edge
    cap = 0.06                                                          # the knob is part of the span, so the whole
    b.cyl_L(D, z, r, L0 + cap, L1, GM, sides=14)                        # piston is centred, knob included
    b.cyl_L(D, z, r + 0.02, L0, L0 + cap, DARK, sides=14)
    levers(b, D, z, r)


def levers(b, Dc, zc, r, spacing=0.236, w=0.06, t=0.04, gap=0.003, wrap=130, n=8):
    """Three dark L-shaped levers (after the ref's hopper tile): a strap curving round the piston from its back, over
    its top, to its front, where it turns straight down the bay's back wall to stand on the recess frame's top edge."""
    zf = RECESS_Z[1] + 0.051                                            # the frame's top edge (recess(): wz)
    ri, ro = r + gap, r + gap + t
    arc = [math.radians(wrap * k / n) for k in range(n + 1)]            # 0 = straight forward (+D), up and over
    outer = [(Dc + ro * math.cos(a), zc + ro * math.sin(a)) for a in arc]
    inner = [(Dc + ri * math.cos(a), zc + ri * math.sin(a)) for a in arc]
    poly = [(Dc + ri, zf), (Dc + ro, zf), *outer, *inner[::-1]]
    m = len(poly) - 1                                                   # inner[k] sits at m - k
    caps = [[0, 1, 2, m]] + [[2 + k, 3 + k, m - k - 1, m - k] for k in range(n)]
    for Lc in (2.5 - spacing, 2.5, 2.5 + spacing):
        plate_L(b, poly, Lc - w / 2, Lc + w / 2, DARK, caps)


DRUM_BANDS = ((2.24, 2.29), (2.36, 2.52), (2.6, 2.76))   # the drum's raised bands along L
DRUM_D, DRUM_Z = 1.61, 0.4                # the drum's axis along L: nearer the front than the row's middle (measured)


def drum(b):
    """The drum lying along L in the bay, measured on the ref's drum tile (link 05): a rounded-square mouth shroud at
    the hatch end, its open face toward the hatch-end block (D 1.25..1.97, z 0.03..0.76), then the drum running to the
    yoke (later), with two wide raised bands and a narrow one next to the shroud."""
    mouth(b, 2.04, 2.2, 0.12)                                                      # hollow mouth shroud
    b.cyl_L(DRUM_D, DRUM_Z, 0.33, 2.2, 2.8, RUST_D, sides=20)                        # drum
    for L0, L1 in DRUM_BANDS:                                                      # raised bands
        b.cyl_L(DRUM_D, DRUM_Z, 0.37, L0, L1, RUST, sides=20)
    rr_prism_L(b, 2.8, 3.0, DRUM_D, DRUM_Z, 0.365, 0.12, RUST_D)                      # squared end shroud, under the yoke
    yoke(b)


def yoke(b):
    """The yoke at the drum's far end (measured on the drum tile): a C-shaped bracket across the machine that runs over
    the drum, chamfers down at the front, drops past the drum's face (standing proud of the body's front) and plants a
    foot on the floor, chamfered underneath. The top plate (later) runs back off its top."""
    poly = [(1.24, 0.92), (1.81, 0.92), (2.156, 0.676), (2.156, 0.27), (2.06, 0.0), (2.0, 0.0),   # outer, back to foot
            (2.0, 0.27), (2.0, 0.62), (1.76, 0.79), (1.24, 0.79)]                                 # inner, foot to back
    caps = [(0, 1, 8, 9), (1, 2, 7, 8), (2, 3, 6, 7), (3, 4, 5, 6)]
    plate_L(b, poly, 2.8, 3.0, RUST_D, caps)
    top_plate(b)


def top_plate(b):
    """The plate lying on the drum, centred on it, running back from the yoke's top to end flush with the mouth
    shroud's face (measured on the drum tile). Near the mouth end it slopes up about 4 px and runs on level to the
    end, bent like a strap: the same thickness all the way."""
    w = 0.185                                                           # half width
    Db, Df = DRUM_D - w, DRUM_D + w
    poly = [(2.04, Db), (2.27, Db), (2.35, Db), (2.8, Db), (2.8, Df), (2.35, Df), (2.27, Df), (2.04, Df)]
    caps = [(0, 1, 6, 7), (1, 2, 5, 6), (2, 3, 4, 5)]
    lo, hi, t = 0.92, 0.92 + 0.1, 0.15                                  # 0.1 = about 4 px of height; thickness
    top = lambda L: hi if L <= 2.27 else lo if L >= 2.35 else hi + (lo - hi) * (L - 2.27) / 0.08  # noqa: E731
    plate_z(b, poly, lambda L: top(L) - t, top, RUST_D, caps)


def scrapper(rot):
    b = _Build(rot, f"scrapper_{rot}")
    if os.environ.get("SCRAPPER_PART") == "drum":       # preview aid: the drum alone, to lay over the ref's drum tile
        drum(b)
        return [b.m.build()]
    # plinth band under the shells (not under the open bay)
    # (the doorways run down to the floor, so the band stops short of the front under each: it carries on behind)
    (a0, a1), (c0, c1) = DOOR_L
    dd = 1.97 - DOOR_DEPTH - 0.005                                     # just behind each doorway's back wall
    for L0, L1, Df in ((0.03, a0, 1.97), (a0, a1, dd), (a1, 2.0, 1.97), (2.0, 3.0, 1.0),
                       (3.0, c0, 1.97), (c0, c1, dd), (c1, 3.97, 1.97)):
        b.box(L0, L1, 0.03, Df, 0, BASE, BODY_D)
    # One body sloped at both ends; the bay (L 2..3, front row) is cut out of it. Profile along L, the same for both rows
    # and symmetric end to end: end wall WALL, slope up to EDGE by 0.5 in, flat; the centre two tiles (L 1..3) rise to
    # TOP with a short slope (STEP long) inside each end of them. The bay's top edges slope the same way: the front row
    # steps down to EDGE over the last STEP before the bay, as the back row does past it.
    D0, DM, D1 = 0.03, 1.0, 1.97
    full = lambda h: [(D0, BASE), (D0, h), (DM, h), (DM, h), (D1, h), (D1, BASE)]            # noqa: E731
    stepped = lambda hb, hf: [(D0, BASE), (D0, hb), (DM, hb), (DM, hf), (D1, hf), (D1, BASE)]  # noqa: E731
    back = lambda h: [(D0, BASE), (D0, h), (DM, h), (DM, BASE)]                               # noqa: E731
    bay_wall = lambda h: [(DM, BASE), (DM, h), (D1, h), (D1, BASE)]                           # noqa: E731
    d0, d1 = DOOR_L[0]                                                  # the doorway in the front wall (side 4)
    b.loft([(0.03, full(WALL)), (0.5, full(EDGE)), (1.0, full(EDGE)), (1.0 + STEP, full(TOP)), (d0, full(TOP)),
            (d1, full(TOP)), (2.0 - STEP, full(TOP)), (2.0, stepped(TOP, EDGE))], caps=(True, bay_wall(EDGE)),
           skip={(4, 4)})                                                                     # hatch end half
    doorway(b, d0, d1, D1, lambda L: TOP)
    # behind the bay, its bay wall (side 2) built with the recess cut into it
    Ls = sorted({2.0, *RECESS_L, 3.0 - STEP, 3.0})
    b.loft([(L, back(_bay_back_h(L))) for L in Ls], caps=(False, False),
           skip={(k, 2) for k in range(len(Ls) - 1) if RECESS_L[0] <= Ls[k] < RECESS_L[1]})
    recess(b, DM)
    d0, d1 = DOOR_L[1]
    far_h = lambda L: EDGE if L <= 3.5 else EDGE + (WALL - EDGE) * (L - 3.5) / 0.47           # noqa: E731
    b.loft([(L, full(far_h(L))) for L in (3.0, d0, 3.5, d1, 3.97)], caps=(bay_wall(EDGE), True),
           skip={(1, 4), (2, 4)})                                                             # far end tile
    doorway(b, d0, d1, D1, far_h, knee=(3.5, EDGE))
    # the two hatches on the hatch-end slope, one per row: a frame lying on the slope, two sliding door leaves
    for r0, r1 in ((D0, DM), (DM, D1)):
        hatch(b, (0.03, WALL), (0.5, EDGE), r0, r1)
    hatch(b, (3.97, WALL), (3.5, EDGE), D0, DM)                         # far end: one hatch, back row
    # far end, front row: the exhaust, a housing standing out of the slope's top and a nozzle pointing out of the end
    fA, fB = (3.97, WALL), (3.5, EDGE)
    px, fm, dc = 0.028, math.dist(fA, fB) / 2, (DM + D1) / 2             # px: one pixel across D at 1x
    flange = 0.17 + px / 2
    b.prism_D(exhaust_housing(fA, fB), dc - flange - px, dc + flange + px, GMD, GM)   # a pixel wider than the flange
    slope_cyl(b, fA, fB, fm, dc, flange, 0, 0.04, GMD)                       # flange, foot flat on the slope
    barrel = 0.13 + px / 2
    slope_cyl(b, fA, fB, fm, dc, (flange - px, barrel), 0.04, 0.075, GM)     # chamfer up from the flange to the barrel
    slope_cyl(b, fA, fB, fm, dc, barrel, 0.075, 0.345, GM)                    # nozzle barrel
    slope_cyl(b, fA, fB, fm, dc, 0.08 + px / 2, 0.345, 0.35, DARK)          # bore
    drum(b)
    screen(b, D1)
    dial(b)
    vent(b)
    piston(b)
    from .scrapper_detail import panels, seams
    seams(b, BODY_D)
    panels(b, BODY_D, BODY, BODY_S)
    if os.environ.get("SCRAPPER_WEAR", "1") != "0":
        from .scrapper_wear import drum_wear, fine, wear
        sel = (BODY, BODY_S, BODY_D)
        fine(b.m, sel)
        rk, dk, tk = (float(x) for x in os.environ.get("SCRAPPER_WEAR_K", "0.7,0.7,0.55").split(","))
        wear(b, sel, _top, run_k=rk, dust_k=dk, top_k=tk)
        if os.environ.get("SCRAPPER_DRUM_WEAR", "1") != "0":
            fine(b.m, (RUST, RUST_D), grid=0.04)
            drum_wear(b, RUST_D, RUST, (DRUM_D, DRUM_Z), DRUM_BANDS)
    return [b.m.build()]


def _top(L, D):
    """The height of the body's top edge above (L, D): where rust run-off starts."""
    if L < 0.5:
        return WALL + (EDGE - WALL) * (L - 0.03) / 0.47
    if L < 1.0:
        return EDGE
    if L < 1.0 + STEP:
        return EDGE + (TOP - EDGE) * (L - 1.0) / STEP
    if L < 2.0 - STEP or (L < 2.0 and D < 1.0):
        return TOP
    if L < 2.0:
        return TOP + (EDGE - TOP) * (L - 2.0 + STEP) / STEP
    if L < 3.0:
        return _bay_back_h(L) if D < 1.0 else EDGE
    if L < 3.5:
        return EDGE
    return EDGE + (WALL - EDGE) * (L - 3.5) / 0.47


def jobs():
    out = []
    for r in range(4):
        fp = FOOTPRINT if r % 2 == 0 else FOOTPRINT[::-1]
        out.append((f"module.scrapper.blockout.r{r}", fp, "prop", lambda r=r: scrapper(r)))
    return out
