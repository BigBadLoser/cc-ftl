"""Hydroponics grow beds (family `hydroponics`). Local frame and placement: modkit.K (front = +v, where the crew
stand to work the bed).

Look exploration: three art directions for the small 1x2 bed, ids `module.hydroponics.<variant>.<state>` at r0:
  bench     a heavy stainless trough on a solid steel cabinet (nutrient window, gauge, panel), a flat grow-light hood
            on two back posts over the bed
  scaffold  an open galvanised pipe frame with a white tray hung in it, a clear reservoir drum and a pump box under the
            tray, two light tubes hung from the top rails
  tub       a rounded cream polymer tub on a dark cradle, a nutrient cartridge at one end, two hoops over it carrying
            the light rail (a small polytunnel)
States: `off` (unlit, empty), `on` (lit, water glint, empty), `on.crop` (lit with a placeholder leafy crop in the raft,
to judge the lamp over the plants). HYDRO_VARIANTS=bench,tub narrows the build."""
import math
import os
import random

from .modkit import K

CUPS = [(u * 0.3 - 0.75, v) for v in (-0.16, 0.16) for u in range(6)]     # raft holes: 6 along, 2 across
LEAF = ("xnFL", "alG", "xnF")


def _crop(k, z):
    """Placeholder crop: a leafy clump per raft hole (the real crops come as their own layer later)."""
    for i, (u, v) in enumerate(CUPS):
        r = random.Random(i * 7 + 3)
        h = 0.15 + r.uniform(-0.02, 0.05)
        for j in range(5):
            a = j * 1.26 + r.uniform(-0.3, 0.3)
            d = 0.065
            k.box(u + d * math.cos(a), v + d * math.sin(a), z, 0.12, 0.06, 0.03, LEAF[(i + j) % 3], rz=a)
        k.box(u, v, z + 0.03, 0.1, 0.1, h, "alG", top="xnFL", rz=r.uniform(0, 1.5), taper=0.55)


def _basin(k, z, w, d, on, raft, raft_col=("lvWS", "lvW2")):
    """The water in the trough (top at z), its glint when running, and the floating raft the plants sit in."""
    k.box(0, 0, z - 0.1, w, d, 0.1, "gmD", top="waterD")
    if on:
        for u, v, l in ((-0.55, 0.08, 0.22), (0.1, -0.1, 0.16), (0.62, 0.05, 0.14)):
            k.box(u, v, z, l, 0.025, 0.006, "waterL")
    if raft:
        k.box(0, 0, z, w - 0.12, d - 0.1, 0.03, raft_col[0], top=raft_col[1])
        for u, v in CUPS:
            k.cyl(u, v, z + 0.03, 0.045, 0.01, "waterD", sides=8)


def bench(k, on, crop):
    lit = "growPink" if on else "blueGrey"
    k.box(0, 0, 0.0, 1.82, 0.72, 0.06, "dark")                                       # kick recess
    k.box(0, 0, 0.06, 1.9, 0.8, 0.5, "steelD", top="steel", bevel=0.015)              # cabinet
    f = 0.405                                                                        # its front face
    k.box(-0.55, f, 0.14, 0.52, 0.012, 0.34, "steel")                                 # service panel
    k.box(-0.55, f + 0.006, 0.2, 0.36, 0.012, 0.2, "glassD")                          # nutrient tank window
    k.box(-0.55, f + 0.012, 0.2, 0.36, 0.012, 0.1, "polyB")                           # its level
    k.box(0.15, f, 0.26, 0.18, 0.03, 0.18, "plate")                                   # pressure gauge
    k.box(0.15, f + 0.02, 0.29, 0.12, 0.012, 0.12, "dark")
    k.box(0.15, f + 0.028, 0.34, 0.04, 0.012, 0.05, "hazY")
    k.box(0.62, f, 0.1, 0.34, 0.02, 0.36, "gm")                                       # control panel
    k.box(0.62, f + 0.014, 0.36, 0.06, 0.012, 0.05, "green" if on else "dark")
    k.box(0.62, f + 0.014, 0.18, 0.22, 0.012, 0.12, "dark")
    for su in (-1, 1):                                                                # pipes down the back
        k.cyl(su * 0.7, -0.44, 0.06, 0.035, 0.5, "steelL", sides=8)
    k.box(0, 0, 0.56, 1.9, 0.8, 0.2, "steelL", top="plate", bevel=0.012)              # trough
    _basin(k, 0.74, 1.76, 0.66, on, True)
    if crop:
        _crop(k, 0.77)
    for su in (-1, 1):                                                                # posts at the back corners
        k.box(su * 0.9, -0.35, 0.76, 0.07, 0.07, 0.68, "steelD", top="steel")
        k.box(su * 0.9, -0.13, 1.42, 0.07, 0.5, 0.06, "steelD", top="steel")          # arms forward
    k.box(0, -0.35, 1.42, 1.87, 0.07, 0.07, "steelD", top="steel")                   # back rail
    k.box(0, 0.02, 1.38, 1.84, 0.46, 0.08, "gm", top="steelL", bevel=0.01)            # the light hood
    k.box(0, 0.255, 1.39, 1.72, 0.012, 0.05, lit)                                     # its lit edge, front
    for su in (-1, 1):                                                                # and ends
        k.box(su * 0.925, 0.02, 1.39, 0.012, 0.4, 0.05, lit)
    k.box(0, 0.02, 1.46, 0.3, 0.2, 0.06, "gmD")                                       # ballast box on top


def scaffold(k, on, crop):
    lit = "growViolet" if on else "blueGrey"
    P = [(su * 0.9, sv * 0.36) for su in (-1, 1) for sv in (-1, 1)]
    for u, v in P:                                                                    # pipe posts on foot plates
        k.box(u, v, 0.0, 0.14, 0.14, 0.02, "steel", top="steelL")
        k.cyl(u, v, 0.02, 0.035, 1.45, "steelL", top="plate", sides=8)
        k.cyl(u, v, 0.5, 0.05, 0.07, "gm", sides=8)                                   # clamp at the tray
        k.cyl(u, v, 1.4, 0.05, 0.07, "gm", sides=8)                                   # and at the top rails
    for sv in (-1, 1):                                                                # top rails along the bed
        k.box(0, sv * 0.36, 1.44, 1.8, 0.06, 0.06, "steelL", top="plate")
    for su in (-1, 1):                                                                # and across the ends
        k.box(su * 0.9, 0, 1.44, 0.06, 0.72, 0.06, "steelL", top="plate")
        k.box(su * 0.9, 0, 0.5, 0.06, 0.72, 0.05, "steelL")                           # tray bearers
    k.box(0, 0, 0.5, 1.8, 0.7, 0.22, "lvWS", top="lvW2", bevel=0.02)                  # the white tray
    k.box(0, 0, 0.66, 1.82, 0.72, 0.06, "lvW2", top="lvW", bevel=0.012)               # its rim
    _basin(k, 0.7, 1.66, 0.56, on, True, ("lvWS", "lvW2"))
    if crop:
        _crop(k, 0.73)
    k.cyl(-0.5, 0.0, 0.0, 0.2, 0.44, "glassL", top="glassL", sides=10)                 # clear reservoir drum
    k.cyl(-0.5, 0.0, 0.0, 0.205, 0.26, "polyB", top="polyB", sides=10)                 # its water
    k.cyl(-0.5, 0.0, 0.44, 0.08, 0.06, "gm", sides=8)                                 # its cap
    k.box(0.45, 0.02, 0.0, 0.4, 0.34, 0.3, "gmD", top="gm", bevel=0.012)              # pump box
    k.box(0.45, 0.19, 0.16, 0.14, 0.012, 0.06, "green" if on else "dark")             # its lamp
    k.box(0.45, 0.19, 0.06, 0.2, 0.012, 0.06, "hazY")
    k.box(-0.05, 0.02, 0.12, 0.6, 0.05, 0.05, "polyB")                                # hose drum to pump
    k.box(0.72, 0.02, 0.3, 0.05, 0.05, 0.2, "polyB")                                  # hose up to the tray
    k.box(0.72, 0.02, 0.5, 0.05, 0.05, 0.18, "polyB")
    for sv in (-1, 1):                                                                # two light tubes
        v = sv * 0.19
        for su in (-1, 1):
            k.box(su * 0.6, v, 1.34, 0.03, 0.03, 0.1, "dark")                          # hangers
        k.box(0, v, 1.28, 1.62, 0.06, 0.06, lit)
        for su in (-1, 1):
            k.box(su * 0.84, v, 1.27, 0.08, 0.075, 0.08, "gmD")                        # end caps
    k.box(0, 0, 1.47, 0.5, 0.1, 0.04, "steelD")                                       # power pack on the rail
    k.box(0.85, -0.3, 1.47, 0.06, 0.06, 0.04, "dark")


def _hoop(k, u, z0, h, half, col, n=7):
    """A semi-elliptic hoop across the bed (the v-z plane) at u: span +-half at height z0, apex z0 + h."""
    pts = [(half * math.cos(t), z0 + h * math.sin(t)) for t in (math.pi * i / n for i in range(n + 1))]
    for (v0, za), (v1, zb) in zip(pts, pts[1:]):
        L = math.hypot(v1 - v0, zb - za) + 0.03
        k.box(u, (v0 + v1) / 2, (za + zb) / 2 - 0.03, 0.06, L, 0.06, col, rx=math.atan2(zb - za, v1 - v0))


def tub(k, on, crop):
    lit = "growPink" if on else "blueGrey"
    k.box(0, 0, 0.0, 1.4, 0.46, 0.12, "gmD", top="gm", bevel=0.02)                     # cradle
    for su in (-1, 1):
        k.box(su * 0.8, 0, 0.0, 0.2, 0.6, 0.1, "gmD", top="gm", bevel=0.02)            # its feet
    k.box(0, 0, 0.1, 1.76, 0.7, 0.2, "lvW2", top="lvW", bevel=0.05)                     # tub: rounded body
    k.box(0, 0, 0.26, 1.9, 0.82, 0.36, "lvW2", top="lvW", bevel=0.06)
    k.box(0, 0, 0.6, 1.94, 0.86, 0.07, "lvW", top="lvWL", bevel=0.03)                   # the lip
    k.box(0, 0.4, 0.3, 1.5, 0.012, 0.04, "alG" if on else "lvWS")                       # a trim line, lit green
    _basin(k, 0.64, 1.72, 0.64, on, True, ("lvWL", "lvWL"))
    if crop:
        _crop(k, 0.67)
    k.cyl(0.78, -0.2, 0.67, 0.09, 0.32, "medWhite", top="plate", sides=10)              # nutrient cartridge
    k.box(0.78, -0.11, 0.74, 0.08, 0.012, 0.14, "pcb")                                   # its window
    k.cyl(0.78, -0.2, 0.99, 0.04, 0.05, "gm", sides=8)
    k.box(0.55, 0.44, 0.36, 0.26, 0.012, 0.14, "dark")                                   # display on the front
    k.box(0.55, 0.448, 0.4, 0.16, 0.012, 0.05, "cyan" if on else "steelD")
    for su in (-1, 1):                                                                  # hoops
        _hoop(k, su * 0.7, 0.66, 0.74, 0.4, "lvWS")
    k.box(0, 0, 1.36, 1.6, 0.08, 0.08, "lvWS", top="lvW2")                               # the light rail
    for sv in (-1, 1):
        k.box(0, sv * 0.045, 1.37, 1.5, 0.012, 0.05, lit)
    k.box(0.7, 0, 1.44, 0.14, 0.12, 0.05, "gmD")                                        # its driver box


VARIANTS = {"bench": bench, "scaffold": scaffold, "tub": tub}
STATES = ("off", "on", "on.crop")


def build(variant, state, rot=0):
    k = K(f"hydro_{variant}_{state.replace('.', '_')}_{rot}", (2, 1), rot)
    VARIANTS[variant](k, state.startswith("on"), state.endswith(".crop"))
    return k.build()


def jobs(rots=range(4)):
    names = os.environ.get("HYDRO_VARIANTS", ",".join(VARIANTS)).split(",")
    return [(f"module.hydroponics.{v}.{s}", (2, 1), "prop", lambda v=v, s=s: build(v, s)) for v in names for s in STATES]
