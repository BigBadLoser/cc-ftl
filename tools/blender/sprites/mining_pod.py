"""The MINING POD (vehicle.mining_pod): a one-seat ball of a miner that sits in a 3x3 bay. Ore rides inside it.

Local frame as shuttle_craft (u = nose, v across, z up, origin at the footprint centre on the pad; `Spin(heading)`).
Shape: a sphere girded by a thick equatorial belt, a visor canopy wrapped over its upper front, a hatch on each flank
(framed door, hinges, lever), armour bands and a docking collar on top, one big thruster bell underneath in a housing,
a mining laser on a chin mount under the canopy, four manoeuvring thrusters on the belt and four legs splayed round the
bell. Warm dark steel (c4F), industrial yellow accents (c4T).

States: parked / docked (legs down, laser stowed, thrusters dark), fly (legs folded, thrusters lit), mine (legs folded,
laser lowered, emitter lit; `bob` lifts it for the hover loop)."""
import math

from . import core
from .shuttle_bay import lbox
from .shuttle_craft import Spin, _g, patch, profile, smooth, sweep

R = 0.8                       # the sphere's radius
C = 1.36                      # its centre above the pad (legs down)
BELT_H = 0.16                 # the equatorial belt's height
BELL = (0.22, 0.42, 0.28)     # the main thruster: mouth z, mouth radius, throat radius (its top meets the housing)
LEG_FOOT, LEG_TOP = 0.98, (0.62, C - 0.5)   # leg foot radius from the centre; strut top (radius, z) on the hull
LASER_U, LASER_Z = 0.5, C - 0.6
HULL, HULL_D, HULL_L = "c4F2", "c4F4", "c4F1"
YEL, YEL_D = "c4T2", "c4T4"
GLOW = "cyan"
BEAM = "orange"
N = 16                        # stations along the sphere


def ball(k=1.0):
    """The sphere as swept stations (u, half width, half height, v, z), scaled by k."""
    us = [R * math.cos(math.pi * (1 - (i + 0.5) / N)) for i in range(N)]
    return [(u, k * math.sqrt(max(R * R - u * u, 1e-4)), k * math.sqrt(max(R * R - u * u, 1e-4)), 0, C) for u in us]


SECTION = profile(n=24, p=2.0)


def strut(f, p0, p1, w, mat, top=None):
    """A square bar from p0 to p1 (u, v, z), w thick."""
    d = [b - a for a, b in zip(p0, p1)]
    n = math.sqrt(sum(x * x for x in d))
    d = [x / n for x in d]
    side = [-d[1], d[0], 0.0]
    sl = math.hypot(side[0], side[1]) or 1.0
    side = [x / sl for x in side]
    up = [d[1] * side[2] - d[2] * side[1], d[2] * side[0] - d[0] * side[2], d[0] * side[1] - d[1] * side[0]]

    def corner(a, b, c):
        q = p0 if b < 0 else p1
        return tuple(q[i] + side[i] * a * w / 2 + up[i] * c * w / 2 for i in range(3))
    lbox(f, corner, {"side": mat, "top": top or mat})


def body(f):
    _g("hull")
    B = ball()
    sweep(f, B, SECTION, HULL, cap0=HULL, cap1=HULL)
    patch(f, B, -0.7, 0.7, 205, 335, 1.006, HULL_D, n=9, steps=8)            # the darker underside
    _g("plates")
    patch(f, B, -0.6, 0.2, 62, 118, 1.03, HULL_L, n=7, steps=5)               # dorsal armour plate (aft of the canopy)
    for u0, u1 in ((-0.22, -0.12), (0.02, 0.1)):
        patch(f, B, u0, u1, 58, 122, 1.045, YEL, n=7, steps=1)               # its two yellow bands
    _g("belt")
    f.vcyl(0, 0, C - BELT_H / 2, R + 0.05, BELT_H, HULL_D, top=HULL_D, sides=32)
    f.vcyl(0, 0, C + BELT_H / 2 - 0.035, R + 0.06, 0.035, HULL_L, top=HULL_L, sides=32)   # its lit upper lip
    for k in range(4):                                                       # four yellow segments, between the thrusters
        a0 = k * math.tau / 4 - 0.38
        for j in range(5):
            a = a0 + j * 0.19
            f.box((R + 0.058) * math.cos(a), (R + 0.058) * math.sin(a), C - 0.01, 0.17, 0.17, 0.07, YEL, base=False)
    _g("collar")                                                             # the docking collar on top
    f.vcyl(-0.12, 0, C + R - 0.1, 0.28, 0.12, HULL_D, top=HULL, sides=20)
    f.vcyl(-0.12, 0, C + R + 0.02, 0.18, 0.03, "steelD", top="steelD", sides=20)
    for k in range(6):
        a = k * math.tau / 6
        f.box(-0.12 + 0.23 * math.cos(a), 0.23 * math.sin(a), C + R + 0.02, 0.05, 0.05, 0.03, "steelL")


def canopy(f):
    """The visor canopy wrapped over the sphere's upper front: a heavy frame, dark glass with one reflection band and a
    centre mullion."""
    _g("canopy")
    B = ball()
    patch(f, B, 0.3, 0.79, 22, 158, 1.02, "steelD", n=15, steps=6)        # frame
    patch(f, B, 0.36, 0.78, 30, 150, 1.035, "glassD", n=15, steps=6)        # glass
    patch(f, B, 0.5, 0.58, 38, 142, 1.045, "lens", n=13, steps=2)          # reflection
    patch(f, B, 0.36, 0.78, 87, 93, 1.05, "steelD", n=3, steps=6)           # mullion


def hatch(f):
    """A hatch on each flank: a raised frame, a solid door, two hinges on its aft edge and a yellow lever."""
    _g("hatch")
    for sv in (-1, 1):
        t0, t1 = (-24, 24) if sv > 0 else (156, 204)            # profile angle 0 is +v
        B = ball()
        patch(f, B, -0.38, 0.1, t0, t1, 1.03, HULL_D, n=7, steps=4)          # the frame
        patch(f, B, -0.33, 0.05, t0 + 5, t1 - 5, 1.045, HULL_L, n=7, steps=4)   # the door
        patch(f, B, -0.33, 0.05, t0 + 5, t0 + 8, 1.05, "hazK", n=2, steps=4)    # its seal line, lower edge
        v = sv * math.sqrt(R * R - 0.36 ** 2) * 1.05
        for dz in (-0.15, 0.15):
            f.vcyl(-0.36, v, C + dz - 0.05, 0.035, 0.1, "steelL", sides=8)   # hinges
        f.box(0.0, sv * R * 1.07, C, 0.05, 0.04, 0.18, YEL, base=False)      # lever
        f.box(0.0, sv * R * 1.08, C + 0.08, 0.1, 0.04, 0.04, YEL, base=False)


def thruster(f, lit):
    """The big main thruster under the sphere: a housing, a flared bell, a glowing lip when lit."""
    _g("thruster")
    zm, rm, rt = BELL
    zh = C - R + 0.1                                                         # the housing's top, inside the hull
    f.vcyl(0, 0, zm + 0.2, rt + 0.1, zh - zm - 0.2, HULL_D, top=HULL_D, sides=20)    # housing
    f.vcyl(0, 0, zm + 0.17, rt + 0.13, 0.05, "steelD", top="steelD", sides=20)       # its ring
    f.vcyl(0, 0, zm, rm, 0.2, "steelD", top="steelD", rtop=rt, sides=20)              # the bell
    f.vcyl(0, 0, zm, rm + 0.01, 0.03, GLOW if lit else "steel", top=GLOW if lit else "steel", sides=20)  # its lip
    for k in range(4):                                                       # gimbal struts
        a = k * math.tau / 4 + math.pi / 4
        strut(f, ((rt + 0.12) * math.cos(a), (rt + 0.12) * math.sin(a), zm + 0.22),
              ((rt - 0.02) * math.cos(a), (rt - 0.02) * math.sin(a), zm + 0.1), 0.04, "steelL")


def rcs(f, lit):
    _g("rcs")
    for k in range(4):
        a = k * math.tau / 4 + math.pi / 4
        u, v = (R + 0.1) * math.cos(a), (R + 0.1) * math.sin(a)
        f.box(u, v, C - 0.12, 0.16, 0.16, 0.24, HULL_D, top=HULL)
        for dz in (-1, 1):                                                   # nozzles up and down
            f.vcyl(u, v, C + (0.12 if dz > 0 else -0.18), 0.045, 0.06, "steelD",
                   top=GLOW if lit and dz > 0 else "steelD", sides=8)
        f.box(u + 0.085 * math.cos(a), v + 0.085 * math.sin(a), C, 0.06, 0.06, 0.06, GLOW if lit else "dark", base=False)


def laser(f, down, lit):
    """The mining laser on a chin mount under the canopy: level when stowed, tipped forward and down when mining."""
    _g("laser")
    f.box(LASER_U - 0.08, 0, LASER_Z - 0.06, 0.3, 0.28, 0.16, HULL_D, top=HULL)
    f.hcyl(LASER_U - 0.05, LASER_U + 0.05, 0, LASER_Z, 0.1, YEL_D, sides=10, cap=YEL_D, capstart=YEL_D)
    kw = dict(pitch=math.radians(-55 if down else -6), pu=LASER_U, pz=LASER_Z)
    f.hcyl(LASER_U, LASER_U + 0.36, 0, LASER_Z, 0.07, "steel", r1=0.055, sides=10, **kw)
    for a in range(3):
        t = a * math.tau / 3 + math.pi / 2
        f.box(LASER_U + 0.25, 0.06 * math.cos(t), LASER_Z + 0.06 * math.sin(t), 0.13, 0.03, 0.03, YEL_D, base=False, **kw)
    f.hcyl(LASER_U + 0.36, LASER_U + 0.41, 0, LASER_Z, 0.055, "steelD", r1=0.075, sides=10, cap=BEAM if lit else "dark", **kw)


def legs(f, down):
    """Four legs splayed round the bell; folded, they lie up against the hull."""
    _g("legs")
    for k in range(4):
        a = k * math.tau / 4
        ca, sa = math.cos(a), math.sin(a)
        rt, zt = LEG_TOP
        if down:
            foot = (LEG_FOOT * ca, LEG_FOOT * sa, 0.06)
            f.vcyl(foot[0], foot[1], 0.0, 0.11, 0.05, "steelD", top="steel", sides=8)
        else:
            foot = (0.48 * ca, 0.48 * sa, 0.5)                              # tucked against the housing
        strut(f, (rt * ca, rt * sa, zt), foot, 0.07, "steelL")
        f.box(rt * ca, rt * sa, zt - 0.05, 0.14, 0.14, 0.1, HULL_D, base=False)        # the knuckle on the hull


def greeble(f):
    _g("greeble")
    f.vcyl(-0.45, -0.3, C + 0.6, 0.022, 0.32, "steelL", sides=6)           # antenna
    f.box(-0.45, -0.3, C + 0.92, 0.05, 0.05, 0.04, "red")
    for sv in (-1, 1):
        f.box(0.62, sv * 0.42, C - 0.32, 0.1, 0.08, 0.06, "steelD", base=False)       # lamps either side of the chin
        f.box(0.67, sv * 0.42, C - 0.32, 0.012, 0.06, 0.04, "arc", base=False)


def pod(heading, state="parked", bob=0.0, dz=0.0):
    """state: parked / docked, fly or mine."""
    m = core.Mesh(f"mining_pod_{state}")
    m.dz = dz + (0.0 if state in ("parked", "docked") else 0.35 + bob)
    f = Spin(m, heading)
    body(f)
    canopy(f)
    hatch(f)
    thruster(f, state in ("fly", "mine"))
    rcs(f, state in ("fly", "mine"))
    laser(f, state == "mine", state == "mine")
    legs(f, state in ("parked", "docked"))
    greeble(f)
    return [smooth(m.build())]
