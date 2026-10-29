"""The belly run's bay looks (wall3d_belly_run, looks 20 on): a frame every look shares, so any two meet along a tile
edge (a rib 2 px proud down the face and the slope, centred on the tile edge: the one line every exterior design
shares, its designs' strips meeting there and the base's gap between its panels spanning it; the cut's lit lip, the
foot's lit chamfer, the slope's lit top edge and its rim), and between the ribs a bay whose geometry is the look's
own, as the exterior's designs vary between their shared strips (wall3d_ext_var): 20 plain; 21 a recess with a
grille on its floor; 22 a blister, a rounded housing down over the foot; 23 a hatch on the slope; 24 a keel
block standing out over the slope; 25 stripped, the bay open on pipes; 26 cooling fins; 27 a bolted armour plate;
28 a conduit over the foot, clamped."""
import math
import os

from . import wall3d_ext_t3 as T3
from .wall3d_belly_looks import HID, RIM, SLIT, SLN
from .wall3d_ext_geom import LINE, PAINT, YS

P = T3.px(1)
RW = 3 * P                                          # (the rib's half width, about the tile edge)
RIBS = ((0.5 - RW, 0.5), (-0.5, RW - 0.5))          # (the rib, either side of the tile edge it spans)
BAY = (RW - 0.5, 0.5 - RW)                          # (between the ribs)
LOOKS = range(20, 29)
FRAME = os.environ.get("BELLY_FRAME", "none")        # (the tile edge: "rib", "seam" or "none", to compare)
SEAM = os.environ.get("BELLY_SEAM", "1") == "1"     # (a seam across under the exterior's foot)
GRILLE, PIPE = "hbSoft", "hbShade"                  # (the grille's soft gaps; the stripped bay's shadow)


def _fp(s, z):
    return s.front(z, z)[0][0]


def _slab(f, s, u0, u1, z0, z1, base, out, caps, role="plate", edge=None):
    """A part on the front over [u0, u1] x [z0, z1] (not across the foot), from base out to out; edge: its top's and
    bottom's tone, if not by their facing."""
    pts = [(_fp(s, z), z) for z in (z0, z1)]
    prof = [(d + base, z) for d, z in pts] + [(d + out, z) for d, z in pts[::-1]]
    cols = s.cols(prof, role)
    if edge:
        cols[1], cols[3] = edge, edge
    f.part(u0, u1, prof, cols, tuple(cols[2] if c is None else c for c in caps), end=False)


def blocks(n, s, Z):
    """The face's and the slope's armour for bay look n: (u0, u1, z0, z1, off, role), the bay's recesses set in."""
    foot, nf = s.under[0], _nf(s, Z)
    full = [(-0.5, 0.5, s.zmin, foot, 0.0, "face"), (-0.5, 0.5, foot, s.H, 0.0, "face")]
    b0, b1 = BAY
    if n in (21, 25):                               # (a recess in the bay's face: a grille's, or the stripped bay's)
        (i, v0, v1, k) = (2, HID + 3, nf - 4, 2) if n == 21 else (1, HID + 2, nf - 3, 4)
        za, zb = Z(v1), Z(v0)
        u0, u1 = b0 + i * P, b1 - i * P
        return [full[0], (-0.5, 0.5, foot, za, 0.0, "face"), (-0.5, 0.5, zb, s.H, 0.0, "face"),
                (-0.5, u0, za, zb, 0.0, "face"), (u0, u1, za, zb, k * LINE, "floor"), (u1, 0.5, za, zb, 0.0, "face")]
    return full


def _nf(s, Z):
    return round((s.H - s.under[0]) / (s.H - Z(1)))


def dress(n, f, s, back, U, Z):
    """Bay look n on face f of section s: the frame, then its bay."""
    foot, nf = s.under[0], _nf(s, Z)
    with f.tag("frame"):
        f.line(-0.5, 0.5, Z(1), s.H, YS[4], bevel=False)
        f.top_line(-0.5, 0.5, back + 2 * T3.TOP_PX, back + 2.75 * T3.TOP_PX, YS[2])
        f.line(-0.5, 0.5, s.z_at(foot, -2), s.z_at(foot, -3), YS[3], bevel=False)     # (the foot's chamfer)
        f.line(-0.5, 0.5, s.z_at(foot, -1), s.z_at(foot, -2), YS[4], bevel=False)
        f.line(-0.5, 0.5, s.z_at(foot, 1), foot, SLIT, bevel=False)
        f.line(-0.5, 0.5, s.zmin, s.z_at(s.zmin, -1), RIM, bevel=False)
        if SEAM:                                    # (a seam across where the exterior's foot falls: the
            f.line(-0.5, 0.5, Z(HID + 1), Z(HID), YS[1])    # cutaway's face its upper and lower parts)
        if FRAME == "rib":
            for (u0, u1), (c0, c1) in zip(RIBS, ((YS[1], None), (None, YS[1]))):     # (the ribs: their tops a px
                _slab(f, s, u0, u1, foot, Z(HID), -0.01, 2 * LINE, (c0, c1))         # under the exterior's foot;
                _slab(f, s, u0, u1, s.z_at(s.zmin, -2), foot, -0.01, 2 * LINE,      # their sides on the slope its
                      tuple(c and SLN for c in (c0, c1)))                           # lines' tone; clear of the rim)
        elif FRAME == "seam":                       # (a seam on the tile edge: dark its +u side, lit its -u)
            for (u0, u1), face, slope in (((0.5 - P, 0.5), YS[1], SLN), ((-0.5, P - 0.5), YS[3], SLIT)):
                f.line(u0, u1, foot, Z(HID), face, end=False, bevel=False)
                f.line(u0, u1, s.zmin, foot, slope, end=False, bevel=False)
    b0, b1 = BAY
    with f.tag("bay"):
        if n == 20:
            zm = s.z_at((s.zmin + foot) / 2, 2)
            f.line(-0.5, 0.5, s.z_at(zm, 1), zm, SLN, bevel=False)
        elif n == 21:
            fl = _fp(s, foot) - 2 * LINE
            z0, z1 = Z(nf - 6), Z(HID + 5)
            pf = [(fl - 0.01, z0), (fl + PAINT, z0), (fl + PAINT, z1), (fl - 0.01, z1)]
            for u in [b0 + 4 * P + k * 2 * P for k in range(int((b1 - b0) / P - 8) // 2 + 1)]:
                f.part(u, u + P, pf, [GRILLE] * 4, GRILLE, end=False)
        elif n == 22:
            _blister(f, s, Z, b0 + 3 * P, b1 - 3 * P, Z(HID + 4), 4 * LINE)
        elif n == 23:
            za, zb = s.z_at(s.zmin, -4), s.z_at(foot, 3)            # (two doors a px proud on the slope, a px
            m = (b0 + b1) / 2                                       # apart)
            for u0, u1 in ((b0 + 4 * P, m - P / 2), (m + P / 2, b1 - 4 * P)):
                _slab(f, s, u0, u1, za, zb, -0.01, LINE, (SLN, SLN), "face", edge=SLN)
        elif n == 24:
            _keel(f, s, b0 + 8 * P, b1 - 8 * P, Z(nf - 6), s.z_at(foot, 8), 3 * LINE)
        elif n == 26:                                               # (cooling fins standing out of the face)
            for k in range(5):
                u = (b0 + b1) / 2 + (k - 2) * 4 * P - P / 2
                _slab(f, s, u, u + P, foot, Z(HID + 3), -0.01, 3 * LINE, (YS[1], YS[1]))
        elif n == 27:                                               # (an armour plate, bolted)
            u0, u1, zt = b0 + 2 * P, b1 - 2 * P, Z(HID + 2)
            f.shade(u0, u1, foot, zt, under=0)
            f.raised(u0, u1, foot, zt, -0.01, 2 * LINE, cap=YS[2])
            for u in (u0 + 2 * P, u1 - 3 * P):
                for z in (Z(HID + 4), Z(nf - 3)):
                    f.raised(u, u + P, z, s.z_at(z, -1), 2 * LINE - 0.01, 2 * LINE + PAINT, col=YS[4])
        elif n == 28:                                               # (a conduit along the bay over the foot, two
            ph, fr = s.H - Z(1), _fp(s, foot)                       # clamps over it)
            z = Z(nf - 5)
            _pipe(f, b0 + P, b1 - P, fr + 1.5 * LINE, z, 1.5 * LINE, 1.5 * ph)
            for u in (b0 + 6 * P, b1 - 8 * P):
                _slab(f, s, u, u + 2 * P, Z(nf - 2), Z(nf - 8), -0.01, 3.5 * LINE, (YS[1], YS[1]))
        elif n == 25:
            fl = _fp(s, foot) - 4 * LINE
            ph = s.H - Z(1)
            for v in (HID + 6, nf - 8):
                _pipe(f, b0 + P, b1 - P, fl + 1.6 * LINE, Z(v), 1.5 * LINE, 1.5 * ph)


def _blister(f, s, Z, u0, u1, zt, a, steps=10):
    """A rounded housing over [u0, u1]: half an ellipse a deep out of the face, from zt down as far under the foot."""
    foot = s.under[0]
    dF, b = _fp(s, foot), zt - foot
    arc = [(dF + a * math.cos(t), foot + b * math.sin(t))
           for t in (math.pi / 2 - math.pi * i / steps for i in range(steps + 1))]
    prof = arc + [(dF - 0.3, foot - b), (dF - 0.3, zt)]
    cols = s.cols(prof, "plate")
    f.part(u0, u1, prof, cols, YS[1], end=False)


def _keel(f, s, u0, u1, zt, zb, a):
    """A block over [u0, u1] standing a out of the face from zt, its front straight down to zb under the foot."""
    dF = _fp(s, s.under[0])
    prof = [(dF - 0.01, zt), (dF + a, zt), (dF + a, zb), (_fp(s, zb) - 0.01, zb)]
    cols = s.cols(prof, "face")
    f.part(u0, u1, prof, cols, YS[1], end=False)
    for u in (u0 + 2 * P, u1 - 3 * P):
        f.raised(u, u + P, s.z_at(zt, 3), s.z_at(zt, 2), a - 0.01, a + PAINT, col=YS[4])


def _pipe(f, u0, u1, d, z, r, rz, sides=8):
    """A pipe along the face over [u0, u1], its axis d out and at height z, radius r (rz up and down)."""
    prof = [(d + r * math.cos(2 * math.pi * (i + 0.5) / sides), z + rz * math.sin(2 * math.pi * (i + 0.5) / sides))
            for i in range(sides)]
    cols = f.sec.cols(prof, "plate")
    f.part(u0, u1, prof, cols, PIPE, end=False)
