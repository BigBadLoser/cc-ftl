"""Item art for planned items, food, ammo, trade goods and salvage (family `items`; art only until the content lands):
floor stacks .s/.m/.l and .held, in the grid frame and scale of items.py.

  protein         off-white protein-paste tubs with green lids
  meal            stacked meal trays with compartments of food under clear film
  luxury_food     fancy round tins: deep red labels, gold lids
  ammo_cells      olive ammo cans, an open one showing the cells
  explosive       putty-tan demo charges with hazard tape and a red light, in an open crate
  torpedo         a fat navy torpedo with a yellow band on a cradle, bigger than a missile
  textiles        bolts of coloured cloth lying in a pyramid
  luxury_goods    dark sealed crates with gold trim
  contraband      unmarked dark crates with a red warning glow strip
  consumer_goods  mixed cardboard boxes with coloured labels
  alien_tissue    specimen jars of green fluid with glowing tissue
  wreck_core      a salvaged ship-system core: scorched casing, a dim orange glow through the cracks
  robot_scrap     a pile of yellow robot parts: a head with a dead eye, limbs, a torso plate"""
import math

from .items_kit import FLOOR, chunk, cone, place, pile, rot, tube

# ---- food --------------------------------------------------------------------------------------------------------------


def tub(m, c, z, rz, k):
    m.cyl((c[0], c[1], z), 0.06 * k, 0.08 * k, "c2W2", sides=12, top="c2W0", rtop=0.065 * k)
    m.cyl((c[0], c[1], z + 0.08 * k), 0.068 * k, 0.016 * k, "c2H5", sides=12, top="c2H3")
    m.box((*rot(c, rz, 0, 0.062 * k), z + 0.03 * k), (0.06 * k, 0.006, 0.03 * k), "c2H4", rz=rz, base=True)   # label


def protein(m, size):
    place(m, size, tub, pile(0.096, 0.13))


def tray(m, c, z, rz, k):
    w, d = 0.22 * k, 0.15 * k
    m.box((c[0], c[1], z), (w, d, 0.03 * k), "c3W4", top="c3W2", rz=rz, base=True)
    for (u, v, sw, sd), col in zip(((-0.05, 0, 0.1, 0.12), (0.05, -0.03, 0.08, 0.05), (0.05, 0.035, 0.08, 0.05)),
                                   ("c1T3", "xnFL", "c2T2")):
        m.box((*rot(c, rz, u * k, v * k), z + 0.03 * k), (sw * k, sd * k, 0.012 * k), col, rz=rz, base=True)


def meal(m, size):
    place(m, size, tray, pile(0.046, 0.22))


def tin(m, c, z, rz, k):
    m.cyl((c[0], c[1], z), 0.055 * k, 0.05 * k, "drD", sides=12)
    m.cyl((c[0], c[1], z + 0.012 * k), 0.057 * k, 0.026 * k, "drM", sides=12)
    m.cyl((c[0], c[1], z + 0.05 * k), 0.057 * k, 0.012 * k, "c4T3", sides=12, top="c4T1")


def luxury_food(m, size):
    g, h = 0.135, 0.072                                                     # tin pitch and height at k 1.2
    place(m, size, tin, k=1.2, layout={
        "held": FLOOR["held"], "s": [(-g / 2, 0, 0, 0), (g / 2, 0.02, 0, 0), (0.0, 0.01, h, 0)],
        "m": [(-g, -g / 2, 0, 0), (0, -g / 2, 0, 0), (g, -g / 2, 0, 0), (-g / 2, g / 2, 0, 0), (g / 2, g / 2, 0, 0),
              (-g / 2, -g / 2, h, 0), (g / 2, -g / 2, h, 0)],
        "l": [((x - 1) * g, (y - 1) * g, 0, 0) for x in range(3) for y in range(3)]
        + [((x - 0.5) * g, (y - 0.5) * g, h, 0) for x in range(2) for y in range(2)] + [(0.0, 0.0, 2 * h, 0)]})


# ---- ammo and explosives -----------------------------------------------------------------------------------------------


def ammo_can(m, c, z, rz, k, open_=False):
    w, d, h = 0.2 * k, 0.1 * k, 0.11 * k
    m.box((c[0], c[1], z), (w, d, h), "jacketD", top="jacket", rz=rz, base=True, bevel=0.008 * k)
    m.box((*rot(c, rz, -w * 0.3, 0), z + h * 0.5), (0.04 * k, d + 0.006, 0.02 * k), "hazY", rz=rz, base=True)  # stencil
    if open_:
        m.box((c[0], c[1], z + h - 0.004), (w * 0.9, d * 0.8, 0.006), "dark", rz=rz, base=True)
        for i in range(5):
            m.cyl((*rot(c, rz, (i - 2) * 0.034 * k, 0), z + h * 0.7), 0.013 * k, h * 0.42, "blueN", sides=6, top="steelL")
    else:
        m.box((c[0], c[1], z + h), (0.08 * k, 0.02 * k, 0.014 * k), "dark", rz=rz, base=True)               # handle


def ammo_cells(m, size):
    slots = pile(0.11, 0.2)[size]
    for i, (x, y, z, rz) in enumerate(slots):
        ammo_can(m, (x, y), z, rz, 1.1 if size == "held" else 1.4, open_=i == len(slots) - 1)


def charge(m, c, z, rz, k):
    w, d, h = 0.12 * k, 0.07 * k, 0.05 * k
    m.box((c[0], c[1], z), (w, d, h), "c2T4", top="c2T3", rz=rz, base=True, bevel=0.008 * k)
    for u in (-w * 0.25, w * 0.25):
        m.box((*rot(c, rz, u, 0), z), (0.016 * k, d + 0.004, h + 0.004), "hazY", top="hazY", rz=rz, base=True)
    m.box((c[0], c[1], z + h), (0.03 * k, 0.03 * k, 0.012 * k), "dark", rz=rz, base=True)
    m.box((c[0], c[1], z + h + 0.012 * k), (0.012 * k, 0.012 * k, 0.006), "red", rz=rz, base=True)


def explosive(m, size):
    if size in ("held", "s"):
        place(m, size, charge, layout={"held": FLOOR["held"], "s": [(-0.05, -0.03, 0, 0.3), (0.07, 0.05, 0, 0.1), (-0.04, -0.02, 0.054, 0.5)]})
        return
    w, d, h = (0.36, 0.26, 0.1) if size == "m" else (0.44, 0.32, 0.12)                     # an open crate of them
    m.box((0, 0, 0), (w, d, h), "c1F3", top="c1F1", rz=0.3, base=True)
    m.box((0, 0, h - 0.004), (w * 0.9, d * 0.85, 0.006), "c1F5", rz=0.3, base=True)
    m.box((*rot((0, 0), 0.3, 0, d / 2 + 0.002), h * 0.4), (w * 0.7, 0.006, h * 0.25), "hazY", rz=0.3, base=True)
    for i in range(3 if size == "m" else 4):
        for j in range(2 if size == "m" else 3):
            p = rot((0, 0), 0.3, (i - (1 if size == "m" else 1.5)) * 0.1, (j - (0.5 if size == "m" else 1)) * 0.08)
            charge(m, p, h - 0.03, 0.3, 0.8)                                      # (in the crate: at their own size)


def torpedo_unit(m, c, z, rz, k):
    L, r = 0.62 * k, 0.07 * k
    a, b, e = rot(c, rz, -L / 2, 0), rot(c, rz, L * 0.3, 0), rot(c, rz, L / 2, 0)
    for s in (-1, 1):                                                                       # cradle saddles
        p = rot(c, rz, s * L * 0.25, 0)
        m.box((p[0], p[1], z), (0.05 * k, r * 2.4, r * 0.9), "steelD", top="steel", rz=rz, base=True)
    tube(m, (a[0], a[1], z + r * 1.1), (b[0], b[1], z + r * 1.1), r, "navy", cap="steelD", sides=12)
    p, q = rot(c, rz, L * 0.1, 0), rot(c, rz, L * 0.16, 0)
    tube(m, (p[0], p[1], z + r * 1.1), (q[0], q[1], z + r * 1.1), r + 0.004, "hazY", sides=12, ends=False)
    cone(m, (b[0], b[1], z + r * 1.1), (e[0], e[1], z + r * 1.1), r, "nvH2", sides=12)
    for a2 in (0, math.pi / 2, math.pi, 3 * math.pi / 2):                                     # four tail fins
        o = rot(c, rz, -L * 0.42, math.cos(a2) * r * 1.3)
        m.box((o[0], o[1], z + r * 1.1 + math.sin(a2) * r * 1.3), (0.1 * k, 0.012 + abs(math.sin(a2)) * 0.03 * k,
              0.012 + abs(math.cos(a2)) * 0.03 * k), "steelD", top="steel", rz=rz)


def torpedo(m, size):
    place(m, size, torpedo_unit, {"held": [(0, 0, 0, 0.3)], "s": [(0, 0, 0, 0.3)], "m": [(0, -0.08, 0, 0.3), (0, 0.1, 0, 0.3)],
                                  "l": [(0, -0.12, 0, 0.3), (0, 0.06, 0, 0.3), (0, 0.24, 0, 0.3)]}, held_k=0.5, k=1.0)


# ---- trade goods -------------------------------------------------------------------------------------------------------

CLOTH = (("drM", "drL"), ("c3T3", "c3T1"), ("c4T3", "c4T1"), ("xnF", "xnFL"), ("xnP", "xnS"))


def textiles(m, size):
    rz, r, L = 0.3, 0.05, 0.3
    rows = {"held": [(0, 0)], "s": [(-1, 0), (1, 0)], "m": [(-2, 0), (0, 0), (2, 0), (-1, 1), (1, 1)],
            "l": [(-3, 0), (-1, 0), (1, 0), (3, 0), (-2, 1), (0, 1), (2, 1), (-1, 2), (1, 2)]}[size]
    k = 1.0 if size == "held" else 1.2
    for i, (v, layer) in enumerate(rows):
        a, b = rot((0, 0), rz, -L / 2 * k, v * r * k), rot((0, 0), rz, L / 2 * k, v * r * k)
        z = r * k + layer * r * 1.7 * k
        side, end = CLOTH[i % len(CLOTH)]
        tube(m, (a[0], a[1], z), (b[0], b[1], z), r * k, side, cap=end, sides=10)


def chest(m, c, z, rz, k, side, top, trim, glow=None):
    w, d, h = 0.22 * k, 0.16 * k, 0.12 * k
    m.box((c[0], c[1], z), (w, d, h), side, top=top, rz=rz, base=True, bevel=0.008 * k)
    for u in (-w * 0.38, w * 0.38):                                                         # corner bands
        m.box((*rot(c, rz, u, 0), z), (0.016 * k, d + 0.006, h + 0.004), trim, top=trim, rz=rz, base=True)
    if glow:
        m.box((*rot(c, rz, 0, d / 2 + 0.003), z + h * 0.45), (w * 0.5, 0.006, 0.014 * k), glow, rz=rz, base=True)


def luxury_goods(m, size):
    place(m, size, lambda m, c, z, rz, k: chest(m, c, z, rz, k, "rfRX", "rfRY", "c4T2"), pile(0.12, 0.22))


def contraband(m, size):
    place(m, size, lambda m, c, z, rz, k: chest(m, c, z, rz, k, "dnW3", "dnW2", "dnW4", "red"), pile(0.12, 0.22))


BOXES = ((0.14, 0.12, 0.1, "c1T1"), (0.18, 0.12, 0.09, "c3T2"), (0.12, 0.1, 0.1, "xnFL"), (0.16, 0.14, 0.09, "drM"))


def consumer_goods(m, size):
    slots = pile(0.09, 0.18)[size]
    for i, (x, y, z, rz) in enumerate(slots):
        w, d, h, label = BOXES[i % len(BOXES)]
        k = 1.1 if size == "held" else 1.35
        z = round(z / (0.09 * 1.4)) * 0.1 * k                         # stacked layers at the tallest box
        m.box((x, y, z), (w * k, d * k, h * k), "c1H4", top="c1H2", rz=rz, base=True)
        m.box((x, y, z + h * k), (w * k * 0.9, 0.014, 0.003), "c1H5", rz=rz, base=True)                 # tape
        m.box((*rot((x, y), rz, w * k * 0.15, d * k / 2 + 0.002), z + h * k * 0.3), (w * k * 0.4, 0.004, h * k * 0.4), label,
              rz=rz, base=True)


# ---- salvage and alien -------------------------------------------------------------------------------------------------


def jar(m, c, z, rz, k):
    r, h = 0.05 * k, 0.13 * k
    m.cyl((c[0], c[1], z), r * 1.1, 0.02 * k, "steelD", sides=10, top="steel")
    m.cyl((c[0], c[1], z + 0.02 * k), r, h, "alG", sides=10, top="xnA")
    m.cyl((c[0], c[1], z + 0.02 * k + h * 0.3), r + 0.003, h * 0.4, "xnG", sides=10)                  # glowing tissue
                                                                                             # pressed to the glass
    m.cyl((c[0], c[1], z + 0.02 * k + h), r * 1.1, 0.022 * k, "steelD", sides=10, top="steel")


def alien_tissue(m, size):
    place(m, size, jar, pile(0.172, 0.11))


def core_unit(m, c, z, rz, k):
    r, h = 0.11 * k, 0.24 * k
    m.cyl((c[0], c[1], z), r * 1.15, 0.04 * k, "steelD", sides=8, top="steel")                           # mount
    m.cyl((c[0], c[1], z + 0.04 * k), r, h, "rust", sides=8, top="rustD")
    for i in range(4):                                                                       # armour ribs, one torn off
        if i == 2:
            continue
        a = rz + i * math.pi / 2
        m.box((c[0] + math.cos(a) * r, c[1] + math.sin(a) * r, z + 0.04 * k), (0.03 * k, 0.04 * k, h), "steel", top="steelL",
              rz=a, base=True)
    a = rz + math.pi
    m.box((c[0] + math.cos(a) * r * 0.98, c[1] + math.sin(a) * r * 0.98, z + h * 0.35), (0.014, 0.05 * k, h * 0.5), "fxO", rz=a,
          base=True)                                                                         # the glow through a crack
    m.cyl((c[0], c[1], z + 0.04 * k + h), r * 0.5, 0.03 * k, "dark", sides=8)
    m.cyl((c[0], c[1], z + 0.07 * k + h), r * 0.3, 0.01, "fxR", sides=8)
    for u, v in ((r * 0.9, r * 0.4), (-r * 0.6, r * 0.9)):                                   # cut cables
        p = rot(c, rz, u, v)
        tube(m, (p[0], p[1], z + h * 0.8), (p[0] + 0.06 * k, p[1] + 0.02 * k, z + 0.01), 0.01 * k, "dark", sides=6)


def wreck_core(m, size):
    if size == "held":
        core_unit(m, (0, 0), 0, 0.3, 0.75)
        return
    core_unit(m, (0, 0), 0, 0.3, {"s": 0.95, "m": 1.1, "l": 1.25}[size])
    if size != "s":                                                                          # scorched plating round it
        for i, (x, y, rz) in enumerate(((0.2, 0.12, 0.6), (-0.2, 0.14, 2.0), (0.12, -0.22, 3.6))[:2 if size == "m" else 3]):
            m.box((x, y, 0), (0.12, 0.08, 0.02), "rustD", top="steelD", rz=rz, ry=0.15, base=True)


def robot_scrap(m, size):
    """Yellow robot parts in a heap: a head with a dead eye, an arm, a leg, a torso plate."""
    k = 1.0 if size == "held" else 1.5
    parts = {"held": 2, "s": 3, "m": 5, "l": 8}[size]
    spots = [(-0.06, -0.04, 0.0, 0.3), (0.08, 0.04, 0.0, 1.2), (0.0, 0.14, 0.0, 2.2), (-0.16, 0.1, 0.0, 0.6), (0.18, -0.12, 0.0, 2.8),
             (-0.04, -0.02, 0.07, 0.8), (0.2, 0.18, 0.0, 1.8), (-0.2, -0.18, 0.0, 0.1)]
    for i, (x, y, z, rz) in enumerate(spots[:parts]):
        x, y, z = x * k, y * k, z * k
        kind = i % 4
        if kind == 0:                                                                         # head
            m.box((x, y, z), (0.1 * k, 0.09 * k, 0.08 * k), "hazY", top="c4T1", rz=rz, base=True, bevel=0.012 * k)
            m.box((*rot((x, y), rz, 0.05 * k, 0), z + 0.03 * k), (0.012, 0.05 * k, 0.02 * k), "dark", rz=rz, base=True)
        elif kind == 1:                                                                       # arm
            a, b = rot((x, y), rz, -0.08 * k, 0), rot((x, y), rz, 0.08 * k, 0)
            tube(m, (a[0], a[1], z + 0.025 * k), (b[0], b[1], z + 0.025 * k), 0.025 * k, "hazY", cap="steelD", sides=8)
            tube(m, (b[0], b[1], z + 0.025 * k), (b[0] + 0.05 * k, b[1] + 0.04 * k, z + 0.02 * k), 0.016 * k, "steel", sides=6)
        elif kind == 2:                                                                       # torso plate
            m.box((x, y, z), (0.14 * k, 0.11 * k, 0.03 * k), "c4T4", top="hazY", rz=rz, ry=0.1, base=True, bevel=0.01 * k)
        else:                                                                                 # a loose joint
            chunk(m, (x, y, z), (0.07 * k, 0.07 * k, 0.05 * k), 211 + i, ["steelL", "steel"], ["steelD", "gm"], rz=rz)


ITEMS = {"protein": protein, "meal": meal, "luxury_food": luxury_food, "ammo_cells": ammo_cells, "explosive": explosive,
         "torpedo": torpedo, "textiles": textiles, "luxury_goods": luxury_goods, "contraband": contraband,
         "consumer_goods": consumer_goods, "alien_tissue": alien_tissue, "wreck_core": wreck_core, "robot_scrap": robot_scrap}
