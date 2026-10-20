"""Shipping company logos for the cargo containers (family `containers`): painted panels on both long sides above the
livery band, as overlay sprites in fixed colours (a company's colours are its own, over any faction's livery):

  <shell id>.logo.<company>   built with the shell (containers.branded), which is a holdout: it hides the far side's
                               panel and draws nothing; damage dents, scorches and holes the panel with it

The game mirrors container sprites for the sides it does not render, so every logo is symmetric about its middle and
reads the same mirrored. Each is an emblem with marks either side out to the panel's ends:
  halvard   Halvard Freight     an orange hexagon with a white H on charcoal, speed chevrons running out both ways
  meridian  Meridian Orbital    a white planet in a yellow ring on navy, a star field, a blue horizon arc
  vantor    Vantor Bulk         a stack of yellow chevrons on a horizon bar, on green, hazard-striped ends
  talos     Talos Shipping      a red spread-wing bird with a black body on white, black rules out to the ends
  sable     Sable Crescent      a white crescent cradling a yellow star on blue-black, twin brass rules"""
import math

from . import containers as C
from .modkit import K

GN = 32                                   # pattern cells per tile (one per pixel at game scale)
FONT = {"H": ("101", "101", "111", "101", "101"), "T": ("111", "010", "010", "010", "010")}
PANEL = {"halvard": "dark", "meridian": "navy", "vantor": "pcb", "talos": "medWhite", "sable": "bK"}
STARS = ((1.35, 0.55), (1.8, -0.2), (2.3, 0.45), (2.75, -0.5), (1.1, -0.7))


def _glyph(ch, x, y, gs):
    """The monogram, centred, gs cells per font pixel: True on its strokes."""
    g = FONT[ch]
    gx, gy = math.floor(x / gs + 1.5), math.floor(2.5 - y / gs)
    return 0 <= gx < 3 and 0 <= gy < 5 and g[gy][gx] == "1"


def _hex(x, y):
    return max(abs(y), abs(x) * 0.866 + abs(y) * 0.5)


def halvard(x, y, X, Y, R, gs):
    if _glyph("H", x, y, gs):
        return "lvW"
    h = _hex(X, Y)
    if 0.66 <= h <= 0.95:
        return "hivis"
    if h < 0.66:
        return None
    for i in range(3):                                                            # chevrons pointing outward
        c = 1.35 + i * 0.55
        if abs(abs(X) - (c + 0.45 * (0.6 - abs(Y)))) < 0.16 and abs(Y) < 0.6 and abs(X) < R - 0.15:
            return "hivis" if i < 2 else "oD"
    if abs(Y + 0.85) < 0.08 and 1.2 < abs(X) < R - 0.15:
        return "hivis"
    return None


def meridian(x, y, X, Y, R, gs):
    ring = abs((X / 1.25) ** 2 + (Y / 0.34) ** 2 - 1) < 0.28
    disc = math.hypot(X, Y) <= 0.62
    if ring and (Y < 0 or not disc):                                              # the ring: in front below
        return "hazY"
    if disc:
        return "iceB" if X * 0.4 + Y > 0.25 else "medWhite"                         # a highlight cap
    for sx, sy in STARS:
        if abs(abs(X) - sx) < 0.09 and abs(Y - sy) < 0.09 and abs(X) < R - 0.1:
            return "medWhite"
    if abs((X / 2.5) ** 2 + (Y / 0.78) ** 2 - 1) < 0.09:                            # a wide orbit round it all
        return "polyB"
    return None


def vantor(x, y, X, Y, R, gs):
    for o in (1.05, 0.5, -0.05):                                                   # stacked chevrons
        if abs(Y - (o - abs(X) * 0.85)) < 0.17 and abs(X) < 0.75:
            return "hazY"
    if abs(Y + 0.8) < 0.13 and abs(X) < R - 0.6:
        return "hazY"
    if abs(X) > R - 0.55:                                                          # hazard-striped ends, mirrored
        return "hazY" if math.floor((abs(X) + Y) / 0.3) % 2 else "hazK"
    return None


def talos(x, y, X, Y, R, gs):
    if math.hypot(X, Y - 0.62) < 0.2:                                               # head, body
        return "hazK"
    if abs(X) * 1.6 + abs(Y + 0.05) < 0.5:
        return "hazK"
    ax = abs(X)
    if 0.2 < ax < 2.1:                                                            # wings: a swept top edge, feathers
        top = 0.25 + 0.42 * math.sin(min(ax, 1.9) / 1.9 * math.pi * 0.9)
        feather = math.floor((ax - 0.2) / 0.32)
        bot = top - 0.38 - 0.42 * (1 - feather / 6) - (0.12 if (ax - 0.2) % 0.32 < 0.16 else 0)
        if bot <= Y <= top:
            return "medRed"
    if -0.95 <= Y <= -0.4 and ax < 0.1 + 0.55 * (-0.4 - Y):                         # tail fan
        return "medRed"
    if 2.3 < ax < R - 0.15 and (abs(Y - 0.2) < 0.09 or abs(Y + 0.15) < 0.16):
        return "hazK"
    return None


def sable(x, y, X, Y, R, gs):
    if math.hypot(X, Y + 0.05) <= 0.9 and math.hypot(X, Y - 0.3) > 0.82:           # crescent, horns up
        return "medWhite"
    if abs(X) ** 0.5 + abs(Y - 0.15) ** 0.5 < 0.78:                                  # a four-point star
        return "hazY"
    if 1.2 < abs(X) < R - 0.15 and (abs(Y - 0.25) < 0.07 or abs(Y + 0.25) < 0.07):
        return "brass"
    if abs(abs(X) - 1.05) < 0.08 and abs(Y) < 0.08:
        return "brass"
    return None


LOGOS = {"halvard": halvard, "meridian": meridian, "vantor": vantor, "talos": talos, "sable": sable}


def _cell(company, nu, nv):
    cx, cy = (nu - 1) / 2, (nv - 1) / 2
    s = (nv - 2) / 2                                                               # emblem units: half the inner height
    gs = max(1, round(s / 6))
    R = (nu - 2) / 2 / s

    def fn(i, j):
        if i in (0, nu - 1) or j in (0, nv - 1):
            return "gmD"                                                             # the panel's rim
        x, y = i - cx, cy - j                                                         # y up
        return LOGOS[company](x, y, x / s, y / s, R, gs) or PANEL[company]
    return fn


def panels(size, rot, company):
    """The company's panels on both long sides, for containers.shell (which sizes, hangs and damages them)."""
    W, L = C.SIZES[size]
    k = K(f"container_{size}_{rot}{C.LOGO}_{company}", (W, L), rot)
    k.m.flat = True
    u0 = W / 2 - C.M
    hp = round(min(0.8, 0.82 * (C.H - 0.12 - C.BAND_Z[1])) * GN) / GN               # most of the face above the band
    lp = round(min(0.5 * L, 3.2 * hp) * GN) / GN
    z0 = (C.BAND_Z[1] + C.H - 0.1) / 2 - hp / 2
    nu, nv = round(lp * GN), round(hp * GN)
    for su in (-1, 1):
        uf = su * (u0 + 0.008)
        a, b = k.p(uf, -su * lp / 2), k.p(uf, su * lp / 2)                           # reads left to right outside
        k.m.pattern((a[0], a[1], z0), (b[0] - a[0], b[1] - a[1], 0), (0, 0, hp), nu, nv, _cell(company, nu, nv))
    return k.build()


COMPANIES = tuple(LOGOS)
