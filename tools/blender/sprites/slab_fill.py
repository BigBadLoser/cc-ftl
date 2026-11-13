"""Stasis slab storage, fill levels (family `slab`, preview only; issue #116): the module is built in layers so any set
of the ten slots can be full without a sprite per state. The Geneva drive indexes in whole 36 deg steps, so at rest the
slabs always stand at the same ten places, whichever way the wheel has turned:

  fb        the base: the module with every socket empty (sockets and head clamps stay), the hatch shut
  fb.ov<i>  slot i's slab alone, the base held out (where the canopy, wall or jambs cover it, it is cut away)
  fb.face<i> slot i's face mask, the base held out (the press's mask)
  ff        a reference: the same module with all ten slabs in one render (to diff a full stack against)

A fill level is the base, then each full slot's slab and its pressed face, back to front (review/slab_fill_preview.py
composites and checks them). Slabs never overlap at rest, so a fixed back-to-front order composites them right."""
from . import slab_load as LD
from . import slab_wheel as W
from .modkit import K
from .slab_kit import angles, cassette, frame

FP = (3, 3)


def module(k, empty):
    out = W.geneva_over_tyres(k, LD.P, lights=LD.LAMP, empty=empty, gap=LD.GAP)
    LD.hatch(k, LD.DEEP, 1.0)
    return out


def base(k):
    module(k, tuple(range(10)))
    return [frame(th, W.Z0) for th in angles()]          # every slot's frame: the face masks


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
