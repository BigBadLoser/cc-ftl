"""Vending machine look study, round 10 (family `vending10`, palette set vending, preview only): round 9 rebuilt as
one proper body (user, 2026-11-13: a mesh shot showed stuck-on parts, a ledge where the cream skin ended, details
poking past the rounded corners, and the top dropping the curved face).

The body is a single generated mesh: a rounded-rectangle section (straight front, back and sides, round vertical
corners), and the top edge rounds over into a flat top, so the curved corners carry through to the roof. The colours
are the body's own faces (no skin, no ledge): cream on the front, wrapping round the corners to a curved edge on each
side, wine elsewhere, wine top band. The front's windows are real recesses cut into the front face, glazed, with the
packets and cans inside; the keypad and the pickup tray are recesses too; the sign strip and the divider are faces.
Every front opening stays on the flat of the front. The back keeps round 3's locked layout: its vent slots are cut
in, the service panel, screws, label and cable sit on the flat back.

  vm1c10a narrow wrap · vm1c10b rising sweep · vm1c10c pinstripe (yellow faces along the edge, wine kick band)

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
import math

from . import core
from .bench_r7 import tube
from .bench_study import along_u
from .exercise_r4 import build, spline, sweep
from .research_kit import ZPX, Bench
from .vending_r2 import PACKETS
from .vending_study import FP

CY, A, B, RC = -1.5, 15.3, 12.6, 3.5               # section: centre v, half width, half depth, corner radius
TOP, RT, CREAM_TOP = 69.6, 2.5, 66                  # height, top roundover radius, cream stops under the wine band
VF, VB, FU = CY + B, CY - B, A - RC                 # front plane, back plane, half length of the flat front/back
HOLES = [  # side, u0, u1, z0, z1, depth, colour of the recess back
    ("F", -11.2, 4.8, 28.5, 57.5, 2.0, "vmGlass"),                 # snack window
    ("F", -11.2, 4.8, 12.0, 26.0, 3.0, "vmPanel"),                 # can window
    ("F", 6.6, 11.2, 33.0, 47.0, 0.8, "vmPanel"),                  # keypad
    ("F", -10.0, 3.6, 4.4, 9.6, 2.5, "vmDark"),                    # pickup tray
] + [("B", -9.0, 9.0, z - 0.55, z + 0.55, 0.8, "vmDark") for z in range(30, 55, 3)]   # vent slots
SIGN, DIVIDER = (-11.0, 11.0, 62.4, 64.4), (-11.7, 5.3, 26.6, 28.2)
WAVES = {
    "vm1c10a": [(0, 6.5), (14, 5.5), (30, 3.8), (46, 5.8), (66, 7.2)],
    "vm1c10b": [(0, -5), (18, -3.5), (36, 1.5), (52, 6), (66, 8)],
    "vm1c10c": [(0, 7), (14, 2.5), (30, -0.5), (44, 3.5), (58, 7.5), (66, 7)],
}


def G(k, u, v, z):
    return core.G(*k.p(u / 32, v / 32), z / ZPX)


def face(k, pts, col, n):
    """A polygon from local (u, v, z) points, wound so it faces along n."""
    (a, b, c) = pts[:3]
    e1, e2 = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
    cr = (e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0])
    if sum(cr[i] * n[i] for i in range(3)) < 0:
        pts = pts[::-1]
    k.m.poly([G(k, *p) for p in pts], col, flip=True)


def breaks(lo, hi, extra, step=1.0):
    xs = sorted({lo, hi} | {x for x in extra if lo < x < hi} | {lo + i * step for i in range(int((hi - lo) / step) + 1)})
    out = [xs[0]]
    for x in xs[1:]:
        if x - out[-1] > 0.05:                                                     # no sliver faces
            out.append(x)
    if out[-1] != hi:
        out[-1] = hi
    return out


def ring(d):
    """The section inset by d, counter-clockwise from the bottom of the +u side, as (u, v, side) points."""
    a, r = A - d, max(RC - d, 0.3)
    fv = [VF - RC, VB + RC]                                                        # straight side span (v)
    hole_u = [x for h in HOLES for x in (h[1], h[2])] + [SIGN[0], SIGN[1], DIVIDER[0], DIVIDER[1]]
    us = breaks(-FU, FU, hole_u)
    pts = [(a, v, "R") for v in breaks(fv[1], fv[0], [], 0.5)[:-1]]
    def arc(cu, cv, a0):
        return [(cu + r * math.cos(a0 + math.pi / 2 * i / 10), cv + r * math.sin(a0 + math.pi / 2 * i / 10), "C")
                for i in range(10)]
    pts += arc(FU, fv[0], 0)
    pts += [(u, VF - d, "F") for u in us[::-1][:-1]]
    pts += arc(-FU, fv[0], math.pi / 2)
    pts += [(-a, v, "L") for v in breaks(fv[1], fv[0], [], 0.5)[::-1][:-1]]
    pts += arc(-FU, fv[1], math.pi)
    pts += [(u, VB + d, "B") for u in us[:-1]]
    pts += arc(FU, fv[1], 3 * math.pi / 2)
    return pts


def rows():
    zs = [x for h in HOLES for x in (h[3], h[4])] + [SIGN[2], SIGN[3], DIVIDER[2], DIVIDER[3], CREAM_TOP, 4.0]
    out = [(z, 0.0) for z in breaks(0, TOP - RT, zs)]
    out += [(TOP - RT + RT * math.sin(math.radians(15 * k)), RT * (1 - math.cos(math.radians(15 * k))))
            for k in range(1, 7)]
    return out


def in_hole(side, u, z):
    for h in HOLES:
        if h[0] == side and h[1] < u < h[2] and h[3] < z < h[4]:
            return h
    return None


def colour(side, u, v, z, vb, stripe, kick):
    if z > CREAM_TOP:
        return "vmWine"
    if side == "F":
        if SIGN[0] < u < SIGN[1] and SIGN[2] < z < SIGN[3]:
            return "vmSign"
        if DIVIDER[0] < u < DIVIDER[1] and DIVIDER[2] < z < DIVIDER[3]:
            return "vmWine"
    if kick and z < 4 and v > CY:
        return "vmWine"
    edge = vb(z)
    if v >= edge:
        return "vmCream"
    if stripe and v >= edge - 0.9:
        return "vmItemY"
    if v < CY and abs(u) <= 13.3:
        return "vmCream"                                                           # back panel
    return "vmWine"


def body(k, wave, stripe=False, kick=False, paint=None):
    """paint(side, u, v, z): a colour for an outer face, or None to colour it by the wave (later rounds)."""
    pts = spline(wave, 12)

    def vb(z):
        for (za, va), (zb, vb_) in zip(pts, pts[1:]):
            if za <= z <= zb:
                return va + (vb_ - va) * (z - za) / ((zb - za) or 1)
        return pts[-1][1]

    rs = [(z, ring(d)) for z, d in rows()]
    for (z0, r0), (z1, r1) in zip(rs, rs[1:]):
        n = len(r0)
        for i in range(n):
            j = (i + 1) % n
            side = r0[i][2]
            uc, vc, zc = (r0[i][0] + r0[j][0]) / 2, (r0[i][1] + r0[j][1]) / 2, (z0 + z1) / 2
            if side in "FB" and r0[j][2] in "FB" and in_hole(side, uc, zc):
                continue
            quad = [(r0[i][0], r0[i][1], z0), (r0[j][0], r0[j][1], z0), (r1[j][0], r1[j][1], z1),
                    (r1[i][0], r1[i][1], z1)]
            col = (paint and paint(side, uc, vc, zc)) or colour(side, uc, vc, zc, vb, stripe, kick)
            k.m.poly([G(k, *p) for p in quad], col, flip=True)
    top = rs[-1]
    cu, cv = 0.0, CY
    loops = [[(u, v) for u, v, _ in top[1]]]
    for f in (0.9, 0.75, 0.6, 0.45, 0.3, 0.15):                                    # the flat top in rings: a rim
        loops.append([(cu + (u - cu) * f, cv + (v - cv) * f) for u, v, _ in top[1]])   # keeps the cap's normals
    for a, b in zip(loops, loops[1:]):                                             # up, and no long thin
        for i in range(len(a)):                                                    # triangles (shadow acne)
            j = (i + 1) % len(a)
            face(k, [(a[i][0], a[i][1], top[0]), (a[j][0], a[j][1], top[0]), (b[j][0], b[j][1], top[0]),
                     (b[i][0], b[i][1], top[0])], "vmWine", (0, 0, 1))
    face(k, [(u, v, top[0]) for u, v in loops[-1]], "vmWine", (0, 0, 1))
    face(k, [(u, v, 0.0) for u, v, _ in rs[0][1]], "vmWineD", (0, 0, -1))                  # bottom
    for side, u0, u1, z0, z1, dep, col in HOLES:                                           # recesses
        p, s = (VF, -1) if side == "F" else (VB, 1)
        q = p + s * dep
        wall = "vmCreamD" if col != "vmDark" else "vmDark"
        face(k, [(u0, q, z0), (u1, q, z0), (u1, q, z1), (u0, q, z1)], col, (0, -s, 0))
        face(k, [(u0, p, z0), (u1, p, z0), (u1, q, z0), (u0, q, z0)], wall, (0, 0, 1))
        face(k, [(u0, p, z1), (u1, p, z1), (u1, q, z1), (u0, q, z1)], wall, (0, 0, -1))
        face(k, [(u0, p, z0), (u0, q, z0), (u0, q, z1), (u0, p, z1)], wall, (1, 0, 0))
        face(k, [(u1, p, z0), (u1, q, z0), (u1, q, z1), (u1, p, z1)], wall, (-1, 0, 0))


def contents(k):
    v = VF - 2.0 + 0.7                                                             # inside the snack window
    for row, z in enumerate((33, 40, 47, 54)):
        for j, u in enumerate((-9.2, -5.3, -1.4, 2.5)):
            along_u(k, u - 1.6, u + 1.6, v, z, 0.5, 2.4, PACKETS[(row + j) % 4], p=3)
        along_u(k, -11.2, 4.8, v + 0.1, z - 3, 0.6, 0.3, "vmCreamD", p=2.4)          # shelf
    for z in (16.0, 22.4):                                                         # cans in the can window
        for j, u in enumerate((-9.6, -6.6, -3.6, -0.6, 2.4)):
            sweep(k, [(u, VF - 1.6, z - 2.4, 1.3, 1.3), (u, VF - 1.6, z + 2.4, 1.3, 1.3)],
                  ("vmItemB", "vmCreamD")[j % 2], p=2, n=10)
    for zz in (36.5, 39, 41.5):                                                    # keys, flush with the front
        for u in (8.0, 9.8):
            along_u(k, u - 0.6, u + 0.6, VF - 0.4, zz, 0.4, 0.6, "vmCreamD", p=3)
    along_u(k, 7.4, 10.4, VF - 0.5, 44.5, 0.3, 0.4, "vmDark", p=3)                  # card slot
    g = k.part("glass")
    for u0, u1, z0, z1 in ((-11.2, 4.8, 28.5, 57.5), (-11.2, 4.8, 12.0, 26.0)):     # panes, just inside the front
        g.box((u0 + u1) / 64, (VF - 0.3) / 32, z0 / ZPX, (u1 - u0) / 32, 0.2 / 32, (z1 - z0) / ZPX, "vmPane",
              top="vmPane")


def back(k):
    along_u(k, -8, 8, VB - 0.25, 15, 0.3, 7, "vmCreamD", p=5)                       # service panel
    for u in (-6.8, 6.8):
        for z in (9, 21):
            along_u(k, u - 0.5, u + 0.5, VB - 0.6, z, 0.3, 0.5, "vmPanel", p=2.4)   # screws
    along_u(k, -3, 3, VB - 0.25, 60, 0.3, 1.6, "vmPanel", p=4)                      # label plate
    tube(k, [(10, VB - 0.6, 9), (10.5, VB - 1.3, 6), (10, VB - 1.6, 2.5), (8, VB - 1.6, 0.7), (4, VB - 1.0, 0.7)],
         0.8, "vmDark")                                                            # cable


def make(name):
    def f():
        k = Bench(f"vending_{name}", FP)
        c = name.endswith("c")
        body(k, WAVES[name], stripe=c, kick=c)
        contents(k)
        back(k)
        return build(k)
    return f


DESIGNS = {n: make(n) for n in WAVES}


def jobs():
    return [(f"module.vending10.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
