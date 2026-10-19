"""The three remaining weapons, built on the approved turret kit (turret_concepts) and bay kit (turret_bays):

  missile launcher     M  3x3   an armoured launcher box (2 x 3 round tubes) on a yoke, a feed chute from the deck;
                                bay: missile racks, a hoist up the column, a loader cart. Accent red.
  ion cannon           I  2x2   a short barrel through a tight stack of thick emitter rings, a three-prong crown ring
                                at the muzzle, a capacitor sphere behind; bay: a stacked-ring coil tower. Accent blue.
  incendiary launcher  F  2x2   a stubby wide-bore lobber cocked up, a finned heat-vent breech, fuel canisters on the
                                mount; bay: two hazard-banded fuel tanks, a pump, a shell rack. Accent flame yellow.

Same rig conventions as the approved turrets (fixed coaming / head / gun about the trunnion PIVOT, modelled at aim d0,
z from the roof plane) and the same bay frame (u = grid +x, v = grid +y, origin the footprint centre at floor level, a
slim full-height column up to the roof). Accents are dark when idle and glow only when charged."""
import math
from . import core, cmbkit, detail as D
from .cmbkit import Frame
from . import turret_concepts as TC
from . import turret_bays as TB

_g, G = TC._g, TC.G


# ---- turrets ------------------------------------------------------------------------------------------------------

def missile(hot):
    col, R, BZ, PU = "red", 0.92, 0.84, -0.1
    rig = TC.Rig("missile", (PU, BZ), 1.3)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, col)
    _g("yoke")
    h.vcyl(PU, 0, 0.29, 0.34, 0.12, "steel", top="steelL", sides=20)
    for sv in (-1, 1):                                                                        # yoke cheeks
        h.box(PU, sv * 0.66, 0.29, 0.5, 0.1, BZ - 0.29 + 0.2, "steelD", top="steel")
        h.box(PU, sv * 0.66, BZ - 0.18, 0.56, 0.13, 0.08, "steel", top="steelL")
    _g("chute")
    for k in range(5):                                                                        # ammo feed chute
        t = k / 4
        u, z = -0.62 - 0.22 * math.sin(t * math.pi / 2), 0.36 + (BZ - 0.5) * t
        h.box(u, -0.3, z, 0.16, 0.2, 0.11, "steelD" if k % 2 else "steel", top="steelL")
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.74, BZ), (PU, 0.74, BZ), 0.13, "steelL", 14, cap="plate", capstart="plate")
    _g("box")
    u0, u1, hw, hz = -0.8, 0.58, 0.54, 0.4
    g.box((u0 + u1) / 2, 0, BZ - hz, u1 - u0, 2 * hw, 2 * hz, "steelD", top="steel")             # launcher box
    g.box((u0 + u1) / 2 - 0.06, 0, BZ + hz, u1 - u0 - 0.3, 2 * hw - 0.16, 0.05, "steel", top="steelL")   # top plate
    for sv in (-1, 1):                                                                        # side armour + ribs
        g.box((u0 + u1) / 2, sv * (hw + 0.025), BZ - hz + 0.06, u1 - u0 - 0.12, 0.05, 2 * hz - 0.12, "steel", top="steelL")
        for u in (-0.5, -0.05, 0.36):
            g.box(u, sv * (hw + 0.06), BZ - hz + 0.04, 0.06, 0.03, 2 * hz - 0.08, "steelL", top="plate")
    g.box(u1 + 0.02, 0, BZ - hz, 0.05, 2 * hw, 2 * hz, "steel", top="steelL")                 # front plate
    cmbkit.hazard_strip(g, u0 + 0.12, u1 - 0.1, 0, BZ + hz + 0.05, step=0.12, w=0.06, h=0.015)
    _g("tubes")
    for v in (-0.34, 0.0, 0.34):
        for dz in (-0.19, 0.19):
            z = BZ + dz
            g.hcyl(u1 + 0.04, u1 + 0.13, v, z, 0.14, "steelL", sides=16, cap="steel")       # tube collar
            D.annulus(g, u1 + 0.13, u1 + 0.15, v, z, 0.14, 0.1, "steel", G(hot, col), sides=16)   # lit rim
            g.hcyl(u1 + 0.08, u1 + 0.14, v, z, 0.1, "dark", sides=16, cap="dark")            # bore
            if hot:
                g.hcyl(u1 + 0.1, u1 + 0.145, v, z, 0.055, "medRed", r1=0.025, sides=12)       # warhead nose
    _g("rear")
    for v in (-0.3, 0.0, 0.3):                                                                # backblast vents
        g.box(u0 - 0.01, v, BZ - 0.12, 0.02, 0.18, 0.24, "dark")
    g.vcyl(-0.48, 0.3, BZ + hz + 0.05, 0.11, 0.1, "steel", top="lens", sides=12)              # sensor dome
    return rig


def _sphere(g, u, v, z, r, mat, band=None, sides=16):
    """A capacitor sphere about the u axis, out of frustum slices; band colours the equator slice."""
    n = 6
    for k in range(n):
        a0, a1 = math.pi * k / n, math.pi * (k + 1) / n
        r0, r1 = max(r * math.sin(a0), 0.02), max(r * math.sin(a1), 0.02)
        c = band if band and k in (2, 3) else mat
        g.hcyl(u - r * math.cos(a0), u - r * math.cos(a1), v, z, r0, c, r1=r1, sides=sides)


def ion(hot):
    col, R, BZ, PU = "blueN", 0.64, 0.68, -0.2
    rig = TC.Rig("ion", (PU, BZ), 1.4)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, col, ribs=12)
    _g("neck")
    h.vcyl(PU, 0, 0.29, 0.24, 0.14, "steel", top="steelL", sides=16)
    TC.cheeks(h, -0.48, 0.2, 0.42, 0.1, hot, col)
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.32, BZ), (PU, 0.32, BZ), 0.11, "steelL", 12, cap="plate", capstart="plate")
    _g("capacitor")
    _sphere(g, -0.5, 0, BZ, 0.27, "steelD", band="steel")
    g.hcyl(-0.52, -0.46, 0, BZ, 0.285, G(hot, col), sides=16)                                 # charge band
    _g("barrel")
    g.hcyl(-0.25, 1.0, 0, BZ, 0.085, "gm", sides=12)
    _g("rings")
    u = -0.14
    for ro in (0.31, 0.3, 0.29, 0.28, 0.27):                                                  # tight ring stack
        TC.hoop(g, u, BZ, 0.1, ro, 0.15, hot, col)
        u += 0.135
    _g("crown")
    uc = 1.06
    D.annulus(g, uc - 0.04, uc + 0.04, 0, BZ, 0.32, 0.24, "steelD", "steelL", sides=24)        # emitter crown ring
    g.hcyl(uc - 0.035, uc + 0.035, 0, BZ, 0.24, G(hot, col), sides=24)
    g.hcyl(uc - 0.04, uc - 0.035, 0, BZ, 0.24, "dark", sides=24)
    for a in (90, 210, 330):                                                                  # prongs
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        D.seg(g, (0.56, 0.17 * c, BZ + 0.17 * s), (uc, 0.28 * c, BZ + 0.28 * s), 0.035, "steelL", 8)
    g.hcyl(0.98, 1.06, 0, BZ, 0.06, "steelL", sides=12, cap=G(hot, col))                       # emitter node
    return rig


def incendiary(hot):
    col, R, BZ, PU, P = "flameY", 0.64, 0.6, -0.05, math.radians(24)
    rig = TC.Rig("incendiary", (PU, BZ), 1.4)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, col, ribs=12)
    _g("mount")
    h.vcyl(PU, 0, 0.29, 0.36, 0.12, "steelD", top="steel", sides=20)
    for sv in (-1, 1):                                                                        # fuel canisters
        h.hcyl(-0.5, 0.18, sv * 0.42, 0.42, 0.12, "gm", sides=14, cap="steelL", capstart="steelL")
        for u in (-0.36, 0.04):
            h.hcyl(u, u + 0.05, sv * 0.42, 0.42, 0.13, "hazY", sides=14)
        D.seg(h, (0.18, sv * 0.42, 0.42), (0.26, sv * 0.3, 0.5), 0.035, "steelL", 8)          # feed line
    g = rig.f("gun")
    c, s = math.cos(P), math.sin(P)

    def at(u, z=0.0):                                                                         # cocked-up axis point
        return (PU + (u - PU) * c - z * s, BZ + (u - PU) * s + z * c)
    _g("trunnion")
    D.seg(g, (PU, -0.4, BZ), (PU, 0.4, BZ), 0.13, "steelL", 12, cap="plate", capstart="plate")
    _g("breech")
    a, b = at(-0.5), at(0.12)
    D.seg(g, (a[0], 0, a[1]), (b[0], 0, b[1]), 0.3, "steelD", 18, cap="steel", capstart="steel")
    for k in range(5):                                                                        # heat-vent fins
        p, q = at(-0.42 + k * 0.12), at(-0.38 + k * 0.12)
        D.seg(g, (p[0], 0, p[1]), (q[0], 0, q[1]), 0.36, "steel", 18, cap="steelL", capstart="steelL")
    for k in range(4):                                                                        # vent glow between fins
        p, q = at(-0.37 + k * 0.12), at(-0.3 + k * 0.12)
        D.seg(g, (p[0], 0, p[1]), (q[0], 0, q[1]), 0.31, G(hot, col), 18)
    p, q = at(-0.56), at(-0.5)
    D.seg(g, (p[0], 0, p[1]), (q[0], 0, q[1]), 0.18, "steelL", 14, capstart="plate")         # breech cap
    _g("barrel")
    a, b = at(0.12), at(0.78)
    D.seg(g, (a[0], 0, a[1]), (b[0], 0, b[1]), 0.21, "gm", 18)                                # wide stubby tube
    for u0 in (0.3, 0.52):
        p, q = at(u0), at(u0 + 0.06)
        D.seg(g, (p[0], 0, p[1]), (q[0], 0, q[1]), 0.235, "steel", 18, cap="steelL", capstart="steelL")
    p, q = at(0.78), at(0.92)
    D.seg(g, (p[0], 0, p[1]), (q[0], 0, q[1]), 0.27, "steelL", 18, cap="steelD", capstart="steel")   # muzzle ring
    p, q = at(0.9), at(0.925)
    D.seg(g, (p[0], 0, p[1]), (q[0], 0, q[1]), 0.17, "dark", 16, cap="dark")                  # bore
    p, q = at(0.9), at(0.93)
    D.seg(g, (p[0], 0, p[1]), (q[0], 0, q[1]), 0.07, "dark", 10, cap=G(hot, col))              # pilot flame, lit when hot
    return rig


RIGS = {"missile": missile, "ion": ion, "incendiary": incendiary}
RADIUS = {"missile": 0.92, "ion": 0.64, "incendiary": 0.64}
for _k, _fn in RIGS.items():
    TC.TURRETS[("M", _k)] = _fn
    TC.PICKS[_k] = _fn


# ---- bays ---------------------------------------------------------------------------------------------------------

def _missile_body(f, u, v, z, ln=0.95, r=0.09, nose="medRed", axis="u"):
    """A missile lying along u (or standing, axis z): body, nose cone, four fins at the tail."""
    if axis == "u":
        f.hcyl(u - ln / 2, u + ln / 2 - 0.16, v, z, r, "plate", sides=12, capstart="steelD")
        f.hcyl(u + ln / 2 - 0.16, u + ln / 2, v, z, r, nose, r1=0.02, sides=12)
        f.hcyl(u - ln / 2 + 0.12, u - ln / 2 + 0.16, v, z, r + 0.005, "medRed", sides=12)
        for dv, dz in ((r + 0.04, 0), (-r - 0.04, 0), (0, r + 0.04), (0, -r - 0.04)):
            f.box(u - ln / 2 + 0.08, v + dv, z + dz, 0.12, 0.02 if dv else 0.06, 0.06 if dv else 0.02, "steelL",
                  base=False)
    else:
        f.vcyl(u, v, z, r, ln - 0.16, "plate", sides=12, top="plate")
        f.vcyl(u, v, z + ln - 0.16, r, 0.16, nose, rtop=0.02, sides=12)
        f.vcyl(u, v, z + 0.12, r + 0.005, 0.04, "medRed", sides=12)


def _rack(f, u, v, n=3):
    """A missile rack along u: two end frames, rails, n missiles stacked on cradles."""
    _g("rack")
    for du in (-0.42, 0.42):
        f.box(u + du, v, 0, 0.06, 0.42, 0.9, "steelD", top="steel")
    for z in (0.18, 0.46, 0.74)[:n]:
        f.box(u, v, z - 0.06, 0.9, 0.36, 0.04, "steel", top="steelL")
        _missile_body(f, u, v, z + 0.05)
    f.box(u, v, 0.9, 0.92, 0.44, 0.04, "steelD", top="steel")


def bay_missile(rot=0):
    """3x3: the column with an ammo hoist (rails up to the roof, a missile riding it), two missile racks along the
    back corners, a loader cart, capacitor caps and the console."""
    m = core.Mesh("bay_missile")
    f = Frame(m, (1 + rot) % 4, square=True)
    TB._floor(-1.5, 1.5)
    TB._column(f, 0.3)
    _g("hoist")
    for dv in (-0.16, 0.16):
        f.box(0.42, dv, 0, 0.06, 0.06, TC.ZR - 0.1, "steelL", top="plate")
    f.box(0.42, 0, 0, 0.18, 0.44, 0.08, "steelD", top="steel")
    f.box(0.52, 0, 0.9, 0.06, 0.36, 0.06, "steel", top="steelL")                              # cradle
    _missile_body(f, 0.6, 0, 0.62, ln=0.9, axis="z")
    _rack(f, -0.9, -1.1)
    _rack(f, -0.9, 1.1, n=2)
    _g("cart")
    f.box(0.9, 1.1, 0.08, 0.7, 0.34, 0.12, "steel", top="steelL")
    for du in (-0.26, 0.26):
        for dv in (-0.14, 0.14):
            f.vcyl(0.9 + du, 1.1 + dv, 0, 0.05, 0.08, "dark", top="steelD", sides=10)
    _missile_body(f, 0.9, 1.1, 0.3)
    TB._caps(f, ((1.2, -1.2), (1.2, -0.74)), r=0.16)
    TB._console(f, 1.18, 0.2, 0.8)
    return [m.build()] if cmbkit.REC is None else []


def coil_tower(f, u, v, h=1.2):
    """Ion bay: a stacked-ring coil tower on a base, rings dark when idle, a cap electrode on top."""
    _g("coil")
    f.vcyl(u, v, 0, 0.26, 0.08, "steelD", top="steel", sides=20)
    f.vcyl(u, v, 0.08, 0.1, h, "gm", sides=14, top="steelL")
    for k in range(6):
        z = 0.22 + k * (h - 0.3) / 6
        f.vcyl(u, v, z, 0.24, 0.08, "steelD", top="steelL", sides=20)
        f.vcyl(u, v, z + 0.08, 0.13, 0.03, "dark", sides=14)
    f.vcyl(u, v, h + 0.08, 0.13, 0.08, "steelL", top="plate", sides=14)


def _tank(f, u, v, h=0.95):
    _g("tank")
    f.vcyl(u, v, 0, 0.26, 0.06, "steelD", top="steel", sides=20)
    f.vcyl(u, v, 0.06, 0.22, h, "gm", sides=20, top="steelL", rtop=0.22)
    f.vcyl(u, v, h + 0.06, 0.22, 0.08, "steelL", rtop=0.1, sides=20)
    for z in (0.22, 0.7):
        f.vcyl(u, v, z, 0.226, 0.05, "hazY", sides=20)
        f.vcyl(u, v, z + 0.05, 0.226, 0.03, "hazK", sides=20)


def small_bay(kind, rot=0):
    """2x2 ion / incendiary bay, u, v in -1..1: the slim full-height column, gear in three corners."""
    m = core.Mesh(f"bay_{kind}")
    f = Frame(m, (1 + rot) % 4, square=True)
    TB._floor(-1.0, 1.0)
    TB._column(f, 0.2)
    TB._console(f, 0.66, 0.66, k=0.7)
    if kind == "ion":
        coil_tower(f, -0.62, 0.62)
        TB._caps(f, ((0.68, -0.62),), r=0.16, h=0.8)
    else:
        _tank(f, -0.62, 0.62)
        _tank(f, -0.62, -0.08, h=0.8)
        _g("pump")
        f.box(-0.2, 0.62, 0, 0.26, 0.26, 0.34, "steel", top="steelL")
        D.seg(f, (-0.2, 0.62, 0.34), (-0.05, 0.25, 0.9), 0.04, "steelL", 8)
        _g("shells")
        f.box(0.68, -0.62, 0, 0.44, 0.36, 0.08, "steelD", top="steel")
        for du in (-0.13, 0.0, 0.13):
            for dv in (-0.09, 0.09):
                f.vcyl(0.68 + du, -0.62 + dv, 0.08, 0.055, 0.28, "rust", top="rustD", sides=10)
    return [m.build()] if cmbkit.REC is None else []


BAYS = {"missile": bay_missile, "ion": lambda rot=0: small_bay("ion", rot),
        "incendiary": lambda rot=0: small_bay("incendiary", rot)}
TB.BAYS.update(BAYS)
