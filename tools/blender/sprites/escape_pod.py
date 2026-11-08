"""The ESCAPE POD (vehicle.escape_pod): a sealed one-seat lifeboat that flies itself. Pod family (pod_family.py), a little
smaller than the mining pod (content size 2.2 against 2.6).

A re-entry capsule of our own: a squat truncated CONE with a broad, shallow HEAT SHIELD at its base and a GRAPPLE COLLAR
(a tow fixture in a hazard ring) stepped in at its narrow top. A hi-vis orange safety band round the base, broken by the
round DOCKING PORT flush in the front (the only way in or out: docked, the pod tips forward so it meets an airlock's collar square), two windows, an emergency BEACON by the
collar, RCS quads round the shoulder, the DRIVE PACK on the back with two thrusters sunk in it.

Capsule frame: built along its own axis s (s = 0 the heat shield's rim, +s toward the collar) laid along u, then stood up
by the variant's `tilt` (Tilted: 90 = upright, heat shield down, collar up; more leans the collar back so the shield
leads) and turned to the heading (Spin; u = the heading). Round the axis, theta 270 faces forward when upright (the docking
port), 90 aft (the drive). A variant (VARIANTS) sets the cone's proportions, its `bulge` (1 = straight sides, more =
a rounded gumdrop shoulder) and the tilt; `drive` "flank" puts the nozzles on the aft flank, "collar" round the collar
(the sideways variant b, flying shield first).

States: fly (drive lit, leaning by the variant's tilt), drift (upright, no drive; `beacon` lights the lamp: the blink's on
frame), docked (dark, tipped forward by the cone's slope so the port's face is vertical), parked (upright, dark)."""
import math

from . import core
from .shuttle_craft import Spin, _g, smooth

HULL, HULL_D, HULL_K = "medWhite", "steelL", "steel"   # a light hull, steel trim
BAND = "hivis"                # the safety band
SHIELD, SHIELD_D = "rustD", "leather"                 # the heat shield's ablative face, scorched dark
GLOW = "cyan"                 # drive nozzles (the ship's drives glow cyan too)
BEACON = "orange"             # the emergency beacon

# variant: base radius, top radius, cone length, bulge, heat-shield depth, tilt (degrees), where the drive is
# (crew are 1.5 tall and sit inside: the cone stands about crew height on its shield, the port's hatch is the airlock's own bore)
PORT = (0.56, 0.5, 0.38)      # the docking port: its centre (s), outer ring radius (the airlock's mouth ring is 0.62), hatch radius
VARIANTS = {
    "h": dict(rb=1.0, rt=0.5, length=1.25, bulge=1.0, dish=0.16, tilt=105, drive="pack", label="H"),
}
SIDES = 48
COLLAR = 0.76                 # the grapple collar's radius, x the cone's top: it steps in, a ledge round it
HATCH = 0.6                   # the grapple plate's radius, x the collar's: the hazard ring round it is the rest
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


def tube(f, c, n, r0, r1, h, mat, sides=16):
    """An open tube (no caps) from c along the unit normal n, h long, radius r0 to r1: a bore's wall, a bell's skin."""
    a = (1.0, 0.0, 0.0) if abs(n[0]) < 0.9 else (0.0, 1.0, 0.0)
    a = tuple(a[q] - n[q] * sum(a[i] * n[i] for i in range(3)) for q in range(3))
    al = math.sqrt(sum(x * x for x in a))
    a = tuple(x / al for x in a)
    A = _ring_pts(f, c, n, a, r0, sides)
    B = _ring_pts(f, tuple(c[q] + n[q] * h for q in range(3)), n, a, r1, sides)
    for i in range(sides):
        j = (i + 1) % sides
        f.poly([A[i], A[j], B[j], B[i]], mat)


def disc(f, c, n, r0, r1, mat, sides=16):
    """A flat ring (or a disc, r0 = 0) at c square to n."""
    a = (1.0, 0.0, 0.0) if abs(n[0]) < 0.9 else (0.0, 1.0, 0.0)
    a = tuple(a[q] - n[q] * sum(a[i] * n[i] for i in range(3)) for q in range(3))
    al = math.sqrt(sum(x * x for x in a))
    a = tuple(x / al for x in a)
    A, B = _ring_pts(f, c, n, a, max(r0, 0.001), sides), _ring_pts(f, c, n, a, r1, sides)
    for i in range(sides):
        j = (i + 1) % sides
        f.poly([A[i], A[j], B[j], B[i]], mat)


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
    """The cone, a few seams, and the safety band round its base, cut by the docking port."""
    _g("hull")
    ln = k.v["length"]
    marks = [0.0, 0.06, 0.3, ln * 0.66, ln * 0.66 + 0.035, ln]
    mats = [HULL_D, HULL, HULL, HULL_D, HULL]
    for (a, b), m in zip(zip(marks, marks[1:]), mats):
        n = max(1, int((b - a) / 0.06))                                    # fine steps, so a bulge reads round
        for i in range(n):
            s0, s1 = a + (b - a) * i / n, a + (b - a) * (i + 1) / n
            k.cyl(s0, s1, k.r(s0), k.r(s1), m)
    _g("band")
    sector(k, 0.06, 0.3, 0, 360, 1.008, BAND, BAND, skip=lambda u, v, z: in_port(k, u, v, z, -0.03))   # cut by the port


def collar(k, beacon_on, thrust=False):
    """The GRAPPLE COLLAR, stepped in from the cone's top: a steel ledge round it, then a narrower barrel rising to a ring
    flush with it, black-and-yellow hazard sectors on its face (the target), and at its centre the grapple fixture a
    ship's arm takes hold of to tow the pod in: a steel plate and a mushroom-headed pin. No crew hatch: crew use the docking
    port. The beacon stands on the ledge, aft."""
    _g("collar")
    t = k.top
    f = k.f
    disc(f, (k.u(t), 0.0, k.zc), (1.0, 0.0, 0.0), 0.0, k.r(t), HULL_D, sides=SIDES)   # the ledge, closing the cone
    r = k.r(t) * COLLAR
    k.cyl(t - 0.02, t + 0.1, r, r, HULL_K)                                 # the collar's barrel
    k.cyl(t + 0.1, t + 0.15, r, r, "steelD")                               # its mating ring, flush
    u = k.u(t + 0.15)
    n = 16
    for i in range(n):                                                     # hazard sectors on the ring's face
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        ri, ro = r * HATCH, r
        pts = [f.pt(u + 0.002, rr * math.cos(a), k.zc + rr * math.sin(a)) for rr, a in ((ri, a0), (ri, a1), (ro, a1), (ro, a0))]
        f.poly(pts[::-1], "hazY" if i % 2 else "hazK")
    k.f.hcyl(u, u + 0.025, 0, k.zc, r * HATCH, "steel", sides=32, cap="steel")   # the grapple plate
    for i in range(3):                                                     # three alignment lugs round it
        a = math.radians(-90 + i * 120)
        k.f.box(u + 0.025, r * HATCH * 0.7 * math.cos(a), k.zc + r * HATCH * 0.7 * math.sin(a), 0.05, 0.07, 0.07, "steelD",
                base=False)
    k.f.hcyl(u + 0.025, u + 0.13, 0, k.zc, 0.05, "steelL", sides=16)        # the pin
    k.f.hcyl(u + 0.13, u + 0.17, 0, k.zc, 0.1, "steelL", r1=0.07, sides=16, cap="steelL", capstart="steelD")   # its head
    _g("beacon")
    p, nn = (u, 0.0, k.zc + r * 0.78), (1.0, 0.0, 0.0)                    # on the collar's face, aft when upright
    stud(f, p, nn, 0.12, 0.04, "steelD", "steelD")                         # its base
    q = tuple(p[i] + nn[i] * 0.04 for i in range(3))
    lamp, cap = (BEACON, BEACON) if beacon_on else ("drD", "drM")
    stud(f, q, nn, 0.1, 0.14, lamp, lamp, r1=0.085)                        # the lamp
    q = tuple(q[i] + nn[i] * 0.14 for i in range(3))
    stud(f, q, nn, 0.085, 0.04, cap, cap, r1=0.05)                         # its rounded top
    stud(f, tuple(q[i] + nn[i] * 0.04 for i in range(3)), nn, 0.03, 0.03, "steelD", "steelD", sides=8)   # a cap nut


def sector(k, s0, s1, t0, t1, g, mat, wall="steelD", ds=0.05, skip=None):
    """A panel lying on the hull over s0..s1 and the arc t0..t1 (degrees), raised to g times the radius (a number, or
    g(s, t degrees) for a shaped one), walled round. skip(u, v, z) leaves out a cell by its centre (capsule frame):
    a hole for something to fill."""
    gf = g if callable(g) else (lambda s, t: g)
    ns, nt = max(2, int((s1 - s0) / ds)), max(2, int(abs(t1 - t0) / 4))
    S = [s0 + (s1 - s0) * i / ns for i in range(ns + 1)]
    T = [math.radians(t0 + (t1 - t0) * j / nt) for j in range(nt + 1)]

    def P(s, t, gg=None):
        r = k.r(s) * (gf(s, math.degrees(t)) if gg is None else gg)
        return k.f.pt(k.u(s), r * math.cos(t), k.zc + r * math.sin(t))
    for i in range(ns):
        for j in range(nt):
            if skip:
                sm, tm = (S[i] + S[i + 1]) / 2, (T[j] + T[j + 1]) / 2
                rm = k.r(sm) * gf(sm, math.degrees(tm))
                if skip(k.u(sm), rm * math.cos(tm), k.zc + rm * math.sin(tm)):
                    continue
            k.f.poly([P(S[i], T[j]), P(S[i + 1], T[j]), P(S[i + 1], T[j + 1]), P(S[i], T[j + 1])], mat)
    edge = [(S[i], T[0]) for i in range(ns + 1)] + [(S[-1], T[j]) for j in range(1, nt + 1)] + \
        [(S[i], T[-1]) for i in range(ns - 1, -1, -1)] + [(S[0], T[j]) for j in range(nt - 1, 0, -1)]
    for (sa, ta), (sb, tb) in zip(edge, edge[1:] + edge[:1]):
        k.f.poly([P(sa, ta, 0.99), P(sb, tb, 0.99), P(sb, tb), P(sa, ta)], wall)


def on_cone(k, sc, thc, rho, phi, g):
    """A point on the hull round a centre (s sc, angle thc degrees) laid out flat on the cone's face: rho out from the
    centre in the tangent plane, at phi (0 = up the slant toward the collar, 90 = round toward +theta), raised to g x the
    radius. Rings drawn this way lie flush on the cone and look round from square on."""
    sl = math.hypot(1.0, (k.v["rb"] - k.v["rt"]) / k.v["length"])
    s = sc + rho * math.cos(phi) / sl
    r = k.r(s)
    th = math.radians(thc) + rho * math.sin(phi) / r
    return k.f.pt(k.u(s), r * g * math.cos(th), k.zc + r * g * math.sin(th))


def flush_ring(k, sc, thc, r0, r1, g, mat, wall=None, segs=48, g0=None):
    """A ring (r0 = 0: a disc) lying flush on the cone round (sc, thc), raised to g; mat may be a function of the segment
    index (hazard sectors). With wall, its edges are walled down to g0 (default just under the hull)."""
    g0 = 0.995 if g0 is None else g0
    if r0 <= 0.0 and r1 > 0.1:                                             # a wide disc: in rings, so its flat faces
        n = int(r1 / 0.06)                                                 # follow the curve instead of cutting under it
        steps = [r1 * j / n for j in range(n + 1)]
        flush_ring(k, sc, thc, 0.0, steps[1], g, mat, None, segs)
        for a, b in zip(steps[1:], steps[2:]):
            flush_ring(k, sc, thc, a, b, g, mat, None, segs)
        if wall:
            flush_ring(k, sc, thc, r1, r1, g, mat, wall, segs, g0)
        return
    for i in range(segs):
        a0, a1 = i * math.tau / segs, (i + 1) * math.tau / segs
        m = mat(i) if callable(mat) else mat
        if r0 <= 0.0:
            k.f.poly([on_cone(k, sc, thc, 0.0, 0.0, g), on_cone(k, sc, thc, r1, a0, g), on_cone(k, sc, thc, r1, a1, g)], m)
        else:
            k.f.poly([on_cone(k, sc, thc, r0, a0, g), on_cone(k, sc, thc, r1, a0, g), on_cone(k, sc, thc, r1, a1, g),
                      on_cone(k, sc, thc, r0, a1, g)], m)
        if wall:
            for rr in ((r1,) if r0 <= 0.0 else (r0, r1)):
                k.f.poly([on_cone(k, sc, thc, rr, a0, g0), on_cone(k, sc, thc, rr, a1, g0), on_cone(k, sc, thc, rr, a1, g),
                          on_cone(k, sc, thc, rr, a0, g)], wall)


def in_port(k, u, v, z, pad=0.0):
    """Is the capsule point (u, v, z) inside the docking port's outer ring (+ pad), measured flat on the cone?"""
    sc, ro, _ = PORT
    sl = math.hypot(1.0, (k.v["rb"] - k.v["rt"]) / k.v["length"])
    s = u - k.s0
    th = math.atan2(z - k.zc, v)
    dth = (th - math.radians(270) + math.pi) % math.tau - math.pi
    return math.hypot((s - sc) * sl, dth * k.r(s)) < ro + pad


def viewport(k):
    """The front: the DOCKING PORT, a round hatch lying flush in the cone's face (it docks by tipping the whole pod forward
    by the cone's slope, so the hatch stands square to the airlock's collar): a raised hazard ring, a steel seal ring, the
    round hatch inside it, a porthole and a handle on it. It cuts the safety band. Two windows either side of it up by the
    shoulder, so the pod has a face."""
    _g("port")
    ln = k.v["length"]
    sc, ro, rh = PORT
    flush_ring(k, sc, 270, rh + 0.035, ro, 1.035, lambda i: "hazY" if (i // 3) % 2 else "hazK", "steelD")   # hazard ring
    flush_ring(k, sc, 270, rh, rh + 0.035, 1.03, "steelD", "steelD")      # the seal
    flush_ring(k, sc, 270, 0.0, rh, 1.012, "plate", "dark")               # the hatch, a little below the rings
    flush_ring(k, sc + rh * 0.42, 270, 0.0, 0.12, 1.02, "steelD", "steelD", segs=24)   # its porthole
    flush_ring(k, sc + rh * 0.42, 270, 0.0, 0.085, 1.026, "glassD", "steelD", segs=24)
    sh = sc - rh * 0.45                                                    # a handle across its lower half
    sector(k, sh - 0.025, sh + 0.025, 270 - 11, 270 + 11, 1.035, "hazY", "steelD")
    _g("windows")
    for cc in (270 - 62, 270 + 62):
        sector(k, ln * 0.62, ln * 0.84, cc - 12, cc + 12, 1.02, "steelD")
        sector(k, ln * 0.64, ln * 0.82, cc - 9, cc + 9, 1.03, "glassD", "steelD")


def rcs(k):
    """Four RCS quads round the shoulder: a block with two nozzle stubs."""
    _g("rcs")
    s = k.v["length"] * 0.9
    for th in (0, 180):
        p, n = k.on(s, th)
        stud(k.f, p, n, 0.08, 0.06, HULL_D, "steelD", sides=4)
        q = tuple(p[i] + n[i] * 0.06 for i in range(3))
        stud(k.f, q, n, 0.035, 0.04, "steelD", "dark", sides=8)


PACK = (0.06, 0.82, 36, 0.34)  # the drive fairing: s range (x the cone's length), half arc (degrees), bulge (x the radius)
BORE = (0.13, 0.2)            # the thrusters' bores: radius, depth into the fairing


def drive(k, lit):
    """The DRIVE PACK on the back (theta 90): a fairing moulded onto the cone, thick and round-nosed low down, thinning
    into the hull toward the shoulder, steel with a yellow stripe and vent slots. Two thrusters SUNK in it, as the mining
    pod's rear thruster is: each in a bore cut straight aft into the fairing's thick part (the fairing is cut round it,
    a rim ring over the cut), a short flared bell inside running up to the mouth, its inner wall and throat lit."""
    _g("drive")
    f, ln = k.f, k.v["length"]
    sa, sb, half, bump = PACK[0], PACK[1] * ln, PACK[2], PACK[3]
    br, depth = BORE

    def g(s, t, extra=0.0):
        x = (s - sa) / (sb - sa)
        along = min(1.0, (s - sa) / 0.1) ** 0.5 * (1 - x * x * (3 - 2 * x))            # round nose low, thin out up top
        across = math.sqrt(max(0.0, 1 - ((t - 90) / half) ** 2))
        return 1.012 + extra + bump * along * across
    n = (0.0, 0.0, 1.0)                                                     # straight aft
    sb_ = sa + 0.27
    mouths = []
    for t in (90 - 16, 90 + 16):
        th = math.radians(t)
        r = k.r(sb_) * g(sb_, t)
        mouths.append((k.u(sb_), r * math.cos(th), k.zc + r * math.sin(th)))

    def hole(u, v, z):
        return any(math.hypot(u - m[0], v - m[1]) < br + 0.015 for m in mouths)
    sector(k, sa, sb, 90 - half, 90 + half, g, "steelL", "steelD", ds=0.025, skip=hole)
    sector(k, sb_ + 0.16, sb - 0.12, 90 - 4, 90 + 4, lambda s, t: g(s, t, 0.01), "hazY", "hazK", ds=0.03)   # the stripe
    for t in (90 - 20, 90 + 20):                                            # vent slots up the thin part
        for s0 in (0.6, 0.67):
            sector(k, s0 * ln, s0 * ln + 0.04, t - 5, t + 5, lambda s, tt: g(s, tt, 0.006), "dark", "dark", ds=0.02)
    for m in mouths:
        lo = m[2] - depth                                                   # the bore's floor
        top = m[2] + 0.04
        tube(f, (m[0], m[1], lo), n, br, br, top - lo, "steelD")             # its wall
        disc(f, (m[0], m[1], lo), n, 0.0, br, "dark")                       # its floor
        tube(f, (m[0], m[1], top - 0.07), n, br + 0.045, br + 0.045, 0.08, "steelD")   # the rim over the cut
        disc(f, (m[0], m[1], top + 0.01), n, br - 0.005, br + 0.045, "steelL")
        tube(f, (m[0], m[1], lo), n, 0.05, br - 0.02, depth - 0.02, HULL_K)   # the bell, throat to mouth
        tube(f, (m[0], m[1], lo + 0.005), n, 0.04, br - 0.035, depth - 0.03, GLOW if lit else "dark")   # its inner wall
        disc(f, (m[0], m[1], lo + 0.01), n, 0.0, 0.045, "arc" if lit else "dark")   # the injector


def pod(heading, variant="h", state="fly", beacon=False):
    """The escape pod at a heading (grid radians, 0 = +x); state fly / drift / docked / parked."""
    v = VARIANTS[variant]
    # it leans back only while it flies; docked it tips forward by the cone's slope, so the port in its face stands square
    # to the airlock; otherwise it stands upright
    slope = math.degrees(math.atan((v["rb"] - v["rt"]) / v["length"]))
    t = math.radians(v["tilt"] if state == "fly" else 90 - slope if state == "docked" else 90)
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
