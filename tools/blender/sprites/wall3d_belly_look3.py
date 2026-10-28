"""The belly run's D3 look 3 (wall3d_belly_run, hull 46's D3 variant 3): a grille on its own plate, 2 px proud of the
face, and over it a recess a px deep running up to the cut, on the run's shared dress (the top's seam, the face's
edge, the slope's rim and end)."""
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import LINE, PAINT, YS

LOOK3 = {                            # art px: u from the face's +u end (centred on its 32), v down from the cut
    "grille": ((8, 24), (19, 29)),   # the grille's slats and soft gaps: u, v
    "plate": (3, 2),                 # its plate: the grille and this much more every way, this many px proud
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
    with f.tag("grille"):                                           # (the plate: its top and its +u end, where it
        d = s.front(foot, foot)[0][0]                               # meets the face, in the soft shade)
        fr = d + LOOK3["plate"][1] * LINE
        zb, zt = max(foot, Z(pv1)), Z(pv0)
        pp = [(d - 0.01, zb), (fr, zb), (fr, zt), (d - 0.01, zt)]
        pc = s.cols(pp, "face")
        pc[2] = XS
        f.part(*U(pa, pb), pp, pc, SEAM, end=False)
        top = [(fr - 0.01, Z(pv0 + 1)), (fr + PAINT, Z(pv0 + 1)), (fr + PAINT, zt), (fr - 0.01, zt)]
        f.part(*U(pa, pb), top, [YS[4]] * 4, YS[4], end=False)     # (a lit px along its front's top: its edge)
        k = LOOK3["plate"][1]                                       # (its shade on the face by its -u end, clear
        f.line(*U(pb + k, pb + k + 1), zb, zt, SEAM, end=False, bevel=False)   # of what it hides)
    with f.tag("recess"):                                           # (shade inside the recess under the cut and
        _, (ra, rb, _, rv) = _rects()                               # down its +u side, the light from over its +u)
        rf = s.front(s.H, s.H)[0][0] - LINE
        for (ua, ub), z0, z1 in (((ra, rb), Z(1), s.H), ((ra, ra + 1), Z(rv), s.H)):
            sh = [(rf - 0.01, z0), (rf + PAINT, z0), (rf + PAINT, z1), (rf - 0.01, z1)]
            f.part(*U(ua, ub), sh, [SEAM] * 4, SEAM, end=False)
    with f.tag("grille"):
        (ga, gb), (gv0, gv1) = LOOK3["grille"]
        for p in range(ga, gb, 2):                                  # (soft gaps between the slats, on its front)
            pf = [(fr - 0.01, Z(gv1)), (fr + PAINT, Z(gv1)), (fr + PAINT, Z(gv0)), (fr - 0.01, Z(gv0))]
            f.part(*U(p, p + 1), pf, [XS] * 4, XS, end=False)
    with f.tag("slope"):                                            # (the face's edge on the slope, its +u end, rim)
        z0 = s.z_at(foot, 0.5)
        f.line(-0.5, 0.5, s.z_at(z0, 2), z0, CREASE, bevel=False)
        f.line(*U(0, 2), s.zmin, foot, CREASE, end=False, bevel=False)
        f.line(-0.5, 0.5, s.zmin, s.z_at(s.zmin, -1), RIM, bevel=False)
