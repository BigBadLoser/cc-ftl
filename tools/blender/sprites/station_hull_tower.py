"""The station hull's tower design (station_hull_designs 4, after the ref's T3-5; design reference only): the middle
slot's box (station_hull_designs._top_box) TOWER_OUT px off the face, from the groove up to over the top. Across its
front (px from its near end, rows from its top): a pipe up its near side with clamps on it; beside it a framed vent of
slats over two dark panels."""
from . import core
from . import station_hull as SH
from . import station_hull_designs as SD
from .wall3d_ext_geom import LINE, D

TOWER_OUT = 4                       # px off the face
PIPE = (1, 4)                       # the pipe: px across from the near end
PIPE_FACE, PIPE_TOP, PIPE_SIDE = "stL", "stH", SH.SEAM
CLAMPS = (12, 20, 40)               # clamps on it, rows from the box's top: a px wider each side, 2 rows, a px prouder
SIDE = (6, 15)                      # the vent and the panels: px across
VENT = (5, 22)                      # the vent's frame: rows
SLATS = 2                           # a slat every this many rows inside it
SLAT_LIT = "stL"
PANELS = ((25, 38), (40, 54))       # the dark panels: rows
PANEL, PANEL_TOP = SH.GROOVE_D, "stE"


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
    # the pipe and its clamps
    p0, p1 = PIPE
    _raise(f, across(p1), across(p0), z0, row(c + 1), out, 1, PIPE_FACE, PIPE_TOP, PIPE_SIDE)
    for n in CLAMPS:
        _raise(f, across(p1 + 1), across(p0 - 1), row(n + 2), row(n), out, 2, PIPE_FACE, PIPE_TOP, PIPE_SIDE)
    # the vent: a frame, slats in it
    q0, q1 = SIDE
    u0, u1 = across(q1), across(q0)
    r0, r1 = VENT
    _outline(f, u0, u1, row(r1), row(r0), fd, SD.BOX_LINE)
    for n in range(r0 + 2, r1 - 1, SLATS):                  # (each a dark row over a lit one)
        SD._rect(f, u0 + LINE, u1 - LINE, row(n + 1), row(n), fd, SH.GROOVE_D)
        SD._rect(f, u0 + LINE, u1 - LINE, row(n + 2), row(n + 1), fd, SLAT_LIT)
    # the dark panels under it
    for r0, r1 in PANELS:
        SD._rect(f, u0, u1, row(r1), row(r0), fd, PANEL)
        SD._rect(f, u0, u1, row(r0 + 1), row(r0), fd + 0.001, PANEL_TOP)


def _raise(f, u0, u1, z0, z1, base, n, face, top, side):
    """A block n px proud of a plumb front at d = base over [u0, u1] x [z0, z1]."""
    f.part(u0, u1, [(base - 0.01, z0), (base - 0.01, z1), (base + n * LINE, z1), (base + n * LINE, z0)],
           [None, top, face, None], side, end=False)


def _outline(f, u0, u1, z0, z1, d, col):
    px = 1 / core.ZPX
    for q in ((u0, u1, z0, z0 + px), (u0, u1, z1 - px, z1), (u0, u0 + LINE, z0, z1), (u1 - LINE, u1, z0, z1)):
        SD._rect(f, *q, d, col)
