"""The belly run's bay looks (wall3d_belly_run): a frame every look shares, so any two meet along a tile edge (the
cut's lit lip, a ledge on the deck line the exterior stands on, the foot's lit chamfer, the slope's lit top edge, two
seams down it and one across, its rim; plain face at the tile's edges), and between them a bay whose geometry is the
look's own, as the exterior's designs vary between their shared strips (wall3d_ext_var): 20 plain; 21 a recess with
a grille on its floor; 22 a blister, a rounded housing down over the foot; 26 cooling fins; 27 a bolted armour
plate; 28 a conduit over the foot, clamped. The slope and its lines a step darker (wall3d_belly DARK)."""
import math

from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import LINE, PAINT, YS

P = T3.px(1)
PLAIN = 20
LOOKS = (PLAIN, 21, 22, 26, 27, 28)
SLN, SLIT, RIM = "hbSlopeLn", "hbSlopeLit", "hbRim"     # (the slope's lines, its lit edges, its rim)
BAY = (3 * P - 0.5, 0.5 - 3 * P)                    # (the bay: plain face this far in from each tile edge)
HID = 11                                            # (px of the face under the cut the exterior hides: to the deck)
TOP = HID + 7                                       # (the bays' features from here down: clear of every
                                                    # exterior design's foot, its top edges whole, not dots)
LEDGE = (2, 1)                                      # (a ledge on the deck line, px tall and proud: the
                                                    # exterior stands on it, its lines ending on its lit top)
SLOPE_SEAMS = ((7, 8), (24, 25), 2)                 # (seams down the slope, px from the face's +u end; one across
                                                    # it, this many px under its middle)
GRILLE, PIPE = "hbSoft", "hbShade"                  # (the grille's soft gaps; the conduit's ends)


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
    if n == 21:                                     # (a recess in the bay's face, the grille on its floor)
        za, zb, k = Z(nf - 4), Z(TOP), 2
        u0, u1 = b0 + 2 * P, b1 - 2 * P
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
        h, k = LEDGE                                # (its top flush with the deck, where the layers meet:
        zt = -1e-4                                  # wall3d_belly LAYERS; its shade under it)
        zb = s.z_at(zt, h)
        f.shade(-0.5, 0.5, zb, zt, side=0.0)
        _slab(f, s, -0.5, 0.5, zb, zt, -0.01, k * LINE, (None, None))
        *down, n_ = SLOPE_SEAMS
        for a, b in down:
            f.line(*U(a, b), s.zmin, foot, SLN, end=False, bevel=False)
        zm = s.z_at((s.zmin + foot) / 2, n_)
        f.line(-0.5, 0.5, s.z_at(zm, 1), zm, SLN, bevel=False)
    b0, b1 = BAY
    with f.tag("bay"):
        if n == 21:
            fl = _fp(s, foot) - 2 * LINE
            z0, z1 = Z(nf - 6), Z(TOP + 2)
            pf = [(fl - 0.01, z0), (fl + PAINT, z0), (fl + PAINT, z1), (fl - 0.01, z1)]
            for u in [b0 + 4 * P + k * 2 * P for k in range(int((b1 - b0) / P - 8) // 2 + 1)]:
                f.part(u, u + P, pf, [GRILLE] * 4, GRILLE, end=False)
        elif n == 22:
            _blister(f, s, Z, b0 + 3 * P, b1 - 3 * P, Z(TOP), 4 * LINE)
        elif n == 26:                                               # (cooling fins standing out of the face)
            for k in range(5):
                u = (b0 + b1) / 2 + (k - 2) * 4 * P - P / 2
                _slab(f, s, u, u + P, foot, Z(TOP), -0.01, 3 * LINE, (YS[1], YS[1]))
        elif n == 27:                                               # (an armour plate, bolted)
            u0, u1, zt = b0 + 2 * P, b1 - 2 * P, Z(TOP)
            f.shade(u0, u1, foot, zt, under=0)
            f.raised(u0, u1, foot, zt, -0.01, 2 * LINE, cap=YS[2])
            for u in (u0 + 2 * P, u1 - 3 * P):
                for z in (Z(TOP + 3), Z(nf - 3)):
                    f.raised(u, u + P, z, s.z_at(z, -1), 2 * LINE - 0.01, 2 * LINE + PAINT, col=YS[4])
        elif n == 28:                                               # (a conduit along the bay over the foot, two
            ph, fr = s.H - Z(1), _fp(s, foot)                       # clamps over it)
            z = Z(nf - 5)
            _pipe(f, b0 + P, b1 - P, fr + 1.5 * LINE, z, 1.5 * LINE, 1.5 * ph)
            for u in (b0 + 6 * P, b1 - 8 * P):
                _slab(f, s, u, u + 2 * P, Z(nf - 2), Z(nf - 8), -0.01, 3.5 * LINE, (YS[1], YS[1]))


def _blister(f, s, Z, u0, u1, zt, a, steps=10):
    """A rounded housing over [u0, u1]: half an ellipse a deep out of the face, from zt down as far under the foot."""
    foot = s.under[0]
    dF, b = _fp(s, foot), zt - foot
    arc = [(dF + a * math.cos(t), foot + b * math.sin(t))
           for t in (math.pi / 2 - math.pi * i / steps for i in range(steps + 1))]
    prof = arc + [(dF - 0.3, foot - b), (dF - 0.3, zt)]
    cols = s.cols(prof, "plate")
    f.part(u0, u1, prof, cols, YS[1], end=False)


def _pipe(f, u0, u1, d, z, r, rz, sides=8):
    """A pipe along the face over [u0, u1], its axis d out and at height z, radius r (rz up and down)."""
    prof = [(d + r * math.cos(2 * math.pi * (i + 0.5) / sides), z + rz * math.sin(2 * math.pi * (i + 0.5) / sides))
            for i in range(sides)]
    cols = f.sec.cols(prof, "plate")
    f.part(u0, u1, prof, cols, PIPE, end=False)
