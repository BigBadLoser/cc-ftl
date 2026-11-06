"""Ways to show a break's tier on its overhead symbol without a UI-looking plate (preview options, crew_marks.py).

  ring     the symbol's own outline in the tier colour, the dark outline outside it
  thought  a thought bubble behind the symbol (a mental state), dark inside, its rim in the tier colour, trailing puffs
  stress   comic stress lines at the symbol's four corners in the tier colour
  pips     one, two or three tier-coloured pips under the symbol

Each returns a Canvas-like key grid; preview ids are crew.mark.opt.<option>.<tier>.<kind>.<frame>."""
import numpy as np

from .crew_marks import BREAKS, COL, Canvas, H, W

TIER = {"mild": ("M", "m"), "moderate": ("A", "a"), "severe": ("R", "V")}
COL.setdefault("Z", "#ffffff")


def dilate(op):
    out = op.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        out |= np.roll(op, (dy, dx), (0, 1))
    return out


def over(base, k):
    m = k != ""
    base.k[m] = k[m]
    return base


def ring(sym, tier):
    rim = TIER[tier][0]
    op = sym.k != ""
    sym.k[dilate(op) & ~op] = rim                       # the dark outline goes on outside it (Canvas.rgba)
    return sym


def thought(sym, tier):
    rim, fill = TIER[tier]
    c = Canvas()
    for x, y, r in ((6, 6.5, 4.2), (10, 5.2, 4.6), (14, 6.5, 4.2), (15, 11, 4.0), (10, 13, 4.4), (5, 11, 4.0), (10, 9.5, 5.5)):
        c.disc(x, y, r, rim)
    inner = Canvas()
    for x, y, r in ((6, 6.5, 3.2), (10, 5.2, 3.6), (14, 6.5, 3.2), (15, 11, 3.0), (10, 13, 3.4), (5, 11, 3.0), (10, 9.5, 4.5)):
        inner.disc(x, y, r, fill)
    over(c, inner.k)
    c.disc(4.0, 17.2, 1.6, rim)
    c.disc(2.2, 19.0, 0.9, rim)
    return over(c, sym.k)


def stress(sym, tier):
    rim = TIER[tier][0]
    c = Canvas()
    for (x0, y0), (x1, y1) in (((1.6, 1.6), (3.6, 3.6)), ((18.4, 1.6), (16.4, 3.6)), ((1.6, 18.4), (3.6, 16.4)),
                               ((18.4, 18.4), (16.4, 16.4))):
        c.seg((x0, y0), (x1, y1), 0.85, rim)
    return over(c, sym.k)


def pips(sym, tier):
    rim = TIER[tier][0]
    n = {"mild": 1, "moderate": 2, "severe": 3}[tier]
    c = Canvas()
    over(c, np.roll(sym.k, -2, 0))                      # lifted two px to make room below
    x0 = 10 - (n * 4 - 2) // 2
    for i in range(n):
        c.rect(x0 + i * 4, 17, x0 + i * 4 + 1, 18, rim)
    return c


OPTIONS = {"ring": ring, "thought": thought, "stress": stress, "pips": pips}
KINDS = ("panic", "tantrum", "isolation", "freeze")


def items():
    out = []
    for name, fn in OPTIONS.items():
        for tier in TIER:
            for kind in KINDS:
                draw, n = BREAKS[kind]
                for f in range(n):
                    out.append({"id": f"crew.mark.opt.{name}.{tier}.{kind}.{f}", "rgba": fn(draw(f), tier).rgba(),
                                "ax": W // 2, "ay": H})
    return out
