"""The belly run's D3 look 3 (wall3d_belly_run, hull 46's D3 variant 3): a frame standing a px proud over the face's
middle and hanging on past its foot over the slope, a groove across its top and a grille in it (slats with soft gaps),
on the run's shared dress (the lip under the cut, the top's seam, the face's edge, the slope's rim and end)."""
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import LINE, PAINT, YS

LOOK3 = {                            # art px: u from the face's +u end (centred on its 32), v down from the cut
    "frame": ((5, 27), 6, 3),        # the frame: its u, its top, how far it hangs past the foot
    "groove": 11,                    # a seam across it (2 px)
    "step": 14,                      # a lit line across it, the grille's surround's top
    "grille": ((8, 24), (19, 29)),   # the grille: u, v (a shade along its top, a lit line along its bottom)
}


def look3(f, s, back, U, Z, cols):
    """Look 3 on face f of section s; U, Z: art px to u and z (wall3d_belly_run); cols: its tones (XS, CREASE, RIM,
    EDGE, SEAM)."""
    XS, CREASE, RIM, EDGE, SEAM = cols
    foot = s.under[0]
    with f.tag("lips"):
        f.line(-0.5, 0.5, Z(1), s.H, YS[4], bevel=False)
        f.line(*U(0, 1), foot, Z(1), EDGE, end=False, bevel=False)
        f.top_line(-0.5, 0.5, back + 2 * T3.TOP_PX, back + 2.75 * T3.TOP_PX, YS[2])
    (a, b), v0, x = LOOK3["frame"]
    d, zb = s.front(foot, foot)[0][0], foot - x * (s.H - Z(1))     # (straight down, past the foot over the slope)
    fr = d + LINE
    with f.tag("frame"):                                            # (lit along its top by its facing)
        prof = [(d - 0.01, zb), (fr, zb), (fr, Z(v0)), (d - 0.01, Z(v0))]
        f.part(*U(a, b), prof, s.cols(prof, "face"), YS[2])

    def paint(u0, u1, z0, z1, col):                                 # (on the frame's front)
        pf = [(fr - 0.01, z0), (fr + PAINT, z0), (fr + PAINT, z1), (fr - 0.01, z1)]
        f.part(u0, u1, pf, [col] * 4, col, end=False)
    with f.tag("grille"):
        g = LOOK3["groove"]
        paint(*U(a, b), Z(g + 2), Z(g), SEAM)
        st = LOOK3["step"]
        paint(*U(a, b), Z(st + 1), Z(st), YS[4])
        (ga, gb), (gv0, gv1) = LOOK3["grille"]
        paint(*U(ga, gb), Z(gv0 + 1), Z(gv0), SEAM)
        for p in range(ga, gb, 2):                                  # (soft gaps between the slats)
            paint(*U(p, p + 1), Z(gv1), Z(gv0 + 1), XS)
        paint(*U(ga, gb), Z(gv1 + 1), Z(gv1), YS[4])
    with f.tag("slope"):                                            # (the frame's and the face's edge on the slope,
        for (ua, ub), n, w in (((0, a), 0.5, 2), ((a, b), x + 0.5, 3.5), ((b, 32), 0.5, 2)):     # its +u end, rim)
            z0 = s.z_at(foot, n)
            f.line(*U(ua, ub), s.z_at(z0, w), z0, CREASE, bevel=False)
        f.line(*U(0, 2), s.zmin, foot, CREASE, end=False, bevel=False)
        f.line(-0.5, 0.5, s.zmin, s.z_at(s.zmin, -1), RIM, bevel=False)
