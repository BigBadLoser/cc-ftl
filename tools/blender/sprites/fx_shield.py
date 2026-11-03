"""Shield fx (family `fx_shield`): the sprite pieces laid over the shield dome. The dome itself (sheen, hex lattice, lit
rows per layer, ripples, breaks, regen, shields down) is drawn by a shader (src/render/shieldDome.ts), because it has
to fit every hull; these are the pieces with real shape, built from fxkit like the combat fx (screen frame, self-lit
`fxH*` shield and `fxI*` ion ramps, which feed the glow sheet). All are anchored at the point a shot meets the bubble.

  shield_flash      a shot absorbed: a white-hot point blooms, a hex-tile star flares round it, it shrinks
                    to a cyan spark and goes out                                                          10, once
  shield_flash.ion  ion drain: a violet point with purple tiles and crackle drawn *into* it, then it gutters 10, once
  shield_pierce     a mass-driver slug punching through: a white flash, jagged shards of the shell flung out
                    and tumbling, the slug's streak carrying on (screen-right; the renderer turns it along the
                    shot)                                                                                  12, once

Frames are ids `fx.<name>.<n>`; `fx.<name>` alone is frame 0. Shapes are seeded (numpy default_rng), so renders repeat."""
import math

import numpy as np

from .fxkit import N, P as P1, Fx

Z = 2.0                                                                      # pieces read at the dome's size


def P(u, v, w=0.0):
    return P1(u * Z, v * Z, w * Z)

FLASH = 10
PIERCE = 12


def hexagon(f, u, v, r, col, w=0.03):
    f.flat([P(u + r * math.cos(a), v + r * math.sin(a), w) for a in (math.pi / 6 + m * math.pi / 3 for m in range(6))], col)


def flash(k, ion=False):
    """Bloom, then a star of hex tiles round it that drifts out a little and dims; the core shrinks to a spark."""
    hot, mid, low = ("fxI0", "fxI1", "fxI2") if ion else ("fxH0", "fxH1", "fxH2")
    f = Fx(f"shield_flash_{'ion_' if ion else ''}{k}")
    t = k / (FLASH - 1)
    core = (0.16, 0.2, 0.17, 0.13, 0.1, 0.08, 0.06, 0.045, 0.035, 0.025)[k]
    f.sphere(P(0, 0, 0.3), core * Z, lambda n: (hot if k < 6 else mid) if n.dot(N) > 0.45 else (mid if k < 6 else low), segs=12, rings=7)
    if k == 0:
        f.sphere(P(0, 0, 0.32), 0.09 * Z, lambda n: "fxW", segs=10, rings=6)
        return f.build()
    rng = np.random.default_rng(91 if ion else 90)
    n = 8
    for j in range(n):                                                       # a star of tiles round the point
        a = j * math.tau / n + rng.uniform(-0.15, 0.15)
        if ion:                                                              # ion: tiles drawn in toward the point
            d = 0.36 * (1 - t) + 0.1
        else:
            d = 0.12 + 0.24 * t
        if k > 7 and j % 2:
            continue
        r = 0.04 * (1 - 0.6 * t) + 0.012
        hexagon(f, d * math.cos(a), d * 0.72 * math.sin(a), r, hot if k <= 2 else mid if k <= 6 else low)
    if ion and 1 <= k <= 7:                                                  # crackle into the core
        for j in range(3):
            a = rng.uniform(0, math.tau)
            d = 0.34 * (1 - t) + 0.12
            f.arc(P(d * math.cos(a), d * 0.72 * math.sin(a), 0.2), P(0, 0, 0.25), rng, mid, n=4, jag=0.035 * Z, w=0.018 * Z)
    if not ion and k <= 4:                                                   # a short-lived spike cross
        L = 0.3 * (1 - k / 5)
        for a in (0.0, math.pi / 2):
            d = P(math.cos(a) * L, math.sin(a) * L * 0.72)
            f.streak(P(0, 0, 0.28) - d, P(0, 0, 0.28) + d, 0.0, 0.0 if k else 0.03 * Z, hot)
            f.streak(P(0, 0, 0.28), P(0, 0, 0.28) + d, 0.035 * Z, 0.0, hot)
            f.streak(P(0, 0, 0.28), P(0, 0, 0.28) - d, 0.035 * Z, 0.0, hot)
    return f.build()


def pierce(k):
    """The slug tears through: a flash, shards of the shell flung forward (screen-right, the way the slug flies) and
    tumbling as they fly, the slug's white streak carrying on."""
    f = Fx(f"shield_pierce_{k}")
    t = k / (PIERCE - 1)
    rng = np.random.default_rng(80)
    if k <= 2:
        f.sphere(P(0, 0, 0.3), (0.15, 0.12, 0.07)[k] * Z, lambda n: "fxW" if n.dot(N) > 0.4 else "fxH0", segs=12, rings=7)
    for j in range(10):                                                      # shards: torn shell, tumbling
        a = rng.uniform(-1.0, 1.0)                                           # thrown forward, fanned
        sp = rng.uniform(0.6, 1.3)
        if t > 0.55 + 0.4 * rng.uniform():
            continue
        d = 0.05 + 0.75 * t * sp
        c = P(d * math.cos(a), d * math.sin(a) * 0.72 - 0.05 * t * t, 0.2)
        s = 0.045 * (1 - 0.5 * t) * rng.uniform(0.7, 1.2)
        spin = rng.uniform(0, math.tau) + k * rng.uniform(0.6, 1.2)
        pts = [c + P(s * math.cos(spin + q * math.tau / 3) * (1.6 if q == 0 else 1.0), s * math.sin(spin + q * math.tau / 3)) for q in range(3)]
        f.flat(pts, "fxH0" if k <= 3 else "fxH1" if k <= 7 else "fxH2")
    if k <= 7:                                                               # the slug's streak, carrying on
        head = 0.15 + 0.9 * t
        f.streak(P(head - 0.4, 0, 0.35), P(head, 0, 0.35), 0.0, 0.045 * Z, "fxW" if k <= 3 else "fxH0")
    if 1 <= k <= 4:                                                          # torn lip: a jagged ring round the hole
        n = 9
        r0 = 0.07 + 0.012 * k
        for i in range(n):
            a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
            rr0 = r0 * rng.uniform(0.8, 1.25)
            rr1 = r0 * rng.uniform(0.8, 1.25)
            f.streak(P(rr0 * math.cos(a0), rr0 * 0.72 * math.sin(a0), 0.1), P(rr1 * math.cos(a1), rr1 * 0.72 * math.sin(a1), 0.1),
                     0.025 * Z, 0.025 * Z, "fxH0" if k <= 2 else "fxH1")
    if k >= 8:                                                               # a last spark drifting on (a frame is never empty)
        hexagon(f, 0.6 + 0.04 * (k - 8), 0.05, 0.016 - 0.002 * (k - 8), "fxH1" if k < 10 else "fxH2")
    return f.build()


SHIELD = (("shield_flash", flash, FLASH), ("shield_flash.ion", lambda k: flash(k, ion=True), FLASH), ("shield_pierce", pierce, PIERCE))
SPRITES = []
for _name, _fn, _n in SHIELD:
    SPRITES += [(f"fx.{_name}.{_k}", (1, 1), "fx", lambda f=_fn, k=_k: f(k)) for _k in range(_n)]
    SPRITES.append((f"fx.{_name}", (1, 1), "fx", lambda f=_fn: f(0)))
