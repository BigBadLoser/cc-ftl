"""The belly run's D3 look 3 (wall3d_belly_run, hull 46's D3 variant 3): a grille on its own plate, 2 px proud of the
face, the grille on the floor of the plate's own recess (a px deep, in a 2 px border), and over the plate a recess a
px deep running up to the cut, on the run's shared dress (the top's seam, the face's edge, the slope's rim and
end)."""
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import LINE, PAINT, YS

SHADOW = "hbSlope"                   # (the plate's shade on the face by its lit end: a step under the seams' tone)
GSHADE = "hbShade"                   # (the grille's shade along its top and -u side: darker still)

LOOK3 = {                            # art px: u from the face's +u end (centred on its 32), v down from the cut
    "grille": ((8, 24), (19, 29)),   # the grille's footprint (the plate round it): u, v
    "slats": (21, 29),               # its slats and soft gaps, v (a shade along its top and its -u side)
    "plate": (3, 2),                 # its plate: the grille and this much more every way, this many px proud
    "inset": (2, 1),                 # the plate's recess (the grille on its floor): its border, its depth
    "recess": (4, 1),                # the recess (a px deep) up to the cut: this far over the plate, this much wider
}                                    # each side


def _rects():
    """The plate's and the recess's (u0, u1, v0, v1), art px."""
    (ga, gb), (gv0, gv1) = LOOK3["grille"]
    (m, _), (gap, w) = LOOK3["plate"], LOOK3["recess"]
    plate = (ga - m, gb + m, gv0 - m, gv1 + m)
    return plate, (plate[0] - w, plate[1] + w, 0, plate[2] - gap)


def blocks3(s, U, Z):
    """The face's armour for look 3 (wall3d_belly_run.build): (u0, u1, z0, z1, off), the recess set in."""
    foot = s.under[0]
    _, (ra, rb, _, rv) = _rects()
    (u0, u1), zr = U(ra, rb), Z(rv)
    return [(-0.5, 0.5, foot, zr, 0.0), (-0.5, u0, zr, s.H, 0.0), (u0, u1, zr, s.H, LINE), (u1, 0.5, zr, s.H, 0.0)]


def look3(f, s, back, U, Z, cols):
    """Look 3 on face f of section s; U, Z: art px to u and z (wall3d_belly_run); cols: its tones (XS, CREASE, RIM,
    EDGE, SEAM)."""
    XS, CREASE, RIM, EDGE, SEAM = cols
    foot = s.under[0]
    with f.tag("lips"):
        f.line(*U(0, 1), foot, Z(1), EDGE, end=False, bevel=False)
        f.top_line(-0.5, 0.5, back + 2 * T3.TOP_PX, back + 2.75 * T3.TOP_PX, YS[2])
    (pa, pb, pv0, pv1), _ = _rects()
    with f.tag("grille"):                                           # (the plate: its top in the soft shade; a
        k, (b, bd) = LOOK3["plate"][1], LOOK3["inset"]              # border b px wide round a recess bd px deep)
        d = s.front(foot, foot)[0][0]
        fr, fi = d + k * LINE, d + (k - bd) * LINE                  # (its front and its recess's floor)
        px = s.H - Z(1)                                             # (a px of height: the face and the plate
        zb, zt = s.H - pv1 * px, Z(pv0)                             # straight, the plate on past the foot)

        def slab(u0, u1, z0, z1, out, shade_top):
            pp = [(d - 0.01, z0), (out, z0), (out, z1), (d - 0.01, z1)]
            pc = s.cols(pp, "face")
            if shade_top:
                pc[2] = XS
            f.part(*U(u0, u1), pp, pc, YS[2], end=False)
        slab(pa, pb, zb, zt, fi, False)                             # (the floor, then the border round it)
        slab(pa, pb, s.H - (pv0 + b) * px, zt, fr, True)
        slab(pa, pb, zb, s.H - (pv1 - b) * px, fr, False)
        for u0, u1 in ((pa, pa + b), (pb - b, pb)):
            slab(u0, u1, s.H - (pv1 - b) * px, s.H - (pv0 + b) * px, fr, False)
        top = [(fr - 0.01, Z(pv0 + 1)), (fr + PAINT, Z(pv0 + 1)), (fr + PAINT, zt), (fr - 0.01, zt)]
        f.part(*U(pa, pb), top, [YS[4]] * 4, YS[4], end=False)     # (a lit px along its front's top: its edge)
        sh = [(d - 0.01, max(foot, zb)), (d + PAINT, max(foot, zb)), (d + PAINT, zt), (d - 0.01, zt)]
        f.part(*U(pa - 1, pa), sh, [SHADOW] * 4, SHADOW, end=False)    # (its shade on the face by its +u end
        f.line(*U(pb + k, pb + k + 1), zb, zt, SEAM, end=False, bevel=False)   # and its -u, clear of what it hides)
    with f.tag("recess"):                                           # (shade inside the recess under the cut and
        _, (ra, rb, _, rv) = _rects()                               # down its +u side, the light from over its +u)
        rf = s.front(s.H, s.H)[0][0] - LINE
        for (ua, ub), z0, z1 in (((ra, rb), Z(1), s.H), ((ra, ra + 1), Z(rv), s.H)):
            sh = [(rf - 0.01, z0), (rf + PAINT, z0), (rf + PAINT, z1), (rf - 0.01, z1)]
            f.part(*U(ua, ub), sh, [SEAM] * 4, SEAM, end=False)
    with f.tag("grille"):
        (ga, gb), _ = LOOK3["grille"]
        sv0, sv1 = LOOK3["slats"]

        sh = (k - bd) % 2 / 2                                       # (set out an odd px the floor sits half a px

        def floor(u0, u1, v0, v1, col):                             # lower on screen: its paint shifts back to
            z0, z1 = Z(v1 - sh), Z(v0 - sh)                         # whole px, not split over two)
            pf = [(fi - 0.01, z0), (fi + PAINT, z0), (fi + PAINT, z1), (fi - 0.01, z1)]
            f.part(*U(u0, u1), pf, [col] * 4, col, end=False)
        for p in range(ga, gb, 2):                                  # (soft gaps between the slats)
            floor(p, p + 1, sv0, sv1, XS)
        floor(ga, gb, sv0, sv0 + 1, GSHADE)
        floor(gb - 1, gb, sv0, sv1, GSHADE)
    with f.tag("slope"):                                            # (the face's and the plate's edge on the
        x = max(0.0, (foot - zb) / px)                              # slope, as look 1's lip's; its +u end, rim)
        for (ua, ub), n, w in (((0, pa), 0.5, 2), ((pa, pb), x + 0.5, 3.5), ((pb, 32), 0.5, 2)):
            z0 = s.z_at(foot, n)
            f.line(*U(ua, ub), s.z_at(z0, w), z0, CREASE, bevel=False)
        f.line(*U(0, 2), s.zmin, foot, CREASE, end=False, bevel=False)
        f.line(-0.5, 0.5, s.zmin, s.z_at(s.zmin, -1), RIM, bevel=False)
        from .wall3d_belly_run import LOOK1                         # (look 1's seams down and across the slope)
        for ua, ub in LOOK1["slope_seam"]:
            f.line(*U(ua, ub), s.zmin, foot, CREASE, end=False, bevel=False)
        zm = s.z_at((s.zmin + foot) / 2, LOOK1["slope_line"])
        f.line(-0.5, 0.5, s.z_at(zm, 1), zm, CREASE, bevel=False)
