"""Scrapper module (4x2, solid crafting workstation): grey blockout, 4 rotations.

Reference massing: two angled consoles at the left end, a dial block, a feed block with a front hatch (the crew
access tile faces it), a horizontal roller drum, a hopper with an open mouth, and an exhaust box with a stack.
Authoring frame (rotation 0): x 0..4 along the length, y 0..2 deep, FRONT = +y (access side), z up; tile (i, j)
covers [i, i+1] x [j, j+1]. Origin of the sprite = centre of the front-most footprint tile (like the refinery).
Rotation r turns the machine as the sim does: (x, y) -> (H - y, x) per step, W and H swapping.
"""
import math
from . import core

FOOTPRINT = (4, 2)
ACCESS = (1, 2)


def rotated_point(x, y, rotation):
    w, h = FOOTPRINT
    for _ in range(rotation):
        x, y = h - 1 - y, x
        w, h = h, w
    return x, y


class _Build:
    def __init__(self, rot, name):
        self.rot, self.m = rot, core.Mesh(name)
        self.W, self.H = FOOTPRINT
        for _ in range(rot):
            self.W, self.H = self.H, self.W

    def T(self, x, y):
        w, h = FOOTPRINT
        for _ in range(self.rot):
            x, y = h - y, x
            w, h = h, w
        return x - (self.W - 0.5), y - (self.H - 0.5)

    def solid(self, pts3, col, top=None):
        """Convex prism from (x, y, z) loops: faces oriented away from the centroid. pts3 = list of rings, 2 rings."""
        a, b = pts3
        n = len(a)
        cx = sum(p[0] for p in a + b) / (2 * n)
        cy = sum(p[1] for p in a + b) / (2 * n)
        cz = sum(p[2] for p in a + b) / (2 * n)
        faces = [a[::-1], b] + [[a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]] for i in range(n)]
        for f in faces:
            nx = ny = nz = 0.0
            for i in range(len(f)):
                p, q = f[i], f[(i + 1) % len(f)]
                nx += (p[1] - q[1]) * (p[2] + q[2])
                ny += (p[2] - q[2]) * (p[0] + q[0])
                nz += (p[0] - q[0]) * (p[1] + q[1])
            mx = sum(p[0] for p in f) / len(f)
            my = sum(p[1] for p in f) / len(f)
            mz = sum(p[2] for p in f) / len(f)
            if nx * (mx - cx) + ny * (my - cy) + nz * (mz - cz) < 0:
                f = f[::-1]
                nx, ny, nz = -nx, -ny, -nz
            ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            c = top if (top and nz / ln > 0.7) else col
            self.m.poly([core.G(*q) for q in f], c, flip=True)

    def _tp(self, x, y, z):
        tx, ty = self.T(x, y)
        return (tx, ty, z)

    def prism_x(self, prof, x0, x1, col, top=None):
        """prof: (y, z) loop extruded along x."""
        self.solid([[self._tp(x0, y, z) for y, z in prof], [self._tp(x1, y, z) for y, z in prof]], col, top)

    def prism_y(self, prof, y0, y1, col, top=None):
        """prof: (x, z) loop extruded along y."""
        self.solid([[self._tp(x, y0, z) for x, z in prof], [self._tp(x, y1, z) for x, z in prof]], col, top)

    def box(self, x0, x1, y0, y1, z0, z1, col, top=None):
        self.prism_x([(y0, z0), (y1, z0), (y1, z1), (y0, z1)], x0, x1, col, top)

    def cyl(self, x, y, z, r, h, col, top=None, sides=12, rtop=None):
        tx, ty = self.T(x, y)
        self.m.cyl((tx, ty, z), r, h, col, sides=sides, top=top, rtop=rtop)

    def roller(self, y, z, r, x0, x1, col, sides=12):
        prof = [(y + r * math.cos((i + .5) * math.tau / sides), z + r * math.sin((i + .5) * math.tau / sides)) for i in range(sides)]
        self.prism_x(prof, x0, x1, col)


STEEL, STEEL_T, DARK, GM, GMD, PLATE, ACCENT = "steel", "steelL", "dark", "gm", "gmD", "plate", "hazY"


def console(b, y_back, y_front, z_back, z_front, x0, x1):
    """Angled console: sloped top falling toward the front, two dark screens inset on the slope."""
    b.prism_x([(y_back, 0), (y_front, 0), (y_front, z_front), (y_back, z_back)], x0, x1, STEEL, STEEL_T)
    for k in range(2):
        sx0 = x0 + 0.08 + k * 0.4
        sx1 = sx0 + 0.34
        t0, t1 = 0.18, 0.88
        prof = []
        for t in (t0, t1):
            prof.append((y_back + (y_front - y_back) * t, z_back + (z_front - z_back) * t + 0.015))
        d = 0.03
        prof2 = [(py, pz + d) for py, pz in prof]
        b.prism_x([prof[0], prof[1], prof2[1], prof2[0]], sx0, sx1, DARK)


def scrapper(rot):
    b = _Build(rot, f"scrapper_{rot}")
    # left end: two angled consoles
    console(b, 0.12, 0.92, 0.82, 0.56, 0.08, 0.92)
    console(b, 1.08, 1.88, 0.62, 0.38, 0.08, 0.92)
    # dial block (back, x=1) with a round gauge on top
    b.box(1.06, 1.94, 0.12, 0.96, 0, 1.0, STEEL, STEEL_T)
    b.box(1.02, 1.98, 0.12, 0.96, 0.9, 1.0, GM, PLATE)
    b.cyl(1.5, 0.54, 1.0, 0.3, 0.08, GMD, PLATE, sides=16)
    b.cyl(1.5, 0.54, 1.08, 0.2, 0.03, DARK, sides=16)
    # feed block (front, x=1) and its hatch facing the access tile
    b.box(1.06, 1.94, 1.04, 1.96, 0, 0.7, STEEL, STEEL_T)
    b.box(1.22, 1.78, 1.96, 2.0, 0.1, 0.5, DARK)
    b.box(1.22, 1.78, 1.96, 2.0, 0.52, 0.6, ACCENT)
    b.box(1.34, 1.66, 1.96, 2.03, 0.18, 0.42, GMD, GM)
    # roller drum (front, x=2) in a low cradle
    b.box(2.04, 2.96, 1.04, 1.96, 0, 0.24, GMD, GM)
    b.roller(1.5, 0.62, 0.40, 2.1, 2.9, GM)
    b.roller(1.5, 0.62, 0.45, 2.06, 2.16, STEEL_T)
    b.roller(1.5, 0.62, 0.45, 2.84, 2.94, STEEL_T)
    # hopper (back, x=2) with an open dark mouth
    b.box(2.04, 2.96, 0.12, 0.96, 0, 1.0, STEEL, STEEL_T)
    b.box(2.14, 2.86, 0.22, 0.86, 0.96, 1.04, DARK)
    for (x0, x1, y0, y1) in ((2.04, 2.96, 0.12, 0.22), (2.04, 2.96, 0.86, 0.96), (2.04, 2.14, 0.22, 0.86), (2.86, 2.96, 0.22, 0.86)):
        b.box(x0, x1, y0, y1, 1.0, 1.1, GM, PLATE)
    # exhaust: stepped box and a stack
    b.box(3.06, 3.94, 0.12, 1.88, 0, 0.58, STEEL, STEEL_T)
    b.box(3.16, 3.84, 0.12, 0.96, 0.58, 0.96, GMD, GM)
    b.cyl(3.5, 0.5, 0.96, 0.17, 0.62, GM, PLATE)
    b.cyl(3.5, 0.5, 1.5, 0.21, 0.08, GMD, DARK)
    b.box(3.2, 3.8, 1.5, 1.82, 0.58, 0.64, ACCENT)
    return [b.m.build()]


def jobs():
    out = []
    for r in range(4):
        fp = FOOTPRINT if r % 2 == 0 else FOOTPRINT[::-1]
        out.append((f"module.scrapper.blockout.r{r}", fp, "prop", lambda r=r: scrapper(r)))
    return out
