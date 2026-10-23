"""TIP BIN (option A to the ore cage): a hydraulic tipping skip. A shelled plate body in hazard yellow (outer skin, inner
skin scraped to bare steel, a thick flange round the open top): its sides a profile with a vertical back, a front
sloped out to the tipping lip and a curved bottom. It rests on a cradle beam and pivots on an axle through brackets at
the front; two hydraulic rams on the outside of the sides push on lugs at the back to tip it over the lip. The base: a
skid frame of channel rails and cross members. Local frame: modkit.K (front = +v, the lip)."""
import math

import numpy as np
from mathutils import Vector

from . import ore_cage as C
from .modkit import K

YEL, YEL_D = "c4T2", "c4T4"
S, T = 0.76, 0.05                        # the sides' half width, the plate thickness
BACK, LIP = -0.78, 0.84                  # v of the back and of the lip
TOP_B, TOP_F = 1.27, 1.12                # top edge z at the back and at the lip
ROCK_C, ROCK_R = (-0.1, 1.52), 1.2       # the bottom arc's centre (v, z) and radius
FRONT_B = 0.6                            # v where the sloped front meets the bottom
PIVOT = (0.52, 0.36)                     # the front axle (v, z)
RAM = ((-0.82, 0.24), (-0.42, 0.86))     # ram foot and the lug it pushes (v, z), outside the sides
RAM_U = S + 0.13


class TipWear(C.Wear):
    STEPS = {**C.Wear.STEPS, YEL: ((0.55, "c4T3"), (0.72, YEL_D), (0.9, "rust"))}


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
        C._poly(k, q[::-1] if inward else q, col(0.0, (v0 + v1) / 2, (z0 + z1) / 2))


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
    yel = lambda u, v, z: w(YEL, u, v, z)                                  # noqa: E731
    bare = lambda u, v, z: w("steel", u, v, z + 0.3)                        # noqa: E731
    for s in (-1, 1):
        out = [(s * S, v, z) for v, z in pr]
        inn = [(s * (S - T), v, z) for v, z in ip]
        C._poly(k, out if s > 0 else out[::-1], yel(s * S, 0.0, 0.7))      # outer side plate
        C._poly(k, inn[::-1] if s > 0 else inn, "steelD")                   # its inner face
    _skin(k, pr, S, yel)
    _skin(k, ip, S - T, bare, inward=True)
    # the top flange, thick enough to cover the shell's edge: across the back and the lip, along the sloped sides
    k.box(0, BACK + 0.01, TOP_B - 0.07, 2 * S + 0.1, 0.12, 0.1, w(YEL_D, 0, BACK, TOP_B), top="c4T3")
    k.box(0, LIP - 0.01, TOP_F - 0.07, 2 * S + 0.1, 0.12, 0.1, w(YEL_D, 0, LIP, TOP_F), top="c4T3")
    L = math.hypot(LIP - BACK, TOP_F - TOP_B)
    for s in (-1, 1):
        k.box(s * (S - T / 2), (BACK + LIP) / 2, (TOP_B + TOP_F) / 2 - 0.07, 0.12, L, 0.1, w(YEL_D, s, 0, 1.0),
              top="c4T3", rx=math.atan2(TOP_F - TOP_B, LIP - BACK))
    for v in (-0.6, -0.15, 0.3):                                            # ribs down each side
        z0 = _arc(v) + 0.04
        z1 = TOP_B + (TOP_F - TOP_B) * (v - BACK) / (LIP - BACK) - 0.1
        for s in (-1, 1):
            k.box(s * (S + 0.03), v, z0, 0.06, 0.08, z1 - z0, w(YEL_D, s * S, v, z0), top=YEL_D)
    for u in (-0.4, 0.0, 0.4):                                              # ribs up the back
        k.box(u, BACK - 0.03, _arc(BACK) + 0.05, 0.08, 0.06, TOP_B - _arc(BACK) - 0.15, w(YEL_D, u, BACK, 0.6), top=YEL_D)
    for s in (-1, 1):                                                       # ram lugs and the pivot bosses
        k.box(s * (S + 0.06), RAM[1][0], RAM[1][1] - 0.1, 0.1, 0.18, 0.2, "steelD", top="steel")
        k.box(s * (S + 0.05), PIVOT[0], PIVOT[1] - 0.06, 0.08, 0.16, 0.14, "steelD", top="steel")


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


def base(k, w):
    for s in (-1, 1):                                                       # skid rails
        C._run(k, (s * 0.84, -0.9), (s * 0.84, 0.9), 0.0, 0.22, 0.2, "steelD", top="steel", w=w)
    for v in (-0.86, -0.1, 0.62):                                           # cross members
        k.box(0, v, 0.0, 1.5, 0.16, 0.18, w("steel", 0, v, 0.05), top="steelD")
    k.box(0, -0.1, 0.18, 1.2, 0.22, 0.16, "steelD", top="dark")              # the cradle beam the bin rests on
    tube(k, (-RAM_U - 0.06, PIVOT[0], PIVOT[1]), (RAM_U + 0.06, PIVOT[0], PIVOT[1]), 0.05, "steelL", cap="steelD")  # axle
    for u in (-0.5, -0.1, 0.3):                                             # hinge knuckles welded under the front
        k.box(u, PIVOT[0], PIVOT[1] - 0.06, 0.16, 0.16, 0.22, "steelD", top="steel")
    for s in (-1, 1):
        u = s * RAM_U
        for dv in (-0.07, 0.07):                                            # pivot brackets, striped
            k.box(u, PIVOT[0] + dv, 0.2, 0.05, 0.05, PIVOT[1] - 0.12, "steelD", top="steel")
        for i in range(3):
            k.box(u + s * 0.03, PIVOT[0], 0.22 + i * 0.06, 0.012, 0.18, 0.06, ("hazY", "hazK")[i % 2])
        # the ram: a clevis on the base, the barrel, the chrome rod into the lug
        (v0, z0), (v1, z1) = RAM
        k.box(u, v0, 0.2, 0.12, 0.14, 0.1, "steelD", top="steel")
        mid = (v0 + (v1 - v0) * 0.55, z0 + (z1 - z0) * 0.55)
        tube(k, (u, v0, z0 + 0.04), (u, mid[0], mid[1]), 0.08, "steelD", cap="steel")
        tube(k, (u, mid[0], mid[1]), (u, v1, z1 - 0.04), 0.042, "plate", cap="steelL")
        tube(k, (u, v0 + 0.06, z0 + 0.12), (u, v0 + 0.06, 0.16), 0.015, "dark")                 # its hose
    k.box(-0.6, -0.8, 0.18, 0.3, 0.18, 0.2, w("steel", -0.6, -0.8, 0.2), top=YEL_D)            # the power pack


def tip_bin(fp, fill, rot, ore="iron"):
    k = K(f"tip_bin_{ore}_{fill}_{rot}", fp, rot)
    w = TipWear(17, amount=0.9)
    base(k, w)
    body(k, w)
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
