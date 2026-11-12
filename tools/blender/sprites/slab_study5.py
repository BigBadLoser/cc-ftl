"""Stasis slab look study, round 5 (family `slab`, preview only; issue #116): the flap wheel with turned blades (round
4's s10b) is the storage, the cassette (round 3) the slab. Three variants of the wheel with detail (3x3, r0, twelve
cassettes turned 40 deg off radial so the faces on the near side fan open to the room):

  s13  machined: a stepped plinth with a geared track and a lit slot light at each blade's foot, guide rails between
       the blades up to an emitter crown (a light over each blade, segmented rim lights, a vented hub and beacon), a lit
       core with conduits, and a console on a pedestal in the front corner of the footprint
  s14  suspended: light and open: the blades hang in the field from a white halo ring on spokes, clear of a shallow
       glowing basin, a lamp over each, a slim core
  s15  armoured vault: a curved armour shell round the back half (hiding the blades' backs), ribbed, a framed opening
       to the room with amber light down its pillars, a hazard-striped plinth, a cap with an amber beacon"""
import math

from .modkit import K
from .slab_study3 import SlabF, cassette

UP = (0.0, 0.0, 1.0)
N12, SKEW, R0 = 12, math.radians(40), 1.0


def blades(k, z0, body="slbGr", caps="dark"):
    out = []
    for i in range(N12):
        th = math.radians(45 + 360 * i / N12)
        ts = th - SKEW
        O = (R0 * math.cos(th), R0 * math.sin(th), z0)
        out.append(cassette(k, SlabF(O, UP, (-math.sin(ts), math.cos(ts), 0.0)), body, caps))
    return out


def ring(k, r, z, h, w, col, top=None, n=40, skip=None):
    """A ring of n segments at radius r: w wide (radially), h tall. skip(a): leave the segment at angle a out."""
    for i in range(n):
        a = (i + 0.5) * math.tau / n
        if skip and skip(a):
            continue
        k.box(r * math.cos(a), r * math.sin(a), z, math.tau * r / n * 1.08, w, h, col, top=top, rz=a + math.pi / 2)


def slot_angles():
    return [math.radians(45 + 360 * i / N12) for i in range(N12)]


def machined(k):
    """s13."""
    k.cyl(0, 0, 0.0, 1.5, 0.06, "dark", top="steelD", sides=48)
    k.cyl(0, 0, 0.06, 1.42, 0.08, "steelD", top="steel", sides=48)
    ring(k, 1.45, 0.06, 0.06, 0.05, "dark", top="steelD", n=48, skip=lambda a: int(a / math.tau * 48) % 2)   # teeth
    for a in slot_angles():                                                  # a slot light at each blade's foot
        a2 = a + math.radians(14)
        k.box(1.3 * math.cos(a2), 1.3 * math.sin(a2), 0.14, 0.12, 0.05, 0.012, "slbCy", rz=a2 + math.pi / 2)
    k.cyl(0, 0, 0.14, 0.52, 2.08, "slbGr", top="slbGrL", sides=16)          # the core
    for i in range(6):
        a = math.radians(15 + 60 * i)
        k.box(0.525 * math.cos(a), 0.525 * math.sin(a), 0.3, 0.04, 0.04, 1.8, "slbCy", rz=a)
    k.cyl(0, 0, 1.1, 0.535, 0.05, "steel", top="steelL", sides=16)
    out = blades(k, 0.16)
    for a in slot_angles():                                                  # guide rails between the blades
        a2 = a + math.radians(15)
        k.box(1.44 * math.cos(a2), 1.44 * math.sin(a2), 0.14, 0.05, 0.05, 2.12, "steel", top="steelL")
    k.cyl(0, 0, 2.26, 1.48, 0.12, "dark", top="steelD", sides=48)           # the crown
    ring(k, 1.485, 2.3, 0.03, 0.01, "slbCy", n=48, skip=lambda a: int(a / math.tau * 48) % 4 == 0)
    for a in slot_angles():                                                  # an emitter over each blade
        k.box(1.0 * math.cos(a), 1.0 * math.sin(a), 2.235, 0.5, 0.1, 0.025, "slbCy", rz=a - SKEW)
    k.cyl(0, 0, 2.38, 0.62, 0.12, "slbGr", top="slbGrL", sides=16)          # the hub
    for i in range(8):
        a = math.radians(22.5 + 45 * i)
        k.box(0.45 * math.cos(a), 0.45 * math.sin(a), 2.5, 0.14, 0.06, 0.012, "dark", rz=a + math.pi / 2)
    k.cyl(0, 0, 2.5, 0.12, 0.08, "slbCy", top="slbCy", sides=10)
    d = -math.pi / 4                                                         # the console, front corner, facing out
    c = lambda r: (r * math.cos(math.pi / 4), r * math.sin(math.pi / 4))  # noqa: E731
    k.box(*c(1.66), 0.0, 0.6, 0.46, 0.1, "dark", top="steelD", rz=d)
    k.box(*c(1.62), 0.1, 0.44, 0.3, 0.9, "slbGr", top="slbGrL", rz=d)
    k.box(*c(1.66), 1.0, 0.56, 0.36, 0.08, "steelD", top="dark", rz=d)
    k.box(*c(1.775), 0.5, 0.36, 0.012, 0.42, "dark", rz=d)                 # its screen
    for z, w, col in ((0.56, 0.28, "slbCy"), (0.66, 0.2, "slbCy"), (0.76, 0.24, "green"), (0.84, 0.12, "slbAmb")):
        k.box(*c(1.783), z, w, 0.006, 0.04, col, rz=d)
    k.box(*c(1.665), 1.08, 0.4, 0.2, 0.012, "slbCy", rz=d)
    return out


def suspended(k):
    """s14."""
    k.cyl(0, 0, 0.0, 1.48, 0.08, "plate", top="medWhite", sides=48)          # the basin
    k.cyl(0, 0, 0.08, 1.3, 0.006, "slbCy", sides=48)
    ring(k, 1.4, 0.08, 0.02, 0.03, "slbCy", n=48)
    k.cyl(0, 0, 0.08, 0.3, 2.5, "plate", top="medWhite", sides=16)           # the slim core
    k.cyl(0, 0, 1.2, 0.31, 0.06, "slbCy", sides=16)
    out = blades(k, 0.34, body="slbFaceL", caps="plate")
    ring(k, 1.42, 2.46, 0.1, 0.1, "plate", top="medWhite", n=48)              # the halo ring
    ring(k, 1.475, 2.48, 0.03, 0.012, "slbCy", n=48)
    for i in range(6):                                                       # its spokes
        a = math.radians(15 + 60 * i)
        k.box(0.85 * math.cos(a), 0.85 * math.sin(a), 2.5, 1.12, 0.07, 0.06, "plate", top="medWhite", rz=a)
    k.cyl(0, 0, 2.46, 0.36, 0.14, "plate", top="medWhite", sides=16)
    for a in slot_angles():                                                  # hangers and a lamp over each blade
        k.box(1.0 * math.cos(a), 1.0 * math.sin(a), 2.34, 0.05, 0.05, 0.16, "steel", top="steelL")
        k.cyl(1.0 * math.cos(a), 1.0 * math.sin(a), 2.44, 0.07, 0.03, "slbCy", sides=10)
    return out


def vault(k):
    """s15."""
    k.cyl(0, 0, 0.0, 1.5, 0.14, "dark", top="steelD", sides=48)
    ring(k, 1.5, 0.03, 0.08, 0.012, "slbHaz", n=48, skip=lambda a: int(a / math.tau * 48) % 2)
    k.cyl(0, 0, 0.14, 0.5, 2.2, "slbGr", top="slbGrL", sides=16)
    out = blades(k, 0.16)
    lo, hi = math.radians(5), math.radians(85)                            # the opening toward the room
    is_open = lambda a: lo < ((a + math.pi) % math.tau) - math.pi < hi      # noqa: E731
    ring(k, 1.45, 0.14, 2.26, 0.08, "slbGr", top="slbGrL", n=48, skip=is_open)   # the shell
    for i in range(16):                                                      # its ribs
        a = (i + 0.5) * math.tau / 16
        if not is_open(a):
            k.box(1.5 * math.cos(a), 1.5 * math.sin(a), 0.14, 0.1, 0.06, 2.26, "dark", top="steelD", rz=a + math.pi / 2)
    for a in (lo, hi):                                                       # the opening's pillars
        k.box(1.47 * math.cos(a), 1.47 * math.sin(a), 0.14, 0.2, 0.16, 2.26, "dark", top="steelD", rz=a + math.pi / 2)
        k.box(1.56 * math.cos(a), 1.56 * math.sin(a), 0.3, 0.04, 0.04, 1.9, "slbAmb", rz=a + math.pi / 2)
    k.box(1.28, 1.28, 0.14, 1.0, 0.16, 0.03, "slbHaz", rz=-math.pi / 4)        # the loading lip
    k.cyl(0, 0, 2.4, 1.54, 0.14, "dark", top="steelD", sides=48)            # the cap
    ring(k, 1.545, 2.44, 0.04, 0.012, "slbAmb", n=48, skip=lambda a: int(a / math.tau * 48) % 3 == 0)
    k.cyl(0, 0, 2.54, 0.4, 0.1, "slbGr", top="slbGrL", sides=16)
    k.cyl(0, 0, 2.64, 0.12, 0.12, "slbAmb", top="slbAmb", sides=12)          # the beacon
    return out


DESIGNS = {"s13": (machined, (3, 3)), "s14": (suspended, (3, 3)), "s15": (vault, (3, 3))}
assert K
