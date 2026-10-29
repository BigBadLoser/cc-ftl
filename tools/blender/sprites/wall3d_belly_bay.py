"""The belly run's bay looks (wall3d_belly_run, looks 20 on): a frame every look shares, so any two meet along a tile
edge (a rib 2 px proud down the face and the slope under the exterior's gap between its panels, which spans the tile
edge; the cut's lit lip, the foot's lit chamfer, the slope's lit top edge and its rim), and between the ribs a bay
whose geometry is the look's own, as the exterior's designs vary between their shared strips (wall3d_ext_var):
20 plain; 21 a recess with a grille on its floor; 22 a blister, a rounded housing down over the foot; 23 a hatch set
into the slope; 24 a keel block standing out over the slope; 25 stripped, the bay open on pipes."""
import math

from . import wall3d_ext_t3 as T3
from .wall3d_belly_looks import GAP, HID, RIM, SLIT, SLN
from .wall3d_ext_geom import LINE, PAINT, YS

P = T3.px(1)
RW = 3 * P                                          # (the rib's half width, about the exterior's gap's middle)
RIBS = ((GAP - RW, 0.5), (-0.5, GAP + RW - 1))      # (the rib, either side of the tile edge it spans)
BAY = (GAP + RW - 1, GAP - RW)                      # (between the ribs)
LOOKS = range(20, 26)
GRILLE, PIPE = "hbSoft", "hbShade"                  # (the grille's soft gaps; the stripped bay's shadow)


def _fp(s, z):
    return s.front(z, z)[0][0]


def _slab(f, s, u0, u1, z0, z1, base, out, caps, role="plate"):
    """A part on the front over [u0, u1] x [z0, z1] (not across the foot), from base out to out."""
    pts = [(_fp(s, z), z) for z in (z0, z1)]
    prof = [(d + base, z) for d, z in pts] + [(d + out, z) for d, z in pts[::-1]]
    cols = s.cols(prof, role)
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
    if n == 23:                                     # (a hatch in the slope)
        za, zb = s.z_at(s.zmin, -3), s.z_at(foot, 3)
        u0, u1 = b0 + 3 * P, b1 - 3 * P
        return [full[1], (-0.5, 0.5, s.zmin, za, 0.0, "face"), (-0.5, 0.5, zb, foot, 0.0, "face"),
                (-0.5, u0, za, zb, 0.0, "face"), (u0, u1, za, zb, 2 * LINE, "face"), (u1, 0.5, za, zb, 0.0, "face")]
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
        for (u0, u1), (c0, c1) in zip(RIBS, ((YS[1], None), (None, YS[1]))):     # (the ribs: their tops a px
            _slab(f, s, u0, u1, foot, Z(HID), -0.01, 2 * LINE, (c0, c1))         # under the exterior's foot; their
            _slab(f, s, u0, u1, s.z_at(s.zmin, -2), foot, -0.01, 2 * LINE,      # sides on the slope its lines' tone;
                  tuple(c and SLN for c in (c0, c1)))                           # all clear of the rim)
    b0, b1 = BAY
    with f.tag("bay"):
        if n == 20:
            zm = s.z_at((s.zmin + foot) / 2, 2)
            f.line(b0, b1, s.z_at(zm, 1), zm, SLN, bevel=False)
        elif n == 21:
            fl = _fp(s, foot) - 2 * LINE
            z0, z1 = Z(nf - 6), Z(HID + 5)
            pf = [(fl - 0.01, z0), (fl + PAINT, z0), (fl + PAINT, z1), (fl - 0.01, z1)]
            for u in [b0 + 4 * P + k * 2 * P for k in range(int((b1 - b0) / P - 8) // 2 + 1)]:
                f.part(u, u + P, pf, [GRILLE] * 4, GRILLE, end=False)
        elif n == 22:
            _blister(f, s, Z, b0 + 3 * P, b1 - 3 * P, Z(HID + 4), 4 * LINE)
        elif n == 23:
            za, zb = s.z_at(s.zmin, -3), s.z_at(foot, 3)            # (its doors' seam; their hinges' lit lines)
            m = (b0 + b1) / 2
            f.line(m - P / 2, m + P / 2, za, zb, SLN, end=False, bevel=False)
            for u in (b0 + 5 * P, b1 - 6 * P):
                f.line(u, u + P, za, zb, SLIT, end=False, bevel=False)
            for z in (s.z_at(za, -3), s.z_at(zb, 3)):              # (bars across the doors, a lit px under each)
                f.line(b0 + 6 * P, b1 - 6 * P, s.z_at(z, 1), z, SLN, bevel=False)
        elif n == 24:
            _keel(f, s, b0 + 8 * P, b1 - 8 * P, Z(nf - 6), s.z_at(foot, 8), 3 * LINE)
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
