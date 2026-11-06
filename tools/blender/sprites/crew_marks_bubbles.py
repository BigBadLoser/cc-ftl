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
CX, CY = 16, 13.5                                      # the bubble's centre; the puffs trail below it to the left
RIM = 2


def ell(c, x, y, rx, ry=None):
    return ((c.cx - x) / rx) ** 2 + ((c.cy - y) / (ry or rx)) ** 2 <= 1.0


def polar(c, r):
    """Inside a closed curve given as radius r(angle) round the centre (y squashed by 0.86)."""
    dx, dy = c.cx - CX, (c.cy - CY) / 0.86
    return np.hypot(dx, dy) <= r(np.arctan2(-dy, dx))


def regular(c, n, rad, rot):
    return c.inside([(CX + math.cos(rot + k * math.tau / n) * rad, CY - math.sin(rot + k * math.tau / n) * rad * 0.86)
                     for k in range(n)])


def cloud(c, f):
    m = np.zeros((c.h, c.w), bool)
    for x, y, r in ((9.6, 10.2, 6.0), (16, 8.0, 6.6), (22.4, 10.2, 6.0), (24.4, 16.2, 5.4), (16, 19.0, 6.2), (7.6, 16.2, 5.4),
                    (16, 13.5, 8.6)):
        m |= ell(c, x, y, r)
    return m


SHAPES = {
    "tantrum": cloud,
    "despair": cloud,
    "panic": lambda c, f: polar(c, lambda a: 13.2 * (1 + 0.05 * np.sin(9 * a + f * 2.1))),
    "freeze": lambda c, f: regular(c, 6, 14.6, math.pi / 2),
    "hide": lambda c, f: (abs(c.cx - CX) <= 13.2) & (abs(c.cy - CY) <= 11.6) & ~(
        (abs(c.cx - CX) > 10.2) & (abs(c.cy - CY) > 8.6) & (np.hypot(abs(c.cx - CX) - 10.2, abs(c.cy - CY) - 8.6) > 3.0)),
    "refusal": lambda c, f: regular(c, 8, 14.2, math.pi / 8),
    "isolation": lambda c, f: ell(c, CX, CY, 12.6, 11.6),
}


def shrink(m, n):
    for _ in range(n):
        m = m & ~grow(~m)
    return m


def in_bubble(kind, sym, tier, f):
    """The symbol in its bubble: the rim and puffs in the tier colour, the inside dark, a dark ring round the symbol."""
    rim, fill = TIERS[tier]
    c = Canvas(sym.w, sym.h)
    shape = SHAPES[kind](c, f)
    c.mask(shape, rim)
    c.mask(shrink(shape, RIM), fill)
    c.mask(ell(c, 6.6, 27.0, 2.4), rim)
    c.mask(ell(c, 3.4, 30.0, 1.4), rim)
    s = sym.k != ""
    c.mask(grow(s) & ~s & shrink(shape, RIM), "K")
    c.k[s] = sym.k[s]
    return c
