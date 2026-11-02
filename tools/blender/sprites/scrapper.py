"""Scrapper module (4x2, solid crafting workstation): grey blockout, 4 rotations.

Built as continuous shells, not one block per tile. Authoring frame: L 0..4 along the machine from the hatch end, D 0..2
across it (0 back, 2 front: the access side), z up; 1 unit = 1 tile; on the grid x = L, y = D. Rotation 3 shows it as the
reference's R0 view (hatch end lower left, front lower right).

Massing (measured on the reference; heights in tiles):
  main shell   L 0..2, both rows: end wall 0.62, slope to 1.16 at L 0.5, flat to L 2 (the front face there is the bay wall)
  back shell   L 2..4, back row: flat 1.16 to L 3.5, slope down to a 0.66 end wall at L 4 (the far hatch end)
  deck         L 1..2: raised panel, 1.33, carries the dial (back) and the emblem (front)
  bay          L 2..3, front row: open, the shredder drum (top 0.74) on a low cradle, a shroud frame (0.94) at L 3
  pipe unit    L 3..4, front row: back step 1.0, front step 0.66 with a doorway, a motor on top
Origin of the sprite = centre of the front-most footprint tile (like the refinery). Rotation r turns the machine as the sim
does: (x, y) -> (H - y, x) per step, W and H swapping.
"""
import math

from . import core

FOOTPRINT = (4, 2)
ACCESS = (1, 2)

STEEL, STEEL_T, DARK, GM, GMD, PLATE, LIGHT, LIT = "steel", "steelL", "dark", "gm", "gmD", "plate", "medWhite", "cyan"
BASE = 0.06          # dark plinth band
RND = 0.1            # rounding of the shell's long top edges


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

    def loft(self, prof, d0, d1, col=STEEL, top=STEEL_T, rnd=RND, seg=3):
        """A shell: the cross-section across D (d0 .. d1, rounded top edges) swept along the height profile
        prof = [(L, h), ...] (L increasing); both ends capped."""
        def ring(h):
            r = min(rnd, (h - BASE) * 0.5, (d1 - d0) * 0.5)
            pts = [(d0, BASE)]
            for k in range(seg + 1):
                a = math.pi - (math.pi / 2) * k / seg
                pts.append((d0 + r + r * math.cos(a), h - r + r * math.sin(a)))
            for k in range(seg + 1):
                a = math.pi / 2 - (math.pi / 2) * k / seg
                pts.append((d1 - r + r * math.cos(a), h - r + r * math.sin(a)))
            pts.append((d1, BASE))
            return pts
        rings = [(L, ring(h)) for L, h in prof]
        dm = (d0 + d1) / 2
        for (La, ra), (Lb, rb) in zip(rings, rings[1:]):
            ax = self.P((La + Lb) / 2, dm, 0)
            for j in range(len(ra) - 1):
                q = [self.P(La, *ra[j]), self.P(La, *ra[j + 1]), self.P(Lb, *rb[j + 1]), self.P(Lb, *rb[j])]
                c = [sum(p[i] for p in q) / 4 for i in range(3)]
                self.face(q, col, (c[0] - ax[0], c[1] - ax[1], c[2] - ax[2]), top)
        for (L, r), s in ((rings[0], -1), (rings[-1], 1)):
            a, b = self.P(L, dm, 0.5), self.P(L + s, dm, 0.5)
            self.face([self.P(L, d, z) for d, z in r], col, (b[0] - a[0], b[1] - a[1], b[2] - a[2]), top)

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


def scrapper(rot):
    b = _Build(rot, f"scrapper_{rot}")
    # plinth band under the shells (not under the open bay)
    b.box(0.03, 2.0, 0.03, 1.97, 0, BASE, GMD, DARK)
    b.box(2.0, 3.0, 0.03, 1.0, 0, BASE, GMD, DARK)
    b.box(3.0, 3.97, 0.03, 1.97, 0, BASE, GMD, DARK)
    # one body sloped at both ends; the bay (L 2..3, front row) is notched out of it
    b.loft([(0.03, 0.62), (0.5, 1.16), (2.0, 1.16)], 0.03, 1.97)                     # hatch end, full width
    b.loft([(1.9, 1.16), (3.1, 1.16)], 0.03, 1.0)                                      # behind the bay, back row
    b.loft([(3.0, 1.16), (3.5, 1.16), (3.97, 0.66)], 0.03, 1.97)                       # far end, full width
    # raised deck
    b.loft([(1.0, 1.33), (2.0, 1.33)], 0.08, 1.92, rnd=0.08)
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
