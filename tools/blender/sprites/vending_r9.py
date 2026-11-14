"""Vending machine look study, round 9 (family `vending9`, palette set vending, preview only): the split colour again,
done properly (user, 2026-11-13). The machine is now one wine shell: a rounded column (superellipse section, p 6) with
a flat top, so the roof is no longer a separate box sitting on the body (round 2's header box left a seam). The cream
is a skin on that shell (0.2 px proud), so it wraps smoothly round the rounded front corners onto the sides and ends
on a curved line there; the wine part is the larger. The top band stays wine all round (the old header). The front
fittings (round 2's VM1C) and the locked back (round 3) are moved out to the new surfaces; the back keeps its cream
panel between wine edges.

  vm1c9a narrow wrap: the cream wraps a few px onto each side, its edge a gentle S
  vm1c9b rising sweep: the cream covers much of the low side and narrows as it rises to the top front corner
  vm1c9c pinstripe: a deeper S edge with a yellow pinstripe along it and a wine kick band at the floor

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
import math

from . import core
from .bench_r7 import tube
from .bench_study import along_u
from .exercise_r4 import build, spline, sweep
from .research_kit import ZPX, Bench
from .vending_r2 import PACKETS
from .vending_study import FP

CY, A, B, P = -1.5, 15.3, 12.6, 6                 # shell section: centre v, half width, half depth, squareness
TOP, CREAM_TOP = 69.6, 66                         # shell top; the cream stops under the wine top band
SKIN = 0.2                                        # the cream skin stands this far off the shell
DV, DB = 1.0, -0.9                                # front and back fittings moved out onto the new surfaces


def at(t, out=0.0):
    """(u, v) on the shell section at angle t (0 = +u side, pi/2 = front), `out` px outside it."""
    c, s = math.cos(t), math.sin(t)
    return (math.copysign(abs(c) ** (2 / P), c) * (A + out), CY + math.copysign(abs(s) ** (2 / P), s) * (B + out))


def edge_t(v):
    """The angle on the +u side where the shell reaches depth v."""
    f = max(-0.999, min(0.999, (v - CY) / B))
    return math.asin(math.copysign(abs(f) ** (P / 2), f))


def G(k, u, v, z):
    return core.G(*k.p(u / 32, v / 32), z / ZPX)


def skin(k, spans, z0, z1, col="vmCream", nt=64):
    """Cream on the shell between z0 and z1; spans(z) gives the (t_from, t_to) it covers at height z."""
    zs = [z0 + (z1 - z0) * j / int(z1 - z0) for j in range(int(z1 - z0) + 1)]
    grid = []
    for z in zs:
        t0, t1 = spans(z)
        grid.append([G(k, *at(t0 + (t1 - t0) * i / nt, SKIN), z) for i in range(nt + 1)])
    for r0, r1 in zip(grid, grid[1:]):
        for i in range(nt):
            k.m.poly([r0[i], r0[i + 1], r1[i + 1], r1[i]], col, flip=True)


def shell(k):
    sweep(k, [(0, CY, 0, A, B), (0, CY, TOP, A, B)], "vmWine", p=P, n=64, steps=2, cap0="vmWineD", cap1="vmWine")
    bt = math.acos(min(1.0, (13.3 / A) ** (P / 2)))                               # the back panel stops 2 px in
    skin(k, lambda z: (math.pi + bt, 2 * math.pi - bt), 0, CREAM_TOP)               # back cream panel


def front_cream(k, wave, z0=0.0):
    pts = spline([(z, v) for z, v in wave], 12)

    def vb(z):
        for (za, va), (zb, vb_) in zip(pts, pts[1:]):
            if za <= z <= zb:
                return va + (vb_ - va) * (z - za) / ((zb - za) or 1)
        return pts[-1][1]

    skin(k, lambda z: (edge_t(vb(z)), math.pi - edge_t(vb(z))), z0, CREAM_TOP)
    return vb


def fittings(k):
    v = 10.5 + DV                                                                  # the front face
    along_u(k, -11.5, 11.5, v + 0.5, TOP - 6.2, 0.4, 1, "vmSign", p=3)              # dim sign strip, on the wine band
    along_u(k, -12.2, 5.3, v, 43, 0.5, 15, "vmGlass", p=4)                          # snack glass
    for row, z in enumerate((33, 40, 47, 54)):
        for j, u in enumerate((-9.6, -5.5, -1.4, 2.7)):
            along_u(k, u - 1.6, u + 1.6, v + 0.2, z, 0.5, 2.4, PACKETS[(row + j) % 4], p=3)
        along_u(k, -12.1, 4.2, v + 0.3, z - 3, 0.3, 0.3, "vmCreamD", p=2.4)         # shelf lip
    along_u(k, -12.7, 5.8, v + 0.3, 27.4, 0.5, 0.8, "vmWine", p=4)                  # divider
    along_u(k, -12.2, 5.3, v, 19, 0.5, 7.4, "vmPanel", p=4)                         # chilled glass
    for z in (15.5, 22):                                                           # cans
        for j, u in enumerate((-10, -6.8, -3.6, -0.4, 2.8)):
            sweep(k, [(u, v + 0.6, z - 2.4, 1.3, 1.3), (u, v + 0.6, z + 2.4, 1.3, 1.3)],
                  ("vmItemB", "vmCreamD")[j % 2], p=2, n=10)
    along_u(k, 7.2, 12.4, v, 40, 0.5, 7, "vmPanel", p=4)                            # keypad
    for zz in (36.5, 39, 41.5):
        for u in (8.7, 10.9):
            along_u(k, u - 0.6, u + 0.6, v + 0.6, zz, 0.3, 0.6, "vmCreamD", p=3)
    along_u(k, 8.2, 11.4, v + 0.6, 44.5, 0.3, 0.4, "vmDark", p=3)                    # card slot
    along_u(k, -11, 4.5, v, 7, 0.6, 2.6, "vmGlass", p=4)                             # pickup tray


def back(k):
    """Round 3's locked back, moved out onto the new back face."""
    for z in range(30, 55, 3):                                                     # vent grille
        along_u(k, -9, 9, -13.7 + DB, z, 0.4, 0.55, "vmDark", p=3)
    along_u(k, -8, 8, -13.6 + DB, 15, 0.4, 7, "vmCreamD", p=5)                      # service panel
    for u in (-6.8, 6.8):
        for z in (9, 21):
            along_u(k, u - 0.5, u + 0.5, -14.1 + DB, z, 0.3, 0.5, "vmPanel", p=2.4)  # screws
    along_u(k, -3, 3, -14 + DB, 60, 0.3, 1.6, "vmPanel", p=4)                       # label plate
    tube(k, [(10, -14.7, 9), (10.5, -15.4, 6), (10, -15.8, 2.5), (8, -15.8, 0.7), (4, -15.2, 0.7)], 0.8,
         "vmDark")                                                                 # cable


def pinstripe(k, vb, z0, z1):
    for s in (-1, 1):
        pts = []
        for j in range(int(z1 - z0) + 1):
            z = z0 + j
            u, v = at(edge_t(vb(z)), SKIN + 0.25)
            pts.append((s * u, v, z, 0.55, 0.55))
        sweep(k, pts[::2], "vmItemY", p=2, n=8, steps=3)


WAVES = {
    "vm1c9a": [(0, 6.5), (14, 5.5), (30, 3.8), (46, 5.8), (66, 7.2)],
    "vm1c9b": [(0, -5), (18, -3.5), (36, 1.5), (52, 6), (66, 8)],
    "vm1c9c": [(0, 7), (14, 2.5), (30, -0.5), (44, 3.5), (58, 7.5), (66, 7)],
}


def make(name):
    def f():
        k = Bench(f"vending_{name}", FP)
        shell(k)
        z0 = 4.0 if name == "vm1c9c" else 0.0
        vb = front_cream(k, WAVES[name], z0)
        if name == "vm1c9c":
            pinstripe(k, vb, z0, CREAM_TOP)
        fittings(k)
        back(k)
        return build(k)
    return f


DESIGNS = {n: make(n) for n in WAVES}


def jobs():
    return [(f"module.vending9.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
