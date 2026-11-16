"""The station hull's bay design (station_hull_designs 5, after the ref's T3-2; design reference only): the middle slot
(between its seams) let into the hull from the groove up through the bullnose to BAY_LIP px under the top (the top runs
on over it, that thick), back to the top's first seam. Its machinery: to come."""
from . import core
from . import wall3d as T
from . import station_hull as SH
from .wall3d_ext_geom import F, LINE

BAY_LIP = 2                         # the top over it: px thick
BAY_BACK, BAY_FLOOR, BAY_WALL = "stE", SH.GROOVE_D, SH.GROOVE_D   # its back, its floor, its ends (in shadow)


def span(s0):
    """The bay across a whole span (u0, u1): the middle slot inside its seams."""
    a, b = (s0 + fr for fr in SH.SEAMS)
    return a + LINE / 2, b - LINE / 2


def blocks(f, s0, s1):
    """The face's armour on a whole span in the bay design: the base's lower block, the upper one either side of the
    bay, and the bay's inside."""
    s, px = f.sec, 1 / core.ZPX
    H, G = s.H, SH.GROOVE
    u0, u1 = span(s0)
    f.block(s0, s1, 0.0, G)
    f.block(s0, u0, G, H)
    f.block(u1, s1, G, H)
    zl = H - BAY_LIP * px
    f.block(u0, u1, zl, H)                                  # (the top over it, the bullnose's top with it)
    ts = SH.E - round((SH.R_D + SH.TOP_SEAM) * 32) / 32     # (the top's first seam: its back)
    f.part(u0, u1, [(0.0, G), (0.0, zl), (ts, zl), (ts, G)], [None, None, BAY_BACK, None], None, end=False)
    front = s.front(G, zl)
    f.k.poly([T.P(f.ax, f.plane, u, G + T.PAINT, d) for u, d in ((u0, ts), (u1, ts), (u1, front[0][0]),
                                                                 (u0, front[0][0]))],
             F, 3, core.Vector((0, 0, 1)), fixed=T.SEAM_PASS or BAY_FLOOR)
    o, e = T.P(f.ax, 0, 0, 0, 0), 0.001
    for u, sg in ((u0, 1), (u1, -1)):                       # its ends (the armour's either side)
        q = [(ts, G)] + front + [(ts, zl)]
        f.k.poly([T.P(f.ax, f.plane, u + sg * e, z, d) for d, z in q], F, 3,
                 (T.P(f.ax, 0, sg, 0, 0) - o).normalized(), fixed=T.SEAM_PASS or BAY_WALL)
