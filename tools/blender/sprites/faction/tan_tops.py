"""Tan's face designs (its tops) past the base: each the face over the lip, from the lip's top (zl1) to the header's
top (z1), drawn instead of the base's header, slats and panel."""
from ..relief_style import Design
from .parts import PX, PZ, prism
from .tan_ramps import FACE

# the console: a deep canopy under the cap, two screens in the recess under it, a desk standing out under them (a
# frame, open under its top plate), then the lip (heights in rows of face, as the ref's)
C_FRONT, C_DEPTH = 3 * PZ, 3.5 * PX     # the canopy: its front's height, how far it stands out (7 rows of top)
D_TOP = 15 * PZ                         # the desk: its shelf's top over the lip's top
D_SHELF, D_PANEL, D_RAIL = 7, 4, 2      # how far out (px) its shelf, its side panels, the rail at their feet stand
D_SIDE = 1 / 32                         # its side panels' thickness
SCREENS = ((2 / 32, 10 / 32), (18 / 32, 26 / 32))    # each tile's two screens, across it
S_GAP, S_H = PZ, 5 * PZ                 # under the canopy's shadow: their top, their height
SCREEN_DOTS = (("fTC1", ((1, 1), (2, 1), (4, 2), (5, 3))), ("fTC2", ((2, 3), (3, 3), (5, 1))))  # (px across, rows
SCREEN_DOTS_B = (("fTC3", ((1, 1), (2, 2), (3, 2), (4, 3), (5, 3))), ("fTC2", ((1, 3), (4, 1))))  # up) in each one


def _rows(d):
    return d / (PX / 2) * PZ


def console(k, ax, plane, a, b, mit, zl1, z1, band, sd):
    L = 1 / 32
    band(a, b, zl1, z1, "fTS2")                                 # the recess's back, all the way up
    zd1 = zl1 + D_TOP                                           # the desk, a frame: a shelf (a px thick), a side
    zt0 = zd1 - PZ                                              # panel at each end of each tile's (flaring out at
    sh, sp, rl = D_SHELF * L, D_PANEL * L, D_RAIL * L           # 45 degrees to the shelf), a rail across the tile
    band(a, b, zl1, zt0, "fTS8")                                # joining their feet; open between (the face in it
    prism(k, ax, plane, a, b, [(0.0, zt0), (sh, zt0), (sh, zd1), (0.0, zd1)], FACE, 3,     # in shadow)
          cols=[False, sd("fTS0", ax), sd("fTS1", ax), False], mitre=mit)
    prism(k, ax, plane, a, b, [(0.0, zl1), (rl, zl1), (rl, zl1 + PZ), (0.0, zl1 + PZ)], FACE, 3,
          cols=[False, sd("fTS3", ax), sd("fTS1", ax), False], mitre=mit)
    fl = (sh - sp)                                              # (the flare: as high as it runs out)
    for c in range(-1, 2):
        for p0, p1 in ((c - 0.5, c - 0.5 + D_SIDE), (c + 0.5 - D_SIDE, c + 0.5)):
            q0, q1 = max(a, p0), min(b, p1)
            if q1 - q0 > 1e-6:
                prism(k, ax, plane, q0, q1, [(0.0, zl1), (sp, zl1), (sp, zt0 - fl), (sh, zt0), (0.0, zt0)], FACE,
                      3, cols=[False, sd("fTS3", ax), sd("fTS2", ax), False, False])
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
