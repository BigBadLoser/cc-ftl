"""The galley (food printer, 2x1) and the ration item. Grid frame, origin = centre of the front-most footprint tile at
floor level (as props.py).

The galley is modelled in a local frame centred on its footprint at rotation 0: a along the 2-tile length, b across,
the access side (+b, where crew stand to eat) toward the camera. Rotation r turns it like the sim (r1: access side -x,
r2: -y, r3: +x). It reads as a kitchen, not a fabricator: a cream counter with a stainless top, a printer tower with an
arched dispenser hatch over a serving ledge, paste canisters with coloured windows, stacked trays. The warm amber light
is on the active state only (glow sheet).

Rations: cream meal trays showing their food, an orange main as the one accent (white and red read as medical, olive
packs with a band as cash).
Stacks .s/.m/.l follow items.py (the UI icon is cut from .m), .held is one tray."""
import math

from . import core
from .items import HELD_K, STACK_K, _fin

ACCENT = "hivis"          # the food colour (non-emissive orange)


class _Frame:
    """Local footprint frame (a, b) -> grid, for a w x h footprint at rotation rot (true rotation, re-anchored)."""

    def __init__(self, m, fp, rot):
        self.m = m
        w, h = fp if rot % 2 == 0 else (fp[1], fp[0])
        self.c = (-(w - 1) / 2, -(h - 1) / 2)
        self.th = rot * math.pi / 2

    def P(self, a, b):
        c, s = math.cos(self.th), math.sin(self.th)
        return self.c[0] + a * c - b * s, self.c[1] + a * s + b * c

    def box(self, a, b, z, size, col, top=None, rz=0.0, rx=0.0, bevel=0.0, base=True):
        self.m.box((*self.P(a, b), z), size, col, top=top, rz=rz + self.th, rx=rx, bevel=bevel, base=base)

    def cyl(self, a, b, z, r, h, col, top=None, sides=10, rtop=None):
        self.m.cyl((*self.P(a, b), z), r, h, col, sides=sides, top=top, rtop=rtop, rz=self.th)


def _tray(F, a, b, z, k=1.0, rz=0.0, food=False):
    """One meal tray on the counter (local frame); food: the orange main on it."""
    F.box(a, b, z, (0.2 * k, 0.15 * k, 0.045 * k), "lvW2", top="lvW", rz=rz, bevel=0.008)
    if food:
        F.box(a - 0.03 * k, b, z + 0.045 * k, (0.09 * k, 0.1 * k, 0.02 * k), ACCENT, rz=rz)


def galley(rot, active):
    m = core.Mesh(f"galley_{rot}_{int(active)}")
    F = _Frame(m, (2, 1), rot)
    # counter: cream cabinet, stainless top, a red trim line under the lip, door seams and a dark kick recess
    F.box(0.0, -0.04, 0.06, (1.9, 0.78, 0.56), "lvW2", top="lvW", bevel=0.015)
    F.box(0.0, -0.06, 0.0, (1.84, 0.7, 0.06), "dark")
    for a in (-0.6, 0.0, 0.6):                                                               # back: service panels
        F.box(a, -0.435, 0.16, (0.46, 0.012, 0.36), "lvWS")
    F.box(0.3, -0.44, 0.3, (0.3, 0.02, 0.12), "gm")                                          # a vent
    F.box(0.0, -0.03, 0.62, (1.96, 0.86, 0.05), "steel", top="steelL", bevel=0.012)
    F.box(0.0, 0.365, 0.56, (1.9, 0.012, 0.03), "medRed")
    for a in (-0.3, 0.3):
        F.box(a, 0.356, 0.1, (0.016, 0.012, 0.44), "lvWS")
    for a in (-0.62, 0.62):
        F.box(a, 0.362, 0.42, (0.2, 0.02, 0.03), "gm")                                      # handles
    # printer tower at the left end: rounded cream housing, arched dispenser hatch, a menu screen, a vent on top
    tx = -0.56
    F.box(tx, -0.15, 0.67, (0.74, 0.56, 0.78), "lvW2", top="lvW", bevel=0.06)
    F.box(tx, 0.135, 0.68, (0.56, 0.03, 0.4), "lampY" if active else "gm", bevel=0.01)      # hatch frame (lit rim)
    F.box(tx, 0.14, 0.71, (0.48, 0.03, 0.33), "dark")                                       # the opening
    F.box(tx, 0.12, 0.72, (0.44, 0.012, 0.29), "lampY" if active else "steelD")              # its lit back wall
    F.box(tx, 0.18, 1.08, (0.56, 0.1, 0.06), "lvW2", top="lvW", bevel=0.02)                  # a brow over the hatch
    F.box(tx, 0.235, 1.09, (0.46, 0.012, 0.03), "lampY" if active else "steelD")             # its warm light strip
    F.box(tx, 0.137, 1.18, (0.36, 0.02, 0.14), "dark")                                      # menu screen
    for k in range(3):
        F.box(tx - 0.08 + k * 0.08, 0.14, 1.21, (0.05, 0.012, 0.03 + 0.02 * (k % 2)),
              "orange" if active else "steelD")
    for k in range(4):
        F.box(tx, -0.15 - 0.15 + k * 0.1, 1.44, (0.5, 0.04, 0.02), "gmD")                    # vent slats
    # serving ledge under the hatch, out over the access tile's edge
    F.box(tx, 0.43, 0.6, (0.56, 0.16, 0.04), "steelL", top="plate", bevel=0.008)
    if active:
        _tray(F, tx, 0.18, 0.75, food=True)                                                 # a meal being printed
        for k, (da, z, r) in enumerate(((-0.06, 1.5, 0.05), (0.05, 1.6, 0.04), (-0.02, 1.7, 0.035))):
            F.cyl(tx + da, -0.15, z, r, r * 1.2, "medWhite", sides=8, rtop=r * 0.6)          # steam
    else:
        _tray(F, tx, 0.43, 0.62, food=True)                                                # one waiting on the ledge
    # paste vats at the back right: glass jars full of coloured paste, steel bands and caps
    for k, (a, col) in enumerate(((0.06, "hivis"), (0.34, "pcb"), (0.62, "rust"))):
        F.cyl(a, -0.3, 0.67, 0.13, 0.08, "gm", top="steel", sides=12)
        F.cyl(a, -0.3, 0.75, 0.12, 0.34, col, sides=12)
        F.cyl(a, -0.3, 1.09, 0.12, 0.08, "glassL", top="glassL", sides=12)                 # the air above the paste
        F.cyl(a, -0.3, 1.17, 0.135, 0.06, "gm", top="steelL", sides=12)
        F.box(a - 0.05, -0.3 + 0.09, 0.8, (0.03, 0.02, 0.24), "lvWL")                        # a gloss on the glass
    F.box(0.34, -0.3, 1.23, (0.62, 0.05, 0.05), "gm")                                       # a feed pipe over them
    # stacked clean trays and a cup stack on the open counter
    for k in range(4):
        F.box(0.42, 0.14, 0.67 + k * 0.035, (0.26, 0.2, 0.03), "medWhite" if k % 2 == 0 else "lvW", top="lvWL",
              bevel=0.006)
    for k, a in enumerate((0.78, 0.86)):
        F.cyl(a, 0.16 - 0.1 * k, 0.67, 0.05, 0.16 - 0.04 * k, "steelL", top="dark", sides=8, rtop=0.06)
    F.box(0.86, 0.34, 0.67, (0.06, 0.06, 0.1), "orange" if active else "steelD")            # status light
    return [m.build()]


# ---- rations -----------------------------------------------------------------------------------------------------

def _pack(m, x, y, z, rz=0.0, k=1.0):
    """One meal tray seen from above: a cream tray with a darker rim, the food in its compartments (an orange main,
    a green and a brown side). The food itself is the accent, so it never reads as medical (white and red) or cash."""
    c, s = math.cos(rz), math.sin(rz)
    R = lambda u, v: (x + u * c - v * s, y + u * s + v * c)  # noqa: E731
    m.box((x, y, z), (0.25 * k, 0.19 * k, 0.05 * k), "lvW2", top="lvW", rz=rz, base=True, bevel=0.01)
    m.box((x, y, z + 0.035 * k), (0.255 * k, 0.195 * k, 0.012 * k), "lvWS", rz=rz, base=True)
    for (u, v, w, d, col) in ((-0.045, 0.0, 0.12, 0.15, ACCENT), (0.07, -0.04, 0.08, 0.07, "pcb"),
                              (0.07, 0.045, 0.08, 0.07, "rust")):
        px, py = R(u * k, v * k)
        m.box((px, py, z + 0.05 * k), (w * k, d * k, 0.012 * k), col, rz=rz, base=True)


def ration(size):
    """A neat stack of sealed trays: s two, m a stack of four and two beside it, l two stacks on a low crate tray."""
    m = core.Mesh(f"ration_{size}")
    h = 0.062
    if size == "s":
        for k in range(2):
            _pack(m, 0.0, 0.0, k * h, 0.25 + 0.08 * k)
    elif size == "m":
        for k in range(4):
            _pack(m, -0.08, -0.04, k * h, 0.2 + 0.05 * (k % 2))
        for k in range(2):
            _pack(m, 0.18, 0.16, k * h, -0.35)
    else:
        m.box((0, 0, 0), (0.66, 0.5, 0.08), "steelD", top="steel", base=True, bevel=0.01)          # crate tray
        m.box((0, 0.255, 0.0), (0.66, 0.02, 0.12), "gm", base=True)
        for (x, y, n) in ((-0.15, -0.09, 4), (0.15, -0.09, 3), (-0.15, 0.12, 3), (0.15, 0.12, 4)):
            for k in range(n):
                _pack(m, x, y, 0.08 + k * h, 0.0, 0.9)
    return [_fin(m, STACK_K)]


def ration_held():
    m = core.Mesh("ration_held")
    _pack(m, 0, 0, 0, 0.3, 0.9)
    return [_fin(m, HELD_K)]


SPRITES = []
for _r in range(4):
    _fp = (2, 1) if _r % 2 == 0 else (1, 2)
    SPRITES.append((f"module.galley.r{_r}", _fp, "prop", lambda r=_r: galley(r, False)))
    SPRITES.append((f"module.galley.r{_r}.active", _fp, "prop", lambda r=_r: galley(r, True)))
SPRITES.append(("module.galley", (2, 1), "prop", lambda: galley(0, False)))
SPRITES += [(f"item.ration.{_s}", (1, 1), "prop", lambda s=_s: ration(s)) for _s in ("s", "m", "l")]
SPRITES.append(("item.ration.held", (1, 1), "prop", ration_held))
