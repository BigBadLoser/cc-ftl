"""The station hull's window (#524; after the station ref's hull window, design reference only): a straight run's design
over two or more tiles, as the ship hull's (wall3d_ext_window, the same pieces and neighbours: w1 the run's start, w3
its end, w2 the middles). The station's section cut through from the line under the bullnose (the header: the
bullnose and the top over it, whole) down to a sill SILL px over the groove; in the opening a pane of tinted glass
GLASS_IN behind the front, the window's back wall behind it. An end piece keeps a frame of the whole section at its
outer end (JAMB along the face).

  tile.hull.station.ext.o<o>.m<mask>.w1/.w2/.w3   (o1 m10 along x, o2 m5 along y; w1 the lower tile coordinate end)

First pass: the shapes alone (no dress on the header, sill or frames yet)."""
from . import core
from . import wall3d as T
from . import station_hull as SH
from .wall3d_ext_geom import D

PART = [None]                       # the piece being built: "w1" | "w2" | "w3" (None: not a window)
SILL = 10                           # the sill's top: this many px over the groove
GLASS_IN = 4 / 32                   # the pane's front this far behind the front
PANE = 1 / 32                       # the pane's thickness
BACK_IN = 3 / 32                    # the window's back wall this far behind the pane's back
JAMB = 6 / 32                       # an end piece's frame at its outer end, along the face
GLASS = [None]                      # the pane's relief while a piece is built (its caller renders it apart)
REVEAL_SILL, REVEAL_SIDE, BACK_WALL = "stM", "stD", "stE"   # the sill's top in the opening, the frames' sides, the back


def span(f, s, s0, s1, zt):
    """A window tile's armour over [s0, s1] (its whole section: the header, the sill, a frame at an end piece's outer
    end, the back wall and the pane)."""
    from .wall3d_ext_window import _slab
    H, zs = s.H, s.z_at(SH.GROOVE, -SILL)
    part = PART[0]
    w0, w1 = s0, s1                                     # (the opening along the face)
    if part == "w1":
        w0 = s0 + JAMB
    elif part == "w3":
        w1 = s1 - JAMB
    for z0, z1 in ((0.0, SH.GROOVE), (SH.GROOVE, zs), (zt, H)):
        f.block(s0, s1, z0, z1)                         # the sill (two tones, at the groove) and the header
    if w0 > s0:
        f.part(s0, w0, s.sec(zs, zt), s.cols(s.sec(zs, zt), "face"), (None, REVEAL_SIDE))
    if w1 < s1:
        f.part(w1, s1, s.sec(zs, zt), s.cols(s.sec(zs, zt), "face"), (REVEAL_SIDE, None))
    gf = D - GLASS_IN                                   # the pane's front
    gb = gf - PANE - BACK_IN                            # the back wall's front
    pf = [(0.0, zs), (gb, zs), (gb, zt), (0.0, zt)]
    f.part(w0, w1, pf, [None, BACK_WALL, None, None], None)     # the back wall
    pf = [(gb, zs), (D, zs), (D, zs - 0.001), (gb, zs - 0.001)]
    f.part(w0, w1, pf, [REVEAL_SILL, None, None, None], None)    # (the sill's top in the opening: its own tone)
    GLASS[0] = GLASS[0] or T.Relief("station_window_glass")
    _slab(GLASS[0], f.ax, f.plane, [(w0, zs), (w1, zs), (w1, zt), (w0, zt)], gf - PANE, gf, "glassL",
          [False] * 4, back=False)


def _build(m, o, part):
    """(own, wide, pane objects): the piece with its run neighbours beside it (windows.HULL_NEXT)."""
    from .wall3d_ext import STRAIGHT
    from .windows import HULL_NEXT
    dx, dy = STRAIGHT[(m, o)]
    GLASS[0] = None
    try:
        PART[0] = part
        own = SH._block(m, o)
        pane = GLASS[0].build() if GLASS[0] else []
        more = []
        for k, n in zip((-1, 1), HULL_NEXT[part]):
            PART[0] = n
            GLASS[0] = None
            for ob in SH._block(m, o):
                ob.location = ob.location + core.G(k * dx, k * dy, 0.0)
                more.append(ob)
        return own, own + more, pane
    finally:
        PART[0], GLASS[0] = None, None


def piece(m, o, part):
    from . import env_build, post
    from .windows import HULL_GLASS, render_glass
    sid = f"tile.hull.station.ext.o{o}.m{m}.{part}"
    core.clear_scene_meshes()
    post.select(SH.PALETTE)
    own, wide, pane = _build(m, o, part)
    it = env_build.crop_item(sid, (1, 1), *render_glass(sid, own, wide, pane, HULL_GLASS))
    return [it] if it else []


def jobs():
    return [lambda m=m, o=o, p=p: piece(m, o, p) for m, o in ((10, 1), (5, 2)) for p in ("w1", "w2", "w3")]

