"""FLAK CANNON turret (production; the concept rounds are in git history). It throws a cloud of scrap fragments with
loose accuracy, so it has a wide mouth, never a slim precise barrel; the scrap is fed and prepared in the bay below.
Firing heats the metal, and in vacuum heat only leaves by radiating, so the gun is a fat smoothbore wrapped in eight
lengthwise cooling fins, with a heat grille over the chamber and a hazard-banded muzzle. The accent is that heat: idle,
dark with temper colours on the fins; charged, a hot-metal ramp (HEAT, deep red up to white-hot), hottest at the bore
and the fin roots and cooling outward.

Pixel rule learned the hard way: no feature under about 0.05 rig units (two to three pixels) and edges on the axes or
the 2:1 isometric diagonals, or it breaks into a staircase at sprite size.

Rig conventions as turret_concepts (fixed / head / gun about the trunnion PIVOT, aim d0, z from the roof plane)."""
import math

from mathutils import Vector

from . import detail as D
from . import turret_concepts as TC
from .turret_mil import _uz

_g = TC._g
HEAT = ("fxD", "fxR", "fxO", "fxY", "fxW")       # hot-metal ramp: dull red .. white-hot (shared emissive extras)
R, SCALE = 0.64, 1.4                               # race radius and rig scale of a 2x2 light weapon
BOX = [((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1), 0), ((-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1), 1),
       ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1), 2), ((-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1), 3),
       ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1), 4), ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1), 5)]
BODY, EDGE, SIDE, UNDER = "steelL", "plate", "steel", "steelD"   # value tiers: lit top .. shadowed underside
DARK = dict(top=SIDE, side=UNDER, edge=BODY, under=UNDER, cap0=UNDER, cap1=UNDER)  # bands and covers
DECK = 0.29        # top of the turntable's upper deck (radius 0.44): the cradle stays inside it


def heat(hot, k, cold="dark"):
    """Ramp step k (0 dull red .. 4 white-hot) when charged, else the cold material."""
    return HEAT[max(0, min(4, k))] if hot else cold


def _hexa(f, P, mats):
    """Six faces of a hexahedron from its corners P[(a, b, d)], a/b/d in -1, 1; mats: top, bottom, +a, -a, +b, -b."""
    for *ks, i in BOX:
        f.poly([P[k] for k in ks], mats[i], flip=True)


def _face(f, pts, ref, col):
    """A polygon wound so its normal points away from ref (both local u, v, z)."""
    P = [Vector(f.pt(*q)) for q in pts]
    n = (P[1] - P[0]).cross(P[2] - P[0])
    if n.dot(sum(P, Vector()) / len(P) - Vector(f.pt(*ref))) < 0:
        P = P[::-1]
    f.poly(P, col, flip=False)


def prism(f, u0, u1, sec0, sec1, z, top=BODY, edge=EDGE, side=SIDE, under=UNDER, cap0=SIDE, cap1=SIDE, dz1=0.0):
    """A body swept along u from section sec0 at u0 to sec1 at u1 (same-length lists of (v, dz) round the centre line
    at height z, z + dz1 at u1). Each side face takes its colour from where it faces: top, a lit chamfer (edge), the
    sides, or underneath, so bevels catch the light the way machined parts do."""
    c0 = (u0, 0.0, z)
    c1 = (u1, 0.0, z + dz1)
    ref = ((u0 + u1) / 2, 0.0, z + dz1 / 2)
    n = len(sec0)
    for i in range(n):
        (va, za), (vb, zb) = sec0[i], sec0[(i + 1) % n]
        (vc, zc), (vd, zd) = sec1[(i + 1) % n], sec1[i]
        nv, nz = zb - za, -(vb - va)                                                     # outward for a CCW section
        if nv * (va + vb) + nz * (za + zb) < 0:
            nv, nz = -nv, -nz
        ln = math.hypot(nv, nz) or 1.0
        nz /= ln
        col = top if nz > 0.85 else edge if nz > 0.25 else under if nz < -0.25 else side
        _face(f, [(u0, va, z + za), (u0, vb, z + zb), (u1, vc, z + dz1 + zc), (u1, vd, z + dz1 + zd)], ref, col)
    if cap0:                                                                            # None leaves it open
        _face(f, [(u0, v, z + dz) for v, dz in sec0], (u1, 0.0, z), cap0)
    if cap1:
        _face(f, [(u1, v, z + dz1 + dz) for v, dz in sec1], c0, cap1)
    return c1


def octa(r):
    """A regular octagon of inradius r with flat top, bottom and sides."""
    R_ = r / math.cos(math.pi / 8)
    return [(R_ * math.cos(math.radians(22.5 + 45 * k)), R_ * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]


def face_plate(g, ang, r, z, u0, u1, s0, s1, lift, t, mat):
    """A plate on the face of an octa(r) body whose normal points at ang degrees (v, z plane): u0..u1 along it, s0..s1
    across the face, lifted off it by lift, t thick."""
    a = math.radians(ang)
    nv, nz, tv, tz = math.cos(a), math.sin(a), -math.sin(a), math.cos(a)

    def P(u, s_):
        return (u, (r + lift) * nv + s_ * tv, z + (r + lift) * nz + s_ * tz)
    qslab(g, P(u0, s0), P(u1, s0), P(u0, s1), P(u1, s1), t, mat)


def octa_vents(g, r, z, blocks, hot, faces=(90, 45, 135)):
    """A heat grille wrapped over the upper faces of an octa(r) body: per block (u0, u1, ramp step) a dark
    recess on each face with one solid glowing window (the top face hottest). No slats: a slat splits the window into
    one-pixel strips that speckle on the diagonal aims. Kept chunky: anything
    under two or three pixels breaks into a staircase at sprite size."""
    for u0, u1, k in blocks:
        prism(g, u0, u1, octa(r + 0.004), octa(r + 0.004), z, top=UNDER, edge=UNDER, side=UNDER, under=UNDER,
              cap0=UNDER, cap1=UNDER)                                                    # one dark band, no thin edges
        for ang in faces:
            j = 0 if ang == 90 else 1
            face_plate(g, ang, r, z, u0 + 0.035, u1 - 0.035, -0.048, 0.048, 0.009, 0.004, heat(hot, k - j, "dark"))


def octa_hazard(g, r, z, u0, u1, lift=0.006):
    """A painted hazard band right round an octa(r) body: one stripe a face, yellow and black alternating."""
    w = r * math.tan(math.pi / 8)
    for k in range(8):
        face_plate(g, 45 * k, r, z, u0, u1, -w, w, lift, 0.012, "hazY" if k % 2 == 0 else "hazK")


def qslab(f, P00, P10, P01, P11, t, mat, face=None):
    """A plate over four corners (P10 - P00 one edge, P01 - P00 the other) of thickness t: face on the big sides."""
    a = [P10[i] - P00[i] for i in range(3)]
    b = [P01[i] - P00[i] for i in range(3)]
    n = (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
    ln = math.sqrt(sum(c * c for c in n)) or 1.0
    n = tuple(c / ln * t / 2 for c in n)
    corner = {(-1, -1): P00, (1, -1): P10, (-1, 1): P01, (1, 1): P11}
    fc = face or mat
    _hexa(f, {(i, j, d): f.pt(*(corner[(i, j)][k] + d * n[k] for k in range(3)))
              for i in (-1, 1) for j in (-1, 1) for d in (-1, 1)}, (fc, fc, mat, mat, mat, mat))


def hot_core(g, u, z, rs, hot):
    """Glow layers sunk in a wide bore at u: (radius, ramp step) from the rim inwards, each a hair further out."""
    for i, (r, k) in enumerate(rs):
        g.hcyl(u + i * 0.004, u + i * 0.004 + 0.006, 0, z, r, heat(hot, k, UNDER), sides=18, cap=heat(hot, k, UNDER))


def hot_cone(g, u0, u1, r0, r1, z, hot, steps=(3, 2, 1, 0), wall=0.012):
    """The inside of a flared bore: a cone just inside the outer one, glowing hottest at the throat when charged."""
    n = len(steps)
    for i, k in enumerate(steps):
        ua, ub = u0 + (u1 - u0) * i / n, u0 + (u1 - u0) * (i + 1) / n
        ra, rb = r0 + (r1 - r0) * i / n - wall, r0 + (r1 - r0) * (i + 1) / n - wall
        g.hcyl(ua, ub, 0, z, ra, heat(hot, k, UNDER), r1=rb, sides=24)


def cradle(h, PU, BZ, vin, vout, half=0.2, peak=0.13):
    """The mount as one mass on the turntable: a plinth filling the deck (so it visibly stands on something), and two
    side walls (vin..vout either side, PU +- half along u) standing well above the pivot so the bearing sits inside them,
    each a plain chamfered block with a capped brass bearing boss. Everything stays within the deck's radius."""
    _g("cradle")
    h.vcyl(0, 0, DECK, 0.42, 0.035, BODY, top=SIDE, sides=32)                           # plinth on the deck
    z0 = DECK + 0.035
    u0, u1 = PU - half, PU + half
    for sv in (-1, 1):
        top, c = BZ + peak, 0.06                                                        # flat top, small chamfers
        wall = [(u0, z0), (u1, z0), (u1, top - c), (u1 - c, top), (u0 + c, top), (u0, top - c)]
        _uz(h, wall, sv * vin, sv * vout, SIDE, BODY)
        vo = sv * vout
        D.seg(h, (PU, vo, BZ), (PU, vo + sv * 0.03, BZ), 0.09, BODY, 16, cap=BODY, capstart=SIDE)  # bearing boss
        D.seg(h, (PU, vo + sv * 0.025, BZ), (PU, vo + sv * 0.05, BZ), 0.045, "brass", 12, cap="brass")


def flak(hot):
    BZ, PU = 0.7, -0.08                                                                 # fins clear the plinth
    rig = TC.Rig("flak", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    cradle(h, PU, BZ, 0.2, 0.29)
    g = rig.f("gun")
    _g("breech")
    prism(g, -0.58, 0.14, octa(0.19), octa(0.19), BZ)
    prism(g, -0.63, -0.58, octa(0.155), octa(0.155), BZ, **DARK)
    octa_vents(g, 0.19, BZ, ((-0.42, -0.2, 3), (-0.16, 0.06, 2)), hot)                    # heat grille, centred on the chamber
    for u in (-0.46, 0.12):
        prism(g, u - 0.02, u + 0.02, octa(0.205), octa(0.205), BZ, **DARK)
    _g("bore")
    g.hcyl(0.14, 0.88, 0, BZ, 0.16, SIDE, sides=20)
    _g("fins")
    for a in range(8):                                                                 # radial fins, hot at the root
        ang = math.radians(a * 45)                                                     # on the axes: clean pixel lines
        c, s = math.cos(ang), math.sin(ang)

        def at(u, r):
            return (u, r * c, BZ + r * s)
        NU, NR = 3, 2

        def pt(tu, tr):
            return at(0.19 + 0.62 * tu, 0.16 + (0.32 - 0.16) * tr)                  # straight fins, square ends
        for iu in range(NU):
            for ir in range(NR):
                t0, t1, q0, q1 = iu / NU, (iu + 1) / NU, ir / NR, (ir + 1) / NR
                k = 4 - iu - ir
                qslab(g, pt(t0, q0), pt(t1, q0), pt(t0, q1), pt(t1, q1), 0.04, BODY,
                      face=heat(hot, k, "rustD" if k >= 4 else SIDE) if k >= 1 else SIDE)
    D.annulus(g, 0.82, 0.86, 0, BZ, 0.3, 0.16, SIDE, BODY, sides=24)                   # fin clamp ring
    _g("muzzle")
    prism(g, 0.86, 0.97, octa(0.195), octa(0.195), BZ, **dict(DARK, cap0=None, cap1=None))  # open muzzle housing
    octa_hazard(g, 0.195, BZ, 0.885, 0.945)                                             # hazard band right round
    D.annulus(g, 0.97, 1.0, 0, BZ, 0.22, 0.13, EDGE, EDGE, sides=24)                   # lip
    hot_cone(g, 0.62, 0.99, 0.128, 0.131, BZ, hot, steps=(3, 2, 2, 1), wall=0.0)        # bore liner, hot inside
    hot_core(g, 0.9, BZ, ((0.127, 1), (0.095, 2), (0.06, 3), (0.028, 4)), hot)          # molten fill, white at the centre
    return rig


TC.TURRETS[("F", "flak")] = flak
TC.PICKS["flak"] = flak
