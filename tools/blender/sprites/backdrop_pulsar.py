"""The backdrop's pulsar (backdrop_bodies): the starmap pulsar's design per variant (starmap_stars.PULSARS: beam tilt,
equatorial wind torus, supernova shell) rebuilt to hold up at the backdrop size: the beams are many overlapping layers,
wide and dim to narrow and bright, each fading smoothly along its length, so they read as soft cones of light; the corona,
the torus and the shell filaments fade smoothly too. Glow faces occlude rather than add, so the narrow bright layers sit in
front of the wide dim ones. Built in starmap units (RB), scaled up by backdrop_bodies."""
import math

import numpy as np
from mathutils import Vector

from . import core
from .starmap_bodies import EDGE, NV, RB
from .starmap_kit import N, R, U, P, annulus, glow_only, hue, px, selflit, sphere, streak

LAYERS = 12                     # beam cross-section layers
SEGS = 40                       # beam steps along its length


def pulsar(seed, spec):
    rc = RB * 0.22
    body = core.Mesh("pulsar")
    sphere(body, Vector(), rc, lambda ns: [selflit("fxC0" if t > 0.55 else "arc" if t > 0.25 else "fxH1", 0.5) for t in ns @ NV],
           segs=48, rings=32)
    halo = core.Mesh("halo")
    n = 16                                                         # a soft corona, out to 3 core radii
    for k in range(n):
        x0, x1 = k / n, (k + 1) / n
        lv = 0.55 * 0.5 ** (5 * x0) * (1 - x0) ** 1.5
        annulus(halo, P(0, 0, -RB * (0.3 + 0.002 * k)), N, rc * (0.98 + 2.0 * x0), rc * (0.98 + 2.0 * x1),
                lambda f, a, c, lv=lv: [glow_only(hue("fxH1", lv))] * len(f))
    t = math.radians(spec["tilt"])
    d = R * math.sin(t) + U * math.cos(t)
    start, end = rc * 0.8, EDGE * 0.97
    for sgn in (1, -1):
        for k in range(LAYERS):                                    # wide and dim behind, narrow and bright in front
            q = k / (LAYERS - 1)
            w0, w1 = RB * (0.16 - 0.14 * q), RB * (0.42 - 0.38 * q)
            strength = 0.1 + 0.7 * q ** 2                          # glow faces occlude, not add: the front layers set the core
            o = N * (-RB * (0.25 - 0.002 * k))                     # in front of the corona (-0.3 RB), behind the core
            for j in range(SEGS):
                a, b = j / SEGS, (j + 1) / SEGS
                m = 1 - (a + b) / 2
                fade = m ** 0.9 * min(1.0, m / 0.3) ** 1.5                  # the last stretch dissolves, no blunt end
                streak(halo, d * sgn * (start + (end - start) * a) + o, d * sgn * (start + (end - start) * b) + o,
                       w0 + (w1 - w0) * a, w0 + (w1 - w0) * b, glow_only(hue("arc" if q > 0.8 else "fxH1", strength * fade)))
    if spec["torus"]:                                              # the equatorial wind: a soft glowing ring
        ax = (d * 0.86 + N * 0.5).normalized()
        annulus(halo, Vector(), ax, RB * 0.66, RB * 1.0,
                lambda f, a, c: [glow_only(hue("fxH1", 0.14 * math.sin(math.pi * x) ** 1.5)) for x in f], segs=128, rings=10)
    if spec["shell"]:                                              # a faint supernova remnant: fine wavy filaments
        rng = np.random.default_rng(seed + 9)
        for k in range(16):
            a0, span = rng.uniform(0, math.tau), rng.uniform(0.5, 1.1)
            r0, wob, ph = RB * rng.uniform(1.15, 1.45), RB * rng.uniform(0.03, 0.07), rng.uniform(0, math.tau)
            pts = [P((r0 + wob * math.sin(6 * s + ph)) * math.cos(a0 + span * s), (r0 + wob * math.sin(6 * s + ph)) * math.sin(a0 + span * s),
                     -RB * 2) for s in np.linspace(0, 1, 36)]
            name = "fxR" if k % 3 else "rvG"
            for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
                fade = math.sin(math.pi * (i + 0.5) / (len(pts) - 1))
                streak(halo, p0, p1, px(0.8), px(0.8), glow_only(hue(name, 0.12 * fade)))
    return [body.build()], [halo.build()]
