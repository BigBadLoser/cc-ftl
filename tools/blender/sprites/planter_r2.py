"""Planter look study, round 2 (family `planter2`, palette set planter, preview only): PL1 picked (user, 2026-11-13),
the deep-blue glazed pot with a lighter rim and a broad-leaf bush. Round 1's pot was small for a whole tile, so all
three are bigger; they try the pot's stance and the plant.

  pl1a taller: a taller pot and a fuller, higher bush
  pl1b upright blades: the same taller pot with tall upright sword blades (yellow edged) instead of the bush
  pl1c footed: the pot on three short steel feet with a steel band at the waist, a looser drooping bush

Approved (user, 2026-11-13): PL1A (`pl1a`), the planter's art: a tall tapered deep-blue glazed ceramic pot with a
lighter blue rim and a full broad-leaf bush (two greens); palette set planter, 1 x 1.

All in px of the tile (u, v -16..16, z up)."""
import math
import random

from .exercise_r4 import build, sweep
from .planter_study import FP, SOIL, lathe, leaf
from .research_kit import Bench

POT = [(0, 7.5), (1.5, 8.6), (9, 10.6), (16, 11.8), (17.2, 12)]


def rim(k, z, r, col="plGlazeL", t=1.1):
    sweep(k, [(r * math.cos(a), r * math.sin(a), z, t, t) for a in [i * math.tau / 32 for i in range(33)]], col, p=2,
          n=8, steps=2)


def pot(k, prof=POT):
    lathe(k, prof, "plGlaze", cap0="plGlazeD", cap1=SOIL)
    rim(k, prof[-1][0], prof[-1][1] - 0.2)


def bush(k, z, n=34, seed=7, length=(10, 14), droop=(0.5, 0.9), spread=5):
    r = random.Random(seed)
    for i in range(n):
        a = i * 2.39996 + r.uniform(-0.2, 0.2)
        rad = r.uniform(0, spread)
        base = (rad * math.cos(a), rad * math.sin(a), z + r.uniform(0, 7))
        leaf(k, base, a, r.uniform(*length), r.uniform(2.4, 3.2), r.uniform(0.6, 1.1), r.uniform(*droop),
             "plLeaf" if i % 3 else "plLeafD")


def a():
    k = Bench("planter_pl1a", FP)
    pot(k)
    bush(k, 17)
    return build(k)


def b():
    k = Bench("planter_pl1b", FP)
    pot(k)
    r = random.Random(11)
    for i in range(24):                                                            # upright sword blades
        ang = i * 2.39996
        rad = r.uniform(0.5, 7)
        x, y = rad * math.cos(ang), rad * math.sin(ang)
        h, lean = r.uniform(14, 22), r.uniform(0.15, 0.35)
        pts = []
        for t, wf in ((0, 0.5), (0.3, 1.0), (0.7, 0.85), (1.0, 0.1)):
            pts.append((x + math.cos(ang) * lean * h * t * t, y + math.sin(ang) * lean * h * t * t, 17 + h * t,
                        2.5 * wf, 0.45))
        sweep(k, pts, "plBlade" if i % 4 else "plBladeE", p=2.2, n=10, steps=4, side=(-math.sin(ang), math.cos(ang), 0))
    return build(k)


def c():
    k = Bench("planter_pl1c", FP)
    prof = [(3, 7.5), (4.5, 8.6), (11, 10.4), (18, 11.6), (19.2, 11.8)]
    pot(k, prof)
    for i in range(3):                                                             # steel feet
        t = i * math.tau / 3 + 0.5
        sweep(k, [(6.5 * math.cos(t), 6.5 * math.sin(t), 4, 1.3, 1.3), (8.5 * math.cos(t), 8.5 * math.sin(t), 0.4,
                                                                         1.1, 1.1)], "plSteel", p=2.2, n=10)
    rim(k, 10.5, 10.5, "plSteel", 0.8)                                              # waist band
    bush(k, 19, n=30, seed=5, length=(12, 16), droop=(1.0, 1.5), spread=4)
    return build(k)


DESIGNS = {"pl1a": a, "pl1b": b, "pl1c": c}


def jobs():
    return [(f"module.planter2.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
