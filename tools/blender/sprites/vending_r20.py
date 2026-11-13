"""Vending machine look study, round 20 (family `vending20`, palette set vending, preview only): the livery is
19e (user's pick, 2026-11-13); this round fixes the front's details (user: the glass dims everything, the chip bags
want different colours, the cans read as four very tall cans, the keypad blurs together, and the pickup slot
should be a real recess).

- glass: no pane over the windows any more (it washed the contents out); two thin glints across the snack window
  say "glass" instead.
- chips: proper little bags (boxes) in six muted colours (user: the livery's bright primaries drown bright bags),
  mixed so no two neighbours match.
- cans: two rows of four bigger cans (user: three rows of five was too many) with lit tops and a dark shelf
  between rows, one flavour (colour) per column (mixed per can, they read as a jumble of dots).
- keypad: fewer, bigger keys standing proud of a dark panel with a gap between each, and a small screen.
- pickup: a deep recess (5 px) with pale walls and floor, and a dark flap hinged at its top, swung in.

  vm1c20a 2x3 keys and a screen; the flap hangs half way down
  vm1c20b a 2x2 pad of big keys, a coin slot and a screen; the flap pushed further in
  vm1c20c a single column of four keys beside a tall screen; an open bin (no flap) with a lit lip

Uses r10's body with its holes swapped while building, r15's painter and r19's 19e look. SPRITE_SAMPLES=64."""
from . import vending_r10 as R
from . import vending_r15 as V
from .exercise_r4 import sweep
from .research_kit import ZPX
from .vending_r19 import LOOKS as L19
from .vending_study import FP

VF = R.VF
TRAY = (-10.0, 3.6, 3.4, 10.6, 5.0)                                  # u0, u1, z0, z1, depth
HOLES = [h for h in R.HOLES if h[4] != 9.6] + [("F", TRAY[0], TRAY[1], TRAY[2], TRAY[3], TRAY[4], "vmPanel")]
BAGS = ["vmBagRose", "vmBagMustard", "vmBagSlate", "vmBagSage", "vmBagClay", "vmBagPlum"]
CANS = ["vmChipR", "vmChipB", "vmChipG", "vmCanO"]


def bx(k, u0, u1, v0, v1, z0, z1, col, top=None):
    k.box((u0 + u1) / 64, (v0 + v1) / 64, z0 / ZPX, (u1 - u0) / 32, (v1 - v0) / 32, (z1 - z0) / ZPX, col, top=top)


def quad(k, pts, col):
    R.face(k, pts, col, (0, 1, 0.3))                                             # (wound to face out)


def glass(k):
    v = VF - 0.15
    for (u, z, w) in ((-10.4, 55.5, 0.9), (-8.6, 55.5, 0.45)):            # two glints, low left to high right
        quad(k, [(u, v, z - 9), (u + w, v, z - 9), (u + w + 7, v, z), (u + 7, v, z)], "vmCreamL")


def snacks(k):
    v = VF - 2.0
    for row, z in enumerate((30.0, 37.0, 44.0, 51.0)):
        bx(k, -11.2, 4.8, v, v + 1.6, z - 0.6, z, "vmAluD")                     # shelf lip
        for j, u in enumerate((-9.2, -5.3, -1.4, 2.5)):
            col = BAGS[(row * 2 + j * 3 + row // 2) % len(BAGS)]
            bx(k, u - 1.5, u + 1.5, v + 0.1, v + 1.1, z + 0.4, z + 4.6, col, top="vmCreamL")


def cans(k):
    for row, z in enumerate((12.6, 19.6)):
        if row:
            bx(k, -11.2, 4.8, VF - 3.0, VF - 1.0, z - 1.0, z - 0.1, "vmGraph")   # dark shelf between rows
        for j, u in enumerate((-9.0, -5.0, -1.0, 3.0)):
            col = CANS[j]                                                       # one flavour per column
            sweep(k, [(u, VF - 1.8, z, 1.55, 1.55), (u, VF - 1.8, z + 5.2, 1.55, 1.55)], col, p=2, n=12,
                  cap1="vmAlu")


def keypad(k, style):
    back = VF - 0.8
    if style == "a":
        bx(k, 7.2, 10.6, back, back + 0.3, 42.6, 45.6, "vmScreen")
        keys = [(u, z) for z in (34.2, 36.8, 39.4) for u in (7.9, 9.9)]
        size = (1.5, 1.6)
    elif style == "b":
        bx(k, 7.2, 10.6, back, back + 0.3, 42.8, 45.6, "vmScreen")
        bx(k, 8.4, 9.4, back, back + 0.4, 40.6, 41.2, "vmDark")             # coin slot
        keys = [(u, z) for z in (34.0, 37.0) for u in (7.9, 9.9)]
        size = (1.7, 2.2)
    else:
        bx(k, 9.0, 10.8, back, back + 0.3, 34.0, 45.6, "vmScreen")
        keys = [(7.7, z) for z in (34.2, 37.0, 39.8, 42.6)]
        size = (1.5, 1.8)
    for u, z in keys:
        bx(k, u - size[0] / 2, u + size[0] / 2, back, back + 0.6, z, z + size[1], "vmAlu", top="vmCreamL")


def tray(k, style):
    u0, u1, z0, z1, dep = TRAY
    if style == "c":
        bx(k, u0, u1, VF - 0.6, VF + 0.2, z0 - 0.6, z0, "vmAlu")              # lit lip on the bin's edge
        return
    reach = 2.4 if style == "a" else 3.6
    quad(k, [(u0 + 0.2, VF - 0.3, z1 - 0.2), (u1 - 0.2, VF - 0.3, z1 - 0.2), (u1 - 0.2, VF - reach, z0 + 2.0),
             (u0 + 0.2, VF - reach, z0 + 2.0)], "vmGraph")                       # flap, hinged at the top


def make(name):
    style = name[-1]
    look = dict(L19["vm1c19e"])

    def f():
        old = R.HOLES
        R.HOLES = HOLES
        try:
            k = V.Bench(f"vending_{name}", FP)
            remap = {"vmWine": "jzWhite", "vmWineD": "jzGrey", "vmCreamD": "jzGrey", "vmCream": "jzWhite"}
            poly = k.m.poly
            k.m.poly = lambda pts, color, flip=False: poly(pts, remap.get(color, color), flip=flip)
            R.body(k, R.WAVES["vm1c10b"], paint=V.painter(look))
            snacks(k)
            cans(k)
            keypad(k, style)
            tray(k, style)
            glass(k)
            R.back(k)
            out = R.build(k)
            V.ramp(k, out[0], -0.12, 0.35, 0.40, pick=lambda r, g, b: True)
            V.flat_top(out[0])
            return out
        finally:
            R.HOLES = old
    return f


DESIGNS = {n: make(n) for n in ("vm1c20a", "vm1c20b", "vm1c20c")}


def jobs():
    return [(f"module.vending20.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
