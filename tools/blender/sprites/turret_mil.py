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

def _uz(f, shape, v0, v1, mat, top):
    """Extrude a convex u/z outline across v in [v0, v1], faces wound outward (sides facing up take top)."""
    from mathutils import Vector
    uc = sum(u for u, _ in shape) / len(shape)
    zc = sum(z for _, z in shape) / len(shape)

    def face(pts, ref, col):
        P = [Vector(f.pt(*q)) for q in pts]
        n = (P[1] - P[0]).cross(P[2] - P[0])
        if n.dot(sum(P, Vector()) / len(P) - Vector(f.pt(*ref))) < 0:
            P = P[::-1]
        f.poly(P, col, flip=False)
    mid = (uc, (v0 + v1) / 2, zc)
    for i in range(len(shape)):
        (ua, za), (ub, zb) = shape[i], shape[(i + 1) % len(shape)]
        up = (za + zb) / 2 > zc and abs(zb - za) < abs(ub - ua) + 1e-6
        face([(ua, v0, za), (ub, v0, zb), (ub, v1, zb), (ua, v1, za)], mid, top if up else mat)
    face([(u, v0, z) for u, z in shape], (uc, v1, zc), mat)
    face([(u, v1, z) for u, z in shape], (uc, v0, zc), mat)


def missile(hot):
    """An armoured launcher with a sloped glacis over a 2 x 3 grid of round tubes, between angled yoke armour; a ribbed
    magazine drum on the deck behind feeds it through a segmented chute. Charged: tube rims and the glacis strip lit
    red, warheads seated in the tubes."""
    col, R, BZ, PU = "red", 0.92, 0.82, -0.12
    rig = TC.Rig("missile", (PU, BZ), 1.3)
    TC.coaming(rig.f("fixed"), R)
    h = rig.f("head")
    TC.turntable(h, R, hot, col)
    _g("yoke")
    h.vcyl(PU, 0, 0.29, 0.5, 0.08, "steelD", top="steel", sides=24)
    for sv in (-1, 1):                                                                        # angled yoke armour
        _uz(h, [(-0.5, 0.3), (-0.5, 0.86), (-0.22, 1.08), (0.22, 1.08), (0.44, 0.8), (0.44, 0.3)],
            sv * 0.6, sv * 0.74, "steelD", "steel")
        _uz(h, [(-0.36, 0.42), (-0.36, 0.84), (-0.16, 0.98), (0.16, 0.98), (0.3, 0.78), (0.3, 0.42)],
            sv * 0.74, sv * 0.77, "steel", "steelL")
        h.box(0.2, sv * 0.775, 0.5, 0.08, 0.01, 0.06, G(hot, col), base=False)                   # yoke status lamp
    _g("magazine")
    D.seg(h, (-0.78, -0.44, 0.52), (-0.78, 0.44, 0.52), 0.21, "steelD", 18, cap="steel", capstart="steel")
    for dv in (-0.3, -0.1, 0.1, 0.3):
        D.seg(h, (-0.78, dv - 0.03, 0.52), (-0.78, dv + 0.03, 0.52), 0.23, "steel", 18, cap="steelL", capstart="steelL")
    for su in (-1, 1):
        h.box(-0.78 + su * 0.12, 0, 0.29, 0.06, 0.8, 0.1, "steelD", top="steel")                # drum cradle
    _g("chute")
    for k in range(5):                                                                        # feed chute
        t = (k + 0.5) / 5
        u, z = -0.66 + 0.36 * t, 0.66 + (BZ - 0.36 - 0.66) * math.sin(t * math.pi / 2)
        h.box(u, 0, z, 0.1, 0.26, 0.1, "steelL" if k % 2 else "steel", top="plate")
    g = rig.f("gun")
    _g("trunnion")
    D.seg(g, (PU, -0.82, BZ), (PU, 0.82, BZ), 0.13, "steelL", 14, cap="plate", capstart="plate")
    _g("box")
    u0, u1, hw, zb, zt = -0.7, 0.62, 0.52, BZ - 0.36, BZ + 0.4
    _uz(g, [(u0, zb), (u0, zt - 0.1), (u0 + 0.12, zt), (u1 - 0.32, zt), (u1, zt - 0.16), (u1, zb)],
        -hw, hw, "steel", "steelL")                                                            # launcher, glacis
    for sv in (-1, 1):                                                                        # side armour panels
        _uz(g, [(u0 + 0.08, zb + 0.05), (u0 + 0.08, zt - 0.12), (u1 - 0.36, zt - 0.06), (u1 - 0.06, zt - 0.2),
                (u1 - 0.06, zb + 0.05)], sv * hw, sv * (hw + 0.04), "steelL", "plate")
        for u in (-0.42, 0.0):
            g.box(u, sv * (hw + 0.05), zb + 0.08, 0.05, 0.02, zt - zb - 0.24, "steelL", top="plate")   # ribs
    gl = math.atan2(0.16, 0.32)
    g.box(u1 - 0.24, 0, zt - 0.03, 0.05, 0.72, 0.014, G(hot, col), pitch=-gl, pu=u1 - 0.24, pz=zt - 0.03, base=False)
    g.box(u0 + 0.5, 0, zt, 0.42, 0.5, 0.025, "steel", top="steelL")                            # top hatch
    for dv in (-0.16, 0.16):
        g.box(u0 + 0.5, dv, zt + 0.025, 0.2, 0.03, 0.03, "steelL", top="plate")                # hatch handles
    cmbkit.hazard_strip(g, u0 + 0.18, u0 + 0.78, 0.36, zt, step=0.1, w=0.05, h=0.012)
    _g("sensor")
    g.hcyl(u0 + 0.36, u1 - 0.28, -0.36, zt + 0.08, 0.075, "steel", sides=12, cap="lens", capstart="steelL")
    g.box(u0 + 0.6, -0.36, zt, 0.12, 0.06, 0.04, "steelD", top="steel")
    _g("tubes")
    g.box(u1 + 0.01, 0, zb + 0.03, 0.02, 2 * hw - 0.1, zt - zb - 0.22, "dark", top="dark")      # recessed tube face
    for v in (-0.33, 0.0, 0.33):
        for dz in (-0.17, 0.17):
            z = BZ - 0.04 + dz
            g.hcyl(u1, u1 + 0.12, v, z, 0.135, "steel", sides=18, cap="steelL")                 # tube collar
            D.annulus(g, u1 + 0.12, u1 + 0.15, v, z, 0.135, 0.095, "steelL", G(hot, col), sides=18)   # lit rim
            g.hcyl(u1 + 0.06, u1 + 0.13, v, z, 0.095, "dark", sides=16, cap="dark")             # bore
            if hot:
                g.hcyl(u1 + 0.09, u1 + 0.15, v, z, 0.06, "medRed", r1=0.02, sides=12)          # warhead nose
    _g("rear")
    for k in range(5):                                                                        # backblast louvres
        g.box(u0 - 0.012, 0, zb + 0.08 + k * 0.1, 0.02, 2 * hw - 0.2, 0.04, "dark")
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


def _crates(f, u, v):
    """Warhead crates: two stacked steel cases with red bands and hazard labels, a third across the top."""
    _g("crates")
    for z, du, sz in ((0.0, 0.0, 0.3), (0.3, 0.02, 0.26)):
        f.box(u + du, v, z, 0.5, 0.38, sz, "gm", top="steelL")
        f.box(u + du, v, z + sz * 0.45, 0.51, 0.39, 0.05, "medRed", top="medRed")
        for dv in (-0.15, 0.15):
            f.box(u + du + 0.255, v + dv, z + 0.04, 0.012, 0.04, sz - 0.08, "steelD", top="steelD")
    f.box(u - 0.04, v, 0.56, 0.24, 0.42, 0.16, "steel", top="plate")
    f.box(u + 0.085, v, 0.6, 0.006, 0.18, 0.08, "hazY", top="hazY")


def bay_missile(rot=0):
    """3x3: the column; an open hoist tower beside it (four posts and cross-ties round a rail, a missile riding up on its
    cradle, a feed arm over to the column top); two missile racks along the back; a loader cart; warhead crates."""
    m = core.Mesh("bay_missile")
    f = Frame(m, (1 + rot) % 4, square=True)
    TB._floor(-1.5, 1.5)
    TB._column(f, 0.3)
    _g("hoist")
    hu, top = 0.68, TC.ZR - 0.06
    f.box(hu, 0, 0, 0.5, 0.5, 0.08, "steelD", top="steel")
    for du in (-0.2, 0.2):
        for dv in (-0.2, 0.2):
            f.box(hu + du, dv, 0.08, 0.06, 0.06, top - 0.08, "steel", top="steelL")             # posts
    for z in (0.75, 1.45):
        for du in (-0.2, 0.2):
            f.box(hu + du, 0, z, 0.06, 0.46, 0.05, "steelD", top="steel")                      # cross-ties
        for dv in (-0.2, 0.2):
            f.box(hu, dv, z, 0.46, 0.06, 0.05, "steelD", top="steel")
    f.box(hu, 0, top - 0.06, 0.52, 0.52, 0.08, "steelD", top="steel")                          # head frame
    f.box(hu + 0.17, 0, 0.08, 0.04, 0.08, top - 0.16, "steelL", top="plate")                    # guide rail
    f.box(hu + 0.08, 0, 0.5, 0.14, 0.26, 0.05, "steel", top="steelL")                          # cradle
    _missile_body(f, hu, 0, 0.55, ln=0.95, axis="z")
    D.rail(f, (hu - 0.26, 0, top - 0.02), (0.36, 0, top - 0.02), 0.08, "steel")                # feed arm
    _rack(f, -0.95, -1.05)
    _rack(f, -0.95, 1.05, n=2)
    _g("cart")
    f.box(0.95, -1.08, 0.08, 0.7, 0.34, 0.12, "steel", top="steelL")
    for du in (-0.26, 0.26):
        for dv in (-0.14, 0.14):
            f.vcyl(0.95 + du, -1.08 + dv, 0, 0.05, 0.08, "dark", top="steelD", sides=10)
    f.box(0.6, -1.08, 0.2, 0.04, 0.3, 0.3, "steelD", top="steel")                              # push bar
    _missile_body(f, 0.95, -1.08, 0.3)
    _crates(f, 1.0, 1.02)
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


def _transformer(f, u, v):
    """Ion bay: a squat ribbed power transformer with three stacked insulator posts and a feed cable to the column."""
    _g("transformer")
    f.box(u, v, 0, 0.46, 0.46, 0.06, "steelD", top="steel")
    f.box(u, v, 0.06, 0.34, 0.34, 0.46, "steelD", top="steel")
    for k in range(4):
        d = -0.12 + k * 0.08
        for su, sv in ((1, 0), (0, 1)):
            f.box(u + su * 0.18 + (1 - su) * d, v + sv * 0.18 + (1 - sv) * d, 0.1, 0.03 if su else 0.04,
                  0.04 if su else 0.03, 0.36, "steel", top="steelL")
    for dv in (-0.1, 0.0, 0.1):
        for k in range(3):
            f.vcyl(u - 0.06 + abs(dv) * 0.6, v + dv, 0.52 + k * 0.06, 0.045 - k * 0.006, 0.04, "plate", top="steelL",
                   sides=10)
    D.seg(f, (u - 0.17, v - 0.1, 0.4), (0.14, 0.14, 0.9), 0.035, "gm", 8)


def _bottles(f, u, v):
    """Incendiary bay: fire-suppression bottles, three red cylinders with domed tops and valve heads, strapped."""
    _g("bottles")
    f.box(u, v, 0, 0.42, 0.42, 0.05, "steelD", top="steel")
    for du, dv in ((-0.09, -0.09), (0.09, -0.09), (0.0, 0.1)):
        f.vcyl(u + du, v + dv, 0.05, 0.085, 0.62, "medRed", sides=14, top="medRed")
        f.vcyl(u + du, v + dv, 0.67, 0.085, 0.06, "medRed", rtop=0.04, sides=14)
        f.vcyl(u + du, v + dv, 0.73, 0.03, 0.06, "steelL", top="plate", sides=8)
    for z in (0.2, 0.5):
        f.box(u, v, z, 0.36, 0.36, 0.04, "steel", top="steelL", taper=1.0)


def small_bay(kind, rot=0):
    """2x2 ion / incendiary bay, u, v in -1..1: the slim full-height column, gear in three corners."""
    m = core.Mesh(f"bay_{kind}")
    f = Frame(m, (1 + rot) % 4, square=True)
    TB._floor(-1.0, 1.0)
    TB._column(f, 0.2)
    if kind == "ion":
        _transformer(f, 0.66, 0.66)
        coil_tower(f, -0.62, 0.62)
        TB._caps(f, ((0.68, -0.62),), r=0.16, h=0.8)
    else:
        _bottles(f, 0.66, 0.66)
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
