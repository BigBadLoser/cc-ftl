"""The ESCAPE POD (vehicle.escape_pod): a sealed one-seat lifeboat that flies itself. Pod family (pod_family.py), a little
smaller than the mining pod (content size 2.2 against 2.6).

A re-entry capsule of our own: a squat truncated CONE with a broad, shallow HEAT SHIELD at its base and the DOCKING COLLAR
(a hatch in a ring) at its narrow top. A hi-vis orange safety band round the base, a hazard ring round the collar, a side
hatch and a viewport on the flank, an emergency BEACON on the collar, four RCS quads round the shoulder, small drive
nozzles.

Capsule frame: built along its own axis s (s = 0 the heat shield's rim, +s toward the collar) laid along u, then stood up
by the variant's `tilt` (Tilted: 90 = upright, heat shield down, collar up; more leans the collar back so the shield
leads) and turned to the heading (Spin; u = the heading). Round the axis, theta 270 faces forward when upright (the side
hatch), 90 aft (the drive). A variant (VARIANTS) sets the cone's proportions, its `bulge` (1 = straight sides, more =
a rounded gumdrop shoulder) and the tilt; `drive` "flank" puts the nozzles on the aft flank, "collar" round the collar
(the sideways variant b, flying shield first).

States: fly (drive lit), drift (no drive; `beacon` lights the lamp), docked / parked (dark)."""
import math

from . import core
from .shuttle_craft import Spin, _g, smooth

HULL, HULL_D, HULL_K = "medWhite", "steelL", "steel"   # a light hull, steel trim
BAND = "hivis"                # the safety band
SHIELD, SHIELD_D = "rustD", "leather"                 # the heat shield's ablative face, scorched dark
GLOW = "cyan"                 # drive nozzles (the ship's drives glow cyan too)
BEACON = "orange"             # the emergency beacon

# variant: base radius, top radius, cone length, bulge, heat-shield depth, tilt (degrees), where the drive is
# (crew are 1.5 tall and sit inside: the cone stands about crew height on its shield, the door is crew-sized)
VARIANTS = {
    "g": dict(rb=1.0, rt=0.5, length=1.25, bulge=1.0, dish=0.16, tilt=90, drive="pack", label="G upright, drive pack"),
    "h": dict(rb=1.0, rt=0.5, length=1.25, bulge=1.0, dish=0.16, tilt=105, drive="pack", label="H leaning 15"),
    "i": dict(rb=1.0, rt=0.44, length=1.3, bulge=1.7, dish=0.14, tilt=105, drive="pack", label="I gumdrop, leaning 15"),
}
SIDES = 48
HOVER = 0.25                  # the lowest point's height in flight


class Tilted(Spin):
    """Spin with the capsule stood up: (u, z) pitched by tilt about the origin, then lifted by tz."""

    def __init__(self, m, heading, tilt, tz):
        super().__init__(m, heading)
        self.tc, self.ts, self.tz = math.cos(tilt), math.sin(tilt), tz

    def pt(self, u, v, z, pitch=0.0, pu=0.0, pz=0.0):
        if pitch:
            du, dz = u - pu, z - pz
            c, s = math.cos(pitch), math.sin(pitch)
            u, z = pu + du * c - dz * s, pz + du * s + dz * c
        u, z = u * self.tc - z * self.ts, u * self.ts + z * self.tc + self.tz
        return super().pt(u, v, z)


class Capsule:
    def __init__(self, f, v):
        self.f, self.v, self.zc = f, v, 0.0
        self.top = v["length"]
        self.s0 = -(self.top - v["dish"]) / 2                  # u of the shield's rim: the whole craft centred on u = 0

    def u(self, s):
        return self.s0 + s

    def r(self, s):
        """The hull's radius at s: the cone, its shoulder rounded by the variant's bulge."""
        v = self.v
        x = min(max(s / v["length"], 0.0), 1.0)
        return v["rb"] + (v["rt"] - v["rb"]) * x ** v["bulge"]

    def cyl(self, s0, s1, r0, r1, mat, sides=SIDES, cap=None, capstart=None):
        self.f.hcyl(self.u(s0), self.u(s1), 0, self.zc, r0, mat, r1=r1, sides=sides, cap=cap, capstart=capstart)

    def on(self, s, theta, out=0.0):
        """A point on the hull at s, angle theta round the axis (0 = +v, 90 = capsule +z), out of it by `out`, and its
        outward normal, in capsule (u, v, z)."""
        slope = (self.r(max(s - 0.01, 0.0)) - self.r(min(s + 0.01, self.top))) / 0.02   # the radius falls this per unit s
        c, sn = math.cos(math.radians(theta)), math.sin(math.radians(theta))
        nl = math.hypot(1.0, slope)
        n = (slope / nl, c / nl, sn / nl)
        r = self.r(s)
        return (self.u(s) + n[0] * out, r * c + n[1] * out, self.zc + r * sn + n[2] * out), n


def _ring_pts(f, c, n, a, r, sides, phase=0.0):
    b = (n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0])
    out = []
    for i in range(sides):
        t = i * math.tau / sides + math.radians(phase)
        ct, st = math.cos(t), math.sin(t)
        out.append(f.pt(*(c[q] + (a[q] * ct + b[q] * st) * r for q in range(3))))
    return out


def stud(f, c, n, r, h, mat, cap, sides=16, r1=None, phase=0.0):
    """A short round boss standing out of a surface at c along its unit normal n: radius r (r1 at its face), h tall."""
    a = (-n[1], n[0], 0.0) if abs(n[2]) < 0.9 else (1.0, 0.0, 0.0)
    al = math.sqrt(sum(x * x for x in a))
    a = tuple(x / al for x in a)
    a = tuple(a[q] - n[q] * sum(a[k] * n[k] for k in range(3)) for q in range(3))
    al = math.sqrt(sum(x * x for x in a))
    a = tuple(x / al for x in a)
    A = _ring_pts(f, tuple(c[q] - n[q] * 0.02 for q in range(3)), n, a, r, sides, phase)
    B = _ring_pts(f, tuple(c[q] + n[q] * h for q in range(3)), n, a, r if r1 is None else r1, sides, phase)
    for i in range(sides):
        j = (i + 1) % sides
        f.poly([A[i], A[j], B[j], B[i]], mat)
    f.poly(B, cap)


def heat_shield(k):
    """The broad shallow dish at the base: a steel lip ring, the ablative face bulging out to a low dome."""
    _g("heat_shield")
    v = k.v
    rb, d = v["rb"] * 1.04, v["dish"]
    k.cyl(-0.04, 0.03, rb, rb, HULL_K)                                     # the lip
    n = 6
    st = [(-0.04 - d * (1 - math.cos(math.pi / 2 * i / n)), rb * 0.98 * math.sin(math.pi / 2 * i / n)) for i in range(n + 1)]
    st[0] = (st[0][0], 0.0)
    for (s_a, r_a), (s_b, r_b) in zip(st, st[1:]):                         # apex outward, so the faces face out
        k.cyl(s_a, s_b, max(r_a, 0.001), r_b, SHIELD if r_b < rb * 0.8 else SHIELD_D)


def body(k):
    """The cone, the safety band round its base, a few seams."""
    _g("hull")
    ln = k.v["length"]
    marks = [0.0, 0.06, 0.3, ln * 0.66, ln * 0.66 + 0.035, ln]
    mats = [HULL_D, BAND, HULL, HULL_D, HULL]
    for (a, b), m in zip(zip(marks, marks[1:]), mats):
        n = max(1, int((b - a) / 0.06))                                    # fine steps, so a bulge reads round
        for i in range(n):
            s0, s1 = a + (b - a) * i / n, a + (b - a) * (i + 1) / n
            g = 1.008 if m == BAND else 1.0
            k.cyl(s0, s1, k.r(s0) * g, k.r(s1) * g, m)


def collar(k, beacon_on, thrust=False):
    """The docking collar at the narrow top: a heavy ring round the hatch, black-and-yellow hazard sectors on its face,
    the red hatch with a hand wheel. The beacon stands on the shoulder by it."""
    _g("collar")
    t = k.top
    r = k.r(t) * 0.92
    k.cyl(t, t + 0.1, r, r, HULL_K)                                        # the collar's barrel
    k.cyl(t + 0.1, t + 0.15, r * 1.08, r * 1.08, "steelD")                 # its mating ring
    f = k.f
    u = k.u(t + 0.15)
    n = 16
    for i in range(n):                                                     # hazard sectors on the ring's face
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        ri, ro = r * 0.74, r * 1.08
        pts = [f.pt(u + 0.002, rr * math.cos(a), k.zc + rr * math.sin(a)) for rr, a in ((ri, a0), (ri, a1), (ro, a1), (ro, a0))]
        f.poly(pts[::-1], "hazY" if i % 2 else "hazK")
    k.f.hcyl(u, u + 0.03, 0, k.zc, r * 0.74, "drK", sides=32, cap="drD")   # the hatch
    k.f.hcyl(u + 0.03, u + 0.06, 0, k.zc, r * 0.3, "steelD", sides=16, cap="steelL")   # its hand wheel's hub
    for ang in (0, 90):
        c = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        k.f.box(u + 0.045, 0, k.zc, 0.02, 0.05 + abs(c[0]) * r * 1.0, 0.05 + abs(c[1]) * r * 1.0, "steelL", base=False)
    _g("beacon")
    p, nn = (u, 0.0, k.zc + r * 0.9), (1.0, 0.0, 0.0)                     # on the mating ring, aft when upright
    stud(f, p, nn, 0.09, 0.05, "steelD", "steelD")                         # its base
    q = tuple(p[i] + nn[i] * 0.05 for i in range(3))
    stud(f, q, nn, 0.07, 0.09, BEACON if beacon_on else "drD", BEACON if beacon_on else "drM", r1=0.05)


def sector(k, s0, s1, t0, t1, g, mat, wall="steelD"):
    """A panel lying on the hull over s0..s1 and the arc t0..t1 (degrees), raised to g times the radius, walled round."""
    ns, nt = max(2, int((s1 - s0) / 0.05)), max(2, int(abs(t1 - t0) / 4))
    S = [s0 + (s1 - s0) * i / ns for i in range(ns + 1)]
    T = [math.radians(t0 + (t1 - t0) * j / nt) for j in range(nt + 1)]

    def P(s, t, gg):
        r = k.r(s) * gg
        return k.f.pt(k.u(s), r * math.cos(t), k.zc + r * math.sin(t))
    for i in range(ns):
        for j in range(nt):
            k.f.poly([P(S[i], T[j], g), P(S[i + 1], T[j], g), P(S[i + 1], T[j + 1], g), P(S[i], T[j + 1], g)], mat)
    edge = [(S[i], T[0]) for i in range(ns + 1)] + [(S[-1], T[j]) for j in range(1, nt + 1)] + \
        [(S[i], T[-1]) for i in range(ns - 1, -1, -1)] + [(S[0], T[j]) for j in range(nt - 1, 0, -1)]
    for (sa, ta), (sb, tb) in zip(edge, edge[1:] + edge[:1]):
        k.f.poly([P(sa, ta, 0.99), P(sb, tb, 0.99), P(sb, tb, g), P(sa, ta, g)], wall)


def viewport(k):
    """The front: a crew-sized DOOR facing forward (a heavy frame, the red door, a porthole in it, a hazard sill below)
    and two windows either side of it, up by the shoulder, so the pod has a face."""
    _g("door")
    ln = k.v["length"]
    s0, s1, h = 0.32, ln * 0.9, 21
    sector(k, s0 - 0.05, s1 + 0.05, 270 - h - 5, 270 + h + 5, 1.025, "steelD")             # the frame
    sector(k, s0, s1, 270 - h, 270 + h, 1.045, "drK", "drD")                               # the door
    sector(k, s0 + (s1 - s0) * 0.62, s0 + (s1 - s0) * 0.86, 270 - 7, 270 + 7, 1.055, "glassD", "steelD")   # its porthole
    sector(k, s0 - 0.05, s0 + 0.03, 270 - h - 5, 270 + h + 5, 1.04, "hazY", "hazK")         # the hazard sill
    _g("windows")
    for c in (270 - 50, 270 + 50):
        sector(k, ln * 0.6, ln * 0.82, c - 13, c + 13, 1.02, "steelD")
        sector(k, ln * 0.62, ln * 0.8, c - 10, c + 10, 1.03, "glassD", "steelD")


def rcs(k):
    """Four RCS quads round the shoulder: a block with two nozzle stubs."""
    _g("rcs")
    s = k.v["length"] * 0.9
    for th in (0, 180):
        p, n = k.on(s, th)
        stud(k.f, p, n, 0.08, 0.06, HULL_D, "steelD", sides=4)
        q = tuple(p[i] + n[i] * 0.06 for i in range(3))
        stud(k.f, q, n, 0.035, 0.04, "steelD", "dark", sides=8)


def drive(k, lit):
    """The DRIVE PACK on the back (theta 90): a steel box lying on the flank with a yellow stripe, two thruster bells out
    of its back pointing straight aft (level when upright), so the pod has a back from any heading."""
    _g("drive")
    f, v = k.f, k.v
    ln = v["length"]
    sa, sb, w, dep = 0.12, ln * 0.62, 0.62, 0.34
    sm = (sa + sb) / 2
    slope = (k.r(sa) - k.r(sb)) / (sb - sa)
    pitch = -math.atan(slope)
    cz = k.r(sm) + dep / 2 - 0.08
    f.box(k.u(sm), 0, cz, (sb - sa) * math.hypot(1, slope), w, dep, "steelL", top="steelL", pitch=pitch, pu=k.u(sm), pz=cz,
          base=False)
    f.box(k.u(sm), 0, cz + dep / 2, (sb - sa) * math.hypot(1, slope) * 0.96, 0.12, 0.012, "hazY", pitch=pitch, pu=k.u(sm),
          pz=cz, base=False)
    for sv in (-1, 1):                                                     # the bells
        c = (k.u(sm - 0.08), sv * 0.15, k.r(sm - 0.08) + dep - 0.08)
        stud(f, c, (0.0, 0.0, 1.0), 0.07, 0.04, "steelD", "steelD", sides=12)
        q = (c[0], c[1], c[2] + 0.04)
        stud(f, q, (0.0, 0.0, 1.0), 0.07, 0.16, HULL_K, GLOW if lit else "dark", sides=12, r1=0.12)


def pod(heading, variant="g", state="fly", beacon=False):
    """The escape pod at a heading (grid radians, 0 = +x); state fly / drift / docked / parked."""
    v = VARIANTS[variant]
    t = math.radians(v["tilt"])
    span = (-(v["length"] - v["dish"]) / 2 - v["dish"] - 0.05, (v["length"] + v["dish"]) / 2 + 0.2)
    rad = v["rb"] * 1.04
    low = min(u * math.sin(t) + w * math.cos(t) for u in span for w in (-rad, rad))
    m = core.Mesh(f"escape_pod_{variant}_{state}")
    f = Tilted(m, heading + (math.pi if v["drive"] == "collar" else 0.0), t, HOVER - low)
    k = Capsule(f, v)
    heat_shield(k)
    body(k)
    collar(k, beacon)
    viewport(k)
    rcs(k)
    drive(k, state == "fly")
    return [smooth(m.build())]
