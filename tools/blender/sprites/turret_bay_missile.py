"""Missile launcher bay (3x3): a tank-style autoloader, the launch tube an open cage in a rotating floor carousel.

  platform  the whole assembly's own plinth, a hazard-striped edge
  bearing   a slewing ring on the platform (fixed lower race, a dark seam, the carousel's upper race)
  carousel  sixteen bays round the tube's foot, fifteen cassettes lying radially in them (each round nose out, on a
            trough with an end plate and a strap), a rib between bays; a support track, an inner ring, a bolted outer
            rim, a ring gear round the rim (a grey body, lighter tapered teeth) meshed with a pinion from a finned
            motor out on the platform
  cage      the bore: eight box-section longerons between four hoops, X-braces in the back bays; the bay facing the
            loader is left open (the hoops cut there) for the tray; a sled carries a round up inside it
  loader    at the front-right 45: a tray on two arms from a trunnion bolted to the cage's foot, swung by a crank and a
            long cylinder hung from a bracket over the bay (shown half way up, a round on it); down, the tray lies in
            the empty, striped bay; up, it stands in the open bay and its chain rammer (under it) pushes the round in
  top       the ram collar, the neck and the roof collar are rings: the bore is open all the way out of the roof

Frame and FRONT as turret_bay_laser (u = grid +x, v = grid +y, origin = footprint centre at floor level)."""
import math

from mathutils import Vector

from . import cmbkit, core, detail as D
from . import turret_bay_laser as L
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
P, obox, FRONT, TOP = L.P, L.obox, L.FRONT, L.TOP
Z = Vector((0, 0, 1))
ZC = TOP - 0.42                      # the ram collar's underside
HOLE = 0.3                           # the bore out of the top
TR, TI = 0.4, 0.33                   # the cage's outer and inner radius
RO, NC = 1.1, 16                     # the carousel's rim radius, its bays
PR = 1.42                            # the platform's radius
LA = FRONT - math.pi / 4             # the loader's station
CS = -1                              # the crank's side of the tray (off the front)
RINGS = ((0.24, 0.42), (0.86, 0.94), (1.3, 1.4), (ZC - 0.1, ZC))          # the cage's hoops (z0, z1)
ZC0, ZC1 = 0.2, 0.26                 # the carousel's floor
GZ0, GZ1 = 0.25, 0.34                # the ring gear


def adiff(a, b):
    return abs((a - b + math.pi) % math.tau - math.pi)


def E(a):
    return Vector((math.cos(a), math.sin(a), 0))


@cmbkit.prim
def frustum(f, a, b, r0, r1, mat, sides=16, cap=None, capstart=None):
    """A cylinder or cone between any two points (radius r0 at a, r1 at b)."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    e1 = d.cross(Z if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    e2 = d.cross(e1)

    def ring(c, r):
        return [f.pt(*(c + r * (math.cos(i * math.tau / sides) * e1 + math.sin(i * math.tau / sides) * e2)))
                for i in range(sides)]
    A, B = ring(a, r0), ring(b, max(r1, 0.004))
    for i in range(sides):
        j = (i + 1) % sides
        f.poly([A[i], A[j], B[j], B[i]], mat, flip=True)
    if cap:
        f.poly(B[::-1], cap, flip=True)
    if capstart:
        f.poly(A, capstart, flip=True)


def beam(f, p, q, nrm, hw, hh, mat):
    """A box from p to q, half width hw along nrm (across), half height hh along the third axis."""
    p, q = Vector(p), Vector(q)
    ex = (q - p).normalized()
    ey = (Vector(nrm) - ex * Vector(nrm).dot(ex)).normalized()
    ez = ex.cross(ey)
    c, hx = (p + q) / 2, (q - p).length / 2
    D.loft_box(f, lambda a, b, d: tuple(c + ex * a * hx + ey * b * hw + ez * d * hh), mat)


@cmbkit.prim
def hoop(f, ro, ri, z0, z1, mat, top=None, a0=0.0, a1=math.tau, n=96):
    """A ring (or an arc of one, capped at its ends) as one continuous mesh, so no internal faces fight."""
    full = abs(a1 - a0 - math.tau) < 1e-6
    m = max(4, int(n * (a1 - a0) / math.tau))
    A = [a0 + (a1 - a0) * k / m for k in range(m + 1)]

    def Q(r, z, a):
        return f.pt(r * math.cos(a), r * math.sin(a), z)
    for k in range(m):
        p, q = A[k], A[k + 1]
        f.poly([Q(ro, z0, p), Q(ro, z0, q), Q(ro, z1, q), Q(ro, z1, p)], mat, flip=True)
        f.poly([Q(ri, z0, q), Q(ri, z0, p), Q(ri, z1, p), Q(ri, z1, q)], mat, flip=True)
        f.poly([Q(ri, z1, p), Q(ri, z1, q), Q(ro, z1, q), Q(ro, z1, p)], top or mat, flip=True)
        f.poly([Q(ro, z0, p), Q(ri, z0, p), Q(ri, z0, q), Q(ro, z0, q)], mat, flip=True)
    if not full:
        f.poly([Q(ri, z0, a0), Q(ro, z0, a0), Q(ro, z1, a0), Q(ri, z1, a0)], mat, flip=True)
        f.poly([Q(ro, z0, a1), Q(ri, z0, a1), Q(ri, z1, a1), Q(ro, z1, a1)], mat, flip=True)


def missile_v(f, u, v, z, ln, r):
    """A round standing at (u, v) from z: white body, a red tail band, a dark mid band, a red nose."""
    _g("missile")
    f.vcyl(u, v, z - 0.03, r * 0.7, 0.03, "steelD", sides=12)
    f.vcyl(u, v, z, r, ln - 0.2, "plate", top="plate", sides=16)
    f.vcyl(u, v, z + ln - 0.2, r, 0.2, "medRed", rtop=0.015, sides=16)
    f.vcyl(u, v, z + ln - 0.215, r + 0.005, 0.02, "steelL", sides=16)
    f.vcyl(u, v, z + 0.1, r + 0.006, 0.04, "medRed", sides=16)
    f.vcyl(u, v, z + (ln - 0.2) * 0.55, r + 0.004, 0.025, "steelD", sides=16)


def missile_d(f, p, d, ln, r):
    """A round lying along d, its tail at p."""
    _g("missile")
    p, d = Vector(p), Vector(d).normalized()
    b = ln - min(0.2, ln * 0.28)
    frustum(f, p - d * 0.03, p, r * 0.7, r * 0.7, "steelD", 12, capstart="steelD")
    frustum(f, p, p + d * b, r, r, "plate", 16)
    frustum(f, p + d * 0.1, p + d * 0.14, r + 0.006, r + 0.006, "medRed", 16)
    frustum(f, p + d * b, p + d * ln, r, 0.015, "medRed", 16)


def lift(f, fl=0.64, collar_r=0.62, roof_r=0.48):
    """The base flange, the ram collar, the neck and the roof collar, all open round the bore."""
    _g("lift")
    f.vcyl(0, 0, 0, fl, 0.14, "gm", top="steel", sides=40)
    f.vcyl(0, 0, 0.14, fl - 0.12, 0.1, "steelD", top="steel", sides=36)
    for k in range(16):
        f.vcyl(*P((k + 0.5) * math.tau / 16, fl - 0.06), 0.14, 0.028, 0.035, "steelL", top="plate", sides=6)
    TC.vannulus(f, collar_r, HOLE, ZC, ZC + 0.09, "steel", "steelL", sides=40)
    TC.vannulus(f, collar_r + 0.005, HOLE, ZC - 0.025, ZC, "steelD", "steelD", sides=40)
    for k in range(16):
        f.vcyl(*P((k + 0.5) * math.tau / 16, collar_r - 0.05), ZC + 0.09, 0.02, 0.022, "steelL", top="plate", sides=6)
    TC.vannulus(f, roof_r, HOLE, TOP - 0.12, TOP, "steelL", "steel", sides=36)
    TC.vannulus(f, roof_r - 0.1, HOLE, TOP, TOP + 0.025, "steel", "steelL", sides=36)     # the bore's lip, open
    _g("neck")
    TC.vannulus(f, TR - 0.02, HOLE, ZC + 0.09, TOP - 0.12, "steel", "steel", sides=36)
    TC.vannulus(f, HOLE + 0.012, HOLE - 0.002, ZC - 0.3, TOP + 0.02, "gm", "gm", sides=36)     # the bore's dark liner
    TC.vannulus(f, TR + 0.01, TR - 0.03, ZC + 0.2, ZC + 0.24, "steelD", "steel", sides=36)


def cage(f):
    _g("cage")
    posts = [FRONT + math.pi / 8 + k * math.pi / 4 for k in range(8)]
    g, gz0, gz1 = math.pi / 8 - 0.02, 0.42, 1.3                                           # the loader's open bay
    for z0, z1 in RINGS:
        cut = dict(a0=LA + g, a1=LA - g + math.tau) if z1 > gz0 + 1e-6 and z0 < gz1 - 1e-6 else {}
        hoop(f, TR + 0.02, TI - 0.005, z0, z1, "steel", "steelL", **cut)
    for a in posts:
        obox(f, a, TI - 0.012, TR + 0.03, 0.036, 0.24, ZC, "steel", "steelL")             # longerons
    for a in posts:                                                                       # X-braces, back bays only
        b = a + math.pi / 4
        if adiff(a + math.pi / 8, FRONT + math.pi) > 1.0:
            continue
        for za, zb in ((RINGS[0][1], RINGS[1][0]), (RINGS[1][1], RINGS[2][0])):
            for p0, p1 in (((a, za), (b, zb)), ((a, zb), (b, za))):
                D.rail(f, (*P(p0[0], TR - 0.01), p0[1]), (*P(p1[0], TR - 0.01), p1[1]), 0.016, "steelD")
    _g("sled")                                                                            # a round going up the bore
    z = 0.66
    f.vcyl(0, 0, z, 0.22, 0.05, "steel", top="steelL", sides=24)
    f.vcyl(0, 0, z - 0.04, 0.12, 0.04, "steelD", sides=16)
    missile_v(f, 0, 0, 0.72, 0.86, 0.1)


def platform(f):
    _g("platform")
    f.vcyl(0, 0, 0.0, PR + 0.02, 0.03, "steelD", top="steelD", sides=96)
    f.vcyl(0, 0, 0.03, PR, 0.05, "gm", top="steel", sides=96)
    for k in range(48):
        c = "hazY" if k % 2 == 0 else "hazK"
        a0, a1 = k * math.tau / 48, (k + 1) * math.tau / 48
        TB.prism(f, [P(a0, PR - 0.07), P(a0, PR - 0.01), P(a1, PR - 0.01), P(a1, PR - 0.07)], 0.08, 0.084, c, top=c)
    _g("bearing")
    hoop(f, RO + 0.03, 0.74, 0.08, 0.13, "steel", "steelL")                               # fixed lower race
    hoop(f, RO + 0.0, 0.755, 0.13, 0.15, "dark", "dark")                                  # the seam
    hoop(f, RO + 0.01, 0.74, 0.15, ZC0, "steel", "steel")                                 # upper race, under the gear


def cassette(f, a, r0, r1, z):
    """A cassette lying radially at angle a: a trough with an end plate, a strap over the round, the round nose out."""
    _g("cassette")
    obox(f, a, r0, r1, 0.07, z, z + 0.02, "steelD", "steel")
    for sd in (-0.07, 0.07):
        obox(f, a, r0, r1, 0.011, z, z + 0.075, "steel", "steelL", off=sd)
    obox(f, a, r0, r0 + 0.03, 0.08, z, z + 0.18, "steelD", "steel")                      # inner end plate
    obox(f, a, r1 - 0.11, r1 - 0.085, 0.08, z, z + 0.11, "steelD", "steel")              # nose saddle
    p = Vector((*P(a, r0 + 0.03), z + 0.09))
    missile_d(f, p, E(a), r1 - r0 - 0.04, 0.068)
    q = p + E(a) * 0.2
    frustum(f, q, q + E(a) * 0.03, 0.077, 0.077, "steelD", 14, cap="steel", capstart="steel")   # strap


def carousel(f):
    _g("carousel")
    TC.vannulus(f, RO + 0.04, 0.46, ZC0, ZC1, "gm", "steelD", sides=64)
    TC.vannulus(f, 0.8, 0.76, ZC1, ZC1 + 0.025, "steel", "steelL", sides=64)                # support track
    TC.vannulus(f, 0.52, 0.45, ZC1, 0.38, "steel", "steelL", sides=48)                     # inner ring
    TC.vannulus(f, 0.53, 0.44, 0.3, 0.33, "steelD", "steelD", sides=48)
    TC.vannulus(f, RO + 0.04, RO - 0.01, ZC1, 0.4, "steel", "steelL", sides=64)            # outer rim
    TC.vannulus(f, RO + 0.045, RO - 0.015, 0.31, 0.34, "steelD", "steelD", sides=64)
    for k in range(32):
        f.vcyl(*P((k + 0.5) * math.tau / 32, RO + 0.015), 0.4, 0.013, 0.015, "steelL", sides=6)
    _g("ringgear")
    hoop(f, RO + 0.072, RO + 0.02, GZ0, GZ1, "steelL", "steelL")                          # its body
    for k in range(72):                                                                   # tapered teeth
        a = (k + 0.5) * math.tau / 72
        ca, sa = math.cos(a), math.sin(a)
        pts = [(ca * r - sa * o, sa * r + ca * o) for r, o in
               ((RO + 0.05, -0.017), (RO + 0.095, -0.009), (RO + 0.095, 0.009), (RO + 0.05, 0.017))]
        TB.prism(f, pts, GZ0, GZ1, "plate", top="plate")
    for k in range(NC):
        a = LA + k * math.tau / NC
        obox(f, a + math.pi / NC, 0.52, RO, 0.012, ZC1, ZC1 + 0.06, "steelD", "steel")     # a rib between bays
        if k:
            cassette(f, a, 0.53, RO - 0.02, ZC1 + 0.025)
    for k in range(5):                                                                    # the empty bay's stripes
        c = "hazY" if k % 2 == 0 else "hazK"
        obox(f, LA, 0.62 + k * 0.08, 0.7 + k * 0.08, 0.11, ZC1, ZC1 + 0.005, c, c)
    _g("drive")
    a = FRONT + 0.9
    u, v = P(a, RO + 0.245)                                                               # motor, out on the platform
    f.vcyl(u, v, 0.08, 0.09, 0.05, "gm", top="steel", sides=16)
    f.vcyl(u, v, 0.13, 0.07, 0.3, "steelD", top="steel", sides=16)
    for k in range(8):
        b = (k + 0.5) * math.tau / 8
        f.box(u + 0.072 * math.cos(b), v + 0.072 * math.sin(b), 0.16, 0.02, 0.02, 0.22, "steel", top="steelL")
    obox(f, a, RO + 0.09, RO + 0.31, 0.065, 0.36, 0.43, "steel", "steelL")               # gearbox over to the pinion
    u, v = P(a, RO + 0.14)
    f.vcyl(u, v, GZ0 - 0.01, 0.045, GZ1 - GZ0 + 0.02, "gm", top="steelL", sides=14)       # pinion, meshed
    for k in range(10):
        b = k * math.tau / 10
        f.box(u + 0.05 * math.cos(b), v + 0.05 * math.sin(b), GZ0, 0.022, 0.022, GZ1 - GZ0, "steelL", top="plate")
    f.vcyl(u, v, GZ1 + 0.01, 0.025, 0.36 - GZ1 - 0.01, "steel", sides=10)                 # its shaft


def loader(f, deg=55):
    e, t = E(LA), E(LA + math.pi / 2)
    pv = e * 0.47 + Z * 0.52                                                              # the trunnion axis

    def rot(du, dz, ph):                                                                  # an (e, z) offset turned by ph
        c, sn = math.cos(ph), math.sin(ph)
        return e * (du * c - dz * sn) + Z * (du * sn + dz * c)
    ph = math.radians(deg)
    _g("trunnion")
    for sd in (-0.135, 0.135):                                                            # bearing blocks on the cage
        obox(f, LA + math.atan2(sd, 0.45), TR - 0.01, 0.53, 0.035, 0.42, 0.61, "steelD", "steel")
        f.vcyl(*(pv + t * sd).xy, 0.61, 0.025, 0.012, "steelL", sides=6)
    frustum(f, pv - t * 0.21, pv + t * 0.21, 0.035, 0.035, "steelL", 12, cap="steel", capstart="steel")   # shaft
    _g("tray")
    d = rot(1, 0, ph)
    nz = rot(0, 1, ph)                                                                    # the tray's top face
    h = pv + rot(0.06, -0.13, ph)                                                         # its inner end
    ln = 0.56
    for sd in (-0.095, 0.095):
        beam(f, pv + t * sd, h + t * sd, t, 0.016, 0.03, "steel")                         # the arms
        beam(f, h + t * sd, h + d * ln + t * sd, t, 0.015, 0.024, "steelD")               # the tray's rails
    for fr in (0.0, 1.0):
        q = h + d * fr * (ln - 0.03)
        beam(f, q - t * 0.11, q + t * 0.11, d, 0.025, 0.024, "steel")                     # cross ties
    m0 = h + d * 0.06 + nz * 0.085
    missile_d(f, m0, d, ln - 0.08, 0.068)
    for fr in (0.3, 0.75):                                                                # saddle rings on arms
        q = m0 + d * fr * ln
        frustum(f, q - d * 0.02, q + d * 0.02, 0.08, 0.08, "steel", 16, cap="steelL", capstart="steelD")
        for sd in (-1, 1):
            beam(f, h + d * fr * ln + t * sd * 0.095, q + t * sd * 0.07, d, 0.013, 0.013, "steel")
    _g("rammer")                                                                          # under the tray
    rb = -nz * 0.04
    beam(f, h + rb, h + d * (ln - 0.05) + rb, t, 0.06, 0.022, "gm")
    for k in range(8):                                                                    # the chain in its slot
        q = h + rb - nz * 0.023 + d * (0.05 + k * 0.058)
        beam(f, q, q + d * 0.03, t, 0.02, 0.006, "steelL" if k % 2 else "steelD")
    beam(f, h - d * 0.02 + rb, h + d * 0.07 + rb, t, 0.075, 0.045, "steelD")              # sprocket box
    frustum(f, h + rb - nz * 0.05 - t * 0.09, h + rb - nz * 0.05 + t * 0.09, 0.04, 0.04, "gm", 14, cap="steelL",
            capstart="steelL")                                                            # its motor
    _g("crank")                                                                           # on the shaft's end, pulled by
    lt = pv + t * CS * 0.2 + rot(0.15, 0, ph - math.radians(80))                          # a cylinder hung from a
    beam(f, pv + t * CS * 0.2, lt, t, 0.03, 0.02, "steel")                                # bracket over the bay
    frustum(f, lt - t * 0.03, lt + t * 0.03, 0.03, 0.03, "steelL", 10, cap="steel", capstart="steel")
    an = e * 0.5 + t * CS * 0.2 + Z * 1.4
    obox(f, LA + math.atan2(CS * 0.2, 0.45), TR - 0.01, 0.56, 0.04, 1.34, 1.46, "steelD", "steel")
    m = an + (lt - an) * 0.5
    frustum(f, an, m, 0.042, 0.042, "steelD", 12, cap="steel", capstart="steel")
    frustum(f, an + (m - an) * 0.85, m, 0.047, 0.047, "steel", 12)
    frustum(f, m, lt, 0.022, 0.022, "steelL", 10, cap="steelL")


def bay_missile(rot=0):
    """Built the same way round for every rotation, as the laser bay (turret_bay_laser.bay_laser)."""
    m = core.Mesh("bay_missile")
    f = Frame(m, 1, square=True)
    TB._floor(-1.5, 1.5)
    lift(f)
    cage(f)
    platform(f)
    carousel(f)
    loader(f)
    return [m.build()] if cmbkit.REC is None else []


TB.BAYS["missile"] = bay_missile
