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


STEEL, STEEL_T, DARK, GM, GMD, PLATE, LIGHT, LIT = "steel", "steelL", "dark", "gm", "gmD", "plate", "medWhite", "cyan"
CH = 0.07            # top-edge chamfer of the shell
BASE = 0.07          # the dark plinth band under the shell


def cbox(b, x0, x1, y0, y1, z0, z1, col=STEEL, top=STEEL_T, ch=CH):
    """A shell block with all four top edges chamfered (a box, then a frustum cap)."""
    b.box(x0, x1, y0, y1, z0, z1 - ch, col)
    ring = lambda d, z: [b._tp(x, y, z) for x, y in ((x0 + d, y0 + d), (x1 - d, y0 + d), (x1 - d, y1 - d), (x0 + d, y1 - d))]  # noqa: E731
    b.solid([ring(0, z1 - ch), ring(ch, z1)], col, top)


def on_slope(b, x0, x1, z0, z1, ya, yb, t0, t1, lift, col):
    """A thin panel lying on the slope from (x0, z0) to (x1, z1), between y = ya .. yb, spanning t0 .. t1 of the slope."""
    pa = (x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0)
    pb = (x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1)
    nx, nz = -(z1 - z0), (x1 - x0)
    ln = math.hypot(nx, nz)
    nx, nz = nx / ln * lift, nz / ln * lift
    b.prism_y([pa, pb, (pb[0] + nx, pb[1] + nz), (pa[0] + nx, pa[1] + nz)], ya, yb, col)


def scrapper(rot):
    b = _Build(rot, f"scrapper_{rot}")
    b.box(0.04, 3.96, 0.04, 1.96, 0, BASE, GMD, DARK)                                   # plinth band
    # ---- screen end (x 3..4): the top slopes down toward the +x end, two screens on the slope, one per row
    xa, za, xb, zb = 3.08, 0.98, 3.92, 0.54                                               # slope from (xa, za) to (xb, zb)
    b.prism_y([(3.0, BASE), (3.96, BASE), (3.96, zb - 0.06), (xb, zb), (xa, za), (3.0, za)], 0.06, 1.94, STEEL, STEEL_T)
    for ya, yb in ((0.18, 0.88), (1.12, 1.82)):
        on_slope(b, xa, xb, za, zb, ya, yb, 0.12, 0.9, 0.02, GMD)                         # bezel
        on_slope(b, xa, xb, za, zb, ya + 0.06, yb - 0.06, 0.2, 0.82, 0.035, LIGHT)        # screen
    # ---- centre block (x 2..3): tall back row with the dial, lower front row with a display and an output slot
    cbox(b, 2.02, 3.0, 0.06, 1.0, BASE, 1.12)
    cbox(b, 2.02, 3.0, 1.0, 1.94, BASE, 0.96)
    b.cyl(2.51, 0.53, 1.12, 0.31, 0.05, GMD, GM, sides=8)                                  # dial housing
    b.cyl(2.51, 0.53, 1.17, 0.22, 0.03, GM, LIGHT, sides=8)                                # dial face
    b.box(2.2, 2.84, 1.94, 1.97, 0.52, 0.76, GMD)                                          # display bezel
    b.box(2.28, 2.76, 1.97, 1.99, 0.56, 0.72, LIT)                                          # display
    b.box(2.22, 2.82, 1.94, 1.98, BASE, 0.36, GMD)                                         # output slot frame
    b.box(2.3, 2.74, 1.95, 1.99, BASE, 0.3, DARK)                                          # output slot
    # ---- drum bay (x 1..2): the hopper with an open lit mouth at the back, the shredder drum in an open bay at the front
    cbox(b, 1.02, 2.0, 0.06, 0.96, BASE, 1.04)
    b.box(1.14, 1.88, 0.18, 0.84, 1.02, 1.05, DARK)                                         # hopper mouth
    b.box(1.18, 1.84, 0.22, 0.8, 1.05, 1.055, LIT)                                         # its lit throat (glow later)
    b.box(1.02, 2.0, 0.96, 1.94, BASE, 0.16, GMD, GM)                                      # bay floor
    for x0 in (1.02, 1.92):
        b.prism_x([(0.96, BASE), (1.94, BASE), (1.94, 0.26), (1.7, 0.84), (0.96, 0.84)], x0, x0 + 0.08, STEEL, STEEL_T)  # cheeks
    b.roller(1.4, 0.5, 0.33, 1.12, 1.9, GM, sides=16)                                    # drum
    for k in range(5):
        b.roller(1.4, 0.5, 0.36, 1.17 + k * 0.155, 1.21 + k * 0.155, GMD, sides=16)      # cutter rings
    # ---- end block (x 0..1): tall back box with the pipe unit on top, lower front box with the feed doorway
    cbox(b, 0.06, 1.0, 0.06, 1.0, BASE, 0.94)
    cbox(b, 0.06, 1.0, 1.0, 1.94, BASE, 0.74)
    b.box(0.26, 0.8, 0.26, 0.74, 0.94, 1.1, GM, PLATE)                                     # pipe unit
    b.roller(0.5, 1.02, 0.07, 0.8, 1.06, GMD, sides=8)                                      # its spout
    b.box(0.22, 0.84, 1.94, 1.98, BASE, 0.44, GMD)                                         # doorway frame
    b.box(0.3, 0.76, 1.95, 1.99, BASE, 0.38, DARK)                                         # doorway
    return [b.m.build()]


def jobs():
    out = []
    for r in range(4):
        fp = FOOTPRINT if r % 2 == 0 else FOOTPRINT[::-1]
        out.append((f"module.scrapper.blockout.r{r}", fp, "prop", lambda r=r: scrapper(r)))
    return out
