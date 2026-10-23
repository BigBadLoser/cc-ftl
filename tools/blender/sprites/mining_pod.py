"""The MINING POD (vehicle.mining_pod): a one-seat capsule of a miner that sits in a 3x3 bay. Ore rides inside it.

Local frame as shuttle_craft (u = nose, v across, z up, origin at the footprint centre on the pad; `Spin(heading)`).
The body is a capsule swept along the pod's v axis (built in its own frame turned a quarter turn, `Spin(heading + 90)`):
a ball cut in half with the halves pushed a little apart, a band between two ribs round its middle, armour plates, and
the big round HATCH (a heavy ring round a red-lit door with lamps) closing each end. The nose (+u) carries a boxy
WINDSHIELD that juts out of the hull, a big raked pane over a smaller lower one in dark glass. Underneath: one
big thruster bell in a housing, which it rests on when parked; a mining laser on a chin mount under the windshield.
Warm dark steel (c4F), industrial yellow accents (c4T).

States: parked / docked (laser stowed, thruster dark), fly (thruster lit), mine (laser lowered, emitter lit; `bob` lifts
it for the hover loop)."""
import math

from . import core
from .shuttle_bay import lbox
from .shuttle_craft import Spin, _g, patch, profile, smooth, sweep

C = 1.18                      # the body's axis height above the pad (parked, on the bell)
R = 0.86                      # the hull's radius: the band's, and each half-dome's
BAND = (-0.47, 0.47)          # the band between the two ribs (along the pod's v); everything mirrors about v = 0
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
SECTION = profile(n=20, p=2.3)          # round, a little squared: a pressure hull
HATCH_R = 0.5                 # the round hatch's door radius
BELL = (0.0, 0.42, 0.28)      # the main thruster: mouth z, mouth radius, throat radius
WIND = (0.5, 1.02, 0.4)       # windshield box: back u (inside the hull), front u at its foot, half width
LASER_U, LASER_Z = 0.6, C - 0.62
HULL, HULL_D, HULL_L = "c4F2", "c4F4", "c4F1"
YEL, YEL_D = "c4T2", "c4T4"
GLOW = "cyan"
BEAM = "orange"


def _r(a):
    """The body's radius at a (along its axis, the pod's v)."""
    for (p, rp), (q, rq) in zip(BALL, BALL[1:]):
        if p <= a <= q:
            return rp + (rq - rp) * (a - p) / (q - p)
    return BALL[-1][1] if a > 0 else BALL[0][1]


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
    """The bulb, in the body frame (u along the pod's +v)."""
    _g("hull")
    B = [(u, r, r, 0, C) for u, r in BALL]
    sweep(fb, B, SECTION, HULL, cap0=HULL_D)
    patch(fb, B, -0.6, 0.6, 200, 340, 1.01, HULL_D, n=9, steps=6)             # the shaded underside plates
    patch(fb, B, -0.28, 0.28, 235, 305, 1.02, "grime", n=5, steps=2)
    _g("plates")
    patch(fb, B, -0.43, 0.43, 55, 125, 1.035, HULL_L, n=7, steps=4)           # the dorsal armour plate
    patch(fb, B, -0.1, 0.1, 45, 135, 1.06, YEL, n=9, steps=2)                 # its yellow band
    for u0 in (-0.42, 0.32):
        patch(fb, B, u0, u0 + 0.1, 50, 130, 1.06, YEL_D, n=7, steps=1)       # and a dark one each side
    patch(fb, B, -0.43, 0.43, -25, 25, 1.03, HULL_L, n=5, steps=4)            # the aft plate (profile 0 = pod -u)
    for u in BAND:                                                           # the ribs
        k = _r(u) * 1.055
        sweep(fb, [(u - 0.035, k, k, 0, C), (u + 0.035, k, k, 0, C)], SECTION, "steelD")


def hatch(fb):
    """The big round hatch closing the body's +u end (in fb, the pod's +v or -v side): a heavy ring, a red-lit door,
    lamps round it."""
    _g("hatch")
    u = BALL[-1][0]
    fb.hcyl(u - 0.04, u + 0.06, 0, C, HATCH_R + 0.12, "steelD", sides=24, cap="steelD")
    fb.hcyl(u + 0.06, u + 0.075, 0, C, HATCH_R, "drK", sides=24, cap="drD")
    for k in range(8):
        a = k * math.tau / 8 + math.pi / 8
        fb.box(u + 0.08, (HATCH_R - 0.07) * math.cos(a), C + (HATCH_R - 0.07) * math.sin(a), 0.01, 0.05, 0.05,
               "orange" if k % 2 else "flameY", base=False)
    fb.box(u + 0.079, 0, C + 0.12, 0.01, 0.62, 0.02, "drK", base=False)       # the door's bars
    fb.box(u + 0.079, 0, C - 0.12, 0.01, 0.62, 0.02, "drK", base=False)
    fb.box(u + 0.082, 0, C + 0.3, 0.01, 0.5, 0.04, "lens", base=False)


def windshield(f):
    """The reference's windshield: a chunky box jutting out of the nose, its raked face a thick frame round a big upper pane
    over a smaller lower one, dark glass with a lit bezel and one reflection, a yellow brow on top."""
    _g("windshield")
    u0, u1, hw = WIND
    zb, zt, rake = C - 0.44, C + 0.4, 0.14

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
    f.box((u0 + u1) / 2 - 0.06, 0, zt, u1 - u0 - 0.12, 2 * hw + 0.04, 0.035, YEL)   # the yellow brow


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
    """The mining laser on a chin mount under the windshield: level when stowed, tipped forward and down when mining."""
    _g("laser")
    f.box(LASER_U - 0.08, 0, LASER_Z - 0.08, 0.32, 0.28, 0.16, HULL_D, top=HULL)
    f.hcyl(LASER_U - 0.05, LASER_U + 0.05, 0, LASER_Z, 0.1, YEL_D, sides=10, cap=YEL_D, capstart=YEL_D)
    kw = dict(pitch=math.radians(-55 if down else -6), pu=LASER_U, pz=LASER_Z)
    f.hcyl(LASER_U, LASER_U + 0.36, 0, LASER_Z, 0.07, "steel", r1=0.055, sides=10, **kw)
    for a in range(3):
        t = a * math.tau / 3 + math.pi / 2
        f.box(LASER_U + 0.25, 0.06 * math.cos(t), LASER_Z + 0.06 * math.sin(t), 0.13, 0.03, 0.03, YEL_D, base=False, **kw)
    f.hcyl(LASER_U + 0.36, LASER_U + 0.41, 0, LASER_Z, 0.055, "steelD", r1=0.075, sides=10, cap=BEAM if lit else "dark", **kw)


def greeble(f):
    _g("greeble")
    f.vcyl(-0.45, 0, C + 0.66, 0.022, 0.3, "steelL", sides=6)              # antenna, on the centre line aft
    f.box(-0.45, 0, C + 0.96, 0.05, 0.05, 0.04, "red")
    for sv in (-1, 1):
        f.box(0.72, sv * 0.3, C - 0.58, 0.1, 0.08, 0.06, "steelD", base=False)         # lamps either side of the chin
        f.box(0.77, sv * 0.3, C - 0.58, 0.012, 0.06, 0.04, "arc", base=False)


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
    laser(f, state == "mine", state == "mine")
    greeble(f)
    return [smooth(m.build())]
