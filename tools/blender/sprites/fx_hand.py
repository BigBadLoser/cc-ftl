"""Combat fx v2: hand-weapon fire for crew fights (replaces fightFx's drawn placeholders). fxkit's screen frame; shots,
flashes and slashes point screen-right and the renderer turns them toward the target.

  hand.muzzle.<w>   at the gun (w = sidearm, rifle, ion): a small flash, 3 frames
  hand.tracer       a bullet: a bright dash with a fading tail, 2 frames      hand.tracer.ion  a small blue bolt, 4 frames
  hand.hit          a body hit: a red-white burst with flecks, 4 frames
  hand.hit_spark    a hit on a robot or cover: sparks, 4 frames                hand.hit_ion     a blue crackle, 4 frames
  hand.ricochet     a miss striking the floor or a wall: a spark and a dust puff, 4 frames
  hand.slash        a melee swing: a crescent swoosh with a trail, 4 frames"""
import math

import numpy as np

from .fxkit import N, P, Fx, spikes


def muzzle(w, k):
    f = Fx(f"hand_muzzle_{w}_{k}")
    s = {"sidearm": 0.75, "rifle": 1.0, "ion": 0.85}[w]
    core, outer = ("fxI0", "fxI1") if w == "ion" else ("fxW", "fxY")
    reach = (0.22, 0.32, 0.14)[k] * s
    f.spindle(-0.03, reach, (0.12, 0.16, 0.08)[k] * s, outer, head=0.55)
    if k < 2:
        for sgn in (-1, 1):
            f.streak(P(0.02, 0), P(0.06 * s, sgn * 0.1 * s), 0.05, 0.0, outer)
    f.sphere(P(0, 0, 0.1), (0.07, 0.085, 0.05)[k] * s, lambda n: core, segs=8, rings=5)
    return f.build()


def tracer(k):
    f = Fx(f"hand_tracer_{k}")
    L = 0.42 if k == 0 else 0.36
    f.spindle(-L, 0.06, 0.05, "fxO", head=0.15)
    f.spindle(-L * 0.55, 0.06, 0.045, "fxY", head=0.2)
    f.flat([P(0.0, -0.022), P(0.06, 0), P(0.0, 0.022), P(-0.05, 0)], "fxW")
    return f.build()


def tracer_ion(k):
    f = Fx(f"hand_tracer_ion_{k}")
    rng = np.random.default_rng(80 + k)
    f.spindle(-0.3, 0.0, 0.07, "fxI2", head=0.5)
    f.sphere(P(0, 0), 0.075, lambda n: "fxI0" if n.dot(N) > 0.5 else "fxI1", segs=10, rings=6)
    f.arc(P(0, 0, 0.1), P(rng.uniform(-0.15, 0.05), rng.uniform(-0.13, 0.13), 0.1), rng, "fxI0", n=3, jag=0.03)
    return f.build()


def hit(k):
    """A body hit: a burst at chest height, flecks thrown back (kept to bright reds and white, no gore)."""
    f = Fx(f"hand_hit_{k}")
    rng = np.random.default_rng(3)
    if k == 0:
        spikes(f, P(0, 0, 0.2), 6, 0.0, 0.2, 0.06, "red", rot=0.3)
        f.sphere(P(0, 0, 0.25), 0.07, lambda n: "fxW", segs=8, rings=5)
        return f.build()
    for j in range(6):
        a = rng.uniform(-0.9, 0.9) + (math.pi if j % 2 else 0)
        sp = rng.uniform(0.06, 0.1)
        x, y = math.cos(a) * sp * (k + 0.5), math.sin(a) * sp * (k + 0.5) - 0.02 * k * k
        if k < 3 or j % 2:
            f.flat([P(x + dx, y + dy, 0.2) for dx, dy in ((-0.025, 0), (0, -0.025), (0.025, 0), (0, 0.025))], "red" if k < 2 else "rustD")
    if k == 1:
        f.sphere(P(0, 0, 0.2), 0.08, lambda n: "red" if n.dot(N) < 0.6 else "fxW", segs=8, rings=5)
    return f.build()


def hit_spark(k):
    f = Fx(f"hand_hit_spark_{k}")
    rng = np.random.default_rng(9)
    if k == 0:
        spikes(f, P(0, 0, 0.2), 4, 0.0, 0.2, 0.06, "fxY", rot=0.4)
        f.sphere(P(0, 0, 0.25), 0.06, lambda n: "fxW", segs=8, rings=5)
        return f.build()
    for _ in range(6):
        a, sp = rng.uniform(0, math.tau), rng.uniform(0.07, 0.12)
        p0 = (math.cos(a) * sp * (k - 0.6), math.sin(a) * sp * (k - 0.6) - 0.02 * (k - 0.6) ** 2)
        p1 = (math.cos(a) * sp * k, math.sin(a) * sp * k - 0.02 * k * k)
        f.streak(P(*p0, 0.2), P(*p1, 0.2), 0.0, 0.045, ("fxW", "fxY", "fxO")[k - 1])
    if k >= 2:
        f.puff(P(0, 0.04 * k, -0.1), 0.04 + 0.015 * k, "fxS")
    return f.build()


def hit_ion(k):
    f = Fx(f"hand_hit_ion_{k}")
    rng = np.random.default_rng(60 + k)
    r = 0.12 + 0.05 * k
    for j in range(3 if k < 3 else 1):
        a = rng.uniform(0, math.tau)
        f.arc(P(0, 0, 0.2), P(r * math.cos(a), r * math.sin(a), 0.2), rng, "fxI0" if j == 0 else "fxI1", n=4, jag=0.04)
    if k < 2:
        f.sphere(P(0, 0, 0.25), 0.07, lambda n: "fxI0" if n.dot(N) > 0.5 else "fxI1", segs=8, rings=5)
    return f.build()


def ricochet(k):
    f = Fx(f"hand_ricochet_{k}")
    if k == 0:
        spikes(f, P(0, 0, 0.2), 4, 0.0, 0.14, 0.05, "fxY", rot=0.8)
    if 1 <= k <= 2:
        f.streak(P(0.02, 0.02 * k, 0.2), P(0.1 * k, 0.12 * k, 0.2), 0.0, 0.045, "fxY" if k == 1 else "fxO")
    if k >= 1:
        f.puff(P(0, 0.03 * k, -0.1), 0.035 + 0.018 * k, "fxS" if k < 3 else "fxSD")
        f.puff(P(0.05, 0.02 * k, -0.12), 0.03 + 0.012 * k, "fxS")
    return f.build()


def slash(k):
    """A crescent swoosh, swinging from top to bottom across the target (+u): the blade's arc in white with a cool trail."""
    f = Fx(f"hand_slash_{k}")
    a0, a1 = (math.radians(70), math.radians(-70))
    sweep = (0.35, 0.75, 1.0, 1.0)[k]
    fade = k == 3
    r = 0.26
    steps = 9
    pts = []
    for i in range(steps + 1):
        t = i / steps * sweep
        a = a0 + (a1 - a0) * t
        pts.append((t, P(r * math.cos(a), r * math.sin(a), 0.2)))
    for (t0, p0), (t1, p1) in zip(pts, pts[1:]):
        head = t1 / sweep                                                    # 1 at the blade, 0 at the trail's end
        width = 0.03 + 0.07 * head
        col = "steelL" if fade else ("fxW" if head > 0.75 else "arc" if head > 0.4 else "fxH2")
        f.streak(p0, p1, width, 0.03 + 0.07 * head, col)
    return f.build()


HAND = tuple((f"hand.muzzle.{w}", lambda k, w=w: muzzle(w, k), 3) for w in ("sidearm", "rifle", "ion")) + (
    ("hand.tracer", tracer, 2), ("hand.tracer.ion", tracer_ion, 4), ("hand.hit", hit, 4), ("hand.hit_spark", hit_spark, 4),
    ("hand.hit_ion", hit_ion, 4), ("hand.ricochet", ricochet, 4), ("hand.slash", slash, 4))
