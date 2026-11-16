"""The station hull's tower design (station_hull_designs 4, after the ref's T3-5; design reference only): the middle
slot's box (station_hull_designs._top_box) TOWER_OUT px off the face, from the groove up to over the top. Across its
front, centred (rows from its top), a framed vent of slats over a block standing out from it, a seam across its
middle."""
from . import core
from . import station_hull as SH
from . import station_hull_designs as SD
from . import wall3d as T
from .wall3d_ext_geom import F, LINE, D

TOWER_OUT = 4                       # px off the face
TOWER_SLOPE = SH.GROOVE_D           # its foot, sloped back down to the face (and the block's to the box's front)
STEEP = 2                           # (px down for every px out)
VENT_CLEAR = 2                      # the vent's frame: px of the box's front clear round it (to its ends, the chamfer and
                                    # the block's top line)
SLATS, SLAT_IN = 4, 1               # slats in it, spaced evenly down it; px clear of its frame at either end
SLAT_LIT = "stL"
WIDE = 13                           # the block: px across, centred on the box's front
BLOCK = (54, 2)                     # the block: its bottom row, px proud of the box's front; a seam across its middle.
                                    # Its top's dark line on the box's front, across it, stands where the base's line
                                    # under the bullnose (the one with the plate) would show
JOIN_UP = 3                         # (rows up: the box's front stands out, so its sloped line shows lower; measured)
BLOCK_FACE, BLOCK_SIDE, BLOCK_SEAM = SH.SEAM, SH.GROOVE_D, SH.GROOVE_D   # its front and top; its ends; the seam
BLOCK_SLOPE = "stE"                 # its foot, sloped back down to the box's front
BLOCK_EDGE = SH.GROOVE_D            # a dark line down its front's edge at its end turned from view
PLATE_UP, PLATE_CLEAR, PLATE_DEEP = 1, 2, 4   # a plate on the box's top: px proud; px clear of its chamfer and its
                                    # edge lines; px deep
SIDE_PLATE, SIDE_DOWN = (4, 3), 5   # on the face beside the box: a plate (px wide, tall) this many px under the bullnose
SIDE_SEAMS, SIDE_SEAM = 11, SH.GROOVE_D   # two seams down from under it, either side of its middle px: px long
SIDE_FOOT, SIDE_CLEAR = 4, 0        # a plate where they end: px tall; px short of the box (across from the tile's end)
SIDE_FEET, SIDE_GAP = 2, 2          # that many such plates, one under another, this many px apart (a px of
                                    # it under the lower one's top: a px of face shows between)
PLATE_SIDE, PLATE_LINE = SH.GROOVE_D, SH.SEAM   # its sides; the lines round its top's edges
BLOCK_LIT, BLOCK_JOIN = "stL", SH.GROOVE_D   # a lit px along its front's top edge; a dark one on the box's front over
                                    # its top


def tower(f, s0, zk):
    s, px = f.sec, 1 / core.ZPX
    v0, v1 = (f.at_face(s0 + fr, zk) for fr in SH.SEAMS)
    a, b = min(v0, v1) - LINE / 2, max(v0, v1) + LINE / 2  # the middle slot out over its seams
    out = D + TOWER_OUT * LINE
    lift = 0.5 * TOWER_OUT * px                             # (see station_hull_designs._module)
    z0 = s.z_at(SH.GROOVE, -1) + lift
    top, c = s.H + SD.BOX_UP * px, SD.BOX_CHAMFER           # (as station_hull_designs._top_box makes it)
    rows = round((top - z0) / px)
    row = lambda n: z0 + (rows - n) * px                    # noqa: E731  the top of row n under the box's top
    across = lambda p: b - p * LINE                         # noqa: E731  p px across from its near end
    fd = out + 0.001
    r1, n = BLOCK
    lift2 = 0.5 * n * px                                    # (its front stands lower still on screen)
    r0 = rows - round((s.z_at(s.zb, SH.UNDER) + lift - px - lift2 - z0) / px) - JOIN_UP
    # the vent: a frame VENT_CLEAR px in from the box's ends, under its chamfer and over the block's top line; inside
    # it the box's front a px back, slats on it
    e = (1 + VENT_CLEAR) * LINE                             # (inside the box's edge lines)
    v0, v1 = c + VENT_CLEAR, r0 - 2 - VENT_CLEAR
    w0, w1 = a + e + LINE, b - e - LINE
    SD._top_box(f, a, b, z0, out, TOWER_SLOPE, STEEP, (w0, w1, row(v1 - 1), row(v0 + 1)))
    _outline(f, a + e, b - e, row(v1), row(v0), fd, SD.BOX_LINE)
    inner = v1 - v0 - 2                                     # (rows inside the frame)
    gap = (inner - 2 * SLATS) / (SLATS + 1)
    w, vd, dz = SLAT_IN * LINE, out - LINE + 0.001, -0.5 * px   # (the set-back front shows half a px higher)
    for i in range(SLATS):                                  # (each a dark row over a lit one, spaced evenly)
        k = v0 + 1 + round(gap * (i + 1) + 2 * i)
        SD._rect(f, w0 + w, w1 - w, row(k + 1) + dz, row(k) + dz, vd, SH.GROOVE_D)
        SD._rect(f, w0 + w, w1 - w, row(k + 2) + dz, row(k + 1) + dz, vd, SLAT_LIT)
    _top_plate(f, a, b, top, out - c * LINE)
    _side(f, b, s0 + 1)
    # the dark block, a seam across its middle; its top's line across the box's front
    q0 = (round((b - a) / LINE) - WIDE) // 2
    u0, u1 = across(q0 + WIDE), across(q0)
    _raise(f, u0, u1, row(r1) + lift2, row(r0) + lift2, out, n, BLOCK_FACE, BLOCK_FACE, BLOCK_SIDE, BLOCK_SLOPE)
    bd = out + n * LINE + 0.001
    m = (r0 + r1) // 2
    SD._rect(f, u0, u1, row(m + 1) + lift2, row(m) + lift2, bd, BLOCK_SEAM)
    SD._rect(f, u0, u1, row(r0 + 1) + lift2, row(r0) + lift2, bd, BLOCK_LIT)
    SD._rect(f, u0, u0 + LINE, row(r1) + lift2, row(r0 + 1) + lift2, bd, BLOCK_EDGE)   # (u0: its end turned from view)
    SD._rect(f, a, b, row(r0) + lift2, row(r0 - 1) + lift2, fd, BLOCK_JOIN)   # (its row on the box's front: r0 - 2)


def _side(f, b, e):
    """On the face between the box's near end b and the tile's end e: a plate SIDE_DOWN px under the bullnose's foot,
    centred; two dark seams down from under it; plates where they end, across from the tile's end to SIDE_CLEAR px
    short of the box."""
    s, px = f.sec, 1 / core.ZPX
    w, (pw, ph), n, sd, qh = round((e - b) / LINE), SIDE_PLATE, SIDE_DOWN, SIDE_SEAMS, SIDE_FOOT
    at = lambda p: b + p * LINE                             # noqa: E731  p px from the box toward the tile's end
    z = lambda k: s.z_at(s.zb, k)                           # noqa: E731  k px under the bullnose's foot
    p0 = (w - pw) // 2
    k = 1                                                   # (a px proud, a plate's front shows a px toward the box)
    SH._part(f, at(p0 + k), at(p0 + pw + k), z(n + ph), z(n), LINE, SH.TAB, SH.TAB_TOP, SH.TAB_SIDE)
    c = p0 + pw // 2                                        # (the plate's middle px; a seam either side of it)
    for p in (c - 1, c + 1):
        SD._rect(f, at(p), at(p + 1), z(n + ph + sd), z(n + ph), D + 0.001, SIDE_SEAM)
    for i in range(SIDE_FEET):                              # (one under another, SIDE_GAP px apart)
        q = n + ph + sd + i * (qh + SIDE_GAP)
        SH._part(f, at(SIDE_CLEAR + k), e, z(q + qh), z(q), LINE, SH.TAB, SH.TAB_TOP, SH.TAB_SIDE)


def _top_plate(f, a, b, top, front):
    """A plate PLATE_UP px proud of the box's top, PLATE_CLEAR px clear of its chamfer and its edge lines, PLATE_DEEP px
    deep; its sides and its edges' lines dark."""
    px, k = 1 / core.ZPX, (1 + PLATE_CLEAR) * LINE
    u0, u1 = a + k, b - k
    d1 = front - PLATE_CLEAR * LINE
    d0 = d1 - PLATE_DEEP * LINE
    z1 = top + PLATE_UP * px
    f.part(u0, u1, [(d0, top - 0.01), (d0, z1), (d1, z1), (d1, top - 0.01)], [None, SH.TOP, PLATE_SIDE, None],
           PLATE_SIDE, end=False)
    zl = z1 + T.PAINT
    for p, q in (((u0, d0), (u1, d0 + LINE)), ((u0, d1 - LINE), (u1, d1)), ((u0, d0), (u0 + LINE, d1)),
                 ((u1 - LINE, d0), (u1, d1))):
        f.k.poly([T.P(f.ax, f.plane, u, zl, d) for u, d in ((p[0], p[1]), (q[0], p[1]), (q[0], q[1]), (p[0], q[1]))],
                 F, 3, core.Vector((0, 0, 1)), fixed=T.SEAM_PASS or PLATE_LINE)


def _raise(f, u0, u1, z0, z1, base, n, face, top, side, slope):
    """A block n px proud of a plumb front at d = base over [u0, u1] x [z0, z1], its foot sloped back down to it."""
    zb = z0 - STEEP * n / core.ZPX
    f.part(u0, u1, [(base - 0.01, zb), (base - 0.01, z1), (base + n * LINE, z1), (base + n * LINE, z0), (base, zb)],
           [None, top, face, slope, None], side, end=False)


def _outline(f, u0, u1, z0, z1, d, col):
    px = 1 / core.ZPX
    for q in ((u0, u1, z0, z0 + px), (u0, u1, z1 - px, z1), (u0, u0 + LINE, z0, z1), (u1 - LINE, u1, z0, z1)):
        SD._rect(f, *q, d, col)
