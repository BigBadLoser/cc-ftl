"""TIP BIN (option A to the ore cage): a hydraulic tipping skip. A shelled plate body in hazard yellow (outer skin, inner
skin a shade darker, a thick flange round the open top): its sides a profile with a vertical back, a front
sloped out to the tipping lip and a curved bottom. It rests on a cradle beam and pivots on an axle through brackets at
the front; two hydraulic rams on the outside of the sides push on lugs at the back to tip it over the lip. The base: a
skid frame of channel rails and cross members. Local frame: modkit.K (front = +v, the lip)."""
import math

import numpy as np
from mathutils import Vector

from . import ore_cage as C
from .modkit import K
from .tip_bin_wear import band, grime, plate

YEL, YEL_L, YEL_D = "nvT2", "nvT1", "nvT3"      # faded paint
S, T = 0.76, 0.05                        # the sides' half width, the plate thickness
BACK, LIP = -0.78, 0.84                  # v of the back and of the lip
TOP_B, TOP_F = 1.27, 1.12                # top edge z at the back and at the lip
ROCK_C, ROCK_R = (-0.1, 1.52), 1.2       # the bottom arc's centre (v, z) and radius
FRONT_B = 0.6                            # v where the sloped front meets the bottom
PIVOT = (0.52, 0.36)                     # the front axle (v, z)
RAM = ((-0.82, 0.24), (-0.42, 0.86))     # ram foot and the lug it pushes (v, z), outside the sides
RAM_U = S + 0.15
RIB, FL = 0.055, 0.16                    # rib depth (flush with the flange's face), the flange's width
HOOPS = (-0.45, 0.0, 0.42)


class TipWear(C.Wear):
    STEPS = {**C.Wear.STEPS, YEL: ((0.5, YEL_D), (0.7, "nvT4"), (0.88, "rust")), YEL_D: ((0.6, "nvT4"), (0.85, "rust")),
             YEL_L: ((0.55, YEL), (0.8, YEL_D))}


def _arc(v, r=ROCK_R):
    return ROCK_C[1] - math.sqrt(max(0.0, r ** 2 - (v - ROCK_C[0]) ** 2))


def profile():
    """The outer side profile (v, z), counter-clockwise: the bottom from back to front, the front up to the lip, the open
    top edge back, the back down. The top edge is the last but one."""
    n = 10
    arc = [(BACK + (FRONT_B - BACK) * i / n, _arc(BACK + (FRONT_B - BACK) * i / n)) for i in range(n + 1)]
    return arc + [(LIP, TOP_F), (BACK, TOP_B)]


def inset(pr, t):
    """The profile moved in by t on every edge but the open top (a convex polygon's offset: neighbouring offset lines
    meet at the new corners)."""
    n = len(pr)
    lines = []
    for i in range(n):
        (a, b), (c, d) = pr[i], pr[(i + 1) % n]
        L = math.hypot(c - a, d - b)
        nx, ny = -(d - b) / L, (c - a) / L                                  # inward for a ccw polygon
        o = 0.0 if i == n - 2 else t
        lines.append(((a + nx * o, b + ny * o), (c - a, d - b)))
    out = []
    for i in range(n):
        (p, r), (q, s) = lines[i - 1], lines[i]
        den = r[0] * s[1] - r[1] * s[0]
        k = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den
        out.append((p[0] + r[0] * k, p[1] + r[1] * k))
    return out


def _skin(k, pr, s, col, inward=False):
    """Plates across ±s along the profile's edges (not the top), facing out (or in)."""
    for i in range(len(pr)):
        if i == len(pr) - 2:
            continue
        (v0, z0), (v1, z1) = pr[i], pr[(i + 1) % len(pr)]
        q = [(s, v0, z0), (-s, v0, z0), (-s, v1, z1), (s, v1, z1)]
        band(k, q[::-1] if inward else q, col)


def tube(k, p0, p1, r, col, sides=8, cap=None):
    """A round tube from p0 to p1 (local u, v, z), capped at both ends."""
    p0, p1 = Vector(p0), Vector(p1)
    a = (p1 - p0).normalized()
    t = a.cross(Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))).normalized()
    s = a.cross(t)
    ring = [(t * math.cos(i * math.tau / sides) + s * math.sin(i * math.tau / sides)) * r for i in range(sides)]
    for i in range(sides):
        j = (i + 1) % sides
        C._poly(k, [tuple(p0 + ring[i]), tuple(p0 + ring[j]), tuple(p1 + ring[j]), tuple(p1 + ring[i])], col)
    C._poly(k, [tuple(p1 + q) for q in ring], cap or col)
    C._poly(k, [tuple(p0 + q) for q in ring[::-1]], cap or col)


def body(k, w):
    pr = profile()
    ip = inset(pr, T)
    for s in (-1, 1):
        plate(k, pr, s * S, YEL, flip=s < 0)                                # outer side plate
        plate(k, ip, s * (S - T), YEL_D, flip=s > 0)                        # its inner face
    _skin(k, pr, S, YEL)
    _skin(k, ip, S - T, YEL_D, inward=True)
    # the top flange, thick enough to cover the shell's edge: across the back and the lip, along the sloped sides
    flange(k)
    for v in HOOPS:
        hoop(k, w, v)
    for u in (-0.4, 0.0, 0.4):
        back_rib(k, w, u)
    for s in (-1, 1):                                                       # ram lugs: a plate pair and its pin
        k.box(s * (S + 0.05), RAM[1][0], RAM[1][1] - 0.12, 0.1, 0.24, 0.24, "steelD", top="steel")
        for du in (-0.045, 0.045):
            slab(k, [(s * (RAM_U + du), RAM[1][0] + dv, z) for dv, z in
                     ((-0.12, RAM[1][1] + 0.12), (0.1, RAM[1][1] + 0.12), (0.06, RAM[1][1] - 0.08), (-0.08, RAM[1][1] - 0.08))],
                 (1, 0, 0), 0.025, "steelD")
        tube(k, (s * (S + 0.08), *RAM[1]), (s * (RAM_U + 0.08), *RAM[1]), 0.03, "steelL", sides=6)


def flange(k):
    """One continuous rim round the open top, mitred at the corners, following the sloped top edge; its outer face flush
    with the ribs."""
    o = [(-S - RIB, BACK - RIB), (S + RIB, BACK - RIB), (S + RIB, LIP + RIB), (-S - RIB, LIP + RIB)]
    i = [(u - math.copysign(FL, u), v - math.copysign(FL, v - (BACK + LIP) / 2)) for u, v in o]
    top = lambda p, dz=0.03: Vector((p[0], p[1], top_z(p[1]) + dz))       # noqa: E731
    bot = lambda p: top(p, -0.07)                                          # noqa: E731
    c = Vector((0, (BACK + LIP) / 2, 0))
    lerp = lambda p, q, t: (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)   # noqa: E731
    for a in range(4):
        b = (a + 1) % 4
        mid = Vector(((o[a][0] + o[b][0]) / 2, (o[a][1] + o[b][1]) / 2, 0)) - c
        n = max(1, round(math.dist(o[a], o[b]) / 0.045))                    # in pieces, for the wear
        for j in range(n):
            o0, o1 = lerp(o[a], o[b], j / n), lerp(o[a], o[b], (j + 1) / n)
            i0, i1 = lerp(i[a], i[b], j / n), lerp(i[a], i[b], (j + 1) / n)
            for m in range(4):                                             # across the rim too, so chips are spots
                a0, a1 = lerp(o0, i0, m / 4), lerp(o0, i0, (m + 1) / 4)
                b0, b1 = lerp(o1, i1, m / 4), lerp(o1, i1, (m + 1) / 4)
                _face(k, [top(a0), top(b0), top(b1), top(a1)], (0, 0, 1), YEL_L)
            for m in range(3):                                             # its outer face in rows
                za, zb = 0.03 - 0.1 * m / 3, 0.03 - 0.1 * (m + 1) / 3
                _face(k, [top(o0, za), top(o1, za), top(o1, zb), top(o0, zb)], mid, YEL)
            _face(k, [top(i0), top(i1), bot(i1), bot(i0)], -mid, YEL_D)
            _face(k, [bot(o0), bot(o1), bot(i1), bot(i0)], (0, 0, -1), YEL_D)


def top_z(v):
    return TOP_B + (TOP_F - TOP_B) * (v - BACK) / (LIP - BACK)


def _arc_n(v):
    """The bottom's outward normal at v (local u, v, z)."""
    z = _arc(v)
    return Vector((0, (v - ROCK_C[0]) / ROCK_R, (z - ROCK_C[1]) / ROCK_R))


def hoop(k, w, v):
    """A rib round the body at v: up one side, under the bottom, up the other, its face flush with the rim flange."""
    zt, zb = top_z(v) - 0.07, _arc(v)
    nb = _arc_n(v)
    pts = []
    for s in (1, -1):
        side = Vector((s, 0, 0))
        corner = (side + nb).normalized()
        run = [(Vector((s * S, v, zt)), side, 1.0), (Vector((s * S, v, zb + 0.06)), side, 1.0),
               (Vector((s * S, v, zb)), corner, 1 / corner.dot(side))]
        pts += run if s > 0 else run[::-1]
    pts = pts[:3] + [(Vector((0, v, zb)), nb, 1.0)] + pts[3:]
    strip(k, pts, RIB, 0.08, YEL)


def back_rib(k, w, u):
    """A rib down the back, flush with the flange at the top, running on under the bottom and dying away."""
    back = Vector((0, -1, 0))
    zb = _arc(BACK)
    corner = (back + _arc_n(BACK)).normalized()
    pts = [(Vector((u, BACK, TOP_B - 0.07)), back, 1.0), (Vector((u, BACK, zb + 0.06)), back, 1.0),
           (Vector((u, BACK, zb)), corner, 1 / corner.dot(back))]
    for i, v in enumerate((-0.68, -0.56, -0.44)):
        pts.append((Vector((u, v, _arc(v))), _arc_n(v), 1.0 - 0.3 * (i + 1)))
    strip(k, pts, RIB, 0.08, YEL, b=Vector((1, 0, 0)))


def _face(k, pts, want, col):
    """A polygon turned to face `want`."""
    P = [Vector(p) for p in pts]
    n = Vector()
    for i, a in enumerate(P):
        b = P[(i + 1) % len(P)]
        n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
    C._poly(k, [tuple(p) for p in (P if n.dot(Vector(want)) >= 0 else P[::-1])], col)


def strip(k, path, depth, width, col, b=None):
    """A rib of rectangular section along path [(point, outward normal, depth scale)], its back on the surface."""
    b = b or Vector((0, 1, 0))
    h = b * width / 2
    fine = [path[0]]                                                       # in pieces, for the wear
    for (p0, n0, f0), (p1, n1, f1) in zip(path, path[1:]):
        m = max(1, math.ceil((p1 - p0).length / 0.07))
        fine += [(p0.lerp(p1, t / m), n0.lerp(n1, t / m).normalized(), f0 + (f1 - f0) * t / m) for t in range(1, m + 1)]
    path = fine
    rows = [(p - h, p + h, p - h + n * depth * f, p + h + n * depth * f, n) for p, n, f in path]
    for (l0, r0, lo0, ro0, n0), (l1, r1, lo1, ro1, n1) in zip(rows, rows[1:]):
        _face(k, [lo0, ro0, ro1, lo1], n0 + n1, col)
        _face(k, [l0, lo0, lo1, l1], -b, col)
        _face(k, [r0, ro0, ro1, r1], b, col)
    for (l, r, lo, ro, _), d in ((rows[0], path[0][0] - path[1][0]), (rows[-1], path[-1][0] - path[-2][0])):
        _face(k, [l, r, ro, lo], d, col)


def slab(k, pts, axis, t, col, side=None):
    """A flat plate: the planar polygon pts thickened by t along axis."""
    a = Vector(axis).normalized() * t / 2
    P = [Vector(p) for p in pts]
    c = sum(P, Vector()) / len(P)
    f, b = [p + a for p in P], [p - a for p in P]
    _face(k, f, a, col)
    _face(k, b, -a, col)
    for i in range(len(P)):
        j = (i + 1) % len(P)
        _face(k, [b[i], b[j], f[j], f[i]], (P[i] + P[j]) / 2 - c, side or col)


def heap(k, fill, ore, rng):
    """Loose ore inside the shell: a jittered surface clipped to the inner profile at each height, chunks on it."""
    level, rise = C.HEAP[fill]
    level = 0.4 + (TOP_F - 0.45) * (level - 0.2) / (C.HEAP["full"][0] - 0.2)
    ip = inset(profile(), T)
    front = (ip[-3], ip[-2])                                                # the inner front edge (bottom, lip)

    def span(z):
        rin = ROCK_R - T
        dz = ROCK_C[1] - z
        half = math.sqrt(max(0.0, rin ** 2 - dz ** 2))
        (a, b), (c, d) = front
        vf = a + (c - a) * min(1.0, max(0.0, (z - b) / (d - b)))
        return max(BACK + T, ROCK_C[0] - half) + 0.02, min(vf, ROCK_C[0] + half) - 0.02

    o = C.ORES[ore]
    a = S - T - 0.02
    nu, nv = 14, 14

    def at(i, j, jit=True):
        u = -a + 2 * a * i / nu
        s = j / nv
        z = level
        for _ in range(2):
            v0, v1 = span(z)
            v = v0 + (v1 - v0) * s
            r = min(1.0, math.hypot(u / a, 2 * s - 1) / math.sqrt(2) * 1.15)
            z = level + rise * (1 - r * r)
        inner = 0 < i < nu and 0 < j < nv
        if jit and inner:
            u, v, z = u + rng.uniform(-0.02, 0.02), v + rng.uniform(-0.02, 0.02), z + rng.uniform(-0.04, 0.04)
        return (u, v, max(z, _arc(v, ROCK_R - T) + 0.03))
    P = {(i, j): at(i, j) for i in range(nu + 1) for j in range(nv + 1)}

    def face():
        if o["glow"] and rng.random() < 0.04:
            return o["glow"][0]
        return o["faces"][rng.integers(len(o["faces"]))]
    for i in range(nu):
        for j in range(nv):
            p, q, r_, s_ = P[i, j], P[i + 1, j], P[i + 1, j + 1], P[i, j + 1]
            C._poly(k, [p, q, r_], face())
            C._poly(k, [p, r_, s_], face())
    for _ in range(70):
        u, v, z = at(rng.uniform(0.6, nu - 0.6), rng.uniform(0.6, nv - 0.6), jit=False)
        r = rng.uniform(0.045, 0.1)
        C._lump(k, (u, v, z + 0.01), (rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), 1), r, r * rng.uniform(0.6, 1.1),
                o["chunk"][rng.integers(len(o["chunk"]))], rng)


def channel(k, w, u, v0, v1, out):
    """A C-channel skid rail along v at u, its flanges turned out (to `out`)."""
    H_, F, t = 0.2, 0.13, 0.025
    c = "steel"
    k.box(u, (v0 + v1) / 2, 0.0, t, v1 - v0, H_, "steelD")
    for z in (0.0, H_ - t):
        k.box(u + out * (F / 2 - t / 2), (v0 + v1) / 2, z, F, v1 - v0, t, c, top="steelL" if z else None)
    for v in (v0 + 0.2, (v0 + v1) / 2, v1 - 0.2):                          # stiffeners inside the channel
        k.box(u + out * F / 2, v, t, F - t, 0.02, H_ - 2 * t, "steelD")


def ibeam(k, w, v, u0, u1, z0=0.0, H_=0.18):
    t, F = 0.025, 0.12
    c = w("steel", 0, v, z0 + 0.1)
    k.box((u0 + u1) / 2, v, z0, u1 - u0, F, t, "steelD")
    k.box((u0 + u1) / 2, v, z0 + t, u1 - u0, t, H_ - 2 * t, "steelD")
    k.box((u0 + u1) / 2, v, z0 + H_ - t, u1 - u0, F, t, c, top="steel")


def base(k, w):
    for s in (-1, 1):
        channel(k, w, s * 0.8, -0.92, 0.92, s)
        for v in (-0.84, 0.84):                                             # foot plates
            k.box(s * 0.84, v, 0.0, 0.2, 0.16, 0.02, "steelD", top="steel")
    for v in (-0.8, 0.62):
        ibeam(k, w, v, -0.79, 0.79)
    ibeam(k, w, -0.1, -0.79, 0.79, H_=0.2)                                   # the cradle beam
    for u in (-0.42, 0.42):                                                 # saddles, rubber on top
        k.box(u, -0.1, 0.2, 0.22, 0.16, 0.09, "steelD", top="steel")
        k.box(u, -0.1, 0.29, 0.2, 0.14, _arc(-0.1) - 0.29, "dark")
    tube(k, (-RAM_U - 0.07, PIVOT[0], PIVOT[1]), (RAM_U + 0.07, PIVOT[0], PIVOT[1]), 0.04, "steelL", cap="steelD")
    for u in (-0.5, -0.1, 0.3):                                             # hinge knuckles under the bin
        tube(k, (u - 0.07, PIVOT[0], PIVOT[1]), (u + 0.07, PIVOT[0], PIVOT[1]), 0.07, "steelD", sides=10)
        k.box(u, PIVOT[0], PIVOT[1], 0.14, 0.08, _arc(PIVOT[0]) - PIVOT[1] + 0.03, "steelD")
    pv, pz = PIVOT
    for s in (-1, 1):
        u = s * RAM_U
        for du, col in ((-0.05, "steelD"), (0.05, "hazY")):                 # pivot bracket: gusset plates, a boss
            slab(k, [(u + s * du, pv - 0.2, 0.2), (u + s * du, pv + 0.2, 0.2), (u + s * du, pv + 0.07, pz + 0.04),
                     (u + s * du, pv - 0.07, pz + 0.04)], (1, 0, 0), 0.025, col, side="steelD")
        tube(k, (u - 0.08, pv, pz), (u + 0.08, pv, pz), 0.065, "steel", sides=10, cap="steelD")
        (v0, z0), (v1, z1) = RAM                                            # the ram
        for du in (-0.05, 0.05):                                            # base clevis
            slab(k, [(u + du, v0 - 0.1, 0.2), (u + du, v0 + 0.1, 0.2), (u + du, v0 + 0.05, z0 + 0.06),
                     (u + du, v0 - 0.05, z0 + 0.06)], (1, 0, 0), 0.02, "steelD")
        tube(k, (u - 0.08, v0, z0), (u + 0.08, v0, z0), 0.03, "steelL", sides=6)
        a = Vector((0, v1 - v0, z1 - z0)).normalized()
        foot = Vector((u, v0, z0))
        mid = foot + a * 0.42
        tube(k, foot + a * 0.02, mid, 0.075, "steelD", sides=10, cap="steel")
        for q in (foot + a * 0.08, mid - a * 0.05):                         # collars
            tube(k, q - a * 0.025, q + a * 0.025, 0.088, "steel", sides=10)
        tube(k, mid, Vector((u, v1, z1)), 0.038, "plate", sides=8, cap="steelL")
        hose = [Vector((-0.45, -0.7, 0.36)), Vector((s * 0.6, -0.66, 0.3)), Vector((u, -0.66, 0.3)), foot + a * 0.1]
        for p, q in zip(hose, hose[1:]):
            tube(k, p, q, 0.018, "dark", sides=6)
    # the power pack on the back cross member: a tank on straps and its motor
    tube(k, (-0.6, -0.8, 0.3), (-0.2, -0.8, 0.3), 0.1, w(YEL, -0.4, -0.8, 0.3), sides=12, cap=YEL_D)
    for u in (-0.52, -0.28):
        k.box(u, -0.8, 0.18, 0.04, 0.22, 0.12, "steelD")
    tube(k, (-0.2, -0.8, 0.3), (-0.06, -0.8, 0.3), 0.07, "steelD", sides=10, cap="dark")


def tip_bin(fp, fill, rot, ore="iron"):
    k = K(f"tip_bin_{ore}_{fill}_{rot}", fp, rot)
    w = TipWear(17, amount=0.9)
    base(k, w)
    n0 = len(k.m.f)
    body(k, w)
    grime(k, n0, len(k.m.f), Vector((0, (BACK + LIP) / 2, 0.75)), top_z)
    rng = np.random.default_rng(11 + C.FILLS.index(fill))
    if C.HEAP[fill]:
        heap(k, fill, ore, rng)
    else:
        o = C.ORES[ore]
        for _ in range(6):
            v = rng.uniform(-0.6, 0.4)
            r = rng.uniform(0.04, 0.08)
            C._lump(k, (rng.uniform(-0.5, 0.5), v, _arc(v, ROCK_R - T) + 0.01), (0, 0, 1), r, r * 0.8,
                    o["chunk"][rng.integers(3)], rng)
    return k.build()
