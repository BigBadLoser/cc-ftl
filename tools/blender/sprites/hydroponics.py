"""Hydroponics grow beds (family `hydroponics`). Local frame and placement: modkit.K (front = +v, where the crew
stand to work the bed).

Look exploration: three art directions for the small 1x2 bed, ids `module.hydroponics.<variant>.<state>` at r0:
  bench     a heavy stainless trough on a solid steel cabinet (nutrient window, gauge, panel), a flat grow-light hood
            on two back posts over the bed
  scaffold  an open galvanised pipe frame with a white tray hung in it, a clear reservoir drum and a pump box under the
            tray, two light tubes hung from the top rails
  tub       a rounded cream polymer tub on a dark cradle, a nutrient cartridge at one end, two hoops over it carrying
            the light rail (a small polytunnel)
Round two, one big plant per tile (PLANTS):
  pipe      a split steel pipe trough on cast saddles, domed valve ends, a gooseneck lamp head over each plant
  bowls     two round flared planter pots on a cast base, a ring lamp over each from one central stem
  vat       a flared faceted vat on a sculpted plinth, a bent-tube canopy carrying a lamp pad per plant
Round three, soil beds (_soil) in place of water:
  skiff     a boat-shaped planter on curved skids, a crane mast with a pendant bell lamp over each plant
  hexes     two hexagonal planters at two heights on a stepped base, a mast with angled light panels
  bags      two canvas grow bags in a drip tray, a drip line, a bent pipe gantry with one long tube lamp
Round four, one connected body each:
  capsule   a pill-shaped monocoque with a cowl curling up from its back edge over the bed, the lamp in its lip
  tunnel    a bellied hull with round ends, three ribs rising from it into a lit spine (a tunnel house)
  visor     a chamfered body, a backboard carrying the plumbing, a visor hood tilted up over the bed
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


def _hoop(k, u, z0, h, half, col, n=7, s=0.06, top=None):
    """A semi-elliptic hoop across the bed (the v-z plane) at u: span +-half at height z0, apex z0 + h."""
    pts = [(half * math.cos(t), z0 + h * math.sin(t)) for t in (math.pi * i / n for i in range(n + 1))]
    for (v0, za), (v1, zb) in zip(pts, pts[1:]):
        L = math.hypot(v1 - v0, zb - za) + s / 2
        k.box(u, (v0 + v1) / 2, (za + zb) / 2 - s / 2, s, L, s, col, top=top, rx=math.atan2(zb - za, v1 - v0))


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


PLANTS = ((-0.5, 0.0), (0.5, 0.0))                                           # one plant per tile


def _plant(k, u, v, z, seed=0):
    """Placeholder crop, one big leafy head per tile: two tiers of radiating leaves and a crown."""
    r = random.Random(seed * 11 + 5)
    for tier, (n, L, w, lift, zz) in enumerate(((8, 0.3, 0.1, 0.25, 0.0), (6, 0.22, 0.09, 0.6, 0.08))):
        for j in range(n):
            a = j * math.tau / n + r.uniform(-0.2, 0.2) + tier * 0.4
            d = L * 0.42
            k.box(u + d * math.cos(a), v + d * math.sin(a), z + zz, L, w, 0.035, LEAF[(j + tier) % 3], rz=a,
                  rx=-lift * (1 if math.sin(a) >= 0 else -1) * 0.0 + 0.0)
            k.box(u + d * 1.7 * math.cos(a), v + d * 1.7 * math.sin(a), z + zz + L * lift * 0.5, L * 0.5, w * 0.8, 0.03,
                  LEAF[(j + tier + 1) % 3], rz=a)
    k.box(u, v, z + 0.05, 0.16, 0.16, 0.22, "alG", top="xnFL", rz=r.uniform(0, 1.5), taper=0.5)


def _poly(k, pts, col, flip=True):
    """A polygon from local (u, v, z) points."""
    from . import core
    k.m.poly([core.G(*k.p(u, v), z) for u, v, z in pts], col, flip=flip)


def _halfpipe(k, u0, v0, z0, r, t, L, col, inner, sides=8):
    """A split pipe lying along u: the lower half of a tube of radius r, open on top (its rim at z0), built from long
    boxes around the axis (lit like every other part), closed ends, a flat rim strip along each top edge."""
    seg = math.pi * r / sides
    for i in range(sides):
        x = math.pi + math.pi * (i + 0.5) / sides
        k.box(u0, v0 + (r - t / 2) * math.cos(x), z0 + (r - t / 2) * math.sin(x) - t / 2, L, seg + 0.02, t, col,
              rx=x + math.pi / 2)
    for e in (-1, 1):                                                          # end walls
        for i in range(sides):
            x = math.pi + math.pi * (i + 0.5) / sides
            k.box(u0 + e * L / 2, v0 + (r / 2) * math.cos(x), z0 + (r / 2) * math.sin(x) - 0.025, t, seg + 0.02, r,
                  col, rx=x + math.pi / 2)
    for sv in (-1, 1):                                                         # rim strips
        k.box(u0, v0 + sv * (r - t / 2), z0 - 0.02, L + 0.04, t + 0.04, 0.04, inner, top=col)


def _ring(k, u, v, z, r, col, n=12, w=0.1, h=0.05):
    """A ring of n blocks: a ring lamp or a hoop seen flat."""
    for i in range(n):
        a = i * math.tau / n
        k.box(u + r * math.cos(a), v + r * math.sin(a), z, 2 * math.pi * r / n + 0.01, w, h, col, rz=a + math.pi / 2)


def pipe(k, on, crop):
    """A split steel pipe trough on two cast saddles, domed valve ends, a gooseneck lamp head over each plant."""
    lit = "growPink" if on else "blueGrey"
    for u in (-0.55, 0.55):                                                   # cast saddles
        k.box(u, 0, 0.0, 0.3, 0.78, 0.1, "gmD", top="gm", bevel=0.02)
        k.box(u, 0, 0.1, 0.22, 0.7, 0.12, "steelD", top="steel", taper=1.25, bevel=0.015)
    _halfpipe(k, 0, 0, 0.62, 0.4, 0.05, 1.9, "steelL", "steel")
    for e in (-1, 1):                                                         # domed end caps with a valve
        k.cyl(e * 0.98, 0, 0.25, 0.3, 0.38, "steel", top="steelL", sides=10, rtop=0.225)
        k.cyl(e * 1.0, 0, 0.63, 0.12, 0.05, "gmD", sides=8)
        k.cyl(e * 1.0, 0, 0.68, 0.06, 0.08, "medRed" if e > 0 else "polyB", sides=6)
    k.box(0, 0, 0.55, 1.78, 0.62, 0.07, "gmD", top="waterD")                   # the water, with its glint
    if on:
        for u, v, l in ((-0.6, 0.12, 0.2), (0.2, -0.14, 0.16), (0.75, 0.05, 0.12)):
            k.box(u, v, 0.62, l, 0.025, 0.006, "waterL")
    for u, _ in PLANTS:                                                       # a net basket per tile
        k.cyl(u, 0, 0.6, 0.17, 0.04, "lvWS", top="lvW2", sides=10)
        k.cyl(u, 0, 0.64, 0.12, 0.01, "waterD", sides=8)
    k.box(0, -0.3, 0.1, 1.2, 0.05, 0.05, "polyB")                              # feed line along the back
    for e in (-1, 1):                                                         # gooseneck lamps from the back
        u = e * 0.5
        k.cyl(u, -0.42, 0.0, 0.05, 1.3, "steelD", top="steel", sides=8)       # the stem
        for i in range(5):                                                    # the bend forward
            t = i / 4
            k.box(u, -0.42 + 0.42 * math.sin(t * math.pi / 2), 1.3 + 0.3 * math.sin(t * math.pi), 0.07, 0.12, 0.07,
                  "steelD")
        k.cyl(u, 0, 1.16, 0.2, 0.07, lit, sides=10)                           # the lamp head: a lit puck
        k.cyl(u, 0, 1.23, 0.23, 0.05, "gm", top="steelL", sides=10)           # under its cap
    k.box(0, -0.42, 0.0, 0.4, 0.14, 0.3, "gmD", top="gm", bevel=0.01)          # ballast box between the stems
    k.box(0, -0.35, 0.18, 0.1, 0.012, 0.05, "green" if on else "dark")
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.66, i)


def bowls(k, on, crop):
    """Two round planter pots on a cast base, a ring lamp over each from one central stem."""
    lit = "growViolet" if on else "blueGrey"
    k.box(0, 0, 0.0, 1.6, 0.5, 0.08, "gmD", top="gm", bevel=0.03)               # base rail
    k.cyl(0, 0, 0.08, 0.14, 0.36, "steelD", top="steel", sides=10)             # the hub
    for e in (-1, 1):
        u = e * 0.5
        k.cyl(u, 0, 0.0, 0.26, 0.1, "gmD", top="gm", sides=12)                 # foot
        k.cyl(u, 0, 0.1, 0.28, 0.42, "steel", top="steelL", sides=12, rtop=0.392)   # the pot: flared
        k.cyl(u, 0, 0.52, 0.4, 0.06, "steelL", top="plate", sides=12)          # its rim
        k.cyl(u, 0, 0.52, 0.36, 0.08, "gmD", top="waterD", sides=12)           # the water
        if on:
            k.box(u - 0.1, 0.08, 0.6, 0.18, 0.025, 0.006, "waterL")
        k.cyl(u, 0, 0.58, 0.19, 0.05, "lvWS", top="lvW2", sides=10)           # net basket
        k.cyl(u, 0, 0.63, 0.13, 0.01, "waterD", sides=8)
        k.box(u, 0.38, 0.2, 0.1, 0.03, 0.1, "polyB")                           # feed valve on the front
        k.box(u * 0.5, 0, 0.12, 0.5, 0.05, 0.05, "polyB")                      # pipes to the hub
    k.box(0, 0.22, 0.08, 0.18, 0.04, 0.26, "gm")                                # the hub's panel
    k.box(0, 0.245, 0.26, 0.08, 0.012, 0.05, "green" if on else "dark")
    k.cyl(0, -0.3, 0.0, 0.055, 1.42, "steelD", top="steel", sides=8)            # the lamp stem, at the back
    k.box(0, -0.15, 1.36, 0.08, 0.36, 0.06, "steelD")                           # arm forward
    k.box(0, 0, 1.36, 1.3, 0.08, 0.06, "steelD", top="steel")                   # the cross arm
    for e in (-1, 1):
        u = e * 0.5
        k.cyl(u, 0, 1.3, 0.08, 0.1, "gmD", sides=8)
        _ring(k, u, 0, 1.22, 0.3, "gm", n=12, w=0.1, h=0.05)                   # ring housing
        _ring(k, u, 0, 1.2, 0.3, lit, n=12, w=0.12, h=0.03)                     # its lit underside, seen at the rim
        _ring(k, u, 0, 1.27, 0.25, lit, n=12, w=0.04, h=0.03)                   # and a lit inner lip
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.65, i)


def vat(k, on, crop):
    """A flared vat with soft faceted sides on a sculpted plinth, a bent-tube canopy with a lamp pad per plant."""
    lit = "growPink" if on else "blueGrey"
    k.box(0, 0, 0.0, 1.3, 0.4, 0.14, "gmD", top="gm", bevel=0.04, taper=0.8)    # plinth, narrowing up
    for e in (-1, 1):
        k.box(e * 0.72, 0, 0.0, 0.2, 0.5, 0.1, "gmD", top="gm", bevel=0.03)     # outriggers
    k.box(0, 0, 0.12, 1.5, 0.56, 0.3, "steelD", top="steel", bevel=0.05, taper=1.28)   # the vat: flares out
    k.box(0, 0, 0.4, 1.86, 0.72, 0.22, "steelL", top="plate", bevel=0.06, taper=1.04)
    k.box(0, 0, 0.6, 1.98, 0.84, 0.07, "plate", top="steelL", bevel=0.035)      # rolled lip
    k.box(0, 0.4, 0.42, 1.4, 0.012, 0.035, "hazY")                              # a band on the front
    k.box(0, 0, 0.58, 1.76, 0.62, 0.08, "gmD", top="waterD")                    # the water
    if on:
        for u, v, l in ((-0.5, 0.1, 0.22), (0.3, -0.12, 0.16), (0.7, 0.08, 0.1)):
            k.box(u, v, 0.66, l, 0.025, 0.006, "waterL")
    for u, _ in PLANTS:
        k.box(u, 0, 0.64, 0.4, 0.4, 0.05, "lvWS", top="lvW2", bevel=0.02, rz=math.pi / 4)   # a diamond raft
        k.cyl(u, 0, 0.69, 0.11, 0.01, "waterD", sides=8)
    k.box(0.0, 0.43, 0.2, 0.3, 0.03, 0.16, "gm")                                # control pad
    k.box(0.0, 0.45, 0.28, 0.12, 0.012, 0.05, "cyan" if on else "dark")
    k.cyl(-0.98, -0.3, 0.6, 0.06, 0.9, "steelD", top="steel", sides=8)          # canopy: a tube up from the lip
    pts = [(-0.98, -0.3, 1.5), (-0.75, 0.0, 1.62), (-0.5, 0.0, 1.62), (0.5, 0.0, 1.62), (0.75, 0.0, 1.62),
           (0.98, -0.3, 1.5)]
    for (u0, v0, z0), (u1, v1, z1) in zip(pts, pts[1:]):                        # a bent tube over both plants
        n = max(1, int(math.hypot(u1 - u0, v1 - v0, z1 - z0) / 0.1))
        for i in range(n + 1):
            t = i / n
            k.box(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, z0 + (z1 - z0) * t - 0.035, 0.08, 0.08, 0.07, "steelD")
    k.cyl(0.98, -0.3, 0.6, 0.06, 0.9, "steelD", top="steel", sides=8)
    for u, _ in PLANTS:                                                        # lamp pads under the tube
        k.box(u, 0, 1.5, 0.44, 0.36, 0.08, "gm", top="steelL", bevel=0.03)
        k.box(u, 0.185, 1.51, 0.36, 0.012, 0.045, lit)
        for e in (-1, 1):
            k.box(u + e * 0.225, 0, 1.51, 0.012, 0.3, 0.045, lit)
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.7, i)


def _soil(k, u, v, z, w, d, seed=0, round_=False, n=26):
    """A soil bed: dark loam with scattered clods, a mound in the middle. Round beds get a disc (w = diameter)."""
    r = random.Random(seed * 13 + 1)
    if round_:
        k.cyl(u, v, z, w / 2, 0.05, "soil", top="soilD", sides=12)
        k.cyl(u, v, z + 0.05, w / 2 * 0.7, 0.03, "soil", top="soil", sides=10)
    else:
        k.box(u, v, z, w, d, 0.05, "soil", top="soilD")
        for _ in range(max(2, int(w * 2.5))):                                # soft humps, no straight edges
            hw, hd = r.uniform(0.25, 0.45), r.uniform(0.2, 0.32)
            k.box(u + r.uniform(-w / 2 + hw / 2, w / 2 - hw / 2), v + r.uniform(-d / 2 + hd / 2, d / 2 - hd / 2), z + 0.05,
                  hw, hd, r.uniform(0.02, 0.04), "soil", top="soil", bevel=0.05, rz=r.uniform(-0.5, 0.5))
    for _ in range(n):
        if round_:
            a, rr = r.uniform(0, math.tau), r.uniform(0, w / 2 - 0.06)
            cu, cv = u + rr * math.cos(a), v + rr * math.sin(a)
        else:
            cu, cv = u + r.uniform(-w / 2 + 0.05, w / 2 - 0.05), v + r.uniform(-d / 2 + 0.05, d / 2 - 0.05)
        sz = r.uniform(0.04, 0.09)
        k.box(cu, cv, z + 0.05 + r.uniform(0, 0.025), sz, sz * r.uniform(0.6, 1.0), 0.035, r.choice(("soilL", "soilD", "soil", "soilL")),
              rz=r.uniform(0, 3))


def _octo(k, u, v, z, w, d, h, col, top=None, cut=0.22, bevel=0.0):
    """A box with its four corners cut (an elongated octagon from above): a boat-shaped planter body."""
    k.box(u, v, z, w - 2 * cut, d, h, col, top=top, bevel=bevel)
    k.box(u, v, z, w, d - 2 * cut, h, col, top=top, bevel=bevel)
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(u + su * (w / 2 - cut), v + sv * (d / 2 - cut), z, cut * 1.5, cut * 1.5, h, col, top=top,
                  rz=math.pi / 4, bevel=bevel)


def skiff(k, on, crop):
    """A boat-shaped planter on two curved skids, soil mounded in it, a crane arm with two pendant lamps."""
    lit = "growPink" if on else "blueGrey"
    for e in (-1, 1):                                                         # skids: curved runners
        for i in range(5):
            t = (i - 2) / 2
            k.box(e * 0.55, t * 0.32, 0.04 * t * t, 0.12, 0.2, 0.06, "steelD", top="steel", rx=-0.3 * t)
        k.box(e * 0.55, 0, 0.06, 0.1, 0.1, 0.1, "steelD")
    _octo(k, 0, 0, 0.14, 1.72, 0.66, 0.24, "steelD", top="steel", cut=0.22, bevel=0.015)       # hull, narrow below
    _octo(k, 0, 0, 0.36, 1.94, 0.82, 0.26, "steel", top="steelL", cut=0.26, bevel=0.02)         # flaring up to the rim
    _octo(k, 0, 0, 0.6, 1.98, 0.86, 0.05, "steelL", top="plate", cut=0.27)                     # gunwale
    _octo(k, 0, 0, 0.6, 1.78, 0.66, 0.06, "soilD", top="soilD", cut=0.22)                       # the bed
    _soil(k, 0, 0, 0.64, 1.7, 0.6, 1)
    k.box(0, 0.42, 0.42, 0.9, 0.012, 0.03, "hazY")                                             # stripe on the bow
    k.box(-0.6, 0.43, 0.2, 0.24, 0.02, 0.16, "gm")                                              # valve panel
    k.box(-0.6, 0.445, 0.3, 0.06, 0.012, 0.04, "green" if on else "dark")
    k.cyl(-0.6, 0.44, 0.22, 0.03, 0.04, "polyB", sides=6)
    k.box(0, -0.4, 0.3, 1.2, 0.05, 0.05, "polyB")                                               # drip line at the back
    k.cyl(0.92, -0.3, 0.0, 0.07, 1.55, "steelD", top="steel", sides=8)                          # crane mast at one end
    k.box(0.92, -0.3, 0.0, 0.3, 0.3, 0.08, "gmD", top="gm", bevel=0.02)
    k.box(0.1, -0.3, 1.55, 1.7, 0.08, 0.07, "steelD", top="steel")                              # jib along the back
    k.box(0.1, -0.15, 1.55, 0.06, 0.3, 0.06, "steelD")
    for e in (-1, 1):                                                                           # pendants over the plants
        u = e * 0.5
        k.box(u, -0.3, 1.55, 0.06, 0.06, 0.07, "gmD")
        k.box(u, -0.15, 1.56, 0.04, 0.34, 0.04, "steelD")                                       # short arm forward
        k.box(u, 0, 1.3, 0.025, 0.025, 0.27, "dark")                                            # the cable
        k.cyl(u, 0, 1.24, 0.21, 0.07, "gm", top="steelL", sides=10, rtop=0.13)                  # bell shade
        k.cyl(u, 0, 1.2, 0.16, 0.045, lit, sides=10)                                            # the lamp under it
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.72, i)


def hexes(k, on, crop):
    """Two hexagonal planters at two heights on a stepped base, soil in each, a mast with two angled light panels."""
    lit = "growViolet" if on else "blueGrey"
    k.box(0, 0, 0.0, 1.7, 0.6, 0.06, "gmD", top="gm", bevel=0.02)                 # base plate
    k.cyl(0.5, 0, 0.06, 0.3, 0.2, "steelD", top="steel", sides=6)                  # the raised one's drum
    for e, z in ((-1, 0.06), (1, 0.26)):
        u = e * 0.5
        k.cyl(u, 0, z, 0.4, 0.4, "steel", top="steelL", sides=6, rtop=0.46)        # planter: a flared hex pot
        k.cyl(u, 0, z + 0.4, 0.48, 0.06, "steelL", top="plate", sides=6)           # rim
        k.cyl(u, 0, z + 0.4, 0.42, 0.07, "soilD", top="soilD", sides=6)
        _soil(k, u, 0, z + 0.47, 0.78, 0.78, e + 2, round_=True, n=18)
        k.box(u, 0.46, z + 0.1, 0.1, 0.03, 0.1, "polyB")                            # feed valve
    k.box(0, 0, 0.1, 0.5, 0.05, 0.05, "polyB")                                      # pipe between them
    k.box(0, 0.33, 0.06, 0.26, 0.04, 0.24, "gm")                                    # hub panel
    k.box(0, 0.355, 0.2, 0.08, 0.012, 0.05, "green" if on else "dark")
    k.cyl(0, -0.4, 0.0, 0.06, 1.5, "steelD", top="steel", sides=8)                  # the mast at the back
    k.box(0, -0.4, 0.0, 0.26, 0.2, 0.08, "gmD", top="gm", bevel=0.02)
    k.box(0, -0.4, 1.5, 1.3, 0.08, 0.07, "steelD", top="steel")                     # cross bar
    for e in (-1, 1):                                                               # angled light panels, tilted
        u = e * 0.5                                                                 # down toward the plants
        k.box(u, -0.2, 1.4, 0.5, 0.42, 0.06, lit, top="gm", rx=-0.45)                # the panel: lit edges, grey top
        k.box(u, -0.4, 1.46, 0.1, 0.1, 0.1, "gmD")                                   # hinge on the bar
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.56 + (0.2 if u > 0 else 0), i)


def bags(k, on, crop):
    """Two canvas grow bags in a shallow drip tray, soil heaped over their cuffs, a drip line between them, a bent
    pipe gantry with a long tube lamp."""
    lit = "growPink" if on else "blueGrey"
    k.box(0, 0, 0.0, 1.9, 0.8, 0.1, "steelD", top="steel", bevel=0.02)             # drip tray
    k.box(0, 0, 0.04, 1.78, 0.68, 0.07, "gmD", top="grime")
    for e in (-1, 1):
        u = e * 0.5
        k.cyl(u, 0, 0.1, 0.33, 0.36, "canvasD", top="canvas", sides=12, rtop=0.3)   # the bag, slumped
        k.cyl(u, 0, 0.44, 0.34, 0.1, "canvas", top="canvasD", sides=12, rtop=0.31)  # folded cuff
        k.cyl(u, 0, 0.52, 0.29, 0.04, "soilD", top="soilD", sides=12)
        _soil(k, u, 0, 0.55, 0.56, 0.56, e + 5, round_=True, n=14)
        k.box(u, 0.31, 0.2, 0.1, 0.06, 0.08, "canvasD")                              # handle loop
        k.cyl(u, 0, 0.6, 0.03, 0.12, "polyB", sides=6)                               # dripper stake
    k.box(0, 0, 0.56, 1.0, 0.045, 0.045, "polyB")                                    # drip line between
    k.box(0, -0.38, 0.1, 1.4, 0.045, 0.045, "polyB")
    k.box(-0.9, -0.3, 0.1, 0.16, 0.16, 0.22, "gmD", top="gm")                        # pump / timer box
    k.box(-0.9, -0.215, 0.26, 0.07, 0.012, 0.04, "green" if on else "dark")
    for e in (-1, 1):                                                                # gantry: pipes up the back
        k.cyl(e * 0.92, -0.36, 0.1, 0.04, 1.3, "steelL", top="plate", sides=8)       # corners, bent forward
        for i in range(4):
            t = i / 3
            k.box(e * 0.92, -0.36 + 0.3 * math.sin(t * math.pi / 2), 1.4 + 0.12 * math.sin(t * math.pi), 0.08, 0.1,
                  0.08, "steelL")
        k.cyl(e * 0.92, -0.06, 1.3, 0.05, 0.05, "gm", sides=8)
    k.box(0, -0.06, 1.44, 1.92, 0.08, 0.08, "steelL", top="plate")                   # the bar
    k.box(0, -0.06, 1.33, 1.6, 0.09, 0.09, lit)                                      # the tube lamp under it
    for e in (-1, 1):
        k.box(e * 0.85, -0.06, 1.32, 0.1, 0.11, 0.11, "gmD")
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.62, i)


def _pill(k, z, L, w, h, col, top=None, sides=12):
    """A pill from above along u: a box with a half-cylinder at each end, L long over all, w wide."""
    k.box(0, 0, z, L - w, w, h, col, top=top)
    for e in (-1, 1):
        k.cyl(e * (L - w) / 2, 0, z, w / 2, h, col, top=top, sides=sides)


def capsule(k, on, crop):
    """One pill-shaped monocoque body on a moulded base, the soil in a well along it, a cowl curling up from the
    back edge and over the bed with the lamp in its lip: body and light are one shape."""
    lit = "growPink" if on else "blueGrey"
    _pill(k, 0.0, 1.7, 0.6, 0.12, "gmD", top="gm")                                   # base
    _pill(k, 0.12, 1.96, 0.84, 0.5, "steel", top="steelL")                            # body
    _pill(k, 0.34, 1.98, 0.86, 0.06, "navy")                                          # band around it
    _pill(k, 0.62, 1.78, 0.66, 0.05, "soilD", top="soilD")                            # the well
    _soil(k, 0, 0, 0.66, 1.58, 0.5, 7)
    n = 6                                                                            # the cowl: a quarter arc
    pts = [(-0.06 - 0.36 * math.cos(a), 0.62 + 0.7 * math.sin(a)) for a in (math.pi / 2 * i / n for i in range(n + 1))]
    for (v0, za), (v1, zb) in zip(pts, pts[1:]):
        L = math.hypot(v1 - v0, zb - za) + 0.06
        k.box(0, (v0 + v1) / 2, (za + zb) / 2 - 0.07, 1.6, L, 0.14, "steel", top="steelL",
              rx=math.atan2(zb - za, v1 - v0))
    for e in (-1, 1):                                                                # rounded cheeks at its ends
        k.cyl(e * 0.8, -0.3, 0.62, 0.12, 0.5, "steel", top="steelL", sides=10)
    k.box(0, 0.1, 1.26, 1.62, 0.34, 0.1, "steel", top="steelL", bevel=0.03)          # the lip, forward over the bed
    k.box(0, 0.275, 1.27, 1.5, 0.012, 0.06, lit)                                      # the lamp along its edge
    for e in (-1, 1):
        k.box(e * 0.81, 0.1, 1.27, 0.012, 0.3, 0.06, lit)
    k.box(0.5, 0.42, 0.4, 0.34, 0.012, 0.14, "dark")                                  # display on the front
    k.box(0.5, 0.428, 0.44, 0.24, 0.012, 0.06, "cyan" if on else "steelD")
    k.box(-0.5, 0.42, 0.22, 0.24, 0.012, 0.06, "hazY")                                # label plate
    k.cyl(-0.98, 0.0, 0.46, 0.05, 0.1, "polyB", sides=6)                              # water inlet on the nose
    k.cyl(0.98, 0.0, 0.46, 0.06, 0.06, "gmD", sides=6)
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.74, i)


def tunnel(k, on, crop):
    """A rounded hull with a bellied underside and round ends, soil along its top, three ribs rising from the hull
    into a spine that carries the lamp: a small tunnel house in one piece."""
    lit = "growPink" if on else "blueGrey"
    k.box(0, 0, 0.0, 1.1, 0.3, 0.2, "gmD", top="gm", bevel=0.02)                      # keel
    _halfpipe(k, 0, 0, 0.6, 0.42, 0.1, 1.5, "steel", "steelL")                        # the belly
    for e in (-1, 1):                                                                # round ends
        k.cyl(e * 0.75, 0, 0.18, 0.42, 0.42, "steel", top="steelL", sides=12)
        k.cyl(e * 0.75, 0, 0.6, 0.44, 0.04, "steelL", top="plate", sides=12)         # rim
    k.box(0, 0, 0.6, 1.5, 0.88, 0.04, "steelL", top="plate")
    k.box(0, 0, 0.6, 1.5, 0.66, 0.08, "soilD", top="soilD")                           # the well
    for e in (-1, 1):
        k.cyl(e * 0.75, 0, 0.6, 0.33, 0.08, "soilD", top="soilD", sides=12)
    _soil(k, 0, 0, 0.68, 1.9, 0.5, 9, n=34)
    for u, sz in ((-0.95, 0.1), (0, 0.08), (0.95, 0.1)):                              # ribs
        _hoop(k, u, 0.62, 0.74, 0.44, "steel", n=8, s=sz, top="steelL")
    k.box(0, 0, 1.32, 2.0, 0.12, 0.1, "steel", top="steelL", bevel=0.02)              # the spine
    for sv in (-1, 1):
        k.box(0, sv * 0.065, 1.33, 1.9, 0.012, 0.06, lit)                             # lamps along both sides
    k.box(0.45, 0.44, 0.3, 0.3, 0.012, 0.14, "dark")                                  # front display
    k.box(0.45, 0.448, 0.34, 0.2, 0.012, 0.06, "cyan" if on else "steelD")
    k.cyl(-1.17, 0.0, 0.3, 0.05, 0.12, "polyB", sides=6)                              # inlet on the nose
    k.cyl(1.17, 0.0, 0.3, 0.06, 0.08, "medRed", sides=6)
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.76, i)


def visor(k, on, crop):
    """A chamfered one-piece unit: an octagonal body, a backboard rising from it that carries the plumbing, and a
    visor hood tilted up over the bed, lit along its edges."""
    lit = "growPink" if on else "blueGrey"
    _octo(k, 0, 0, 0.0, 1.7, 0.6, 0.1, "gmD", top="gm", cut=0.18)                       # base
    _octo(k, 0, 0, 0.1, 1.96, 0.84, 0.52, "steel", top="steelL", cut=0.24, bevel=0.02)   # body
    _octo(k, 0, 0, 0.6, 1.76, 0.64, 0.06, "soilD", top="soilD", cut=0.2)                 # the well
    _soil(k, 0, 0, 0.65, 1.58, 0.5, 8)
    k.box(0, 0.42, 0.3, 1.2, 0.012, 0.03, "navy")                                        # trim line on the front
    k.box(0.55, 0.43, 0.38, 0.3, 0.012, 0.14, "dark")                                    # display
    k.box(0.55, 0.438, 0.42, 0.2, 0.012, 0.06, "cyan" if on else "steelD")
    k.box(0, -0.35, 0.62, 1.7, 0.14, 0.5, "steel", top="steelL", bevel=0.02)             # backboard
    for e in (-1, 1):                                                                    # its chamfered ends
        k.box(e * 0.87, -0.3, 0.62, 0.14, 0.2, 0.5, "steel", top="steelL", rz=e * 0.6, bevel=0.02)
    k.box(-0.45, -0.27, 0.72, 0.4, 0.012, 0.22, "glassD")                                # nutrient window
    k.box(-0.45, -0.262, 0.72, 0.4, 0.012, 0.1, "polyB")
    k.box(0.3, -0.27, 0.78, 0.18, 0.03, 0.18, "plate")                                   # gauge
    k.box(0.3, -0.25, 0.81, 0.12, 0.012, 0.12, "dark")
    k.box(0.3, -0.242, 0.86, 0.04, 0.012, 0.05, "hazY")
    k.cyl(0.65, -0.26, 0.62, 0.035, 0.48, "steelL", sides=8)                             # pipes up the board
    k.cyl(0.75, -0.26, 0.62, 0.035, 0.48, "steelL", sides=8)
    k.box(0, -0.1, 1.1, 1.8, 0.62, 0.1, lit, top="steelL", rx=0.3, bevel=0.015)           # the visor, tilted up
    k.box(0, -0.34, 1.12, 1.6, 0.1, 0.12, "steel", top="steelL")                          # its hinge rail
    k.box(0, -0.1, 1.17, 1.3, 0.4, 0.05, "steelL", top="plate", rx=0.3)                   # a raised panel on top
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.73, i)


def _hull(k, on, well=True):
    """The tunnel family's shared body: a keel, a bellied pill hull with round ends, a rim, the soil well, a front
    display and the nose fittings."""
    k.box(0, 0, 0.0, 1.1, 0.3, 0.2, "gmD", top="gm", bevel=0.02)                      # keel
    _halfpipe(k, 0, 0, 0.6, 0.42, 0.1, 1.5, "steel", "steelL")                        # the belly
    for e in (-1, 1):                                                                # round ends
        k.cyl(e * 0.75, 0, 0.18, 0.42, 0.42, "steel", top="steelL", sides=12)
        k.cyl(e * 0.75, 0, 0.6, 0.44, 0.05, "steelL", top="plate", sides=12)         # rim
    k.box(0, 0, 0.6, 1.5, 0.88, 0.05, "steelL", top="plate")
    if well:
        k.box(0, 0, 0.6, 1.5, 0.64, 0.09, "soilD", top="soilD")
        for e in (-1, 1):
            k.cyl(e * 0.75, 0, 0.6, 0.32, 0.09, "soilD", top="soilD", sides=12)
        _soil(k, 0, 0, 0.69, 1.9, 0.48, 9, n=34)
    k.box(0.45, 0.44, 0.3, 0.3, 0.012, 0.14, "dark")                                  # front display
    k.box(0.45, 0.448, 0.34, 0.2, 0.012, 0.06, "cyan" if on else "steelD")
    k.box(-0.45, 0.44, 0.34, 0.24, 0.012, 0.05, "hazY")                               # label plate
    k.cyl(-1.17, 0.0, 0.3, 0.05, 0.12, "polyB", sides=6)                              # inlet on the nose
    k.cyl(1.17, 0.0, 0.3, 0.06, 0.08, "medRed", sides=6)


def tunnel2(k, on, crop):
    """The tunnel, refined: the ribs grow out of shoulders on the hull's sides and cap over the spine; the lamps are
    segments between the ribs, so nothing crosses them."""
    lit = "growPink" if on else "blueGrey"
    _hull(k, on)
    RIBS = ((-0.95, 0.1), (0.0, 0.09), (0.95, 0.1))
    for u, sz in RIBS:
        for sv in (-1, 1):                                                           # shoulders on the hull side
            k.box(u, sv * 0.41, 0.42, sz + 0.1, 0.14, 0.24, "steel", top="steelL", bevel=0.02)
        _hoop(k, u, 0.56, 0.78, 0.45, "steel", n=8, s=sz, top="steelL")
        k.box(u, 0, 1.3, sz + 0.06, 0.22, 0.12, "steel", top="steelL", bevel=0.02)   # the cap over the spine
    k.box(0, 0, 1.3, 1.96, 0.12, 0.09, "steel", top="steelL", bevel=0.02)             # the spine
    for sv in (-1, 1):
        for u in (-0.5, 0.5):                                                        # lamps between the ribs
            k.box(u, sv * 0.066, 1.31, 0.76, 0.012, 0.055, lit)
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.77, i)


def hut(k, on, crop):
    """The same hull, with solid arched end walls rising out of its ends (a Nissen hut), a spine between them, and the
    lamps along the spine. The sides are open, so the plants show."""
    lit = "growPink" if on else "blueGrey"
    _hull(k, on)
    for e in (-1, 1):                                                                # end walls: stepped half discs
        u = e * 1.0
        for i in range(-4, 5):
            v = i * 0.1
            h = 0.78 * math.sqrt(max(0.0, 1 - (v / 0.47) ** 2))
            k.box(u, v, 0.6, 0.12, 0.1 + 0.005, h, "steel", top="steelL")
        k.box(u, 0, 0.6, 0.14, 0.9, 0.06, "steelL", top="plate", bevel=0.01)         # its sill on the rim
        k.box(u + e * 0.065, 0, 0.9, 0.012, 0.3, 0.22, "glassD")                      # a porthole in the wall
        k.box(u + e * 0.072, 0, 0.98, 0.012, 0.16, 0.08, "green" if on else "dark")
    k.box(0, 0, 1.3, 2.1, 0.14, 0.1, "steel", top="steelL", bevel=0.02)              # the spine
    for sv in (-1, 1):
        k.box(0, sv * 0.076, 1.31, 1.84, 0.012, 0.06, lit)
    for u in (-0.5, 0.5):                                                            # drip lines down from the spine
        k.box(u, 0, 1.2, 0.03, 0.03, 0.1, "polyB")
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.77, i)


def halo(k, on, crop):
    """The same hull; two swept arms rise from its ends and carry a racetrack ring lamp over the bed."""
    lit = "growPink" if on else "blueGrey"
    _hull(k, on)
    n = 6
    for e in (-1, 1):                                                                # the arms: quarter arcs inward
        pts = [(e * (1.15 - 0.45 * math.sin(a)), 0.55 + 0.75 * (1 - math.cos(a)))
               for a in (math.pi / 2 * i / n for i in range(n + 1))]
        for (u0, za), (u1, zb) in zip(pts, pts[1:]):
            L = math.hypot(u1 - u0, zb - za) + 0.06
            k.box((u0 + u1) / 2, 0, (za + zb) / 2 - 0.07, L, 0.16, 0.14, "steel", top="steelL",
                  ry=-math.atan2(zb - za, u1 - u0))
        k.box(e * 1.0, 0, 0.5, 0.3, 0.3, 0.16, "steel", top="steelL", bevel=0.02)    # root on the nose
    k.box(0, 0.3, 1.28, 1.3, 0.12, 0.1, "steel", top="steelL", bevel=0.02)            # the ring: two long bars
    k.box(0, -0.3, 1.28, 1.3, 0.12, 0.1, "steel", top="steelL", bevel=0.02)
    for e in (-1, 1):                                                                # and round ends
        for i in range(6):
            a = -math.pi / 2 + math.pi * (i + 0.5) / 6
            k.box(e * 0.65 + e * 0.3 * math.cos(a), 0.3 * math.sin(a), 1.28, 0.17, 0.12, 0.1, "steel",
                  top="steelL", rz=a + math.pi / 2)
    for sv in (-1, 1):                                                               # lit inner edges
        k.box(0, sv * 0.235, 1.29, 1.24, 0.012, 0.06, lit)
    for e in (-1, 1):
        for i in range(6):
            a = -math.pi / 2 + math.pi * (i + 0.5) / 6
            k.box(e * 0.65 + e * 0.235 * math.cos(a), 0.235 * math.sin(a), 1.29, 0.13, 0.012, 0.06, lit,
                  rz=a + math.pi / 2)
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.77, i)


def shell(k, on, crop):
    """A pill hull whose back half rises into a tall shell wall between two round end towers (the same casting), a
    lip projecting from the wall's top over the bed with the lamp in it. U-shaped in plan, open to the crew."""
    lit = "growPink" if on else "blueGrey"
    _pill(k, 0.0, 1.7, 0.6, 0.1, "gmD", top="gm")                                     # base
    _pill(k, 0.1, 1.98, 0.86, 0.5, "steel", top="steelL")                             # hull
    _pill(k, 0.3, 2.0, 0.88, 0.05, "navy")                                            # band
    _pill(k, 0.6, 1.8, 0.68, 0.06, "soilD", top="soilD")                              # well
    _soil(k, 0, 0, 0.66, 1.6, 0.5, 7)
    for e in (-1, 1):                                                                # towers at the back corners,
        k.cyl(e * 0.74, -0.22, 0.5, 0.26, 0.76, "steel", top="steelL", sides=12, rtop=0.2)   # out of the hull's ends
        k.cyl(e * 0.74, -0.22, 1.26, 0.22, 0.06, "steelL", top="plate", sides=12)
    k.box(0, -0.3, 0.6, 1.5, 0.24, 0.66, "steel", top="steelL", bevel=0.02)           # the back wall between them
    k.box(0, -0.4, 0.6, 1.5, 0.06, 0.66, "steelD")                                    # its shadow line
    k.box(0, -0.08, 1.24, 1.9, 0.62, 0.1, "steel", top="steelL", bevel=0.03)          # the lip over the bed
    k.box(0, 0.225, 1.25, 1.8, 0.012, 0.06, lit)                                      # lamp along its edge
    for e in (-1, 1):
        k.box(e * 0.95, -0.08, 1.25, 0.012, 0.56, 0.06, lit)
    k.box(-0.3, -0.19, 0.8, 0.3, 0.012, 0.2, "glassD")                                # nutrient window in the wall
    k.box(-0.3, -0.183, 0.8, 0.3, 0.012, 0.09, "polyB")
    k.box(0.3, -0.19, 0.86, 0.26, 0.012, 0.1, "dark")                                 # readout
    k.box(0.3, -0.183, 0.9, 0.16, 0.012, 0.04, "cyan" if on else "steelD")
    k.box(0.5, 0.43, 0.36, 0.3, 0.012, 0.12, "dark")                                  # front display
    k.box(0.5, 0.438, 0.4, 0.2, 0.012, 0.05, "cyan" if on else "steelD")
    k.cyl(-0.99, 0.0, 0.42, 0.05, 0.1, "polyB", sides=6)
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.74, i)


def stem(k, on, crop):
    """A flared oval dish; its back swells into one thick stem that rises and spreads into the pill ring lamp."""
    lit = "growPink" if on else "blueGrey"
    k.box(0, 0, 0.0, 1.5, 0.5, 0.1, "gmD", top="gm", bevel=0.03)                       # foot
    _octo(k, 0, 0, 0.1, 1.7, 0.66, 0.2, "steel", top="steelL", cut=0.2, bevel=0.03)   # the dish, flaring out
    _octo(k, 0, 0, 0.3, 1.96, 0.86, 0.26, "steel", top="steelL", cut=0.28, bevel=0.03)
    _octo(k, 0, 0, 0.56, 2.0, 0.9, 0.05, "steelL", top="plate", cut=0.3)              # rolled rim
    _octo(k, 0, 0, 0.56, 1.76, 0.66, 0.06, "soilD", top="soilD", cut=0.22)
    _soil(k, 0, 0, 0.62, 1.56, 0.5, 11)
    k.box(0, -0.42, 0.3, 0.6, 0.3, 0.3, "steel", top="steelL", bevel=0.05, taper=0.7)  # the stem: swelling from the
    k.box(0, -0.4, 0.58, 0.42, 0.26, 0.5, "steel", top="steelL", bevel=0.04, taper=0.75)   # dish's back
    k.box(0, -0.36, 1.06, 0.3, 0.2, 0.26, "steel", top="steelL", bevel=0.03)
    k.box(0, -0.34, 1.3, 0.34, 0.24, 0.08, "steel", top="steelL", bevel=0.03, taper=1.6)  # spreading into the ring
    _ring_pill(k, 1.33, 1.3, 0.6, 0.12, 0.08, "steel", "steelL", lit)
    k.box(-0.22, -0.3, 0.72, 0.012, 0.1, 0.22, "glassD")                                # window in the stem's side
    k.box(0.5, 0.44, 0.34, 0.3, 0.012, 0.12, "dark")                                    # front display
    k.box(0.5, 0.448, 0.38, 0.2, 0.012, 0.05, "cyan" if on else "steelD")
    k.box(-0.5, 0.44, 0.36, 0.2, 0.012, 0.05, "hazY")
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.7, i)


def _ring_pill(k, z, L, w, bar, h, col, top, lit):
    """A racetrack ring lamp at height z: L long over all, w wide (centre line), bar thick; lit along its inner edge."""
    straight = L - w
    for sv in (-1, 1):
        k.box(0, sv * w / 2, z, straight, bar, h, col, top=top, bevel=0.015)
        k.box(0, sv * (w / 2 - bar / 2 - 0.006), z + 0.01, straight - 0.04, 0.012, h - 0.02, lit)
    for e in (-1, 1):
        for i in range(6):
            a = -math.pi / 2 + math.pi * (i + 0.5) / 6
            cu, cv = e * straight / 2 + e * (w / 2) * math.cos(a), (w / 2) * math.sin(a)
            k.box(cu, cv, z, bar, math.pi * w / 12 + 0.02, h, col, top=top, rz=a)
            ri = w / 2 - bar / 2 - 0.006
            k.box(e * straight / 2 + e * ri * math.cos(a), ri * math.sin(a), z + 0.01, 0.012, math.pi * ri / 6, h - 0.02, lit,
                  rz=a)


def horns(k, on, crop):
    """A rounded trough whose end caps are tall tapering towers (horns) of the same casting; a thick light bar spans
    between their tops. Nothing is added to the body: the body holds the light."""
    lit = "growPink" if on else "blueGrey"
    k.box(0, 0, 0.0, 1.4, 0.4, 0.12, "gmD", top="gm", bevel=0.03)                       # skid
    _halfpipe(k, 0, 0, 0.6, 0.4, 0.1, 1.3, "steel", "steelL")                          # the belly
    k.box(0, 0, 0.6, 1.3, 0.84, 0.05, "steelL", top="plate")
    for e in (-1, 1):                                                                 # the horns: the trough's end
        u, v = e * 0.8, -0.26                                                          # caps swelling up at the back
        k.cyl(u, 0, 0.2, 0.42, 0.42, "steel", top="steelL", sides=12)                  # round end
        k.cyl(u, v, 0.4, 0.3, 0.5, "steel", top="steelL", sides=12, rtop=0.22)         # tapering up and back
        k.cyl(u, v, 0.9, 0.22, 0.36, "steel", top="steelL", sides=12, rtop=0.16)
        k.cyl(u, v, 1.26, 0.18, 0.06, "steelL", top="plate", sides=12)                 # a cap
        k.box(u + e * 0.3, v, 0.5, 0.012, 0.2, 0.16, "glassD")                         # porthole on the outer face
        k.box(u + e * 0.31, v, 0.55, 0.012, 0.12, 0.05, "polyB" if e < 0 else ("green" if on else "dark"))
    k.box(0, 0.04, 0.6, 1.5, 0.56, 0.08, "soilD", top="soilD")                          # the well between the horns
    for e in (-1, 1):
        k.cyl(e * 0.75, 0.04, 0.6, 0.27, 0.08, "soilD", top="soilD", sides=12)
    _soil(k, 0, 0.04, 0.68, 1.7, 0.44, 13, n=30)
    k.box(0, -0.26, 1.26, 1.7, 0.2, 0.1, "steel", top="steelL", bevel=0.03)             # the bar between the horns
    k.box(0, -0.1, 1.26, 1.4, 0.16, 0.08, "steel", top="steelL", bevel=0.02)            # a lip forward over the bed
    k.box(0, -0.016, 1.27, 1.3, 0.012, 0.05, lit)                                       # lit along its edge
    k.box(0, -0.156, 1.27, 1.6, 0.012, 0.06, lit)
    k.box(0.4, 0.43, 0.32, 0.3, 0.012, 0.12, "dark")                                    # front display
    k.box(0.4, 0.438, 0.36, 0.2, 0.012, 0.05, "cyan" if on else "steelD")
    k.box(-0.3, 0.43, 0.34, 0.2, 0.012, 0.05, "hazY")
    if crop:
        for i, (u, v) in enumerate(PLANTS):
            _plant(k, u, v, 0.76, i)


VARIANTS = {"bench": bench, "scaffold": scaffold, "tub": tub, "pipe": pipe, "bowls": bowls, "vat": vat,
            "skiff": skiff, "hexes": hexes, "bags": bags,
            "capsule": capsule, "tunnel": tunnel, "visor": visor,
            "tunnel2": tunnel2, "hut": hut, "halo": halo,
            "shell": shell, "stem": stem, "horns": horns}
STATES = ("off", "on", "on.crop")


def build(variant, state, rot=0):
    k = K(f"hydro_{variant}_{state.replace('.', '_')}_{rot}", (2, 1), rot)
    VARIANTS[variant](k, state.startswith("on"), state.endswith(".crop"))
    return k.build()


def jobs(rots=range(4)):
    names = os.environ.get("HYDRO_VARIANTS", ",".join(VARIANTS)).split(",")
    return [(f"module.hydroponics.{v}.{s}", (2, 1), "prop", lambda v=v, s=s: build(v, s)) for v in names for s in STATES]
