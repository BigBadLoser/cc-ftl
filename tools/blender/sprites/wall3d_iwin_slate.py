"""Interior windows on slate (walls up; Space Haven wall style 44, windows #2757 / #115 / #2861): the default walls'
window (wall3d_iwin_def: the opening, sill, beam, pane) with the ramp of wall3d_iwin_ramp in slate's colours, and
slate's own touches: under the opening the ramp's front grey (its blue plate only under the posts, its seam panel gone
where an end block cuts it), a blue block painted across the middle tile's pockets' floors, no rail seam by the right
post, the beam lowered under the rail's shadow band and the stripe's lit top.

PART: "l" (the post at the -x end), "m" (open across), "r" (the post at the +x end), as wall3d_iwin_def."""
from . import core
from . import walls as W
from . import wall3d_iwin_ramp as R
from .faction import slate as S
from .faction.parts import PZ

L = R.L
GREY = "fGW2"                           # the ramp's front under the opening, in place of the blue plate: the slope's
                                        # tone over it
SHADOW = 3                              # px: the rail's shadow band under the header (its lowest px shows)
LIT_UNDER = 1                           # px: the stripe's lit top kept under the header's dark edge over the window
BLUE = "ochre"                          # (the trim's: the stripe's, faction.slate.BLUE)
PANEL = 0.25                            # the plate's seam panel: the middle half of a tile (faction.slate.slate_plate)


def _pre(k, part, a, b, yf):
    """The ramp's front under the opening grey: its blue plate's polygons there (near side: mesh y < 0) take the grey;
    the plate's seam panel (the middle half of a tile) cut by an end block's edge: gone."""
    m = k.m
    blues = {tuple(round(c, 5) for c in core.lin(f"fGT{s}")) for s in "0123456sw"}
    grey = m._cols(GREY)
    for i, f in enumerate(m.f):
        pts = [m.v[j] for j in f[0]]
        cx = sum(p[0] for p in pts) / len(pts)
        c = tuple(round(v, 5) for v in f[2])
        if (a < cx < b and max(p[1] for p in pts) < -yf + 1e-6 and c in blues and
                max(p[2] for p in pts) <= W.skirt_top() + 1e-6):     # (the ramp's only: not the header's rail)
            m.f[i] = (f[0],) + grey
    if any(-PANEL < u < PANEL for u in (a, b)):
        seam = {tuple(round(c, 5) for c in core.lin(s)) for s in ("fGT2", "fGTs")}
        m.f = [f for f in m.f if not (tuple(round(c, 5) for c in f[2]) in seam and
                                      all(-PANEL - 1e-6 < m.v[j][0] < PANEL + 1e-6 and m.v[j][1] < -yf + 1e-6 and
                                          m.v[j][2] <= W.skirt_top() + 1e-6 for j in f[0]))]


def _post(k, part):
    _rail_seam(k, R.D._span(part)[1])


def _rail_seam(k, x1):
    """No rail seam by the right post (slate._rail's line on its end block's front, a px wide, 3 px past the post:
    by the left post that edge faces the camera and shows none)."""
    if x1 >= 0.5:
        return
    m = k.m
    g3 = tuple(round(c, 5) for c in core.lin("fGT3"))
    e = 0.5 - S.END_W
    m.f = [f for f in m.f if not (tuple(round(c, 5) for c in f[2]) == g3 and
                                  abs(min(m.v[j][0] for j in f[0]) - e) < 1e-6 and
                                  abs(max(m.v[j][0] for j in f[0]) - e - L) < 1e-6)]


LOOK = R.Look(floor_lit="fGS0", floor_shade="fGS2", lip_lit="fGW0", back="fGT6", side="fGS4", rib=GREY, toe="fGS2",
              plate="fGS2", plate_front="fGS3",       # (the plates: the vertical wall's greys, its face fGS3 / fGS2)
              floor_paint={"m": "fGT1"}, paint_shade="fGT3", lip_paint="fGT0",   # (the slope's blue on the middle tile)
              beam_drop=(SHADOW + LIT_UNDER) * PZ,    # the opening's top under the rail's shadow band and the stripe's
              #   lit top px: the header's foot as on the wall over it (the band's lowest px under every block, its dark
              #   bottom edge, over the lit px as on the wall)
              pre=_pre, post=_post)


def window(fn, part):
    """fn: slate's straight piece builder (tile.wall.slate.full.m10). (own, wide, pane objects)."""
    return R.window(fn, part, LOOK)
