"""The bay looks' shared frame (wall3d_belly_bay) on a belly's near parts that are not straight runs (wall3d_belly: a
45-degree facet, a convex corner's chamfer), so they carry the runs' lines on round to them: the cut's lit lip, the
ledge on the deck line with its shade, the foot's lit chamfer, the slope's lit top edge, its seams down and across,
its rim. Drawn as the exterior's diagonals are (wall3d_ext_diag_detail): marks painted on a face's plane, a part
raised from it, each clipped to the part's other planes and to a band of height (and across, for a seam down). Each
band at the run's own heights (its section: so at a hip the lines meet), and a seam, level or upright on screen here,
softened as a run's slant one comes out of coverage anti-aliasing (the exterior's diagonals' level seams so too,
wall3d_ext_diag_detail LEVEL_SEAM): a level one two whole px rows, the run's two-row core (a darker row over a
lighter), one down a px column in the lighter."""
from mathutils import Vector

from .wall3d_belly_bay import LEDGE, SLOPE_SEAMS
from .wall3d_ext_diag_detail import LIT, Z64, _paint
from .wall3d_ext_geom import LINE, YS

UP = Vector((0, 0, 1))
ACROSS = 16                         # (screen px down per tile unit of x + y)
SOFT, FAINT = "hbSlopeLnSoft", "hbSlopeLnFaint"     # (a slope seam's tones here, as a run's anti-aliased one
                                                    # comes out: a level one a row of the first over a row of
                                                    # the second; one down the second)
FOOT = ("hbFcEdge", "hbFcLit", "hbFcMid")    # (the rows over the foot, up from it; the slope's lit top row, its rim
SLOPE_TOP, RIM_ROW = "hbFcSoft", "hbFcRim"  # row; the ledge's front's top row, the rows under it: whole px rows here,
LEDGE_TOP, LEDGE_SHADE = "hbFcLit", ("hbFcLd1", "hbFcLd2")  # each in the tone a run's comes out in, its anti-aliased
                                    # 2:1 lines' average: crisp, the frame's own tones read harder than a run's)
ROW0 = 0.0                          # (screen px rows' edges, from the tile's middle: where a level seam's rows land)
SEAMS_AT = range(-56, 57, 16)       # (the slope's seams down, px across from the tile's middle (x - y): a 16 px
                                    # lattice every tile shares, so one cut off at its column goes on in the next)


def dress(rel, solid, planes, face, slope, H, foot, zmin):
    """The frame on a near part: planes, the part's (n, c) (its own face and slope among them, as `face` and `slope`);
    H its cut, foot the upright's foot, zmin the slope's foot."""
    def on(plane, z0, z1, col, u=None):
        cuts = [q for q in planes if q is not plane] + [(UP, z1), (-UP, -z0)]
        if u is not None:
            t = Vector((-plane[0].y, plane[0].x, 0.0)).normalized() * Vector((1.0, 1.0, 0.0)).length
            cuts += [(t, (u + 1) / 32), (-t, -u / 32)]
        _paint(rel, solid, cuts, *plane, col, 1)

    def rows(plane, z, k, col, also=None):                          # (whole px row k under the edge at height z;
        for q in (plane, also) if also else (plane,):               # at the foot on both planes: the edge between
            on(q, *_row(q, _y(plane, z), k), col)                   # them may run across a row)

    rows(face, H, 0, YS[4])                                         # (the cut's lit lip)
    for i, col in enumerate(FOOT):                                  # (the foot's chamfer, rows up from it)
        rows(face, foot, -1 - i, col, slope)
    h, k = LEDGE                                                    # (the ledge, its top flush with the deck, its
    zt, zb = -1e-4, -h / Z64                                        # shade under it)
    n, c = face
    front = (n, c + k * LINE * n.length)                            # (the ledge's front; proud, it stands lower on
    for i, col in enumerate(LEDGE_SHADE):                           # screen than the face at its height)
        on(face, *_row(face, _y(front, zb), i), col)
    cuts = [q for q in planes if q is not face] + [(UP, zt), (-UP, -zb)]
    _ledge(rel, solid, cuts, *face, k * LINE)
    _paint(rel, solid, cuts + [(-UP, -_row(front, _y(front, zt), 0)[0])], *front, LEDGE_TOP, 2)  # (its top row lit)
    from .wall3d_belly_run import section                          # (the slope's bands at the run's heights)
    run = section()
    rows(slope, foot, 0, SLOPE_TOP, face)                           # (the slope's lit top edge, its rim)
    rows(slope, zmin, -1, RIM_ROW)
    *_, down = SLOPE_SEAMS                                          # (a seam across its middle; seams down it)
    zm = run.z_at((zmin + foot) / 2, down)
    for i, col in enumerate((SOFT, FAINT)):                         # (the run's two-row core, a darker row over a
        rows(slope, zm, i, col)                                     # lighter one, its top at the run's)
    lo, hi = run.z_at(zmin, -1), run.z_at(foot, 1)                  # (seams down it between its rim and its lit
    for u in SEAMS_AT:                                              # edge, not over them nor past its foot)
        on(slope, lo, hi, FAINT, u)


def _y(plane, z):
    """Screen px y (down) at height z on an upright or sloping plane (n, c) facing the camera, from the tile's
    middle."""
    n, c = plane
    return (ACROSS * c - z * (Z64 * n.x + ACROSS * n.z)) / n.x


def _row(plane, y, k):
    """The heights (z0, z1) on a plane of whole px row k under screen y (its edge rounded to a row's)."""
    n, c = plane
    rate, top = Z64 + ACROSS * n.z / n.x, round(y - ROW0) + ROW0 + k
    return (ACROSS * c / n.x - top - 1) / rate, (ACROSS * c / n.x - top) / rate


def _ledge(rel, solid, cuts, n, c, out):
    """The ledge, `out` proud of the face n . p = c inside the cuts: its front and its ends (at a hip, mitred on into
    the next part's) the runs' ledge tone, its top lit, its underside shaded."""
    for pts, m, _ in solid(cuts + [(n, c + out * n.length), (-n, -c + 0.002)]):
        rel.poly(pts, "steel", 3, m, fixed=LIT if m.z > 0.85 else YS[1] if m.z < -0.85 else YS[3])
