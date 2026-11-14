"""Bar counter look study round 4 (family `barcounter4`, palette set bar4, preview only; frame and heights in
barcounter_study.py): round 3's forms and drink sources, toned down. Muted materials (ceramic, steel, gunmetal,
bronze, leather), no light strips: lights are a few pixels of status lamp, and drinks are plain colour.

  f1 synth bar: a ceramic counter with round ends and a bronze band; three steel swan-neck taps fed from a domed steel
     synth core behind it, a lamp over the pouring tap's pad and a drink on it
  f2 rail bar: a gunmetal counter with a steel dispenser tower at one end making a drink in its alcove; a steel track
     along the top carrying a drink pod toward the seats
  f3 back bar: a navy counter before a curved teal-grey backsplash with two shelves of bottles and glasses

All in px of the tile (u -48..48, v -32..32, z up), counter top 24, seats 15."""
import math

from .barcounter_r3 import cyl, lathe
from .barcounter_study import FP, SEAT, STOOLS, SV, TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench


def stool(k, u, body, cushion):
    """A saucer stool: a disc foot, a slim stem, a flared cup and a cushion."""
    lathe(k, u, SV, ((0, 4), (1, 4), (1, 1.2), (SEAT - 4, 1.2), (SEAT - 2, 5), (SEAT - 1, 5.2)), body)
    cyl(k, u, SV, SEAT - 1, SEAT, 4.6, cushion)


def drink(k, g, u, v, z, col, h=5):
    cyl(g, u, v, z, z + h, 1.6, "b4Glass")
    cyl(k, u, v, z, z + h - 2, 1.3, col)


def f1():
    k = Bench("bar_f1", FP)
    g = k.part("glass")
    _px(k, -42, 42, -15, -2, 0, 2, "b4Gun")                                        # recessed plinth
    _px(k, -42, 42, -16, 0, 2, TOP - 3, "b4Shell")                                 # body
    for su in (-1, 1):                                                             # round ends
        cyl(k, su * 42, -8, 0, 2, 7, "b4Gun")
        cyl(k, su * 42, -8, 2, TOP - 3, 8, "b4Shell")
        cyl(k, su * 42, -8, TOP - 3, TOP, 9.5, "b4Top")
        cyl(k, su * 42, -8, TOP - 7, TOP - 5, 8.3, "b4Bronze")
    _px(k, -42, 42, -18, 2, TOP - 3, TOP, "b4Top")                                 # top
    _px(k, -42, 42, 0, 1, TOP - 7, TOP - 5, "b4Bronze")                            # bronze band
    lathe(k, 0, -26, ((0, 7), (3, 7), (3, 6), (26, 6), (30, 4), (33, 2), (34, 0.5)), "b4Steel")   # synth core
    cyl(k, 0, -26, 12, 14, 6.3, "b4Bronze")
    _px(k, -1, 1, -20, -19, 18, 20, "b4Lamp")                                      # its status lamp
    for i, u in enumerate((-24, 0, 24)):
        _px(k, min(u, 0), max(u, 0) + 1, -20, -19, 14, 15, "b4Gun")                # conduit from the core
        _px(k, u, u + 1, -19, -15, 14, 15, "b4Gun")
        _px(k, u - 1, u + 1, -15, -13, TOP, 40, "b4Steel")                         # the tap's neck,
        _px(k, u - 1, u + 1, -15, -6, 38, 41, "b4Steel")                           # bending over the counter,
        _px(k, u - 1, u + 1, -8, -6, 35, 38, "b4Gun")                              # its nozzle
        cyl(k, u, -7, TOP, TOP + 1, 3.5, "b4Gun")                                  # the pad
    _px(k, -1, 1, -9, -8, 34, 35, "b4Lamp")                                        # the pouring tap's lamp
    drink(k, g, 0, -7, TOP + 1, "b4Drink")
    for u in STOOLS:
        stool(k, u, "b4Steel", "b4Seat")
    return k.build()


def f2():
    k = Bench("bar_f2", FP)
    g = k.part("glass")
    _px(k, -34, 48, -15, -2, 0, 2, "b4Navy")                                       # plinth
    _px(k, -34, 48, -16, 0, 2, TOP - 2, "b4Gun")                                   # body
    _px(k, -34, 48, 0, 1, 4, 6, "b4Bronze")                                        # a kick band low on its front
    _px(k, -34, 48, -17, 2, TOP - 2, TOP, "b4Top")                                 # top
    _px(k, -34, 46, -11, -10, TOP, TOP + 1, "b4Steel")                             # the track: two rails
    _px(k, -34, 46, -7, -6, TOP, TOP + 1, "b4Steel")
    lathe(k, -40, -12, ((0, 8), (2, 8), (2, 7), (40, 7), (44, 5), (47, 2.5), (48, 0.5)), "b4Steel")   # tower
    cyl(k, -40, -12, 40, 42, 7.3, "b4Bronze")                                      # its collar
    _px(k, -37, -33, -8, -5, 20, 36, "b4Gun")                                      # the alcove's frame (front, +v)
    _px(k, -36, -34, -6, -4, 22, 34, "b4Navy")                                     # its dark back
    _px(k, -36, -34, -5, -4, 33, 34, "b4Lamp")                                     # a lamp over the drink
    drink(k, g, -35, -3, 25, "b4Drink")
    _px(k, 8, 12, -10, -7, TOP + 1, TOP + 2, "b4Steel")                            # a pod on the track,
    drink(k, g, 10, -8.5, TOP + 2, "b4Wine")
    for u in STOOLS:
        stool(k, u, "b4Gun", "b4Seat")
    return k.build()


def f3():
    k = Bench("bar_f3", FP)
    g = k.part("glass")
    R, CV = 90, 58                                                                 # the backsplash's arc
    for i in range(-4, 5):
        a = i * 0.13
        u, v = R * math.sin(a), CV - R * math.cos(a)
        for z0, z1, col in ((0, 4, "b4Gun"), (4, 42, "b4Panel"), (42, 46, "b4Bronze")):
            k.box(u / 32, v / 32, z0 / ZPX, 11.8 / 32, 2 / 32, (z1 - z0) / ZPX, col, top=col, rz=a)
    cols = ("b4Drink", "b4Wine", "b4Green", "b4Glass")
    for zs, dz in ((26, 7), (36, 6)):                                              # two shelves of bottles
        _px(k, -44, 44, -26, -22, zs - 1, zs, "b4Bronze")
        for j, u in enumerate(range(-40, 41, 8)):
            c = cols[(j + zs) % 4]
            if c == "b4Glass":
                cyl(g, u, -24, zs, zs + 4, 1.6, "b4Glass")
            else:
                cyl(k, u, -24, zs, zs + dz - 2, 1.5, c)
                cyl(k, u, -24, zs + dz - 2, zs + dz, 0.6, c)
    _px(k, -2, 2, -27, -26, 44, 45, "b4Lamp")                                      # a small lamp over the shelves
    _px(k, -48, 48, -15, -2, 0, 2, "b4Gun")                                        # plinth
    _px(k, -48, 48, -16, 0, 2, TOP - 2, "b4Navy")                                  # body
    _px(k, -48, 48, -17, 2, TOP - 2, TOP, "b4Top")                                 # top
    _px(k, -48, 48, 1, 2, TOP - 5, TOP - 4, "b4Bronze")                            # bronze rail on the front
    for u, c in ((-30, "b4Drink"), (4, "b4Wine"), (30, "b4Green")):
        drink(k, g, u, -6, TOP, c)
    for u in STOOLS:
        stool(k, u, "b4Navy", "b4Seat")
    return k.build()


DESIGNS = {"f1": f1, "f2": f2, "f3": f3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
