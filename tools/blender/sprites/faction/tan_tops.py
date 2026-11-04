"""Tan's face designs (its tops) past the base: each the face over the lip, from the lip's top (zl1) to the header's
top (z1), drawn instead of the base's header, slats and panel."""
from ..relief_style import Design
from .parts import PX, PZ, prism
from .tan_ramps import FACE

# the console: a deep canopy under the cap, two screens in the recess under it, a desk standing out under them (a
# frame, open under its top plate), then the lip (heights in rows of face, as the ref's)
C_FRONT, C_DEPTH = 3 * PZ, 3.5 * PX     # the canopy: its front's height, how far it stands out (7 rows of top)
C_IN, C_FOOT = 2, 3                     # its side plates: in from each tile edge, out at their foot (px)
D_TOP, D_THICK = 15 * PZ, 2 * PZ       # the desk: its shelf's top over the rail's foot, the shelf's thickness
D_SHELF, D_PANEL, D_RAIL = 7, 4, 4      # how far out (px) its shelf, its side panels, the rail at their feet stand
D_RAIL_SHADOW = "fTS8"                  # (a step under the lip's front)
LIP_D = PX / 2                          # (the lip's depth, as tan's: the rail's front edge sits on its)
D_SIDE, D_SIDE_TONE = 1 / 32, "fTS7"    # its side panels' thickness; their sides' tone (the rail's top's too)
SCREENS = ((3 / 32, 13 / 32), (19 / 32, 29 / 32))    # each tile's two terminals' screens, across it (with the
                                                    # keyboards, centred on it)
T_DEPTH, T_SCREEN = 6, 3               # a terminal: how far out (px) its keyboard's front stands, its screen
T_WIDER = 2                             # its keyboard wider than the screen (px), toward the tile's middle
T_SHOW, T_FRONT = 5 * PZ, 2 * PZ        # its screen's rows seen under the canopy; its keyboard's front (the
                                        # keyboard face slopes from it to the screen's foot)
SCREEN_LINES = ((("fTC1", ((2, 1, 6), (0, 1, 4), (0, 5, 7))), ("fTC2", ((2, 7, 8),))),
                (("fTC3", ((2, 1, 4), (2, 5, 7), (0, 1, 6))), ("fTC2", ((0, 7, 8),))))
                                        # (each screen's text: lines of lit px (row up its glass, px from, to))


def _rows(d):
    return d / (PX / 2) * PZ


def console(k, ax, plane, a, b, mit, zl1, z1, band, sd):
    L = 1 / 32
    band(a, b, zl1, z1, "fTS2")                                 # the recess's back, all the way up
    sh, sp, rl = D_SHELF * L, D_PANEL * L, D_RAIL * L           # the desk, a frame: a shelf (2 px thick), a side
    zb = zl1 + _rows(rl - LIP_D) + PZ / 4                       # panel at each end of each tile's (flaring out at
    zd1 = zb + D_TOP                                            # 45 degrees to the shelf), a rail across the tile
    zt0 = zd1 - D_THICK                                         # (its front edge on the lip's)
    band(a, b, zl1, zt0, "fTS8")                                # joining their feet; open between (the face in it
    prism(k, ax, plane, a, b, [(0.0, zt0), (sh, zt0), (sh, zd1), (0.0, zd1)], FACE, 3,     # in shadow)
          cols=[False, sd("fTS1", ax), sd("fTS1", ax), False], cap=sd(D_SIDE_TONE, ax), mitre=mit)  # (its ends,
    band(a, b, zd1 - PZ, zd1, "fTS0", sh)                       # the rail's too, as the panels' sides) (its
                                                                # front's upper px a highlight)
    prism(k, ax, plane, a, b, [(0.0, zb), (rl, zb), (rl, zb + PZ), (0.0, zb + PZ)], FACE, 3,
          cols=[False, sd("fTS2", ax), sd(D_SIDE_TONE, ax), False], cap=sd(D_SIDE_TONE, ax),
          mitre=mit)                                            # (its front a step over the lip's)
    band(a, b, zl1 - 1.5 * PZ, zl1, D_RAIL_SHADOW, LIP_D)        # (a faint shadow from it on the lip's front)
    fl = (sh - sp)                                              # (the flare: as high as it runs out)
    for c in range(-1, 2):
        for p0, p1 in ((c - 0.5, c - 0.5 + D_SIDE), (c + 0.5 - D_SIDE, c + 0.5)):
            q0, q1 = max(a, p0), min(b, p1)
            if q1 - q0 > 1e-6:
                prism(k, ax, plane, q0, q1, [(0.0, zb), (sp, zb), (sp, zt0 - fl), (sh, zt0), (0.0, zt0)], FACE,
                      3, cols=[False, sd("fTS3", ax), sd("fTS2", ax), False, False], cap=sd(D_SIDE_TONE, ax))
    zc0 = z1 - C_FRONT                                          # the canopy: lit top, a pale nose, dark under
    band(a, b, zd1, zc0, "fTS7")                                # (the recess behind the terminals in its shadow,
    band(a, b, zc0 - _rows(C_DEPTH) - 2 * PZ, zc0, "fTS7")      # deepest right under it)
    for c in range(-1, 2):                                      # the canopy's side plates: its full depth under
        for p0 in (c - 0.5 + C_IN * L, c + 0.5 - (C_IN + 1) * L):     # it, their front sloping in from there down
            if a - 1e-6 <= p0 and p0 + D_SIDE <= b + 1e-6:              # to C_FOOT at the shelf; C_IN in from each
                prism(k, ax, plane, p0, p0 + D_SIDE, [(0.0, zd1), (C_FOOT * L, zd1), (C_DEPTH, zc0), (0.0, zc0)],
                      FACE, 3, cols=[False, sd("fTS3", ax), False, False], cap=sd(D_SIDE_TONE, ax))  # tile edge
    td, ts = T_DEPTH * L, T_SCREEN * L                          # the terminals: a keyboard on the shelf (a low
    zk1 = zc0 - _rows(C_DEPTH) + _rows(ts) - T_SHOW             # front, its face sloping back up to the screen's
    zk0 = zd1 + T_FRONT                                         # foot; wider than the screen toward the tile's
    zg0, zg1 = zk1 + PZ, zk1 + T_SHOW                           # middle), the screen upright on it, a dark bezel
    for c in range(-1, 2):                                      # up to the canopy round its glass (T_SHOW rows of
        for i, (s0, s1) in enumerate(SCREENS):                  # it under the canopy's shadow)
            u0, u1 = c - 0.5 + s0, c - 0.5 + s1
            k0, k1 = (u0, u1 + T_WIDER * L) if i == 0 else (u0 - T_WIDER * L, u1)
            if k0 < a - 1e-6 or k1 > b + 1e-6:
                continue
            prism(k, ax, plane, k0, k1, [(0.0, zd1), (td, zd1), (td, zk0), (ts, zk1), (0.0, zk1)], FACE, 3,
                  cols=[False, sd("fTS3", ax), sd("fTS0", ax), False, False], cap=sd(D_SIDE_TONE, ax))
            prism(k, ax, plane, u0, u1, [(0.0, zk1), (ts, zk1), (ts, zc0), (0.0, zc0)], FACE, 3,
                  cols=[False, sd("fTS6", ax), False, False], cap=sd(D_SIDE_TONE, ax))
            band(u0 + L, u1 - L, zg0, zg1, "fTC0", ts)
            for col, lines in SCREEN_LINES[i]:
                for y, x0, x1 in lines:
                    if zg0 + (y + 1) * PZ <= zg1 + 1e-6 and u0 + x1 * L <= u1 - L + 1e-6:
                        band(u0 + x0 * L, u0 + x1 * L, zg0 + y * PZ, zg0 + (y + 1) * PZ, col, ts + PX / 8)
    prism(k, ax, plane, a, b, [(0.0, zc0), (C_DEPTH, zc0), (C_DEPTH, z1), (0.0, z1)], FACE, 3,
          cols=[sd("fTS4", ax), sd("fTS1", ax), sd("fTS1", ax), False], mitre=mit)
    for i, col in enumerate(("fTS0", "fTS1", "fTS7")):
        band(a, b, z1 - (i + 1) * PZ, z1 - i * PZ, col, C_DEPTH)


TAN_TOPS = (Design("plain"), Design("console", body=console))
