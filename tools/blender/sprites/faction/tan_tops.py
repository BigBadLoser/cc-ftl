"""Tan's face designs (its tops) past the base: each the face over the lip, from the lip's top (zl1) to the header's
top (z1), drawn instead of the base's header, slats and panel."""
from mathutils import Vector

from .. import wall3d as T
from ..relief_style import Design
from .parts import PAINT, PX, PZ, prism
from .tan_ramps import FACE

# the console: a deep canopy under the cap, two screens in the recess under it, a desk standing out under them (a
# frame, open under its top plate), then the lip (heights in rows of face, as the ref's)
C_FRONT, C_DEPTH = 3 * PZ, 3.5 * PX     # the canopy: its front's height, how far it stands out (7 rows of top)
C_IN = 1                                # its side plates: in from each tile edge (px)
D_TOP, D_THICK = 15 * PZ, 2 * PZ       # the desk: its shelf's top over the rail's foot, the shelf's thickness
D_SHELF, D_PANEL, D_RAIL = 7, 4, 4      # how far out (px) its shelf, its side panels, the rail at their feet stand
D_RAIL_SHADOW = "fTS8"                  # (a step under the lip's front)
LIP_D = PX / 2                          # (the lip's depth, as tan's: the rail's front edge sits on its)
D_SIDE, D_SIDE_TONE = 1 / 32, "fTS7"    # its side panels' thickness; their sides' tone (the rail's top's too)
SCREENS = ((2 / 32, 13 / 32), (19 / 32, 30 / 32))    # each tile's two terminals' screens, across it (with the
                                                    # keyboards, centred on it)
T_DEPTH, T_SCREEN = 5, 3               # a terminal: how far out (px) its keyboard's front stands, its screen
K_SHADOW = "fTS2"                       # the faint shadow on the keyboard's face under each screen
K_BLOCK, K_IN = "fTS7", 2                # a block across each keyboard's middle (2 rows, the seam's tone), K_IN px
                                        # in from its ends
M_SHADOW = "fTS8"                       # the canopy's shadow on the face between the screens (2 rows under it)
B_TONE = "fTS3"                         # the screens' borders' front (darker than the keyboard's face)
T_DROP, T_GLASS = 3 * PZ, 5 * PZ        # the keyboard's top under T_SHOW's foot; the glass's height (up to
                                        # T_SHOW's top)
T_SEAM = 0.7                            # the seam down the keyboard's middle (px; under one: AA softens it)
T_SHOW, T_FRONT = 5 * PZ, 2 * PZ        # its screen's rows seen under the canopy; its keyboard's front (the
                                        # keyboard face slopes from it to the screen's foot)
SCREEN_ART = (("CCC.CC.R",             # each tile's two screens' glass, px by px from its first row seen under the
               "...G..G.",             # canopy (8 x 4, the px of its 9 seen past the borders): a graph under a
               ".G.GG.GG",             # header; a log, lit lines over a dim one, a prompt and a cursor at its foot
               "GGGGGGGG"),            # (on an x face, its u running right to left on screen, mirrored: the
              ("YYYY.YYY",             # graph still on the left, the text still left to right)
               "dd.ddd.d",
               "YYY.YY.R",
               "C.CCC.G."))
G_HID = 1                               # (the glass's rows hidden under the canopy, over the art)
SCREEN_INK = {"G": "fTC1", "R": "fTC2", "Y": "fTC3", "d": "fTC4", "C": "fTC5"}


def _rows(d):
    return d / (PX / 2) * PZ


def _slope(k, ax, plane, u0, u1, lo, hi, col, rows=1, mid=False):
    """A strip of one tone along a sloping face's top (its foot at lo, its top at hi: (d, z)), rows of it as seen,
    a touch out from it; or (mid) across its middle."""
    dd, dz = hi[0] - lo[0], hi[1] - lo[1]
    ln = (dd * dd + dz * dz) ** 0.5
    seen = dz / PZ + abs(dd) / (PX / 2)                 # (the rows the slope shows)
    t0, t1 = max(0.0, 1.0 - rows / seen), 1.0
    if mid:                                             # (whole rows down from its top, as the strip along it)
        r = round((seen - rows) / 2)
        t0, t1 = 1.0 - (r + rows) / seen, 1.0 - r / seen
    od, oz = dz / ln * PAINT, -dd / ln * PAINT
    nrm = T.OUT(ax) * (dz / ln) + Vector((0, 0, 1)) * (-dd / ln)
    pts = [T.P(ax, plane, u, lo[1] + t * dz + oz, lo[0] + t * dd + od) for u, t in ((u0, t0), (u1, t0), (u1, t1),
                                                                                       (u0, t1))]
    k.poly(pts, "wall", 0, nrm, fixed=col)

PX_U, PX_A = 0.25, -0.75                # (a screen px's square on the sprite's grid: its offset across, in px, and
                                        # the face's row phase; found by rendering a checker on both faces)


def _px(k, ax, plane, g0, x, r, zt, d, col):
    """Pixel x across, r down of a screen's art (its glass from g0, its first row's top at zt) as a square on the
    sprite's pixel grid: a face's rows step down a px every 2 across, so its top and foot slope up with the face's u
    to stay level (the art's columns paired: 0-1, 2-3, ...)."""
    L = 1 / 32
    y = r + x // 2

    def z(u, yy):
        return zt + (PX_A + (u - g0) / L / 2 - yy) * PZ
    ua, ub = g0 + (x + PX_U) * L, g0 + (x + 1 + PX_U) * L
    pts = [T.P(ax, plane, u, z(u, yy), d) for u, yy in ((ua, y), (ub, y), (ub, y + 1), (ua, y + 1))]
    k.poly(pts, "wall", 0, T.OUT(ax), fixed=col)


def console(k, ax, plane, a, b, mit, zl1, z1, band, sd):
    L = 1 / 32
    band(a, b, zl1, z1, "fTS2")                                 # the recess's back, all the way up
    sh, sp, rl = D_SHELF * L, D_PANEL * L, D_RAIL * L           # the desk, a frame: a shelf (2 px thick), a side
    zb = zl1 + _rows(rl - LIP_D) + PZ / 4                       # panel at each end of each tile's (flaring out at
    zd1 = zb + D_TOP                                            # 45 degrees to the shelf), a rail across the tile
    zt0 = zd1 - D_THICK                                         # (its front edge on the lip's)
    band(a, b, zl1, zt0, "fTS8", PAINT)                              # joining their feet; open between (the face in it
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
    for c in range(-1, 2):                                      # (each bay behind the terminals in the canopy's
        q0, q1 = max(a, c - 0.5 + C_IN * L), min(b, c + 0.5 - C_IN * L)     # shadow; the face outside its plates
        if q1 - q0 > 1e-6:                                                  # left lit, against their sides)
            band(q0, q1, zd1, zc0, "fTS7", PAINT)    # (a touch over the back: no z-fight)
    for c in range(-1, 2):                                      # the canopy's side plates: brackets its full depth
        for p0 in (c - 0.5 + C_IN * L, c + 0.5 - (C_IN + 1) * L):     # under it, their front at 45 degrees from
            if a - 1e-6 <= p0 and p0 + D_SIDE <= b + 1e-6:              # its edge back to the wall; C_IN in from
                prism(k, ax, plane, p0, p0 + D_SIDE, [(0.0, zc0 - C_DEPTH), (C_DEPTH, zc0), (0.0, zc0)],  # each
                      FACE, 3, cols=[sd("fTS3", ax), False, False], cap=sd(D_SIDE_TONE, ax))          # tile edge
    td, ts = T_DEPTH * L, T_SCREEN * L                          # the terminals: a keyboard on the shelf (a low
    zk1 = zc0 - _rows(C_DEPTH) + _rows(ts) - T_SHOW             # front, its face sloping back up to the screen's
    zk0 = zd1 + T_FRONT                                         # foot; wider than the screen toward the tile's
    zkt = zk1 - T_DROP                                          # middle), the screen upright on it in a tan
    zg1 = zk1 + T_SHOW                                          # border, a px round its glass (on a tan body from
    zg0 = zg1 - T_GLASS                                         # the keyboard to the canopy))
    for c in range(-1, 2):                                      # up to the canopy round its glass (T_SHOW rows of
        e0, e1 = c - 0.5 + SCREENS[0][0], c - 0.5 + SCREENS[1][1]               # it under the canopy's shadow)
        if e0 < a - 1e-6 or e1 > b + 1e-6:
            continue
        for k0, k1 in ((e0, c - T_SEAM * L / 2), (c + T_SEAM * L / 2, e1)):    # (one keyboard across the bay, a
            prism(k, ax, plane, k0, k1, [(0.0, zd1), (td, zd1), (td, zk0), (ts, zkt), (0.0, zkt)], FACE, 3,  # seam
                  cols=[False, sd("fTS3", ax), sd("fTS1", ax), False, False], cap=sd(D_SIDE_TONE, ax))  # down its
            _slope(k, ax, plane, k0 + K_IN * L, k1 - K_IN * L, (td, zk0), (ts, zkt), sd(K_BLOCK, ax), 2, True)
        for s0, s1 in SCREENS:                                  # (a faint shadow along the slope's top row under
            _slope(k, ax, plane, c - 0.5 + s0, c - 0.5 + s1, (td, zk0), (ts, zkt), sd(K_SHADOW, ax))  # each screen)
        m0, m1 = c - 0.5 + SCREENS[0][1], c - 0.5 + SCREENS[1][0]                # middle; a face between the
        prism(k, ax, plane, m0, m1, [(0.0, zkt), (ts, zkt), (ts, zc0), (0.0, zc0)], FACE, 3,  # screens, a px back
              cols=[False, sd("fTS2", ax), False, False], cap=sd(D_SIDE_TONE, ax))            # of their borders)
        band(m0, m1, zg1 - 2 * PZ, zc0, M_SHADOW, ts)          # (the canopy's shadow on it)
        for i, (s0, s1) in enumerate(SCREENS):
            u0, u1 = c - 0.5 + s0, c - 0.5 + s1
            prism(k, ax, plane, u0, u1, [(0.0, zkt), (ts, zkt), (ts, zc0), (0.0, zc0)], FACE, 3,
                  cols=[False, sd("fTS2", ax), False, False], cap=sd(D_SIDE_TONE, ax))     # (the body)
            band(u0 + L, u1 - L, zg0, zg1, "fTC0", ts)          # (the glass)
            bd = ts + L                                         # a tan border round it, a px proud of it
            for ba, bb, za, zb_, cl in ((u0, u1, zg0 - PZ, zg0, ("fTS0", B_TONE)),
                                        (u0, u1, zg1, zg1 + PZ, ("fTS0", B_TONE)),
                                        (u0, u0 + L, zg0, zg1, (False, B_TONE)),
                                        (u1 - L, u1, zg0, zg1, (False, B_TONE))):
                prism(k, ax, plane, ba, bb, [(0.0, za), (bd, za), (bd, zb_), (0.0, zb_)], FACE, 3,
                      cols=[False, sd(cl[1], ax), sd(cl[0], ax) if cl[0] else False, False],
                      cap=sd(D_SIDE_TONE, ax))
            zt = zg1 - G_HID * PZ
            art = SCREEN_ART[1 - i if ax == "x" else i]
            for r, row in enumerate(art):                   # (its art, a px square on the screen each)
                for x, ch in enumerate(row[::-1] if ax == "x" else row):
                    if ch != ".":
                        _px(k, ax, plane, u0 + L, x, r, zt, ts + PX / 8, sd(SCREEN_INK[ch], ax))
    for c in range(-1, 2):                                      # (a tile's, flush with its side plates)
        q0, q1 = max(a, c - 0.5 + C_IN * L), min(b, c + 0.5 - C_IN * L)
        if q1 - q0 < 1e-6:
            continue
        m = (mit[0] if q0 <= a + 1e-6 else False, mit[1] if q1 >= b - 1e-6 else False)
        prism(k, ax, plane, q0, q1, [(0.0, zc0), (C_DEPTH, zc0), (C_DEPTH, z1), (0.0, z1)], FACE, 3,
              cols=[sd("fTS4", ax), sd("fTS1", ax), sd("fTS1", ax), False], cap=sd(D_SIDE_TONE, ax), mitre=m)
        for i, col in enumerate(("fTS0", "fTS1", "fTS7")):
            band(q0, q1, z1 - (i + 1) * PZ, z1 - i * PZ, col, C_DEPTH)


TAN_TOPS = (Design("plain"), Design("console", body=console))
