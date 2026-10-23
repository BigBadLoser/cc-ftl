"""The MINING POD (vehicle.mining_pod): a one-seat capsule of a miner that sits in a 3x3 bay. Ore rides inside it.

Local frame as shuttle_craft (u = nose, v across, z up, origin at the footprint centre on the pad; `Spin(heading)`).
The body is a capsule swept along the pod's v axis (built in its own frame turned a quarter turn, `Spin(heading + 90)`):
a ball cut in half with the halves pushed a little apart, a drum round its middle (a cylinder proud of the
domes, with flat dark sides) carrying the armour plates, and
the big round HATCH (a heavy ring round a red-lit door with lamps) closing each end. The nose (+u) carries a boxy
WINDSHIELD that juts out of the hull, a big raked pane over a smaller lower one in dark glass. Underneath: one
big thruster bell in a housing, which it rests on when parked; a big mining laser in a gimbal hung from the
windshield's flat underside.
Warm dark steel (c4F), industrial yellow accents (c4T).

States: parked / docked (laser stowed, thruster dark), fly (thruster lit), mine (laser lowered, emitter lit; `bob` lifts
it for the hover loop)."""
import math

from . import core
from .shuttle_bay import lbox
from .shuttle_craft import Spin, _g, profile, smooth, station

C = 1.18                      # the body's axis height above the pad (parked, on the bell)
R = 0.86                      # the hull's radius: the band's, and each half-dome's
BAND = (-0.47, 0.47)          # the drum's flat sides (along the pod's v); everything mirrors about v = 0
DRUM_R = 0.95                 # the drum's radius: it stands this much proud of the domes (R) all round
FLAT = 0.74                   # the back is cut flat this far behind the centre (drum, plates and domes alike)
REAR = (C + 0.02, 0.2, 0.3)   # the rear thruster on the flat back: centre z, throat and mouth radius
DOME_C = 0.235                # each half-dome's centre, out from the middle (0: the whole ball; the ribs: split wide)
HATCH_END = 0.6               # the domes end where the hull's radius is this, under the hatch rings


def _dome(c, sign, r_end, n=6):
    """Stations of a half-dome centred at c, going outward (sign) to where its radius is r_end."""
    p0 = math.asin(r_end / R)
    out = []
    for k in range(n + 1):
        p = math.pi / 2 - (math.pi / 2 - p0) * k / n
        out.append((c + sign * R * math.cos(p), R * math.sin(p)))
    return out


BALL = _dome(-DOME_C, -1, HATCH_END)[::-1] + _dome(DOME_C, 1, HATCH_END)   # half-dome, drum, half-dome
SECTION = profile(n=24, p=2.0)          # a true circle: a pressure hull
HATCH_R = 0.5                 # the round hatch's door radius
BELL = (0.0, 0.42, 0.28)      # the main thruster: mouth z, mouth radius, throat radius
WIND = (0.5, 1.22, 0.4)       # windshield box: back u (inside the hull), front u at its foot, half width
WIND_ZB = C - 0.44            # the windshield box's flat underside
LASER_U, LASER_Z = 0.98, WIND_ZB - 0.2    # the laser's pivot, in the gimbal hung under the windshield
HULL, HULL_D, HULL_L = "c4F2", "c4F4", "c4F1"
YEL, YEL_D = "c4T2", "c4T4"
GLOW = "cyan"
BEAM = "orange"


def loft(f, stations, prof, mat, cap0=None, cap1=None, closed=True, flat=FLAT):
    """shuttle_craft.sweep with the back cut flat: no point stands further than `flat` along the body frame's +v (the
    pod's -u, its back)."""
    rings = [[f.pt(u, min(v0 + pv * sv, flat), z0 + pz * sz) for pv, pz in prof] for u, sv, sz, v0, z0 in stations]
    n = len(prof)
    for A, B in zip(rings, rings[1:]):
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            f.poly([A[i], A[j], B[j], B[i]], mat, flip=True)
    if cap0:
        f.poly(rings[0], cap0, flip=True)
    if cap1:
        f.poly(rings[-1][::-1], cap1, flip=True)


def patch(f, body, u0, u1, t0, t1, k, mat, n=9, steps=4):
    """A panel lying on the hull: the arc t0..t1 (degrees) of its round section, scaled by k, over u0..u1 (as
    shuttle_craft.patch, but on the hull's own circle, not the shuttle's rounded square)."""
    us = [u0 + (u1 - u0) * i / steps for i in range(steps + 1)]
    loft(f, [station(body, u, k) for u in us], profile(t0, t1, n, p=2.0), mat, closed=False, flat=FLAT + (k - 1) * DRUM_R)


def strut(f, p0, p1, w, mat):
    """A square bar from p0 to p1 (u, v, z), w thick."""
    d = [b - a for a, b in zip(p0, p1)]
    n = math.sqrt(sum(x * x for x in d))
    d = [x / n for x in d]
    side = [-d[1], d[0], 0.0]
    sl = math.hypot(side[0], side[1]) or 1.0
    side = [x / sl for x in side]
    up = [d[1] * side[2] - d[2] * side[1], d[2] * side[0] - d[0] * side[2], d[0] * side[1] - d[1] * side[0]]
    lbox(f, lambda a, b, c: tuple((p0 if b < 0 else p1)[i] + side[i] * a * w / 2 + up[i] * c * w / 2 for i in range(3)),
         {"side": mat})


def body(fb):
    """The hull, in the body frame (u along the pod's +v): the two half-domes, and round their middle the DRUM, a cylinder
    a little bigger than them with flat dark sides, so it stands out of the domes by DRUM_R - R all round."""
    _g("hull")
    B = [(u, r, r, 0, C) for u, r in BALL]
    loft(fb, B, SECTION, HULL, cap0=HULL_D)
    _g("drum")
    D = [(u, DRUM_R, DRUM_R, 0, C) for u in BAND]
    loft(fb, D, SECTION, HULL, cap0="steelD", cap1="steelD")                # the drum and its flat sides
    patch(fb, D, BAND[0], BAND[1], 200, 340, 1.006, HULL_D, n=9, steps=2)   # its shaded underside
    patch(fb, D, -0.28, 0.28, 235, 305, 1.012, "grime", n=5, steps=2)
    _g("plates")
    # One armour plate wraps the drum from the windshield's brow over the top and down the back (profile 0 = pod -u,
    # 90 = top, 180 = the nose), its stripes the whole way with it.
    t0, t1 = -55, 150
    patch(fb, D, BAND[0] + 0.04, BAND[1] - 0.04, t0, t1, 1.012, HULL_L, n=21, steps=2)
    patch(fb, D, -0.1, 0.1, t0, t1, 1.022, YEL, n=21, steps=1)
    for u0 in (BAND[0] + 0.05, BAND[1] - 0.15):
        patch(fb, D, u0, u0 + 0.1, t0, t1, 1.022, YEL_D, n=21, steps=1)


def hatch(fb):
    """An airlock door closing the body's +u end (in fb, the pod's +v or -v side), all in rings: a heavy frame ring, a
    thin yellow ring inside it, the red door with a seam ring, a hand wheel at its centre and a porthole above."""
    _g("hatch")
    u = BALL[-1][0]
    rf = HATCH_R + 0.12
    fb.hcyl(u - 0.04, u + 0.06, 0, C, rf, "steelD", sides=32, cap="steelD")              # the frame ring
    fb.hcyl(u + 0.06, u + 0.066, 0, C, HATCH_R + 0.04, "hazY", sides=32, cap="hazY")   # the yellow ring
    du = u + 0.086
    fb.hcyl(u + 0.066, du, 0, C, HATCH_R, "drK", sides=32, cap="drD")         # the door
    fb.hcyl(du, du + 0.006, 0, C, HATCH_R * 0.74, "drK", sides=32, cap="drD")  # its seam ring
    fb.hcyl(du + 0.006, du + 0.008, 0, C, HATCH_R * 0.74 - 0.03, "drD", sides=32, cap="drD")
    wz = C - 0.04                                                            # the hand wheel: a steel rim
    fb.hcyl(du, du + 0.03, 0, wz, 0.17, "steelD", sides=20, cap="steelL")      # (a disc, the door showing through)
    fb.hcyl(du + 0.03, du + 0.032, 0, wz, 0.13, "drD", sides=20, cap="drD")
    fb.box(du + 0.04, 0, wz, 0.02, 0.28, 0.035, "steelL", base=False)          # two spokes
    fb.box(du + 0.04, 0, wz, 0.02, 0.035, 0.28, "steelL", base=False)
    fb.hcyl(du + 0.03, du + 0.06, 0, wz, 0.045, "steelD", sides=12, cap="steelL")    # a hub
    fb.hcyl(du, du + 0.012, 0, C + 0.27, 0.075, "steelD", sides=16, cap="glassD")   # porthole


def windshield(f):
    """The reference's windshield: a chunky box jutting out of the nose, its raked face a thick frame round a big upper pane
    over a smaller lower one, dark glass with a lit bezel and one reflection, a yellow brow on top."""
    _g("windshield")
    u0, u1, hw = WIND
    zb, zt, rake = WIND_ZB, C + 0.4, 0.3

    def frame(a, b, d):
        return (u0 if b < 0 else (u1 - (rake if d > 0 else 0.0)), a * hw, zt if d > 0 else zb)
    lbox(f, frame, {"side": HULL_D, "top": HULL})

    def p(a, z, eps):                                                        # a point on the raked face
        return f.pt(u1 - rake * (z - zb) / (zt - zb) + eps, a, z)

    def pane(z0, z1, inset, col, eps):
        f.poly([p(-hw + inset, z0, eps), p(hw - inset, z0, eps), p(hw - inset, z1, eps), p(-hw + inset, z1, eps)], col,
               flip=True)
    zm = C - 0.08                                                            # the bar between the panes
    for z0, z1 in ((zm + 0.04, zt - 0.07), (zb + 0.07, zm - 0.04)):
        pane(z0 - 0.025, z1 + 0.025, 0.045, HULL_L, 0.003)                   # the lit bezel
        pane(z0, z1, 0.07, "glassD", 0.006)
    pane(zt - 0.2, zt - 0.16, 0.07, "lens", 0.009)                           # a reflection across the upper pane
    pane(zt - 0.26, zt - 0.245, 0.07, "lens", 0.009)
    ub = u1 - rake + 0.03                                                    # the yellow brow, just past the glass
    f.box((u0 + ub) / 2, 0, zt, ub - u0, 2 * hw + 0.04, 0.035, YEL)


def rear_thruster(f, lit):
    """A second, smaller thruster on the flat back for forward thrust: a mounting plate, a flared bell, lip lit in flight."""
    _g("rear")
    z, rt, rm = REAR
    ub = -FLAT - 0.03                                                        # the face, over the armour plate
    f.box(ub + 0.015, 0, z, 0.03, 0.62, 0.62, HULL_D, base=False)              # mounting plate
    f.hcyl(ub, ub - 0.08, 0, z, rt + 0.08, "steelD", sides=20, capstart="steelD")   # collar
    f.hcyl(ub - 0.08, ub - 0.34, 0, z, rt, "steelD", r1=rm, sides=20)                   # the bell
    f.hcyl(ub - 0.33, ub - 0.35, 0, z, rm + 0.01, GLOW if lit else "steel", sides=20, cap="dark")   # its lip, the mouth
    if lit:
        f.hcyl(ub - 0.3, ub - 0.352, 0, z, rm * 0.5, GLOW, sides=16, cap="arc")      # the burning core, deep in it
    for k in range(4):                                                       # bolts on the plate
        a = k * math.tau / 4 + math.pi / 4
        f.box(ub - 0.004, 0.25 * math.cos(a), z + 0.25 * math.sin(a), 0.02, 0.05, 0.05, "steelL", base=False)


def thruster(f, lit):
    """The big main thruster under the body: a housing, a flared bell with gimbal struts, a lip lit in flight."""
    _g("thruster")
    zm, rm, rt = BELL
    zh = C - 0.72
    f.vcyl(0, 0, zm + 0.2, rt + 0.1, zh - zm - 0.2, HULL_D, top=HULL_D, sides=20)
    f.vcyl(0, 0, zm + 0.17, rt + 0.13, 0.05, "steelD", top="steelD", sides=20)
    f.vcyl(0, 0, zm, rm, 0.2, "steelD", top="steelD", rtop=rt, sides=20)
    f.vcyl(0, 0, zm, rm + 0.01, 0.03, GLOW if lit else "steel", top=GLOW if lit else "steel", sides=20)
    for k in range(4):
        a = k * math.tau / 4 + math.pi / 4
        strut(f, ((rt + 0.12) * math.cos(a), (rt + 0.12) * math.sin(a), zm + 0.22),
              ((rt - 0.02) * math.cos(a), (rt - 0.02) * math.sin(a), zm + 0.1), 0.04, "steelL")


def laser(f, down, lit):
    """The mining laser in a gimbal hung from the windshield's flat underside: a turntable, a yoke of two arms and the
    laser between them on a trunnion, angled down when stowed, further down when mining. A big gun: a yellow breech,
    a ribbed barrel and a flared emitter."""
    _g("laser")
    f.vcyl(LASER_U, 0, WIND_ZB - 0.06, 0.17, 0.06, HULL_D, top=HULL_D, sides=16)      # turntable
    f.vcyl(LASER_U, 0, WIND_ZB - 0.09, 0.12, 0.03, "steelD", top="steelD", sides=16)
    for sv in (-1, 1):                                                       # the yoke's arms
        f.box(LASER_U, sv * 0.165, LASER_Z - 0.08, 0.2, 0.05, WIND_ZB - 0.09 - LASER_Z + 0.08, HULL_D, top=HULL)
        f.hcyl(LASER_U - 0.07, LASER_U + 0.07, sv * 0.195, LASER_Z, 0.06, YEL_D, sides=10, cap="steelL", capstart="steelL")
    kw = dict(pitch=math.radians(-60 if down else -38), pu=LASER_U, pz=LASER_Z)     # stowed: angled down, clear
    f.box(LASER_U - 0.05, 0, LASER_Z, 0.3, 0.26, 0.24, YEL, top=YEL, base=False, **kw)        # breech
    f.box(LASER_U - 0.05, 0, LASER_Z + 0.125, 0.22, 0.14, 0.012, "hazK", base=False, **kw)
    f.hcyl(LASER_U + 0.1, LASER_U + 0.62, 0, LASER_Z, 0.1, "steel", r1=0.085, sides=12, **kw)   # barrel
    for k in range(4):                                                       # cooling rings
        uk = LASER_U + 0.18 + k * 0.08
        f.hcyl(uk, uk + 0.035, 0, LASER_Z, 0.125, "steelD", sides=12, cap="steelD", capstart="steelD", **kw)
    f.hcyl(LASER_U + 0.62, LASER_U + 0.72, 0, LASER_Z, 0.09, "steelD", r1=0.13, sides=12, **kw)   # flared emitter
    f.hcyl(LASER_U + 0.7, LASER_U + 0.71, 0, LASER_Z, 0.1, "dark", sides=12, cap=BEAM if lit else "dark", **kw)


def greeble(f):
    _g("greeble")
    f.vcyl(-0.45, 0, C + 0.8, 0.022, 0.3, "steelL", sides=6)               # antenna, on the centre line aft
    f.box(-0.45, 0, C + 1.1, 0.05, 0.05, 0.04, "red")


def pod(heading, state="parked", bob=0.0, dz=0.0):
    """state: parked / docked, fly or mine."""
    m = core.Mesh(f"mining_pod_{state}")
    m.dz = dz + (0.0 if state in ("parked", "docked") else 0.35 + bob)
    f, fb = Spin(m, heading), Spin(m, heading + math.pi / 2)
    body(fb)
    hatch(fb)
    hatch(Spin(m, heading - math.pi / 2))                                    # the same hatch on the other end
    windshield(f)
    thruster(f, state in ("fly", "mine"))
    rear_thruster(f, state in ("fly", "mine"))
    laser(f, state == "mine", state == "mine")
    greeble(f)
    return [smooth(m.build())]
