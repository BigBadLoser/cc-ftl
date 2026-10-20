"""Hydroponics bay (family `hydroponics`): 2x1, `.grow0` .. `.grow3`, each also `.active` (grow lights on), four
rotations. Local frame and placement: modkit.K (front = +v).

A trough on legs with a reservoir under it and two rows of net cups set in a soil bed. grow0: seed plugs; grow1:
sprouts; grow2: leafy clumps; grow3: full plants, some fruiting. A light bar on two posts runs over the trough: its
magenta strips light with `.active`. Plants are seeded per cup, so every stage keeps the same layout."""
import math
import random

from .modkit import K, sprites

STAGES = ("grow0", "grow1", "grow2", "grow3")
STATES = tuple(s + a for s in STAGES for a in ("", ".active"))
CUPS = [(u * 0.3 - 0.75, v) for v in (-0.17, 0.17) for u in range(6)]
LEAF = ("alG", "xnFL", "alG", "xnF")


def _plant(k, u, v, z, stage, rnd):
    if stage == 0:
        k.box(u, v, z, 0.05, 0.05, 0.03, "ochD")                                        # seed plug
        return
    if stage == 1:
        for a in (0.5, 0.5 + math.pi):                                                # two seed leaves
            k.box(u + 0.03 * math.cos(a), v + 0.03 * math.sin(a), z, 0.06, 0.035, 0.05, "alG", rz=a)
        return
    n, s, h = (5, 0.1, 0.13) if stage == 2 else (8, 0.15, 0.24)
    k.box(u, v, z, 0.04, 0.04, h * 0.8, "xnFD")                                        # stem
    for i in range(n):
        a = i * 2.4 + rnd.uniform(-0.3, 0.3)
        r = s * rnd.uniform(0.3, 0.6)
        zz = z + h * rnd.uniform(0.35, 1.0)
        k.box(u + r * math.cos(a), v + r * math.sin(a), zz, s * 0.75, s * 0.4, 0.04, LEAF[i % 4], rz=a,
              rx=rnd.uniform(-0.35, 0.35))
    k.box(u, v, z + h * 0.9, s * 0.6, s * 0.6, 0.07, "alG", rz=rnd.uniform(0, 1.5))      # crown
    if stage == 3 and rnd.random() < 0.6:                                             # fruit
        for _ in range(rnd.randint(1, 3)):
            a = rnd.uniform(0, 2 * math.pi)
            k.box(u + 0.09 * math.cos(a), v + 0.09 * math.sin(a), z + h * rnd.uniform(0.3, 0.7), 0.05, 0.05, 0.05,
                  "medRed", bevel=0.012)


def hydroponics(state, rot):
    stage, on = STAGES.index(state.split(".")[0]), state.endswith(".active")
    k = K(f"hydro_{state.replace('.', '_')}_{rot}", (2, 1), rot)
    for su in (-1, 1):                                                                # legs and a cross rail
        for sv in (-1, 1):
            k.box(su * 0.84, sv * 0.32, 0.0, 0.07, 0.07, 0.42, "steelD", top="steel")
        k.box(su * 0.84, 0, 0.12, 0.05, 0.6, 0.05, "steelD")
    k.box(-0.3, 0.02, 0.0, 0.7, 0.5, 0.3, "polyB", top="pcb", bevel=0.02)               # reservoir
    k.box(-0.3, 0.02, 0.3, 0.12, 0.12, 0.13, "gmD")                                      # its pump
    k.box(0.35, 0.05, 0.0, 0.3, 0.36, 0.22, "gm", top="steelL", bevel=0.015)              # nutrient doser
    k.box(0.35, 0.235, 0.12, 0.1, 0.012, 0.05, "green" if on else "dark")
    k.box(0, 0, 0.42, 1.86, 0.8, 0.2, "steelL", top="plate", bevel=0.015)                # trough
    k.box(0, 0, 0.47, 1.87, 0.81, 0.05, "navy")                                          # its band
    k.box(0, 0, 0.6, 1.76, 0.7, 0.03, "rustD", top="leather")                             # the bed: soil
    z = 0.63
    for i, (u, v) in enumerate(CUPS):
        k.cyl(u, v, z, 0.055, 0.02, "gmD", sides=8)
        _plant(k, u, v, z + 0.01, stage, random.Random(i * 7 + 3))
    for su in (-1, 1):                                                                # the light bar: posts at
        k.box(su * 0.9, -0.34, 0.42, 0.06, 0.06, 0.92, "steelD", top="steel")          # the back, arms forward
        k.box(su * 0.9, -0.17, 1.3, 0.06, 0.4, 0.05, "steelD")
    k.box(0, 0, 1.2, 1.9, 0.18, 0.1, "gm", top="steelL", bevel=0.01)
    lit = "magenta" if on else "blueGrey"
    k.box(0, 0.095, 1.2, 1.8, 0.012, 0.07, lit)                                           # strip on the front face
    k.box(0, -0.095, 1.2, 1.8, 0.012, 0.07, lit)                                          # and the back
    for su in (-1, 1):
        k.box(su * 0.955, 0, 1.2, 0.012, 0.14, 0.07, lit)                                 # and the ends
    return k.build()


def jobs(rots=range(4)):
    return sprites("module.hydroponics", (2, 1), STATES, hydroponics, rots)
