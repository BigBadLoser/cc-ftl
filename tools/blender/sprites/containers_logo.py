"""Shipping company logos for the cargo containers (family `containers`): painted panels on both long sides above the
livery band, as overlay sprites in fixed colours (a company's colours are its own, over any faction's livery):

  container.<W>x<H>.r<N>.<end>.logo.<company>   the shell is a holdout (it hides the far side's panel, draws nothing)

The game mirrors container sprites for the sides it does not render, so every logo is symmetric about its middle: an
emblem with a symmetric monogram, matching bars either side; it reads the same mirrored. Companies:
  halvard   Halvard Freight     an orange hexagon with an H, on charcoal
  meridian  Meridian Orbital    a white orbit ring with an M, on blue
  vantor    Vantor Bulk         yellow double chevrons, on green
  talos     Talos Shipping      a red diamond with a white T, on white, black bars"""
import math

from . import containers as C
from .modkit import K

GN = 32                                   # pattern cells per tile (one per pixel at game scale)
FONT = {"H": ("101", "101", "111", "101", "101"), "M": ("101", "111", "111", "101", "101"),
        "T": ("111", "010", "010", "010", "010")}
LOGOS = {  # panel, emblem, letter, bars
    "halvard": ("dark", "hivis", "lvW", "hivis", "hex", "H"),
    "meridian": ("polyB", "medWhite", "medWhite", "medWhite", "ring", None),
    "vantor": ("pcb", "hazY", None, "hazY", "chev", None),
    "talos": ("medWhite", "medRed", "medWhite", "hazK", "diamond", "T"),
}
EMBLEM = {
    "hex": lambda x, y: 4.6 <= max(abs(y), abs(x) * 0.866 + abs(y) * 0.5) <= 6.6,
    "ring": lambda x, y: 4.8 <= math.hypot(x, y) <= 6.6 or math.hypot(x - 4.8, y - 3.2) <= 1.4,
    "chev": lambda x, y: any(abs(y - (o - abs(x) * 0.95)) < 1.1 for o in (4.5, -0.5)) and abs(x) < 6.5,
    "diamond": lambda x, y: abs(x) + abs(y) <= 6.6,
}


def _cell(company, nu, nv):
    panel, emb, letter, bars, shape, mono = LOGOS[company]
    cx, cy = (nu - 1) / 2, (nv - 1) / 2
    glyph = FONT.get(mono)

    def fn(i, j):
        if i in (0, nu - 1) or j in (0, nv - 1):
            return "gmD"                                                             # the panel's rim
        x, y = i - cx, cy - j                                                         # y up
        if glyph and abs(x) <= 1.5 and abs(y) <= 2.5:                                # the monogram, mid emblem
            gx, gy = int(round(x + 1)), int(round(2 - y))
            if 0 <= gx < 3 and 0 <= gy < 5 and glyph[gy][gx] == "1":
                return letter
        if EMBLEM[shape](x, y):
            return emb
        if shape == "hex" and max(abs(y), abs(x) * 0.866 + abs(y) * 0.5) < 4.6 and glyph:
            return panel
        if abs(x) > 9 and abs(x) < nu / 2 - 3 and (abs(y) in (1.5, 2.5) or abs(abs(y) - 2) < 0.6):
            return bars                                                              # bars either side
        return panel
    return fn


def logo(size, rot, end, company):
    objs = C.shell(size, rot, end)
    C._size(size)
    for o in objs:
        o.is_holdout = True
    W, L = C.SIZES[size]
    k = K(f"container_logo_{size}_{rot}_{end}_{company}", (W, L), rot)
    k.m.flat = True
    u0 = W / 2 - C.M
    lp, hp = round(0.42 * L * GN) / GN, 0.5
    z0 = (C.BAND_Z[1] + C.H - 0.1) / 2 - hp / 2                                     # between the band and the top
    nu, nv = round(lp * GN), round(hp * GN)
    for su in (-1, 1):
        uf = su * (u0 + 0.008)
        a, b = k.p(uf, -su * lp / 2), k.p(uf, su * lp / 2)                           # reads left to right outside
        k.m.pattern((a[0], a[1], z0), (b[0] - a[0], b[1] - a[1], 0), (0, 0, hp), nu, nv, _cell(company, nu, nv))
    return objs + C._hang(k.build())


def jobs(sizes, rots):
    out = []
    for size in sizes:
        W, L = C.SIZES[size]
        for rot in rots:
            fp = (W, L) if rot % 2 == 0 else (L, W)
            for end in C.ENDS[rot]:
                for co in LOGOS:
                    out.append((f"container.{size}.r{rot}.{end}.logo.{co}", fp, "block",
                                lambda s=size, r=rot, e=end, c=co: logo(s, r, e, c)))
    return out
