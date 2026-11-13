"""Vending machine look study, round 1 (family `vending`, palette set vending, preview only): three machines on one
tile, each its own concept, colours and materials. Bodies are swept rounded sections (exercise_r4.sweep), not boxes.
The front (+v) faces the camera.

  vm1 snack tower: a cream body with wine side cheeks and header (a dim warm sign strip), a dark glass front showing
      rows of packets, a keypad column and a pickup tray
  vm2 can column: a round brushed-aluminium column with deep-green base and dome cap, a curved dark window band of
      cans and a round pickup niche
  vm3 ration printer: a squat graphite kiosk with a rust front panel, a dim screen and output hatch, a rust feed
      hopper on top with a pipe down its side

All in px of the tile (u, v -16..16, z up)."""
import math

from .bench_r7 import tube
from .bench_study import along_u
from .exercise_r4 import build, sweep
from .research_kit import Bench

FP = (1, 1)


def column(k, u, v, z0, z1, a, b, col, p=4.5, cap0=None, cap1=None):
    sweep(k, [(u, v, z0, a, b), (u, v, z1, a, b)], col, p=p, n=24, steps=2, cap0=cap0, cap1=cap1)


def vm1():
    k = Bench("vending_vm1", FP)
    column(k, 0, -0.5, 0, 43, 11.5, 8.6, "vmCream", cap0="vmCreamD", cap1="vmCreamD")   # body
    for s in (-1, 1):
        column(k, s * 12, -0.5, 0, 44, 1.0, 9.2, "vmWine", p=4, cap1="vmWineD")         # side cheeks
    along_u(k, -12.5, 12.5, -0.5, 44.5, 9.2, 1.6, "vmWine", p=4, cap0="vmWineD", cap1="vmWineD")   # header
    along_u(k, -9.5, 9.5, 8.8, 41.2, 0.4, 0.8, "vmSign", p=3)                        # dim sign strip
    along_u(k, -10, 4.5, 8.3, 25.5, 0.5, 12.5, "vmGlass", p=4)                       # glass front
    cols = ("vmItemR", "vmItemY", "vmItemB", "vmItemY")
    for row, z in enumerate((16, 22, 28, 34)):                                      # packets behind the glass
        for j, u in enumerate((-7.5, -3.8, -0.1, 3.0)):
            along_u(k, u - 1.4, u + 1.4, 8.5, z, 0.5, 2, cols[(row + j) % 4], p=3)
        along_u(k, -10, 4.5, 8.6, z - 2.6, 0.3, 0.25, "vmCreamD", p=2.4)              # shelf lip
    along_u(k, 6, 10.2, 8.3, 29, 0.5, 6, "vmPanel", p=4)                             # keypad panel
    for z in (26, 28.5, 31):
        for u in (7.3, 9):
            along_u(k, u - 0.5, u + 0.5, 8.9, z, 0.3, 0.5, "vmCreamD", p=3)          # keys
    along_u(k, -9, 4, 8.3, 7, 0.6, 2.4, "vmGlass", p=4)                              # pickup tray
    return build(k)


def vm2():
    k = Bench("vending_vm2", FP)
    sweep(k, [(0, 0, z, r, r) for z, r in ((0, 11), (5, 11.2))], "vmGreen", p=2, n=28, steps=2, cap0="vmGreenD")
    sweep(k, [(0, 0, z, r, r) for z, r in ((5, 10.6), (36, 10.6))], "vmAlu", p=2, n=28, steps=2)   # brushed column
    sweep(k, [(0, 0, z, r, r) for z, r in ((36, 11), (38, 11), (41, 9), (43, 5.5), (44, 1))], "vmGreen", p=2, n=28,
          steps=4)                                                                 # dome cap
    arc = [(11 * math.cos(t), 11 * math.sin(t), 26, 0.7, 7.5) for t in
           [math.radians(d) for d in range(35, 146, 10)]]
    sweep(k, arc, "vmGlass", p=4, n=12, steps=3)                                   # window band
    for z in (21, 26, 31):                                                         # cans in the window
        for j, d in enumerate(range(45, 136, 15)):
            t = math.radians(d)
            sweep(k, [(11.3 * math.cos(t), 11.3 * math.sin(t), z - 1.6, 0.9, 0.9),
                      (11.3 * math.cos(t), 11.3 * math.sin(t), z + 1.6, 0.9, 0.9)], ("vmCanO", "vmCanW")[(j + z) % 2],
                  p=2, n=10)
    niche = [(10.9 * math.cos(t), 10.9 * math.sin(t), 11, 0.6, 3) for t in
             [math.radians(d) for d in range(65, 116, 10)]]
    sweep(k, niche, "vmGreenD", p=4, n=12, steps=3)                                # pickup niche
    return build(k)


def vm3():
    k = Bench("vending_vm3", FP)
    for u, v in ((-8, -7), (8, -7), (-8, 7), (8, 7)):
        column(k, u, v, 0, 1.2, 1.8, 1.8, "vmDark", p=2.2)                        # feet
    sweep(k, [(0, 0, 1, 11, 10), (0, 0, 27, 11, 10), (0, 0, 30, 10, 9)], "vmGraph", p=3.5, n=24, steps=4,
          cap0="vmGraphD", cap1="vmGraphD")                                         # body
    along_u(k, -8.5, 8.5, 9.3, 19, 1.2, 8, "vmRust", p=4, cap0="vmRustD", cap1="vmRustD")   # rust front panel
    along_u(k, -6, 6, 10.5, 22.5, 0.4, 3, "vmScreen", p=4)                           # dim screen
    along_u(k, -5, 5, 10.5, 13.5, 0.5, 2.6, "vmDark", p=4)                           # output hatch
    sweep(k, [(0, -3, z, r, r) for z, r in ((29, 5), (33, 6.6), (36.5, 7.6), (37.5, 7.6))], "vmRust", p=2, n=24,
          steps=4, cap1="vmDark")                                                  # feed hopper
    tube(k, [(7, -3, 34), (11.5, -3, 31), (12.2, -2, 22), (11.3, 0, 15)], 1.0, "vmPipe")   # feed pipe
    return build(k)


DESIGNS = {"vm1": vm1, "vm2": vm2, "vm3": vm3}


def jobs():
    return [(f"module.vending.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
