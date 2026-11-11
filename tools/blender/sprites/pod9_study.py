"""Recovery pod look study round 9 (family `pod`, preview only): round 8's w1 and w3 refined after review, and a new
candidate in place of w2.

  - the patient floats: the tank is taller (fluid to 2.72) so there is fluid under the feet and over the head; a
    breathing mask with a hose up into the top housing (drawn in the fluid's colour, so it reads as submerged)
  - the fluid has more range: a lit floor, a mid green, darker at the top under the meniscus, a brighter core (the
    backlight) behind the patient; its light spills onto the plinth
  - the riser is tied to the pod: clamped to the base and top housings, an elbow into a round inlet
  - the filters glow less than the patient (lit only at their fill line)
  - the readout is built into the plinth / platform as a raised sloped section, not a box beside it

  x1 plinth (w1 refined)   x2 spine (new): a heavy frame up the right side carries the plumbing, the readouts and
  the top housing, which hangs from its arm   x3 octagon (w3 refined)

Layers as round 1 (pod_study.py). Units: world (1 = a tile), z in world units."""
import math

from .pod4_study import FRONT, faces_front, lathe
from .pod8_study import at, lamp, pump, run, screen, vpipe
from .research_kit import Bench, bar

FP2 = (2, 2)
R, Z0, ZM, Z1 = 0.48, 0.44, 2.72, 2.82
RIGHT, LEFT = -math.pi / 4, 3 * math.pi / 4
GREEN = ("podGL", "podGM", "podG", "podGD")
BLUE = ("podBL", "podB", "podB", "podBD")


def tank(k, layer, cols=GREEN):
    """The fluid (lit floor, mid, darker top, a dark band under the lit meniscus), bubbles, the backlight core, the
    air gap; in front: the mask and its hose."""
    lit, mid, top, dark = cols
    if layer in ("all", "glass"):
        bands = ((Z0, Z0 + 0.12, lit), (Z0 + 0.12, 1.9, mid), (1.9, ZM - 0.1, top), (ZM - 0.1, ZM, dark))
        for za, zb, c in bands:
            k.cyl(0.0, 0.0, za, R, zb - za, c, top=c, sides=28)
        k.cyl(0.0, 0.0, ZM, R, 0.014, lit, top=lit, sides=28)
        for i in range(7):
            a = FRONT + (i - 3) * 0.5
            if faces_front(a, math.pi / 3) == (layer == "glass"):
                r = R * (0.6 + 0.08 * (i % 3))
                k.box(r * math.cos(a), r * math.sin(a), Z0 + 0.3 + ((i * 0.41) % 1.0) * (ZM - Z0 - 0.5), 0.05, 0.05,
                      0.05, "arcShellL")
    if layer == "all":
        u, v = at(FRONT + math.pi, R - 0.05)                                                 # the backlight core
        k.box(u, v, Z0 + 0.2, 0.46, 0.03, ZM - Z0 - 0.5, lit, rz=-FRONT)
        k.cyl(0.0, 0.0, ZM, R, Z1 - ZM, "arcGlass", top="arcGlass", sides=28)               # the air gap
    if layer == "front":                                                                      # the mask, the hose
        mu, mv, mz = -0.02, 0.14, 2.17
        k.box(mu, mv, mz, 0.1, 0.06, 0.08, dark, top=top)
        bar(k, (mu, mv, mz + 0.06), (0.08, 0.12, 2.5), 0.035, dark)
        bar(k, (0.08, 0.12, 2.5), (0.12, 0.0, ZM), 0.035, dark)


def filt(k, u, v, z, h=0.8, r=0.17, cols=GREEN):
    """A glass filter: sediment, fluid (mid, not lit) up to a lit fill line, glass over it, chrome caps."""
    lit, mid, _, dark = cols
    k.cyl(u, v, z, r + 0.03, 0.07, "arcChrD", top="arcChr", sides=16)
    k.cyl(u, v, z + 0.07, r, 0.12, dark, top=dark, sides=16)
    k.cyl(u, v, z + 0.19, r, h * 0.55, mid, top=mid, sides=16)
    k.cyl(u, v, z + 0.19 + h * 0.55, r, 0.03, lit, top=lit, sides=16)
    k.cyl(u, v, z + 0.22 + h * 0.55, r, h * 0.22, "arcGlass", top="arcGlass", sides=16)
    k.cyl(u, v, z + 0.2 + h * 0.8, r + 0.03, 0.08, "arcChrD", top="arcChr", sides=16)


def clamp(k, a, r0, r1, z, col="arcChrD"):
    """A clamp from a housing (radius r0) out to the riser (radius r1) at angle a."""
    bar(k, (*at(a, r0), z), (*at(a, r1), z), 0.07, col)
    k.cyl(*at(a, r1), z - 0.06, 0.1, 0.12, "arcChr", top="arcChrL", sides=12)


def riser(k, a, r, z0):
    """The riser from z0 up to the top housing: clamped to it, an elbow into a round inlet on its side."""
    u, v = at(a, r)
    vpipe(k, u, v, z0, Z1 + 0.14, r=0.075)
    clamp(k, a, 0.62, r, Z1 - 0.16)
    run(k, [(u, v, Z1 + 0.1), (u, v, Z1 + 0.22), (*at(a, 0.66), Z1 + 0.22)], r=0.07)
    k.cyl(*at(a, 0.64), Z1 + 0.14, 0.11, 0.16, "arcBodyD", top="arcBody", sides=12)          # the inlet,
    lamp(k, *at(a + 0.18, 0.7), Z1 + 0.26, "podGL", 0.045)


def plinth_console(k, a, r, z, glow="podGL", body="arcBodyD", top="arcBody", h=0.24):
    """A raised sloped section of the plinth at angle a facing the camera, a bar-graph screen on its slope."""
    u, v = at(a, r)
    k.box(u, v, z, 0.44, 0.34, h, body, top=top, rz=-math.pi / 4)
    k.box(u, v, z + h, 0.46, 0.2, 0.012, "arcChrD", top="arcChr", rz=-math.pi / 4)
    su, sv = u + 0.07, v + 0.07
    screen(k, su, sv, z + h - 0.1, 0.36, 0.2, FRONT, glow=glow, beat=False, levels=(0.45, 0.8, 0.6, 0.95, 0.7))
    lamp(k, *at(a - 0.12, r - 0.06), z + h + 0.012, "arcAmb", 0.05)
    lamp(k, *at(a + 0.12, r - 0.06), z + h + 0.012, "podGL", 0.05)


def spill(k, r0, r1, z, col):
    """The tank's light on the deck round it: a lit ring, then an unlit tint."""
    k.cyl(0.0, 0.0, z, r0, 0.012, col[0], top=col[0], sides=28)
    k.cyl(0.0, 0.0, z, r1, 0.008, col[1], top=col[1], sides=28)


def x1(layer="all"):
    """Plinth (w1 refined)."""
    k = Bench(f"pod_x1_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.97, 0.07, "arcBodyD", top="arcBody", sides=32)              # the plinth,
        k.cyl(0.0, 0.0, 0.07, 0.88, 0.06, "arcBodyD", top="arcBody", sides=32)
        k.cyl(0.0, 0.0, 0.065, 0.975, 0.01, "arcChrD", top="arcChr", sides=32)              # a chrome lip,
        spill(k, 0.7, 0.82, 0.13, ("podGL", "podG"))                                         # the tank's light on it,
        lathe(k, 0.0, 0.0, [(0.13, 0.64), (0.36, 0.64), (0.44, 0.54)], "arcBodyD", top="arcBody", sides=28)
        k.cyl(0.0, 0.0, 0.42, 0.52, 0.03, "podGL", top="podGL", sides=28)
        fu, fv = at(RIGHT - 0.3, 0.76)                                                       # the filter (behind),
        k.cyl(fu, fv, 0.13, 0.22, 0.3, "arcBodyD", top="arcBody", sides=16)
        filt(k, fu, fv, 0.43, h=0.9, r=0.18)
        pu, pv = at(RIGHT + 0.3, 0.74)                                                       # the pump (in front),
        pump(k, pu, pv, 0.13, h=0.6, r=0.25)
        run(k, [(pu, pv, 0.83), (pu, pv, 0.95), (fu, fv, 0.95)], r=0.055)                     # pump -> filter,
        run(k, [(pu * 0.75, pv * 0.75, 0.3), (*at(RIGHT + 0.3, 0.6), 0.3)], r=0.055)          # base -> pump,
        riser(k, RIGHT - 0.3, 0.76, 1.52)                                                     # filter -> the top
        plinth_console(k, LEFT + 0.1, 0.72, 0.13)                                            # the console (left)
    lathe(k, 0.0, 0.0, [(Z1, 0.56), (Z1 + 0.06, 0.64), (Z1 + 0.2, 0.64), (Z1 + 0.3, 0.54), (Z1 + 0.38, 0.3)],
          "arcShellD", top="arcShell", sides=28)                                              # the dome (not white),
    k.cyl(0.0, 0.0, Z1 + 0.08, 0.645, 0.1, "arcBodyD", top="arcBodyD", sides=28)            # its vent band,
    for i in range(6):
        a = FRONT + (i - 2.5) * 0.36
        k.box(*at(a, 0.648), Z1 + 0.11, 0.13, 0.008, 0.04, "podGL", rz=a + math.pi / 2)
    k.cyl(0.0, 0.0, Z1 + 0.38, 0.16, 0.08, "arcChrD", top="arcChr", sides=14)
    screen(k, *at(FRONT, 0.66), 0.13, 0.44, 0.22, FRONT)                                     # the heartbeat screen
    return k.build()


def x2(layer="all"):
    """Spine (new): a heavy frame up the right side; the top housing hangs from its arm; the plumbing, readouts and
    status lights are on its face; blue fluid."""
    k = Bench(f"pod_x2_{layer}", FP2)
    tank(k, layer, BLUE)
    if layer == "glass":
        return k.build()
    su, sv = at(RIGHT, 0.78)
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.84, 0.1, "arcBodyD", top="arcBody", sides=32)               # the plinth,
        k.cyl(0.0, 0.0, 0.095, 0.845, 0.01, "arcChrD", top="arcChr", sides=32)
        spill(k, 0.66, 0.78, 0.1, ("podBL", "podB"))
        lathe(k, 0.0, 0.0, [(0.1, 0.62), (0.36, 0.62), (0.44, 0.54)], "arcShell", top="arcShellL", sides=28)
        k.cyl(0.0, 0.0, 0.42, 0.52, 0.03, "podBL", top="podBL", sides=28)
        k.box(su, sv, 0.0, 0.42, 0.5, Z1 + 0.4, "arcShell", top="arcShell", rz=RIGHT)       # the spine,
        k.box(su, sv, 0.0, 0.46, 0.54, 0.16, "arcBodyD", top="arcBody", rz=RIGHT)           # its foot,
        au, av = at(RIGHT, 0.4)                                                              # its arm over the top,
        k.box(au, av, Z1 + 0.4, 0.86, 0.36, 0.14, "arcShell", top="arcShell", rz=RIGHT)
        k.box(au, av, Z1 + 0.54, 0.7, 0.2, 0.04, "arcBodyD", top="arcBody", rz=RIGHT)
    fu, fv = su + 0.256 * math.cos(FRONT), sv + 0.256 * math.sin(FRONT)                      # the spine's face (to
    tu, tv = math.cos(RIGHT), math.sin(RIGHT)                                                 # the camera)
    if layer == "all":
        k.box(fu, fv, 0.3, 0.3, 0.02, 2.3, "arcBodyD", rz=RIGHT)                              # a dark channel,
        for i in range(2):                                                                     # two hoses in it
            d = (i - 0.5) * 0.12
            bar(k, (fu + d * tu + 0.03, fv + d * tv + 0.03, 0.34), (fu + d * tu + 0.03, fv + d * tv + 0.03, 2.5),
                0.07, "arcChr")
        for z in (0.7, 1.5, 2.3):                                                              # clamps over them
            k.box(fu + 0.05, fv + 0.05, z, 0.32, 0.04, 0.08, "arcBodyD", top="arcBody", rz=RIGHT)
        gu, gv = fu - 0.5 * tu * 0.0 + 0.06, fv + 0.06                                       # a level gauge,
        k.box(gu, gv, 1.0, 0.26, 0.03, 0.4, "arcBodyK", top="arcBodyD", rz=RIGHT)
        for i in range(6):
            k.box(gu + 0.018, gv + 0.018, 1.04 + i * 0.055, 0.18, 0.004, 0.035,
                  "podBL" if i < 4 else "arcBodyD", rz=RIGHT)
        for i, c in enumerate(("podBL", "podBL", "arcAmb")):                                  # status lights
            lamp(k, fu + (i - 1) * 0.09 * tu + 0.05, fv + (i - 1) * 0.09 * tv + 0.05, 2.62, c, 0.06)
        for s_ in (-1, 1):                                                                     # hoses into the housings
            run(k, [(su - 0.1 * tu, sv - 0.1 * tv + s_ * 0.0, 0.3 if s_ < 0 else 2.0),
                    (*at(RIGHT, 0.6), 0.3 if s_ < 0 else Z1 - 0.1)], r=0.05)
        k.box(su + 0.2 * math.cos(RIGHT), sv + 0.2 * math.sin(RIGHT), 0.6, 0.02, 0.3, 0.9, "arcBodyD", rz=RIGHT)
        for i in range(6):                                                                     # vents on its side
            k.box(su + 0.212 * math.cos(RIGHT), sv + 0.212 * math.sin(RIGHT), 0.7 + i * 0.12, 0.006, 0.24, 0.04,
                  "arcBodyK", rz=RIGHT)
    lathe(k, 0.0, 0.0, [(Z1, 0.58), (Z1 + 0.05, 0.64), (Z1 + 0.32, 0.64), (Z1 + 0.4, 0.5)], "arcShellD",
          top="arcShell", sides=28)                                                          # the top housing,
    k.cyl(0.0, 0.0, Z1 + 0.12, 0.645, 0.04, "podBL", top="podBL", sides=28)
    screen(k, *at(FRONT, 0.66), 0.13, 0.44, 0.22, FRONT, glow="podBL")                       # the heartbeat screen
    k.box(*at(LEFT, 0.7), 0.0, 0.3, 0.3, 0.1, "arcBodyD", top="arcBody", rz=-math.pi / 4)   # a step (left)
    return k.build()


def x3(layer="all"):
    """Octagon (w3 refined)."""
    k = Bench(f"pod_x3_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.98, 0.16, "arcBodyD", top="arcBody", sides=8)
        k.cyl(0.0, 0.0, 0.16, 0.86, 0.03, "arcChrD", top="arcChr", sides=8)
        spill(k, 0.68, 0.8, 0.19, ("podGL", "podG"))
        lathe(k, 0.0, 0.0, [(0.19, 0.62), (0.36, 0.62), (0.44, 0.52)], "arcShell", top="arcShellL", sides=8)
        k.cyl(0.0, 0.0, 0.42, 0.5, 0.03, "podGL", top="podGL", sides=28)
        bu, bv = at(RIGHT, 0.66)                                                             # the machinery block,
        k.box(bu, bv, 0.19, 0.5, 0.56, 0.9, "arcShell", top="arcShellL", rz=RIGHT)
        nu, nv = at(FRONT, 0.282)
        k.box(bu + nu, bv + nv, 0.28, 0.4, 0.012, 0.6, "arcBodyK", rz=RIGHT)
        tu, tv = math.cos(RIGHT), math.sin(RIGHT)
        for j in (-1, 0, 1):                                                                 # the cartridges (mid,
            cu, cv = bu + nu * 1.12 + j * 0.12 * tu, bv + nv * 1.12 + j * 0.12 * tv          # a lit fill line)
            k.cyl(cu, cv, 0.34, 0.05, 0.3, "podGM", top="podGM", sides=10)
            k.cyl(cu, cv, 0.64, 0.05, 0.025, "podGL", top="podGL", sides=10)
            k.cyl(cu, cv, 0.665, 0.05, 0.1, "arcGlass", top="arcGlass", sides=10)
            k.cyl(cu, cv, 0.3, 0.06, 0.05, "arcChrD", top="arcChr", sides=10)
            k.cyl(cu, cv, 0.76, 0.06, 0.05, "arcChrD", top="arcChr", sides=10)
        lamp(k, bu + nu * 1.1 - tu * 0.1, bv + nv * 1.1 - tv * 0.1, 0.96, "podGL", 0.06)
        lamp(k, bu + nu * 1.1 + tu * 0.1, bv + nv * 1.1 + tv * 0.1, 0.96, "arcAmb", 0.06)
        k.cyl(bu, bv, 1.09, 0.17, 0.02, "arcBodyK", top="arcBodyK", sides=16)               # the fan on top,
        for j in range(3):
            k.box(bu, bv, 1.11, 0.3, 0.03, 0.012, "arcChrD", top="arcChr", rz=j * math.pi / 3)
        k.cyl(bu, bv, 1.11, 0.05, 0.03, "podGL", top="podGL", sides=10)
        riser(k, RIGHT - 0.3, 0.78, 1.09)
        plinth_console(k, LEFT + 0.1, 0.74, 0.19, body="arcShell", top="arcShellL", h=0.22)
    k.cyl(0.0, 0.0, Z1, 0.66, 0.2, "arcShell", top="arcShellL", sides=8)                    # the octagonal cap,
    k.cyl(0.0, 0.0, Z1 + 0.2, 0.5, 0.12, "arcBodyD", top="arcBody", sides=8)
    k.cyl(0.0, 0.0, Z1 + 0.06, 0.665, 0.03, "podGL", top="podGL", sides=8)
    k.box(*at(FRONT, 0.6), Z1 + 0.32, 0.3, 0.3, 0.02, "arcChrD", top="arcChr", rz=FRONT)
    for i, c in enumerate(("podGL", "arcAmb", "podGL")):
        lamp(k, *at(FRONT + (i - 1) * 0.3, 0.668), Z1 + 0.11, c, 0.05)
    screen(k, *at(FRONT, 0.7), 0.04, 0.42, 0.13, FRONT)
    return k.build()


def jobs():
    out = []
    for v, f in (("x1", x1), ("x2", x2), ("x3", x3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
