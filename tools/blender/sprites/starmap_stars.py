"""More sector bodies for the starmap, the stars (family `starmap`): starmap.body.<kind>.v0..v2 and the plain id (= v0), in
the frame and scale of starmap_bodies (a 96 px frame at 1x, the body radius RB = 30 px is the map's r).

  binary_star  a primary and a smaller companion, each with its own halo: yellow + red dwarf, blue giant + yellow, and a red
               giant feeding a white dwarf through a glowing stream onto a small disc
  white_dwarf  a small, very hot white star (0.45 RB) in a strong glow; v1 and v2 sit in a ring nebula (glow only)
  pulsar       a tiny neutron star (0.22 RB) with two light beams from its tilted poles (glow only); v1 adds an equatorial
               torus, v2 the wavy filaments of a faint supernova remnant
  protostar    a young orange star inside a dusty disc lit from within, with jets along its poles: the disc nearly edge on,
               open with gaps, and edge on with long jets

Small cores leave room in the frame for their glow, so the map should give them a larger r than their look suggests (see
docs/ARCHITECTURE.md, "Starmap art")."""
import math

import numpy as np
from mathutils import Vector

from . import core
from .starmap_bodies import EDGE, NV, RB, STARS, items, star
from .starmap_kit import N, R, U, Noise, P, annulus, disc, glow_only, hue, px, selflit, sphere, start, streak

KINDS = ("binary_star", "white_dwarf", "pulsar", "protostar")
VARIANTS = 3
WHITE = dict(ramp=("arc", "fxH0", "icL", "fxH1"), edges=(0.62, 0.4, 0.18), spot=("fxH1", "fxH1"), glow=0.3,
             halo=("arc", "fxH1", "fxH1", "fxC2"), bands=(0.6, 0.3, 0.14, 0.06), gran=0.05, spots=0, flares=0,
             flare=("fxH0", "fxH1"))
PROTO = dict(ramp=("fxY", "fxO", "fxR", "fxD"), edges=(0.8, 0.5, 0.25), spot=("fxD", "fxR"), halo="fxO", glow=0.25,
             bands=(0.3, 0.16, 0.08, 0.04), gran=0.25, spots=0, flares=0, flare=("fxY", "fxO"))


def _spec(name):
    return WHITE if name == "white" else STARS[name]


def _reach(off, r):
    """Halo reach of a star of radius r at screen offset off (body radii), kept inside the frame."""
    return min(r * 1.65, EDGE - math.hypot(*off) * RB)


# ---- binary star ------------------------------------------------------------------------------------------------------
# (star spec, radius and screen offset (u, v) in body radii) for the primary a and the companion b
BINARIES = (
    dict(a=("star", 0.66, (-0.34, 0.12)), b=("red_dwarf", 0.32, (0.72, -0.34))),
    dict(a=("blue_giant", 0.7, (-0.3, -0.06)), b=("star", 0.36, (0.7, 0.4))),
    dict(a=("red_dwarf", 0.74, (-0.3, 0.08)), b=("white", 0.16, (0.8, -0.22)), stream=True),
)


def binary(seed, spec):
    objs, halo = [], []
    for k, key in enumerate("ab"):
        name, r, off = spec[key]
        s = dict(_spec(name), flares=min(_spec(name)["flares"], 1 if key == "b" else 2), spots=min(_spec(name)["spots"], 3))
        o, h = star(None, seed + k, spec=s, c=P(off[0] * RB, off[1] * RB, -k * RB * 0.2), r=r * RB, reach=_reach(off, r * RB))
        objs += o
        halo += h
    if spec.get("stream"):                      # the giant's gas falling onto a disc round the white dwarf
        (_, ra, oa), (_, rb, ob) = spec["a"], spec["b"]
        pa, pb = np.array(oa), np.array(ob)
        d = (pb - pa) / np.linalg.norm(pb - pa)
        side = np.array([-d[1], d[0]])
        p0, p2 = pa + d * ra * 0.97, pb + side * rb * 2.2
        p1 = (p0 + p2) / 2 + side * 0.22
        m = core.Mesh("stream")
        pts = [(1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2 for t in np.linspace(0, 1, 13)]
        for k, (a, b) in enumerate(zip(pts, pts[1:])):
            w = px(4.0 - 2.6 * k / 12)
            streak(m, P(a[0] * RB, a[1] * RB, RB * 0.1), P(b[0] * RB, b[1] * RB, RB * 0.1), w, w, selflit("fxO" if k < 7 else "fxY", 0.6))
        axis = (U * 0.95 + N * 0.3).normalized()
        c = P(ob[0] * RB, ob[1] * RB, 0)
        annulus(m, c, axis, rb * RB * 1.3, rb * RB * 2.5,
                lambda f, a, cc: [selflit("fxY" if x < 0.4 else "fxO", 0.4) for x in f], segs=48, rings=2)
        objs.append(m.build())
    return objs, halo


# ---- white dwarf ------------------------------------------------------------------------------------------------------
# ring nebula: (inner hue, outer hue) or None; the ring's plane normal
DWARFS = (dict(ring=None), dict(ring=("fxH1", "rvG")), dict(ring=("fxO", "fxR")))
RING_AXIS = (0.3 * R + 0.45 * U + 0.84 * N).normalized()


def white_dwarf(seed, spec):
    objs, halo = star(None, seed, spec=WHITE, r=RB * 0.45, reach=RB * (1.25 if spec["ring"] is None else 0.9))
    if spec["ring"]:
        noise = Noise(seed + 3)
        inner, outer = spec["ring"]
        m = core.Mesh("ring")

        def paint(f, a, c):
            clump = noise.fbm(np.asarray(c) / RB * 3.0)
            return [None if q < 0.3 else glow_only(hue(inner if x < 0.45 else outer,
                                                       (0.18 if x < 0.45 else 0.1) * (0.5, 0.75, 1.0)[min(2, int((q - 0.3) * 7))]))
                    for x, q in zip(f, clump)]
        annulus(m, P(0, 0, -RB * 0.2), RING_AXIS, RB * 0.95, RB * 1.5, paint, segs=256, rings=12)
        halo.append(m.build())
    return objs, halo


# ---- pulsar -----------------------------------------------------------------------------------------------------------
PULSARS = (dict(tilt=25, torus=False, shell=False), dict(tilt=-35, torus=True, shell=False), dict(tilt=60, torus=False, shell=True))
BEAM = ((0.14, 0.12, 0.4), (0.32, 0.06, 0.18), (0.8, 0.025, 0.06))    # (glow strength, width at the core, at the end) in RB


def pulsar(seed, spec):
    rc = RB * 0.22
    body = core.Mesh("pulsar")
    sphere(body, Vector(), rc, lambda ns: [selflit("fxC0" if t > 0.55 else "arc" if t > 0.25 else "fxH1", 0.5) for t in ns @ NV],
           segs=48, rings=32)
    halo = core.Mesh("halo")
    for k, (lv, r0, r1) in enumerate(((0.6, 0.98, 1.4), (0.3, 1.4, 2.0), (0.12, 2.0, 2.7))):      # corona, in core radii
        annulus(halo, P(0, 0, -RB * (0.3 + 0.01 * k)), N, rc * r0, rc * r1, lambda f, a, c, lv=lv: [glow_only(hue("fxH1", lv))] * len(f))
    t = math.radians(spec["tilt"])
    d = R * math.sin(t) + U * math.cos(t)
    for sgn in (1, -1):                        # each beam fades in steps along its length, the wide soft ones behind
        for k, (lv, w0, w1) in enumerate(BEAM):
            o = N * (-RB * (0.62 - 0.01 * k))
            for j, fade in enumerate((1.0, 0.6, 0.35)):
                a, b = rc * 0.8 + (EDGE * 0.98 - rc * 0.8) * j / 3, rc * 0.8 + (EDGE * 0.98 - rc * 0.8) * (j + 1) / 3
                wa, wb = w0 + (w1 - w0) * j / 3, w0 + (w1 - w0) * (j + 1) / 3
                streak(halo, d * sgn * a + o, d * sgn * b + o, wa * RB, wb * RB, glow_only(hue("arc" if k == 2 else "fxH1", lv * fade)))
    if spec["torus"]:                          # the equatorial wind: a glowing ring across the beams
        ax = (d * 0.86 + N * 0.5).normalized()
        annulus(halo, Vector(), ax, RB * 0.72, RB * 0.95, lambda f, a, c: [glow_only(hue("fxH1", 0.24 if x < 0.5 else 0.12)) for x in f],
                segs=128, rings=2)
    if spec["shell"]:                          # a faint supernova remnant: wavy filaments round the pulsar
        rng = np.random.default_rng(seed + 9)
        for k in range(16):
            a0, span = rng.uniform(0, math.tau), rng.uniform(0.5, 1.1)
            r0, wob, ph = RB * rng.uniform(1.15, 1.45), RB * rng.uniform(0.03, 0.07), rng.uniform(0, math.tau)
            pts = [P((r0 + wob * math.sin(6 * s + ph)) * math.cos(a0 + span * s), (r0 + wob * math.sin(6 * s + ph)) * math.sin(a0 + span * s),
                     -RB * 2) for s in np.linspace(0, 1, 12)]
            look = glow_only(hue("fxR" if k % 3 else "rvG", 0.11))
            for p0, p1 in zip(pts, pts[1:]):
                streak(halo, p0, p1, px(1.6), px(1.6), look)
    return [body.build()], [halo.build()]


# ---- protostar --------------------------------------------------------------------------------------------------------
# open: how far the disc opens towards the camera (0 edge on); gaps: radius fractions of cleared rings; jets: length in RB
PROTOS = (dict(open=0.24, tilt=-12, gaps=(), jets=1.1), dict(open=0.5, tilt=8, gaps=((0.42, 0.48), (0.7, 0.73)), jets=0.7),
          dict(open=0.1, tilt=-4, gaps=(), jets=1.5))
DUST = ("gdD", "rustD", "rkD", "rkK", "hazK")                   # the disc from its lit inner rim outward


def protostar(seed, spec):
    rc = RB * 0.36
    t = math.radians(spec["tilt"])
    up = R * math.sin(t) + U * math.cos(t)
    axis = (up * math.cos(math.asin(spec["open"])) + N * spec["open"]).normalized()
    objs, halo = star(None, seed, spec=PROTO, r=rc, reach=RB * 0.95)
    noise = Noise(seed + 4)
    m = core.Mesh("disc")

    def paint(f, a, c):
        q = noise.fbm(np.asarray(c) / RB * 3.2)
        out = []
        for x, qq in zip(f, q):
            if any(g0 < x < g1 for g0, g1 in spec["gaps"]) or x + (qq - 0.5) * 0.3 > 0.97:
                out.append(None)
            elif x < 0.06:
                out.append(selflit("fxO", 0.5))
            elif x < 0.16:
                out.append(selflit("fxR", 0.3))
            else:
                out.append(selflit(DUST[min(4, int((x + (qq - 0.5) * 0.25) * 5))], 0.0))
        return out
    annulus(m, Vector(), axis, rc * 1.25, EDGE * 0.95, paint, segs=180, rings=14)
    objs.append(m.build())
    jets = core.Mesh("jets")
    jd = Vector(axis - N * (axis @ N)).normalized()
    for sgn in (1, -1):
        o = N * (RB * 0.05)
        streak(jets, jd * sgn * rc * 0.9 + o, jd * sgn * RB * spec["jets"] + o, px(1.4), px(0.8), glow_only(hue("fxH1", 0.3)))
        for k in range(1, 4):                  # knots where the jet rams the gas round it
            disc(jets, jd * sgn * RB * spec["jets"] * (0.4 + 0.2 * k) + o * 2, px(1.5 - 0.2 * k), glow_only(hue("fxO", 0.45 - 0.1 * k)), segs=16)
    for sgn in (1, -1):                        # dim reflection lobes above and below the disc
        disc(jets, jd * sgn * RB * 0.55 + N * (-RB * 2), RB * 0.42, glow_only(hue("fxO", 0.06)), segs=48)
    halo.append(jets.build())
    return objs, halo


BUILD = {"binary_star": (binary, BINARIES), "white_dwarf": (white_dwarf, DWARFS), "pulsar": (pulsar, PULSARS),
         "protostar": (protostar, PROTOS)}


def star_items(kind, v):
    start()
    fn, specs = BUILD[kind]
    objs, halo = fn(12001 + 37 * KINDS.index(kind) + v, specs[v])
    return items(kind, v, halo)


def jobs():
    return [lambda kind=kind, v=v: star_items(kind, v) for kind in KINDS for v in range(VARIANTS)]
