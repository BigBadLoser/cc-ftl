"""Stasis slab storage, fill levels (family `slab`, preview only; issue #116): the module is built in layers so any set
of the ten slots can be full without a sprite per state. The Geneva drive indexes in whole 36 deg steps, so at rest the
slabs always stand at the same ten places, whichever way the wheel has turned:

  fb        the base: the module with every socket empty (sockets and head clamps stay), the hatch shut
  fb.ov<i>  slot i's slab alone, the base held out (where the canopy, wall or jambs cover it, it is cut away)
  fb.face<i> slot i's face mask, the base held out (the press's mask)
  ff        a reference: the same module with all ten slabs in one render (to diff a full stack against)

A fill level is the base, then each full slot's slab and its pressed face, back to front (review/slab_fill_preview.py
composites and checks them). Slabs never overlap at rest, so a fixed back-to-front order composites them right.

Round 28 (the empty state "just looks like blocks"): every socket is a recess with a docking pad, the deck is seamed
and bolted, and a spindle runs from the deck up to the crown (the rotor in one piece). What the base draws must read
right with or without the slab, since a slab layer only covers it where the slab is in front. Round 29 (e3 picked, with
heavier hoses and the amber lamp): each bay's umbilical hangs from a coupling on the spindle to a plug bracket on the
socket's inner cheek, against the slab's inner end (behind a slab is the next slab's room: a hose there would run
through it). The same hose reads parked when the bay is empty and connected when it is full. An empty bay's amber
vacancy lamp sits on the socket's back wall, behind the slab when one stands there."""
import math

from . import slab_load as LD
from . import slab_wheel as W
from .modkit import K
from .slab_kit import angles, at, bolts, cassette, frame, ring, tube

FP = (3, 3)


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
    tube(k, top, sag, 0.045, "medRed")
    tube(k, sag, plug, 0.045, "medRed")
    s.box(k, 0.16, 0.3, *sorted((e * 0.53, e * 0.46)), -0.17, -0.05, "hazY")                 # the plug in its bracket
    s.box(k, 0.0, 0.16, *sorted((e * 0.53, e * 0.5)), -0.19, -0.03, "steel", face="steelL")  # the bracket on the inner cheek
    if vacant:
        s.box(k, 0.14, 0.17, -0.07, 0.07, -0.32, -0.28, "slbAmb")              # the vacancy lamp


def module(k, empty):
    out = W.geneva_over_tyres(k, LD.P, lights=LD.LAMP, empty=empty, gap=LD.GAP)
    LD.hatch(k, LD.DEEP, 1.0)
    spindle(k)
    deck(k)
    for i in range(10):
        bay(k, i, i in empty)
    return out


def base(k):
    module(k, tuple(range(10)))
    return [frame(th, W.Z0) for th in angles()]


def full(k):
    return module(k, ())


def slot(i):
    def go():
        k = K(f"slab_fb_slot{i}", FP)
        cassette(k, frame(angles()[i], W.Z0))
        return k.build()
    return go


DESIGNS = {"fb": (base, FP), "ff": (full, FP)}
OVERLAYS = {"fb": [(slot(i), 255) for i in range(10)]}
PIT = {v: LD.r_hole for v in DESIGNS}
