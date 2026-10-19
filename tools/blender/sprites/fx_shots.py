"""Combat fx v2: projectiles in flight, one looping set of frames per weapon (fxkit's screen frame; they point
screen-right and the renderer rotates them along the shot).

  laser_bolt  cyan bolt: pulsing core and sheath, twisting strands, nodes running back, shedding tail      6 frames
  mass_slug   a spinning metal slug with a white-hot nose, a heat wake and shock rings peeling back       4 frames
  missile     lit body, red nose band and fins, a flickering exhaust and a short smoke trail             4 frames
  ion_bolt    a crackling blue orb: arcs jump off the core, wisps trail                                  6 frames
  fire_shell  a dark shell trailing a flickering tail of fire and smoke                                  4 frames
  pd_shot     a short tracer dash                                                                        2 frames"""
import math

import numpy as np

from .fxkit import N, P, R, U, Fx, fire, spikes


def laser_bolt(k, n=6):
    f = Fx(f"laser_bolt_{k}")
    ph = k / n
    pulse = math.sin(ph * math.tau)
    f.spindle(-0.5, 0.5, 0.22 + 0.03 * pulse, "fxC2", head=0.3)              # halo
    f.spindle(-0.42, 0.48, 0.13 + 0.02 * math.sin(ph * math.tau + 1.5), "fxC1", head=0.3)
    for s, col in ((0.0, "fxC0"), (0.5, "fxC1")):                            # two strands twisting round the core
        pts = [(u, 0.075 * math.sin(math.tau * (u * 1.6 - ph - s)) * min(1.0, (0.48 - u) * 4)) for u in np.linspace(-0.4, 0.44, 11)]
        for (u0, v0), (u1, v1) in zip(pts, pts[1:]):
            f.streak(P(u0, v0), P(u1, v1), 0.05, 0.05, col)
    f.spindle(-0.2 + 0.04 * pulse, 0.44, 0.06, "fxC0", head=0.25)            # the white core
    for j in range(2):                                                       # nodes running head -> tail
        u = 0.36 - ((ph + j / 2) % 1) * 0.72
        f.flat([P(u + du, dv) for du, dv in ((-0.05, 0), (0, -0.045), (0.05, 0), (0, 0.045))], "fxC0")
    r = 0.09 if k % 2 == 0 else 0.13                                          # head flare
    spikes(f, P(0.47, 0), 4, 0.0, r, 0.06, "fxC0", rot=math.pi / 4 * (k % 2))
    for j in range(3):                                                       # fragments shed off the tail
        a = (ph + j / 3) % 1
        u, h = -0.52 - 0.34 * a, 0.09 * (1 - a) + 0.03
        f.spindle(u - 0.1 * (1 - a) - 0.04, u + 0.02, h, "fxC1" if a < 0.45 else "fxC2", head=0.5)
    return f.build()


def mass_slug(k, n=4):
    f = Fx(f"mass_slug_{k}")
    ph = k / n
    L = 0.72 + 0.06 * math.sin(ph * math.tau)
    f.spindle(-L, 0.0, 0.17, "fxR", head=0.1)                                # the heat wake, hottest at the slug
    f.spindle(-L * 0.8, 0.0, 0.1, "fxO", head=0.1)
    f.spindle(-L * 0.5, 0.0, 0.05, "fxY", head=0.1)
    for j in range(2):                                                       # shock rings peeling back off the slug
        a = (ph + j / 2) % 1
        f.sring(P(-0.12 - 0.42 * a, 0, 0.1), 0.1 + 0.08 * a, 0.045, ("fxY", "fxO", "fxR", "fxD")[min(3, int(a * 4))])

    def body(nn, k=k):
        ang = math.atan2(nn.dot(U), nn.dot(N))
        if math.sin(ang * 2 + ph * math.tau * 2) > 0.7:
            return "gmD"                                                     # a spinning band
        return "steelL" if nn.dot(U) > 0.3 else "steel"
    f.tube(P(-0.12, 0, 0.2), P(0.12, 0, 0.2), 0.06, 0.06, body)
    f.tube(P(0.12, 0, 0.2), P(0.24, 0, 0.2), 0.06, 0.0, lambda nn: "fxW" if nn.dot(R) > 0.6 else "fxY")
    return f.build()


def missile(k, n=4):
    f = Fx(f"missile_{k}")
    ph = k / n
    for j in range(3):                                                       # a short smoke trail
        a = (ph + j / 3) % 1
        f.puff(P(-0.5 - 0.3 * a, 0.02 * math.sin(j * 2.1 + k), -0.1), 0.04 + 0.05 * a, "fxS" if a < 0.6 else "fxSD")
    L = 0.24 + (0.06, 0.12, 0.02, 0.09)[k % 4]                                # flickering exhaust
    f.spindle(-0.2 - L, -0.18, 0.13, "fxO", head=0.15)
    f.spindle(-0.2 - L * 0.65, -0.18, 0.07, "fxY", head=0.15)
    f.spindle(-0.2 - L * 0.3, -0.18, 0.04, "fxW", head=0.15)
    lit = lambda col, dark: (lambda nn: col if nn.dot(U) > -0.2 else dark)   # noqa: E731
    f.tube(P(-0.2, 0, 0.2), P(0.1, 0, 0.2), 0.05, 0.05, lit("plate", "steel"))
    f.tube(P(0.1, 0, 0.2), P(0.16, 0, 0.2), 0.05, 0.05, lit("medRed", "rustD"))
    f.tube(P(0.16, 0, 0.2), P(0.27, 0, 0.2), 0.05, 0.0, lit("medRed", "rustD"))
    for s in (-1, 1):                                                        # fins
        f.m.poly([P(-0.2, 0.04 * s, 0.25), P(-0.08, 0.04 * s, 0.25), P(-0.2, 0.12 * s, 0.25)], "gm" if s > 0 else "gmD")
    return f.build()


def ion_bolt(k, n=6):
    f = Fx(f"ion_bolt_{k}")
    rng = np.random.default_rng(40 + k)
    ph = k / n
    for j in range(2):                                                       # wisps trailing the orb
        a = (ph + j / 2) % 1
        f.spindle(-0.55 - 0.15 * a, -0.08, 0.1 * (1 - a) + 0.04, "fxI2", v=0.05 * math.sin(j * 3 + k), head=0.6)
    f.sphere(P(0, 0), 0.16 + 0.015 * math.sin(ph * math.tau), lambda nn: "fxI1" if nn.dot(N) > 0.3 else "fxI2", segs=12, rings=8)
    f.sphere(P(0, 0, 0.1), 0.075, lambda nn: "fxI0", segs=10, rings=6)
    for j in range(3):                                                       # arcs jumping off the core
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0.22, 0.3)
        f.arc(P(0, 0, 0.2), P(r * math.cos(a), r * math.sin(a), 0.2), rng, "fxI0" if j == 0 else "fxI1", n=4, jag=0.05)
    return f.build()


def fire_shell(k, n=4):
    f = Fx(f"fire_shell_{k}")
    rng = np.random.default_rng(60 + k)
    for j in range(7):                                                       # the fire tail, jittered per frame
        u = -0.08 - 0.09 * j - rng.uniform(0, 0.04)
        v = rng.uniform(-0.03, 0.03) * (1 + j * 0.3)
        heat = 1.0 - 0.1 * j
        f.sphere(P(u, v, 0.05 - 0.01 * j), 0.1 - 0.008 * j, lambda nn, h=heat: fire(h, nn.dot(N), nn.dot(U)), segs=10, rings=6)
    f.puff(P(-0.78 - 0.04 * (k % 2), 0.04, -0.1), 0.06, "fxSD")
    f.tube(P(-0.04, 0, 0.25), P(0.1, 0, 0.25), 0.065, 0.065, lambda nn: "gm" if nn.dot(U) > 0 else "gmD")
    f.tube(P(0.1, 0, 0.25), P(0.18, 0, 0.25), 0.065, 0.0, lambda nn: "fxO" if nn.dot(R) > 0.5 else "gm")
    return f.build()


def pd_shot(k, n=2):
    f = Fx(f"pd_shot_{k}")
    L = 0.36 if k == 0 else 0.3
    f.spindle(-L, 0.1, 0.07, "fxO", head=0.2)
    f.spindle(-L * 0.7, 0.1, 0.035, "fxW", head=0.2)
    return f.build()


SHOTS = (("laser_bolt", laser_bolt, 6), ("mass_slug", mass_slug, 4), ("missile", missile, 4), ("ion_bolt", ion_bolt, 6),
         ("fire_shell", fire_shell, 4), ("pd_shot", pd_shot, 2))
