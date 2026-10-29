"""The belly run's looks 5-12 (wall3d_belly_run): its face as the exterior's lower armour (wall3d_ext_t3: its tones,
its panel across the tile, lit bolts in the corners), the slope under the ship a step darker with its lines
(wall3d_belly DARK). 5: the exterior's panel and a lip plate on the foot; 6: a groove between the tiles' plates,
rivets down either side; 7: plain, a lit chamfer on the foot; 8: 5's panel over a ribbed slope; 9: 7 with the
hull's shade under the exterior and a joint under its gap; 10: an armour plate 2 px proud on the face's lower part,
jointed under the exterior's gap, bolted along its lit top; 11: 10 in two tiers, the lower prouder, its joints
staggered; 12: 10 over 8's ribbed slope. The exterior hides the face down to about HID px."""
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import LINE, PAINT, YS

SLN, SLIT, RIM = "hbSlopeLn", "hbSlopeLit", "hbRim"     # (the slope's lines, its lit edges, its rim: all darker)
PANEL = (T3.PANEL[0] - 0.5, T3.PANEL[1] - 0.5)          # (T3's panel, the tile's u from its -0.5 edge)
GAP = (PANEL[1] + PANEL[0] + 1) / 2                     # (the middle of the exterior's gap between its panels)
HID = 11                                                # (px of the face under the cut the exterior hides)


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
    """Look n (5-12) on face f of section s; U, Z: art px to u and z (wall3d_belly_run)."""
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
            _panel(f, s, Z, HID + 2, nf - 6)
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
        g0, g1 = GAP - ln, GAP + ln                             # (the groove, under the exterior's gap)
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
    elif n in (10, 11, 12):
        tiers = [(GAP, HID + 2, nf, 2, YS[2])] if n != 11 else [(GAP, HID + 2, HID + 11, 1, YS[1]),
                                                               (GAP - 0.5, HID + 11, nf, 2, YS[2])]
        with f.tag("armour"):                                   # (plates each side of a joint, their shade on the
            for j, v0, v1, k, cap in tiers:                     # face round them; 11: a tier over a prouder one,
                z0, z1 = (foot if v1 == nf else Z(v1)), Z(v0)   # its joints staggered)
                for u0, u1 in ((-0.5, j - ln), (j + ln, 0.5)):
                    if u1 - u0 > ln:
                        f.shade(u0, u1, z0, z1, under=0)
                        f.raised(u0, u1, z0, z1, -0.01, k * LINE, cap=cap)
                j, v0, _, k, _ = tiers[-1]
                for u in [j - 4 * ln - i * 6 * ln for i in range(5)] + [j + 3 * ln]:
                    a = (u + 0.5) % 1 - 0.5
                    f.raised(a, a + ln, Z(v0 + 3), Z(v0 + 2), k * LINE - 0.01, k * LINE + PAINT, col=YS[4])
        with f.tag("slope"):
            j = tiers[-1][0]
            if n == 12:                                         # (ribs every 4 px, a lit px by each)
                for p in range(1, 32, 4):
                    a, b = U(p, p + 1)
                    _down(f, s, a, b)
                    _down(f, s, a - ln, a, SLIT)
            else:
                _down(f, s, j - ln, j + ln)
                zm = s.z_at((s.zmin + foot) / 2, 2)
                f.line(-0.5, 0.5, s.z_at(zm, 1), zm, SLN, bevel=False)
    else:
        if n == 9:
            with f.tag("joint"):                                # (the hull's shade along the exterior's foot; a
                f.line(-0.5, 0.5, Z(HID + 3), Z(HID + 1), YS[1], bevel=False)   # joint under its gap)
                f.line(GAP - ln, GAP, foot, Z(HID + 1), YS[1], end=False, bevel=False)
                f.line(GAP, GAP + ln, foot, Z(HID + 3), YS[3], end=False, bevel=False)
            with f.tag("slope"):
                _down(f, s, GAP - ln, GAP)
        with f.tag("lip"):                                      # (a lit chamfer along the foot)
            f.line(-0.5, 0.5, s.z_at(foot, -2), s.z_at(foot, -3), YS[3], bevel=False)
            f.line(-0.5, 0.5, s.z_at(foot, -1), s.z_at(foot, -2), YS[4], bevel=False)
