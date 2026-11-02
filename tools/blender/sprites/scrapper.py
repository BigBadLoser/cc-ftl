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

from . import core

FOOTPRINT = (4, 2)
ACCESS = (1, 2)

STEEL, STEEL_T, DARK, GM, GMD, PLATE, LIGHT, LIT = "steel", "steelL", "dark", "gm", "gmD", "plate", "medWhite", "cyan"
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

    def loft(self, rings, col=STEEL, top=STEEL_T, caps=(True, True)):
        """A shell swept along L through cross-sections across D: rings = [(L, [(d, z), ...]), ...], L increasing, every
        ring with the same number of points (bottom-back corner first, round the top, bottom-front corner last). A
        point pair that coincides in one ring and not the next makes a triangle (a step's side wall). caps, per end:
        True closes the whole end, False leaves it open (another piece carries on), a [(d, z), ...] closes that part."""
        dm = sum(d for d, _ in rings[0][1]) / len(rings[0][1])
        # Every side face is wound the same way by the ring order, so one sign (from the back wall, which faces -D)
        # orients them all: a centroid test cannot tell which way a wall on the row boundary faces.
        (La, ra), (Lb, rb) = rings[0], rings[1]
        w = [self.P(La, *ra[0]), self.P(La, *ra[1]), self.P(Lb, *rb[1]), self.P(Lb, *rb[0])]
        n0, o0 = _normal(w), [x - y for x, y in zip(self.P(La, ra[0][0] - 1, 0.5), self.P(La, ra[0][0], 0.5))]
        sign = 1 if sum(x * y for x, y in zip(n0, o0)) > 0 else -1
        for (La, ra), (Lb, rb) in zip(rings, rings[1:]):
            for j in range(len(ra) - 1):
                q = [self.P(La, *ra[j]), self.P(La, *ra[j + 1]), self.P(Lb, *rb[j + 1]), self.P(Lb, *rb[j])]
                q = [p for i, p in enumerate(q) if math.dist(p, q[i - 1]) > 1e-9]
                if len(q) < 3:
                    continue
                self.face(q, col, [sign * v for v in _normal(q)], top)
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


def hatch(b, A, B, r0, r1):
    """A hatch on the slope from A to B (L, z points), in the row r0 .. r1: a dark frame lying on the slope and two
    sliding door leaves standing a little proud of it, a seam between them running up the slope."""
    ln = math.dist(A, B)
    u = ((B[0] - A[0]) / ln, (B[1] - A[1]) / ln)                       # up the slope
    n = (-u[1], u[0])                                                  # out of it (toward -L and up)
    def slab(s0, s1, t0, t1, D0, D1, col):
        p = lambda s, t: (A[0] + u[0] * s * ln + n[0] * t, A[1] + u[1] * s * ln + n[1] * t)  # noqa: E731
        b.prism_D([p(s0, t0), p(s1, t0), p(s1, t1), p(s0, t1)], D0, D1, col)
    slab(0.07, 0.93, -0.01, 0.025, r0 + 0.1, r1 - 0.1, GMD)                                  # frame
    mid = (r0 + r1) / 2
    for D0, D1 in ((r0 + 0.15, mid - 0.012), (mid + 0.012, r1 - 0.15)):
        slab(0.13, 0.87, 0.0, 0.045, D0, D1, PLATE)                                          # door leaves


def scrapper(rot):
    b = _Build(rot, f"scrapper_{rot}")
    # plinth band under the shells (not under the open bay)
    b.box(0.03, 2.0, 0.03, 1.97, 0, BASE, GMD, DARK)
    b.box(2.0, 3.0, 0.03, 1.0, 0, BASE, GMD, DARK)
    b.box(3.0, 3.97, 0.03, 1.97, 0, BASE, GMD, DARK)
    # One body sloped at both ends; the bay (L 2..3, front row) is cut out of it. Profile along L, the same for both rows
    # and symmetric end to end: end wall WALL, slope up to EDGE by 0.5 in, flat; the centre two tiles (L 1..3) rise to
    # TOP with a short slope (STEP long) inside each end of them. The bay's top edges slope the same way: the front row
    # steps down to EDGE over the last STEP before the bay, as the back row does past it.
    D0, DM, D1 = 0.03, 1.0, 1.97
    full = lambda h: [(D0, BASE), (D0, h), (DM, h), (DM, h), (D1, h), (D1, BASE)]            # noqa: E731
    stepped = lambda hb, hf: [(D0, BASE), (D0, hb), (DM, hb), (DM, hf), (D1, hf), (D1, BASE)]  # noqa: E731
    back = lambda h: [(D0, BASE), (D0, h), (DM, h), (DM, BASE)]                               # noqa: E731
    bay_wall = lambda h: [(DM, BASE), (DM, h), (D1, h), (D1, BASE)]                           # noqa: E731
    b.loft([(0.03, full(WALL)), (0.5, full(EDGE)), (1.0, full(EDGE)), (1.0 + STEP, full(TOP)), (2.0 - STEP, full(TOP)),
            (2.0, stepped(TOP, EDGE))], caps=(True, bay_wall(EDGE)))                          # hatch end half
    b.loft([(2.0, back(TOP)), (3.0 - STEP, back(TOP)), (3.0, back(EDGE))], caps=(False, False))  # behind the bay
    b.loft([(3.0, full(EDGE)), (3.5, full(EDGE)), (3.97, full(WALL))], caps=(bay_wall(EDGE), True))  # far end tile
    # the two hatches on the hatch-end slope, one per row: a frame lying on the slope, two sliding door leaves
    for r0, r1 in ((D0, DM), (DM, D1)):
        hatch(b, (0.03, WALL), (0.5, EDGE), r0, r1)
    # bay: cradle and drum
    b.box(2.02, 2.98, 1.08, 1.92, 0, 0.1, GMD, GM)
    b.cyl_L(1.5, 0.4, 0.34, 2.22, 2.88, GM)
    b.cyl_L(1.5, 0.43, 0.51, 2.86, 3.0, GMD, sides=8)
    return [b.m.build()]


def jobs():
    out = []
    for r in range(4):
        fp = FOOTPRINT if r % 2 == 0 else FOOTPRINT[::-1]
        out.append((f"module.scrapper.blockout.r{r}", fp, "prop", lambda r=r: scrapper(r)))
    return out
