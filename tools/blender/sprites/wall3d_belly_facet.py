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

from .wall3d_belly_bay import LEDGE, RIM, SLIT, SLOPE_SEAMS
from .wall3d_ext_diag_detail import LIT, Z64, _paint
from .wall3d_ext_geom import LINE, YS

UP = Vector((0, 0, 1))
ACROSS = 16                         # (screen px down per tile unit of x + y)
SOFT, FAINT = "hbSlopeLnSoft", "hbSlopeLnFaint"     # (a slope seam's tones here, as a run's anti-aliased one
                                                    # comes out: a level one a row of the first over a row of
                                                    # the second; one down the second)
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

    up = Z64
    on(face, H - 1 / up, H, YS[4])                                  # (the cut's lit lip)
    on(face, foot + 1 / up, foot + 2 / up, YS[4])                   # (the foot's chamfer)
    on(face, foot + 2 / up, foot + 3 / up, YS[3])
    h, k = LEDGE                                                    # (the ledge, its top flush with the deck, its
    zt, zb = -1e-4, -h / up                                         # shade under it)
    on(face, zb - 2 / up, zb, YS[1])
    _ledge(rel, solid, [q for q in planes if q is not face] + [(UP, zt), (-UP, -zb)], *face, k * LINE)
    from .wall3d_belly_run import section                          # (the slope's bands at the run's heights)
    run = section()
    on(slope, run.z_at(foot, 1), foot, SLIT)                        # (the slope's lit top edge, its rim)
    on(slope, zmin, run.z_at(zmin, -1), RIM)
    *_, down = SLOPE_SEAMS                                          # (a seam across its middle; seams down it)
    zm = run.z_at((zmin + foot) / 2, down)
    (n, c), rate = slope, Z64 + ACROSS * slope[0].z / slope[0].x    # (on the slope, screen px y at z: y0 - z rate,
    y0 = ACROSS * c / n.x                                           # from the tile's middle; the seam's top at the
    top = round(y0 - zm * rate - ROW0) + ROW0                       # run's, on a whole row)
    for k, col in enumerate((SOFT, FAINT)):                         # (the run's two-row core: a darker row over
        on(slope, (y0 - top - k - 1) / rate, (y0 - top - k) / rate, col)  # a lighter one)
    for u in SEAMS_AT:
        on(slope, zmin, foot, FAINT, u)


def _ledge(rel, solid, cuts, n, c, out):
    """The ledge, `out` proud of the face n . p = c inside the cuts: its front and its ends (at a hip, mitred on into
    the next part's) the runs' ledge tone, its top lit, its underside shaded."""
    for pts, m, _ in solid(cuts + [(n, c + out * n.length), (-n, -c + 0.002)]):
        rel.poly(pts, "steel", 3, m, fixed=LIT if m.z > 0.85 else YS[1] if m.z < -0.85 else YS[3])
