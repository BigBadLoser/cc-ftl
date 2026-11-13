"""Vending machine look study, round 16 (family `vending16`, palette set vending, preview only): the full wrap redone
from the reference (user, 2026-11-13: "the blue is more of a continuous zig zag, and the purple doesn't really
loop"). Both pieces are single paths once round the machine, seamless at the back:

- teal: one brush ribbon zigzagging round the body. Each tooth is a long wide down-stroke that tapers to a dry
  point at the bottom, then a narrower stroke back up to the next tooth, which starts behind where this one ended
  so the teeth overlap (a first try with teeth side by side left one lone tooth per face).
- purple: a pen line zigzagging with sharp switchbacks: long runs down one way, a hairpin, a shorter run back up,
  the magenta shadow riding beside it. No loops.

  vm1c16a falling: the reference's direction (teeth run down towards the back of the right side), six teeth
  vm1c16b tight: the same direction, seven shallower teeth in a narrower band, the pen line lower and longer
  vm1c16c rising: the bold cup's direction (teeth run down towards the front), six teeth

Uses r13's wrap coordinate signed and r15's painter (periodic over P). Previews render with SPRITE_SAMPLES=64."""
from . import vending_r15 as V
from .vending_study import FP

P = V.P
JIT = [0, 3, -2, 4, -1, 2, -3]


def teeth(n, s0, ztop, zbot, fwd, wd, wu, d=1):
    """The teal ribbon: n teeth once round, each a long wide down-stroke `fwd` px on, then a narrower stroke back
    up to the next tooth's top, which starts behind where this one ended (they overlap, as in the reference)."""
    w = P / n
    out = []
    for k in range(n):
        top = (s0 + d * k * w, ztop + JIT[k % len(JIT)])
        bot = (s0 + d * (k * w + fwd), zbot - JIT[(k + 2) % len(JIT)])
        nxt = (s0 + d * (k + 1) * w, ztop + JIT[(k + 1) % len(JIT)] if k < n - 1 else ztop)
        out += [([top, bot], wd, wd * 0.35), ([bot, nxt], wu * 0.6, wu)]
    return out


def pen(n, s0, zhi, zlo, fwd, d=1):
    """The purple line: n switchbacks once round; each runs `fwd` px on and down, then back up to make P/n net."""
    w, s, pts = P / n, s0, [(s0, zhi)]
    for k in range(n):
        pts.append((s + d * fwd, zlo + JIT[(k + 1) % n]))
        s += d * w
        pts.append((s, zhi + JIT[(k + 3) % n] if k < n - 1 else zhi))
    return pts


LOOKS = {
    "vm1c16a": dict(strokes=teeth(6, -40, 54, 16, 27, 15, 8),
                    lines=[pen(5, -45, 46, 25, 29)]),
    "vm1c16b": dict(strokes=teeth(7, -40, 50, 20, 23, 13, 7),
                    lines=[pen(6, -45, 40, 20, 26)]),
    "vm1c16c": dict(strokes=teeth(6, 40, 54, 16, 27, 15, 8, d=-1),
                    lines=[pen(5, 45, 46, 25, 29, d=-1)]),
}


def make(name):
    V.LOOKS[name] = LOOKS[name]
    return V.make(name)


DESIGNS = {n: make(n) for n in LOOKS}


def jobs():
    return [(f"module.vending16.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
