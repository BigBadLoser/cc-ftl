"""Combat fx v2 (family `fx`): explosions, and the sprite list of the whole family (fx_shots: projectiles, fx_hits:
muzzle flashes and impacts). Built from fxkit, rendered like every other sprite.

Explosions, 12 frames each, one look at three sizes: flash, fireball, fire breaking up into smoke, smoke thinning out.
  fx.explosion_small  0.55   point-defence intercepts, small hits
  fx.explosion        1.0    a hit that blows something up
  fx.explosion_large  1.4    missile impacts
Frames are ids `fx.<name>.<n>`; `fx.<name>` alone is frame 0. Shapes are seeded (numpy default_rng), so renders repeat."""
import numpy as np
from mathutils import Vector

from .fx_hits import HITS
from .fx_shots import SHOTS
from .fxkit import N, U, UP, Fx, fire, spikes

FIRE_R = (0.35, 0.75, 1.0, 1.08, 1.06, 0.96, 0.8, 0.6, 0.4, 0.2, 0.0, 0.0)
HEAT = (1.0, 0.98, 0.9, 0.8, 0.68, 0.58, 0.5, 0.42, 0.36, 0.3, 0.24, 0.2)


def explosion(k, size=1.0, seed=3):
    """12 frames: flash, fireball, fire breaking up into smoke, smoke thinning out; sparks and debris thrown out."""
    f = Fx(f"explosion_{k}")
    rng = np.random.default_rng(seed)
    lobes = []                                                               # fire: (offset, radius, heat scale)
    for j in range(8):
        d = Vector(rng.normal(size=3)).normalized() * rng.uniform(0.05, 0.27) * size
        lobes.append((d + UP * 0.08 * size, rng.uniform(0.15, 0.26) * size, rng.uniform(0.78, 1.08)))
    smoke = []                                                               # smoke: (offset, radius, born, gone)
    for j in range(10):
        d = Vector(rng.normal(size=3)).normalized() * rng.uniform(0.08, 0.26) * size
        smoke.append((d + UP * 0.12 * size, rng.uniform(0.15, 0.24) * size, 3 + j % 3, int(rng.integers(11, 14))))
    sparks = [(Vector(rng.normal(size=3)).normalized(), rng.uniform(0.8, 1.2), int(rng.integers(3, 6))) for _ in range(7)]
    o = UP * 0.3 * size
    if k == 0:                                                               # the flash
        f.sphere(o, 0.24 * size, lambda n: "fxW" if n.dot(N) > 0.3 else "fxY")
        spikes(f, o + N * 0.3, 8, 0.15 * size, 0.55 * size, 0.09 * size, "fxY", rot=0.2)
        spikes(f, o + N * 0.31, 4, 0.12 * size, 0.34 * size, 0.06 * size, "fxW", rot=0.2)
        return f.build()
    heat, fr = HEAT[k], FIRE_R[k]
    rise = UP * 0.035 * size * max(0, k - 2) ** 1.2
    for d, r, born, gone in smoke:                                           # each puff swells, then shrinks away
        if not born <= k < gone:
            continue
        age, left = k - born, gone - k
        rr = r * min(1.0, 0.45 + 0.2 * age) * min(1.0, 0.4 + 0.2 * left) * (1 + 0.04 * age)

        def paint(n, k=k):
            if k <= 5 and n.dot(U) < -0.5 and n.dot(N) > 0.1:
                return "fxO" if k <= 3 else "fxD"                           # ember light on the underside
            return "fxSD" if k >= 9 else "fxS"
        f.sphere(o + d + rise * 1.3, rr, paint, segs=12, rings=8)
    for d, r, hs in lobes:
        if fr > 0:
            ahead = 0.06 if k <= 4 else -0.12                                # later the smoke closes over the fire
            f.sphere(o + d * min(1.0, 0.4 + fr) + rise * (0.6 if k <= 4 else 1.3) + N * ahead * size, r * fr,
                     lambda n, h=heat * hs: fire(h, n.dot(N), n.dot(U)), segs=14, rings=9)
    for d, sp, life in sparks:                                               # sparks: short streaks out of the fireball
        if k > life:
            continue
        def at(t, d=d, sp=sp):
            return o + d * (0.22 + sp * 0.12 * t) * size - UP * 0.006 * size * t * t
        col = "fxW" if k <= 1 else "fxY" if k <= 3 else "fxO"
        f.streak(at(k - 1.0) + N * 0.45, at(k) + N * 0.45, 0.0, 0.06 * size, col)
    return f.build()


EXPLOSION_FRAMES = 12
SIZES = (("explosion_small", 0.55), ("explosion", 1.0), ("explosion_large", 1.4))
SPRITES = []
for _name, _fn, _n in SHOTS + HITS + tuple((n, lambda k, s=s: explosion(k, s), EXPLOSION_FRAMES) for n, s in SIZES):
    SPRITES += [(f"fx.{_name}.{_k}", (1, 1), "fx", lambda f=_fn, k=_k: f(k)) for _k in range(_n)]
    SPRITES.append((f"fx.{_name}", (1, 1), "fx", lambda f=_fn: f(0)))
