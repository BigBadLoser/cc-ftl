"""Combat fx v2: muzzle flashes (at the barrel tip, pointing screen-right like the shots) and impacts (origin = the hit
point on a hull or roof plate; world up is up). Missiles and point-defence intercepts use fx3d's explosions instead of
an impact of their own.

  muzzle.laser  cyan cone and side spikes               3     impact.laser  flash, ring, sparks, burn, puff          6
  muzzle.mass   gas cone, shock ring, smoke             4     impact.mass   the breach: flash, debris, a glowing hole,
                                                                            venting air and dust                     8
  muzzle.missile launch blast: flash, back-blast, smoke 4
  muzzle.ion    blue flash, rings, arcs                 3     impact.ion    flash, EMP ring, arcs crawling the plate 6
  muzzle.fire   a gout of fire and smoke                3     impact.fire   burning splash with flame tongues,
                                                                            droplets, smoke                          7
  muzzle.pd     a small star                            3
  ion_disabled  arcs jumping over a disabled module (loop, at roof height)                                          4"""
import math

import numpy as np
from mathutils import Vector

from .fxkit import N, P, R, U, UP, Fx, fire, spikes

O = Vector((0, 0, 0))


def sparks(f, c, rng, k, count, speed, rise, cols, life=(2, 5), w=0.05):
    """Streaks thrown up and out of c, falling; cols: colour per frame age (last one repeats)."""
    for _ in range(count):
        a = rng.uniform(0, math.tau)
        out, up, lf = rng.uniform(0.6, 1.0), rng.uniform(0.7, 1.3), rng.integers(*life)
        if not 1 <= k <= lf:
            continue

        def at(t, a=a, out=out, up=up):
            return c + Vector((math.cos(a) * out * speed * t, math.sin(a) * out * speed * t, up * rise * t - 0.03 * t * t))
        f.streak(at(k - 0.8) + N * 0.3, at(k) + N * 0.3, 0.0, w, cols[min(k - 1, len(cols) - 1)])


# ---- muzzle flashes -------------------------------------------------------------------------------------------------

def muzzle_laser(k):
    f = Fx(f"muzzle_laser_{k}")
    c = P(0, 0)
    reach, core_r, side = ((0.5, 0.11, 0.2), (0.72, 0.14, 0.3), (0.38, 0.07, 0.14))[k]
    f.spindle(-0.12, reach, 0.3 if k == 1 else 0.22, "fxC2", head=0.6)
    f.spindle(-0.06, reach * 0.8, 0.16 if k == 1 else 0.11, "fxC1", head=0.6)
    if k < 2:
        f.spindle(0.0, reach * 0.55, 0.06, "fxC0", head=0.5)
    for s in (-1, 1):                                                        # side spikes, swept back a little
        f.streak(c, P(-0.06, s * side), 0.08, 0.0, "fxC1")
    f.sphere(c + N * 0.05, core_r, lambda n: "fxC0" if n.dot(N) > 0.45 else "fxC1", segs=12, rings=7)
    return f.build()


def muzzle_mass(k):
    f = Fx(f"muzzle_mass_{k}")
    if k == 0:
        f.spindle(-0.05, 0.6, 0.32, "fxY", head=0.5)
        f.spindle(0.0, 0.4, 0.16, "fxW", head=0.5)
        f.sring(P(0.22, 0, 0.1), 0.2, 0.05, "fxY")
        f.sphere(P(0.02, 0, 0.1), 0.14, lambda n: "fxW", segs=12, rings=7)
        return f.build()
    heat = (0.95, 0.7, 0.45)[k - 1]
    for j, (u, r) in enumerate(((0.14, 0.12), (0.3, 0.15), (0.47, 0.13), (0.62, 0.1))):
        if k == 3 and j < 2:
            continue
        f.sphere(P(u + 0.08 * k, 0.02 * (j % 2 * 2 - 1) * k, 0.05), r * (0.8 + 0.15 * k) * (0.7 if k == 3 else 1),
                 lambda n, h=heat: fire(h, n.dot(N), n.dot(U)), segs=12, rings=7)
    if k < 3:
        f.sring(P(0.3 + 0.18 * k, 0, 0.3), 0.2 + 0.08 * k, 0.04, ("fxO", "fxR")[k - 1])
    for j in range(3):                                                       # smoke rolling out with the gas
        f.puff(P(0.2 + 0.14 * j + 0.06 * k, 0.07 * (1 - j % 2 * 2) + 0.03 * k, -0.15), (0.05 + 0.03 * k) * (1 - 0.1 * j),
               "fxS", "fxO" if k == 1 else None)
    return f.build()


def muzzle_missile(k):
    f = Fx(f"muzzle_missile_{k}")
    if k == 0:
        f.sphere(P(0, 0, 0.1), 0.13, lambda n: "fxW" if n.dot(N) > 0.4 else "fxY", segs=12, rings=7)
        f.spindle(-0.55, 0.0, 0.2, "fxO", head=0.1)                          # back-blast
        f.spindle(-0.35, 0.0, 0.1, "fxY", head=0.1)
        return f.build()
    rng = np.random.default_rng(21)
    for j in range(7):                                                       # the launch cloud, back and to the sides
        d = Vector((rng.uniform(-1, 0.3), rng.uniform(-0.6, 0.6), 0))
        f.puff(P(d.x * 0.35 * (0.6 + 0.3 * k), d.y * 0.25 * (0.6 + 0.3 * k), -0.1 * j), rng.uniform(0.07, 0.11) * (0.7 + 0.25 * k),
               "fxS" if k < 3 else "fxSD", "fxO" if k == 1 else None)
    if k == 1:
        f.sphere(P(-0.05, 0, 0.3), 0.08, lambda n: fire(0.8, n.dot(N)), segs=10, rings=6)
    return f.build()


def muzzle_ion(k):
    f = Fx(f"muzzle_ion_{k}")
    rng = np.random.default_rng(31 + k)
    f.sphere(P(0.02, 0, 0.1), (0.13, 0.16, 0.07)[k], lambda n: "fxI0" if n.dot(N) > 0.7 else "fxI1", segs=12, rings=7)
    for j in range(k + 1):
        u = 0.15 + 0.17 * j + 0.08 * k
        f.sring(P(u, 0, 0.2), 0.12 + 0.05 * j + 0.03 * k, 0.04, "fxI1" if j == 0 else "fxI2")
    if k < 2:
        for j in range(2):
            f.arc(P(0.05, 0, 0.3), P(0.4 + 0.15 * k, rng.uniform(-0.2, 0.2), 0.3), rng, "fxI0", n=4, jag=0.06)
    return f.build()


def muzzle_fire(k):
    f = Fx(f"muzzle_fire_{k}")
    heat = (1.0, 0.8, 0.55)[k]
    for j, (u, r) in enumerate(((0.08, 0.1), (0.22, 0.13), (0.37, 0.12), (0.5, 0.09))):
        if k == 0 and j > 2:
            continue
        f.sphere(P(u + 0.06 * k, 0.03 * k * (j % 2), 0.05 * j), r * (0.85 + 0.12 * k),
                 lambda n, h=heat * (1 - 0.08 * j): fire(h, n.dot(N), n.dot(U)), segs=12, rings=7)
    if k:
        f.puff(P(0.15 + 0.1 * k, 0.14 + 0.04 * k, -0.2), 0.06 + 0.02 * k, "fxSD", "fxR" if k == 1 else None)
    return f.build()


def muzzle_pd(k):
    f = Fx(f"muzzle_pd_{k}")
    r = (0.16, 0.22, 0.11)[k]
    spikes(f, P(0, 0, 0.1), 4 if k != 1 else 6, 0.0, r, 0.07, "fxY", rot=0.0 if k != 1 else 0.3)
    f.sphere(P(0, 0, 0.2), (0.05, 0.065, 0.04)[k], lambda n: "fxW", segs=8, rings=5)
    return f.build()


# ---- impacts --------------------------------------------------------------------------------------------------------

def impact_laser(k):
    f = Fx(f"impact_laser_{k}")
    rng = np.random.default_rng(7)
    if k == 0:
        f.sphere(O + UP * 0.06, 0.13, lambda n: "fxC0" if n.dot(N) > 0.35 else "fxC1", segs=12, rings=7)
        spikes(f, O + UP * 0.06 + N * 0.2, 4, 0.1, 0.42, 0.07, "fxC1", rot=math.pi / 4)
        spikes(f, O + UP * 0.06 + N * 0.21, 4, 0.08, 0.26, 0.05, "fxC0")
    if 1 <= k <= 2:
        f.ring(O, 0.2 + 0.14 * k, 0.05 if k == 1 else 0.03, "fxC1" if k == 1 else "fxC2")
    burn = {1: "fxW", 2: "fxY", 3: "fxO", 4: "fxR", 5: "fxD"}.get(k)
    if burn:
        f.ring(O, 0.09 if k < 4 else 0.07, 0.09 if k < 4 else 0.07, burn, segs=10)
    sparks(f, O, rng, k, 7, 0.11, 0.16, ("fxC0", "fxC1", "fxY", "fxO"))
    if k >= 3:                                                               # a small puff of burnt plating
        for du, dv, r in ((0.0, 0.0, 0.08), (0.07, 0.05, 0.06), (-0.06, 0.06, 0.055)):
            f.puff(O + UP * (0.12 + 0.07 * (k - 3)) + R * du + U * dv, r * (0.7 + 0.25 * (k - 3)) * (1 if k < 5 else 0.75),
                   "fxSD" if k == 5 else "fxS", "fxR" if k == 3 else None)
    return f.build()


def impact_mass(k):
    """The breach: a white flash, plating torn up and thrown out, a hole with glowing edges, air venting, dust."""
    f = Fx(f"impact_mass_{k}")
    rng = np.random.default_rng(11)
    if k == 0:
        f.sphere(O + UP * 0.1, 0.18, lambda n: "fxW" if n.dot(N) > 0.3 else "fxY")
        spikes(f, O + UP * 0.1 + N * 0.3, 6, 0.12, 0.62, 0.09, "fxY", rot=0.3)
        return f.build()
    f.ring(O, 0.2, 0.2, "dark", segs=12)                                     # the hole, its edge cooling
    f.ring(O, 0.24, 0.06, ("fxW", "fxY", "fxO", "fxO", "fxR", "fxR", "fxD")[k - 1], segs=12)
    if k <= 3:
        for j in range(4):                                                   # the burst out of the hole
            a = j * math.tau / 4 + 0.4
            f.sphere(O + UP * (0.12 + 0.05 * k) + Vector((math.cos(a), math.sin(a), 0)) * 0.1, (0.13, 0.15, 0.1)[k - 1],
                     lambda n: fire((1.0, 0.75, 0.5)[k - 1], n.dot(N), n.dot(U)), segs=10, rings=6)
    for j in range(6):                                                       # torn plating, tumbling out and down
        a = rng.uniform(0, math.tau)
        sp, up, spin = rng.uniform(0.08, 0.13), rng.uniform(0.18, 0.28), rng.uniform(0, math.pi)
        p = O + Vector((math.cos(a) * sp * k, math.sin(a) * sp * k, up * k - 0.035 * k * k))
        if p.z < -0.05:
            continue
        e1 = (R * math.cos(spin + k) + U * math.sin(spin + k)) * 0.06
        e2 = (R * -math.sin(spin + k * 0.7) + U * math.cos(spin + k * 0.7)) * 0.04
        f.m.poly([p + e1 + e2 + N * 0.3, p - e1 + e2 + N * 0.3, p - e1 - e2 + N * 0.3, p + e1 - e2 + N * 0.3],
                 "steelL" if (j + k) % 3 else "gmD")
    sparks(f, O, rng, k, 10, 0.13, 0.2, ("fxW", "fxY", "fxY", "fxO", "fxR"), life=(3, 6))
    if k >= 2:                                                               # air venting out of the breach, then dust
        for j in range(4):
            age = k - 2 - j * 0.7
            if 0 <= age <= 4:
                lean = Vector((0.06, -0.05, 0)) * age + Vector((0.03 * math.sin(j * 2.3), 0.03 * math.cos(j * 1.7), 0))
                f.puff(O + UP * (0.14 + 0.11 * age) + lean, 0.06 + 0.03 * age, "plate" if age < 2.5 else "fxS")
        for j in range(3):
            if k >= 3:
                a = j * 2.1
                f.puff(O + Vector((math.cos(a) * 0.22, math.sin(a) * 0.22, 0.05 + 0.03 * (k - 3))), 0.06 + 0.012 * (k - 3), "fxSD")
    return f.build()


def impact_ion(k):
    f = Fx(f"impact_ion_{k}")
    rng = np.random.default_rng(50 + k)
    if k == 0:
        f.sphere(O + UP * 0.08, 0.14, lambda n: "fxI0" if n.dot(N) > 0.5 else "fxI1", segs=12, rings=7)
        spikes(f, O + UP * 0.08 + N * 0.2, 6, 0.1, 0.4, 0.06, "fxI1", rot=0.5)
        return f.build()
    r = 0.18 + 0.12 * k
    f.ring(O, r, 0.05 if k < 3 else 0.035, "fxI1" if k < 3 else "fxI2", segs=24)   # the EMP ring spreading over the plate
    if k < 5:
        f.ring(O, r * 0.6, 0.03, "fxI2", segs=20)
        for j in range(3 if k < 4 else 2):                                   # arcs crawling out across the plate
            a = rng.uniform(0, math.tau)
            p1 = O + Vector((math.cos(a), math.sin(a), 0)) * r * rng.uniform(0.6, 0.95)
            f.arc(O + UP * 0.04, p1 + UP * 0.02, rng, "fxI0" if j == 0 else "fxI1", n=5, jag=0.05)
        f.sphere(O + UP * 0.05, 0.07 - 0.01 * k, lambda n: "fxI0", segs=8, rings=5)
    return f.build()


def impact_fire(k):
    f = Fx(f"impact_fire_{k}")
    rng = np.random.default_rng(70)
    if k == 0:
        f.sphere(O + UP * 0.08, 0.16, lambda n: "fxW" if n.dot(N) > 0.4 else "fxY")
        spikes(f, O + UP * 0.08 + N * 0.25, 5, 0.1, 0.36, 0.07, "fxO", rot=0.2)
        return f.build()
    spread = min(1.0, 0.45 + 0.25 * k)
    heat = (0.95, 0.82, 0.72, 0.64, 0.58, 0.52)[k - 1]
    for j in range(9):                                                       # the burning splash, low and wide
        a = j * math.tau / 9 + 0.3 * (j % 2)
        d = (0.12 + 0.2 * (j % 3) / 2) * spread
        rr = (0.07 + 0.025 * ((j * 7) % 3)) * (1.0 if k < 4 else 0.85 - 0.06 * (k - 4)) * (0.9 + 0.2 * ((j + k) % 2))
        base = O + Vector((math.cos(a) * d, math.sin(a) * d, rr * 0.5))
        f.sphere(base, rr, lambda n, h=heat * (0.85 + 0.12 * ((j + k) % 3)): fire(h, n.dot(N), n.dot(U)), segs=10, rings=6)
        if (j + k) % 2 == 0:                                                 # a flame tongue licking up off it
            tall = rr * (1.6 + 0.4 * ((j * 3 + k) % 3))
            sway = R * 0.02 * ((k % 2) * 2 - 1)
            f.streak(base + UP * rr * 0.5 + N * 0.2, base + UP * (rr + tall) + sway + N * 0.2, rr * 1.1, 0.0,
                     "fxO" if heat > 0.6 else "fxR")
            f.streak(base + UP * rr * 0.4 + N * 0.21, base + UP * (rr + tall * 0.6) + N * 0.21, rr * 0.55, 0.0, "fxY")
    for j in range(6):                                                       # burning droplets arcing out
        a, sp = rng.uniform(0, math.tau), rng.uniform(0.09, 0.14)
        if k <= 4:
            p = O + Vector((math.cos(a) * sp * k, math.sin(a) * sp * k, 0.2 * k - 0.05 * k * k))
            if p.z > 0:
                f.sphere(p + N * 0.3, 0.04, lambda n: "fxY" if k <= 2 else "fxO", segs=6, rings=4)
    if k >= 3:
        for j in range(3):                                                   # smoke off the fire
            f.puff(O + UP * (0.38 + 0.1 * (k - 3) + 0.07 * j) + R * 0.06 * (j - 1) * (1 + 0.3 * (k - 3)),
                   0.07 + 0.018 * (k - 3), "fxSD", "fxR" if j == 1 and k < 5 else None)
    return f.build()


def ion_disabled(k):
    """Arcs jumping over a disabled module, at roof height (ZR above the floor anchor), a 4-frame loop."""
    f = Fx(f"ion_disabled_{k}")
    rng = np.random.default_rng(90 + k)
    top = UP * 2.05
    for j in range(3):
        a, b = rng.uniform(-0.4, 0.4, 2), rng.uniform(-0.4, 0.4, 2)
        f.arc(top + Vector((a[0], a[1], 0.05)), top + Vector((b[0], b[1], 0.08)), rng, "fxI0" if j == 0 else "fxI1", n=5, jag=0.05)
    f.sphere(top + Vector((*rng.uniform(-0.3, 0.3, 2), 0.06)), 0.05, lambda n: "fxI0", segs=8, rings=5)
    return f.build()


HITS = (("muzzle.laser", muzzle_laser, 3), ("muzzle.mass", muzzle_mass, 4), ("muzzle.missile", muzzle_missile, 4),
        ("muzzle.ion", muzzle_ion, 3), ("muzzle.fire", muzzle_fire, 3), ("muzzle.pd", muzzle_pd, 3),
        ("impact.laser", impact_laser, 6), ("impact.mass", impact_mass, 8), ("impact.ion", impact_ion, 6),
        ("impact.fire", impact_fire, 7), ("ion_disabled", ion_disabled, 4))
