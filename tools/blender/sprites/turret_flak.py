"""FLAK CANNON turret concepts (round 2; round 1 is in git history). The turret only fires: hull scrap is prepared in the
bay below and comes up through the mount, so every variant shows that feed rising from the deck into the breech. Firing
heats the metal, and in vacuum heat only leaves by radiating, so the hot parts sit where heat would really collect and
the accent is that heat: idle, dark with temper colours on the steel beside it; charged, a hot-metal ramp (HEAT, deep red
up to white-hot) hottest at the source and cooling outward.

  A  MANTLET   an angular armoured wedge on trunnions, one short heavy barrel with two recoil cylinders over it and a
               choke cup at the muzzle; louvred vents on the wedge glow. Fed by an armoured conduit into its back.
  B  TWIN      two barrels close together on one cradle in perforated cooling jackets that glow through the holes, hottest
               at the breech. Fed through the hollow trunnions by two ribbed chutes rising from the deck.
  C  RADIATOR  one barrel on a chamber carrying two radiator sails swept up in a V; heat pipes run from the chamber out to
               the sail edges, white-hot at the root and cooling to dull red. Fed by a ribbed trunk into the chamber's belly.

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


# ---- A: MANTLET --------------------------------------------------------------------------------------------------

def mantlet(hot):
    BZ, PU = 0.6, -0.18
    rig = TC.Rig("flak_mantlet", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    _g("yoke")
    for sv in (-1, 1):
        _uz(h, [(-0.44, 0.29), (0.08, 0.29), (0.0, BZ + 0.1), (-0.34, BZ + 0.1)], sv * 0.3, sv * 0.37, "steelD", "steel")
    _g("feed")
    conduit(h, (-0.52, 0, 0.3), (-0.56, 0, BZ - 0.06), 0.075, 3)                       # feed up from the bay
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.42, BZ), (PU, 0.42, BZ), 0.08, "steelL", 12, cap="plate", capstart="plate")
    _g("mantlet")
    loft(g, -0.56, 0.29, 0.2, 0.14, 0.22, 0.13, BZ, "steelD", top="steel", cap1="steel")  # armoured wedge
    loft(g, -0.6, 0.24, 0.15, -0.56, 0.26, 0.17, BZ, "steel", top="steelL")              # back plate, feed port
    _g("louvres")
    for i, u in enumerate((-0.4, -0.3, -0.2, -0.1)):                                   # hottest over the chamber
        k = (2, 3, 3, 2)[i]
        zt = BZ + 0.2 - (u + 0.56) / 0.7 * 0.07
        for j, (w, dk) in enumerate(((0.07, 0), (0.06, -1), (0.05, -2))):              # across: hot centre
            for sv in ((1,) if j == 0 else (-1, 1)):
                vc = sv * (0.035 + 0.065 * j) if j else 0.0
                g.box(u, vc, zt - 0.005, 0.035, 0.07 if j == 0 else 0.065, 0.008, heat(hot, k + dk))
        g.box(u + 0.045, 0, zt, 0.025, 0.44, 0.03, "steelL")                           # slat
    _g("recoil")
    for sv in (-1, 1):                                                                  # recoil cylinders over the barrel
        g.hcyl(0.14, 0.6, sv * 0.085, BZ + 0.13, 0.05, "steelL", sides=12, cap="steel")
        D.seg(g, (0.6, sv * 0.085, BZ + 0.13), (0.7, sv * 0.085, BZ + 0.13), 0.022, "plate", 8)
    g.box(0.72, 0, BZ + 0.07, 0.05, 0.26, 0.2, "steel", top="steelL")                   # yoke tying rods to the barrel
    _g("barrel")
    u = hot_run(g, 0.14, ((3, 0.06), (2, 0.08), (1, 0.1), (0, 0.1)), 0, BZ, 0.095, hot, sides=16)
    g.hcyl(u, 0.92, 0, BZ, 0.095, "gm", sides=16)
    _g("choke")
    g.hcyl(0.92, 1.06, 0, BZ, 0.12, "steel", r1=0.14, sides=18, capstart="steelL")      # choke cup
    D.annulus(g, 1.04, 1.08, 0, BZ, 0.15, 0.1, "steelL", "steelL", sides=18)
    g.hcyl(1.04, 1.06, 0, BZ, 0.1, "dark", sides=16, cap="dark")
    for r, k, du in ((0.08, 1, 0.0), (0.05, 3, 0.004)):
        g.hcyl(1.055 + du, 1.062 + du, 0, BZ, r, heat(hot, k), sides=14, cap=heat(hot, k))
    return rig


# ---- B: TWIN -----------------------------------------------------------------------------------------------------

def twin(hot):
    BZ, PU = 0.6, -0.16
    rig = TC.Rig("flak_twin", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    _g("pedestal")
    h.vcyl(PU, 0, 0.29, 0.2, BZ - 0.42, "steelD", top="steel", sides=16)
    _g("feed")
    for sv in (-1, 1):                                                                  # chutes up into the trunnions
        conduit(h, (PU - 0.18, sv * 0.47, 0.3), (PU, sv * 0.42, BZ - 0.02), 0.06, 3)
    g = rig.f("gun")
    _g("trunnion")
    for sv in (-1, 1):                                                                  # hollow trunnion hubs
        D.seg(g, (PU, sv * 0.22, BZ), (PU, sv * 0.42, BZ), 0.1, "steel", 14, cap="steelL", capstart="steelL")
        D.seg(g, (PU, sv * 0.41, BZ), (PU, sv * 0.43, BZ), 0.115, "steelL", 14, cap="steelD")
    _g("cradle")
    g.box(-0.18, 0, BZ, 0.62, 0.42, 0.3, "steelD", top="steel", base=False)
    g.box(-0.52, 0, BZ, 0.08, 0.36, 0.24, "steel", top="steelL", base=False)            # breech covers
    g.box(-0.2, 0, BZ + 0.155, 0.4, 0.06, 0.02, "steelL")                               # spine between the guns
    _g("barrels")
    for sv in (-1, 1):
        v = sv * 0.11
        g.hcyl(0.13, 0.17, v, BZ, 0.1, "steel", sides=14, cap="steelL", capstart="steelL")  # jacket collar
        u = 0.17
        for k in range(6):                                                              # perforated jacket
            g.hcyl(u, u + 0.045, v, BZ, 0.085, "steelL" if k % 2 == 0 else "steel", sides=14)
            g.hcyl(u + 0.045, u + 0.075, v, BZ, 0.07, heat(hot, 3 - k * 3 // 5, stain(2 if k < 2 else 1)), sides=12)
            u += 0.075
        g.hcyl(u, u + 0.04, v, BZ, 0.1, "steel", sides=14, cap="steelL", capstart="steelL")
        g.hcyl(u + 0.04, 0.96, v, BZ, 0.05, "gm", sides=12)
        g.hcyl(0.96, 1.08, v, BZ, 0.06, "steelL", r1=0.075, sides=12, cap="dark")       # flash hider
        for du in (0.99, 1.03):
            for a in (0, 90):
                c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
                g.box(du + 0.015, v + 0.072 * c, BZ + 0.072 * s, 0.015, 0.012 + 0.0 * s, 0.012, "dark")
        g.hcyl(1.08, 1.085, v, BZ, 0.04, heat(hot, 3), sides=10, cap=heat(hot, 4))
    g.box(0.88, 0, BZ, 0.05, 0.36, 0.08, "steel", top="steelL", base=False)             # muzzle tie
    return rig


# ---- C: RADIATOR -------------------------------------------------------------------------------------------------

def radiator(hot):
    BZ, PU = 0.56, -0.22
    rig = TC.Rig("flak_radiator", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    _g("yoke")
    for sv in (-1, 1):
        _uz(h, [(-0.4, 0.29), (0.0, 0.29), (-0.06, BZ + 0.06), (-0.34, BZ + 0.06)], sv * 0.22, sv * 0.29, "steelD", "steel")
    _g("feed")
    conduit(h, (-0.5, 0, 0.3), (-0.42, 0, BZ - 0.12), 0.07, 3)                          # trunk into the belly
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.32, BZ), (PU, 0.32, BZ), 0.08, "steelL", 12, cap="plate", capstart="plate")
    _g("chamber")
    g.hcyl(-0.56, 0.06, 0, BZ, 0.17, "steelD", sides=18, capstart="steel")
    for u in (-0.5, 0.0):
        g.hcyl(u, u + 0.05, 0, BZ, 0.19, "steel", sides=18, cap="steelL", capstart="steelL")
    _g("sails")
    ca, sa = math.cos(math.radians(32)), math.sin(math.radians(32))
    W, U0, UL, T = 0.46, -0.5, 0.5, 0.025
    for sv in (-1, 1):
        root = (U0, sv * 0.1, BZ + 0.12)
        ew = (0.0, sv * sa * W, ca * W)
        eu = (UL, 0.0, 0.0)
        slab(g, root, eu, ew, T, "steel", face="steelD")                                # radiator sail
        slab(g, (U0 - 0.02, root[1], root[2]), (UL + 0.04, 0, 0), (0, sv * sa * 0.05, ca * 0.05), 0.05, "steel",
             face="steelL")                                                             # root manifold
        slab(g, tuple(root[i] + ew[i] - (0.02 if i == 0 else 0) for i in range(3)), (UL + 0.04, 0, 0),
             (0, sv * sa * 0.03, ca * 0.03), 0.04, "steelL")                             # edge rail
        nx = (eu[1] * ew[2] - eu[2] * ew[1], eu[2] * ew[0] - eu[0] * ew[2], eu[0] * ew[1] - eu[1] * ew[0])
        nrm = tuple(c / math.sqrt(sum(q * q for q in nx)) for c in nx)                  # the sail's normal
        for p in range(4):                                                              # heat pipes, root to edge
            u = U0 + 0.07 + p * (UL - 0.14) / 3
            core = 4 if p in (1, 2) else 3
            for s in range(4):
                o = tuple(root[i] + (u - U0 if i == 0 else 0) + ew[i] * (0.08 + s * 0.22) for i in range(3))
                for side in (-1, 1):
                    oo = tuple(o[i] + side * nrm[i] * (T / 2 + 0.006) for i in range(3))
                    slab(g, oo, (0.03, 0, 0), tuple(c * 0.2 / W for c in ew), 0.008,
                         heat(hot, core - s, stain(2 if s == 0 else 1)))
    _g("barrel")
    u = hot_run(g, 0.06, ((3, 0.06), (2, 0.07), (1, 0.08), (0, 0.1)), 0, BZ, 0.09, hot)
    g.hcyl(u, 0.94, 0, BZ, 0.09, "gm", sides=14)
    for uh in (0.55, 0.78):
        D.annulus(g, uh - 0.02, uh + 0.02, 0, BZ, 0.115, 0.085, "steelL", "steelL", sides=14)
    _g("choke")
    g.hcyl(0.94, 1.06, 0, BZ, 0.1, "steel", r1=0.13, sides=16, cap="dark", capstart="steelL")
    for r, k, du in ((0.09, 1, 0.0), (0.05, 3, 0.004)):
        g.hcyl(1.06 + du, 1.066 + du, 0, BZ, r, heat(hot, k), sides=14, cap=heat(hot, k))
    return rig


CONCEPTS = {"flakA": mantlet, "flakB": twin, "flakC": radiator}
for _k, _fn in CONCEPTS.items():
    TC.TURRETS[("F", _k)] = _fn
    TC.PICKS[_k] = _fn
