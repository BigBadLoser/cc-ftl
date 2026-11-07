"""Weapon upgrade item art (family `upgrades`): ten module parts, each with floor stacks .s/.m/.l and .held, in the grid frame
and scale of items.py (x, y on the deck, z up, origin the tile centre at floor level). No randomness.

General upgrades (fit any weapon; no weapon tag):
  upg_capacitor  Quick capacitor   a bank of three dark cells, yellow glowing bands, copper bus bar and terminals
  upg_coolant    Coolant jacket    an open ribbed sleeve: a dark bore, frosted ribs, a glowing coolant window, two hoses
  upg_housing    Hardened housing  a clamshell armour shell over a barrel: thick arch, yellow ribs, bolted flanges
Behaviour upgrades (one weapon type each; a coloured band marks the weapon: laser red, mass driver blue, missile green,
ion violet, incendiary orange):
  upg_prism      Prism splitter    a tapered crystal (camera facets red/green/blue) in three claws      (laser)
  upg_focus      Heavy focus       an upright optic: grooved grip, wide bezel, one big blue glass lens    (laser)
  upg_frag       Frag slug         a brass-cased slug, its steel head bursting into four splayed shards   (mass driver)
  upg_rail       Rail coil         two long rails wound with copper, a heat glow at one end                  (mass driver)
  upg_nuke       Nuclear warhead   an olive ogive warhead on chocks: hazard band, painted trefoil, pins (missile)
  upg_chain      Chain coil        a tesla coil: copper winding, steel crown ring, violet lightning arcs  (ion)
  upg_thermite   Thermite          a steel crucible, its open top a molten glowing pool throwing sparks   (incendiary)

Each item also has a UI icon, item.upg_<id>.icon: ONE unit (not a stack), turned to a three-quarter view chosen per item
(ICON_VIEW) and scaled to fill about ICON_PX of a 40 px box, outlined like every sprite; the UI shows it 1:1 (the module
inspector's upgrade slot, the upgrade hover card). The family also renders the neutral shot sprites (upgrade_shots.py).

Colours are the family's own palette set (palette_extra.json "upgrades"); a sprite renders on that set alone."""
import math

from mathutils import Matrix, Vector

from . import core
from .items_kit import FLOOR, cone, jobs as item_jobs, pile, place, rot, tube
from .items_upgrades_kit import arch, bolt, crystal, dome, glint, ogive, ring, segments, torus, trefoil

PALETTE = "only:upgrades"          # the family's palette selection
TAG = {"laser": "upRed", "mass": "upBlu", "missile": "upGrn", "ion": "upVio", "fire": "upOr"}


def _axis(m, c, rz, u0, u1, z, r, col, cap=None, sides=12):
    """A cylinder lying along the unit's heading rz, from u0 to u1 (box-local), its axis at height z."""
    a, b = rot(c, rz, u0, 0), rot(c, rz, u1, 0)
    tube(m, (a[0], a[1], z), (b[0], b[1], z), r, col, cap=cap, sides=sides)


# ---- general upgrades --------------------------------------------------------------------------------------------------

def capacitor(m, c, z, rz, k):
    n, r, h, step, z0 = 3, 0.046 * k, 0.15 * k, 0.105 * k, 0.025 * k
    m.box((c[0], c[1], z), (step * (n - 1) + 0.14 * k, 0.11 * k, z0), "upGun", top="upSteelD", rz=rz, base=True, bevel=0.006 * k)
    for i in range(n):
        x, y = rot(c, rz, (i - (n - 1) / 2) * step, 0)
        m.cyl((x, y, z + z0), r, h, "upGun", sides=10, top="upSteel")
        m.cyl((x, y, z + z0 + h * 0.56), r + 0.005 * k, 0.034 * k, "upYelG", sides=10)            # the glowing band
        m.cyl((x, y, z + z0 + h), 0.024 * k, 0.03 * k, "upYel", sides=6, top="upBolt")             # terminal
        m.box((x, y, z + z0 + h + 0.03 * k), (0.03 * k, 0.034 * k, 0.012 * k), "upCuD", top="upCu", rz=rz, base=True)  # clamp
    x, y = rot(c, rz, 0, 0)
    m.box((x, y, z + z0 + h + 0.042 * k), (step * (n - 1) + 0.03 * k, 0.018 * k, 0.014 * k), "upCu", top="upCu", rz=rz, base=True)


def coolant(m, c, z, rz, k):
    """An open ribbed sleeve (it slides over the barrel): a dark bore down the middle, frosted ribs, one glowing coolant
    window, two hoses running down the side."""
    ro, ri, h = 0.066 * k, 0.04 * k, 0.17 * k
    ring(m, c, z, ro, ri, h, "upSteelD", "upSteel", "upGun", floor="upBlack")
    ring(m, c, z + h * 0.44, ro + 0.005 * k, ri + 0.004 * k, 0.034 * k, "upCyG", "upCyG", "upCyG")      # coolant window
    for t in (0.06, 0.26, 0.66):                                                                      # frosted ribs
        ring(m, c, z + h * t, ro + 0.013 * k, ri + 0.004 * k, 0.016 * k, "upCy", "upGlass", "upCy")
    ring(m, c, z + h - 0.016 * k, ro + 0.013 * k, ri, 0.016 * k, "upCy", "upGlass", "upGun")        # the lip rib
    for a in (0.55, 1.35):                                                                            # coolant hoses
        def p(rad, t, a=a):
            return (c[0] + rad * math.cos(rz + a), c[1] + rad * math.sin(rz + a), z + h * t)
        pts = [p(ro, 0.97), p(ro + 0.026 * k, 0.9), p(ro + 0.028 * k, 0.2), p(ro, 0.12)]
        for p0, p1 in zip(pts, pts[1:]):
            tube(m, p0, p1, 0.011 * k, "upCyD", sides=6)


def housing(m, c, z, rz, k):
    """A clamshell armour shell that clamps over a weapon's barrel: a thick arch with two raised ribs, bolted flanges
    along both feet, the barrel running through it; yellow ribs. Steel grey, the heaviest of the set."""
    L, ro, ri, fz = 0.2 * k, 0.078 * k, 0.052 * k, 0.022 * k
    arch(m, c, rz, -L / 2, L / 2, ro, ri, z + fz, "upHeavy", "upGun", "upSteelD")
    _axis(m, c, rz, -L / 2 - 0.012 * k, L / 2 + 0.085 * k, z + fz + 0.032 * k, 0.03 * k, "upSteel", cap="upBlack")   # the barrel
    for u in (-0.062, 0.062):                                                                         # raised ribs
        arch(m, c, rz, u * k - 0.012 * k, u * k + 0.012 * k, ro + 0.009 * k, ro - 0.004 * k, z + fz, "upYel", "upGun", "upSteelD")
    for sv in (-1, 1):                                                                                # bolted flanges
        x, y = rot(c, rz, 0, sv * (ro + 0.006 * k))
        m.box((x, y, z), (L, 0.05 * k, fz), "upSteelD", top="upHeavy", rz=rz, base=True, bevel=0.004 * k)
        for u in (-0.075, 0.0, 0.075):
            x, y = rot(c, rz, u * k, sv * (ro + 0.014 * k))
            m.cyl((x, y, z + fz), 0.011 * k, 0.012 * k, "upGun", sides=6, top="upBolt")


# ---- laser ---------------------------------------------------------------------------------------------------------------

def prism(m, c, z, rz, k):
    """A tapered crystal (the camera-facing facets red, green, blue) gripped by three claws over a round emitter base."""
    m.cyl((c[0], c[1], z), 0.07 * k, 0.03 * k, "upGun", sides=12, top="upSteelD")
    m.cyl((c[0], c[1], z + 0.008 * k), 0.074 * k, 0.014 * k, TAG["laser"], sides=12)                # weapon tag band
    crystal(m, (c[0], c[1], z + 0.03 * k), 0.27 * k, 0.05 * k, rz)
    m.cyl((c[0], c[1], z + 0.03 * k), 0.046 * k, 0.018 * k, "upSteelD", sides=12, top="upSteel")       # collar at its foot
    for i in range(3):                                                                                # claws
        a = rz + math.pi / 6 + i * math.tau / 3
        def p(rad, zz, a=a):
            return (c[0] + rad * math.cos(a), c[1] + rad * math.sin(a), z + zz * k)
        for p0, p1 in ((p(0.062 * k, 0.03), p(0.062 * k, 0.066)), (p(0.062 * k, 0.066), p(0.05 * k, 0.084))):
            tube(m, p0, p1, 0.011 * k, "upSteel", sides=6)


def focus(m, c, z, rz, k):
    """An upright optic: a mount with the weapon band, a barrel, a grooved grip, a wide bezel and one big glass lens."""
    n = 20
    m.cyl((c[0], c[1], z), 0.058 * k, 0.03 * k, "upGun", sides=n, top="upSteelD")
    m.cyl((c[0], c[1], z + 0.007 * k), 0.061 * k, 0.015 * k, TAG["laser"], sides=n)                 # weapon tag band
    m.cyl((c[0], c[1], z + 0.03 * k), 0.05 * k, 0.03 * k, "upSteel", sides=n, top="upSteelD")        # barrel
    m.cyl((c[0], c[1], z + 0.06 * k), 0.057 * k, 0.022 * k, "upSteelD", sides=n)                     # grip
    m.cyl((c[0], c[1], z + 0.069 * k), 0.0585 * k, 0.004 * k, "upGun", sides=n)                      # its groove
    m.cyl((c[0], c[1], z + 0.082 * k), 0.07 * k, 0.026 * k, "upSteelD", sides=n, top="upGun")        # bezel
    m.cyl((c[0], c[1], z + 0.108 * k), 0.058 * k, 0.003 * k, "upBlack", sides=n)
    dome(m, c, z + 0.108 * k, 0.056 * k, 0.026 * k, ("upLensL", "upLens", "upLensD", "upLensD", "upLensD"), sides=n)
    glint(m, c, z + 0.108 * k, 0.056 * k, 0.026 * k, "upWhite", halo="upLensL")


# ---- mass driver ---------------------------------------------------------------------------------------------------------

def frag(m, c, z, rz, k):
    """A slug bursting: brass casing on a rim, the weapon band, and its blunt steel head split into four shards that splay
    outward from a glowing core, the upper shards flung further."""
    r = 0.052 * k
    m.cyl((c[0], c[1], z), r + 0.007 * k, 0.012 * k, "upCuD", sides=14, top="upCu")                 # rim
    m.cyl((c[0], c[1], z + 0.012 * k), r, 0.05 * k, "upCu", sides=14, top="upCuD")                  # casing
    m.cyl((c[0], c[1], z + 0.04 * k), r + 0.003 * k, 0.018 * k, TAG["mass"], sides=14)              # weapon tag band
    zh = z + 0.062 * k
    m.cyl((c[0], c[1], zh - 0.004 * k), r * 0.66, 0.064 * k, "upHot", sides=10, rtop=r * 0.22)     # the core
    for i in range(4):
        mid = rz + math.pi / 4 + i * math.tau / 4
        for j, (a, b, f0, f1, push) in enumerate(((0.0, 0.03, 1.0, 0.98, 0.012), (0.03, 0.062, 0.98, 0.5, 0.03))):
            cc = (c[0] + push * k * math.cos(mid), c[1] + push * k * math.sin(mid))
            segments(m, cc, zh + a * k + j * 0.006 * k, zh + b * k + j * 0.012 * k, r * f0, r * f1, 4, 0.5, rz,
                     lambda q: "upSteel", "upSteel", "upSteelD", pick=(i,))


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
            m.box((x, y, z + 0.004 * k), (0.022 * k, 0.046 * k, 0.09 * k), "upCu", top="upCu", rz=rz, base=True)   # (over the rail top)


# ---- missiles ------------------------------------------------------------------------------------------------------------

def nuke(m, c, z, rz, k):
    """A warhead section on crude chocks: a smooth olive nose cone, a broad yellow hazard band with the trefoil painted on, a
    short body, the weapon band, and a plain mating flange and tail stub at the back."""
    R, zc = 0.06 * k, z + 0.03 * k + 0.06 * k
    for u in (-0.07, 0.06):
        x, y = rot(c, rz, u * k, 0)
        m.box((x, y, z), (0.04 * k, 0.12 * k, 0.034 * k), "upBlack", top="upGun", rz=rz, base=True)    # crude chocks
    _axis(m, c, rz, -0.145 * k, -0.128 * k, zc, R * 0.6, "upGun", cap="upBlack")                    # tail stub
    _axis(m, c, rz, -0.128 * k, -0.106 * k, zc, R + 0.008 * k, "upSteelD", cap="upGun")              # mating flange
    _axis(m, c, rz, -0.106 * k, -0.084 * k, zc, R + 0.003 * k, TAG["missile"])                       # weapon tag band
    _axis(m, c, rz, -0.084 * k, -0.045 * k, zc, R, "upOlive")
    _axis(m, c, rz, -0.045 * k, 0.06 * k, zc, R + 0.002 * k, "upYel")                                # hazard band
    trefoil(m, c, rz, 0.0075 * k, zc, R + 0.002 * k, 0.047 * k, phi=0.55)
    ogive(m, c, rz, 0.06 * k, 0.2 * k, zc, R + 0.002 * k, "upOlive", "upSteel")


# ---- ion cannon ----------------------------------------------------------------------------------------------------------

def chain(m, c, z, rz, k):
    """A tesla coil: a base with the weapon band, a copper winding, a steel crown ring and a cap, violet lightning arcing
    off both sides."""
    m.cyl((c[0], c[1], z), 0.066 * k, 0.028 * k, "upGun", sides=16, top="upSteelD")
    m.cyl((c[0], c[1], z + 0.006 * k), 0.07 * k, 0.014 * k, TAG["ion"], sides=16)                   # weapon tag band
    m.cyl((c[0], c[1], z + 0.028 * k), 0.03 * k, 0.1 * k, "upCu", sides=14, top="upCuD")            # the winding
    for i in range(4):
        m.cyl((c[0], c[1], z + 0.04 * k + i * 0.022 * k), 0.0315 * k, 0.004 * k, "upCuD", sides=14)
    torus(m, c, z + 0.142 * k, 0.05 * k, 0.018 * k, "upSteel")                                       # the crown
    m.cyl((c[0], c[1], z + 0.128 * k), 0.026 * k, 0.026 * k, "upSteelD", sides=14, top="upGun")
    m.cyl((c[0], c[1], z + 0.158 * k), 0.012 * k, 0.012 * k, "upVio", sides=8, top="upVioG")        # spark cap
    w = 0.014 * k
    for sv in (-1, 1):                                                                              # the arcs
        bolt(m, c, [(sv * 0.07 * k, z + 0.145 * k), (sv * 0.1 * k, z + 0.11 * k), (sv * 0.083 * k, z + 0.098 * k),
                    (sv * 0.112 * k, z + 0.055 * k)], w, "upVioG")


# ---- incendiary ------------------------------------------------------------------------------------------------------------

def thermite(m, c, z, rz, k):
    """A crucible of burning thermite: a squat steel pot with the weapon band, its open top a molten pool
    (orange at the rim, white-hot in the middle) throwing sparks."""
    r, h = 0.07 * k, 0.085 * k
    m.cyl((c[0], c[1], z), r * 0.86, 0.012 * k, "upGun", sides=16, top="upSteelD")                  # foot
    m.cyl((c[0], c[1], z + 0.012 * k), r, h, "upSteelD", sides=16, top="upGun", rtop=r * 1.05)      # the pot
    m.cyl((c[0], c[1], z + 0.024 * k), r * 1.02, 0.024 * k, TAG["fire"], sides=16, rtop=r * 1.03)  # weapon tag band
    zt = z + 0.012 * k + h
    ring(m, c, zt - 0.006 * k, r * 1.08, r * 0.9, 0.012 * k, "upSteel", "upSteel", "upGun")         # the lip
    m.cyl((c[0], c[1], zt - 0.004 * k), r * 0.9, 0.004 * k, "upOr", sides=16)                       # the melt: rim
    m.cyl((c[0], c[1], zt), r * 0.62, 0.002 * k, "upOrG", sides=14)                                  # white-hot middle
    for u, v, zz, sz in ((0.0, -0.015, 0.03, 0.016), (-0.025, 0.012, 0.058, 0.013), (0.02, 0.02, 0.082, 0.011)):
        x, y = rot(c, rz, u * k, v * k)                                                             # sparks
        m.box((x, y, zt + zz * k), (sz * k, sz * k, sz * k), "upHot", top="upHot", rz=rz + 0.6, base=True)


# ---- the set ---------------------------------------------------------------------------------------------------------------

# Long things lying down get fewer, spread units; upright ones with points on top stand on the deck (FLOOR).
LONG = {"held": [(0.0, 0.0, 0.0, 0.3)],
        "s": [(-0.04, -0.1, 0.0, 0.3), (0.05, 0.1, 0.0, 0.2)],
        "m": [(-0.06, -0.2, 0.0, 0.3), (0.06, 0.0, 0.0, 0.2), (-0.04, 0.2, 0.0, 0.35)],
        "l": [(-0.06, -0.3, 0.0, 0.3), (0.06, -0.14, 0.0, 0.2), (-0.04, 0.02, 0.0, 0.35), (0.07, 0.17, 0.0, 0.15),
              (-0.05, 0.32, 0.0, 0.3), (0.04, -0.05, 0.1, 0.25)]}

ITEMS = {"upg_capacitor": (capacitor, FLOOR), "upg_coolant": (coolant, FLOOR), "upg_housing": (housing, pile(0.105, 0.22)),
         "upg_prism": (prism, FLOOR), "upg_focus": (focus, FLOOR), "upg_frag": (frag, FLOOR), "upg_rail": (rail, LONG),
         "upg_nuke": (nuke, LONG), "upg_chain": (chain, FLOOR), "upg_thermite": (thermite, FLOOR)}


def _builder(unit, layout):
    return lambda m, size: place(m, size, unit, layout)


# Icons: (heading rz, tilt about the screen-right axis, roll about the view axis) per item: upright parts turned to show two
# faces; long parts laid across the view, tipped up, and rolled to a diagonal (working end up-right) so they fill the box.
ICON_PX = 38
ICON_VIEW = {"capacitor": (-0.55, 0.0, 0.0), "coolant": (0.4, 0.0, 0.0), "housing": (0.3, 0.0, 0.0), "prism": (0.25, 0.0, 0.0),
             "focus": (0.3, -0.35, 0.0), "frag": (0.0, 0.0, 0.0), "rail": (-0.45, 0.3, 0.55), "nuke": (-0.45, 0.25, 0.55),
             "chain": (0.3, 0.0, 0.0), "thermite": (-0.6, 0.0, 0.0)}
VIEW_AXIS = Vector((math.cos(math.radians(30)) * math.sqrt(0.5), math.cos(math.radians(30)) * math.sqrt(0.5),
                    math.sin(math.radians(30))))   # towards the camera (yaw 45, elevation 30), grid frame


# An icon sits on the dark UI panel and the UI draws it from the colour sheet alone (no glow sheet): its darkest steels go a
# step up, and its glowing parts go into a second, unlit mesh in a bright solid colour, so every face of them stays bright.
ICON_LIFT = {"upBlack": "upGun", "upGun": "upSteelD"}
ICON_GLOW = {"upYelG": "upYelB", "upCyG": "upCy", "upHot": "upAmb", "upVioG": "upVioB", "upOrG": "upAmb"}   # drawn unlit


def _icon(name, unit):
    import bpy
    rz, tilt, roll = ICON_VIEW[name.removeprefix("upg_")]
    m, lit = core.Mesh(f"{name}_icon"), core.Mesh(f"{name}_icon_lit", flat=True)
    solid = m.poly
    m.poly = lambda pts, color, flip=False: lit.poly(pts, ICON_GLOW[color], flip) if color in ICON_GLOW else solid(pts, color, flip)
    core.REMAP.update(ICON_LIFT)
    try:
        unit(m, (0.0, 0.0), 0.0, rz, 1.0)
    finally:
        for key in ICON_LIFT:
            core.REMAP.pop(key, None)
    obs = [m.build()] + ([lit.build()] if lit.f else [])
    for ob in obs:
        if tilt:                                # tip the far end up, about the axis across the camera's view
            ob.data.transform(Matrix.Rotation(tilt, 4, Vector((1.0, -1.0, 0.0)).normalized()))
        if roll:                                # turn it on the screen, working end up
            ob.data.transform(Matrix.Rotation(roll, 4, core.G(*VIEW_AXIS) - core.G(0, 0, 0)))
    bpy.context.view_layer.update()
    x0, x1, y0, y1 = core.extent_px(obs)
    k = (ICON_PX - 2) / max(x1 - x0, y1 - y0)   # (the outline adds a px each side)
    for ob in obs:
        ob.data.transform(Matrix.Scale(k, 4))   # baked into the mesh, so the render cache sees it
    bpy.context.view_layer.update()
    return obs


def jobs():
    from .upgrade_shots import jobs as shot_jobs
    out = [j for name, (unit, layout) in ITEMS.items() for j in item_jobs(name, _builder(unit, layout))]
    out += [(f"item.{name}.icon", (1, 1), "prop", lambda n=name, u=unit: _icon(n, u)) for name, (unit, _) in ITEMS.items()]
    return out + shot_jobs()


def palette(_sid):
    return PALETTE
