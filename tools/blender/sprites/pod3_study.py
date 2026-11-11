"""Recovery pod look study round 3 (family `pod`, preview only): 2x2, upright, a tank big enough that the patient
floats in the middle of it with fluid all round. Layers as round 1 (pod_study.py): the pod whole, `.glass` (the fluid,
drawn translucent over the patient), `.front` (the parts in front of the patient).

  r1 egg: a tall smooth egg of amber fluid in a white shell cradle that wraps its back, a halo lamp over it, a lit
     seat under it, a step in front
  r2 dais: a glass cylinder of green fluid on a round stepped dais, a heavy crown over it with hoses to two side units
  r3 hex: a hexagonal tank of blue fluid in a dark frame, two jointed tending arms reaching to it from the back

Units: world (1 = a tile), z in world units. Local u, v in [-1, 1]; the tank stands at the centre."""
import math

from .research_kit import Bench, bar

FP2 = (2, 2)


def lathe(k, u, v, prof, col, top=None, sides=24):
    """A smooth upright solid of revolution: prof is [(z, r), ...] bottom to top."""
    for (z0, r0), (z1, r1) in zip(prof, prof[1:]):
        k.cyl(u, v, z0, r0, z1 - z0, col, top=top or col, sides=sides, rtop=r1)


EGG = [(0.36 + 2.32 * t, 0.56 * math.sin(math.pi * (0.06 + 0.88 * t)) * (1.06 - 0.12 * t))
       for t in [i / 14 for i in range(15)]]


def r1(layer="all"):
    k = Bench(f"pod_r1_{layer}", FP2)
    if layer in ("all", "glass"):
        lathe(k, 0.0, 0.0, EGG, "podA", top="podAL")                                        # the egg (fluid)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.8, 0.18, "arcShell", top="arcShellL", sides=28)             # the plinth,
        k.cyl(0.0, 0.0, 0.18, 0.4, 0.2, "arcBodyD", top="podAL", sides=24)                 # the lit seat,
        k.box(0.0, -0.66, 0.0, 1.2, 0.26, 2.5, "arcShell", top="arcShellL", taper=0.75)    # the cradle's back,
        for z in (0.6, 1.2, 1.8):
            k.box(0.0, -0.528, z, 0.7, 0.004, 0.02, "podAL")                               # its lit seams,
        for s_ in (-1, 1):                                                                  # its wings round the egg
            k.box(s_ * 0.6, -0.36, 0.0, 0.18, 0.56, 1.9, "arcShell", top="arcShellL", rz=s_ * 0.7, taper=0.8)
            k.box(s_ * 0.56, -0.26, 0.4, 0.004, 0.3, 1.1, "podAL", rz=s_ * 0.7)
        bar(k, (0.0, -0.62, 2.5), (0.0, -0.62, 2.86), 0.08, "arcShell")                     # the halo's arm,
        bar(k, (0.0, -0.62, 2.84), (0.0, -0.1, 2.86), 0.07, "arcShell")
        k.cyl(0.0, 0.0, 2.84, 0.42, 0.05, "arcShell", top="arcShellL", sides=24)             # the halo,
        k.cyl(0.0, 0.0, 2.82, 0.36, 0.02, "podAL", top="podAL", sides=24)
    k.box(0.0, 0.7, 0.0, 0.6, 0.24, 0.1, "arcShellD", top="arcShellL")                     # the step
    k.box(0.0, 0.822, 0.03, 0.4, 0.004, 0.02, "podAL")
    return k.build()


def r2(layer="all"):
    k = Bench(f"pod_r2_{layer}", FP2)
    R, z0, z1 = 0.5, 0.42, 2.36
    if layer in ("all", "glass"):
        k.cyl(0.0, 0.0, z0, R, z1 - z0, "podG", top="podGL", sides=28)                      # the fluid
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.9, 0.14, "arcBodyD", top="arcBody", sides=28)               # the dais,
        k.cyl(0.0, 0.0, 0.14, 0.74, 0.14, "arcBodyD", top="arcBody", sides=28)
        k.cyl(0.0, 0.0, 0.28, 0.6, 0.14, "arcShell", top="arcShellL", sides=28)
        k.cyl(0.0, 0.0, 0.4, 0.56, 0.03, "podGL", top="podGL", sides=28)                   # its lit ring,
        for s_ in (-1, 1):                                                                  # the side units,
            k.box(s_ * 0.8, -0.5, 0.0, 0.32, 0.42, 1.0, "arcBodyD", top="arcBody")
            k.box(s_ * 0.8, -0.288, 0.5, 0.2, 0.004, 0.3, "podGL")
            bar(k, (s_ * 0.3, -0.25, z1 + 0.3), (s_ * 0.8, -0.5, 1.0), 0.09, "arcBodyK")   # hoses down to them
        for a in (0.4, 2.0, 3.6, 5.2):                                                      # the back struts
            if math.sin(a) < 0.3:
                bar(k, (0.54 * math.cos(a), 0.54 * math.sin(a), z0), (0.54 * math.cos(a), 0.54 * math.sin(a), z1),
                    0.05, "arcChrD")
    for a in (0.95, 2.2):                                                                  # the front struts,
        bar(k, (0.54 * math.cos(a), 0.54 * math.sin(a), z0), (0.54 * math.cos(a), 0.54 * math.sin(a), z1), 0.05,
            "arcChr")
    k.cyl(0.0, 0.0, z1, 0.62, 0.14, "arcBodyD", top="arcBody", sides=28)                    # the crown,
    k.cyl(0.0, 0.0, z1 + 0.14, 0.46, 0.18, "arcShell", top="arcShellL", sides=28)
    k.cyl(0.0, 0.0, z1 - 0.03, 0.56, 0.03, "podGL", top="podGL", sides=28)
    return k.build()


def r3(layer="all"):
    k = Bench(f"pod_r3_{layer}", FP2)
    R, z0, z1 = 0.54, 0.3, 2.3
    if layer in ("all", "glass"):
        k.cyl(0.0, 0.0, z0, R, z1 - z0, "podB", top="podBL", sides=6)                       # the fluid (hex)
    if layer == "glass":
        return k.build()
    corners = [(R * 1.04 * math.cos(i * math.pi / 3), R * 1.04 * math.sin(i * math.pi / 3)) for i in range(6)]
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.84, 0.3, "arcBodyD", top="arcBody", sides=6)               # the base,
        for i in range(6):
            a = i * math.pi / 3 + math.pi / 6
            k.box(0.84 * math.cos(a) * 0.87, 0.84 * math.sin(a) * 0.87, 0.1, 0.24, 0.02, 0.06, "arcAmb", rz=a + math.pi / 2)
        for s_ in (-1, 1):                                                                  # the tending arms:
            b = (s_ * 0.7, -0.7, 0.0)
            k.cyl(b[0], b[1], 0.0, 0.16, 0.9, "arcShell", top="arcShellL", sides=12)        # their towers,
            j1, j2 = (s_ * 0.74, -0.6, 1.6), (s_ * 0.6, -0.1, 1.9)
            bar(k, (b[0], b[1], 0.9), j1, 0.1, "arcShellL")
            k.cyl(j1[0], j1[1], j1[2] - 0.06, 0.08, 0.12, "podBL", top="podBL", sides=10)  # lit joints,
            bar(k, j1, j2, 0.08, "arcShellL")
            k.box(j2[0], j2[1], j2[2] - 0.12, 0.1, 0.1, 0.14, "arcChrD", top="arcChr")      # their heads
        for (u, v) in corners:
            if v < 0.1:
                bar(k, (u, v, z0), (u, v, z1), 0.07, "arcBodyD")                              # the back posts
    for (u, v) in corners:                                                                  # the front posts,
        if v >= 0.1:
            bar(k, (u, v, z0), (u, v, z1), 0.07, "arcBodyD")
            k.box(u, v + 0.036, z0 + 0.3, 0.02, 0.004, z1 - z0 - 0.6, "podBL")
    k.cyl(0.0, 0.0, z1, 0.64, 0.16, "arcBodyD", top="arcBody", sides=6)                    # the cap,
    k.cyl(0.0, 0.0, z1 + 0.16, 0.36, 0.12, "arcChrD", top="arcChr", sides=6)
    return k.build()


def jobs():
    out = []
    for v, f in (("r1", r1), ("r2", r2), ("r3", r3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
