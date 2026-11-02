"""What is inside each scrap crate (items_salvage.py): one builder per scrap type, in the grid frame of the crate (x the
short axis, |x| <= 0.105 inside; y the long axis, |y| <= 0.155; the interior floor at FILL). Each type has a low bed and
one or two "character pieces" standing over the rim to catch the eye; items_salvage.inside() checks every piece stays
in the crate's column (a crate stacked on top hides everything up to its own interior floor). Fixed tables, no random.

  hull     dark plating and a rust sheet, three bright girder bars fanning up
  tech     a green circuit board bed, a cracked screen standing up, a cable loop arcing over the rim
  energy   spent power cells (dark, a yellow band, a faint glowing cap), one tipped tall, a broken copper coil
  weapons  two gun barrels raised over the rim, brass casings on the bed, a red-tipped shell standing up
  comfort  cream foam blocks, torn teal and maroon fabric, a cushion on edge and a bare spring"""
import math

import bmesh
from mathutils import Euler, Vector

from . import core
from .items_kit import cone, emit, tube

Q = math.pi / 2


def _plate(m, u, v, z, rz, rx, ry, w, d, col, k, th=0.012, top=None):
    """A thin plate; (u, v) is written long side along x and turned onto the crate's long y: (u, v) -> grid (-v, u)."""
    m.box((-v * k, u * k, z * k), (w * k, d * k, th * k), col, top=top or col, rz=rz + Q, rx=rx, ry=ry)


def _bar(m, u, v, z, rz, ry, L, k, col="svB2", top="svB1", s=0.026):
    """A square steel bar centred at (u, v, z), turned rz about z and raised ry about its width: bright on top."""
    m.box((-v * k, u * k, z * k), (L * k, s * k, s * k), col, top=top, rz=rz + Q, ry=ry)


def _tube(m, p0, p1, r, col, k, cap=None, sides=8):
    tube(m, tuple(c * k for c in p0), tuple(c * k for c in p1), r * k, col, cap=cap, sides=sides)


def _ring(m, c, R, r, tilt, col, k, n=10, arc=1.0):
    """A ring (or part of one, arc < 1) of tube segments: centre c, radius R, wire radius r, tilted `tilt` about x."""
    pts = []
    for i in range(int(n * arc) + 1):
        a = i / n * math.tau
        x, y = R * math.cos(a), R * math.sin(a)
        pts.append((c[0] + x, c[1] + y * math.cos(tilt), c[2] + y * math.sin(tilt)))
    for a, b in zip(pts, pts[1:]):
        _tube(m, a, b, r, col, k, sides=6)


def hull(m, f, k=1.0):
    for u, v, z, rz, rx, ry, w, d, col in (                        # the bed: dark plates lying on the floor
            (-0.06, -0.02, f + 0.015, 0.1, 0.2, 0.0, 0.15, 0.1, "svP1"),
            (0.07, 0.03, f + 0.02, -0.2, -0.2, 0.1, 0.13, 0.09, "svB3"),
            (0.02, -0.04, f + 0.03, 0.5, 0.0, -0.2, 0.11, 0.07, "svR2")):
        _plate(m, u, v, z, rz, rx, ry, w, d, col, k)
    for u, v, z, rz, ry, L in (                                     # three bars fanning up the same way, one lying
            (-0.01, -0.072, f + 0.075, 0.08, 1.0, 0.26),
            (0.02, 0.0, f + 0.065, 0.0, 1.2, 0.27),
            (-0.01, 0.072, f + 0.075, -0.08, 0.9, 0.25),
            (0.02, -0.05, f + 0.03, 0.4, -0.15, 0.16)):
        _bar(m, u, v, z, rz, ry, L, k)


def tech(m, f, k=1.0):
    _plate(m, 0.04, 0.0, f + 0.012, 0.3, 0.0, 0.0, 0.11, 0.08, "svTg2", k)          # a small board flat on the floor
    for x, y in ((0.03, 0.06), (0.05, 0.02)):                                         # chips on it
        m.box((x * k, y * k, (f + 0.018) * k), (0.025 * k, 0.025 * k, 0.012 * k), "svTk", base=True)
    _plate(m, 0.07, 0.03, f + 0.045, -0.2, 0.55, 0.0, 0.08, 0.06, "svTg1", k)        # a small board leaning up
    # cracked screen standing nearly upright at the back, facing the camera, over the rim: the crate's read
    c, n = (-0.03 * k, -0.04 * k, f * k), (math.sqrt(0.5), math.sqrt(0.5))
    m.box(c, (0.014 * k, 0.17 * k, 0.16 * k), "svTsc2", top="svTk", rz=math.pi / 4, ry=-0.1, base=True)
    o = 0.009 * k
    for zc, rx, L in ((0.1, 0.7, 0.15), (0.07, -0.5, 0.09)):                          # the cracks
        m.box((c[0] + n[0] * o, c[1] + n[1] * o, c[2] + zc * k), (0.004 * k, L * k, 0.01 * k), "svTsc1",
              rx=rx, rz=math.pi / 4)
    for p0, p1, col in (((0.06, 0.1, f + 0.01), (0.04, 0.05, f + 0.18), "svTcu"),     # copper cable loop over the rim
                        ((0.04, 0.05, f + 0.18), (0.05, -0.02, f + 0.19), "svTcu"),
                        ((0.05, -0.02, f + 0.19), (0.075, -0.08, f + 0.05), "svTcu"),
                        ((0.075, -0.08, f + 0.05), (0.08, -0.1, f + 0.03), "svTk")):
        _tube(m, p0, p1, 0.011, col, k, sides=6)


def energy(m, f, k=1.0):
    def cell(x, y, h):
        """A spent power cell standing up: pale casing, a dark band, a pale cyan cap with a faint glowing core."""
        z = f - 0.01
        m.cyl((x * k, y * k, z * k), 0.028 * k, h * k, "svEcell", sides=10)
        m.cyl((x * k, y * k, (z + h * 0.5) * k), 0.03 * k, 0.03 * k, "svEk", sides=10)
        m.cyl((x * k, y * k, (z + h) * k), 0.022 * k, 0.012 * k, "svEk", sides=10, top="svEcap")
        m.cyl((x * k, y * k, (z + h + 0.012) * k), 0.01 * k, 0.004 * k, "svEglow", sides=6)
    for x, y, h in ((-0.05, -0.1, 0.13), (0.045, -0.085, 0.12), (-0.05, -0.02, 0.15), (0.05, 0.0, 0.12),
                    (-0.04, 0.07, 0.13), (0.045, 0.085, 0.14)):
        cell(x, y, h)
    p0, p1 = (0.0, 0.03, f + 0.02), (0.035, 0.1, f + 0.17)                            # one cell tipped up tall
    _tube(m, p0, p1, 0.03, "svEcell", k, cap="svEcap", sides=10)
    t = 0.45
    _tube(m, tuple(a + (b - a) * t for a, b in zip(p0, p1)), tuple(a + (b - a) * (t + 0.15) for a, b in zip(p0, p1)),
          0.032, "svEk", k, sides=10)
    _ring(m, (0.0, -0.06, f + 0.16), 0.045, 0.012, 0.9, "svEcu", k, arc=0.7)       # broken coil


def weapons(m, f, k=1.0):
    _plate(m, -0.04, 0.0, f + 0.012, 0.2, 0.0, 0.0, 0.16, 0.11, "svP1", k)
    _plate(m, 0.07, 0.03, f + 0.02, -0.3, 0.2, 0.0, 0.12, 0.08, "svB3", k)
    for p0, p1, r in (((-0.06, -0.12, f + 0.01), (-0.02, 0.07, f + 0.17), 0.022),     # barrels raised over the rim
                      ((0.065, 0.12, f + 0.01), (0.02, -0.05, f + 0.16), 0.018)):
        _tube(m, p0, p1, r, "svB2", k, cap="svP2", sides=10)
        d = [b - a for a, b in zip(p0, p1)]
        _tube(m, tuple(b - c * 0.12 for b, c in zip(p1, d)), p1, r * 1.35, "svB1", k, sides=10)   # muzzle collar
    for x, y, a in ((0.05, -0.02, 0.4), (0.0, 0.05, 1.6), (-0.06, 0.1, 2.5), (0.07, 0.07, 0.9), (-0.02, -0.1, 2.0)):
        dx, dy = 0.025 * math.cos(a), 0.025 * math.sin(a)                            # spent brass casings
        _tube(m, (x - dx, y - dy, f + 0.03), (x + dx, y + dy, f + 0.03), 0.014, "svWbr", k, cap="svWbr2")
    m.cyl((0.055 * k, -0.08 * k, (f - 0.01) * k), 0.025 * k, 0.12 * k, "svWbr", sides=10, top="svWbr2")  # a shell
    cone(m, (0.055 * k, -0.08 * k, (f + 0.11) * k), (0.055 * k, -0.08 * k, (f + 0.18) * k), 0.025 * k, "svWred")


def _pillow(m, c, size, col, top, k, rz=0.0, rx=0.0, ry=0.0, p=0.45):
    """A plump cushion: a rounded box (superellipsoid, squareness p: 1 = an ellipsoid, smaller = boxier) of `size`
    centred at c, turned rx, ry, rz. Faces turned up take `top`."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1.0)
    R = Euler((rx, ry, rz), "XYZ").to_matrix()
    for v in bm.verts:
        q = Vector(tuple(math.copysign(abs(t) ** p, t) * s_ / 2 for t, s_ in zip(v.co, size)))
        v.co = (R @ q + Vector(c)) * k
    emit(m, bm, lambda n, _c: top if n.z > 0.55 else col)


def _sheet(m, c, w, d, sag, col, k, rz=0.0, tilt=0.0, n=6):
    """A draped fabric sheet (both sides drawn) of w x d centred at c: hangs down `sag` off both long edges as if laid
    over something, turned rz and tilted `tilt` along its width."""
    def pt(i, j):
        u, v = (i / n - 0.5) * w, (j / 2 - 0.5) * d
        z = -sag * (2 * i / n - 1) ** 2 + math.sin(tilt) * v
        x, y = u * math.cos(rz) - v * math.sin(rz), u * math.sin(rz) + v * math.cos(rz)
        return core.G((c[0] + x) * k, (c[1] + y) * k, (c[2] + z) * k)
    for i in range(n):
        for j in range(2):
            q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)]
            m.poly(q, col, flip=True)
            m.poly(q[::-1], col, flip=True)


def comfort(m, f, k=1.0):
    """Upholstery: soft cushions (cream seat, maroon back on its edge over the rim), foam crumbs, torn teal fabric
    draped across."""
    for x, y, sz in ((-0.06, -0.1, 0.05), (0.06, 0.1, 0.045), (0.06, -0.11, 0.04)):           # foam crumbs
        _pillow(m, (x, y, f + sz / 2 - 0.01), (0.06, 0.06, sz), "svCfoam2", "svCfoam", k, rz=0.4, p=0.6)
    _pillow(m, (0.01, 0.02, f + 0.035), (0.17, 0.2, 0.07), "svCfoam2", "svCfoam", k, rz=0.15, rx=0.1)   # seat
    _pillow(m, (-0.035, -0.03, f + 0.09), (0.06, 0.2, 0.14), "svCmar", "svCmar", k, rz=0.3, ry=-0.25)   # back
    _sheet(m, (0.03, 0.03, f + 0.12), 0.18, 0.08, 0.06, "svCteal", k, rz=1.25, tilt=0.3)             # fabric


CONTENTS = {"hull": hull, "tech": tech, "energy": energy, "weapons": weapons, "comfort": comfort}
