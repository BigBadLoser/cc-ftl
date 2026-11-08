"""The ESCAPE POD (vehicle.escape_pod): a sealed one-seat lifeboat that flies itself. Pod family (pod_family.py), a little
smaller than the mining pod (content size 2.2 against 2.6).

A re-entry capsule of our own: a truncated CONE with a broad, shallow HEAT SHIELD at its base and the DOCKING COLLAR (a
hatch in a ring) at its narrow top. A hi-vis orange safety band round the base, a hazard ring round the collar, one
small viewport, an emergency BEACON by the collar, four RCS quads round the shoulder and a ring of small drive nozzles.

Capsule frame: built along its own axis s (s = 0 the heat shield's rim, +s toward the collar), laid along the craft's u
(Spin(heading); u = the heading), the axis level at height ZC. A variant (VARIANTS) sets the cone and which end leads in
flight: "collar" (nose first, the drive nozzles on the shield) or "shield" (heat shield first, the nozzles round the
collar). The model is always built nose (+s) along +u, in a frame turned half a turn when the shield leads, so every
surface keeps its winding.

States: fly (drive lit), drift (no drive; `beacon` lights the lamp), docked / parked (dark)."""
import math

from . import core
from .shuttle_craft import Spin, _g, smooth

HULL, HULL_D, HULL_K = "medWhite", "steelL", "steel"   # a light hull, steel trim
BAND = "hivis"                # the safety band
SHIELD, SHIELD_D = "rustD", "leather"                 # the heat shield's ablative face, scorched dark
GLOW = "cyan"                 # drive nozzles (the ship's drives glow cyan too)
BEACON = "orange"             # the emergency beacon

# variant: base radius, top radius, cone length, neck (radius, length) or None, heat-shield depth, which end leads
VARIANTS = {
    "a": dict(rb=0.72, rt=0.3, length=1.4, neck=None, dish=0.12, lead="collar", label="A steep, nose first"),
    "b": dict(rb=0.84, rt=0.42, length=0.92, neck=None, dish=0.14, lead="shield", label="B squat, shield first"),
    "c": dict(rb=0.74, rt=0.36, length=0.84, neck=(0.34, 0.36), dish=0.12, lead="collar", label="C cone and neck"),
}
SIDES = 48


class Capsule:
    def __init__(self, f, v, zc):
        self.f, self.v, self.zc = f, v, zc
        top = v["length"] + (v["neck"][1] if v["neck"] else 0.0)
        self.s0 = -(top - v["dish"]) / 2                       # u of the shield's rim: the whole craft centred on u = 0
        self.top = top

    def u(self, s):
        return self.s0 + s

    def r(self, s):
        """The hull's radius at s (cone, then neck)."""
        v = self.v
        if s <= v["length"]:
            return v["rb"] + (v["rt"] - v["rb"]) * s / v["length"] if v["neck"] is None else \
                v["rb"] + (v["neck"][0] - v["rb"]) * s / v["length"]
        return v["neck"][0]

    def cyl(self, s0, s1, r0, r1, mat, sides=SIDES, cap=None, capstart=None):
        self.f.hcyl(self.u(s0), self.u(s1), 0, self.zc, r0, mat, r1=r1, sides=sides, cap=cap, capstart=capstart)

    def on(self, s, theta, out=0.0):
        """A point on the hull at s, angle theta round the axis (0 = +v, 90 = top), out of it by `out`, and its outward
        normal and the axis direction, in (u, v, z)."""
        v = self.v
        rb, re, ln = v["rb"], (v["rt"] if v["neck"] is None else v["neck"][0]), v["length"]
        slope = (rb - re) / ln if s <= ln else 0.0               # the radius falls this much per unit of s
        c, sn = math.cos(math.radians(theta)), math.sin(math.radians(theta))
        nl = math.hypot(1.0, slope)
        n = (slope / nl, c / nl, sn / nl)
        r = self.r(s)
        p = (self.u(s) + n[0] * out, (r * c) + n[1] * out, self.zc + r * sn + n[2] * out)
        return p, n


def _ring_pts(f, c, n, a, r, sides):
    b = (n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0])
    out = []
    for i in range(sides):
        t = i * math.tau / sides
        ct, st = math.cos(t), math.sin(t)
        out.append(f.pt(*(c[q] + (a[q] * ct + b[q] * st) * r for q in range(3))))
    return out


def stud(f, c, n, r, h, mat, cap, sides=16, r1=None):
    """A short round boss standing out of a surface at c along its unit normal n: radius r (r1 at its face), h tall."""
    a = (-n[1], n[0], 0.0) if abs(n[2]) < 0.9 else (1.0, 0.0, 0.0)
    al = math.sqrt(sum(x * x for x in a))
    a = tuple(x / al for x in a)
    a = tuple(a[q] - n[q] * sum(a[k] * n[k] for k in range(3)) for q in range(3))
    al = math.sqrt(sum(x * x for x in a))
    a = tuple(x / al for x in a)
    A = _ring_pts(f, tuple(c[q] - n[q] * 0.02 for q in range(3)), n, a, r, sides)
    B = _ring_pts(f, tuple(c[q] + n[q] * h for q in range(3)), n, a, r if r1 is None else r1, sides)
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
    """The cone (and the neck), the safety band round its base, a few seams, the shoulder ring."""
    _g("hull")
    v = k.v
    ln = v["length"]
    marks = [0.0, 0.06, 0.26, ln * 0.62, ln * 0.62 + 0.035, ln]
    mats = [HULL_D, BAND, HULL, HULL_D, HULL]
    for (a, b), m in zip(zip(marks, marks[1:]), mats):
        k.cyl(a, b, k.r(a) * (1.008 if m == BAND else 1.0), k.r(b) * (1.008 if m == BAND else 1.0), m)
    if v["neck"]:
        nr, nl = v["neck"]
        k.cyl(ln, ln + 0.05, nr * 1.08, nr * 1.08, HULL_D)                # the shoulder ring
        k.cyl(ln + 0.05, ln + nl, nr, nr, HULL)


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
    s = (k.v["length"] if k.v["neck"] is None else k.v["length"] + k.v["neck"][1]) - 0.16
    p, nn = k.on(s, 90)
    stud(f, p, nn, 0.09, 0.05, "steelD", "steelD")                         # its base
    q = tuple(p[i] + nn[i] * 0.05 for i in range(3))
    stud(f, q, nn, 0.07, 0.09, BEACON if beacon_on else "drD", BEACON if beacon_on else "drM", r1=0.05)


def viewport(k):
    """One small window on the cone's flank, up and to the side, in a thick frame."""
    _g("viewport")
    s = k.v["length"] * 0.45
    for side in (40,):
        p, n = k.on(s, side)
        stud(k.f, p, n, 0.15, 0.03, "steelD", "steelD")
        q = tuple(p[i] + n[i] * 0.03 for i in range(3))
        stud(k.f, q, n, 0.11, 0.01, "glassD", "glassD")
        q2 = tuple(q[i] + n[i] * 0.012 for i in range(3))
        stud(k.f, (q2[0], q2[1], q2[2] + 0.03), n, 0.035, 0.004, "lens", "lens", sides=8)


def rcs(k):
    """Four RCS quads round the shoulder: a block with two nozzle stubs."""
    _g("rcs")
    s = k.v["length"] * 0.82
    for th in (45, 135, 225, 315):
        p, n = k.on(s, th)
        stud(k.f, p, n, 0.08, 0.06, HULL_D, "steelD", sides=4)
        q = tuple(p[i] + n[i] * 0.06 for i in range(3))
        stud(k.f, q, n, 0.035, 0.04, "steelD", "dark", sides=8)


def drive(k, lit):
    """Small drive nozzles: on the heat shield's rim when the collar leads, round the collar's root when the shield leads,
    all pointing aft."""
    _g("drive")
    f = k.f
    if k.v["lead"] == "collar":
        u = k.u(-0.04 - k.v["dish"] * 0.4)
        ring = k.v["rb"] * 0.72
        for i in range(4):
            a = math.radians(45 + i * 90)
            v, z = ring * math.cos(a), k.zc + ring * math.sin(a)
            f.hcyl(u - 0.08, u, v, z, 0.1, "steelD", r1=0.065, sides=12, capstart=GLOW if lit else "dark")
    else:
        t = k.top
        ring = k.r(t) * 0.92 + 0.07
        for i in range(4):
            a = math.radians(45 + i * 90)
            v, z = ring * math.cos(a), k.zc + ring * math.sin(a)
            f.hcyl(k.u(t - 0.05), k.u(t + 0.08), v, z, 0.06, "steelD", r1=0.09, sides=12, cap=GLOW if lit else "dark")


def pod(heading, variant="a", state="fly", beacon=False):
    """The escape pod at a heading (grid radians, 0 = +x), its axis level; state fly / drift / docked / parked."""
    v = VARIANTS[variant]
    m = core.Mesh(f"escape_pod_{variant}_{state}")
    f = Spin(m, heading + (math.pi if v["lead"] == "shield" else 0.0))
    k = Capsule(f, v, zc=v["rb"] * 1.04 + 0.04)
    heat_shield(k)
    body(k)
    collar(k, beacon)
    viewport(k)
    rcs(k)
    drive(k, state == "fly")
    return [smooth(m.build())]
