"""Stasis slab storage, the bays' fittings (family `slab`, preview only; issue #116): the rotor's spindle and seamed
deck, and each bay's umbilical (round 28-31; see slab_fill.py). Used by every state of the module: the fill levels'
base and the loading frames."""
import math

from . import slab_wheel as W
from .slab_kit import angles, at, bolts, frame, ring, tube


def spindle(k):
    """The rotor's spindle, from the deck up into the canopy's plug: bands and seams so it reads as turned steel."""
    z0, z1 = W.Z0 - 0.02, W.ZC + 0.1
    k.cyl(0, 0, z0, 0.34, z1 - z0, "steelD", sides=40)
    for z in (z0, z0 + 0.55, z0 + 1.1):
        ring(k, 0.345, z, 0.06, 0.03, "steel", top="steelL", n=40)
    for i in range(10):
        a = (i + 0.5) * math.tau / 10 + math.radians(45)
        k.box(*at(0.345, a)[:2], z0 + 0.06, 0.045, 0.02, 1.0, "dark", rz=a + math.pi / 2)


def deck(k):
    """Seams between the bays and a bolt ring on the rotor's deck."""
    z = W.Z0 - 0.025
    for th in angles():
        a = th + math.radians(18)
        k.box(*at(0.86, a)[:2], z, 0.72, 0.045, 0.012, "steelD", rz=a)
    bolts(k, 0.5, z + 0.005, 20, s=0.05, col="steel")


def bay(k, i, vacant):
    s = frame(angles()[i], W.Z0)
    e = min((-1, 1), key=lambda e: math.hypot(*s.p(0.0, e, 0.0)[:2]))        # the slab's inner end (toward the spindle)
    plug = s.p(0.3, e * 0.5, -0.11)                                           # the hose's end, over the plug bracket
    a = math.atan2(plug[1], plug[0])
    top = (*at(0.38, a)[:2], W.Z0 + 0.98)
    k.box(*at(0.355, a)[:2], W.Z0 + 0.9, 0.07, 0.17, 0.17, "sole", top="sole", rz=a + math.pi / 2)    # the coupling
    k.box(*at(0.395, a)[:2], W.Z0 + 0.935, 0.03, 0.12, 0.1, "hazY", rz=a + math.pi / 2)              # its collar
    sag = ((top[0] + plug[0]) / 2, (top[1] + plug[1]) / 2, W.Z0 + 0.5)
    tube(k, top, sag, 0.045, "slbHose")
    tube(k, sag, plug, 0.045, "slbHose")
    s.box(k, 0.16, 0.3, *sorted((e * 0.53, e * 0.46)), -0.17, -0.05, "hazY")                 # the plug in its bracket
    s.box(k, 0.0, 0.16, *sorted((e * 0.53, e * 0.5)), -0.19, -0.03, "steel", face="steelL")  # the bracket on the inner cheek
    if vacant:
        s.box(k, 0.14, 0.17, -0.07, 0.07, -0.32, -0.28, "slbAmb")              # the vacancy lamp


def fittings(k, vacant=()):
    """The spindle, the deck's seams and every bay's umbilical; the amber lamp on those in `vacant`."""
    spindle(k)
    deck(k)
    for i in range(10):
        bay(k, i, i in vacant)

