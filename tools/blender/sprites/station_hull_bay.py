"""The station hull's bay design (station_hull_designs 5, after the ref's T3-2; design reference only): the middle slot
(between its seams) let into the hull from BAY_FOOT px over the groove up through the whole bullnose, back to the top's
first seam; the top runs on over it to where the bullnose began, its edge a BAY_LIP px face into the bay. Its
machinery: to come."""
from . import core
from . import wall3d as T
from . import station_hull as SH
from .wall3d_ext_geom import F, LINE

BAY_FOOT, BAY_LIP = 15, 2           # its floor: px over the groove; the top's edge over it: px tall
BAY_BACK, BAY_FLOOR, BAY_WALL = "stE", "stE", SH.GROOVE_D   # its back, its floor, its ends (in shadow)
BAY_LIP_FACE = SH.FACE              # the top's edge over it


def span(f, s0):
    """The bay across a whole span (u0, u1): the middle slot inside its seams where they stand on the upright face."""
    zk = f.sec.band_z(SH.PLUMB_BAND)
    a, b = (f.at_face(s0 + fr, zk) for fr in SH.SEAMS)
    return a + LINE / 2, b - LINE / 2


def blocks(f, s0, s1):
    """The face's armour on a whole span in the bay design: the base's lower block, the upper one either side of the
    bay and under it, the top over it, and the bay's inside."""
    s, px = f.sec, 1 / core.ZPX
    H, G = s.H, SH.GROOVE
    u0, u1 = span(f, s0)
    zf, zl = s.z_at(G, -BAY_FOOT), H - BAY_LIP * px
    f.block(s0, s1, 0.0, G)
    f.block(s0, u0, G, H)
    f.block(u1, s1, G, H)
    f.block(u0, u1, G, zf)
    ts = SH.E - round((SH.R_D + SH.TOP_SEAM) * 32) / 32     # (the top's first seam: its back)
    dc = s.lean_d(H)                                        # (where the bullnose began on the top)
    f.part(u0, u1, [(0.0, zl), (0.0, H), (dc, H), (dc, zl)], [None, SH.TOP, BAY_LIP_FACE, None], None, end=False)
    f.part(u0, u1, [(0.0, zf), (0.0, zl), (ts, zl), (ts, zf)], [None, None, BAY_BACK, None], None, end=False)
    low, high = s.front(zf, zl), s.front(zl, H)
    f.k.poly([T.P(f.ax, f.plane, u, zf + T.PAINT, d) for u, d in ((u0, ts), (u1, ts), (u1, low[0][0]),
                                                                  (u0, low[0][0]))],
             F, 3, core.Vector((0, 0, 1)), fixed=T.SEAM_PASS or BAY_FLOOR)
    o, e = T.P(f.ax, 0, 0, 0, 0), 0.001
    for u, sg in ((u0, 1), (u1, -1)):                       # its ends (the armour's either side): under the top's
        for q in ([(ts, zf)] + low + [(ts, zl)], [(dc, zl)] + high):   # edge, and the bullnose's cut beside it
            f.k.poly([T.P(f.ax, f.plane, u + sg * e, z, d) for d, z in q], F, 3,
                     (T.P(f.ax, 0, sg, 0, 0) - o).normalized(), fixed=T.SEAM_PASS or BAY_WALL)
