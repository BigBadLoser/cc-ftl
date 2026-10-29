"""The belly run's looks 5-8 (wall3d_belly_run): its face as the exterior's lower armour (wall3d_ext_t3: its tones,
its panel across the tile, lit bolts in the corners), the slope under the ship a step darker with its lines
(wall3d_belly DARK). 5: the exterior's panel and a lip plate on the foot; 6: a groove between the tiles' plates,
rivets down either side; 7: plain, a lit chamfer on the foot; 8: 5's panel over a ribbed slope."""
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import LINE, PAINT, YS

SLN, SLIT, RIM = "hbSlopeLn", "hbSlopeLit", "hbRim"     # (the slope's lines, its lit edges, its rim: all darker)
PANEL = (T3.PANEL[0] - 0.5, T3.PANEL[1] - 0.5)          # (T3's panel, the tile's u from its -0.5 edge)


def _panel(f, s, Z, v0, v1, cap=YS[1]):
    """T3's panel, a px proud, from v0 down to v1 px under the cut, shaded round its unseen faces, a lit bolt 2 px in
    from each corner."""
    (u0, u1), ln = PANEL, LINE
    z0, z1 = Z(v1), Z(v0)
    f.shade(u0, u1, z0, z1)
    f.raised(u0, u1, z0, z1, -0.01, LINE, cap=cap)
    for a, b in ((u0 + 2 * ln, u0 + 3 * ln), (u1 - 3 * ln, u1 - 2 * ln)):
        for w0, w1 in ((Z(v0 + 3), Z(v0 + 2)), (Z(v1 - 2), Z(v1 - 3))):
            f.raised(a, b, w0, w1, LINE - 0.01, LINE + PAINT, col=YS[4])


def _cut(f, s, back, U, Z):
    with f.tag("lips"):
        f.line(-0.5, 0.5, Z(1), s.H, YS[4], bevel=False)
        f.top_line(-0.5, 0.5, back + 2 * T3.TOP_PX, back + 2.75 * T3.TOP_PX, YS[2])


def _rim(f, s):
    f.line(-0.5, 0.5, s.zmin, s.z_at(s.zmin, -1), RIM, bevel=False)


def _down(f, s, u0, u1, col=SLN, z1=None):
    f.line(u0, u1, s.zmin, s.under[0] if z1 is None else z1, col, end=False, bevel=False)


def look(n, f, s, back, U, Z):
    """Look n (5-8) on face f of section s; U, Z: art px to u and z (wall3d_belly_run)."""
    foot = s.under[0]
    px = s.H - Z(1)
    nf = round((s.H - foot) / px)                               # (the face's height, px)
    ln = LINE
    _cut(f, s, back, U, Z)
    with f.tag("slope"):
        _rim(f, s)
        f.line(-0.5, 0.5, s.z_at(foot, 1), foot, SLIT, bevel=False)     # (the slope's lit top edge under the foot)
    if n in (5, 8):
        with f.tag("panel"):
            _panel(f, s, Z, 4, nf - 6)
        with f.tag("lip"):                                      # (a plate on the foot, a px proud, the face's width)
            f.shade(-0.5, 0.5, foot, s.z_at(foot, -4), YS[1], under=0, side=0.0)
            f.raised(-0.5, 0.5, foot, s.z_at(foot, -4), -0.01, LINE, "face", cap=YS[2])
        with f.tag("slope"):
            if n == 5:                                          # (the panel's sides on down the slope)
                for u in PANEL:
                    _down(f, s, u - ln / 2, u + ln / 2)
                zm = s.z_at((s.zmin + foot) / 2, 2)
                f.line(-0.5, 0.5, s.z_at(zm, 1), zm, SLN, bevel=False)
            else:                                               # (ribs every 4 px, a lit px by each)
                for p in range(1, 32, 4):
                    a, b = U(p, p + 1)
                    _down(f, s, a, b)
                    _down(f, s, a - ln, a, SLIT)
    elif n == 6:
        gc = (PANEL[1] + PANEL[0] + 1) / 2                     # (the groove: under the middle of the exterior's
        g0, g1 = gc - ln, gc + ln                               # gap between its panels)
        with f.tag("groove"):
            f.line(g0, g1, foot, Z(3), YS[1], end=False, bevel=False)       # (painted: dark, lit on its far
            f.line(g1, g1 + ln, foot, Z(3), YS[3], end=False, bevel=False)  # wall)
            for u in (g0 - 3 * ln, g1 + 2 * ln):                # (rivets down either side)
                for v in range(6, nf - 2, 6):
                    f.raised(u, u + ln, Z(v + 1), Z(v), -0.01, PAINT, col=YS[4])
            f.line(-0.5, 0.5, Z(nf // 2 + 1), Z(nf // 2), YS[1])
        with f.tag("slope"):
            _down(f, s, g0, g1)
            zm = s.z_at((s.zmin + foot) / 2, 2)
            f.line(-0.5, 0.5, s.z_at(zm, 1), zm, SLN, bevel=False)
    else:
        with f.tag("lip"):                                      # (a lit chamfer along the foot)
            f.line(-0.5, 0.5, s.z_at(foot, -2), s.z_at(foot, -3), YS[3], bevel=False)
            f.line(-0.5, 0.5, s.z_at(foot, -1), s.z_at(foot, -2), YS[4], bevel=False)
