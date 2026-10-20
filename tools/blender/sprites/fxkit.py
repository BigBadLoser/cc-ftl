"""Combat fx v2 kit: the screen frame, the fire ramp and the Fx builder (spheres, tubes, ribbons, rings, arcs) that
fx_shots, fx_hits and fx3d build bolts, muzzle flashes, impacts and explosions from. They render like every other
sprite, so they share the turrets' light and pixel scale.

Screen frame: a point (u, v, w) in tile units is the Blender point u * R + v * U + w * N (R screen-right, U screen-up,
N towards the camera; 1 unit = 45 px across). Projectiles and muzzle flashes point screen-right (+u); the renderer
rotates them along the shot.

Materials:
  fire / energy   self-lit palette ramps (fxW .. fxD fire, fxC0 .. fxC2 laser, fxI0 .. fxI2 ion). A lobe's colour comes from how much its
                  face looks at the camera and the frame's heat, so each lobe has a hot core and a cooler rim, and the
                  whole fireball cools frame by frame. Self-lit colours also feed the glow sheet.
  smoke, debris   lit palette greys (fxS, fxSD) and metals, shaded by the scene light like any prop; while the fire is still hot the
                  smoke's underside picks up an ember glow.
Frames are ids `fx.<name>.<n>`; `fx.<name>` alone is frame 0. Shapes are seeded (numpy default_rng), so renders repeat."""
import math

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

    def tube(self, p0, p1, r0, r1, paint, segs=10):
        """A lit or self-lit tube (cone when r1 = 0) from p0 to p1 with end caps; paint(normal) per face."""
        a = (p1 - p0).normalized()
        b1 = a.cross(N) if a.cross(N).length > 1e-3 else a.cross(U)
        b1.normalize()
        b2 = a.cross(b1)
        ring = [b1 * math.cos(j * math.tau / segs) + b2 * math.sin(j * math.tau / segs) for j in range(segs)]
        for j in range(segs):
            d0, d1 = ring[j], ring[(j + 1) % segs]
            self.m.poly([p0 + d0 * r0, p1 + d0 * r1, p1 + d1 * r1, p0 + d1 * r0], paint((d0 + d1).normalized()))
        if r0 > 0:
            self.m.poly([p0 + d * r0 for d in ring], paint(-a))
        if r1 > 0:
            self.m.poly([p1 + d * r1 for d in reversed(ring)], paint(a))

    def sring(self, c, r, t, color, segs=16):
        """A shock ring round the screen-right axis (the flight line), tilted so it reads as a narrow upright ellipse."""
        e1, e2 = U, (N * 0.9 + R * 0.45).normalized()
        for k in range(segs):
            a0, a1 = k * math.tau / segs, (k + 1) * math.tau / segs
            pts = [c + (e1 * math.cos(a) + e2 * math.sin(a)) * rr for rr, a in ((r, a0), (r, a1), (r - t, a1), (r - t, a0))]
            self.m.poly(pts, color)

    def arc(self, p0, p1, rng, color, n=5, jag=0.06, w=0.045):
        """A jagged lightning arc from p0 to p1 (rng: numpy Generator for the kinks)."""
        d = p1 - p0
        s = N.cross(d).normalized() if d.length > 1e-6 else U
        pts = [p0] + [p0 + d * (i / n) + s * float(rng.uniform(-jag, jag)) for i in range(1, n)] + [p1]
        for a, b in zip(pts, pts[1:]):
            self.streak(a, b, w, w, color)

    def puff(self, c, r, color="fxS", ember=None):
        """A lit smoke puff; ember: a self-lit colour for its underside (fire light from below)."""
        self.sphere(c, r, lambda n: ember if ember and n.dot(U) < -0.5 and n.dot(N) > 0.1 else color, segs=10, rings=7)

    def build(self):
        return [self.m.build()]


def spikes(f, c, n, r0, r1, w, color, rot=0.0):
    for k in range(n):
        a = rot + k * math.tau / n
        d = R * math.cos(a) + U * math.sin(a)
        f.streak(c + d * r0, c + d * r1, w, 0.0, color)
