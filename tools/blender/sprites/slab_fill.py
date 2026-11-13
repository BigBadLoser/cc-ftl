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
right with or without the slab, since a slab layer only covers it where the slab is in front. Three takes on a bay:
  e1  sockets only
  e2  marked: a striped front lip on each socket, an amber vacancy lamp on its back wall (hidden behind a slab)
  e3  plumbed: each bay's umbilical hangs from a coupling on the spindle and plugs into the socket's back wall
      (behind a slab it reads as plugged into the slab's back)"""
import math

from . import slab_load as LD
from . import slab_wheel as W
from .modkit import K
from .slab_kit import angles, at, bolts, cassette, frame, ring, tube

FP = (3, 3)


def spindle(k):
    """The rotor's spindle, from the deck up into the canopy's plug: bands and seams so it reads as turned steel."""
    z0, z1 = W.Z0 - 0.02, W.ZC + 0.1
    k.cyl(0, 0, z0, 0.42, z1 - z0, "steelD", sides=40)
    for z in (z0, z0 + 0.55, z0 + 1.1):
        ring(k, 0.425, z, 0.06, 0.03, "steel", top="steelL", n=40)
    for i in range(10):
        a = (i + 0.5) * math.tau / 10 + math.radians(45)
        k.box(*at(0.425, a)[:2], z0 + 0.06, 0.045, 0.02, 1.0, "dark", rz=a + math.pi / 2)


def deck(k):
    """Seams between the bays and a bolt ring on the rotor's deck."""
    z = W.Z0 - 0.025
    for th in angles():
        a = th + math.radians(18)
        k.box(*at(0.86, a)[:2], z, 0.72, 0.045, 0.012, "steelD", rz=a)
    bolts(k, 0.5, z + 0.005, 20, s=0.05, col="steel")


def bay(k, i, style):
    s = frame(angles()[i], W.Z0)
    if style == "e2":
        for j in range(8):                                                   # a striped front lip
            w0 = -0.45 + j * 0.1125
            s.box(k, 0.0, 0.042, w0, w0 + 0.1125, 0.07, 0.102, "hazY" if j % 2 else "hazK")
        s.box(k, 0.14, 0.17, -0.07, 0.07, -0.32, -0.28, "slbAmb")              # the vacancy lamp
    elif style == "e3":
        back = s.p(0.12, 0.0, -0.3)
        a = math.atan2(back[1], back[0])
        c = (*at(0.44, a)[:2], W.Z0 + 0.95)
        k.box(*at(0.44, a)[:2], W.Z0 + 0.88, 0.07, 0.16, 0.16, "steel", top="steelL", rz=a + math.pi / 2)
        k.box(*at(0.48, a)[:2], W.Z0 + 0.91, 0.03, 0.1, 0.1, "hazY", rz=a + math.pi / 2)
        sag = ((c[0] + back[0]) / 2, (c[1] + back[1]) / 2, W.Z0 + 0.35)
        tube(k, (*at(0.5, a)[:2], c[2]), sag, 0.03, "dark")
        tube(k, sag, (back[0], back[1], back[2] + 0.06), 0.03, "dark")
        s.box(k, 0.12, 0.2, -0.06, 0.06, -0.33, -0.25, "hazY")                  # the plug


def module(k, empty, style="e1"):
    out = W.geneva_over_tyres(k, LD.P, lights=LD.LAMP, empty=empty, gap=LD.GAP)
    LD.hatch(k, LD.DEEP, 1.0)
    spindle(k)
    deck(k)
    for i in empty:
        bay(k, i, style)
    return out


def base(k, style="e1"):
    module(k, tuple(range(10)), style)
    return [frame(th, W.Z0) for th in angles()]


def full(k):
    return module(k, ())


def slot(i):
    def go():
        k = K(f"slab_fb_slot{i}", FP)
        cassette(k, frame(angles()[i], W.Z0))
        return k.build()
    return go


DESIGNS = {"fb": (base, FP), "ff": (full, FP),
           **{v: ((lambda k, v=v: base(k, v)), FP) for v in ("e1", "e2", "e3")}}
OVERLAYS = {"fb": [(slot(i), 255) for i in range(10)]}
PIT = {v: LD.r_hole for v in DESIGNS}
