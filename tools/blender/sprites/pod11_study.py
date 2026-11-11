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


def round_base(k, r, z, h, col, top, lobe_w=0.6, r1=RW, end=True):
    """The round base with a lobe out under the right corner's machinery (to r1: a round end, or square)."""
    k.cyl(0.0, 0.0, z, r, h, col, top=top, sides=40)
    slab(k, RIGHT, 0.4, r1, lobe_w, z, h, col, top, end=end)


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


COL_R0, COL_R1 = 0.5, 0.98                                   # the corner column runs from inside the housings out to here


def column(k, w, z0, z1, col, top):
    """The corner column: one block along RIGHT from inside the housings (COL_R0) to a flat outer face (COL_R1)."""
    k.box(*at(RIGHT, (COL_R0 + COL_R1) / 2), z0, COL_R1 - COL_R0, w, z1 - z0, col, top=top, rz=RIGHT)


def bands(k, w, zs, cols):
    """The housings' bands carried round the column (a hair proud of it): lip, seam."""
    for z, h, c in zip(zs, (0.03, 0.014), cols):
        k.box(*at(RIGHT, (0.7 + COL_R1 + 0.008) / 2), z, COL_R1 + 0.008 - 0.7, w + 0.016, h, c, top=c, rz=RIGHT)


def face(w):
    """The column's face toward the camera: its centre, (along RIGHT), (along FRONT)."""
    c = at(RIGHT, (COL_R0 + COL_R1) / 2 + 0.12)
    return (c[0] + (w / 2 + 0.006) * math.cos(FRONT), c[1] + (w / 2 + 0.006) * math.sin(FRONT)), \
        (math.cos(RIGHT), math.sin(RIGHT)), (math.cos(FRONT), math.sin(FRONT))


def z2(layer="all"):
    """Spine: one column up the right corner, from the base past the top housing, both housings running into it at
    its own width; its arm runs over the top housing to the hub the housing hangs from."""
    k = Bench(f"pod_z2_{layer}", FP2)
    tank(k, layer, BLUE)
    if layer == "glass":
        return k.build()
    W = 0.5
    if layer == "all":
        round_base(k, 0.98, 0.0, 0.12, "arcBodyD", "arcBody", lobe_w=W + 0.12, r1=COL_R1 + 0.06, end=False)
        k.cyl(0.0, 0.0, 0.115, 0.985, 0.012, "arcChrD", top="arcChr", sides=40)
        k.cyl(0.0, 0.0, 0.12, RH, Z0 - 0.2, "arcShellD", top="arcShell", sides=32)          # the base housing,
        k.cyl(0.0, 0.0, Z0 - 0.08, RH - 0.06, 0.08, "arcShellD", top="arcShell", sides=32)
        k.cyl(0.0, 0.0, 0.16, RH + 0.008, 0.03, "arcChrD", top="arcChr", sides=32)
        k.cyl(0.0, 0.0, Z0 - 0.1, RH + 0.006, 0.014, "podBL", top="podBL", sides=32)
        k.cyl(0.0, 0.0, Z0 - 0.02, 0.66, 0.03, "podBL", top="podBL", sides=32)
        ekg(k, RH, 0.2, "podBL")
    k.cyl(0.0, 0.0, Z1, RH, 0.24, "arcShellD", top="arcShell", sides=32)                    # the top housing,
    k.cyl(0.0, 0.0, Z1 + 0.08, RH + 0.006, 0.03, "podBL", top="podBL", sides=32)
    k.cyl(0.0, 0.0, Z1 + 0.24, 0.6, 0.12, "arcShellD", top="arcShell", sides=32)
    z = Z1 + 0.36
    column(k, W, 0.12, z + 0.3, "arcShell", "arcShell")                                      # the spine,
    bands(k, W, (0.16, Z0 - 0.1), ("arcChrD", "podBL"))
    bands(k, W, (Z1 + 0.08 - 0.008, Z1 + 0.08 + 0.008), ("podBL", "podBL"))
    k.box(*at(RIGHT, 0.36), z + 0.02, 0.86, 0.34, 0.14, "arcShellD", top="arcShellD", rz=RIGHT)   # its arm,
    k.cyl(0.0, 0.0, z - 0.02, 0.24, 0.24, "arcShellD", top="arcShell", sides=20)             # the hub (above the arm)
    k.cyl(0.0, 0.0, z + 0.22, 0.12, 0.05, "podBL", top="podBL", sides=14)
    for d in (-0.18, 0.18):
        k.box(*[c + d * f for c, f in zip(at(RIGHT, 0.36), (math.cos(FRONT), math.sin(FRONT)))], z + 0.1, 0.76,
              0.012, 0.02, "podBL", rz=RIGHT)
    (fu, fv), (tu, tv), (nu, nv) = face(W)
    fu, fv = fu - 0.12 * tu, fv - 0.12 * tv                                                   # (the face's centre)
    k.box(fu, fv, Z0 + 0.04, 0.26, 0.02, Z1 - Z0 - 0.12, "arcBodyD", rz=RIGHT)              # a dark channel,
    for i in range(2):                                                                         # two hoses in it,
        d = (i - 0.5) * 0.1
        p = (fu + d * tu + 0.025 * nu, fv + d * tv + 0.025 * nv)
        bar(k, (*p, Z0 + 0.06), (*p, Z1 - 0.1), 0.06, "arcChr")
    for zc in (0.9, 1.7, 2.5):                                                                 # clamps over them,
        k.box(fu + 0.04 * nu, fv + 0.04 * nv, zc, 0.28, 0.04, 0.08, "arcBodyD", top="arcBody", rz=RIGHT)
    k.box(fu + 0.05 * nu, fv + 0.05 * nv, 1.25, 0.22, 0.03, 0.42, "arcBodyK", top="arcBodyD", rz=RIGHT)
    for i in range(6):                                                                         # a level gauge,
        k.box(fu + 0.068 * nu, fv + 0.068 * nv, 1.29 + i * 0.058, 0.15, 0.004, 0.036,
              "podBL" if i < 4 else "arcBodyD", rz=RIGHT)
    for i, c in enumerate(("podBL", "podBL", "arcAmb")):                                      # status lights
        lamp(k, fu + (i - 1) * 0.08 * tu + 0.04 * nu, fv + (i - 1) * 0.08 * tv + 0.04 * nv, Z1 + 0.3, c, 0.055)
    ou, ov = at(RIGHT, COL_R1 + 0.006)                                                          # vents on its outer end
    for i in range(5):
        k.box(ou, ov, 1.0 + i * 0.12, 0.006, 0.3, 0.04, "arcBodyK", rz=RIGHT)
    return k.build()


def z3(layer="all"):
    """Octagon: the cartridge tower is one column up the right corner from the platform; the octagonal cap's shoulder
    sits over it at its own width and line; a riser on its axis joins them."""
    k = Bench(f"pod_z3_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    W = 0.56
    if layer == "all":
        oc = 0.98 / math.cos(math.pi / 8)
        k.cyl(0.0, 0.0, 0.0, oc, 0.16, "arcBodyD", top="arcBody", sides=8)                   # the platform,
        k.cyl(0.0, 0.0, 0.16, oc - 0.1, 0.03, "arcChrD", top="arcChr", sides=8)
        k.cyl(0.0, 0.0, 0.19, RH, Z0 - 0.27, "arcShell", top="arcShellL", sides=8)            # the base housing,
        k.cyl(0.0, 0.0, Z0 - 0.08, RH - 0.06, 0.08, "arcShell", top="arcShellL", sides=8)
        k.cyl(0.0, 0.0, 0.23, RH + 0.008, 0.03, "arcChrD", top="arcChr", sides=8)
        k.cyl(0.0, 0.0, Z0 - 0.1, RH + 0.006, 0.014, "podGL", top="podGL", sides=8)
        k.cyl(0.0, 0.0, Z0 - 0.02, 0.66, 0.03, "podGL", top="podGL", sides=8)
        ekg(k, RH, 0.24, "podGL")
    zt = 1.36                                                                                  # the tower,
    column(k, W, 0.19, zt, "arcShell", "arcShellL")
    bands(k, W, (0.23, Z0 - 0.1), ("arcChrD", "podGL"))
    (fu, fv), (tu, tv), (nu, nv) = face(W)
    fu, fv = fu - 0.12 * tu, fv - 0.12 * tv
    k.box(fu, fv, Z0 + 0.04, 0.4, 0.012, 0.64, "arcBodyK", rz=RIGHT)                         # its recess,
    for j in (-1, 0, 1):                                                                       # the cartridges in it,
        cu, cv = fu + j * 0.12 * tu + 0.06 * nu, fv + j * 0.12 * tv + 0.06 * nv
        k.cyl(cu, cv, Z0 + 0.12, 0.05, 0.3, "podGM", top="podGM", sides=10)
        k.cyl(cu, cv, Z0 + 0.42, 0.05, 0.025, "podGL", top="podGL", sides=10)
        k.cyl(cu, cv, Z0 + 0.445, 0.05, 0.1, "arcGlass", top="arcGlass", sides=10)
        k.cyl(cu, cv, Z0 + 0.08, 0.06, 0.05, "arcChrD", top="arcChr", sides=10)
        k.cyl(cu, cv, Z0 + 0.54, 0.06, 0.05, "arcChrD", top="arcChr", sides=10)
    lamp(k, fu - tu * 0.11 + 0.04 * nu, fv - tv * 0.11 + 0.04 * nv, Z0 + 0.72, "podGL", 0.06)
    lamp(k, fu + tu * 0.11 + 0.04 * nu, fv + tv * 0.11 + 0.04 * nv, Z0 + 0.72, "arcAmb", 0.06)
    xu, xv = at(RIGHT, (COL_R0 + COL_R1) / 2 + 0.1)                                           # the fan on its top,
    k.cyl(xu, xv, zt, 0.19, 0.02, "arcBodyK", top="arcBodyK", sides=16)
    for j in range(3):
        k.box(xu, xv, zt + 0.02, 0.32, 0.03, 0.012, "arcChrD", top="arcChr", rz=j * math.pi / 3)
    k.cyl(xu, xv, zt + 0.02, 0.05, 0.03, "podGL", top="podGL", sides=10)
    vpipe(k, xu, xv, zt + 0.04, Z1 + 0.02, r=0.08)                                            # the riser on its axis
    k.cyl(0.0, 0.0, Z1, RH + 0.04, 0.22, "arcShell", top="arcShellL", sides=8)               # the octagonal cap,
    column(k, W, Z1, Z1 + 0.22, "arcShell", "arcShellL")                                      # its shoulder,
    k.cyl(0.0, 0.0, Z1 + 0.22, RH - 0.16, 0.12, "arcBodyD", top="arcBody", sides=8)
    k.cyl(0.0, 0.0, Z1 + 0.07, RH + 0.045, 0.03, "podGL", top="podGL", sides=8)
    bands(k, W, (Z1 + 0.07 - 0.008, Z1 + 0.07 + 0.008), ("podGL", "podGL"))
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
