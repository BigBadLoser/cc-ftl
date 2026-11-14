"""Vending machine look study, round 18 (family `vending18`, palette set vending, preview only): round 17a/c (user,
2026-11-13) cleaned up:

- the spikes' tops: the stroke back up ended at the very top of the next spike, beside its rounded start, and the
  two made a lump there. Now each spike swells quickly from a point (over its first 14%), and the stroke back up stops short,
  inside the spike, so the top is one clean peak.
- the pen line: its corners were rounded by the spline into blobs at the switchbacks. It is now a plain polyline
  (densified so r13's scribble leaves it unsmoothed): straight runs, sharp turns.

  vm1c18a 17a's six narrow teeth, 16c's pen line with sharp turns
  vm1c18b 17c's five long teeth, the same pen line
  vm1c18c 17a's teeth, the pen line closer to the reference: long, nearly parallel runs with tight hairpins

Uses r16's tooth and pen layout and r15's painter. Previews render with SPRITE_SAMPLES=64."""
from . import vending_r15 as V
from .vending_r16 import JIT, pen
from .vending_study import FP

P = V.P


def teeth(n, s0, ztop, zbot, fwd, wd, wu, d=1):
    """r16's ribbon with clean peaks: the down-stroke starts from a point, the stroke back up stops 80% of the way."""
    w = P / n
    out = []
    for k in range(n):
        top = (s0 + d * k * w, ztop + JIT[k % len(JIT)])
        bot = (s0 + d * (k * w + fwd), zbot - JIT[(k + 2) % len(JIT)])
        nxt = (s0 + d * (k + 1) * w, ztop + JIT[(k + 1) % len(JIT)] if k < n - 1 else ztop)
        end = (bot[0] + (nxt[0] - bot[0]) * 0.8, bot[1] + (nxt[1] - bot[1]) * 0.8)
        out += [([top, bot], wd, wd * 0.35, 0.14), ([bot, end], wu * 0.6, wu)]
    return out


def sharp(line, k=12):
    """A polyline densified (more than 40 points, so it is not splined): straight runs, sharp corners."""
    out = []
    for a, b in zip(line, line[1:]):
        out += [(a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k) for i in range(k)]
    return out + [line[-1]]


LOOKS = {
    "vm1c18a": dict(strokes=teeth(6, 40, 60, 10, 27, 15, 5, d=-1), lines=[sharp(pen(5, 45, 46, 25, 29, d=-1))]),
    "vm1c18b": dict(strokes=teeth(5, 40, 62, 6, 32, 16, 5, d=-1), lines=[sharp(pen(5, 45, 46, 25, 29, d=-1))]),
    "vm1c18c": dict(strokes=teeth(6, 40, 60, 10, 27, 15, 5, d=-1), lines=[sharp(pen(4, 45, 48, 24, 40, d=-1))]),
}


def make(name):
    V.LOOKS[name] = LOOKS[name]
    return V.make(name)


DESIGNS = {n: make(n) for n in LOOKS}


def jobs():
    return [(f"module.vending18.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
