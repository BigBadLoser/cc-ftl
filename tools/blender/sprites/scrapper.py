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
BASE = 0.06          # dark plinth band
TOP = 1.2            # shell height (measured on the reference: 1.17 .. 1.25 tiles)
R = 0.09             # top-edge rounding

# Measured layout (reference parts are one tile each; L runs from the hatch end): mirrored so rotation 0 shows the hatch end
# at lower right and the front face at lower left. Tile x = 3: hatch end (both rows). x = 2: display block (front, main
# doorway: the access tile) and dial block (back). x = 1: drum (front) and hopper (back). x = 0: pipe unit (front) and a
# second hatch block sloping down to the far end (back).


def rbox(b, x0, x1, y0, y1, z0, z1, col=STEEL, top=STEEL_T, r=R):
    """A block with rounded top edges: a box and two frustum steps."""
    b.box(x0, x1, y0, y1, z0, z1 - r, col)
    ring = lambda d, z: [b._tp(x, y, z) for x, y in ((x0 + d, y0 + d), (x1 - d, y0 + d), (x1 - d, y1 - d), (x0 + d, y1 - d))]  # noqa: E731
    b.solid([ring(0, z1 - r), ring(r * 0.35, z1 - r * 0.25)], col, top)
    b.solid([ring(r * 0.35, z1 - r * 0.25), ring(r, z1)], col, top)


def roller_y(b, x, z, r, y0, y1, col, sides=12):
    prof = [(x + r * math.cos((i + .5) * math.tau / sides), z + r * math.sin((i + .5) * math.tau / sides)) for i in range(sides)]
    b.prism_y(prof, y0, y1, col)


def on_slope(b, x0, x1, z0, z1, ya, yb, t0, t1, lift, col):
    """A thin panel lying on the slope from (x0, z0) to (x1, z1), between y = ya .. yb, spanning t0 .. t1 of the slope."""
    pa = (x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0)
    pb = (x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1)
    nx, nz = -(z1 - z0), (x1 - x0)
    ln = math.hypot(nx, nz)
    if nz < 0:
        nx, nz = -nx, -nz
    nx, nz = nx / ln * lift, nz / ln * lift
    b.prism_y([pa, pb, (pb[0] + nx, pb[1] + nz), (pa[0] + nx, pa[1] + nz)], ya, yb, col)


def hatch_block(b, xi, xo, y0, y1, wall=0.62):
    """Measured hatch block: inner edge at xi (full height), outer end at xo; wall 0.55 at the end, slope over 0.55 of the
    tile up to 1.12, flat 1.17 to the inner edge. One hatch with sliding double doors on the slope."""
    d = 1 if xo > xi else -1
    X = lambda t: xi + (xo - xi) * t                                                      # noqa: E731  t: 0 inner .. 1 outer
    prof = [(X(0), BASE), (X(1), BASE), (X(1), wall - 0.05), (X(0.96), wall), (X(0.46), 1.12), (X(0.4), 1.16), (X(0), 1.16)]
    if d < 0:
        prof = prof[::-1]
    b.box(min(xi, xo), max(xi, xo), y0, y1, 0, BASE, GMD, DARK)
    b.prism_y(prof, y0, y1, STEEL, STEEL_T)
    sa, sb = (X(0.94), wall + 0.01), (X(0.48), 1.1)                                             # the slope, outer to inner
    on_slope(b, sa[0], sb[0], sa[1], sb[1], y0 + 0.1, y1 - 0.1, 0.06, 0.94, 0.025, GMD)  # frame
    mid = (y0 + y1) / 2
    for ya, yb in ((y0 + 0.15, mid - 0.012), (mid + 0.012, y1 - 0.15)):
        on_slope(b, sa[0], sb[0], sa[1], sb[1], ya, yb, 0.14, 0.86, 0.04, PLATE)         # door leaves


def doorway(b, x0, x1, y, h):
    """A framed opening in a +y face: steel frame standing proud, dark inside, a lit floor grate."""
    b.box(x0, x1, y - 0.02, y + 0.04, BASE, h, GM, PLATE)
    b.box(x0 + 0.05, x1 - 0.05, y - 0.03, y + 0.045, BASE, h - 0.05, DARK)
    b.box(x0 + 0.05, x1 - 0.05, y - 0.03, y + 0.045, BASE, BASE + 0.015, GMD)


def scrapper(rot):
    b = _Build(rot, f"scrapper_{rot}")
    g = 0.012                                                                             # seam between blocks
    # x 3..4: the hatch end, both rows
    hatch_block(b, 3.0 + g, 3.96, 0.04, 1.0 - g)
    hatch_block(b, 3.0 + g, 3.96, 1.0 + g, 1.96)
    # x 2..3: display block (front) with the main doorway at the access tile; dial block (back)
    b.box(2.0 + g, 3.0 - g, 0.04, 1.96, 0, BASE, GMD, DARK)
    rbox(b, 2.0 + g, 3.0 - g, 1.0 + g, 1.96, BASE, 1.33, r=0.12)
    b.box(2.08, 2.48, 1.96, 1.99, 0.8, 1.08, GMD)                                         # display bezel
    b.box(2.12, 2.44, 1.98, 2.0, 0.85, 1.03, LIT)                                         # display
    doorway(b, 2.06, 2.56, 1.96, 0.46)
    b.cyl(2.62, 1.48, 1.33, 0.16, 0.012, GMD, sides=12)                                   # emblem plate (decal later)
    rbox(b, 2.0 + g, 3.0 - g, 0.04, 1.0 - g, BASE, 1.33, r=0.12)
    b.cyl(2.5, 0.52, 1.31, 0.33, 0.05, GMD, GM, sides=8)                                  # dial housing
    b.cyl(2.5, 0.52, 1.35, 0.25, 0.03, GM, LIGHT, sides=8)                                # dial face
    # x 1..2: the drum (front) in a low cradle; the hopper (back) with its lit chute over the drum
    b.box(1.0 + g, 2.0 - g, 1.0 + g, 1.96, 0, 0.12, GMD, GM)
    b.roller(1.48, 0.4, 0.34, 1.12, 1.74, GM, sides=18)                                   # barrel, top 0.74
    for k in range(4):
        b.roller(1.48, 0.4, 0.365, 1.22 + k * 0.13, 1.27 + k * 0.13, GMD, sides=18)       # cutter rings
    b.roller(1.48, 0.43, 0.51, 1.03, 1.2, GMD, sides=8)                                   # shroud frame, top 0.94
    b.roller(1.48, 0.4, 0.2, 1.74, 1.77, DARK, sides=12)                                  # hollow end
    rbox(b, 1.0 + g, 2.0 - g, 0.04, 1.0 - g, 0, 1.24)
    b.box(1.04, 1.46, 0.99, 1.02, 0.36, 0.86, GMD)                                        # chute frame
    b.box(1.08, 1.42, 1.0, 1.025, 0.4, 0.82, LIT)                                         # lit chute
    for k in range(3):
        roller_y(b, 1.12 + k * 0.13, 1.31, 0.07, 0.62, 0.98, STEEL, sides=10)            # pulleys on the top front edge
    b.cyl(1.66, 0.4, 1.24, 0.14, 0.012, DARK, sides=12)                                    # vent grille
    # x 0..1: pipe unit (front), inset from the end, with a motor and the second doorway; a hatch block (back) to the end
    rbox(b, 0.14, 1.0 - g, 1.0 + g, 1.56, 0, 1.0)                                         # back step
    rbox(b, 0.14, 1.0 - g, 1.5, 1.86, 0, 0.66)                                            # front step, the doorway's
    b.box(0.36, 0.84, 1.12, 1.5, 1.0, 1.2, GM, PLATE)                                     # motor
    b.roller(1.31, 1.1, 0.07, 0.12, 0.36, GMD, sides=8)                                   # its spout
    doorway(b, 0.24, 0.7, 1.86, 0.44)
    hatch_block(b, 1.0 - g, 0.04, 0.04, 1.0 - g, wall=0.66)
    return [b.m.build()]


def jobs():
    out = []
    for r in range(4):
        fp = FOOTPRINT if r % 2 == 0 else FOOTPRINT[::-1]
        out.append((f"module.scrapper.blockout.r{r}", fp, "prop", lambda r=r: scrapper(r)))
    return out
