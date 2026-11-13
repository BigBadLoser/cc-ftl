"""Vending machine look study, round 2 (family `vending2`, palette set vending, preview only): VM1 picked (user,
2026-11-13), the snack tower: cream body, wine side cheeks and header with a dim warm sign strip, a dark glass front of
packets, keypad and pickup tray. Rebuilt at full height (round 1 was stretched after the build, which pulled the
packets tall) with proper rows, and widened and deepened to fill most of its tile.

  vm1a rebuilt: the round 1 design at full height, six rows of packets
  vm1b curved glass: the glass front bows out between the cheeks, the pickup tray set into a wine kick panel
  vm1c split: snacks above, a chilled can section below behind its own glass, keypad with a small card slot

Approved (user, 2026-11-13): VM1C (`vm1c`), the vending machine's art: a cream body with wine side cheeks and a flat
wine header with a dim warm sign strip, snack packets behind the upper glass, a wine divider, a chilled can section
behind its own dark glass below, a keypad with a card slot and a pickup tray; full height (66 px), filling most of
its tile; palette set vending, 1 x 1.

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
import math

from .bench_study import along_u
from .exercise_r4 import build, sweep
from .research_kit import ZPX, Bench
from .vending_study import FP, column

H = 66
PACKETS = ("vmItemR", "vmItemY", "vmItemB", "vmItemY")


def shell(k, kick=False):
    column(k, 0, -1.5, 0, H, 13.6, 12, "vmCream", cap0="vmCreamD", cap1="vmCreamD")   # body
    for s in (-1, 1):
        column(k, s * 14.3, -1.5, 0, H + 1, 1.0, 12.6, "vmWine", p=4, cap1="vmWineD")      # side cheeks
    k.box(0, -1.5 / 32, (H - 0.4) / ZPX, 30.2 / 32, 25.4 / 32, 4 / ZPX, "vmWine", top="vmWine", bevel=0.015)   # header
    # (a flat box: the smooth-shaded header's near-flat top sat on a shade boundary and came out mottled)
    along_u(k, -11.5, 11.5, 11, H - 2.6, 0.4, 1, "vmSign", p=3)                       # dim sign strip
    if kick:
        along_u(k, -13.2, 13.2, 10.8, 6, 0.6, 6, "vmWine", p=4)                           # kick panel


def rows(k, zs, v=10.7, us=(-9.6, -5.5, -1.4, 2.7), cols=PACKETS, h=2.4, w=1.6, lip_v=10.8):
    for row, z in enumerate(zs):
        for j, u in enumerate(us):
            along_u(k, u - w, u + w, v, z, 0.5, h, cols[(row + j) % len(cols)], p=3)
        along_u(k, us[0] - 2.5, us[-1] + 1.5, lip_v, z - h - 0.6, 0.3, 0.3, "vmCreamD", p=2.4)   # shelf lip


def keypad(k, z=44, slot=False):
    along_u(k, 7.2, 12.4, 10.5, z, 0.5, 7, "vmPanel", p=4)
    for zz in (z - 3.5, z - 1, z + 1.5):
        for u in (8.7, 10.9):
            along_u(k, u - 0.6, u + 0.6, 11.1, zz, 0.3, 0.6, "vmCreamD", p=3)
    if slot:
        along_u(k, 8.2, 11.4, 11.1, z + 4.5, 0.3, 0.4, "vmDark", p=3)                  # card slot


def a():
    k = Bench("vending_vm1a", FP)
    shell(k)
    along_u(k, -12.2, 5.3, 10.5, 37, 0.5, 21, "vmGlass", p=4)                           # glass front
    rows(k, (21.5, 28.5, 35.5, 42.5, 49.5, 56.5))
    keypad(k)
    along_u(k, -11, 4.5, 10.5, 9, 0.6, 3, "vmGlass", p=4)                                # pickup tray
    return build(k)


def b():
    k = Bench("vending_vm1b", FP)
    shell(k, kick=True)
    glass = [(u, 10.5 + 1.8 * math.cos((u + 3.45) / 8.75 * math.pi / 2) ** 2, 37, 0.5, 21)
             for u in (-12.2, -7.8, -3.45, 0.9, 5.3)]
    sweep(k, glass, "vmGlass", p=4, n=16, steps=4)                                 # bowed glass
    for row, z in enumerate((21.5, 28.5, 35.5, 42.5, 49.5, 56.5)):
        for j, u in enumerate((-9.6, -5.5, -1.4, 2.7)):
            vv = 10.7 + 1.8 * math.cos((u + 3.45) / 8.75 * math.pi / 2) ** 2
            along_u(k, u - 1.6, u + 1.6, vv, z, 0.5, 2.4, PACKETS[(row + j) % 4], p=3)
    keypad(k)
    along_u(k, -10, 4.5, 11.4, 7, 0.5, 2.6, "vmDark", p=4)                               # tray in the kick panel
    return build(k)


def c():
    k = Bench("vending_vm1c", FP)
    shell(k)
    along_u(k, -12.2, 5.3, 10.5, 43, 0.5, 15, "vmGlass", p=4)                           # snack glass
    rows(k, (33, 40, 47, 54))
    along_u(k, -12.7, 5.8, 10.8, 27.4, 0.5, 0.8, "vmWine", p=4)                         # divider
    along_u(k, -12.2, 5.3, 10.5, 19, 0.5, 7.4, "vmPanel", p=4)                          # chilled glass
    for z in (15.5, 22):                                                           # cans
        for j, u in enumerate((-10, -6.8, -3.6, -0.4, 2.8)):
            sweep(k, [(u, 11.1, z - 2.4, 1.3, 1.3), (u, 11.1, z + 2.4, 1.3, 1.3)], ("vmItemB", "vmCreamD")[j % 2],
                  p=2, n=10)
    keypad(k, 40, slot=True)
    along_u(k, -11, 4.5, 10.5, 7, 0.6, 2.6, "vmGlass", p=4)                              # pickup tray
    return build(k)


DESIGNS = {"vm1a": a, "vm1b": b, "vm1c": c}


def jobs():
    return [(f"module.vending2.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
