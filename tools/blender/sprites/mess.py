"""Mess furniture for the food pack: a 2x1 mess table and a 1x1 chair, in the galley's cream and stainless (grid frame,
origin = centre of the front-most footprint tile at floor level; local frames and rotations as galley._Frame).

- module.mess_table.r<r>: a stainless top on two pedestals with a cream edge band and a condiment caddy; `.meal` has two
  meal trays and cups set on it (for while crew eat there).
- module.chair.r<r>: a moulded mess chair on a pedestal, seat top at human_sit.SEAT_Z (0.39) so the sit clips fit. The
  seated crew member faces the way the chair does, as consoles.SEAT_DIR: r0 -y, r1 +x, r2 +y, r3 -x.
- module.chair.front.r<r> (r0, r3 only, where the backrest is on the camera side): the backrest alone, drawn over a
  seated crew member (the console desk-front trick)."""
import math

from . import core
from .galley import _Frame, _pack

SEAT_DIR = {0: 6, 1: 0, 2: 2, 3: 4}          # crew direction when seated, per chair rotation (as consoles.SEAT_DIR)
FRONT = (0, 3)                               # rotations whose backrest is between the camera and a seated crew member


def table(rot, meal):
    m = core.Mesh(f"mess_table_{rot}_{int(meal)}")
    F = _Frame(m, (2, 1), rot)
    for a in (-0.55, 0.55):
        F.cyl(a, 0.0, 0.0, 0.22, 0.03, "steelD", top="steel", sides=10)                     # pedestal feet
        F.cyl(a, 0.0, 0.03, 0.06, 0.55, "steelL", top="steel", sides=8)
    F.box(0.0, 0.0, 0.26, (1.1, 0.08, 0.06), "gm")                                          # stretcher
    F.box(0.0, 0.0, 0.56, (1.86, 0.84, 0.04), "lvW2", top="lvW", bevel=0.012)               # cream edge band
    F.box(0.0, 0.0, 0.6, (1.82, 0.8, 0.03), "steel", top="steelL", bevel=0.008)              # stainless top
    F.box(0.0, 0.0, 0.63, (0.22, 0.12, 0.04), "gm", top="steel", bevel=0.006)               # condiment caddy
    F.cyl(-0.05, 0.0, 0.67, 0.025, 0.1, "medRed", top="lvW", sides=6)
    F.cyl(0.05, 0.0, 0.67, 0.025, 0.08, "hazY", top="lvW", sides=6)
    if meal:
        for a, b, rz in ((-0.5, 0.2, 0.0), (0.45, -0.2, math.pi)):
            x, y = F.P(a, b)
            _pack(m, x, y, 0.63, rz + F.th, 1.0)
            cx, cy = F.P(a + 0.22, b)
            m.cyl((cx, cy, 0.63), 0.04, 0.08, "steelL", sides=8, top="dark")                  # cups
    return [m.build()]


def _back(F):
    F.box(0.0, 0.2, 0.36, (0.42, 0.06, 0.38), "lvW2", top="lvW", rx=-0.12, bevel=0.025)      # backrest
    F.box(0.0, 0.17, 0.5, (0.34, 0.012, 0.2), "lvR", rx=-0.12)                               # its pad
    F.box(0.0, 0.2, 0.28, (0.06, 0.05, 0.12), "steelL")                                     # spine to the seat


def chair(rot, part="full"):
    """Faces local -b (back at +b). part: full | back (the backrest alone, for the front overlay)."""
    m = core.Mesh(f"chair_{rot}_{part}")
    F = _Frame(m, (1, 1), rot)
    if part != "back":
        F.cyl(0.0, 0.02, 0.0, 0.2, 0.03, "steelD", top="steel", sides=10)                   # pedestal foot
        F.cyl(0.0, 0.02, 0.03, 0.045, 0.24, "steelL", top="steel", sides=8)
        F.box(0.0, 0.0, 0.27, (0.44, 0.42, 0.08), "lvW2", top="lvW", bevel=0.025)            # moulded seat
        F.box(0.0, -0.01, 0.35, (0.36, 0.34, 0.04), "lvR", top="lvR")                        # seat pad: top 0.39
    _back(F)
    return [m.build()]


SPRITES = []
for _r in range(4):
    _fp = (2, 1) if _r % 2 == 0 else (1, 2)
    SPRITES.append((f"module.mess_table.r{_r}", _fp, "prop", lambda r=_r: table(r, False)))
    SPRITES.append((f"module.mess_table.r{_r}.meal", _fp, "prop", lambda r=_r: table(r, True)))
    SPRITES.append((f"module.chair.r{_r}", (1, 1), "prop", lambda r=_r: chair(r)))
    if _r in FRONT:
        SPRITES.append((f"module.chair.front.r{_r}", (1, 1), "prop", lambda r=_r: chair(r, "back")))
