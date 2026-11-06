"""FLAK CANNON turret concepts (round 4: round 3 refined; earlier rounds are in git history). It throws a cloud of scrap fragments with
loose accuracy, so every variant has a wide mouth, never a slim precise barrel. Scrap is prepared in the bay below and
comes up through the mount (a ribbed feed trunk from the deck). Firing heats the metal, and in vacuum heat only leaves by
radiating, so each variant carries big radiating surfaces; the accent is that heat: idle, dark with temper colours on the
steel beside it; charged, a hot-metal ramp (HEAT, deep red up to white-hot), hottest at the source and cooling outward.

  A  TRUMPET    a chamber between flat radiator wings, a short hot throat opening into a wide gusseted bell with a molten
                core.
  B  LETTERBOX  a receiver under a swept dorsal radiator sail, a flat nozzle widening to a wide slot mouth glowing
                white at the middle.
  C  FINNED     a fat smoothbore wrapped in eight lengthwise cooling fins, glowing at their roots and toward the breech,
                a clamp ring at their front and a wide crowned muzzle.

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


def heat(hot, k, cold="dark"):
    """Ramp step k (0 dull red .. 4 white-hot) when charged, else the cold material."""
    return HEAT[max(0, min(4, k))] if hot else cold


def stain(k):
    """Temper colours on the steel beside a hot part (idle and charged alike): k 0 clean, 1 faint, 2 bronze."""
    return ("gm", "steelL", "rustD")[k]


def _hexa(f, P, mats):
    """Six faces of a hexahedron from its corners P[(a, b, d)], a/b/d in -1, 1; mats: top, bottom, +a, -a, +b, -b."""
    for *ks, i in BOX:
        f.poly([P[k] for k in ks], mats[i], flip=True)


def loft(f, u0, hv0, hz0, u1, hv1, hz1, z, mat, top=None, cap0=None, cap1=None, dz1=0.0):
    """A box whose cross-section (half widths hv across, hz up) changes from u0 to u1, centred on z (z + dz1 at u1)."""
    def c(a, b, d):
        u, hv, hz, zc = (u0, hv0, hz0, z) if a < 0 else (u1, hv1, hz1, z + dz1)
        return f.pt(u, b * hv, zc + d * hz)
    _hexa(f, {(a, b, d): c(a, b, d) for a in (-1, 1) for b in (-1, 1) for d in (-1, 1)},
          (top or mat, mat, cap1 or mat, cap0 or mat, mat, mat))


def slab(f, o, eu, ew, t, mat, face=None):
    """A thin plate: corner o (u, v, z), edges eu and ew (vectors), thickness t along eu x ew; face = the two big sides."""
    n = (eu[1] * ew[2] - eu[2] * ew[1], eu[2] * ew[0] - eu[0] * ew[2], eu[0] * ew[1] - eu[1] * ew[0])
    ln = math.sqrt(sum(c * c for c in n)) or 1.0
    n = tuple(c / ln * t / 2 for c in n)

    def c(a, b, d):
        a, b = (a + 1) / 2, (b + 1) / 2
        return f.pt(*(o[i] + a * eu[i] + b * ew[i] + d * n[i] for i in range(3)))
    fc = face or mat
    _hexa(f, {(a, b, d): c(a, b, d) for a in (-1, 1) for b in (-1, 1) for d in (-1, 1)}, (fc, fc, mat, mat, mat, mat))


def conduit(f, a, b, r, n, mat="steelD", rib="steel"):
    """Ribbed armoured conduit (round) from a to b: n segments, a rib at every joint."""
    for k in range(n):
        p = tuple(a[i] + (b[i] - a[i]) * k / n for i in range(3))
        q = tuple(a[i] + (b[i] - a[i]) * (k + 1) / n for i in range(3))
        D.seg(f, p, q, r, mat, 10)
        m = tuple((p[i] + q[i]) / 2 for i in range(3))
        e = tuple((q[i] - p[i]) * 0.18 for i in range(3))
        D.seg(f, tuple(m[i] - e[i] for i in range(3)), tuple(m[i] + e[i] for i in range(3)), r * 1.25, rib, 10)


def hot_run(g, u, segs, v, z, r, hot, sides=14):
    """Barrel stretch leaving a hot part: (ramp step, length) pieces; cold, only the hottest is bronze. Returns the end u."""
    for k, ln in segs:
        g.hcyl(u, u + ln, v, z, r, heat(hot, k, "rustD" if k >= 3 else "gm"), sides=sides)
        u += ln
    return u


# ---- finish kit: shaped sections, framed radiators, bolted joints --------------------------------------------------
# Values run lighter than the rest of the kit: bodies BODY, lit chamfers and rims EDGE, sides SIDE, undersides and
# recesses UNDER; the dark tones only where light would not reach.
BODY, EDGE, SIDE, UNDER = "steelL", "plate", "steel", "steelD"
# Three value tiers so parts read apart: the mount darker (BASE), the gun light (BODY), and the joints between them dark
# (DARK: bands, collars, covers, lips), with EDGE highlights on bolts, rails and lit chamfers.
BASE = dict(top=SIDE, side=UNDER, edge=BODY, under=UNDER, cap0=UNDER, cap1=SIDE)
DARK = dict(top=SIDE, side=UNDER, edge=BODY, under=UNDER, cap0=UNDER, cap1=UNDER)


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


def csec(hv, hz, c):
    """A rectangle hv across and hz up (half sizes) with chamfered corners c."""
    return [(hv, -hz + c), (hv, hz - c), (hv - c, hz), (-hv + c, hz), (-hv, hz - c), (-hv, -hz + c), (-hv + c, -hz),
            (hv - c, -hz)]


def octa(r):
    """A regular octagon of inradius r with flat top, bottom and sides."""
    R_ = r / math.cos(math.pi / 8)
    return [(R_ * math.cos(math.radians(22.5 + 45 * k)), R_ * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]


def bolts(g, u, z, r, n=6, mat=EDGE, size=0.032):
    """A bolt circle on an end face at u (facing +u), radius r round the centre line at height z."""
    for k in range(n):
        a = math.tau * (k + 0.5) / n
        g.box(u, r * math.cos(a), z + r * math.sin(a), size * 0.6, size, size, mat, base=False)


def hazard_v(g, u, z, half, step=0.06, w=0.035, h=0.012):
    """A painted hazard band across v (yellow and black blocks) on a top face at height z, centred at u."""
    n = int(round(2 * half / step))
    for k in range(n):
        g.box(u, -half + (k + 0.5) * step, z, w, step, h, "hazY" if k % 2 == 0 else "hazK")


def seam(g, a, b):
    """A dark panel seam drawn on a surface from a to b (both already a hair above it)."""
    D.seg(g, a, b, 0.009, "dark", 4)


def face_plate(g, ang, r, z, u0, u1, s0, s1, lift, t, mat):
    """A plate on the face of an octa(r) body whose normal points at ang degrees (v, z plane): u0..u1 along it, s0..s1
    across the face, lifted off it by lift, t thick."""
    a = math.radians(ang)
    nv, nz, tv, tz = math.cos(a), math.sin(a), -math.sin(a), math.cos(a)

    def P(u, s_):
        return (u, (r + lift) * nv + s_ * tv, z + (r + lift) * nz + s_ * tz)
    qslab(g, P(u0, s0), P(u1, s0), P(u0, s1), P(u1, s1), t, mat)


def octa_vents(g, r, z, blocks, hot, faces=(90, 45, 135)):
    """The letterbox's heat grille wrapped over the upper faces of an octa(r) body: per block (u0, u1, ramp step) a dark
    recess on each face with one glowing window (the top face hottest) in a light frame. Kept chunky: anything under a
    couple of pixels breaks up at sprite size."""
    for u0, u1, k in blocks:
        for ang in faces:
            j = 0 if ang == 90 else 1
            face_plate(g, ang, r, z, u0, u1, -0.072, 0.072, 0.003, 0.01, UNDER)                  # recess
            face_plate(g, ang, r, z, u0 + 0.02, u1 - 0.02, -0.05, 0.05, 0.009, 0.004, heat(hot, k - j, UNDER))
            for sc in (-1, 1):                                                                    # frame sides
                face_plate(g, ang, r, z, u0, u1, sc * 0.062 - 0.013, sc * 0.062 + 0.013, 0.014, 0.018, EDGE)
            for uu in (u0, u1 - 0.022):                                                           # frame ends
                face_plate(g, ang, r, z, uu, uu + 0.022, -0.075, 0.075, 0.014, 0.018, EDGE)


def octa_hazard(g, r, z, u0, u1, lift=0.006):
    """A painted hazard band right round an octa(r) body: one stripe a face, yellow and black alternating."""
    w = r * math.tan(math.pi / 8)
    for k in range(8):
        face_plate(g, 45 * k, r, z, u0, u1, -w, w, lift, 0.012, "hazY" if k % 2 == 0 else "hazK")


def collar(g, u, z, r, w=0.04, mat=EDGE, sides=16):
    """A raised flange where two parts meet."""
    g.hcyl(u - w / 2, u + w / 2, 0, z, r, mat, sides=sides, cap=mat, capstart=mat)


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


def _lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def radiator(g, o, eu, ew, hot, pipes=4, steps=4, core=4, r=0.026):
    """A framed radiator: a thin sheet (corner o, edge eu along the root, ew out to the tip) in a frame, a manifold
    along the root that glows nearly white when charged, and heat pipes on both faces from the manifold to a header
    at the tip, cooling a ramp step per stretch (the middle pipes hottest). Cold: bare pipes with bronze at the root."""
    t = 0.018
    slab(g, o, eu, ew, t, SIDE, face=SIDE)
    ln = math.sqrt(sum(c * c for c in eu))
    e = tuple(c * 0.035 / ln for c in eu)
    for k in (0.0, 1.0):                                                               # side rails of the frame
        slab(g, tuple(o[i] + eu[i] * k - e[i] * k for i in range(3)), e, ew, 0.04, BODY, face=EDGE)
    tip = tuple(o[i] + ew[i] for i in range(3))
    D.seg(g, tip, tuple(tip[i] + eu[i] for i in range(3)), 0.024, EDGE, 8, cap=EDGE, capstart=EDGE)  # header
    D.seg(g, tuple(o[i] - e[i] for i in range(3)), tuple(o[i] + eu[i] + e[i] for i in range(3)), 0.05,
          heat(hot, core - 1, BODY), 12, cap="brass", capstart="brass")                # root manifold
    nrm = _normal(eu, ew)
    for p in range(pipes):
        fr = (p + 0.5) / pipes
        k0 = core - (0 if 0.25 < fr < 0.75 else 1)
        for side in (-1, 1):
            base = tuple(o[i] + eu[i] * fr + side * nrm[i] * (t / 2 + r * 0.8) for i in range(3))
            for s in range(steps):
                a0, a1 = 0.04 + s * 0.94 / steps, 0.04 + (s + 1) * 0.94 / steps
                D.seg(g, tuple(base[i] + ew[i] * a0 for i in range(3)), tuple(base[i] + ew[i] * a1 for i in range(3)),
                      r, heat(hot, k0 - s, "rustD" if s == 0 else EDGE), 6)


def _normal(eu, ew):
    n = (eu[1] * ew[2] - eu[2] * ew[1], eu[2] * ew[0] - eu[0] * ew[2], eu[0] * ew[1] - eu[1] * ew[0])
    ln = math.sqrt(sum(c * c for c in n)) or 1.0
    return tuple(c / ln for c in n)


def yoke(h, vs, u0, u1, PU, BZ):
    """Trunnion brackets either side: a chamfered plate with a lighter inset, a foot on the deck and a capped bearing."""
    _g("yoke")
    top = BZ + 0.12
    for sv in (-1, 1):
        h.box((u0 + u1) / 2, sv * (vs + 0.04), 0.29, u1 - u0 + 0.08, 0.12, 0.04, SIDE, top=BODY)   # foot
        _uz(h, [(u0, 0.29), (u1, 0.29), (u1, top - 0.1), (u1 - 0.1, top), (u0 + 0.1, top), (u0, top - 0.1)],
            sv * vs, sv * (vs + 0.07), BODY, EDGE)
        _uz(h, [(u0 + 0.06, 0.36), (u1 - 0.06, 0.36), (u1 - 0.06, top - 0.12), (u1 - 0.12, top - 0.06),
                (u0 + 0.12, top - 0.06), (u0 + 0.06, top - 0.12)], sv * (vs + 0.07), sv * (vs + 0.085), EDGE, EDGE)
        D.seg(h, (PU, sv * (vs + 0.07), BZ), (PU, sv * (vs + 0.11), BZ), 0.1, SIDE, 16, cap=EDGE, capstart=SIDE)
        D.seg(h, (PU, sv * (vs + 0.1), BZ), (PU, sv * (vs + 0.125), BZ), 0.045, UNDER, 10, cap=BODY)


def feed(h, a, b, r=0.07):
    """The scrap feed rising from the bay through the deck: a ribbed armoured trunk with a flange at each end."""
    _g("feed")
    conduit(h, a, b, r, 3, mat=SIDE, rib=BODY)
    for p in (a, b):
        D.seg(h, (p[0], p[1], p[2] - 0.02), (p[0], p[1], p[2] + 0.02), r * 1.45, EDGE, 12, cap=EDGE, capstart=EDGE)


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


# ---- the cradle: one housing on the deck that the gun nests in ------------------------------------------------------
DECK = 0.29        # top of the turntable's upper deck (radius 0.44): the cradle stays inside it


def cradle(h, PU, BZ, vin, vout, half=0.2, peak=0.13):
    """The mount as one mass on the turntable: a plinth filling the deck (so it visibly stands on something), and two
    side walls (vin..vout either side, PU +- half along u) standing well above the pivot so the bearing sits inside them,
    each with a lighter inset plate and a capped, bolted bearing boss. Everything stays within the deck's radius."""
    _g("cradle")
    h.vcyl(0, 0, DECK, 0.42, 0.035, BODY, top=SIDE, sides=32)                           # plinth on the deck
    z0 = DECK + 0.035
    u0, u1 = PU - half, PU + half
    for sv in (-1, 1):
        top, c = BZ + peak, 0.06                                                        # flat top, small chamfers
        wall = [(u0, z0), (u1, z0), (u1, top - c), (u1 - c, top), (u0 + c, top), (u0, top - c)]
        _uz(h, wall, sv * vin, sv * vout, SIDE, BODY)
        inset = [(u0 + 0.04, z0 + 0.04), (u1 - 0.04, z0 + 0.04), (u1 - 0.04, top - c - 0.02), (u1 - c - 0.02, top - 0.04),
                 (u0 + c + 0.02, top - 0.04), (u0 + 0.04, top - c - 0.02)]
        _uz(h, inset, sv * vout, sv * (vout + 0.012), BODY, EDGE)
        vo = sv * (vout + 0.012)
        D.seg(h, (PU, vo, BZ), (PU, vo + sv * 0.025, BZ), 0.075, SIDE, 16, cap=BODY, capstart=SIDE)  # bearing boss
        D.seg(h, (PU, vo + sv * 0.02, BZ), (PU, vo + sv * 0.045, BZ), 0.035, "brass", 10, cap="brass")


# ---- A: LETTERBOX ------------------------------------------------------------------------------------------------

def letterbox(hot):
    BZ, PU = 0.56, -0.06
    rig = TC.Rig("flak_letterbox", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    cradle(h, PU, BZ, 0.19, 0.29)
    g = rig.f("gun")
    _g("receiver")
    prism(g, -0.56, 0.1, csec(0.18, 0.14, 0.045), csec(0.18, 0.14, 0.045), BZ)
    prism(g, -0.6, -0.56, csec(0.15, 0.11, 0.035), csec(0.15, 0.11, 0.035), BZ, **DARK)   # breech cover
    for u in (-0.44, -0.2):                                                             # bands, same chamfer
        prism(g, u - 0.02, u + 0.02, csec(0.195, 0.155, 0.05), csec(0.195, 0.155, 0.05), BZ, **DARK)
    _g("sail")
    radiator(g, (-0.5, 0, BZ + 0.155), (0.44, 0, 0), (-0.1, 0, 0.36), hot, pipes=4, r=0.02)
    _g("nozzle")
    prism(g, 0.1, 0.14, csec(0.205, 0.165, 0.05), csec(0.205, 0.165, 0.05), BZ, **DARK)
    prism(g, 0.14, 0.9, csec(0.18, 0.14, 0.045), csec(0.34, 0.075, 0.03), BZ)            # widening flat nozzle

    def ztop(u):
        return BZ + 0.14 - 0.065 * (u - 0.14) / 0.76 + 0.004
    for f in (-0.55, 0.55):                                                             # plate seams along it
        seam(g, (0.5, f * (0.135 + 0.155 * 0.47), ztop(0.5)), (0.88, f * 0.31, ztop(0.88)))
    seam(g, (0.5, -0.22, ztop(0.5)), (0.5, 0.22, ztop(0.5)))
    for i, (ua, ub) in enumerate(((0.2, 0.32), (0.34, 0.46))):                          # throat grille on the top
        k = 3 - i
        zt = BZ + 0.14 - 0.065 * ((ua + ub) / 2 - 0.14) / 0.76
        g.box((ua + ub) / 2, 0, zt - 0.008, ub - ua, 0.26, 0.012, UNDER)
        for j, hv in enumerate((0.0, 0.055, 0.11)):
            for sv in ((1,) if j == 0 else (-1, 1)):
                g.box((ua + ub) / 2, sv * hv, zt, ub - ua - 0.03, 0.035, 0.006, heat(hot, k - j, UNDER))
        for vb in (-0.083, -0.028, 0.028, 0.083):
            g.box((ua + ub) / 2, vb, zt, ub - ua, 0.012, 0.014, EDGE)
    prism(g, 0.88, 0.94, csec(0.36, 0.09, 0.03), csec(0.36, 0.09, 0.03), BZ, **DARK)  # lip
    hazard_v(g, 0.91, BZ + 0.09, 0.3)
    for k in range(9):                                                                  # the slot, white at the middle
        v = -0.3 + k * 0.075
        g.box(0.942, v, BZ, 0.006, 0.075, 0.1, heat(hot, 4 - min(4, abs(k - 4)), UNDER), base=False)
    return rig


# ---- B: FINNED BORE ----------------------------------------------------------------------------------------------

def finned(hot):
    BZ, PU = 0.7, -0.08                                                                 # fins clear the plinth
    rig = TC.Rig("flak_finned", (PU, BZ), SCALE)
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


CONCEPTS = {"flakA": letterbox, "flakB": finned}
for _k, _fn in CONCEPTS.items():
    TC.TURRETS[("F", _k)] = _fn
    TC.PICKS[_k] = _fn
