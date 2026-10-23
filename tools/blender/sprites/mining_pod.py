"""The MINING POD (vehicle.mining_pod): a one-seat capsule of a miner that sits in a 3x3 bay. Ore rides inside it.

Local frame as shuttle_craft (u = nose, v across, z up, origin at the footprint centre on the pad; `Spin(heading)`).
The body is a capsule swept along the pod's +v axis (built in its own frame turned a quarter turn, `Spin(heading + 90)`):
a straight band between two ribs with a half-dome pushed out on each side, banded with armour plates, and closed on its +v end by the big round HATCH (a heavy ring round a red-lit door
with lamps). The nose (+u) carries a boxy WINDSHIELD that juts out of the hull, a big raked pane over a small lower one.
Underneath: one big thruster bell in a housing and four legs splayed round it; a mining laser on a chin mount under the
windshield. Warm dark steel (c4F), industrial yellow accents (c4T).

States: parked / docked (legs down, laser stowed, thruster dark), fly (legs folded, thruster lit), mine (legs folded,
laser lowered, emitter lit; `bob` lifts it for the hover loop)."""
import math

from . import core
from .shuttle_bay import lbox
from .shuttle_craft import Spin, _g, patch, profile, smooth, sweep

C = 1.38                      # the body's axis height above the pad (legs down)
R = 0.86                      # the hull's radius: the band's, and each half-dome's
BAND = (-0.5, 0.44)           # the band between the two ribs (along the pod's v): a straight drum
HATCH_END, VENT_END = 0.6, 0.2   # the domes end where the hull's radius is this: the hatch ring, the vent cap


def _dome(c, sign, r_end, n=6):
    """Stations of a half-dome on the band's edge c, going outward (sign) to where its radius is r_end."""
    p0 = math.asin(r_end / R)
    out = []
    for k in range(n + 1):
        p = math.pi / 2 - (math.pi / 2 - p0) * k / n
        out.append((c + sign * R * math.cos(p), R * math.sin(p)))
    return out


BALL = _dome(BAND[0], -1, VENT_END)[::-1] + _dome(BAND[1], 1, HATCH_END)   # half-dome, band, half-dome
SECTION = profile(n=20, p=2.3)          # round, a little squared: a pressure hull
HATCH_R = 0.5                 # the round hatch's door radius
BELL = (0.22, 0.42, 0.28)     # the main thruster: mouth z, mouth radius, throat radius
WIND = (0.62, 1.08, 0.42)     # windshield box: back u (inside the hull), front u, half width
LEG_FOOT, LEG_TOP = 1.0, (0.55, C - 0.6)
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
    patch(fb, B, -0.55, 0.42, 200, 340, 1.01, HULL_D, n=9, steps=5)           # the shaded underside plates
    patch(fb, B, -0.3, 0.25, 235, 305, 1.02, "grime", n=5, steps=2)
    _g("plates")
    patch(fb, B, -0.5, 0.36, 55, 125, 1.035, HULL_L, n=7, steps=4)            # the dorsal armour plate
    patch(fb, B, -0.12, 0.08, 45, 135, 1.06, YEL, n=9, steps=2)               # its yellow band
    patch(fb, B, -0.42, -0.32, 50, 130, 1.06, YEL_D, n=7, steps=1)
    patch(fb, B, -0.45, 0.4, -25, 25, 1.03, HULL_L, n=5, steps=4)             # the aft plate (profile 0 = pod -u)
    for u in (-0.5, 0.44):                                                   # the ribs
        k = _r(u) * 1.055
        sweep(fb, [(u - 0.035, k, k, 0, C), (u + 0.035, k, k, 0, C)], SECTION, "steelD")
    ue = BALL[0][0]
    fb.hcyl(ue - 0.04, ue + 0.02, 0, C, VENT_END, "steelD", sides=12, capstart="steelD")   # a vent cap on the far end
    for dz in (-0.08, 0.0, 0.08):
        fb.box(ue - 0.045, 0, C + dz, 0.012, 0.24, 0.03, "dark", base=False)


def hatch(fb):
    """The big round hatch closing the body's end (the pod's +v side): a heavy ring, a red-lit door, lamps round it."""
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
    """A box jutting out of the nose: a big raked upper pane over a small lower one, framed in dark steel."""
    _g("windshield")
    u0, u1, hw = WIND
    zb, zt, rake = C - 0.18, C + 0.36, 0.12

    def frame(a, b, d):
        return (u0 if b < 0 else (u1 - (rake if d > 0 else 0.0)), a * hw, zt if d > 0 else zb)
    lbox(f, frame, {"side": HULL_D, "top": HULL})
    inset, eps = 0.06, 0.006

    def p(a, z):                                                             # a point on the raked face
        return f.pt(u1 - rake * (z - zb) / (zt - zb) + eps, a, z)
    f.poly([p(-hw + inset, zb + inset), p(hw - inset, zb + inset), p(hw - inset, zt - inset), p(-hw + inset, zt - inset)],
           "glassD", flip=True)
    zr = zt - 0.15
    f.poly([p(-hw + inset, zr), p(hw - inset, zr), p(hw - inset, zr + 0.04), p(-hw + inset, zr + 0.04)], "lens", flip=True)
    f.box(u1 - rake / 2 + 0.01, 0, (zb + zt) / 2, 0.02, 0.04, zt - zb - 0.1, HULL_D, base=False)   # mullion
    f.box(u0 + 0.12, 0, C - 0.4, 0.3, 0.5, 0.2, HULL_D, top=HULL)            # the small lower pane's box
    f.box(u0 + 0.27, 0, C - 0.3, 0.012, 0.4, 0.1, "glassD", base=False)
    f.box((u0 + u1) / 2 - 0.05, 0, zt, u1 - u0 - 0.1, 2 * hw + 0.04, 0.03, YEL)   # a yellow brow over it


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


def legs(f, down):
    """Four legs splayed round the bell; folded, they tuck against its housing."""
    _g("legs")
    rt, zt = LEG_TOP
    for k in range(4):
        a = k * math.tau / 4 + math.pi / 4
        ca, sa = math.cos(a), math.sin(a)
        if down:
            foot = (LEG_FOOT * ca, LEG_FOOT * sa, 0.06)
            f.vcyl(foot[0], foot[1], 0.0, 0.11, 0.05, "steelD", top="steel", sides=8)
        else:
            foot = (0.48 * ca, 0.48 * sa, 0.5)
        strut(f, (rt * ca, rt * sa, zt), foot, 0.07, "steelL")
        f.box(rt * ca, rt * sa, zt - 0.05, 0.14, 0.14, 0.1, HULL_D, base=False)


def greeble(f):
    _g("greeble")
    f.vcyl(-0.3, -0.35, C + 0.78, 0.022, 0.26, "steelL", sides=6)          # antenna
    f.box(-0.3, -0.35, C + 1.04, 0.05, 0.05, 0.04, "red")
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
    windshield(f)
    thruster(f, state in ("fly", "mine"))
    laser(f, state == "mine", state == "mine")
    legs(f, state in ("parked", "docked"))
    greeble(f)
    return [smooth(m.build())]
