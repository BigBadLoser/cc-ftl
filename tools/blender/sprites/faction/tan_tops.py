"""Tan's face designs (its tops) past the base: each the face over the lip, from the lip's top (zl1) to the header's
top (z1), drawn instead of the base's header, slats and panel."""
from ..relief_style import Design
from .parts import PX, PZ, prism
from .tan_ramps import FACE

# the console: a deep canopy under the cap, two screens in the recess under it, a desk standing out under them over a
# strip of face, a shadow between, then the lip (heights in rows of face, as the ref's)
C_FRONT, C_DEPTH = 3 * PZ, 3.5 * PX     # the canopy: its front's height, how far it stands out (7 rows of top)
D_LOW, D_FRONT, D_DEPTH = 7 * PZ, 8 * PZ, 2 * PX   # the desk: its foot over the lip's top, its front, depth (4 rows)
SCREENS = ((2 / 32, 10 / 32), (18 / 32, 26 / 32))    # each tile's two screens, across it
S_GAP, S_H = PZ, 5 * PZ                 # under the canopy's shadow: their top, their height
SCREEN_DOTS = (("fTC1", ((1, 1), (2, 1), (4, 2), (5, 3))), ("fTC2", ((2, 3), (3, 3), (5, 1))))  # (px across, rows
SCREEN_DOTS_B = (("fTC3", ((1, 1), (2, 2), (3, 2), (4, 3), (5, 3))), ("fTC2", ((1, 3), (4, 1))))  # up) in each one


def _rows(d):
    return d / (PX / 2) * PZ


def console(k, ax, plane, a, b, mit, zl1, z1, band, sd):
    L = 1 / 32
    band(a, b, zl1, z1, "fTS2")                                 # the recess's back, all the way up
    zd0 = zl1 + D_LOW                                           # the face over the lip, a shadow under the desk
    band(a, b, zl1, zd0, "fTS8")
    band(a, b, zd0 - _rows(D_DEPTH) - PZ, zd0 - _rows(D_DEPTH), "fTS4")
    zd1 = zd0 + D_FRONT                                         # the desk: lit top, a rounded nose, a darker front
    prism(k, ax, plane, a, b, [(0.0, zd0), (D_DEPTH, zd0), (D_DEPTH, zd1), (0.0, zd1)], FACE, 3,
          cols=[False, sd("fTS8", ax), sd("fTS1", ax), False], mitre=mit)
    for i, col in enumerate(("fTS2", "fTS1", "fTS0", "fTS3")):
        band(a, b, zd1 - (i + 1) * PZ, zd1 - i * PZ, col, D_DEPTH)
    zc0 = z1 - C_FRONT                                          # the canopy: lit top, a pale nose, dark under
    zs1 = zc0 - _rows(C_DEPTH) - S_GAP
    for c in range(-1, 2):                                      # the screens: dark glass in a frame, lit dots
        for i, (s0, s1) in enumerate(SCREENS):
            u0, u1 = max(a, c - 0.5 + s0), min(b, c - 0.5 + s1)
            if u1 - u0 < 2 * L:
                continue
            z0 = zs1 - S_H
            band(u0 - L, u1 + L, z0 - PZ, zs1 + PZ, "fTS6")
            band(u0, u1, z0, zs1, "fTC0")
            for col, dots in (SCREEN_DOTS if i == 0 else SCREEN_DOTS_B):
                for x, y in dots:
                    ua = c - 0.5 + s0 + x * L
                    if u0 <= ua and ua + L <= u1:
                        band(ua, ua + L, z0 + y * PZ, z0 + (y + 1) * PZ, col, PX / 8)
    prism(k, ax, plane, a, b, [(0.0, zc0), (C_DEPTH, zc0), (C_DEPTH, z1), (0.0, z1)], FACE, 3,
          cols=[sd("fTS4", ax), sd("fTS1", ax), sd("fTS1", ax), False], mitre=mit)
    for i, col in enumerate(("fTS0", "fTS1", "fTS7")):
        band(a, b, z1 - (i + 1) * PZ, z1 - i * PZ, col, C_DEPTH)


TAN_TOPS = (Design("plain"), Design("console", body=console))
