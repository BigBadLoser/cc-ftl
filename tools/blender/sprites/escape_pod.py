"""The ESCAPE POD (vehicle.escape_pod): a sealed one-seat lifeboat that flies itself. Pod family (pod_family.py), a little
smaller than the mining pod (content size 2.2 against 2.6).

A re-entry capsule of our own: a squat truncated CONE with a broad, shallow HEAT SHIELD at its base and the HATCH COLLAR
stepped in at its narrow top: the crew-sized round hatch in a hazard ring, the only way in or out. It docks nose first,
like the old crew capsules: turned on its side, the hatch to an airlock's collar. A hi-vis orange safety band round the
base, a porthole looking forward (the heading), access plates and a vent, an emergency BEACON on the back of the shoulder, RCS quads round the
shoulder, the DRIVE PACK on the back with two thrusters sunk in it.

Capsule frame: built along its own axis s (s = 0 the heat shield's rim, +s toward the collar) laid along u, then turned by
`tilt` (Tilted: 0 = on its side, the hatch forward; 90 = upright, heat shield down; more leans the collar back so the
shield leads) and to the heading (Spin; u = the heading). Round the axis, theta 270 faces forward when upright (the
porthole), 90 aft (the drive pack, the beacon). A variant (VARIANTS) sets the cone's proportions, its `bulge` (1 =
straight sides, more = a rounded gumdrop shoulder) and the flying tilt.

States: fly (drive lit, leaning by the variant's tilt), drift (upright, no drive; `beacon_on` lights the lamp: the blink's
on frame), docked (dark, on its side, hatch forward to the airlock), parked (upright, dark)."""
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
VARIANTS = {
    "h": dict(rb=1.0, rt=0.58, length=1.25, bulge=1.0, dish=0.16, tilt=105, drive="pack", label="H"),
}
SIDES = 48
COLLAR = 0.91                 # the hatch collar's radius, x the cone's top: it steps in, a ledge round it
HATCH = 0.8                   # the hatch's radius, x the collar's (0.42: crew-sized); the hazard ring round it is the rest
WHEEL, WHEEL_D = "plate", "steelL"   # the hatch's hand wheel: light steel on the darker hatch
GLASS = "bK"                  # porthole glass: a deep blue
PANEL = "sole"                # the access plates' light grey
PORTHOLE = (0.68, 0.18)       # the front porthole: its height (x the cone's length), bezel radius
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
    """The cone, a few seams, and the safety band round its base."""
    _g("hull")
    ln = k.v["length"]
    marks = [0.0, 0.06, 0.3, ln * 0.84, ln * 0.84 + 0.06, ln]          # (the seam runs above the porthole)
    mats = [HULL_D, HULL, HULL, HULL_D, HULL]
    sa, sb, half = PACK[0], PACK[1] * ln, PACK[2]

    def ring(s0, s1, g, m):                                                 # open under the drive pack, so its
        if s0 >= sa and s1 <= sb:                                           # thrusters' bores run deep (the pack
            sector(k, s0, s1, 90 + half, 450 - half, g, m, m, ds=s1 - s0)   # covers the gap)
        else:
            k.cyl(s0, s1, k.r(s0) * g, k.r(s1) * g, m)
    for (a, b), m in zip(zip(marks, marks[1:]), mats):
        n = max(1, int((b - a) / 0.06))
        for i in range(n):
            ring(a + (b - a) * i / n, a + (b - a) * (i + 1) / n, 1.0, m)
    _g("band")
    for i in range(4):
        ring(0.06 + 0.06 * i, 0.12 + 0.06 * i, 1.008, BAND)


def collar(k):
    """The HATCH COLLAR at the cone's narrow top, the pod's only way in or out: it docks nose first, the pod turned on its
    side with this end to the airlock's collar, like the old crew capsules. A steel ledge round it, a barrel rising to a
    mating ring flush with it, black-and-yellow hazard sectors on its face, and the crew-sized round hatch set a little
    down inside: a hand wheel at its centre, a porthole aft."""
    _g("collar")
    t = k.top
    f = k.f
    disc(f, (k.u(t), 0.0, k.zc), (1.0, 0.0, 0.0), 0.0, k.r(t), HULL_D, sides=SIDES)   # the ledge, closing the cone
    r = k.r(t) * COLLAR
    rh = r * HATCH
    k.cyl(t - 0.02, t + 0.1, r, r, HULL_K)                                 # the collar's barrel
    k.cyl(t + 0.1, t + 0.15, r, r, "steelD")                               # its mating ring, flush
    u = k.u(t + 0.15)
    n = 24
    for i in range(n):                                                     # hazard sectors on the ring's face
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        pts = [f.pt(u + 0.002, rr * math.cos(a), k.zc + rr * math.sin(a)) for rr, a in ((rh, a0), (rh, a1), (r, a1), (r, a0))]
        f.poly(pts[::-1], "hazY" if i % 2 else "hazK")
    ax = (1.0, 0.0, 0.0)
    tube(f, (u - 0.03, 0.0, k.zc), ax, rh, rh, 0.032, "dark", sides=40)     # the step down to the hatch
    disc(f, (u - 0.03, 0.0, k.zc), ax, 0.0, rh, "steel", sides=40)          # the hatch
    wz, wr, ww, th = k.zc - 0.1, 0.23, 0.055, 0.045                       # its HAND WHEEL, one piece close on the hatch:
    w0 = u - 0.03 + 0.03                                                   # a light steel rim, three solid spokes into it
    w1 = w0 + th                                                           # and a hub on a short shaft
    tube(f, (w0, 0.0, wz), ax, wr, wr, th, WHEEL_D, sides=28)
    tube(f, (w0, 0.0, wz), ax, wr - ww, wr - ww, th, WHEEL_D, sides=28)
    disc(f, (w1, 0.0, wz), ax, wr - ww, wr, WHEEL, sides=28)
    disc(f, (w0, 0.0, wz), ax, wr - ww, wr, WHEEL_D, sides=28)
    for i in range(3):
        a = math.radians(90 + i * 120)
        cv, cz = math.cos(a), math.sin(a)
        p0, p1 = (0.0, 0.0), ((wr - ww / 2) * cv, (wr - ww / 2) * cz)
        sv, sz = -cz * 0.028, cv * 0.028                                  # half the spoke's width, square to it
        q = [(p0[0] - sv, p0[1] - sz), (p1[0] - sv, p1[1] - sz), (p1[0] + sv, p1[1] + sz), (p0[0] + sv, p0[1] + sz)]
        f.poly([f.pt(w1, x, wz + z) for x, z in q], WHEEL)                 # its face
        for (xa, za), (xb, zb) in ((q[0], q[1]), (q[2], q[3])):           # its sides
            f.poly([f.pt(w0, xa, wz + za), f.pt(w0, xb, wz + zb), f.pt(w1, xb, wz + zb), f.pt(w1, xa, wz + za)], WHEEL_D)
    stud(f, (u - 0.03, 0.0, wz), ax, 0.045, 0.03, "steelD", "steelD", sides=12)   # the shaft
    stud(f, (w0, 0.0, wz), ax, 0.07, th + 0.015, WHEEL_D, WHEEL, sides=16)   # the hub
    stud(f, (u - 0.03, 0.0, k.zc + rh * 0.62), ax, 0.09, 0.02, "steelD", "steelD", sides=16)   # a porthole, aft
    stud(f, (u - 0.01, 0.0, k.zc + rh * 0.62), ax, 0.06, 0.006, "glassD", "glassD", sides=16)


def beacon(k, on):
    """The emergency beacon on the back of the shoulder, below the collar: a base, a big lamp with a rounded top."""
    _g("beacon")
    p, nn = k.on(k.v["length"] - 0.13, 90)
    stud(k.f, p, nn, 0.12, 0.05, "steelD", "steelD")
    q = tuple(p[i] + nn[i] * 0.05 for i in range(3))
    lamp, cap = (BEACON, BEACON) if on else ("drD", "drM")
    stud(k.f, q, nn, 0.1, 0.14, lamp, lamp, r1=0.085)
    q = tuple(q[i] + nn[i] * 0.14 for i in range(3))
    stud(k.f, q, nn, 0.085, 0.04, cap, cap, r1=0.05)
    stud(k.f, tuple(q[i] + nn[i] * 0.04 for i in range(3)), nn, 0.03, 0.03, "steelD", "steelD", sides=8)


def sector(k, s0, s1, t0, t1, g, mat, wall="steelD", ds=0.05, skip=None, dt=4.0):
    """A panel lying on the hull over s0..s1 and the arc t0..t1 (degrees), raised to g times the radius (a number, or
    g(s, t degrees) for a shaped one), walled round. skip(u, v, z) leaves out a cell by its centre (capsule frame):
    a hole for something to fill."""
    gf = g if callable(g) else (lambda s, t: g)
    ns, nt = max(2, int((s1 - s0) / ds)), max(2, int(abs(t1 - t0) / dt))
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


def viewport(k):
    """The front: one round PORTHOLE looking forward, up by the shoulder (the heading): a raised steel bezel, the deep
    blue glass set in it, a small glint."""
    _g("porthole")
    p, n = k.on(k.v["length"] * PORTHOLE[0], 270)
    rb_, rg = PORTHOLE[1], PORTHOLE[1] - 0.05
    stud(k.f, p, n, rb_, 0.04, "steelL", "steelL", sides=28)               # the bezel
    q = tuple(p[i] + n[i] * 0.03 for i in range(3))
    stud(k.f, q, n, rg, 0.02, GLASS, GLASS, sides=28)                      # the glass, a little below its rim
    up = (1.0, 0.0, 0.0)
    g = tuple(q[i] + n[i] * 0.02 + up[i] * rg * 0.4 + (0.0, 1.0, 0.0)[i] * rg * 0.35 for i in range(3))
    stud(k.f, g, n, 0.04, 0.004, "glassL", "glassL", sides=10)             # a glint


def plate(k, s0, s1, t0, t1, mat=None):
    """A raised access plate on the hull, its own lighter grey, so its edge reads by colour alone: its rim is its own
    colour too (a darker rim thinner than a pixel comes and goes along the edge, ragged)."""
    m = mat or PANEL
    sector(k, s0, s1, t0, t1, 1.012, m, m, ds=0.03, dt=2.0)


def panels(k):
    """Detail on the plain hull: a big ACCESS PLATE on each side with two latches on its forward edge, a narrow one either
    side of the drive pack, and a louvred VENT on the front below the porthole."""
    _g("panels")
    ln = k.v["length"]
    for c in (0, 180):                                                     # the sides' access plates
        s0, s1, t0, t1 = 0.38, ln * 0.62, c - 16, c + 16
        plate(k, s0, s1, t0, t1)
        tl = t0 + 4 if c == 0 else t1 - 4                                  # latches on the edge toward the front (270)
        for ss in (s0 + (s1 - s0) * 0.28, s0 + (s1 - s0) * 0.72):
            sector(k, ss - 0.035, ss + 0.035, tl - 3.5, tl + 3.5, 1.028, "steelD", "steelD", ds=0.02, dt=1.0)
    for c in (90 - 50, 90 + 50):                                           # narrow plates by the drive pack
        plate(k, 0.42, ln * 0.6, c - 7, c + 7)
    _g("vent")                                                             # a louvred vent below the porthole:
    v0, v1, h = 0.34, 0.6, 15                                              # a raised frame, dark inside, three slats
    sector(k, v0, v1, 270 - h, 270 + h, 1.016, "steelD", "steel", ds=0.02, dt=1.0)
    for i in range(3):
        sa = v0 + 0.045 + i * 0.065
        sector(k, sa, sa + 0.045, 270 - h + 3, 270 + h - 3, 1.03, "steelL", "steel", ds=0.015, dt=1.0)


def rcs(k):
    """Four RCS quads round the shoulder: a block with two nozzle stubs."""
    _g("rcs")
    s = k.v["length"] * 0.9
    for th in (0, 180):
        p, n = k.on(s, th)
        stud(k.f, p, n, 0.08, 0.06, HULL_D, "steelD", sides=4)
        q = tuple(p[i] + n[i] * 0.06 for i in range(3))
        stud(k.f, q, n, 0.035, 0.04, "steelD", "dark", sides=8)


PACK = (0.06, 0.8, 32, 0.08)  # the drive fairing: s range (x the cone's length), half arc (degrees), bulge (x the radius)
BORE = (0.13, 0.2, 0.09)      # the thrusters' bores: radius, depth into the pack, how far the cowl stands out of it


def drive(k, lit):
    """The DRIVE PACK on the back (theta 90): a low steel slab lying on the cone, even in thickness with its edges rolled
    (no hump: it must not stick out when the pod lies on its side to dock), a yellow stripe and vent
    slots. Two thrusters SUNK in it, as the mining pod's rear thruster is: each in a round bore running in square to the
    slab (the hull is open under the pack, so it runs deep), a round cowl standing out of the cut, a short flared bell inside running
    up to the mouth, its inner wall and throat lit."""
    _g("drive")
    f, ln = k.f, k.v["length"]
    sa, sb, half, bump = PACK[0], PACK[1] * ln, PACK[2], PACK[3]
    br, depth, out = BORE

    def ease(d, w):                                                         # 0 at an edge, 1 once w in from it
        x = min(1.0, max(0.0, d / w))
        return x * x * (3 - 2 * x)

    def g(s, t, extra=0.0):                                                 # an even slab on the cone, edges rolled
        along = ease(s - sa, 0.06) * ease(sb - s, 0.06)
        across = ease(half - abs(t - 90), 6.0)
        return 1.02 + extra + bump * along * across
    sb_ = sa + 0.27
    mouths = []                                                             # (centre on the slab, its normal)
    for t in (90 - 16, 90 + 16):
        _, n = k.on(sb_, t)
        r, th = k.r(sb_) * g(sb_, t), math.radians(t)
        mouths.append(((k.u(sb_), r * math.cos(th), k.zc + r * math.sin(th)), n))

    def hole(u, v, z):                                                      # a cell near a mouth, measured across the slab
        for c, n in mouths:
            d = (u - c[0], v - c[1], z - c[2])
            along = sum(d[i] * n[i] for i in range(3))
            if math.sqrt(max(0.0, sum(x * x for x in d) - along * along)) < br + 0.03:
                return True
        return False
    sector(k, sa, sb, 90 - half, 90 + half, g, "steelL", "steelL", ds=0.025, skip=hole)   # (rim its own colour: clean)
    sector(k, sb_ + 0.16, sb - 0.12, 90 - 4, 90 + 4, lambda s, t: g(s, t, 0.01), "hazY", "hazK", ds=0.03)   # the stripe
    for t in (90 - 20, 90 + 20):                                            # vent slots up the thin part
        for s0 in (0.6, 0.67):
            sector(k, s0 * ln, s0 * ln + 0.04, t - 5, t + 5, lambda s, tt: g(s, tt, 0.006), "dark", "dark", ds=0.02)
    for c, n in mouths:                                                     # each bore runs in square to the slab
        def at(d):
            return tuple(c[i] + n[i] * d for i in range(3))
        tube(f, at(-depth), n, br, br, depth + out, "steelD", sides=20)      # its wall
        disc(f, at(-depth), n, 0.0, br, "dark", sides=20)                   # its floor
        tube(f, at(-0.03), n, br + 0.13, br + 0.05, out + 0.03, "plate", sides=24)   # a round cowl standing out of the cut, sloped
        disc(f, at(out), n, br, br + 0.05, "steelL", sides=24)              # its lip
        tube(f, at(-depth), n, 0.05, br - 0.02, depth + out - 0.02, HULL_K)  # the bell, throat to mouth
        tube(f, at(-depth + 0.005), n, 0.04, br - 0.035, depth + out - 0.03, GLOW if lit else "dark")   # its inner wall
        disc(f, at(-depth + 0.01), n, 0.0, 0.045, "arc" if lit else "dark")   # the injector


def pod(heading, variant="h", state="fly", beacon_on=False):
    """The escape pod at a heading (grid radians, 0 = +x); state fly / drift / docked / parked."""
    v = VARIANTS[variant]
    # it leans back only while it flies; docked it lies on its side, nose (the hatch) to the airlock; else it stands
    t = math.radians(v["tilt"] if state == "fly" else 0 if state == "docked" else 90)
    span = (-(v["length"] - v["dish"]) / 2 - v["dish"] - 0.05, (v["length"] + v["dish"]) / 2 + 0.2)
    rad = v["rb"] * 1.04
    low = min(u * math.sin(t) + w * math.cos(t) for u in span for w in (-rad, rad))
    m = core.Mesh(f"escape_pod_{variant}_{state}")
    f = Tilted(m, heading + (math.pi if v["drive"] == "collar" else 0.0), t, HOVER - low)
    k = Capsule(f, v)
    heat_shield(k)
    body(k)
    collar(k)
    beacon(k, beacon_on)
    viewport(k)
    panels(k)
    rcs(k)
    drive(k, state == "fly")
    return [smooth(m.build())]
