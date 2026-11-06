"""Weapon upgrade item art (family `upgrades`): ten module parts, each with floor stacks .s/.m/.l and .held, in the grid frame
and scale of items.py (x, y on the deck, z up, origin the tile centre at floor level). No randomness.

General upgrades (fit any weapon; no weapon tag):
  upg_capacitor  Quick capacitor   a bank of three dark cells, yellow glowing bands, copper bus bar and terminals
  upg_coolant    Coolant jacket    a ribbed sleeve: frosted cyan fins, glowing coolant windows between, a valve on top
  upg_housing    Hardened housing  a squat armoured shell: steel-grey slab and plate, corner bolts (blockiest of the set)
Behaviour upgrades (one weapon type each; a coloured band marks the weapon: laser red, mass driver blue, missile green,
ion violet, incendiary orange):
  upg_prism      Prism splitter    a faceted crystal in a cradle, laser colours split across the facets      (laser)
  upg_focus      Heavy focus       a thick lens barrel on two saddles, one big glass lens at the front        (laser)
  upg_frag       Frag slug         a stubby scored slug cartridge with a blunt nose                          (mass driver)
  upg_rail       Rail coil         two long rails wound with copper, a heat glow at one end                  (mass driver)
  upg_nuke       Nuclear warhead   an olive warhead nose cone on chocks, hazard bands and a trefoil badge    (missile)
  upg_chain      Chain coil        an upright tesla emitter: copper coil, three forked prongs, violet tips  (ion)
  upg_thermite   Thermite          a squat olive canister with an orange-red band and a charge brick         (incendiary)

Colours are the family's own palette set (palette_extra.json "upgrades"); a sprite renders on that set alone."""
import math

import bmesh
from mathutils import Vector

from . import core
from .items_kit import FLOOR, cone, emit, jobs as item_jobs, pile, place, rot, tube

PALETTE = "only:upgrades"          # the family's palette selection
TAG = {"laser": "upRed", "mass": "upBlu", "missile": "upGrn", "ion": "upVio", "fire": "upOr"}


def _axis(m, c, rz, u0, u1, z, r, col, cap=None, sides=12):
    """A cylinder lying along the unit's heading rz, from u0 to u1 (box-local), its axis at height z."""
    a, b = rot(c, rz, u0, 0), rot(c, rz, u1, 0)
    tube(m, (a[0], a[1], z), (b[0], b[1], z), r, col, cap=cap, sides=sides)


# ---- general upgrades --------------------------------------------------------------------------------------------------

def capacitor(m, c, z, rz, k):
    n, r, h, step, z0 = 3, 0.04 * k, 0.15 * k, 0.1 * k, 0.025 * k
    m.box((c[0], c[1], z), (step * (n - 1) + 0.13 * k, 0.1 * k, z0), "upGun", top="upSteelD", rz=rz, base=True, bevel=0.006 * k)
    for i in range(n):
        x, y = rot(c, rz, (i - (n - 1) / 2) * step, 0)
        m.cyl((x, y, z + z0), r, h, "upGun", sides=10, top="upSteel")
        m.cyl((x, y, z + z0 + h * 0.62), r + 0.004 * k, 0.026 * k, "upYelG", sides=10)            # the glowing band
        m.cyl((x, y, z + z0 + h), 0.019 * k, 0.034 * k, "upYel", sides=6, top="upBolt")            # terminal
    x, y = rot(c, rz, 0, 0)
    m.box((x, y, z + z0 + h + 0.034 * k), (step * (n - 1) + 0.03 * k, 0.014 * k, 0.012 * k), "upCu", top="upCu", rz=rz, base=True)


def coolant(m, c, z, rz, k):
    r, h = 0.068 * k, 0.17 * k
    m.cyl((c[0], c[1], z), r, h, "upSteelD", sides=12, top="upSteel")
    for t in (0.26, 0.6):                                                                          # coolant windows
        m.cyl((c[0], c[1], z + h * t), r + 0.005 * k, 0.07 * k, "upCyG", sides=12)
    for t in (0.0, 0.42, 0.88):                                                                    # frosted fins
        m.cyl((c[0], c[1], z + h * t), r + 0.014 * k, 0.018 * k, "upCy", sides=12, top="upGlass")
    x, y = rot(c, rz, 0.03 * k, 0)
    m.cyl((x, y, z + h), 0.022 * k, 0.04 * k, "upCyD", sides=8, top="upCy")                        # valve
    x, y = rot(c, rz, -0.035 * k, 0.01 * k)
    m.cyl((x, y, z + h), 0.016 * k, 0.026 * k, "upSteel", sides=6, top="upBolt")


def housing(m, c, z, rz, k):
    w, d = 0.22 * k, 0.17 * k
    m.box((c[0], c[1], z), (w, d, 0.055 * k), "upHeavy", top="upSteel", rz=rz, base=True, bevel=0.008 * k)
    m.box((c[0], c[1], z + 0.055 * k), (w * 0.78, d * 0.76, 0.05 * k), "upSteelD", top="upHeavy", rz=rz, base=True, taper=0.86,
          bevel=0.008 * k)
    m.box((c[0], c[1], z + 0.105 * k), (w * 0.42, d * 0.4, 0.014 * k), "upGun", top="upSteelD", rz=rz, base=True)
    for su in (-1, 1):
        for sv in (-1, 1):                                                                         # corner bolts
            x, y = rot(c, rz, su * w * 0.4, sv * d * 0.38)
            m.cyl((x, y, z + 0.055 * k), 0.016 * k, 0.014 * k, "upGun", sides=6, top="upBolt")


# ---- laser ---------------------------------------------------------------------------------------------------------------

FACET = ("upRed", "upGrn", "upBlu", "upGlass", "upRed", "upBlu")


def _facets(m, base, L, r, rz):
    """A six-sided crystal standing on `base`: each facet a laser colour, the point glass-white."""
    bm = bmesh.new()
    b = Vector(base)
    ring0 = [bm.verts.new(b + Vector((r * math.cos(t), r * math.sin(t), 0))) for t in (k * math.tau / 6 + rz for k in range(6))]
    ring1 = [bm.verts.new(p.co + Vector((0, 0, L * 0.62))) for p in ring0]
    tip = bm.verts.new(b + Vector((0, 0, L)))
    for i in range(6):
        j = (i + 1) % 6
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
        bm.faces.new((ring1[i], ring1[j], tip))
    bm.faces.new(ring0[::-1])

    def colour(n, ctr):
        if n.z < -0.5:
            return None
        if ctr.z > b.z + L * 0.62 + 1e-6:
            return "upGlass"
        a = (math.atan2(ctr.y - b.y, ctr.x - b.x) - rz) % math.tau
        return FACET[int(a / math.tau * 6) % 6]
    emit(m, bm, colour)


def prism(m, c, z, rz, k):
    m.box((c[0], c[1], z), (0.17 * k, 0.08 * k, 0.034 * k), "upGun", top="upSteelD", rz=rz, base=True, bevel=0.006 * k)
    m.box((c[0], c[1], z + 0.008 * k), (0.178 * k, 0.088 * k, 0.014 * k), TAG["laser"], rz=rz, base=True)
    for s in (-1, 1):
        x, y = rot(c, rz, s * 0.07 * k, 0)
        m.box((x, y, z + 0.034 * k), (0.022 * k, 0.07 * k, 0.07 * k), "upSteelD", top="upSteel", rz=rz, base=True, bevel=0.005 * k)
    _facets(m, (c[0], c[1], z + 0.034 * k), 0.2 * k, 0.05 * k, rz)


def focus(m, c, z, rz, k):
    zc, r = z + 0.075 * k, 0.056 * k
    for u in (-0.06, 0.05):
        x, y = rot(c, rz, u * k, 0)
        m.box((x, y, z), (0.03 * k, 0.1 * k, 0.05 * k), "upGun", top="upSteelD", rz=rz, base=True, bevel=0.005 * k)
    _axis(m, c, rz, -0.11 * k, 0.07 * k, zc, r, "upSteel", cap="upGun")
    _axis(m, c, rz, -0.1 * k, -0.075 * k, zc, r + 0.006 * k, TAG["laser"], cap=TAG["laser"])       # weapon tag band
    _axis(m, c, rz, -0.02 * k, 0.0, zc, r + 0.008 * k, "upSteelD")
    _axis(m, c, rz, 0.05 * k, 0.09 * k, zc, r + 0.016 * k, "upGun", cap="upSteelD")              # lens collar
    _axis(m, c, rz, 0.09 * k, 0.106 * k, zc, r + 0.006 * k, "upGlass", cap="upGlass")            # the lens


# ---- mass driver ---------------------------------------------------------------------------------------------------------

def frag(m, c, z, rz, k):
    r, h = 0.048 * k, 0.1 * k
    m.cyl((c[0], c[1], z), r + 0.008 * k, 0.024 * k, "upCuD", sides=10, top="upCu")
    m.cyl((c[0], c[1], z + 0.024 * k), r, h, "upSteelD", sides=10, top="upSteel")
    m.cyl((c[0], c[1], z + 0.03 * k), r + 0.004 * k, 0.02 * k, TAG["mass"], sides=10)               # weapon tag band
    for t in (0.3, 0.6):                                                                           # scoring grooves
        m.cyl((c[0], c[1], z + 0.024 * k + h * t), r + 0.003 * k, 0.012 * k, "upBlack", sides=10)
    zt = z + 0.024 * k + h
    m.cyl((c[0], c[1], zt), r, 0.04 * k, "upSteel", sides=10, rtop=r * 0.62, top="upSteel")        # the ogive: two tapers
    cone(m, (c[0], c[1], zt + 0.04 * k), (c[0], c[1], zt + 0.09 * k), r * 0.62, "upBolt", sides=10)


def rail(m, c, z, rz, k):
    L = 0.3 * k
    m.box((c[0], c[1], z), (L, 0.06 * k, 0.022 * k), "upGun", top="upSteelD", rz=rz, base=True)    # the spine between the rails
    for v in (-0.058, 0.058):
        x, y = rot(c, rz, 0, v * k)
        m.box((x, y, z + 0.012 * k), (L, 0.034 * k, 0.07 * k), "upSteel", top="upBolt", rz=rz, base=True, bevel=0.004 * k)
        x, y = rot(c, rz, 0.145 * k, v * k)
        m.box((x, y, z + 0.012 * k), (0.026 * k, 0.038 * k, 0.074 * k), "upHot", top="upHot", rz=rz, base=True)   # heat glow
        x, y = rot(c, rz, -0.14 * k, v * k)
        m.box((x, y, z + 0.012 * k), (0.024 * k, 0.038 * k, 0.074 * k), TAG["mass"], rz=rz, base=True)          # weapon tag
        for u in (-0.08, -0.03, 0.02, 0.07):                                                       # copper windings
            x, y = rot(c, rz, u * k, v * k)
            m.box((x, y, z + 0.006 * k), (0.02 * k, 0.044 * k, 0.062 * k), "upCu", top="upCuD", rz=rz, base=True)


# ---- missiles ------------------------------------------------------------------------------------------------------------

def nuke(m, c, z, rz, k):
    r, zc = 0.058 * k, z + 0.024 * k + 0.058 * k
    for u in (-0.065, 0.045):
        x, y = rot(c, rz, u * k, 0)
        m.box((x, y, z), (0.036 * k, 0.11 * k, 0.03 * k), "upBlack", top="upGun", rz=rz, base=True)  # crude chocks
    _axis(m, c, rz, -0.13 * k, 0.05 * k, zc, r, "upOlive", cap="upGun")
    _axis(m, c, rz, -0.115 * k, -0.095 * k, zc, r + 0.004 * k, TAG["missile"])                      # weapon tag band
    for i in range(4):                                                                             # hazard bands
        u = -0.04 * k + i * 0.02 * k
        _axis(m, c, rz, u, u + 0.02 * k, zc, r + 0.004 * k, "upYel" if i % 2 == 0 else "upBlack")
    p0, p1 = rot(c, rz, 0.05 * k, 0), rot(c, rz, 0.17 * k, 0)
    cone(m, (p0[0], p0[1], zc), (p1[0], p1[1], zc), r, "upSteel", sides=12)
    for s in (-1, 1):                                                                              # tail fins
        x, y = rot(c, rz, -0.115 * k, s * (r + 0.012 * k))
        m.box((x, y, zc - 0.025 * k), (0.05 * k, 0.012 * k, 0.05 * k), "upSteelD", rz=rz, base=True)
    x, y = rot(c, rz, -0.02 * k, r + 0.002 * k)                                                    # trefoil badge on the
    m.box((x, y, zc - 0.03 * k), (0.06 * k, 0.008 * k, 0.06 * k), "upYel", rz=rz, base=True)       # camera-side flank
    m.box((x, y, zc - 0.006 * k), (0.016 * k, 0.01 * k, 0.016 * k), "upBlack", rz=rz, base=True)
    for a in (0.0, 2.1, 4.2):
        bx, by = rot((0, 0), rz, 0.02 * k * math.cos(a), 0)
        m.box((x + bx, y + by, zc - 0.002 * k + 0.02 * k * math.sin(a) - 0.008 * k), (0.012 * k, 0.01 * k, 0.012 * k), "upBlack",
              rz=rz, base=True)


# ---- ion cannon ----------------------------------------------------------------------------------------------------------

def chain(m, c, z, rz, k):
    m.cyl((c[0], c[1], z), 0.07 * k, 0.035 * k, "upGun", sides=10, top="upSteelD")
    m.cyl((c[0], c[1], z + 0.006 * k), 0.075 * k, 0.016 * k, TAG["ion"], sides=10)                  # weapon tag band
    m.cyl((c[0], c[1], z + 0.035 * k), 0.022 * k, 0.1 * k, "upSteel", sides=8, top="upBolt")
    for i in range(3):
        m.cyl((c[0], c[1], z + 0.045 * k + i * 0.03 * k), 0.036 * k, 0.018 * k, "upCu", sides=10, top="upCu")
    for i in range(3):                                                                             # forked prongs
        a = rz + i * math.tau / 3
        tx, ty = c[0] + 0.08 * k * math.cos(a), c[1] + 0.08 * k * math.sin(a)
        tube(m, (c[0], c[1], z + 0.125 * k), (tx, ty, z + 0.2 * k), 0.011 * k, "upSteel", sides=6)
        m.cyl((tx, ty, z + 0.195 * k), 0.016 * k, 0.026 * k, "upVio", sides=6, top="upVioG")                      # the arc tips


# ---- incendiary ------------------------------------------------------------------------------------------------------------

def thermite(m, c, z, rz, k):
    r, h = 0.072 * k, 0.1 * k
    m.cyl((c[0], c[1], z), r, h, "upOlive", sides=12, top="upGun")
    m.cyl((c[0], c[1], z + h * 0.28), r + 0.005 * k, h * 0.42, TAG["fire"], sides=12)               # weapon tag band
    m.cyl((c[0], c[1], z + h), r * 0.78, 0.018 * k, "upSteelD", sides=12, top="upSteel")
    m.cyl((c[0], c[1], z + h + 0.018 * k), 0.022 * k, 0.034 * k, "upOrD", sides=8, top="upOrG")     # igniter
    x, y = rot(c, rz, 0.115 * k, 0.05 * k)
    m.box((x, y, z), (0.07 * k, 0.05 * k, 0.06 * k), "upOrD", top="upOr", rz=rz, base=True, bevel=0.005 * k)    # charge brick
    m.box((x, y, z + 0.06 * k), (0.07 * k, 0.012 * k, 0.008 * k), "upBlack", rz=rz, base=True)


# ---- the set ---------------------------------------------------------------------------------------------------------------

# Long things lying down get fewer, spread units; upright ones with points on top stand on the deck (FLOOR).
LONG = {"held": [(0.0, 0.0, 0.0, 0.3)],
        "s": [(-0.04, -0.1, 0.0, 0.3), (0.05, 0.1, 0.0, 0.2)],
        "m": [(-0.06, -0.2, 0.0, 0.3), (0.06, 0.0, 0.0, 0.2), (-0.04, 0.2, 0.0, 0.35)],
        "l": [(-0.06, -0.3, 0.0, 0.3), (0.06, -0.14, 0.0, 0.2), (-0.04, 0.02, 0.0, 0.35), (0.07, 0.17, 0.0, 0.15),
              (-0.05, 0.32, 0.0, 0.3), (0.04, -0.05, 0.1, 0.25)]}

ITEMS = {"upg_capacitor": (capacitor, FLOOR), "upg_coolant": (coolant, FLOOR), "upg_housing": (housing, pile(0.105, 0.22)),
         "upg_prism": (prism, FLOOR), "upg_focus": (focus, LONG), "upg_frag": (frag, FLOOR), "upg_rail": (rail, LONG),
         "upg_nuke": (nuke, LONG), "upg_chain": (chain, FLOOR), "upg_thermite": (thermite, FLOOR)}


def _builder(unit, layout):
    return lambda m, size: place(m, size, unit, layout)


def jobs():
    return [j for name, (unit, layout) in ITEMS.items() for j in item_jobs(name, _builder(unit, layout))]


def palette(_sid):
    return PALETTE
