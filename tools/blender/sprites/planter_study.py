"""Planter look study, round 1 (family `planter`, palette set planter, preview only): three planters on one tile, each
its own concept, colours and plant. Leaves are swept blades (exercise_r4.sweep): a flat superellipse section along a
rising, drooping curve, so they shade as smooth surfaces, never stacked boxes.

  pl1 glazed pot: a tapered deep-blue glazed ceramic pot with a lighter rim, a broad-leaf bush
  pl2 grow trough: a sage-grey metal trough, rows of bright sprouts, a lamp arm curving over them (dim warm light)
  pl3 bio-dome: a charcoal base with a brass ring, a succulent rosette and three fronds under a glass
                dome on six brass ribs

All in px of the tile (u, v -16..16, z up)."""
import math
import random

from .bench_study import along_u
from .bench_r7 import tube
from .exercise_r4 import build, sweep
from .research_kit import Bench

FP = (1, 1)
SOIL = "plSoil"


def leaf(k, base, ang, length, width, rise, droop, col, thick=0.35, tilt=0.0):
    """A blade from `base` heading `ang` (radians, in the u-v plane): rises by `rise` px per length, droops by `droop`."""
    x0, y0, z0 = base
    dx, dy = math.cos(ang), math.sin(ang)
    pts = []
    for t, wf in ((0, 0.25), (0.25, 0.9), (0.5, 1.0), (0.75, 0.7), (1.0, 0.12)):
        d = length * t
        z = z0 + length * (rise * t - droop * t * t)
        pts.append((x0 + dx * d, y0 + dy * d, z, width * wf, thick))
    sweep(k, pts, col, p=2.4, n=10, steps=4)


def lathe(k, prof, col, cap1=None, cap0=None):
    sweep(k, [(0, 0, z, r, r) for z, r in prof], col, p=2, n=24, steps=4, cap0=cap0, cap1=cap1)


def pl1():
    k = Bench("planter_pl1", FP)
    lathe(k, [(0, 6.5), (1.5, 7.5), (8, 9.2), (13, 10.2), (14, 10.4)], "plGlaze", cap0="plGlazeD", cap1=SOIL)
    sweep(k, [(10.2 * math.cos(t), 10.2 * math.sin(t), 14, 1.0, 1.0) for t in
              [i * math.tau / 28 for i in range(29)]], "plGlazeL", p=2, n=8, steps=2)   # rim
    r = random.Random(7)
    for i in range(26):
        a = i * 2.39996 + r.uniform(-0.2, 0.2)
        rad = r.uniform(0, 4)
        base = (rad * math.cos(a), rad * math.sin(a), 14 + r.uniform(0, 5))
        col = "plLeaf" if i % 3 else "plLeafD"
        leaf(k, base, a, r.uniform(8, 12), r.uniform(2.2, 3.0), r.uniform(0.6, 1.1), r.uniform(0.5, 0.9), col)
    return build(k)


def pl2():
    k = Bench("planter_pl2", FP)
    along_u(k, -13, 13, 2, 4.5, 9, 4.5, "plMetal", p=4, taper=1, cap0="plMetalD", cap1="plMetalD")   # trough
    along_u(k, -12, 12, 2, 8.6, 8, 0.8, SOIL, p=4)                                 # soil
    r = random.Random(3)
    for row in (-3, 2, 7):
        for u in range(-10, 11, 4):
            for s in (-1, 1):                                                      # leaf pairs
                leaf(k, (u + r.uniform(-0.6, 0.6), row, 9), math.pi / 2 * (1 + s) + r.uniform(-0.4, 0.4),
                     r.uniform(3.5, 5), 1.4, 1.2, 0.9, "plSprout" if (u + row) % 3 else "plSproutD", thick=0.3)
    tube(k, [(0, -7, 4), (0, -9.5, 12), (0, -10, 22), (0, -8, 28), (0, -3, 30)], 1.0, "plLampBody")   # lamp arm
    along_u(k, -9, 9, 1.5, 29.6, 3.4, 1.2, "plLampBody", p=4, taper=0.8)            # lamp head
    along_u(k, -8, 8, 1.5, 28.3, 2.2, 0.3, "plLamp", p=4)                            # its dim warm strip
    return build(k)


def pl3():
    k = Bench("planter_pl3", FP)
    lathe(k, [(0, 10.6), (2.5, 11.6), (6, 11.6), (6.8, 11)], "plBase", cap1=SOIL)  # base
    sweep(k, [(11.6 * math.cos(t), 11.6 * math.sin(t), 6, 1.0, 1.0) for t in
              [i * math.tau / 32 for i in range(33)]], "plBrass", p=2, n=8, steps=2)   # brass ring
    for i in range(10):                                                            # succulent rosette
        a = i * math.tau / 10
        leaf(k, (0, 0, 7), a, 6.5, 2.4, 1.0, 0.6, "plSucc" if i % 2 else "plSuccD", thick=1.0)
    for i in range(7):
        a = i * math.tau / 7 + 0.3
        leaf(k, (0, 0, 8.4), a, 4.2, 1.8, 1.7, 0.7, "plSucc", thick=0.9)
    for a in (2.0, 3.6, 5.6):                                                      # fronds
        leaf(k, (math.cos(a) * 2.5, math.sin(a) * 2.5, 7), a, 12, 2.0, 1.7, 1.0, "plFrond")
    g = k.part("glass")
    lathe(g, [(6.8, 10.8), (14, 10.5), (20, 8.6), (24, 5.4), (25.6, 1.4)], "plGlass")   # dome
    for i in range(6):                                                             # brass ribs over the glass
        a = i * math.tau / 6 + 0.26
        sweep(k, [(r * math.cos(a), r * math.sin(a), z, 0.55, 0.55) for z, r in
                  ((6.6, 11.0), (14, 10.7), (20, 8.8), (24, 5.6), (25.8, 1.6))], "plBrass", p=2, n=8, steps=4)
    lathe(k, [(25.2, 1.8), (26.8, 1.8), (27.6, 0.7)], "plBrass")                   # knob
    return build(k)


DESIGNS = {"pl1": pl1, "pl2": pl2, "pl3": pl3}


def jobs():
    return [(f"module.planter.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
