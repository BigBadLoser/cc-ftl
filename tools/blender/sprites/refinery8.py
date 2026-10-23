"""REFINERY (module.refinery, 3x4): three variants, each its own machine on a low skid, dark steel with orange armour
and glowing heat. Crew side +u, the console at the access tile (middle).

  smelter  a furnace block at the far end, a ladle tipped on trunnions between two pillars pouring a molten stream
           into a row of ingot moulds at the near end; a hopper on the furnace, a stack behind it
  tower    a tall banded furnace tower, two pipes arcing from its crown down into a low cooling annex, a side tank
  kiln     a rotary drum on two roller stations, a tall feed hood with its hopper at one end, a discharge hood with
           the glowing mouth and the exhaust stack at the other, the drive motor beside it"""
import math

from mathutils import Vector

from .modkit import K
from .steelkit import slab, tube

BODY, BODY_T, DK, DK_T, BLK = "blueGrey", "gm", "steelD", "steel", "dark"
OR, OR_L = "c1T3", "c1T2"
GLOW, HOT, SCREEN = "orange", "flameY", "lampY"


def bx(k, u, v, z, su, sv, sz, col=BODY, top=BODY_T, bev=0.03):
    k.box(u, v, z, su, sv, sz, col, top=top, bevel=bev)


def skid(k):
    """The low skid every variant stands on, orange caps on its corners."""
    bx(k, 0, 0, 0, 2.86, 3.82, 0.1, DK, DK_T, bev=0.02)
    for su in (1, -1):
        for sv in (1, -1):
            bx(k, su * 1.33, sv * 1.81, 0, 0.18, 0.18, 0.14, OR, OR_L, bev=0.02)


def console(k, on):
    """The crew console at the access tile: a pedestal, its sloped top, the screen."""
    bx(k, 1.18, 0, 0.1, 0.42, 0.62, 0.4)
    bx(k, 1.18, 0, 0.1, 0.46, 0.66, 0.06, OR, OR_L, bev=0.015)
    a = math.radians(32)
    n = Vector((math.sin(a), 0, math.cos(a)))
    c = Vector((1.2, 0, 0.6))
    up = Vector((-math.cos(a), 0, math.sin(a)))
    quad = lambda w, h, d=0.0: [c + n * d + Vector((0, s * w / 2, 0)) + up * t * h / 2   # noqa: E731
                                for s, t in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    slab(k, quad(0.56, 0.4), n, 0.06, DK)
    slab(k, quad(0.44, 0.28, 0.035), n, 0.01, SCREEN if on else BLK)


def stack(k, u, v, z, r, h, bands=2):
    k.cyl(u, v, z, r, h, DK, top=DK, sides=12)
    for i in range(bands):
        k.cyl(u, v, z + h * (0.3 + 0.4 * i), r + 0.025, 0.06, OR, top=OR_L, sides=12)
    k.cyl(u, v, z + h, r + 0.04, 0.06, DK_T, top=DK_T, sides=12)
    k.cyl(u, v, z + h + 0.061, r - 0.05, 0.005, BLK, sides=12)


def hopper(k, u, v, z, s, h):
    k.cyl(u, v, z, s * 0.5, h, DK, top=DK_T, sides=4, rtop=s * 0.75)
    k.cyl(u, v, z + h + 0.001, s * 0.62, 0.005, BLK, sides=4)


def mouth(k, u, v, z, w, h, axis, on):
    """A glowing furnace mouth on a face (axis: outward normal, '+u' or '+v'), framed in orange."""
    if axis == "+u":
        bx(k, u, v, z - 0.04, 0.05, w + 0.1, h + 0.08, OR, OR_L, bev=0.01)
        k.box(u + 0.03, v, z, 0.01, w, h, GLOW if on else BLK)
        k.box(u + 0.04, v, z + h * 0.15, 0.01, w * 0.6, h * 0.3, HOT if on else BLK)
    else:
        bx(k, u, v, z - 0.04, w + 0.1, 0.05, h + 0.08, OR, OR_L, bev=0.01)
        k.box(u, v + 0.03, z, w, 0.01, h, GLOW if on else BLK)
        k.box(u, v + 0.04, z + h * 0.15, w * 0.6, 0.01, h * 0.3, HOT if on else BLK)


# ---- variants --------------------------------------------------------------------------------------------------------

def smelter(k, on):
    skid(k)
    bx(k, -0.35, -1.12, 0.1, 1.9, 1.4, 0.8)                                     # the furnace
    bx(k, -0.35, -1.12, 0.62, 1.96, 1.46, 0.1, OR, OR_L, bev=0.02)
    mouth(k, -0.35, -0.42, 0.18, 0.6, 0.32, "+v", on)
    hopper(k, 0.15, -1.25, 0.9, 0.62, 0.36)
    stack(k, -0.95, -1.5, 0.9, 0.2, 0.8)
    for u in (-1.05, 0.35):                                                   # the pillars and the ladle between
        bx(k, u, 0.35, 0.1, 0.24, 0.3, 0.92)
        bx(k, u, 0.35, 0.86, 0.3, 0.36, 0.08, OR, OR_L, bev=0.015)
    lu, lv, lz = -0.35, 0.35, 0.72
    t = math.radians(28)
    ax = Vector((0, math.sin(t), math.cos(t)))
    base, top = Vector((lu, lv, lz)) - ax * 0.32, Vector((lu, lv, lz)) + ax * 0.32
    tube(k, base, top, 0.4, DK, sides=20, cap=GLOW if on else BLK)
    tube(k, base + ax * 0.18, base + ax * 0.28, 0.43, OR, sides=20, cap=OR_L)
    tube(k, (-0.95, lv, lz), (0.25, lv, lz), 0.06, DK_T, sides=8, cap=DK_T)  # the trunnions
    lip = top + Vector((0, 0.36, -0.06))
    tube(k, top + Vector((0, 0.2, 0)), lip, 0.07, DK, sides=8, cap=DK)          # the spout
    if on:
        tube(k, lip, (-0.13, 1.45, 0.35), 0.035, HOT, sides=6)                  # the molten stream
    bx(k, -0.35, 1.45, 0.1, 1.9, 0.72, 0.24, DK, DK_T, bev=0.02)               # the ingot moulds
    for i, u in enumerate((-1.0, -0.57, -0.13, 0.3)):
        k.box(u, 1.45, 0.341, 0.32, 0.46, 0.005, BLK)
        if i in (1, 2):                                                        # the poured ingots, the fresh one hot
            k.box(u, 1.45, 0.3, 0.28, 0.42, 0.052, (GLOW if i == 2 else OR) if on else DK)
    console(k, on)


def tower(k, on):
    skid(k)
    tu, tv, r = -0.4, -0.45, 0.68
    k.cyl(tu, tv, 0.1, r + 0.08, 0.22, BODY, top=BODY_T, sides=24)            # the tower's foot
    k.cyl(tu, tv, 0.32, r, 1.08, DK, top=DK, sides=24)
    for z in (0.5, 0.88, 1.22):
        k.cyl(tu, tv, z, r + 0.03, 0.08, OR, top=OR_L, sides=24)
    k.cyl(tu, tv, 1.4, r, 0.16, BODY, top=BODY_T, sides=24, rtop=r * 0.62)    # the crown
    k.cyl(tu, tv, 1.56, r * 0.4, 0.08, DK_T, top=GLOW if on else BLK, sides=16)
    for a in (0.0, math.pi / 2):                                              # glowing ports
        k.box(tu + (r + 0.01) * math.cos(a), tv + (r + 0.01) * math.sin(a), 0.62, 0.04 if a == 0 else 0.22,
              0.22 if a == 0 else 0.04, 0.14, GLOW if on else BLK)
    bx(k, -0.35, 1.32, 0.1, 1.9, 1.08, 0.56)                                    # the cooling annex
    bx(k, -0.35, 1.32, 0.48, 1.96, 1.14, 0.08, OR, OR_L, bev=0.02)
    for i, u in enumerate((-1.0, -0.6, -0.2, 0.2)):
        k.box(u, 1.865, 0.2, 0.2, 0.01, 0.18, BLK)                              # its vents
    for u in (-0.85, 0.05):                                                   # pipes arcing from the crown
        p0 = Vector((u * 0.55 + tu * 0.45, tv + 0.2, 1.48))
        p1 = Vector((u, 0.45, 1.48))
        p2 = Vector((u, 1.0, 0.66))
        tube(k, p0, p1, 0.08, DK_T, sides=10)
        tube(k, p1, p2, 0.08, DK_T, sides=10)
        k.cyl(p1.x, p1.y, p1.z - 0.1, 0.11, 0.2, OR, top=OR_L, sides=10)
        k.cyl(p2.x, p2.y, 0.64, 0.12, 0.06, OR, top=OR_L, sides=10)
    k.cyl(0.62, -1.3, 0.1, 0.32, 0.72, DK, top=DK, sides=16)                   # the side tank
    k.cyl(0.62, -1.3, 0.82, 0.32, 0.14, BODY, top=BODY_T, sides=16, rtop=0.16)
    k.cyl(0.62, -1.3, 0.3, 0.34, 0.06, OR, top=OR_L, sides=16)
    tube(k, (0.62, -1.0, 0.55), (tu + r - 0.05, -0.75, 0.55), 0.06, DK_T, sides=8)
    console(k, on)


def kiln(k, on):
    skid(k)
    a, b = Vector((-0.3, 1.2, 0.84)), Vector((-0.3, -1.15, 0.74))
    for v in (-0.62, 0.66):                                                   # roller stations
        bx(k, -0.3, v, 0.1, 1.15, 0.36, 0.22, DK, DK_T, bev=0.02)
        for du in (-0.32, 0.32):
            tube(k, (-0.3 + du, v - 0.13, 0.42), (-0.3 + du, v + 0.13, 0.42), 0.1, BODY, sides=10, cap=BODY_T)
    tube(k, b, a, 0.48, DK, sides=24, cap=BLK)                                 # the drum
    for v in (-0.62, 0.66):
        c = b + (a - b) * ((v - b.y) / (a.y - b.y))
        tube(k, c - Vector((0, 0.09, 0)), c + Vector((0, 0.09, 0)), 0.54, OR, sides=24, cap=OR_L)
    for v in (-0.15, 0.2):
        c = b + (a - b) * ((v - b.y) / (a.y - b.y))
        tube(k, c - Vector((0, 0.025, 0)), c + Vector((0, 0.025, 0)), 0.49, GLOW if on else DK, sides=24)
    c = b + (a - b) * ((1.0 - b.y) / (a.y - b.y))
    tube(k, c - Vector((0, 0.05, 0)), c + Vector((0, 0.05, 0)), 0.56, BODY, sides=24, cap=BODY_T)   # the girth gear
    bx(k, -0.3, 1.52, 0.1, 1.5, 0.66, 1.0)                                      # the feed hood and its hopper
    bx(k, -0.3, 1.52, 0.86, 1.56, 0.72, 0.08, OR, OR_L, bev=0.02)
    hopper(k, -0.3, 1.52, 1.1, 0.7, 0.4)
    bx(k, -0.3, -1.5, 0.1, 1.5, 0.74, 0.86)                                     # the discharge hood
    bx(k, -0.3, -1.5, 0.72, 1.56, 0.8, 0.08, OR, OR_L, bev=0.02)
    mouth(k, 0.46, -1.5, 0.16, 0.42, 0.3, "+u", on)
    stack(k, -0.75, -1.6, 0.96, 0.18, 0.62)
    bx(k, 0.62, 1.0, 0.1, 0.4, 0.42, 0.34, DK, DK_T)                            # the drive motor
    tube(k, (0.42, 1.0, 0.3), (0.12, 1.0, 0.5), 0.05, DK_T, sides=8)
    console(k, on)


VARIANTS = {"smelter": smelter, "tower": tower, "kiln": kiln}


def refinery(variant, rot=0, on=True):
    k = K(f"refinery8_{variant}_{rot}_{int(on)}", (3, 4), rot)
    VARIANTS[variant](k, on)
    return k.build()
