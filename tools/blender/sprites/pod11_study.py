"""Recovery pod look study round 11 (family `pod`, preview only): round 10 reworked after review.

  - no floor of its own: the base is round (a circle filling the footprint, the corners left empty; z3 keeps its
    octagon, whose flats run to the footprint's edges), with only a lobe out into the machinery's corner
  - the machinery grows out of the pod: the base housing and the top housing each grow a wing into the right corner
    (the same section, lip and lit seam carried round), and the pump, filter, spine or cartridge tower stands on / hangs
    from those wings, so the plan reads as one keyhole-shaped body, not parts stacked on a base
  - no dither noise: the light tops are flat tiers, not cones (the palette dithers a light gradient into speckle);
    no coplanar faces (the spine's hub sat flush with its arm and flickered)

  z1 plinth   z2 spine   z3 octagon

Layers as round 1 (pod_study.py). Units: world (1 = a tile), z in world units."""
import math

from .pod10_study import BLUE, GREEN, RH, Z0, Z1, ekg, tank
from .pod8_study import at, lamp, run, vpipe
from .research_kit import Bench, bar

FP2 = (2, 2)
RIGHT = -math.pi / 4
FRONT = math.pi / 4
RW = 0.94                                                   # how far the wings reach into the right corner


def slab(k, a, r0, r1, w, z, h, col, top, end=True, sides=16):
    """A wing: a slab along angle a from radius r0 to r1, w wide, a round end at r1."""
    k.box(*at(a, (r0 + r1) / 2), z, r1 - r0, w, h, col, top=top, rz=a)
    if end:
        k.cyl(*at(a, r1), z, w / 2, h, col, top=top, sides=sides)


def round_base(k, r, z, h, col, top, lobe_w=0.6):
    """The round base with a lobe out under the right corner's machinery."""
    k.cyl(0.0, 0.0, z, r, h, col, top=top, sides=40)
    slab(k, RIGHT, 0.4, RW, lobe_w, z, h, col, top)


def base_body(k, z0, body, top, lit, w=0.5, sides=32):
    """The base housing and its wing: one section (body to Z0 - 0.08, a bevelled top, a chrome lip, a lit seam)."""
    zb = Z0 - 0.08
    k.cyl(0.0, 0.0, z0, RH, zb - z0, body, top=top, sides=sides)
    slab(k, RIGHT, 0.4, RW, w, z0, zb - z0, body, top)
    k.cyl(0.0, 0.0, zb, RH - 0.06, 0.08, body, top=top, sides=sides)                         # the bevel (stepped),
    slab(k, RIGHT, 0.4, RW, w - 0.12, zb, 0.08, body, top)
    k.cyl(0.0, 0.0, z0 + 0.04, RH + 0.008, 0.03, "arcChrD", top="arcChr", sides=sides)       # the chrome lip,
    slab(k, RIGHT, 0.4, RW, w + 0.016, z0 + 0.04, 0.03, "arcChrD", "arcChr")
    k.cyl(0.0, 0.0, zb - 0.02, RH + 0.006, 0.014, lit, top=lit, sides=sides)                 # the lit seam
    slab(k, RIGHT, 0.4, RW, w + 0.012, zb - 0.02, 0.014, lit, lit)
    k.cyl(0.0, 0.0, Z0 - 0.02, 0.66, 0.03, lit, top=lit, sides=sides)                        # the tank's lit foot


def top_body(k, body, top, lit, w=0.42, h=0.24, sides=32, tiers=((0.62, 0.1), (0.36, 0.08))):
    """The top housing and its shoulder over the right corner: one section, flat tiers above it."""
    k.cyl(0.0, 0.0, Z1, RH, h, body, top=top, sides=sides)
    slab(k, RIGHT, 0.4, RW, w, Z1, h, body, top)
    k.cyl(0.0, 0.0, Z1 + 0.08, RH + 0.006, 0.03, lit, top=lit, sides=sides)                  # its lit seam,
    slab(k, RIGHT, 0.4, RW, w + 0.012, Z1 + 0.08, 0.03, lit, lit)
    z = Z1 + h
    for r, th in tiers:                                                                       # flat tiers
        k.cyl(0.0, 0.0, z, r, th, body, top=top, sides=sides)
        z += th
    return z


def z1(layer="all"):
    """Plinth: the pump grows out of the base's wing, the filter on its column, the column up into the top housing's
    shoulder."""
    k = Bench(f"pod_z1_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    cu, cv = at(RIGHT, RW)
    if layer == "all":
        round_base(k, 0.98, 0.0, 0.07, "arcBodyD", "arcBody", lobe_w=0.66)                    # the plinth,
        round_base(k, 0.9, 0.07, 0.06, "arcBodyD", "arcBody", lobe_w=0.6)
        k.cyl(0.0, 0.0, 0.065, 0.985, 0.012, "arcChrD", top="arcChr", sides=40)
        base_body(k, 0.13, "arcBodyD", "arcBody", "podGL")
        ekg(k, RH, 0.2, "podGL")
    k.cyl(cu, cv, Z0 - 0.08, 0.22, 0.5, "arcBodyD", top="arcBody", sides=18)                # the pump, out of the
    for i in range(4):                                                                        # wing: its fins,
        k.cyl(cu, cv, Z0 + 0.02 + i * 0.1, 0.245, 0.045, "arcChrD", top="arcChr", sides=18)
    k.cyl(cu, cv, Z0 + 0.42, 0.2, 0.08, "arcBodyD", top="arcBody", sides=18)
    lamp(k, *at(RIGHT + 0.2, RW + 0.06), Z0 + 0.32, "podGL")
    lamp(k, *at(RIGHT + 0.27, RW + 0.02), Z0 + 0.32, "arcAmb")
    vpipe(k, cu, cv, Z0 + 0.5, 1.2, r=0.08)
    k.cyl(cu, cv, 1.2, 0.19, 0.07, "arcChrD", top="arcChr", sides=16)                         # the filter,
    k.cyl(cu, cv, 1.27, 0.16, 0.4, "podGM", top="podGM", sides=16)
    k.cyl(cu, cv, 1.67, 0.16, 0.03, "podGL", top="podGL", sides=16)
    k.cyl(cu, cv, 1.7, 0.16, 0.14, "arcGlass", top="arcGlass", sides=16)
    k.cyl(cu, cv, 1.84, 0.19, 0.07, "arcChrD", top="arcChr", sides=16)
    vpipe(k, cu, cv, 1.91, Z1 + 0.02, r=0.08)                                                 # up into the shoulder
    z = top_body(k, "arcShellD", "arcShell", "podGL")
    k.cyl(0.0, 0.0, z, 0.16, 0.06, "arcChrD", top="arcChr", sides=14)
    lamp(k, *at(RIGHT, RW + 0.2), Z1 + 0.16, "podGL", 0.05)
    return k.build()


def z2(layer="all"):
    """Spine: the spine grows out of the base's wing, up past the top housing; its arm runs over the top housing to
    the hub the housing hangs from."""
    k = Bench(f"pod_z2_{layer}", FP2)
    tank(k, layer, BLUE)
    if layer == "glass":
        return k.build()
    sr = 0.9
    su, sv = at(RIGHT, sr)
    tu, tv = math.cos(RIGHT), math.sin(RIGHT)
    if layer == "all":
        round_base(k, 0.98, 0.0, 0.12, "arcBodyD", "arcBody", lobe_w=0.7)
        k.cyl(0.0, 0.0, 0.115, 0.985, 0.012, "arcChrD", top="arcChr", sides=40)
        base_body(k, 0.12, "arcShellD", "arcShell", "podBL", w=0.6)
        ekg(k, RH, 0.2, "podBL")
    z = top_body(k, "arcShellD", "arcShell", "podBL", w=0.5, tiers=((0.6, 0.12),))
    k.box(su, sv, Z0 - 0.08, 0.34, 0.54, z + 0.3 - (Z0 - 0.08), "arcShell", top="arcShell", rz=RIGHT)   # the spine,
    au, av = at(RIGHT, 0.45)                                                                  # its arm,
    k.box(au, av, z + 0.02, 0.9, 0.36, 0.14, "arcShellD", top="arcShellD", rz=RIGHT)
    k.cyl(0.0, 0.0, z - 0.02, 0.24, 0.24, "arcShellD", top="arcShell", sides=20)             # the hub (above the arm)
    k.cyl(0.0, 0.0, z + 0.22, 0.12, 0.05, "podBL", top="podBL", sides=14)
    for d in (-0.19, 0.19):                                                                   # the arm's lit edges
        k.box(au + d * math.cos(FRONT), av + d * math.sin(FRONT), z + 0.1, 0.8, 0.012, 0.02, "podBL", rz=RIGHT)
    fu, fv = su + 0.276 * math.cos(FRONT), sv + 0.276 * math.sin(FRONT)                       # its face (the camera's):
    k.box(fu, fv, Z0 + 0.02, 0.28, 0.02, z - Z0 - 0.1, "arcBodyD", rz=RIGHT)                 # a dark channel,
    for i in range(2):                                                                         # two hoses in it,
        d = (i - 0.5) * 0.11
        bar(k, (fu + d * tu + 0.03, fv + d * tv + 0.03, Z0 + 0.04), (fu + d * tu + 0.03, fv + d * tv + 0.03, z - 0.1),
            0.065, "arcChr")
    for zc in (0.9, 1.8, 2.7):                                                                 # clamps over them,
        k.box(fu + 0.05, fv + 0.05, zc, 0.3, 0.04, 0.08, "arcBodyD", top="arcBody", rz=RIGHT)
    gu, gv = fu + 0.06, fv + 0.06                                                              # a level gauge,
    k.box(gu, gv, 1.25, 0.24, 0.03, 0.42, "arcBodyK", top="arcBodyD", rz=RIGHT)
    for i in range(6):
        k.box(gu + 0.018, gv + 0.018, 1.29 + i * 0.058, 0.17, 0.004, 0.036, "podBL" if i < 4 else "arcBodyD",
              rz=RIGHT)
    for i, c in enumerate(("podBL", "podBL", "arcAmb")):                                      # status lights
        lamp(k, fu + (i - 1) * 0.085 * tu + 0.05, fv + (i - 1) * 0.085 * tv + 0.05, z + 0.12, c, 0.055)
    for i in range(5):                                                                         # vents on its side
        k.box(su + 0.172 * tu, sv + 0.172 * tv, 1.0 + i * 0.12, 0.006, 0.3, 0.04, "arcBodyK", rz=RIGHT)
    return k.build()


def z3(layer="all"):
    """Octagon: the base housing's wing rises into the cartridge tower in the right corner; the tower's top runs into
    the octagonal cap's shoulder."""
    k = Bench(f"pod_z3_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    bu, bv = at(RIGHT, 0.86)
    tu, tv = math.cos(RIGHT), math.sin(RIGHT)
    if layer == "all":
        oc = 0.98 / math.cos(math.pi / 8)
        k.cyl(0.0, 0.0, 0.0, oc, 0.16, "arcBodyD", top="arcBody", sides=8)                   # the platform,
        k.cyl(0.0, 0.0, 0.16, oc - 0.1, 0.03, "arcChrD", top="arcChr", sides=8)
        base_body(k, 0.19, "arcShell", "arcShellL", "podGL", w=0.62, sides=8)
        ekg(k, RH, 0.24, "podGL")
    k.box(bu, bv, Z0 - 0.08, 0.44, 0.62, 1.32 - (Z0 - 0.08), "arcShell", top="arcShellL", rz=RIGHT)   # the tower,
    nu, nv = at(FRONT, 0.312)
    k.box(bu + nu, bv + nv, Z0 + 0.06, 0.42, 0.012, 0.6, "arcBodyK", rz=RIGHT)                # its recess,
    for j in (-1, 0, 1):                                                                       # the cartridges in it,
        cu, cv = bu + nu * 1.1 + j * 0.13 * tu, bv + nv * 1.1 + j * 0.13 * tv
        k.cyl(cu, cv, Z0 + 0.12, 0.055, 0.3, "podGM", top="podGM", sides=10)
        k.cyl(cu, cv, Z0 + 0.42, 0.055, 0.025, "podGL", top="podGL", sides=10)
        k.cyl(cu, cv, Z0 + 0.445, 0.055, 0.1, "arcGlass", top="arcGlass", sides=10)
        k.cyl(cu, cv, Z0 + 0.08, 0.065, 0.05, "arcChrD", top="arcChr", sides=10)
        k.cyl(cu, cv, Z0 + 0.54, 0.065, 0.05, "arcChrD", top="arcChr", sides=10)
    lamp(k, bu + nu * 1.08 - tu * 0.11, bv + nv * 1.08 - tv * 0.11, 1.22, "podGL", 0.06)
    lamp(k, bu + nu * 1.08 + tu * 0.11, bv + nv * 1.08 + tv * 0.11, 1.22, "arcAmb", 0.06)
    k.cyl(bu, bv, 1.32, 0.2, 0.02, "arcBodyK", top="arcBodyK", sides=16)                     # the fan on top,
    for j in range(3):
        k.box(bu, bv, 1.34, 0.34, 0.03, 0.012, "arcChrD", top="arcChr", rz=j * math.pi / 3)
    k.cyl(bu, bv, 1.34, 0.05, 0.03, "podGL", top="podGL", sides=10)
    ru, rv = at(RIGHT - 0.3, 0.92)                                                             # the riser: tower ->
    vpipe(k, ru, rv, 1.32, Z1 + 0.02, r=0.08)                                                  # the cap's shoulder
    k.cyl(0.0, 0.0, Z1, RH + 0.04, 0.22, "arcShell", top="arcShellL", sides=8)               # the octagonal cap,
    slab(k, RIGHT - 0.12, 0.4, 0.92, 0.42, Z1, 0.22, "arcShell", "arcShellL")                  # its shoulder,
    k.cyl(0.0, 0.0, Z1 + 0.22, RH - 0.16, 0.12, "arcBodyD", top="arcBody", sides=8)
    k.cyl(0.0, 0.0, Z1 + 0.07, RH + 0.045, 0.03, "podGL", top="podGL", sides=8)
    slab(k, RIGHT - 0.12, 0.4, 0.92, 0.432, Z1 + 0.07, 0.03, "podGL", "podGL")
    k.box(*at(FRONT, 0.6), Z1 + 0.34, 0.34, 0.34, 0.02, "arcChrD", top="arcChr", rz=FRONT)
    for i, c in enumerate(("podGL", "arcAmb", "podGL")):
        lamp(k, *at(FRONT + (i - 1) * 0.28, RH + 0.05), Z1 + 0.12, c, 0.05)
    return k.build()


def jobs():
    out = []
    for v, f in (("z1", z1), ("z2", z2), ("z3", z3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
