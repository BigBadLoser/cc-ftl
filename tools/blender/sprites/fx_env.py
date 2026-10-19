"""Combat fx v2: shield hits, flying debris and fire on a tile (fxkit's screen frame; origin = the tile centre at floor
level for fire, the hit point on the shield for shield hits, the chunk's centre for debris).

  shield_hit     a hex lattice lights up round the hit and a ripple runs out across it, then fades        6 frames
  debris.<v>     a torn hull plate (v = a, b, c), tumbling: one frame per eighth of a turn               8 frames each
  fire           flames on a floor tile: low lobes with tongues licking up, embers, a wisp of smoke      8-frame loop
                 (fxView loops it and scales it by the tile's fire intensity)"""
import math

import numpy as np
from mathutils import Vector

from .fxkit import N, P, R, U, UP, Fx, fire

HEX = 0.1                                                                    # shield lattice spacing (about 4.5 px)


def ellipse_ring(f, r, t, col, ry=0.72, segs=28):
    """A ring in the screen plane, wider than tall like the bubble's edge."""
    for n in range(segs):
        a0, a1 = n * math.tau / segs, (n + 1) * math.tau / segs
        f.flat([P(rr * math.cos(a), rr * ry * math.sin(a), 0.1) for rr, a in ((r, a0), (r, a1), (r - t, a1), (r - t, a0))], col)


def shield_hit(k):
    """A ripple runs out over the bubble from the hit: a bright front ring with the lattice's hex tiles lighting up along
    it (filled, with gaps, so they read as tiles at this size), a dimmer ring behind; the hit point flashes first."""
    f = Fx(f"shield_hit_{k}")
    if k == 0:
        f.sphere(P(0, 0, 0.2), 0.15, lambda n: "fxH0" if n.dot(N) > 0.3 else "fxH1", segs=12, rings=7)
        return f.build()
    front = 0.08 + 0.12 * k
    lit = ("fxH0", "fxH0", "fxH1", "fxH1", "fxH2")[k - 1]
    w = HEX * math.sqrt(3)
    for i in range(-6, 7):
        for j in range(-7, 8):
            cu, cv = w * (i + 0.5 * (j % 2)), HEX * 1.5 * j
            d = math.hypot(cu, cv / 0.72)
            if abs(d - front) > 0.1 or d > 0.62:
                continue
            r = HEX * (0.72 if abs(d - front) < 0.05 else 0.5)               # tiles on the front are full, edges smaller
            f.flat([P(cu + r * math.cos(a), cv + r * math.sin(a), 0.05) for a in (math.pi / 6 + n * math.pi / 3 for n in range(6))],
                   lit if abs(d - front) < 0.05 else ("fxH1" if k < 3 else "fxH2"))
    ellipse_ring(f, front + 0.09, 0.045, "fxH1" if k < 4 else "fxH2")
    if k <= 3:
        ellipse_ring(f, front * 0.55, 0.045, "fxH2")
        f.sphere(P(0, 0, 0.2), 0.08 - 0.02 * k, lambda n: "fxH0", segs=10, rings=6)
    return f.build()


def debris(v, k):
    """A torn plate: an irregular polygon with thickness, lit face, scorched rim; tumbling about a tilted axis."""
    f = Fx(f"debris_{v}_{k}")
    rng = np.random.default_rng({"a": 1, "b": 2, "c": 3}[v])
    n = 7
    outline = [(math.cos(a) * r, math.sin(a) * r * 0.7) for a, r in
               ((i * math.tau / n + rng.uniform(-0.25, 0.25), rng.uniform(0.12, 0.24)) for i in range(n))]
    spin = k * math.tau / 8
    axis = (R * 0.6 + U * 0.5 + N * 0.6).normalized()

    def rot(p):                                                              # Rodrigues rotation about the axis
        return p * math.cos(spin) + axis.cross(p) * math.sin(spin) + axis * axis.dot(p) * (1 - math.cos(spin))
    face = [rot(R * x + U * y) for x, y in outline]
    back = [rot(R * x + U * y - N * 0.05) for x, y in outline]
    nrm = rot(N)
    top = face if nrm.dot(N) >= 0 else back
    for a, b, c, d in zip(face, face[1:] + face[:1], back[1:] + back[:1], back):
        f.m.poly([a, b, c, d], "gmD")                                        # the torn edge
    f.m.poly(top, "steelL" if nrm.dot(U) > 0.2 else "steel")
    if rng.uniform() < 0.7:                                                  # a scorched or still-glowing corner
        c = top[0] * 0.6 + top[1] * 0.4
        f.flat([c + R * 0.035, c + U * 0.035, c - R * 0.035, c - U * 0.035], "fxO" if v == "a" else "dark")
    return f.build()


def fire_tile(k, n=8):
    """A burning floor tile, an 8-frame loop: lobes along the floor, tongues that rise, sway and break off, embers."""
    f = Fx(f"fire_{k}")
    rng = np.random.default_rng(5)
    ph = k / n
    seats = [(rng.uniform(-0.28, 0.28), rng.uniform(-0.28, 0.28), rng.uniform(0, 1)) for _ in range(6)]
    for x, y, o in seats:                                                    # low burning lobes on the floor
        r = 0.12 + 0.03 * math.sin((ph + o) * math.tau)
        f.sphere(Vector((x, y, r * 0.6)), r, lambda nn, h=0.78 + 0.1 * math.sin((ph + o) * math.tau): fire(h, nn.dot(N), nn.dot(U)),
                 segs=10, rings=6)
    for x, y, o in seats[:5]:                                                # tongues: grow, sway, pinch off and rise
        a = (ph + o) % 1
        base = Vector((x, y, 0.08))
        tall = 0.22 + 0.36 * math.sin(a * math.pi)
        sway = (R * 0.04 * math.sin((a + o) * math.tau * 2))
        if a < 0.75:
            f.streak(base + N * 0.25, base + UP * tall + sway + N * 0.25, 0.21, 0.0, "fxO" if a < 0.5 else "fxR")
            f.streak(base + N * 0.26, base + UP * tall * 0.6 + sway * 0.6 + N * 0.26, 0.11, 0.0, "fxY")
        else:                                                                # the tip breaks off and rises
            tip = base + UP * (0.3 + (a - 0.75) * 1.2) + sway
            f.streak(tip + N * 0.25, tip + UP * 0.12 + N * 0.25, 0.1, 0.0, "fxR")
    for j in range(3):                                                       # embers drifting up
        a = (ph + j / 3) % 1
        p = Vector((0.15 * math.sin(j * 2.4 + a * 3), 0.1 * math.cos(j * 1.9), 0.25 + 0.55 * a))
        if a < 0.85:
            f.flat([p + R * 0.022 + N * 0.3, p + U * 0.022 + N * 0.3, p - R * 0.022 + N * 0.3, p - U * 0.022 + N * 0.3],
                   "fxY" if a < 0.4 else "fxO")
    a = ph                                                                   # a wisp of smoke off the top
    f.puff(Vector((0.05 * math.sin(a * math.tau), 0, 0.62 + 0.25 * a)), 0.06 + 0.04 * a, "fxSD")
    return f.build()


ENV = (("shield_hit", shield_hit, 6), ("fire", fire_tile, 8),
       ("debris.a", lambda k: debris("a", k), 8), ("debris.b", lambda k: debris("b", k), 8), ("debris.c", lambda k: debris("c", k), 8))
