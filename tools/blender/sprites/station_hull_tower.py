"""The station hull's tower design (station_hull_designs 4, after the ref's T3-5; design reference only): the middle
slot's box (station_hull_designs._top_box) TOWER_OUT px off the face, from the groove up to over the top. Across its
front, centred (rows from its top), a framed vent of slats over a block standing out from it, a seam across its
middle."""
from . import core
from . import station_hull as SH
from . import station_hull_designs as SD
from .wall3d_ext_geom import LINE, D

TOWER_OUT = 4                       # px off the face
TOWER_SLOPE = "stH"                 # its foot, sloped back down to the face (and the block's to the box's front)
STEEP = 3                           # (px down for every px out)
VENT_CLEAR = 2                      # the vent's frame: px of the box's front clear round it (to its ends, the chamfer and
                                    # the block's top line)
SLATS = 2                           # a slat every this many rows inside it
SLAT_LIT = "stL"
WIDE = 11                           # the block: px across, centred on the box's front
BLOCK = (54, 2)                     # the block: its bottom row, px proud of the box's front; a seam across its middle.
                                    # Its top's dark line on the box's front, across it, stands where the base's line
                                    # under the bullnose (the one with the plate) would show
JOIN_UP = 3                         # (rows up: the box's front stands out, so its sloped line shows lower; measured)
BLOCK_FACE, BLOCK_SIDE, BLOCK_SEAM = SH.SEAM, SH.GROOVE_D, SH.GROOVE_D   # its front and top; its ends; the seam
BLOCK_SLOPE = "stL"                # its foot, sloped back down to the box's front
BLOCK_LIT, BLOCK_JOIN = "stL", SH.GROOVE_D   # a lit px along its front's top edge; a dark one on the box's front over
                                    # its top


def tower(f, s0, zk):
    s, px = f.sec, 1 / core.ZPX
    v0, v1 = (f.at_face(s0 + fr, zk) for fr in SH.SEAMS)
    a, b = min(v0, v1) - LINE / 2, max(v0, v1) + LINE / 2  # the middle slot out over its seams
    out = D + TOWER_OUT * LINE
    lift = 0.5 * TOWER_OUT * px                             # (see station_hull_designs._module)
    z0 = s.z_at(SH.GROOVE, -1) + lift
    top, c = SD._top_box(f, a, b, z0, out, TOWER_SLOPE, STEEP)
    rows = round((top - z0) / px)
    row = lambda n: z0 + (rows - n) * px                    # noqa: E731  the top of row n under the box's top
    across = lambda p: b - p * LINE                         # noqa: E731  p px across from its near end
    fd = out + 0.001
    # the dark block, a seam across its middle; its top's line across the box's front
    r1, n = BLOCK
    lift2 = 0.5 * n * px                                    # (its front stands lower still on screen)
    r0 = rows - round((s.z_at(s.zb, SH.UNDER) + lift - px - lift2 - z0) / px) - JOIN_UP
    q0 = (round((b - a) / LINE) - WIDE) // 2
    u0, u1 = across(q0 + WIDE), across(q0)
    _raise(f, u0, u1, row(r1) + lift2, row(r0) + lift2, out, n, BLOCK_FACE, BLOCK_FACE, BLOCK_SIDE, BLOCK_SLOPE)
    bd = out + n * LINE + 0.001
    m = (r0 + r1) // 2
    SD._rect(f, u0, u1, row(m + 1) + lift2, row(m) + lift2, bd, BLOCK_SEAM)
    SD._rect(f, u0, u1, row(r0 + 1) + lift2, row(r0) + lift2, bd, BLOCK_LIT)
    SD._rect(f, a, b, row(r0) + lift2, row(r0 - 1) + lift2, fd, BLOCK_JOIN)   # (its row on the box's front: r0 - 2)
    # the vent: a frame VENT_CLEAR px in from the box's ends, under its chamfer and over that line; slats in it
    e = (1 + VENT_CLEAR) * LINE                             # (inside the box's edge lines)
    v0, v1 = c + VENT_CLEAR, r0 - 2 - VENT_CLEAR
    _outline(f, a + e, b - e, row(v1), row(v0), fd, SD.BOX_LINE)
    for k in range(v0 + 2, v1 - 1, SLATS):                  # (each a dark row over a lit one)
        SD._rect(f, a + e + LINE, b - e - LINE, row(k + 1), row(k), fd, SH.GROOVE_D)
        SD._rect(f, a + e + LINE, b - e - LINE, row(k + 2), row(k + 1), fd, SLAT_LIT)


def _raise(f, u0, u1, z0, z1, base, n, face, top, side, slope):
    """A block n px proud of a plumb front at d = base over [u0, u1] x [z0, z1], its foot sloped back down to it."""
    zb = z0 - STEEP * n / core.ZPX
    f.part(u0, u1, [(base - 0.01, zb), (base - 0.01, z1), (base + n * LINE, z1), (base + n * LINE, z0), (base, zb)],
           [None, top, face, slope, None], side, end=False)


def _outline(f, u0, u1, z0, z1, d, col):
    px = 1 / core.ZPX
    for q in ((u0, u1, z0, z0 + px), (u0, u1, z1 - px, z1), (u0, u0 + LINE, z0, z1), (u1 - LINE, u1, z0, z1)):
        SD._rect(f, *q, d, col)
