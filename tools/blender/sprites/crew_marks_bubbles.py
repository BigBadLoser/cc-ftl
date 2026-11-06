"""The thought bubbles behind the break symbols (crew_marks.py): a mental state, so a thought bubble, its outline echoing its
symbol, its rim in the tier colour (neutral, amber, red), dark inside, two round puffs trailing down towards the head.

  tantrum, despair   a cloud, lumpy like the cloud inside it
  panic              a shaky oval whose edge wobbles each frame
  freeze             an ice-crystal hexagon, point up
  hide               a box
  refusal            a stop-sign octagon
  isolation          a plain circle, the figure alone in it"""
import math

import numpy as np

from .crew_marks import Canvas, grow

TIERS = {"mild": ("M", "m"), "moderate": ("A", "a"), "severe": ("R", "V")}
CX, CY = 16, 13.6                                      # the bubble's centre; the puffs trail below it to the left
RIM = 2


def ell(c, x, y, rx, ry=None):
    return ((c.cx - x) / rx) ** 2 + ((c.cy - y) / (ry or rx)) ** 2 <= 1.0


def polar(c, r):
    """Inside a closed curve given as radius r(angle) round the centre (y squashed by 0.86)."""
    dx, dy = c.cx - CX, (c.cy - CY) / 0.86
    return np.hypot(dx, dy) <= r(np.arctan2(-dy, dx))


def regular(c, n, rad, rot, sq=0.86):
    return c.inside([(CX + math.cos(rot + k * math.tau / n) * rad, CY - math.sin(rot + k * math.tau / n) * rad * sq)
                     for k in range(n)])


def cloud(c, f):
    m = np.zeros((c.h, c.w), bool)
    for x, y, r in ((9, 9.8, 6.0), (16, 7.8, 6.6), (23, 9.8, 6.0), (25, 16.6, 5.4), (16, 19.6, 6.2), (7, 16.6, 5.4),
                    (16, 13.6, 9.0)):
        m |= ell(c, x, y, r)
    return m


SHAPES = {
    "tantrum": cloud,
    "despair": cloud,
    "panic": lambda c, f: polar(c, lambda a: 13.8 * (1 + 0.045 * np.sin(9 * a + f * 2.1))),
    "freeze": lambda c, f: regular(c, 6, 15.4, math.pi / 2, 0.78),
    "hide": lambda c, f: (abs(c.cx - CX) <= 14.2) & (abs(c.cy - CY) <= 11.8) & ~(
        (abs(c.cx - CX) > 11.2) & (abs(c.cy - CY) > 8.8) & (np.hypot(abs(c.cx - CX) - 11.2, abs(c.cy - CY) - 8.8) > 3.0)),
    "refusal": lambda c, f: regular(c, 8, 15.0, math.pi / 8, 0.82),
    "isolation": lambda c, f: ell(c, CX, CY, 13.6, 12.2),
}


def shrink(m, n):
    for _ in range(n):
        m = m & ~grow(~m)
    return m


def in_bubble(kind, sym, tier, f):
    """The symbol in its bubble: the rim and puffs in the tier colour, the inside dark."""
    rim, fill = TIERS[tier]
    c = Canvas(sym.w, sym.h)
    shape = SHAPES[kind](c, f)
    c.mask(shape, rim)
    c.mask(shrink(shape, RIM), fill)
    c.mask(ell(c, 6.6, 26.8, 2.0), rim)                    # two puffs, apart
    c.mask(ell(c, 2.6, 30.0, 1.1), rim)
    s = sym.k != ""                                    # on the dark inside the symbol needs no outline of its own
    c.k[s] = sym.k[s]
    return c
