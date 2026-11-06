"""FLAK CANNON turret concepts (round 3; rounds 1 and 2 are in git history). It throws a cloud of scrap fragments with
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
    """Temper colours on the steel beside a hot part (idle and charged alike): k 0 clean, 1 heat-blued, 2 bronze."""
    return ("gm", "navy", "rustD")[k]


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
    """Barrel stretch leaving a hot part: (ramp step, length) pieces, each stained when cold. Returns the end u."""
    for k, ln in segs:
        g.hcyl(u, u + ln, v, z, r, heat(hot, k, stain(min(k + 1, 2))), sides=sides)
        u += ln
    return u


# ---- shared radiator parts ---------------------------------------------------------------------------------------

def _normal(eu, ew):
    n = (eu[1] * ew[2] - eu[2] * ew[1], eu[2] * ew[0] - eu[0] * ew[2], eu[0] * ew[1] - eu[1] * ew[0])
    ln = math.sqrt(sum(c * c for c in n)) or 1.0
    return tuple(c / ln for c in n)


def panel(g, o, eu, ew, hot, pipes=4, steps=4, core=4, t=0.025, both=True):
    """A radiator panel (corner o, edges eu along its root and ew out to its edge) with heat pipes running from the
    root (ramp `core`, the middle pipes hottest) out to the edge, cooling a step per stretch; an edge rail and a root
    manifold. Cold, the pipes are bronze at the root and bare steel beyond."""
    slab(g, o, eu, ew, t, "steel", face="steelD")
    ln = math.sqrt(sum(c * c for c in ew))
    e = tuple(c * 0.035 / ln for c in ew)
    slab(g, tuple(o[i] + ew[i] for i in range(3)), eu, e, t * 1.6, "steelL")               # edge rail
    slab(g, tuple(o[i] - e[i] for i in range(3)), eu, tuple(c * 2 for c in e), t * 2.4, "steel", face="steelL")
    nrm = _normal(eu, ew)
    for p in range(pipes):
        f = (p + 0.5) / pipes
        k0 = core - (0 if 0.25 < f < 0.75 else 1)
        for s in range(steps):
            a = 0.06 + s * 0.94 / steps
            o2 = tuple(o[i] + eu[i] * (f - 0.035) + ew[i] * a for i in range(3))
            for side in ((-1, 1) if both else (1,)):
                oo = tuple(o2[i] + side * nrm[i] * (t / 2 + 0.006) for i in range(3))
                slab(g, oo, tuple(c * 0.07 for c in eu), tuple(c * 0.94 / steps * 0.92 for c in ew), 0.008,
                     heat(hot, k0 - s, "rustD" if s == 0 else "steelL"))


def hot_core(g, u, z, rs, hot):
    """Glow layers sunk in a wide bore at u: (radius, ramp step) from the rim inwards, each a hair further out."""
    for i, (r, k) in enumerate(rs):
        g.hcyl(u + i * 0.004, u + i * 0.004 + 0.006, 0, z, r, heat(hot, k), sides=18, cap=heat(hot, k))


# ---- A: TRUMPET --------------------------------------------------------------------------------------------------

def trumpet(hot):
    BZ, PU = 0.56, -0.26
    rig = TC.Rig("flak_trumpet", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    _g("yoke")
    for sv in (-1, 1):
        _uz(h, [(-0.44, 0.29), (-0.06, 0.29), (-0.12, BZ + 0.06), (-0.38, BZ + 0.06)], sv * 0.21, sv * 0.28, "steelD", "steel")
    _g("feed")
    conduit(h, (-0.56, 0, 0.3), (-0.5, 0, BZ - 0.14), 0.07, 3)
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.3, BZ), (PU, 0.3, BZ), 0.08, "steelL", 12, cap="plate", capstart="plate")
    _g("chamber")
    g.hcyl(-0.62, 0.02, 0, BZ, 0.2, "steelD", sides=18, capstart="steel")
    for u in (-0.6, -0.04):
        g.hcyl(u, u + 0.05, 0, BZ, 0.22, "steel", sides=18, cap="steelL", capstart="steelL")
    _g("wings")
    for sv in (-1, 1):                                                                 # flat radiator wings
        panel(g, (-0.56, sv * 0.2, BZ + 0.02), (0.5, 0, 0), (0, sv * 0.42, 0.07), hot)
    _g("throat")
    u = hot_run(g, 0.02, ((3, 0.08), (2, 0.08), (1, 0.08)), 0, BZ, 0.16, hot, sides=18)
    _g("bell")
    g.hcyl(u, 0.96, 0, BZ, 0.16, "steel", r1=0.34, sides=24)
    for a in (45, 135, 225, 315):                                                      # gussets throat to rim
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        D.seg(g, (u + 0.02, 0.17 * c, BZ + 0.17 * s), (0.92, 0.33 * c, BZ + 0.33 * s), 0.022, "steelL", 6)
    D.annulus(g, 0.95, 1.0, 0, BZ, 0.36, 0.3, "steelL", "steelL", sides=24)
    g.hcyl(0.95, 0.96, 0, BZ, 0.3, "dark", sides=24, cap="dark")
    hot_core(g, 0.955, BZ, ((0.27, 0), (0.21, 1), (0.14, 2), (0.08, 3), (0.04, 4)), hot)
    return rig


# ---- B: LETTERBOX ------------------------------------------------------------------------------------------------

def letterbox(hot):
    BZ, PU = 0.54, -0.22
    rig = TC.Rig("flak_letterbox", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    _g("yoke")
    for sv in (-1, 1):
        _uz(h, [(-0.44, 0.29), (0.0, 0.29), (-0.06, BZ + 0.06), (-0.36, BZ + 0.06)], sv * 0.24, sv * 0.31, "steelD", "steel")
    _g("feed")
    conduit(h, (-0.58, 0, 0.3), (-0.52, 0, BZ - 0.12), 0.07, 3)
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.34, BZ), (PU, 0.34, BZ), 0.08, "steelL", 12, cap="plate", capstart="plate")
    _g("receiver")
    loft(g, -0.6, 0.22, 0.15, 0.06, 0.22, 0.15, BZ, "steelD", top="steel", cap0="steel")
    _g("sail")
    panel(g, (-0.52, 0, BZ + 0.15), (0.62, 0, 0), (-0.12, 0, 0.4), hot, pipes=5)        # dorsal radiator
    _g("nozzle")
    loft(g, 0.06, 0.22, 0.15, 0.9, 0.36, 0.08, BZ, "steelD", top="steel")              # widening flat nozzle
    for i, (ua, ub) in enumerate(((0.08, 0.22), (0.22, 0.36))):                         # throat heat, on the top
        k = 3 - i
        for j, hv in enumerate((0.05, 0.11, 0.17)):
            for sv in ((1,) if j == 0 else (-1, 1)):
                zt = BZ + 0.15 - (0.15 - 0.08) * ((ua + ub) / 2 - 0.06) / 0.84 + 0.003
                g.box((ua + ub) / 2, sv * hv if j else 0.0, zt, ub - ua - 0.03, 0.05 if j == 0 else 0.055, 0.004,
                      heat(hot, k - j, stain(2 - min(j, 1))))
    for v in (-0.22, 0.22):                                                             # side stiffeners
        D.seg(g, (0.1, v, BZ + 0.12), (0.86, v * 1.55, BZ + 0.07), 0.02, "steelL", 4)
    loft(g, 0.88, 0.37, 0.09, 0.94, 0.38, 0.095, BZ, "steelL", top="steelL", cap1="dark")  # lip
    for k in range(9):                                                                  # the slot, white at the middle
        v = -0.32 + k * 0.08
        g.box(0.945, v, BZ, 0.006, 0.08, 0.1, heat(hot, 4 - min(4, abs(k - 4))), base=False)
    return rig


# ---- C: FINNED BORE ----------------------------------------------------------------------------------------------

def finned(hot):
    BZ, PU = 0.6, -0.3
    rig = TC.Rig("flak_finned", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    _g("yoke")
    for sv in (-1, 1):
        _uz(h, [(-0.5, 0.29), (-0.1, 0.29), (-0.16, BZ + 0.06), (-0.44, BZ + 0.06)], sv * 0.25, sv * 0.32, "steelD", "steel")
    _g("feed")
    conduit(h, (-0.6, 0, 0.3), (-0.6, 0, BZ - 0.12), 0.07, 3)
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.36, BZ), (PU, 0.36, BZ), 0.08, "steelL", 12, cap="plate", capstart="plate")
    _g("breech")
    g.hcyl(-0.7, -0.08, 0, BZ, 0.23, "steelD", sides=20, capstart="steel")
    g.hcyl(-0.7, -0.64, 0, BZ, 0.25, "steel", sides=20, cap="steelL", capstart="steelL")
    _g("bore")
    g.hcyl(-0.08, 0.86, 0, BZ, 0.19, "gm", sides=20)
    _g("fins")
    U0, UL, NU = -0.04, 0.78, 4
    for a in range(8):                                                                 # radial fins, hot at the root
        ang = math.radians(22.5 + a * 45)
        c, s = math.cos(ang), math.sin(ang)
        for iu in range(NU):
            for ir in range(3):
                u0 = U0 + iu * UL / NU
                r0 = 0.19 + ir * 0.06
                k = 4 - iu - ir
                slab(g, (u0, r0 * c, BZ + r0 * s), (UL / NU, 0, 0), (0, 0.06 * c, 0.06 * s), 0.03,
                     "steelD", face=heat(hot, k, "rustD" if k >= 4 else "steelD") if k >= 1 else "steelD")
        slab(g, (U0, 0.37 * c, BZ + 0.37 * s), (UL, 0, 0), (0, 0.025 * c, 0.025 * s), 0.04, "steelL")  # tip rail
    D.annulus(g, U0 + UL, U0 + UL + 0.05, 0, BZ, 0.4, 0.19, "steel", "steelL", sides=24)  # fin clamp ring
    _g("muzzle")
    D.annulus(g, 0.86, 0.94, 0, BZ, 0.23, 0.15, "steelL", "steelL", sides=22)
    g.hcyl(0.9, 0.91, 0, BZ, 0.15, "dark", sides=20, cap="dark")
    hot_core(g, 0.905, BZ, ((0.13, 0), (0.09, 1), (0.05, 3)), hot)
    return rig


CONCEPTS = {"flakA": trumpet, "flakB": letterbox, "flakC": finned}
for _k, _fn in CONCEPTS.items():
    TC.TURRETS[("F", _k)] = _fn
    TC.PICKS[_k] = _fn
