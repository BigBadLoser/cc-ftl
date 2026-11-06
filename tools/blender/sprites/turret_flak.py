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


def _face(f, pts, ref, col):
    """A polygon wound so its normal points away from ref (both local u, v, z)."""
    P = [Vector(f.pt(*q)) for q in pts]
    n = (P[1] - P[0]).cross(P[2] - P[0])
    if n.dot(sum(P, Vector()) / len(P) - Vector(f.pt(*ref))) < 0:
        P = P[::-1]
    f.poly(P, col, flip=False)


def prism(f, u0, u1, sec0, sec1, z, top=BODY, edge=EDGE, side=BODY, under=UNDER, cap0=SIDE, cap1=SIDE, dz1=0.0):
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
    _face(f, [(u0, v, z + dz) for v, dz in sec0], (u1, 0.0, z), cap0)
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
          heat(hot, core - 1, BODY), 12, cap=EDGE, capstart=EDGE)                      # root manifold
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


def hot_cone(g, u0, u1, r0, r1, z, hot, steps=(3, 2, 1, 0), wall=0.012):
    """The inside of a flared bore: a cone just inside the outer one, glowing hottest at the throat when charged."""
    n = len(steps)
    for i, k in enumerate(steps):
        ua, ub = u0 + (u1 - u0) * i / n, u0 + (u1 - u0) * (i + 1) / n
        ra, rb = r0 + (r1 - r0) * i / n - wall, r0 + (r1 - r0) * (i + 1) / n - wall
        g.hcyl(ua, ub, 0, z, ra, heat(hot, k, UNDER), r1=rb, sides=24)


# ---- A: TRUMPET --------------------------------------------------------------------------------------------------

def trumpet(hot):
    BZ, PU = 0.56, -0.26
    rig = TC.Rig("flak_trumpet", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    yoke(h, 0.22, -0.44, -0.08, PU, BZ)
    feed(h, (-0.56, 0, 0.32), (-0.52, 0, BZ - 0.17))
    g = rig.f("gun")
    _g("chamber")
    prism(g, -0.62, 0.0, octa(0.2), octa(0.2), BZ)
    prism(g, -0.68, -0.62, octa(0.17), octa(0.17), BZ, cap0=EDGE)                        # rear cap
    bolts(g, -0.685, BZ, 0.12, n=6, mat=BODY)
    for u in (-0.5, -0.14):
        prism(g, u - 0.025, u + 0.025, octa(0.225), octa(0.225), BZ, side=EDGE, cap0=EDGE, cap1=EDGE)  # bands
    _g("wings")
    for sv in (-1, 1):
        radiator(g, (-0.52, sv * 0.21, BZ + 0.02), (0.4, 0, 0), (0, sv * 0.4, 0.08), hot, pipes=3, r=0.02)
    _g("throat")
    collar(g, 0.02, BZ, 0.2)
    u = hot_run(g, 0.04, ((3, 0.08), (2, 0.08), (1, 0.08)), 0, BZ, 0.15, hot, sides=18)
    collar(g, u, BZ, 0.18, w=0.03)
    _g("bell")
    g.hcyl(u, 0.95, 0, BZ, 0.16, BODY, r1=0.34, sides=28)
    hot_cone(g, u, 0.95, 0.16, 0.34, BZ, hot)
    g.hcyl(u + 0.01, u + 0.02, 0, BZ, 0.13, heat(hot, 4, UNDER), sides=18, cap=heat(hot, 4, UNDER))  # white core
    um = u + (0.95 - u) * 0.5
    D.annulus(g, um - 0.02, um + 0.02, 0, BZ, 0.27, 0.24, EDGE, EDGE, sides=28)          # stiffening ring
    for k in range(6):                                                                  # flush strakes
        a = math.tau * k / 6 + math.pi / 6
        c, s = math.cos(a), math.sin(a)
        D.seg(g, (u + 0.04, 0.175 * c, BZ + 0.175 * s), (0.92, 0.345 * c, BZ + 0.345 * s), 0.016, EDGE, 4)
    D.annulus(g, 0.94, 1.0, 0, BZ, 0.37, 0.32, EDGE, BODY, sides=28)                   # rolled lip
    return rig


# ---- B: LETTERBOX ------------------------------------------------------------------------------------------------

def letterbox(hot):
    BZ, PU = 0.54, -0.22
    rig = TC.Rig("flak_letterbox", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    yoke(h, 0.25, -0.42, -0.02, PU, BZ)
    feed(h, (-0.6, 0, 0.32), (-0.56, 0, BZ - 0.16))
    g = rig.f("gun")
    _g("receiver")
    prism(g, -0.62, 0.04, csec(0.23, 0.15, 0.05), csec(0.23, 0.15, 0.05), BZ)
    prism(g, -0.67, -0.62, csec(0.2, 0.12, 0.04), csec(0.2, 0.12, 0.04), BZ, cap0=EDGE)  # breech cover
    for sv in (-1, 1):
        D.panel(g, -0.3, sv * 0.23, BZ - 0.01, 0.4, 0.16, mat=BODY, seam=UNDER, face="+v" if sv > 0 else "-v")
    _g("sail")
    radiator(g, (-0.52, 0, BZ + 0.17), (0.5, 0, 0), (-0.1, 0, 0.38), hot, pipes=4, r=0.02)
    _g("nozzle")
    prism(g, 0.04, 0.09, csec(0.25, 0.17, 0.05), csec(0.25, 0.17, 0.05), BZ, side=EDGE, cap0=EDGE, cap1=EDGE)  # flange
    prism(g, 0.09, 0.88, csec(0.22, 0.15, 0.05), csec(0.36, 0.08, 0.03), BZ)            # widening flat nozzle
    for i, (ua, ub) in enumerate(((0.14, 0.26), (0.28, 0.4))):                           # throat grille on the top
        k = 3 - i
        zt = BZ + 0.15 - 0.07 * ((ua + ub) / 2 - 0.09) / 0.79
        g.box((ua + ub) / 2, 0, zt - 0.01, ub - ua, 0.3, 0.012, UNDER)
        for j, hv in enumerate((0.0, 0.06, 0.12)):
            for sv in ((1,) if j == 0 else (-1, 1)):
                g.box((ua + ub) / 2, sv * hv, zt, ub - ua - 0.03, 0.04, 0.006, heat(hot, k - j, UNDER))
        for vb in (-0.09, -0.03, 0.03, 0.09):
            g.box((ua + ub) / 2, vb, zt, ub - ua, 0.012, 0.014, EDGE)
    prism(g, 0.86, 0.93, csec(0.38, 0.1, 0.03), csec(0.38, 0.1, 0.03), BZ, side=EDGE, cap1=UNDER)  # lip
    for k in range(9):                                                                  # the slot, white at the middle
        v = -0.32 + k * 0.08
        g.box(0.932, v, BZ, 0.006, 0.08, 0.1, heat(hot, 4 - min(4, abs(k - 4)), UNDER), base=False)
    return rig


# ---- C: FINNED BORE ----------------------------------------------------------------------------------------------

def finned(hot):
    BZ, PU = 0.6, -0.3
    rig = TC.Rig("flak_finned", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    yoke(h, 0.26, -0.5, -0.1, PU, BZ)
    feed(h, (-0.62, 0, 0.32), (-0.62, 0, BZ - 0.18))
    g = rig.f("gun")
    _g("breech")
    prism(g, -0.68, -0.08, octa(0.23), octa(0.23), BZ)
    prism(g, -0.73, -0.68, octa(0.19), octa(0.19), BZ, cap0=EDGE)
    bolts(g, -0.735, BZ, 0.13, n=8, mat=BODY)
    prism(g, -0.4, -0.35, octa(0.25), octa(0.25), BZ, side=EDGE, cap0=EDGE, cap1=EDGE)
    collar(g, -0.06, BZ, 0.27, w=0.05, sides=20)
    _g("bore")
    g.hcyl(-0.04, 0.84, 0, BZ, 0.19, SIDE, sides=20)
    _g("fins")
    for a in range(8):                                                                 # radial fins, hot at the root
        ang = math.radians(22.5 + a * 45)
        c, s = math.cos(ang), math.sin(ang)

        def at(u, r):
            return (u, r * c, BZ + r * s)
        NU, NR = 4, 3
        for iu in range(NU):
            for ir in range(NR):
                t0, t1 = iu / NU, (iu + 1) / NU
                q0, q1 = ir / NR, (ir + 1) / NR

                def pt(tu, tr):
                    ur0, ur1 = -0.02 + 0.8 * tu, 0.02 + 0.66 * tu                       # root and tip edges in u
                    rt = 0.37 - 0.06 * tu                                               # tip radius tapers forward
                    return at(ur0 + (ur1 - ur0) * tr, 0.19 + (rt - 0.19) * tr)
                k = 4 - iu - ir
                qslab(g, pt(t0, q0), pt(t1, q0), pt(t0, q1), pt(t1, q1), 0.03, BODY,
                      face=heat(hot, k, "rustD" if k >= 4 else BODY) if k >= 1 else BODY)
        D.seg(g, at(0.02, 0.375), at(0.68, 0.315), 0.02, EDGE, 6, cap=EDGE, capstart=EDGE)  # fin tip rail
    D.annulus(g, 0.78, 0.83, 0, BZ, 0.33, 0.19, EDGE, BODY, sides=24)                  # fin clamp ring
    _g("muzzle")
    g.hcyl(0.83, 0.92, 0, BZ, 0.22, BODY, sides=20)
    D.annulus(g, 0.92, 0.96, 0, BZ, 0.24, 0.15, EDGE, EDGE, sides=20)
    hot_cone(g, 0.8, 0.95, 0.12, 0.155, BZ, hot, steps=(2, 1), wall=0.0)
    g.hcyl(0.8, 0.81, 0, BZ, 0.12, heat(hot, 4, UNDER), sides=16, cap=heat(hot, 4, UNDER))
    return rig


CONCEPTS = {"flakA": trumpet, "flakB": letterbox, "flakC": finned}
for _k, _fn in CONCEPTS.items():
    TC.TURRETS[("F", _k)] = _fn
    TC.PICKS[_k] = _fn
