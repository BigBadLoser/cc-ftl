"""The station hull's tower design (station_hull_designs 4, after the ref's T3-5; design reference only): the middle
slot's box (station_hull_designs._top_box) TOWER_OUT px off the face, from the groove up to over the top. Across its
near side (the end in view) a pipe with clamps on it; centred on its front (rows from its top) a framed vent of slats
over a dark block, standing out from it, a seam across its middle."""
from . import core
from . import station_hull as SH
from . import station_hull_designs as SD
from .wall3d_ext_geom import LINE, D

TOWER_OUT = 4                       # px off the face
PIPE = (1, 3, 1)                    # the pipe up the box's near end: px out from the face (its span across that end), px
                                    # proud of it
PIPE_FACE, PIPE_TOP, PIPE_SIDE = "stL", "stH", SH.SEAM
CLAMPS = (12, 20, 40)               # clamps on it, rows from the box's top: across the end, 2 rows, 2 px proud
WIDE = 11                           # the vent and the block: px across, centred on the box's front
VENT = (5, 22)                      # the vent's frame: rows
SLATS = 2                           # a slat every this many rows inside it
SLAT_LIT = "stL"
BLOCK = (25, 54, 2)                 # the dark block: rows, px proud of the box's front; a seam across its middle
BLOCK_FACE, BLOCK_TOP, BLOCK_SEAM = SH.GROOVE_D, SH.SEAM, "stE"


def tower(f, s0, zk):
    s, px = f.sec, 1 / core.ZPX
    v0, v1 = (f.at_face(s0 + fr, zk) for fr in SH.SEAMS)
    a, b = min(v0, v1) - LINE / 2, max(v0, v1) + LINE / 2  # the middle slot out over its seams
    out = D + TOWER_OUT * LINE
    lift = 0.5 * TOWER_OUT * px                             # (see station_hull_designs._module)
    z0 = s.z_at(SH.GROOVE, -1) + lift
    top, c = SD._top_box(f, a, b, z0, out)
    rows = round((top - z0) / px)
    row = lambda n: z0 + (rows - n) * px                    # noqa: E731  the top of row n under the box's top
    across = lambda p: b - p * LINE                         # noqa: E731  p px across from its near end
    fd = out + 0.001
    # the pipe up its near end (b, the end in view), and its clamps
    d0, d1, n = PIPE
    _side(f, b, D + d0 * LINE, D + d1 * LINE, z0, row(c + 1), n, PIPE_FACE, PIPE_TOP)
    for r in CLAMPS:
        _side(f, b, D, out, row(r + 2), row(r), 2, PIPE_FACE, PIPE_TOP)
    # the vent: a frame, slats in it
    q0 = (round((b - a) / LINE) - WIDE) // 2
    u0, u1 = across(q0 + WIDE), across(q0)
    r0, r1 = VENT
    _outline(f, u0, u1, row(r1), row(r0), fd, SD.BOX_LINE)
    for n in range(r0 + 2, r1 - 1, SLATS):                  # (each a dark row over a lit one)
        SD._rect(f, u0 + LINE, u1 - LINE, row(n + 1), row(n), fd, SH.GROOVE_D)
        SD._rect(f, u0 + LINE, u1 - LINE, row(n + 2), row(n + 1), fd, SLAT_LIT)
    # the dark block under it, a seam across its middle
    r0, r1, n = BLOCK
    lift2 = 0.5 * n * px                                    # (its front stands lower still on screen)
    _raise(f, u0, u1, row(r1) + lift2, row(r0) + lift2, out, n, BLOCK_FACE, BLOCK_TOP, SH.SEAM)
    m = (r0 + r1) // 2
    SD._rect(f, u0, u1, row(m + 1) + lift2, row(m) + lift2, out + n * LINE + 0.001, BLOCK_SEAM)


def _raise(f, u0, u1, z0, z1, base, n, face, top, side):
    """A block n px proud of a plumb front at d = base over [u0, u1] x [z0, z1]."""
    f.part(u0, u1, [(base - 0.01, z0), (base - 0.01, z1), (base + n * LINE, z1), (base + n * LINE, z0)],
           [None, top, face, None], side, end=False)


def _side(f, u, d0, d1, z0, z1, n, face, top):
    """A block n px proud of the box's end at u (the end in view: it stands out toward +u) over [d0, d1] x [z0, z1]."""
    f.part(u - 0.01, u + n * LINE, [(d0, z0), (d0, z1), (d1, z1), (d1, z0)], [None, top, face, None], face, end=False)


def _outline(f, u0, u1, z0, z1, d, col):
    px = 1 / core.ZPX
    for q in ((u0, u1, z0, z0 + px), (u0, u1, z1 - px, z1), (u0, u0 + LINE, z0, z1), (u1 - LINE, u1, z0, z1)):
        SD._rect(f, *q, d, col)
