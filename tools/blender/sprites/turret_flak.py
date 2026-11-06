"""FLAK CANNON turret concepts (round 1). Every part is a stage of one chain: hull scrap goes in a hopper, is heated
until it fragments, and is blown out as a spread. The heat is the accent: idle, the hot stages are dark and the steel
around them is heat-stained; charged, they glow on a hot-metal ramp (HEAT: deep red at the edges up to white-hot at the
core), hottest where the scrap is heated and cooling outward along the metal.

  A  SCATTER   a hopper on a breech block feeds an induction collar (glowing vent slots), then a clamped 2 x 2 cluster
               of short flared barrels. Yoke plates carry it on side trunnions.
  B  FURNACE   a finned induction furnace (the glow shows between the fins, hottest mid-length) fed by a funnel on top,
               a short barrel opening into a wide bell mouth with a hot core. On a neck between low cheeks.
  C  SHREDDER  two toothed rollers in an open hopper on the receiver chew the scrap; a flat duckbill nozzle with stiffening
               ribs throws it in a wide fan from a glowing slot mouth. Yoke plates carry it on side trunnions.

Rig conventions as turret_concepts (fixed / head / gun about the trunnion PIVOT, aim d0, z from the roof plane)."""
from . import detail as D
from . import turret_concepts as TC
from .turret_mil import _uz

_g = TC._g
HEAT = ("fxD", "fxR", "fxO", "fxY", "fxW")       # hot-metal ramp: dull red .. white-hot (shared emissive extras)
R, SCALE = 0.64, 1.4                               # race radius and rig scale of a 2x2 light weapon


def heat(hot, k, cold="dark"):
    """Ramp step k (0 dull red .. 4 white-hot) when charged, else the cold material."""
    return HEAT[max(0, min(4, k))] if hot else cold


def stain(k):
    """Temper colours on the steel next to a hot stage (idle and charged alike): k 0 clean, 1 heat-blued, 2 bronze."""
    return ("gm", "navy", "rustD")[k]


def _yoke(h, vs, u0, u1, top):
    """Two upright cheek plates on the deck carrying the trunnions at (PU, BZ), with a boss round each pin."""
    _g("yoke")
    for sv in (-1, 1):
        _uz(h, [(u0, 0.29), (u1, 0.29), (u1 - 0.06, top), (u0 + 0.08, top)], sv * vs, sv * (vs + 0.07), "steelD", "steel")
        _uz(h, [(u0 + 0.06, 0.33), (u1 - 0.05, 0.33), (u1 - 0.1, top - 0.06), (u0 + 0.12, top - 0.06)],
            sv * (vs + 0.07), sv * (vs + 0.085), "steel", "steelL")


def _loft(f, u0, hv0, hz0, u1, hv1, hz1, z, mat, top=None, cap0=None, cap1=None):
    """A box whose cross-section (half widths hv across, hz up) changes from u0 to u1, centred on height z."""
    def c(a, b, d):
        u, hv, hz = (u0, hv0, hz0) if a < 0 else (u1, hv1, hz1)
        return f.pt(u, b * hv, z + d * hz)
    P = {(a, b, d): c(a, b, d) for a in (-1, 1) for b in (-1, 1) for d in (-1, 1)}
    faces = [((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1), top or mat),
             ((-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1), mat),
             ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1), cap1 or mat),
             ((-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1), cap0 or mat),
             ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1), mat),
             ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1), mat)]
    for *ks, col in faces:
        f.poly([P[k] for k in ks], col, flip=True)


# ---- A: SCATTER --------------------------------------------------------------------------------------------------

def scatter(hot):
    BZ, PU = 0.62, -0.18
    rig = TC.Rig("flak_scatter", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    _yoke(h, 0.27, -0.42, 0.06, BZ + 0.12)
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.42, BZ), (PU, 0.42, BZ), 0.075, "steelL", 12, cap="plate", capstart="plate")
    _g("breech")
    g.box(-0.2, 0, BZ, 0.5, 0.48, 0.34, "steelD", top="steel", base=False)              # breech block
    for sv in (-1, 1):
        g.box(-0.22, sv * 0.245, BZ, 0.36, 0.02, 0.22, "steel")                        # side cover plates
    g.box(-0.47, 0, BZ, 0.05, 0.4, 0.28, "steel", top="steelL", base=False)            # breech cap
    _g("hopper")
    g.box(-0.24, 0, BZ + 0.17, 0.28, 0.32, 0.2, "steel", top="dark", taper=1.25)       # scrap hopper, open top
    zt = BZ + 0.37
    for sv in (-1, 1):                                                                 # rim
        g.box(-0.24, sv * 0.2, zt, 0.36, 0.035, 0.035, "steelL")
        g.box(-0.24 + sv * 0.175, 0, zt, 0.035, 0.4, 0.035, "steelL")
    for u in (-0.3, -0.18):                                                            # grate bars
        g.box(u, 0, zt - 0.02, 0.025, 0.38, 0.025, "steelD")
    _g("collar")
    g.box(0.17, 0, BZ, 0.2, 0.46, 0.36, "steelD", top="steel", base=False)             # induction collar
    for i, u in enumerate((0.11, 0.17, 0.23)):                                         # vent slots, hottest mid-collar
        core = 3 if i == 1 else 2
        for j, (v0, v1) in enumerate(((0.0, 0.06), (0.06, 0.12), (0.12, 0.18))):
            for sv in (-1, 1):
                g.box(u, sv * (v0 + v1) / 2, BZ + 0.18, 0.03, v1 - v0, 0.006, heat(hot, core - j))
        for sv in (-1, 1):
            g.box(u, sv * 0.231, BZ, 0.03, 0.006, 0.22, heat(hot, core - 1))
    _g("barrels")
    for bv in (-0.1, 0.1):
        for bz in (-0.1, 0.1):
            z = BZ + bz
            u = 0.27
            for k, ln in ((2, 0.05), (1, 0.07), (0, 0.09)):                            # cooling away from the collar
                g.hcyl(u, u + ln, bv, z, 0.075, heat(hot, k, stain(min(k + 1, 2))), sides=12)
                u += ln
            g.hcyl(u, 0.96, bv, z, 0.075, "gm", sides=12)
            g.hcyl(0.96, 1.06, bv, z, 0.075, "steelL", r1=0.095, sides=12, cap="dark")  # flared muzzle
            g.hcyl(1.06, 1.065, bv, z, 0.05, heat(hot, 3), sides=10, cap=heat(hot, 4))   # charge in the bore
    for u in (0.62, 0.9):                                                              # clamp bands
        g.box(u, 0, BZ, 0.06, 0.4, 0.4, "steel", top="steelL", base=False)
    return rig


# ---- B: FURNACE --------------------------------------------------------------------------------------------------

def furnace(hot):
    BZ, PU = 0.62, -0.25
    rig = TC.Rig("flak_furnace", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    _g("neck")
    h.vcyl(PU, 0, 0.29, 0.24, 0.14, "steel", top="steelL", sides=16)
    TC.cheeks(h, -0.52, 0.14, 0.42, 0.1, hot, HEAT[1])
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.36, BZ), (PU, 0.36, BZ), 0.1, "steelL", 12, cap="plate", capstart="plate")
    _g("furnace")
    u0, u1, n = -0.6, 0.06, 7
    step = (u1 - u0) / n
    for k in range(n):                                                                 # core: hottest mid-length
        mid = 1 - abs((k + 0.5) / n - 0.5) * 2
        g.hcyl(u0 + k * step, u0 + (k + 1) * step, 0, BZ, 0.255, heat(hot, round(1 + mid * 3)), sides=20)
    for k in range(n + 1):                                                             # cooling fins
        u = u0 + k * step
        D.annulus(g, u - 0.025, u + 0.025, 0, BZ, 0.32, 0.24, "steelD", "steel", sides=20)
    for u, w in ((u0 - 0.05, 0.06), (u1 + 0.02, 0.05)):                                # end plates
        D.annulus(g, u - w / 2, u + w / 2, 0, BZ, 0.34, 0.1, "steel", "steelL", sides=20)
    for v, z in ((0, 0.335), (0.29, -0.17), (-0.29, -0.17)):                           # tie rods binding the fins
        D.seg(g, (u0 - 0.08, v, BZ + z), (u1 + 0.05, v, BZ + z), 0.025, "steelL", 6)
    _g("ram")
    g.hcyl(-0.86, -0.63, 0, BZ, 0.13, "steelD", sides=16, capstart="steel")            # feed ram behind
    g.hcyl(-0.8, -0.75, 0, BZ, 0.15, "steel", sides=16, cap="steelL", capstart="steelL")
    _g("funnel")
    fu = -0.27
    g.vcyl(fu, 0, BZ + 0.3, 0.09, 0.1, "steel", sides=14)                              # feed funnel on the furnace
    g.vcyl(fu, 0, BZ + 0.4, 0.1, 0.11, "steelD", top="dark", rtop=0.18, sides=16)
    g.vcyl(fu, 0, BZ + 0.506, 0.09, 0.006, heat(hot, 1), sides=14)                     # glow up the throat
    _g("barrel")
    u = 0.08
    for k, ln in ((2, 0.08), (1, 0.09), (0, 0.11)):
        g.hcyl(u, u + ln, 0, BZ, 0.13, heat(hot, k, stain(min(k + 1, 2))), sides=18)
        u += ln
    g.hcyl(u, 0.72, 0, BZ, 0.13, "gm", sides=18)
    for uh in (0.46, 0.62):                                                            # reinforcing hoops
        D.annulus(g, uh - 0.025, uh + 0.025, 0, BZ, 0.16, 0.12, "steelL", "steelL", sides=18)
    _g("bell")
    g.hcyl(0.72, 0.98, 0, BZ, 0.13, "steel", r1=0.25, sides=22)
    D.annulus(g, 0.98, 1.02, 0, BZ, 0.27, 0.2, "steelL", "steelL", sides=22)
    g.hcyl(0.96, 0.98, 0, BZ, 0.2, "dark", sides=20, cap="dark")
    for r, k, du in ((0.16, 1, 0.0), (0.11, 2, 0.004), (0.06, 4, 0.008)):              # hot core in the bore
        g.hcyl(0.975 + du, 0.982 + du, 0, BZ, r, heat(hot, k), sides=16, cap=heat(hot, k))
    return rig


# ---- C: SHREDDER -------------------------------------------------------------------------------------------------

def shredder(hot):
    BZ, PU = 0.58, -0.2
    rig = TC.Rig("flak_shredder", (PU, BZ), SCALE)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, None, ribs=12)
    _yoke(h, 0.26, -0.46, 0.04, BZ + 0.1)
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.4, BZ), (PU, 0.4, BZ), 0.075, "steelL", 12, cap="plate", capstart="plate")
    _g("receiver")
    g.box(-0.22, 0, BZ, 0.6, 0.46, 0.32, "steelD", top="steel", base=False)
    g.box(-0.54, 0, BZ, 0.05, 0.36, 0.24, "steel", top="steelL", base=False)            # back plate
    _g("hopper")
    z0 = BZ + 0.16
    for sv in (-1, 1):                                                                 # open hopper walls
        g.box(-0.27, sv * 0.215, z0, 0.44, 0.03, 0.2, "steel", top="steelL")
        g.box(-0.27 + sv * 0.205, 0, z0, 0.03, 0.4, 0.2, "steel", top="steelL")
    g.box(-0.27, 0, z0, 0.38, 0.4, 0.01, "dark")                                       # floor of the hopper
    for ur in (-0.36, -0.18):                                                          # counter-rotating rollers
        zr = z0 + 0.1
        D.seg(g, (ur, -0.19, zr), (ur, 0.19, zr), 0.07, "gm", 14, cap="steelL", capstart="steelL")
        for k in range(5):
            v = -0.15 + k * 0.075
            g.box(ur, v, zr + 0.055, 0.04, 0.03, 0.05, "steelL")
    g.box(-0.27, 0, z0 + 0.1, 0.05, 0.36, 0.01, heat(hot, 0))                          # the bite, hot from below
    _g("nozzle")
    zc = BZ - 0.02
    _loft(g, 0.08, 0.2, 0.15, 0.82, 0.32, 0.07, zc, "steelD", top="steel")             # flat duckbill
    for i, (ua, ub) in enumerate(((0.08, 0.2), (0.2, 0.3))):                           # throat side windows
        for sv in (-1, 1):
            g.box((ua + ub) / 2, sv * 0.205, zc, ub - ua - 0.04, 0.006, 0.12, heat(hot, 3 - i, stain(2)))
    for v in (-0.15, 0.0, 0.15):                                                       # stiffening ribs on the top
        D.seg(g, (0.1, v, zc + 0.165), (0.79, v * 1.5, zc + 0.085), 0.02, "steelL", 4)
    _g("lip")
    _loft(g, 0.8, 0.33, 0.08, 0.86, 0.34, 0.085, zc, stain(1), top=stain(1), cap1="dark")
    for k in range(7):                                                                 # the slot: white at the middle
        v = -0.27 + k * 0.09
        g.box(0.865, v, zc, 0.006, 0.09, 0.05, heat(hot, 4 - min(3, abs(k - 3))), base=False)
    return rig


CONCEPTS = {"flakA": scatter, "flakB": furnace, "flakC": shredder}
for _k, _fn in CONCEPTS.items():
    TC.TURRETS[("F", _k)] = _fn
    TC.PICKS[_k] = _fn
