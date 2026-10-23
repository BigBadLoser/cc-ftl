"""Mining fx (family `fx_mining`): the mining pod's laser at work, built from fxkit like the combat fx (screen frame,
self-lit fire ramp; rock and dust lit like the rock).

  mining.beam   a beam segment one tile long pointing screen-right, square-ended so it tiles: the renderer stretches
                and rotates it from the pod's emitter to the tile. A white core in a yellow sheath and an orange halo
                (the emitter's colour), the halo pulsing, bright nodes running along it                       4, loop
  mining.hit    at the tile, where the beam bites: a white-hot spot on a ring of molten rock, a flare, sparks
                thrown up and falling, staggered so the loop never empties                                     4, loop
  mining.chips  rock chips thrown up and out of the tile, staggered the same way                               4, loop
  mining.dust   a tile mined out: a puff of the asteroid's dust billowing up and thinning away                 6, once

Frames are ids `fx.mining.<name>.<n>`; `fx.mining.<name>` alone is frame 0. Shapes are seeded, so renders repeat."""
import math

import numpy as np
from mathutils import Vector

from .fxkit import N, P, R, U, UP, Fx, spikes

O = Vector((0, 0, 0))
LOOP = 4
STYLE = "red"                 # the laser's colour (the pod's emitter is lit to match)
RAMPS = {                     # beam halo, sheath, core; hit rim, pool, hot spot (face, rim), flare; sparks by age
    "orange": dict(halo="fxO", sheath="fxY", core="fxW", rim="fxO", pool="fxY", spot=("fxW", "fxY"), flare="fxY",
                   sparks=("fxW", "fxY", "fxO", "fxR")),
    "red": dict(halo="fxD", sheath="red", core="fxW", rim="fxD", pool="red", spot=("fxW", "fxR"), flare="red",
                sparks=("fxW", "fxR", "red", "fxD")),
}


def beam(k):
    f = Fx(f"mining_beam_{k}")
    ph = k / LOOP
    pulse = math.sin(ph * math.tau)

    def band(h, col, v=0.0):                                                 # square-ended, so segments tile
        f.flat([P(-0.5, v - h / 2), P(0.5, v - h / 2), P(0.5, v + h / 2), P(-0.5, v + h / 2)], col)
    c = RAMPS[STYLE]
    band(0.17 + 0.03 * pulse, c["halo"])
    band(0.1 + 0.015 * math.sin(ph * math.tau + 1.7), c["sheath"])
    band(0.04, c["core"])
    for j in range(2):                                                       # nodes running along it, every half tile,
        u = -0.5 + ((ph + j / 2) % 1)                                        # cut at the segment's ends and wrapped
        for du in (0.0, -1.0, 1.0):                                          # round, so segments tile seamlessly
            pts = _clip_u([(u + du + a, b) for a, b in ((-0.07, 0), (0, -0.05), (0.07, 0), (0, 0.05))])
            if len(pts) >= 3:
                f.flat([P(a, b) for a, b in pts], c["core"])
    return f.build()


def _clip_u(poly, lo=-0.5, hi=0.5):
    """A convex (u, v) polygon cut to lo <= u <= hi."""
    for sign, lim in ((1, hi), (-1, -lo)):
        out = []
        for i, p in enumerate(poly):
            q = poly[(i + 1) % len(poly)]
            dp, dq = sign * p[0] - lim, sign * q[0] - lim
            if dp <= 0:
                out.append(p)
            if (dp < 0) != (dq < 0):
                t = dp / (dp - dq)
                out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
        poly = out
        if len(poly) < 3:
            return []
    return poly


def _thrown(rng, count, speed, rise):
    """Particles thrown up and out of the origin, each born on its own frame of the loop: (direction, out, up, birth)."""
    return [(rng.uniform(0, math.tau), rng.uniform(0.55, 1.0) * speed, rng.uniform(0.7, 1.3) * rise, j % LOOP)
            for j in range(count)]


def _at(a, out, up, t, fall=0.035):
    return O + Vector((math.cos(a) * out * t, math.sin(a) * out * t, up * t - fall * t * t))


HIT = 1.4                     # the hit's size
CHIPS = 1.8                   # the rock chips' size and throw
DUST_SIZE = 2.0               # the dust cloud's size: it covers the tile mined out


def hit(k):
    f = Fx(f"mining_hit_{k}")
    rng = np.random.default_rng(23)
    flick = (1.0, 0.85, 1.1, 0.9)[k] * HIT
    c = RAMPS[STYLE]
    f.ring(O, 0.2 * flick, 0.08, c["rim"], segs=14)                          # the molten rim
    f.ring(O, 0.13 * flick, 0.13 * flick, c["pool"], segs=12)                # the pool
    f.sphere(O + UP * 0.03, 0.075 * flick, lambda n: c["spot"][0] if n.dot(N) > 0.25 else c["spot"][1], segs=10,
             rings=6)                                                        # hot spot
    spikes(f, O + UP * 0.05 + N * 0.15, 4, 0.04 * HIT, (0.2 + 0.06 * (k % 2)) * HIT, 0.045 * HIT, c["flare"],
           rot=math.pi / 4 * (k % 2))
    for a, out, up, born in _thrown(rng, 12, 0.11 * HIT, 0.17 * HIT):                    # sparks, each a few frames old
        age = (k - born) % LOOP + 1
        p0, p1 = _at(a, out, up, age - 0.8), _at(a, out, up, age)
        f.streak(p0 + N * 0.3, p1 + N * 0.3, 0.0, 0.045, c["sparks"][age - 1])
    return f.build()


def chips(k):
    f = Fx(f"mining_chips_{k}")
    rng = np.random.default_rng(31)
    for i, (a, out, up, born) in enumerate(_thrown(rng, 8, 0.09 * CHIPS, 0.2 * CHIPS)):
        age = (k - born) % LOOP + 0.6
        c = _at(a, out, up, age, fall=0.06 * CHIPS)
        if c.z < -0.02:
            continue
        r = (0.035 + 0.015 * (i % 3)) * CHIPS
        col = ("rkM", "rk", "rkD", "orM")[i % 4]

        def paint(n, col=col):
            return "rkK" if n.dot(UP) < -0.4 else col                        # lit like the rock, dark underneath
        f.sphere(c + N * 0.2, r, paint, segs=5, rings=3)                     # angular: a coarse sphere
    return f.build()


DUST = 6


def _cloud(f, c, r, body, light, shade):
    """A flat cloud puff facing the camera: a shaded underside, the body, a lit crown toward the light (up and left)."""
    def disc(cc, rr, col):
        f.flat([cc + (R * math.cos(i * math.tau / 14) + U * math.sin(i * math.tau / 14)) * rr for i in range(14)], col)
    disc(c - U * r * 0.12, r, shade)
    disc(c + U * r * 0.04, r * 0.88, body)
    disc(c + U * r * 0.3 - R * r * 0.22, r * 0.5, light)


def dust(k):
    """The asteroid's dust thrown up by a tile mined out: soft flat puffs billowing up and out, then thinning away."""
    f = Fx(f"mining_dust_{k}")
    rng = np.random.default_rng(41)
    t = (k + 1) / DUST
    fade = (1.0, 1.0, 1.0, 0.9, 0.7, 0.45)[k]
    puffs = [(rng.uniform(0, math.tau), rng.uniform(0.05, 0.3), rng.uniform(0.07, 0.12), rng.uniform(0.0, 0.12)) for _ in range(11)]
    for a, out, r, lift in sorted(puffs, key=lambda p: -math.sin(p[0])):    # back to front
        c = O + (Vector((math.cos(a), math.sin(a), 0)) * out * (0.35 + t) + UP * (0.05 + lift + 0.16 * t)) * DUST_SIZE
        rr = r * (0.6 + 0.9 * t) * fade * DUST_SIZE
        if rr > 0.02:
            _cloud(f, c + N * 0.3, rr, "gdM" if k < 4 else "gdD", "gdL" if k < 4 else "gd", "gdD" if k < 4 else "rkD")
    return f.build()


MINING = (("mining.beam", beam, LOOP), ("mining.hit", hit, LOOP), ("mining.chips", chips, LOOP), ("mining.dust", dust, DUST))
SPRITES = []
for _name, _fn, _n in MINING:
    SPRITES += [(f"fx.{_name}.{_k}", (1, 1), "fx", lambda f=_fn, k=_k: f(k)) for _k in range(_n)]
    SPRITES.append((f"fx.{_name}", (1, 1), "fx", lambda f=_fn: f(0)))
