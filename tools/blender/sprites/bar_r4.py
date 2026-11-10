"""Bar look study round 4 (family `bar`, preview only; see bar_study.py for the frame): three more bodies in the
spirit of b6, lit liquid as the bar's light source.

  b10 halo globes: an arch over the back bar holds floating globes of lit liquor; a spider robot hangs from its crown,
      two arms at the globes, two at the counter
  b11 layer reactor: a mixology lab, a tall glass column of layered lit liquor wound with a pipe, flask shelves either
      side; a lab robot whose head is a glass jar of glowing green
  b12 aquarium: the back bar is a lit water tank with fish and bubbles, bottles silhouetted on a shelf before it; a
      brass diving-helmet robot

Units: world (1 = a tile), z in world units (the seat top 0.39, the counter top 0.62)."""
import math

from .bar_study import BOTTLES, FP3, TOP, counter, stools
from .research_kit import Bench, bar


def ball(k, u, v, z, r, col, sides=12):
    """A ball of three cones about (u, v, z)."""
    k.cyl(u, v, z - r, r * 0.45, r * 0.45, col, top=col, sides=sides, rtop=r * 0.95)
    k.cyl(u, v, z - r * 0.55, r * 0.95, r * 1.1, col, top=col, sides=sides, rtop=r * 0.95)
    k.cyl(u, v, z + r * 0.55, r * 0.95, r * 0.45, col, top=col, sides=sides, rtop=r * 0.45)


def ends(k, body, top):
    for s_ in (-1, 1):
        k.box(s_ * 1.46, -0.07, 0.04, 0.08, 0.84, TOP - 0.06, body, top=top)


def b10():
    """Halo globes: dark and violet; an elliptic arch over a low back bar, five lit globes hung inside it, a spider
    robot at its crown."""
    k = Bench("bar_b10", FP3)
    counter(k, ("arcBody", "arcBodyD"), "arcGlass", "arcChrD", "arcVio")
    k.box(0.0, 0.423, 0.3, 2.7, 0.004, 0.012, "arcVio")                                  # a lit line on the front
    k.box(0.0, -0.4, 0.04, 2.9, 0.16, 0.36, "arcBodyD", top="arcBody")                   # the low back bar,
    for i in range(10):
        k.box(-1.2 + i * 0.27, -0.33, 0.4, 0.05, 0.05, 0.12, BOTTLES[i % 5], top=BOTTLES[i % 5])
    cv, cz, ru, rz = -0.4, 0.4, 1.36, 1.0                                                # the arch:
    pts = [(ru * math.cos(i * math.pi / 14), cz + rz * math.sin(i * math.pi / 14)) for i in range(15)]
    for (u0, z0), (u1, z1) in zip(pts, pts[1:]):
        bar(k, (u0, cv, z0), (u1, cv, z1), 0.09, "arcChrD")
        bar(k, (u0 * 0.95, cv + 0.05, cz + (z0 - cz) * 0.95), (u1 * 0.95, cv + 0.05, cz + (z1 - cz) * 0.95),
            0.025, "arcVio")                                                             # its lit inner edge
    for i, a in enumerate((0.42, 0.95, 2.19, 2.72)):                                     # the globes, on threads
        u, z = ru * math.cos(a), cz + rz * math.sin(a)
        gu, gz = u * 0.72, cz + (z - cz) * 0.62
        bar(k, (u * 0.95, cv, z - 0.04), (gu, cv + 0.08, gz + 0.12), 0.015, "arcChr")
        ball(k, gu, cv + 0.08, gz, 0.13, BOTTLES[(i * 2) % 5])
        k.cyl(gu, cv + 0.08, gz - 0.02, 0.15, 0.015, "arcChr", top="arcChrL", sides=14)   # a band round it
    bar(k, (0.0, cv, cz + rz), (0.0, -0.12, 1.24), 0.04, "arcChrD")                     # the robot: its hanger,
    ball(k, 0.0, -0.12, 1.1, 0.15, "arcBodyL", sides=14)                                 # its body,
    k.cyl(0.0, -0.12, 1.08, 0.17, 0.03, "arcVio", top="arcVio", sides=16)               # its lit band,
    k.box(0.0, 0.02, 1.12, 0.09, 0.006, 0.03, "arcCyan")                                  # its eye,
    for s_ in (-1, 1):                                                                    # its legs: two up to a globe,
        knee = (s_ * 0.36, -0.12, 1.25)
        bar(k, (s_ * 0.1, -0.12, 1.14), knee, 0.035, "arcChrD")
        bar(k, knee, (s_ * 0.6, -0.26, 1.05), 0.03, "arcChrD")
        elbow = (s_ * 0.3, 0.02, 1.0)                                                    # two down to the counter
        bar(k, (s_ * 0.1, -0.06, 1.04), elbow, 0.035, "arcChrD")
        bar(k, elbow, (s_ * 0.24, 0.24, 0.8), 0.03, "arcChrD")
    k.box(-0.24, 0.25, 0.68, 0.06, 0.06, 0.12, "arcChr", top="arcVio")                  # a shaker,
    k.cyl(0.24, 0.26, TOP, 0.05, 0.12, "arcGlass", top="arcPink", sides=8)               # a glass
    ends(k, "arcBodyD", "arcBody")
    stools(k, "arcChrD", "arcVio")
    return k.build()


def b11():
    """Layer reactor: white and teal, green light; a tall column of layered lit liquor wound with a chrome pipe, flask
    shelves either side, a jar-headed lab robot pouring."""
    k = Bench("bar_b11", FP3)
    counter(k, ("arcShellL", "arcShell"), "arcShellL", "arcChrD", "arcGrn")
    for i in range(7):                                                                    # lit ports on the front
        k.box(-1.2 + i * 0.4, 0.423, 0.24, 0.1, 0.004, 0.1, "arcGrn")
    cu, cv = 0.35, -0.3                                                                   # the column:
    k.cyl(cu, cv, 0.04, 0.3, 0.12, "arcChrD", top="arcChr", sides=16)
    for i, col in enumerate(("arcVio", "arcPink", "arcRed", "arcAmb", "arcGrn", "arcCyan")):
        k.cyl(cu, cv, 0.16 + i * 0.15, 0.22, 0.15, col, top=col, sides=16)                # its layers (lit),
    k.cyl(cu, cv, 1.06, 0.22, 0.2, "arcGlass", top="arcGlass", sides=16)               # the glass over them,
    k.cyl(cu, cv, 1.26, 0.28, 0.1, "arcChrD", top="arcChr", sides=16)                   # its cap,
    k.cyl(cu, cv, 1.36, 0.06, 0.1, "arcChr", top="arcGrn", sides=10)
    pts = [(cu + 0.27 * math.cos(t * 0.5), cv + 0.27 * math.sin(t * 0.5), 0.2 + t * 0.045) for t in range(24)]
    for p0, p1 in zip(pts, pts[1:]):                                                      # the pipe winding up it
        bar(k, p0, p1, 0.035, "arcChrL")
    for s_ in (-1, 1):                                                                    # the flask shelves
        su = s_ * 1.05
        k.box(su, -0.4, 0.04, 0.7, 0.14, 0.94, "arcShell", top="arcShellL")
        for j, z in enumerate((0.36, 0.7)):
            k.box(su, -0.3, z, 0.66, 0.08, 0.02, "arcChrD", top="arcChr")
            for i in range(3):
                col = BOTTLES[(i + j * 2 + (s_ > 0) * 3) % 5]
                fu = su - 0.2 + i * 0.2
                if (i + j) % 2:
                    ball(k, fu, -0.3, z + 0.1, 0.07, col, sides=10)                       # a round flask,
                else:
                    k.cyl(fu, -0.3, z + 0.02, 0.07, 0.12, col, top=col, sides=10, rtop=0.025)   # a conical one
    ru = -0.5                                                                             # the robot:
    k.cyl(ru, -0.12, 0.04, 0.11, 0.48, "arcShell", top="arcShellL", sides=12)           # its column,
    k.box(ru, -0.12, 0.5, 0.3, 0.2, 0.26, "arcShellL", top="arcShellL")                 # its torso,
    k.box(ru, -0.018, 0.62, 0.16, 0.004, 0.012, "arcGrn")                                 # a lit chest bar,
    k.cyl(ru, -0.12, 0.76, 0.1, 0.04, "arcChrD", top="arcChr", sides=12)                # its collar,
    k.cyl(ru, -0.12, 0.8, 0.13, 0.14, "arcGrn", top="arcGrn", sides=14)                 # its jar head: the glow,
    k.cyl(ru, -0.12, 0.94, 0.13, 0.08, "arcGlass", top="arcGlass", sides=14, rtop=0.08)  # the glass over it,
    k.cyl(ru, -0.12, 1.02, 0.08, 0.03, "arcChrD", top="arcChr", sides=12)               # its lid
    bar(k, (ru + 0.15, -0.1, 0.7), (ru + 0.3, 0.1, 0.82), 0.05, "arcShell")              # an arm with a beaker,
    k.cyl(ru + 0.32, 0.12, 0.76, 0.05, 0.12, "arcGlass", top="arcGrn", sides=8, rtop=0.03)
    bar(k, (ru + 0.36, 0.14, 0.78), (ru + 0.42, 0.2, 0.68), 0.015, "arcGrn")             # pouring,
    k.cyl(ru + 0.42, 0.22, TOP, 0.05, 0.12, "arcGlass", top="arcGrn", sides=8)           # into a glass
    bar(k, (ru - 0.15, -0.1, 0.7), (ru - 0.22, 0.12, 0.64), 0.05, "arcShell")
    ends(k, "arcShell", "arcShellL")
    stools(k, "arcChrD", "arcGrn")
    return k.build()


def b12():
    """Aquarium: dark wood and brass; the back bar is a lit water tank with fish and rising bubbles, a shelf of
    bottles silhouetted before it; a brass diving-helmet robot behind the counter."""
    k = Bench("bar_b12", FP3)
    counter(k, ("arcBody", "arcBodyD"), "arcWoodL", "arcGoldD", "arcWater")
    k.box(0.0, 0.43, 0.12, 2.94, 0.03, 0.03, "arcGoldD", top="arcGold")                  # a brass foot rail
    k.box(0.0, -0.42, 0.04, 2.94, 0.18, 0.16, "arcBodyD", top="arcBody")                # the tank: its base,
    k.box(0.0, -0.42, 0.2, 2.8, 0.14, 1.0, "arcWater", top="arcWaterD")                 # the water (lit),
    k.box(0.0, -0.42, 1.2, 2.94, 0.18, 0.08, "arcBodyD", top="arcBody")                 # its lid,
    for s_ in (-1, 1):
        k.box(s_ * 1.43, -0.42, 0.2, 0.08, 0.18, 1.0, "arcGoldD", top="arcGold")         # its brass ends
    for (u, z, s_, col) in ((-1.0, 0.95, 1, "arcOrg"), (-0.3, 1.05, -1, "arcPink"), (0.55, 0.9, 1, "arcAmb"),
                            (1.05, 1.08, -1, "arcOrg"), (-0.75, 0.62, -1, "arcAmb")):   # the fish,
        k.box(u, -0.345, z, 0.16, 0.004, 0.07, col)
        k.box(u - s_ * 0.1, -0.345, z, 0.05, 0.004, 0.09, col)                          # their tails
    for u in (-1.15, -0.55, 0.15, 0.8, 1.25):                                              # bubbles rising
        for j in range(3):
            k.box(u + (j % 2) * 0.03, -0.346, 0.75 + j * 0.15, 0.03, 0.004, 0.03, "arcShellL")
    for i in range(3):                                                                    # weed at the bottom
        k.box(-1.25 + i * 1.2, -0.346, 0.2, 0.06, 0.004, 0.24 + i * 0.06, "arcGrnF")
    k.box(0.0, -0.28, 0.5, 2.8, 0.1, 0.03, "arcGoldD", top="arcGold")                   # the bottle shelf,
    for i in range(12):
        col = BOTTLES[i % 5]
        k.box(-1.3 + i * 0.236, -0.27, 0.53, 0.06, 0.06, 0.14 + (i % 2) * 0.04, "arcBodyK", top=col)
    ru = 0.1                                                                              # the robot:
    k.cyl(ru, -0.12, 0.04, 0.14, 0.44, "arcGoldD", top="arcGold", sides=12)             # its body,
    k.box(ru, -0.12, 0.48, 0.34, 0.22, 0.24, "arcGold", top="arcGoldL")                 # its chest plate,
    ball(k, ru, -0.12, 0.88, 0.2, "arcGold", sides=14)                                   # its helmet,
    k.box(ru, 0.09, 0.88, 0.15, 0.006, 0.12, "arcWater")                                   # its lit window,
    k.box(ru, 0.094, 0.88, 0.17, 0.004, 0.014, "arcGoldD")                                # the window's bars
    for du in (-0.2, 0.2):
        k.cyl(ru + du, -0.12, 0.86, 0.05, 0.05, "arcGoldD", top="arcGold", sides=8)     # its side ports
    bar(k, (ru + 0.17, -0.1, 0.66), (ru + 0.26, 0.14, 0.7), 0.06, "arcGoldD")           # an arm,
    k.box(ru + 0.27, 0.16, 0.64, 0.07, 0.07, 0.14, "arcChr", top="arcWater")            # a shaker,
    bar(k, (ru - 0.17, -0.1, 0.66), (ru - 0.24, 0.14, 0.68), 0.06, "arcGoldD")
    k.cyl(ru - 0.26, 0.18, TOP, 0.05, 0.12, "arcGlass", top="arcAmb", sides=8)
    ends(k, "arcBodyD", "arcBody")
    stools(k, "arcGoldD", "arcWater")
    return k.build()


VARIANTS = (("b10", b10), ("b11", b11), ("b12", b12))
