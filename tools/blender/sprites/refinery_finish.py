"""Refinery, finished: the hull (refinery.py, refinery_forms.py) in colour and light, with one of five machines on its
deck. Gunmetal body, orange armour, amber glow. Shared: the terminal's screen on a gimbal over its slope, amber strips
on the corner armour, a grille in each end, the output glowing hot when running.

  1 stacks    the plinth and its three stacks, lit through their windows, glowing in their bores
  2 crucible  an open crucible of molten metal on a plinth, a flue pipe to a stack
  3 tanks     two domed process tanks, banded and windowed, joined by a header pipe
  4 crusher   an ore hopper heaped with ore over a ribbed crusher drum between armoured cheeks
  5 kiln      a rotary kiln on riding rings between an intake hood and a discharge hood"""
import math

import numpy as np
from mathutils import Vector

from . import refinery as R
from . import refinery_forms as F
from .modkit import K
from .steelkit import face, slab, tube

BODY, TOP, REC, ARM, ARM_L, ARM_D = "steel", "blueGrey", "steelD", "c1T3", "c1T2", "c1T4"
GLOW, HOT, SCREEN = "orange", "flameY", "lampY"


def colours(on):
    R.G, R.GT, R.GD, R.HOLE = BODY, TOP, REC, "dark"
    F.ARM = ARM
    F.LIT[0] = GLOW if on else None


def lit(on, col=GLOW):
    return col if on else REC


# ---- shared finish -------------------------------------------------------------------------------------------------

def terminal_screen(k, on):
    """A screen on a gimbal over the terminal's slope, tipped back toward the crew."""
    u, zs = 1.12, 0.8 - 0.22 * (1.12 - (R.U - R.B - R.RIM)) / ((R.U - 0.02) - (R.U - R.B - R.RIM))
    k.cyl(u, 0, zs - 0.02, 0.05, 0.14, REC, top=BODY, sides=10)                       # the post
    k.box(u, 0, zs + 0.1, 0.08, 0.5, 0.04, BODY, top=TOP)                              # the yoke
    for e in (-1, 1):
        k.box(u, e * 0.24, zs + 0.1, 0.06, 0.03, 0.14, BODY, top=TOP)
    tilt = math.radians(25)
    n, up = Vector((math.cos(tilt), 0, math.sin(tilt))), Vector((-math.sin(tilt), 0, math.cos(tilt)))
    c, side = Vector((u + 0.02, 0, zs + 0.2)), Vector((0, 1, 0))
    quad = lambda w, h, d=0.0: [c + n * d + side * sw * w / 2 + up * sh * h / 2              # noqa: E731
                                for sw, sh in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    slab(k, quad(0.46, 0.3), n, 0.05, ARM, side=ARM_D)
    face(k, quad(0.38, 0.22, 0.027), n, SCREEN if on else "dark")


def armour_lights(k, on):
    """Amber strips on the corner armour, high on each plate."""
    for i in (1, 3, 5, 7):
        j = (i + 1) % 8
        a = Vector((*R.LO[i], 0)).lerp(Vector((*R.HI[i], 0)), 0.62)
        b = Vector((*R.LO[j], 0)).lerp(Vector((*R.HI[j], 0)), 0.62)
        m, d = (a + b) / 2, b - a
        out = F._n(i)
        p = m + out * (F.T + 0.008)
        k.box(p.x, p.y, 0.5, d.length * 0.5, 0.02, 0.05, lit(on), rz=math.atan2(d.y, d.x))


def end_grilles(k):
    """A grille in each end, between the frame's legs: dark slots under bars."""
    for sv in (-1, 1):
        for z in (0.2, 0.32, 0.44):
            v = sv * (R.V - R.B * z / R.HT)
            k.box(0, v, z, 0.5, 0.03, 0.07, "dark")
            k.box(0, v + sv * 0.012, z + 0.07, 0.54, 0.02, 0.03, BODY, top=TOP)


def output_glow(k, on):
    for v0, v1, kind in R.BAYS[1]:
        if kind == "output":
            ub = R.wall_u(1, R.BZ[0]) - R.D
            k.box(ub + 0.01, (v0 + v1) / 2, R.BZ[0] + 0.24, 0.01, v1 - v0 - 0.3, 0.06, lit(on))


# ---- the machines on the deck --------------------------------------------------------------------------------------

def zt():
    return R.rim_top()


def top_stacks(on):
    def build(k, iu, iv):
        R.spine(k, iu, iv)
        top = R.H + 0.58
        for v in (-0.95, 0.0, 0.95):                                              # the bores glow
            k.cyl(0, v, top + 0.5, 0.255, 0.02, lit(on, GLOW), sides=18)
            k.cyl(0, v, top + 0.51, 0.16, 0.02, lit(on, HOT), sides=14)
    return build


def band(k, u, v, z, r, h=0.07, col=ARM):
    k.cyl(u, v, z, r, h, col, top=ARM_L, sides=22)


def windows(k, u, v, z, r, on, h=0.16):
    for a in (-0.4, 0.4):
        cu, cv = u + (r + 0.004) * math.cos(a), v + (r + 0.004) * math.sin(a)
        k.box(cu, cv, z, 0.03, 0.09, h, lit(on), rz=a)


def top_crucible(on):
    def build(k, iu, iv):
        z = zt()
        R.tier(k, (-0.66, 0.66, -0.7, 0.7), (-0.62, 0.62, -0.66, 0.66), z, z + 0.18, 0.22, 0.19)
        cz, r = z + 0.18, 0.54
        k.cyl(0, 0, cz, r, 0.42, BODY, top=REC, sides=24)
        band(k, 0, 0, cz + 0.04, r + 0.025)
        band(k, 0, 0, cz + 0.3, r + 0.025)
        windows(k, 0, 0, cz + 0.12, r + 0.025, on, h=0.12)
        F.annulus(k, 0, 0, cz + 0.42, cz + 0.5, r + 0.03, r - 0.12, ARM)
        k.cyl(0, 0, cz + 0.4, r - 0.12, 0.04, lit(on, GLOW), sides=22)                  # the melt
        k.cyl(0, 0, cz + 0.41, r - 0.26, 0.04, lit(on, HOT), sides=18)
        sv = -1.08                                                                       # a flue to a stack
        k.cyl(0, sv, z, 0.2, 0.95, BODY, top="dark", sides=16)
        band(k, 0, sv, z + 0.05, 0.22)
        F.annulus(k, 0, sv, z + 0.9, z + 0.98, 0.22, 0.14, ARM)
        k.cyl(0, sv, z + 0.86, 0.14, 0.02, lit(on, HOT), sides=12)
        tube(k, (0, -0.5, cz + 0.32), (0, sv + 0.17, cz + 0.32), 0.08, BODY, sides=10)
        for v in (-0.62, sv + 0.24):
            tube(k, (0, v - 0.025, cz + 0.32), (0, v + 0.025, cz + 0.32), 0.1, ARM, sides=10)
        R.tier(k, (-0.5, 0.5, 0.85, iv - 0.06), (-0.46, 0.46, 0.89, iv - 0.1), z, z + 0.32, 0.16, 0.14)   # feed box
        k.box(0, (0.89 + iv - 0.1) / 2, z + 0.3, 0.78, iv - 0.99 - 0.06, 0.03, "dark")
    return build


def top_tanks(on):
    def build(k, iu, iv):
        z = zt()
        for v in (-0.62, 0.62):
            r = 0.44
            k.cyl(0, v, z, r + 0.04, 0.08, ARM, top=ARM_L, sides=22)
            k.cyl(0, v, z + 0.08, r, 0.6, BODY, top=BODY, sides=22)
            band(k, 0, v, z + 0.5, r + 0.022)
            windows(k, 0, v, z + 0.22, r, on)
            k.cyl(0, v, z + 0.68, r, 0.24, BODY, top=TOP, sides=22, rtop=0.14)        # the dome
            k.cyl(0, v, z + 0.92, 0.08, 0.1, REC, top=BODY, sides=10)                  # its nozzle
        y = z + 1.12                                                                     # the header pipe
        for v in (-0.62, 0.62):
            tube(k, (0, v, z + 1.0), (0, v, y), 0.06, BODY, sides=10)
        tube(k, (0, -0.62, y), (0, 0.62, y), 0.06, BODY, sides=10, cap=ARM)
        tube(k, (0, -0.06, y), (0, 0.06, y), 0.085, ARM, sides=10)
        tube(k, (0, 0.62, y), (0, 1.15, y), 0.06, BODY, sides=10)
        tube(k, (0, 1.15, y), (0, 1.15, z), 0.06, BODY, sides=10)
        k.box(0, 1.15, z, 0.24, 0.24, 0.1, BODY, top=TOP)
    return build


def top_crusher(on):
    def build(k, iu, iv):
        z = zt()
        rng = np.random.default_rng(4)
        from .ore_cage import _rock
        v0, v1 = 0.1, iv - 0.06                                                           # the ore hopper
        R.tier(k, (-0.72, 0.72, v0, v1), (-0.66, 0.66, v0 + 0.06, v1 - 0.06), z, z + 0.42, 0.2, 0.17,
               col=ARM, top=ARM_L)
        k.box(0, (v0 + v1) / 2, z + 0.41, 1.12, v1 - v0 - 0.24, 0.02, "dark")
        for _ in range(40):
            p = (rng.uniform(-0.5, 0.5), rng.uniform(v0 + 0.17, v1 - 0.17), z + 0.43)
            _rock(k, p, rng.uniform(0.06, 0.09), 0.07, ("rkM", "rk", "rkD", "steel")[rng.integers(4)], rng)
        for u in (-0.72, 0.72):                                                           # the crusher's cheeks
            R.tier(k, (u - 0.14, u + 0.14, -1.2, -0.1), (u - 0.11, u + 0.11, -1.17, -0.13), z, z + 0.62, 0.08, 0.06,
                   col=ARM, top=ARM_L)
        dz, r = z + 0.36, 0.3
        tube(k, (-0.58, -0.65, dz), (0.58, -0.65, dz), r, BODY, sides=18, cap=REC)          # the drum
        for i in range(1, 8):
            u = -0.58 + 1.16 * i / 8
            tube(k, (u - 0.022, -0.65, dz), (u + 0.022, -0.65, dz), r + 0.03, REC, sides=18)
        k.box(0, -0.65, z, 1.0, 0.4, 0.06, "dark")
        k.box(0, -0.65, z + 0.01, 0.9, 0.2, 0.02, lit(on))                                # sparks under the drum
    return build


def top_kiln(on):
    def build(k, iu, iv):
        z = zt()
        a, b = Vector((0, -0.9, z + 0.42)), Vector((0, 0.9, z + 0.42))
        for v in (-0.55, 0.55):
            R.tier(k, (-0.36, 0.36, v - 0.12, v + 0.12), (-0.33, 0.33, v - 0.09, v + 0.09), z, z + 0.12, 0.05, 0.04)
            for u in (-0.2, 0.2):
                tube(k, (u, v - 0.08, z + 0.16), (u, v + 0.08, z + 0.16), 0.06, REC, sides=10)
        tube(k, a, b, 0.36, BODY, sides=22, cap="dark")
        for v in (-0.55, 0.55):
            tube(k, (0, v - 0.06, z + 0.42), (0, v + 0.06, z + 0.42), 0.42, ARM, sides=22, cap=ARM_D)
        for v in (-0.18, 0.18):
            tube(k, (0, v - 0.025, z + 0.42), (0, v + 0.025, z + 0.42), 0.37, lit(on), sides=22)
        R.tier(k, (-0.6, 0.6, 0.9, iv - 0.04), (-0.56, 0.56, 0.94, iv - 0.08), z, z + 0.78, 0.18, 0.15)     # intake hood
        k.box(0, (0.94 + iv - 0.08) / 2, z + 0.77, 0.7, 0.24, 0.02, "dark")
        R.tier(k, (-0.6, 0.6, -iv + 0.04, -0.9), (-0.56, 0.56, -iv + 0.08, -0.94), z, z + 0.88, 0.18, 0.15)  # discharge
        k.box(0.57, -1.12, z + 0.3, 0.02, 0.3, 0.16, lit(on))
        k.cyl(-0.25, -1.12, z + 0.88, 0.12, 0.4, BODY, top="dark", sides=12)
        F.annulus(k, -0.25, -1.12, z + 1.24, z + 1.3, 0.14, 0.09, ARM)
    return build


TOPS = {1: top_stacks, 2: top_crucible, 3: top_tanks, 4: top_crusher, 5: top_kiln}


def refinery(variant, rot, on=True):
    colours(on)
    R.STAGE[0] = 2
    R.TOP[0] = TOPS[variant](on)
    k = K(f"refinery_v{variant}_{rot}_{int(on)}", R.FP, rot)
    R.hull(k)
    R.terminal(k)
    F.forms(k)
    terminal_screen(k, on)
    armour_lights(k, on)
    end_grilles(k)
    output_glow(k, on)
    R.TOP[0] = R.spine
    return k.build()
