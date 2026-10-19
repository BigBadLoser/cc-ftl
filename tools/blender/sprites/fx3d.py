"""Combat fx, v2 (family `fx`): bolts, muzzle flashes, impacts and explosions built as small 3D clusters in screen space
and rendered like every other sprite, so they share the turrets' light and pixel scale.

Screen frame: a point (u, v, w) in tile units is the Blender point u * R + v * U + w * N (R screen-right, U screen-up,
N towards the camera; 1 unit = 45 px across). Projectiles and muzzle flashes point screen-right (+u); the renderer
rotates them along the shot.

Materials:
  fire / energy   self-lit palette ramps (fxW .. fxD fire, fxC0 .. fxC2 laser). A lobe's colour comes from how much its
                  face looks at the camera and the frame's heat, so each lobe has a hot core and a cooler rim, and the
                  whole fireball cools frame by frame. Self-lit colours also feed the glow sheet.
  smoke, debris   lit palette greys (fxS, fxSD), shaded by the scene light like any prop; while the fire is still hot the
                  smoke's underside picks up an ember glow.
Frames are ids `fx.<name>.<n>`; `fx.<name>` alone is frame 0. Shapes are seeded (numpy default_rng), so renders repeat."""
import math

import numpy as np
from mathutils import Vector

from . import core

R = Vector(core._R.tolist())
U = Vector(core._U.tolist())
N = Vector((0.6123724, -0.6123724, 0.5))
UP = Vector((0.0, 0.0, 1.0))                     # world up (sparks fall along -UP)


def P(u, v, w=0.0):
    return R * u + U * v + N * w


def fire(heat, facing, up=0.0):
    """Fire ramp by temperature: the frame's heat times how much the face looks at the camera."""
    t = heat * (0.2 + 0.8 * max(0.0, facing)) + 0.08 * up
    return "fxW" if t > 0.8 else "fxY" if t > 0.62 else "fxO" if t > 0.45 else "fxR" if t > 0.28 else "fxD"


class Fx:
    def __init__(self, name):
        self.m = core.Mesh(name, selflit=True)
        self.layer = 0

    def sphere(self, c, r, paint, segs=14, rings=9):
        """Sphere at screen point c (Blender Vector) of radius r; paint(normal) -> palette name per face."""
        def vert(i, j):
            lat, lon = -math.pi / 2 + math.pi * i / rings, 2 * math.pi * j / segs
            d = R * (math.cos(lat) * math.cos(lon)) + U * math.sin(lat) + N * (math.cos(lat) * math.sin(lon))
            return c + d * r, d
        for i in range(rings):
            for j in range(segs):
                (a, da), (b, db) = vert(i, j), vert(i, j + 1)
                (cc, dc), (d, dd) = vert(i + 1, j + 1), vert(i + 1, j)
                n = (da + db + dc + dd).normalized()
                pts = [a, d, cc] if i == 0 else [a, d, b] if i == rings - 1 else [a, d, cc, b]   # poles: triangles
                self.m.poly(pts, paint(n))

    def flat(self, pts, color):
        """A camera-facing polygon (screen points), stacked a hair towards the camera per call."""
        self.layer += 1
        off = N * (0.003 * self.layer)
        self.m.poly([p + off for p in pts], color)

    def streak(self, p0, p1, w0, w1, color):
        """A camera-facing ribbon from p0 to p1 (Blender points), width w0 at p0 tapering to w1."""
        d = p1 - p0
        if d.length < 1e-6:
            return
        s = N.cross(d).normalized()
        self.flat([p0 - s * (w0 / 2), p1 - s * (w1 / 2), p1 + s * (w1 / 2), p0 + s * (w0 / 2)], color)

    def spindle(self, u0, u1, h, color, v=0.0, w=0.0, head=0.35):
        """A bolt-shaped hexagon along +u: pointed head and tail, thickness h (head: fraction of length that tapers)."""
        L = u1 - u0
        a, b = u0 + L * 0.2, u1 - L * head
        self.flat([P(u0, v, w), P(a, v - h / 2, w), P(b, v - h / 2, w), P(u1, v, w), P(b, v + h / 2, w), P(a, v + h / 2, w)],
                  color)

    def ring(self, c, r, t, color, segs=20):
        """A flat ring in the floor plane (an iso ellipse on screen) around c, radius r, thickness t."""
        for k in range(segs):
            a0, a1 = k * math.tau / segs, (k + 1) * math.tau / segs
            pts = [c + Vector((rr * math.cos(a), rr * math.sin(a), 0)) for rr, a in ((r, a0), (r, a1), (r - t, a1), (r - t, a0))]
            self.layer += 1
            self.m.poly([p + N * (0.003 * self.layer) for p in pts], color)

    def build(self):
        return [self.m.build()]


def _spikes(f, c, n, r0, r1, w, color, rot=0.0):
    for k in range(n):
        a = rot + k * math.tau / n
        d = R * math.cos(a) + U * math.sin(a)
        f.streak(c + d * r0, c + d * r1, w, 0.0, color)


# ---- laser: bolt, muzzle flash, impact ------------------------------------------------------------------------------

def laser_bolt(k):
    f = Fx(f"laser_bolt_{k}")
    L = 1.0 + 0.08 * k
    f.spindle(-L / 2, L / 2, 0.22, "fxC2", head=0.3)
    f.spindle(-L / 2 + 0.08, L / 2 - 0.02, 0.13, "fxC1", head=0.3)
    f.spindle(-L / 2 + 0.25 + 0.06 * k, L / 2 - 0.06, 0.055, "fxC0", head=0.25)
    for j, (u, h) in enumerate(((-0.66, 0.08), (-0.8, 0.05))):              # a broken tail behind the bolt
        f.spindle(u - 0.1 - 0.04 * k, u + 0.02, h, "fxC1" if j == 0 else "fxC2", head=0.5)
    return f.build()


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


def impact_laser(k):
    """On a hull or roof plate (origin = the hit point on the surface): flash, spark spray, a glowing burn, a puff."""
    f = Fx(f"impact_laser_{k}")
    rng = np.random.default_rng(7)
    c = Vector((0, 0, 0))
    if k == 0:
        f.sphere(c + UP * 0.06, 0.13, lambda n: "fxC0" if n.dot(N) > 0.35 else "fxC1", segs=12, rings=7)
        _spikes(f, c + UP * 0.06 + N * 0.2, 4, 0.1, 0.42, 0.07, "fxC1", rot=math.pi / 4)
        _spikes(f, c + UP * 0.06 + N * 0.21, 4, 0.08, 0.26, 0.05, "fxC0")
    if 1 <= k <= 2:
        f.ring(c, 0.2 + 0.14 * k, 0.05 if k == 1 else 0.03, "fxC1" if k == 1 else "fxC2")
    burn = {1: "fxW", 2: "fxY", 3: "fxO", 4: "fxR", 5: "fxD"}.get(k)
    if burn:
        f.ring(c, 0.09 if k < 4 else 0.07, 0.09 if k < 4 else 0.07, burn, segs=10)
    for j in range(7):                                                       # sparks: up and out, then falling
        a = rng.uniform(0, math.tau)
        out, rise, life = rng.uniform(0.6, 1.0), rng.uniform(0.7, 1.3), rng.integers(2, 5)
        if not 1 <= k <= life:
            continue
        def at(t):
            return c + Vector((math.cos(a) * out * 0.11 * t, math.sin(a) * out * 0.11 * t, rise * 0.16 * t - 0.03 * t * t))
        col = "fxC0" if k == 1 else "fxC1" if k == 2 else "fxY" if k == 3 else "fxO"
        f.streak(at(k - 0.8), at(k), 0.0, 0.05, col)
    if k >= 3:                                                               # a small puff of burnt plating
        for j, (du, dv, r) in enumerate(((0.0, 0.0, 0.08), (0.07, 0.05, 0.06), (-0.06, 0.06, 0.055))):
            rr = r * (0.7 + 0.25 * (k - 3)) * (1 if k < 5 else 0.75)
            f.sphere(c + UP * (0.12 + 0.07 * (k - 3)) + R * du + U * dv, rr,
                     lambda n: "fxR" if k == 3 and n.dot(U) < -0.3 else ("fxSD" if k == 5 else "fxS"), segs=10, rings=6)
    return f.build()


# ---- explosion ------------------------------------------------------------------------------------------------------

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
        _spikes(f, o + N * 0.3, 8, 0.15 * size, 0.55 * size, 0.09 * size, "fxY", rot=0.2)
        _spikes(f, o + N * 0.31, 4, 0.12 * size, 0.34 * size, 0.06 * size, "fxW", rot=0.2)
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
SPRITES = []
for _name, _fn, _n in (("laser_bolt", laser_bolt, 2), ("muzzle.laser", muzzle_laser, 3), ("impact.laser", impact_laser, 6),
                       ("explosion", explosion, EXPLOSION_FRAMES)):
    SPRITES += [(f"fx.{_name}.{_k}", (1, 1), "fx", lambda f=_fn, k=_k: f(k)) for _k in range(_n)]
    SPRITES.append((f"fx.{_name}", (1, 1), "fx", lambda f=_fn: f(0)))
