"""Tan's face designs (its tops) past the base: each the face over the lip, from the lip's top (zl1) to the header's
top (z1), drawn instead of the base's header, slats and panel."""
import functools
import math

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


def _slope(k, ax, plane, u0, u1, lo, hi, col, rows=1, mid=False, foot=False, out=1, skip=0.0):
    """A strip of one tone along a sloping face's top (its foot at lo, its top at hi: (d, z)), rows of it as seen,
    skip rows down from it, a touch (out PAINTs) out from it; or (mid) across its middle, or (foot) along its foot."""
    dd, dz = hi[0] - lo[0], hi[1] - lo[1]
    ln = (dd * dd + dz * dz) ** 0.5
    seen = dz / PZ + abs(dd) / (PX / 2)                 # (the rows the slope shows)
    t0, t1 = max(0.0, 1.0 - (skip + rows) / seen), 1.0 - skip / seen
    if mid:                                             # (whole rows down from its top, as the strip along it)
        r = round((seen - rows) / 2)
        t0, t1 = 1.0 - (r + rows) / seen, 1.0 - r / seen
    if foot:
        t0, t1 = 0.0, min(1.0, rows / seen)
    od, oz = dz / ln * PAINT * out, -dd / ln * PAINT * out
    nrm = T.OUT(ax) * (dz / ln) + Vector((0, 0, 1)) * (-dd / ln)
    pts = [T.P(ax, plane, u, lo[1] + t * dz + oz, lo[0] + t * dd + od) for u, t in ((u0, t0), (u1, t0), (u1, t1),
                                                                                       (u0, t1))]
    k.poly(pts, "wall", 0, nrm, fixed=col)

PX_U, PX_A = 0.25, -0.75                # (a screen px's square on the sprite's grid: its offset across, in px, and
                                        # the face's row phase; found by rendering a checker on both faces)


def _px(k, ax, plane, g0, x, r, zt, d, col):
    """Pixel x across, r down of a screen's art (its glass from g0 on the tile's px, its first row's top at zt on the
    face's rows), d proud, as a square on the sprite's pixel grid: a face's rows step down a px every 2 across, so
    its top and foot slope up with the face's u to stay level (the art's columns paired: 0-1, 2-3, ...). Found at the
    console's glass's depth; a px deeper sits half a row lower and a px across (the half row taken up, the pairing
    shifted a column)."""
    L = 1 / 32
    dl = round((d - (T_SCREEN * L + PX / 8)) / L)
    e = dl / 2 - dl // 2
    y = r + (x + dl % 2) // 2

    def z(u, yy):
        return zt + (PX_A + (u - g0) / L / 2 - yy + e) * PZ
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


# the lockers: a header (a 1 px canopy over a recessed face between side walls, a small screen at each end of each
# tile on it); under it two overhead bins, then two cabinets over four drawers in a frame, down to the slope (no lip)
# (heights in rows of face down from the header's top, depths in px; a part d proud shows d rows lower, so the one
# over it hides that much of what's under it)
H_FRONT, H_FACE, H_CANOPY = 8, 6, 8     # the header: its rows; its face's depth (the screens on it); the canopy's
BIN_FOOT, BIN_D, BIN_TOP = 18, 7, 2     # the bins: their bottom edge (on the cabinets' top), its depth (a px
                                        # short of the canopy's); their front leaning back from it to the header's foot, BIN_TOP
                                        # px out (under the header)
BIN_WALL, BIN_BACK = 2, 1               # the bins' side walls at each tile edge (px thick, the bins' profile), the
                                        # bins a px back of them
SECTIONS = ((18, 30, 5, (0.5,), 3),     # the cabinets, the drawers under them: (top, foot (None: the slope),
            (30, 41, 4, (0.25, 0.5, 0.75), 1))  # depth, the bars up between them, how far back in them the doors
                                        # sit): each in a frame of 1 px bars (across its top, the cabinets', and
                                        # its foot)
BIN_EDGE = {"y": "fTW1", "x": "fTS1"}    # the highlight along the bins' foot edge (a step under the face's pale)
BIN_SHADE = "fTS2"                      # a px of shadow down each bin's end by a side wall (screen right)
H_EDGE, H_SHADOW = "fTS0", "fTS8"       # the recessed face: a pale row along its foot, a shadow row under the canopy
BIN_TOP_SHADE = "fTS3"                  # the bins' (and their side walls') top row, under the header's foot: shadow
BIN_HANDLE = (3, 3)                     # each bin's handle (the glass's navy): rows over its foot edge, px wide
SIDE_STEP = 5                           # the cabinets' side bars: full depth for their first 5 rows from the
                                        # frame's foot, then a px back up to the bins
BIN_ROUND = 1.5                         # the bins' (and their side walls') top: rounded into the header's foot
                                        # (the radius, px)
FRAME_IN = 1                            # the cabinets and drawers: in from each tile edge (px)
L_GAP = 1                               # the gap between the bins, and at a tile's edge (px; the face dark)
SIDE_W = (2, 1)                         # the cabinets', the drawers' side bars (px thick)
HANDLES = ((3, 3), (3, 2))              # the cabinets', the drawers' handles (the glass's navy): (rows over, px wide)
                                        # their door's foot
H_SCREENS = ((1, (".......", ".RR.GG.", ".RR.GG.", ".......")),     # the header's screens: px in from the
             (24, ("YYYYYY.", "YRRYYY.", "YRRYYY.", "YYYYYY.")))    # tile's left edge, 7 x 4 of art ("." the glass), their
                                                            # top corners in the recess's (H_SEEN rows down)
H_SEEN = H_CANOPY - H_FACE + 1          # (the recess's first row seen under the canopy)


def _handle(k, ax, plane, c, q0, q1, zf, rows, wide, d, sd):
    """A handle wide px mid [q0, q1], rows over zf, d proud, on the sprite's grid."""
    L = 1 / 32
    g0 = c - 0.5 + round(((q0 + q1) / 2 - (c - 0.5)) / L - wide / 2) * L
    zh = zf + (rows + 1) * PZ
    odd = round((d + L / 4 - (T_SCREEN * L + PX / 8)) / L) % 2      # (at an odd depth the face's steps pair
    for x in range(odd, wide + odd):                                # columns 1-2, 3-4, ...: one step, one row)
        _px(k, ax, plane, g0 - odd * L, x, 0, zh, d + L / 4, sd("fTC0", ax))


def _bin(k, ax, plane, u0, u1, foot, top, sd, cap, shade=None, hid=0.0):
    """A bin over [u0, u1]: a wedge from the wall, its front leaning back from its foot edge (d, z) to its top (d,
    z) under the header, the corner there rounded into the header's foot (convex slices: the wedge, then a fan from
    the corner to the curve)."""
    L = 1 / 32
    (fd, fz), (td, tz) = foot, top
    ad, az = fd - td, fz - tz                           # (down the front from the top; along the header's foot)
    ln = math.hypot(ad, az)
    ad, az = ad / ln, az / ln
    th = math.acos(max(-1.0, min(1.0, ad)))             # (the angle between them)
    r = BIN_ROUND * L
    t = r / math.tan(th / 2)
    pa, pb = (td + ad * t, tz + az * t), (td + t, tz)   # (where the curve leaves the front and meets the foot)
    prism(k, ax, plane, u0, u1, [(0.0, fz), foot, pa, (td, tz), (0.0, tz)], FACE, 3,
          cols=[False, sd("fTS1", ax), False, False, False], cap=cap)
    if shade is not None:                               # (a px of shadow down its end by a side wall: on
        o = BIN_BACK * L if ax == "y" else 0.0          # the y face the wall, BIN_BACK prouder, hides that much)
        s0, s1 = (u1 - o - L, u1 - o) if shade > 0 else (u0 + o, u0 + o + L)
        _slope(k, ax, plane, s0, s1, foot, pa, sd(BIN_SHADE, ax), rows=99)
    _slope(k, ax, plane, u0, u1, foot, top, sd(BIN_TOP_SHADE, ax), out=2, skip=hid)    # (the header's shadow on its
    #                                                                       first row seen under it: hid rows hidden)
    for h0, h1 in ([(u0, u1)] if shade is None else [(u0, s0), (s1, u1)]):
        if h1 - h0 > 1e-6:
            _slope(k, ax, plane, h0, h1, foot, pa, BIN_EDGE[ax], foot=True)     # (a highlight along its foot)
    bx, bz = ad + 1.0, az                               # (the curve's centre: on the bisector)
    bl = math.hypot(bx, bz)
    cx, cz = td + bx / bl * r / math.sin(th / 2), tz + bz / bl * r / math.sin(th / 2)
    a0, a1 = math.atan2(pa[1] - cz, pa[0] - cx), math.atan2(pb[1] - cz, pb[0] - cx)
    a1 = a0 + (a1 - a0 + math.pi) % (2 * math.pi) - math.pi     # (the short way round)
    n = 4
    pts = [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
    for i in range(n):
        nz = -math.sin(a0 + (a1 - a0) * (i + 0.5) / n)          # (the curve's facing: toward its centre)
        tone = "fTS1" if nz > -0.2 else "fTS2" if nz > -0.6 else "fTS3"
        prism(k, ax, plane, u0, u1, [(td, tz), pts[i], pts[i + 1]], FACE, 3,
              cols=[False, sd(tone, ax), False], cap=cap)


def lockers(k, ax, plane, a, b, mit, zl1, z1, band, sd, canopy=True, cab_up=0, swap=False):
    """The cabinets and drawers; under the header of bins, the canopy and its screens (canopy), else under the look's
    cushion header (drawn by the look: the design's "cushion"); the cabinets' top cab_up px higher; the drawers over
    the cabinets (swap: the block's top and foot kept)."""
    L = 1 / 32
    R = lambda n: z1 - n * PZ                                   # noqa: E731
    band(a, b, zl1, z1, "fTS4")                                 # (the face, dark in the gaps)
    cap = sd(D_SIDE_TONE, ax)
    for c in range(-1, 2):
        if c - 0.5 < a - 1e-6 or c + 0.5 > b + 1e-6:
            continue
        bd, zb, bt = BIN_D * L, R(BIN_FOOT), BIN_TOP * L        # the bins: a wedge, lit along its front, between
        w, gb = BIN_WALL * L, BIN_BACK * L                      # side walls at the tile's edges
        for u0, u1, o in ((c - 0.5, c - 0.5 + w, 0.0), (c + 0.5 - w, c + 0.5, 0.0),
                          (c - 0.5 + w, c - L_GAP * L / 2, gb), (c + L_GAP * L / 2, c + 0.5 - w, gb)):
            right = o and (u1 > c + 0.5 - w - 1e-6 if ax == "y" else u0 < c - 0.5 + w + 1e-6)    # (screen right)
            if not canopy:
                break
            _bin(k, ax, plane, u0, u1, (bd - o, zb), (bt - o, R(H_FRONT)), sd, cap,
                 (1 if ax == "y" else -1) if right else None, (H_FACE - BIN_TOP) + o / L)
            if o:                                                   # (a handle on each bin, over its foot edge: as
                rows, wide = BIN_HANDLE                             # proud as the front is under its lowest px)
                zl = zb + (rows - 1.5) * PZ
                fl = (bd - o) - (bd - bt) * (zl - zb) / (R(H_FRONT) - zb)
                _handle(k, ax, plane, c, u0, u1, zb, rows, wide, math.ceil(fl / L - 1e-6) * L, sd)
        (t0, f0, *c0), (t1, f1, *c1) = SECTIONS                    # the cabinets (n 0), the drawers (1): a frame
        t0 -= cab_up                                                # of bars, the doors back in it
        secs = ([(1, t0, t0 + f1 - t1, *c1), (0, t0 + f1 - t1, f1, *c0)] if swap else
                [(0, t0, f0, *c0), (1, t1, f1, *c1)])
        e0, e1 = c - 0.5 + FRAME_IN * L, c + 0.5 - FRAME_IN * L
        for i, (n, top, foot, dep, splits, back) in enumerate(secs):
            fd, zt = dep * L, R(top)
            zf = zl1 if foot is None else R(foot)
            dt = zt - (PZ if i == 0 else 0.0)                       # (the doors' top, under the top bar)
            sw = SIDE_W[n] * L
            bars = [(e0, e1, zf, zf + PZ)] + ([(e0, e1, zt - PZ, zt)] if i == 0 else [])
            us = [c - 0.5 + f for f in splits]
            bars += [(u - L / 2, u + L / 2, zf + PZ, dt) for u in us]
            if n == 0:                                              # (the cabinets' sides: stepped back a px
                zs_ = zf + SIDE_STEP * PZ                           # above their foot's rows)
                bars += [(e0, e0 + sw, zf + PZ, zs_), (e1 - sw, e1, zf + PZ, zs_)]
                bars += [(e0, e0 + sw, zs_, dt, fd - L), (e1 - sw, e1, zs_, dt, fd - L)]
            else:
                bars += [(e0, e0 + sw, zf + PZ, dt), (e1 - sw, e1, zf + PZ, dt)]
            prism(k, ax, plane, e0, e1, [(0.0, zf + PZ), (fd - back * L, zf + PZ), (fd - back * L, dt), (0.0, dt)],
                  FACE, 3,
                  cols=[False, sd("fTS3", ax), False, False], cap=cap)          # (its doors)
            for q0, q1 in zip([e0 + sw] + [u + L / 2 for u in us], [u - L / 2 for u in us] + [e1 - sw]):
                _handle(k, ax, plane, c, q0, q1, zf + PZ, *HANDLES[n], fd - (back - 1) * L, sd)   # (a px out of
                                                                                                    # the door)
            for u0, u1, z0, z1_, *bd_ in bars:                      # (a deep top: lit, its front px pale)
                deep = back > 1 and abs(z1_ - z0 - PZ) < 1e-6
                bdep = bd_[0] if bd_ else fd
                prism(k, ax, plane, u0, u1, [(0.0, z0), (bdep, z0), (bdep, z1_), (0.0, z1_)], FACE, 3,
                      cols=[False, sd("fTS1", ax), sd("fTS1" if deep else "fTS0", ax), False], cap=cap)
                if deep:
                    k.poly([T.P(ax, plane, u, z1_ + PAINT, d) for u, d in ((u0, fd - L), (u1, fd - L), (u1, fd),
                                                                            (u0, fd))],
                           "wall", 0, Vector((0, 0, 1)), fixed=sd("fTS0", ax))
    if not canopy:
        return
    hf, hc, zh0 = H_FACE * L, H_CANOPY * L, R(H_FRONT)          # the header: its face, the canopy over it, a side
    for c in range(-1, 2):                                      # wall at each tile edge (not where the run turns a
        q0, q1 = max(a, c - 0.5), min(b, c + 0.5)               # corner)
        if q1 - q0 < 1e-6:
            continue
        m = (mit[0] if q0 <= a + 1e-6 else False, mit[1] if q1 >= b - 1e-6 else False)
        prism(k, ax, plane, q0, q1, [(0.0, zh0), (hf, zh0), (hf, R(1)), (0.0, R(1))], FACE, 3,
              cols=[False, sd("fTS2", ax), False, False], cap=cap, mitre=m)
        glass = {x for x0, art in H_SCREENS for x in range(x0, x0 + len(art[0]))}   # (a shadow row under the
        if ax == "x":                                                               # canopy, a pale row along its
            glass = {31 - x for x in glass}                                         # foot: on the px grid, the
        for x in range(round((q0 - (c - 0.5)) / L), round((q1 - (c - 0.5)) / L)):   # screens' first row over it)
            for r, col in ((0, H_SHADOW), (H_FRONT - H_SEEN - 1, H_EDGE)):
                if not (r == 0 and x in glass and q0 <= c - 0.5 + 1e-6 and q1 >= c + 0.5 - 1e-6):
                    _px(k, ax, plane, c - 0.5, x, r, R(H_SEEN) - PZ / 2, hf + L / 4, sd(col, ax))   # (half a row
                    #                           down: the face's px rows under the canopy, the screens' glass hiding it)
        prism(k, ax, plane, q0, q1, [(0.0, R(1)), (hc, R(1)), (hc, z1), (0.0, z1)], FACE, 3,
              cols=[False, sd("fTS0", ax), sd("fTS1", ax), False], cap=cap, mitre=m)
        for u, mm, e in ((q0, m[0], c - 0.5), (q1, m[1], c + 0.5)):
            if abs(u - e) > 1e-6 or mm:
                continue
            w0, w1 = (u, u + L / 2) if u == q0 else (u - L / 2, u)
            prism(k, ax, plane, w0, w1, [(0.0, zh0), (hc, zh0), (hc, R(1)), (0.0, R(1))], FACE, 3,
                  cols=[False, sd("fTS1", ax), False, False], cap=cap)
        if q0 > c - 0.5 + 1e-6 or q1 < c + 0.5 - 1e-6:
            continue
        for x0, art in (H_SCREENS[::-1] if ax == "x" else H_SCREENS):
            if ax == "x":
                x0, art = 32 - x0 - len(art[0]), tuple(r[::-1] for r in art)
            for r, row in enumerate(art):
                for x, ch in enumerate(row):
                    _px(k, ax, plane, c - 0.5 + x0 * L, x, r, R(H_SEEN), hf + L / 4,
                        sd("fTC0" if ch == "." else SCREEN_INK[ch], ax))


CHEST = (14, 37, 3, 2, 1)               # the chest (ref 26): its frame's top and foot (rows down), depth, bars (px),
                                        # the drawers' fronts back in it (px)
CHEST_ROWS = ((25, (0.5,), 3), (27, (0.25, 0.5, 0.75), 2))  # its sections: the top's foot (the middle bar under
                                        # it), the bottom's top; each one's ribs (1 px, across the tile), handles' width
CHEST_ROUND = 3                         # its outline's corners: curved, this radius (px; in half px slices)


def _rounded(u0, u1, z0, z1, box):
    """[u0, u1] x [z0, z1] inside box (e0, e1, zf, zt) with its corners curved (CHEST_ROUND): (u0, u1, z0, z1)
    slices, half a px wide where the curve is."""
    L, C = 1 / 32, CHEST_ROUND
    e0, e1, zf, zt = box
    cuts = sorted({u0, u1} | {e0 + i * L / 2 for i in range(2 * C + 1)} | {e1 - i * L / 2 for i in range(2 * C + 1)})
    out = []
    for s0, s1 in zip(cuts, cuts[1:]):
        if s0 < u0 - 1e-9 or s1 > u1 + 1e-9 or s1 - s0 < 1e-9:
            continue
        x = min((s0 + s1) / 2 - e0, e1 - (s0 + s1) / 2) / L        # (px from the nearer end)
        ins = (C - math.sqrt(max(0.0, C * C - (C - x) ** 2))) * PZ if x < C else 0.0
        a0, a1 = max(z0, zf + ins), min(z1, zt - ins)
        if a1 - a0 < 1e-9:
            continue
        if out and abs(out[-1][1] - s0) < 1e-9 and abs(out[-1][2] - a0) < 1e-9 and abs(out[-1][3] - a1) < 1e-9:
            out[-1] = (out[-1][0], s1, a0, a1)
        else:
            out.append((s0, s1, a0, a1))
    return out


def chest(k, ax, plane, a, b, mit, zl1, z1, band, sd):
    """A chest of drawers under the cushion: a frame (bars BAR px across its top, its foot, its sides and between its
    sections), the drawers' fronts back in it, a 1 px rib between them."""
    L = 1 / 32
    R = lambda n: z1 - n * PZ                                   # noqa: E731
    band(a, b, zl1, z1, "fTS4")                                 # (the face, dark in the gaps)
    cap = sd(D_SIDE_TONE, ax)
    top, foot, dep, bar, back = CHEST
    (mfoot, us0, w0), (mtop, us1, w1) = CHEST_ROWS
    fd, bw = dep * L, bar * L
    for c in range(-1, 2):
        if c - 0.5 < a - 1e-6 or c + 0.5 > b + 1e-6:
            continue
        e0, e1 = c - 0.5 + FRAME_IN * L, c + 0.5 - FRAME_IN * L
        zt, zf, zm0, zm1 = R(top), R(foot), R(mfoot), R(mtop)
        box = (e0, e1, zf, zt)
        for q0, q1, y0, y1 in _rounded(e0, e1, zf, zt, box):                     # (the drawers' fronts)
            prism(k, ax, plane, q0, q1, [(0.0, y0), (fd - back * L, y0), (fd - back * L, y1), (0.0, y1)], FACE, 3,
                  cols=[False, sd("fTS3", ax), False, False], cap=cap)
        bars = [(e0, e1, zf, zf + bar * PZ), (e0, e1, zt - bar * PZ, zt), (e0, e1, zm1, zm0),
                (e0, e0 + bw, zf, zt), (e1 - bw, e1, zf, zt)]
        for (z0, z1_), us, w in (((zm0, zt - bar * PZ), us0, w0), ((zf + bar * PZ, zm1), us1, w1)):
            ux = [c - 0.5 + f for f in us]
            bars += [(u - L / 2, u + L / 2, z0, z1_) for u in ux]               # (the ribs)
            for q0, q1 in zip([e0 + bw] + [u + L / 2 for u in ux], [u - L / 2 for u in ux] + [e1 - bw]):
                _handle(k, ax, plane, c, q0, q1, z0, HANDLES[1][0], w, fd - back * L + L, sd)
        for b0, b1, w0_, w1_ in bars:                               # (an across bar's top: lit, its front px pale)
            across = b1 - b0 > 0.5
            for u0, u1, z0, z1_ in _rounded(b0, b1, w0_, w1_, box):
                prism(k, ax, plane, u0, u1, [(0.0, z0), (fd, z0), (fd, z1_), (0.0, z1_)], FACE, 3,
                      cols=[False, sd("fTS1", ax), sd("fTS1" if across else "fTS0", ax), False], cap=cap)
                if across:
                    k.poly([T.P(ax, plane, u, z1_ + PAINT, d) for u, d in ((u0, fd - L), (u1, fd - L), (u1, fd),
                                                                            (u0, fd))],
                           "wall", 0, Vector((0, 0, 1)), fixed=sd("fTS0", ax))


TAN_TOPS = (Design("plain"), Design("console", body=console), Design("lockers", body=lockers, lip=False),
            Design("cabinets", body=functools.partial(lockers, canopy=False, cab_up=3), lip=False, cushion="fTS8"),
            Design("drawers", body=functools.partial(lockers, canopy=False, cab_up=3, swap=True), lip=False,
                   cushion="fTS8"),
            Design("chest", body=chest, cushion="fTS8"))         # (on the lip: its foot at 39 rows down)
