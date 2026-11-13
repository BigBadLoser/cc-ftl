"""Vending machine look study, round 3 (family `vending3`, palette set vending, preview only): VM1C (approved front)
gets side art and back detail. The camera sees the front and the +u side; each variant is also built turned half
round (rot 2, `...b`) so the back and the other side show. One shared back; three side treatments, on both cheeks.

  vm1c1 sweep: a broad cream band with a thin yellow band beside it, running up the side on a slant
  vm1c2 can: a big blue can graphic on the side, cream highlight and wine top, with a cream ring label
  vm1c3 inset panel: a recessed dark grey panel with a cream logo disc up top and vent slots low down

Back: a cream back between the cheeks with a vent grille of dark slots, a screwed service panel, a small label plate
and a power cable curling down to the floor.

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
from .bench_r7 import tube
from .bench_study import along_u
from .exercise_r4 import build, sweep
from .research_kit import Bench
from .vending_r2 import keypad, rows, shell
from .vending_study import FP

SIDE = 15.4                    # the cheeks' outer face (u)


def along_v(k, u, v0, v1, z, a, b, col, p=4):
    sweep(k, [(u, v0, z, a, b), (u, v1, z, a, b)], col, p=p, n=16, steps=2)


def front(k):
    shell(k)
    along_u(k, -12.2, 5.3, 10.5, 43, 0.5, 15, "vmGlass", p=4)                       # snack glass
    rows(k, (33, 40, 47, 54))
    along_u(k, -12.7, 5.8, 10.8, 27.4, 0.5, 0.8, "vmWine", p=4)                     # divider
    along_u(k, -12.2, 5.3, 10.5, 19, 0.5, 7.4, "vmPanel", p=4)                      # chilled glass
    for z in (15.5, 22):                                                           # cans
        for j, u in enumerate((-10, -6.8, -3.6, -0.4, 2.8)):
            sweep(k, [(u, 11.1, z - 2.4, 1.3, 1.3), (u, 11.1, z + 2.4, 1.3, 1.3)], ("vmItemB", "vmCreamD")[j % 2],
                  p=2, n=10)
    keypad(k, 40, slot=True)
    along_u(k, -11, 4.5, 10.5, 7, 0.6, 2.6, "vmGlass", p=4)                          # pickup tray


def back(k):
    for z in range(30, 55, 3):                                                     # vent grille
        along_u(k, -9, 9, -13.7, z, 0.4, 0.55, "vmDark", p=3)
    along_u(k, -8, 8, -13.6, 15, 0.4, 7, "vmCreamD", p=5)                           # service panel
    for u in (-6.8, 6.8):
        for z in (9, 21):
            along_u(k, u - 0.5, u + 0.5, -14.1, z, 0.3, 0.5, "vmPanel", p=2.4)     # screws
    along_u(k, -3, 3, -14, 60, 0.3, 1.6, "vmPanel", p=4)                            # label plate
    tube(k, [(10, -13.8, 9), (10.5, -15, 6), (10, -15.4, 2.5), (8, -15.4, 0.7), (4, -15, 0.7)], 0.8, "vmDark")   # cable


def sweep_art(k, s):
    u = s * SIDE
    sweep(k, [(u, 6.5, 6, 0.3, 3.4), (u, -0.5, 28, 0.3, 3.6), (u, -7.5, 52, 0.3, 3.6), (u, -9.5, 61, 0.3, 3)], "vmCream", p=3,
          n=12, steps=4, side=(1.0, 0.0, 0.0))
    sweep(k, [(u, 1.5, 6, 0.3, 0.9), (u, -5, 27, 0.3, 0.9), (u, -11.5, 47, 0.3, 0.9)], "vmItemY", p=3, n=10, steps=4,
          side=(1.0, 0.0, 0.0))


def can_art(k, s):
    u = s * SIDE
    sweep(k, [(u, -1.5, 18, 0.3, 6), (u, -1.5, 52, 0.3, 6)], "vmItemB", p=6, n=16, steps=2, side=(1.0, 0.0, 0.0))
    along_v(k, u, -7.4, 4.4, 52.5, 0.35, 2, "vmWine", p=5)                        # wine top
    along_v(k, u, -7.4, 4.4, 17.8, 0.35, 1.2, "vmPanel", p=5)                     # base rim
    sweep(k, [(u, 2.4, 21, 0.35, 0.8), (u, 2.4, 49, 0.35, 0.8)], "vmCream", p=4, n=10, side=(1.0, 0.0, 0.0))   # highlight
    along_v(k, u, -6, 3, 35, 0.4, 3.4, "vmCream", p=2.2)                          # ring label


def inset_art(k, s):
    u = s * (SIDE - 0.3)
    sweep(k, [(u, -1.5, 8, 0.4, 10.2), (u, -1.5, 60, 0.4, 10.2)], "vmPanel", p=6, n=16, steps=2,
          side=(1.0, 0.0, 0.0))                                                    # recessed panel
    along_v(k, s * SIDE, -5, 2, 52, 0.4, 3.4, "vmCream", p=2.2)                     # logo disc
    along_v(k, s * SIDE, -3.8, 0.8, 52, 0.5, 1.4, "vmWine", p=2.2)                  # its mark
    for z in (13, 16, 19, 22):
        along_v(k, s * SIDE, -8, 5, z, 0.4, 0.6, "vmDark", p=3)                     # vent slots


ARTS = {"vm1c1": sweep_art, "vm1c2": can_art, "vm1c3": inset_art}


def make(name, art, rot):
    def f():
        k = Bench(f"vending_{name}", FP, rot)
        front(k)
        back(k)
        for s in (-1, 1):
            art(k, s)
        return build(k)
    return f


DESIGNS = {}
for _n, _a in ARTS.items():
    DESIGNS[_n] = make(_n, _a, 0)
    DESIGNS[_n + "b"] = make(_n + "b", _a, 2)


def jobs():
    return [(f"module.vending3.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
