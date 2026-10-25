"""Sector bodies for the starmap (family `starmap`): starmap.body.<kind>.v0..v2, and starmap.body.<kind> (= v0).

Every body renders into the same FRAME (96 px at 1x, 192 at 2x), centred on the anchor, with the body's radius BODY px (30 at
1x, 60 at 2x). The map scales a sprite by r / BODY, so halos, rings and discs reach past r up to 1.6 r (the frame's edge).

  star        yellow-white, granulated, a couple of spots and prominences; warm halo (glow)
  red_dwarf   deep red, heavily spotted, more flares; red halo (glow)
  blue_giant  blue-white, smooth; cyan halo (glow)
  gas_giant   banded amber planet with a tilted ring, lit from the upper left like the ships; no glow; outlined
  black_hole  dark core, photon ring and the lensed far side of an amber accretion disc; the disc glows
  nebula      glow only (nothing on the colour sheet): self-lit gas puffs at low strength, dark lanes, a few young stars

Stars, the gas giant and the disc shade themselves in palette bands (faces in flat or self-lit palette colours chosen by
their normal), so the bands are crisp at both scales. Variants differ by seed (spots, bands, storm, streaks, cloud shape)."""
import math

import numpy as np
from mathutils import Matrix, Vector

from . import core
from .starmap_kit import (N, R, U, Noise, P, annulus, flat, frame_item, glow_only, hue, px, selflit, sphere,
                          start, streak)

FRAME = 96                      # frame side, 1x px
BODY = 30                       # body radius, 1x px
RB = px(BODY)
EDGE = px(FRAME / 2 - 1)        # the frame's inner edge (radius)
KINDS = ("star", "red_dwarf", "blue_giant", "gas_giant", "black_hole", "nebula")
VARIANTS = 3
LIGHT = (-0.5 * R + 0.55 * U + 0.67 * N).normalized()     # the gas giant's sun: upper left, a little towards the camera
NV, LV = np.array(N), np.array(LIGHT)

# ---- stars ------------------------------------------------------------------------------------------------------------
# ramp: centre to limb; edges: facing (n . N) thresholds between ramp steps; spot: umbra, penumbra; halo: glow hue and the
# strength of each band from the limb out; glow: the disc's own glow; gran: granulation strength; spots / flares: counts.
STARS = {
    "star": dict(ramp=("fxW", "lampY", "fxY", "fxO"), edges=(0.8, 0.55, 0.3), spot=("fxR", "fxO"), halo="fxY", glow=0.2,
                 bands=(0.42, 0.22, 0.11, 0.05), gran=0.2, spots=2, flares=2, flare=("fxY", "fxO")),
    "red_dwarf": dict(ramp=("fxO", "fxR", "emR", "fxD"), edges=(0.9, 0.6, 0.3), spot=("rK", "fxD"), halo="fxR", glow=0.12,
                      bands=(0.4, 0.2, 0.1, 0.045), gran=0.26, spots=5, flares=3, flare=("fxO", "fxR")),
    "blue_giant": dict(ramp=("fxH0", "fxH1", "fxC2", "fxH2"), edges=(0.86, 0.5, 0.22), spot=("fxH2", "fxH1"), halo="fxH1", glow=0.1,
                       bands=(0.46, 0.24, 0.12, 0.055), gran=0.12, spots=0, flares=1, flare=("fxH0", "fxH1")),
}


def _star_paint(spec, seed):
    rng = np.random.default_rng(seed)
    noise = Noise(seed)
    spots = []
    for _ in range(spec["spots"]):              # spot centres on the visible face, away from the limb
        while True:
            d = rng.normal(size=3)
            d /= np.linalg.norm(d)
            if d @ NV > 0.45:
                break
        spots.append((d, rng.uniform(0.07, 0.13)))
    ramp, edges = spec["ramp"], spec["edges"]

    def paint(ns):
        t = ns @ NV + (noise.fbm(ns * 5.0) - 0.5) * spec["gran"] * 2
        band = sum((t < e).astype(int) for e in edges)
        looks = [selflit(ramp[b], spec["glow"]) for b in band]
        for d, size in spots:
            ang = np.arccos(np.clip(ns @ d, -1, 1))
            for k in np.nonzero(ang < size * 1.7)[0]:
                looks[k] = selflit(spec["spot"][0] if ang[k] < size else spec["spot"][1], 0.15)
        return looks
    return paint


def _flare(m, rng, look):
    """A prominence: a small loop standing on the limb, in the screen plane."""
    phi = rng.uniform(0, math.tau)
    span, height = rng.uniform(0.18, 0.3), RB * rng.uniform(0.12, 0.2)
    pts = []
    for k in range(9):
        s = k / 8
        a = phi - span / 2 + span * s
        r = RB * 0.97 + height * math.sin(math.pi * s)
        pts.append(P(r * math.cos(a), r * math.sin(a), 0.0))
    for a, b in zip(pts, pts[1:]):
        streak(m, a, b, px(1.6), px(1.6), look)


def star(kind, seed):
    spec = STARS[kind]
    rng = np.random.default_rng(seed + 101)
    body = core.Mesh("star")
    sphere(body, Vector(), RB, _star_paint(spec, seed))
    for k in range(spec["flares"]):
        _flare(body, rng, selflit(spec["flare"][k % 2], 0.8))
    halo = core.Mesh("halo")
    radii = np.linspace(RB * 0.96, EDGE, len(spec["bands"]) + 1)
    for k, level in enumerate(spec["bands"]):
        annulus(halo, P(0, 0, -RB * (1.5 + 0.01 * k)), N, radii[k], radii[k + 1],
                lambda f, a, c, level=level: [glow_only(hue(spec["halo"], level))] * len(f), segs=128)
    return [body.build()], [halo.build()]


# ---- gas giant --------------------------------------------------------------------------------------------------------
# 5-step ramps, light to dark
RAMP = {
    "amber": ("oH", "oL", "oM", "oD", "oK"),
    "cream": ("c2T1", "c2T2", "c2T4", "c2T6", "oK"),
    "rust": ("c1T1", "c1T2", "c1T4", "c1T5", "c1T6"),
    "ochre": ("ochL", "ochM", "ochD", "ochK", "oXK"),
}
# bands: (upper latitude in degrees, ramp) from the south pole up; storm: (latitude, longitude, size) or None
GIANTS = (
    dict(bands=((-50, "ochre"), (-34, "amber"), (-20, "cream"), (-8, "rust"), (8, "cream"), (22, "amber"), (36, "cream"),
                (52, "amber"), (90, "ochre")), storm=None),
    dict(bands=((-46, "ochre"), (-26, "cream"), (-14, "amber"), (10, "cream"), (18, "amber"), (40, "cream"), (90, "ochre")),
         storm=None),
    dict(bands=((-52, "ochre"), (-30, "amber"), (-22, "cream"), (-6, "rust"), (12, "amber"), (26, "cream"), (44, "rust"),
                (90, "ochre")), storm=(-16, 0.5, 0.17)),
)
AXIS = (-0.22 * R + 0.88 * U + 0.42 * N).normalized()       # the ring opens about 0.42 and leans right
RING = ((1.2, 1.31, "c2T3"), (1.35, 1.49, "c2T1"), (1.49, 1.55, "c2T4"))   # (inner, outer in body radii, colour)


def _shade(s):
    return np.select([s > 0.7, s > 0.42, s > 0.14, s > -0.12], [0, 1, 2, 3], 4)


def _ring_shadow(p):
    """Points p (k,3) on the planet: True where the ring stands between them and the sun."""
    A, L = np.array(AXIS), LV
    t = -(p @ A) / (L @ A)
    q = p + t[:, None] * L
    rq = np.linalg.norm(q, axis=1) / RB
    inside = np.zeros(len(p), bool)
    for r0, r1, _ in RING:
        inside |= (rq > r0) & (rq < r1)
    return (t > 0) & inside


def gas_giant(seed, spec):
    noise = Noise(seed)
    A = np.array(AXIS)
    e1 = np.cross(A, NV)
    e1 /= np.linalg.norm(e1)

    def paint(ns):
        lat = np.degrees(np.arcsin(np.clip(ns @ A, -1, 1)))
        lat = lat + (noise.fbm(ns * np.array([6.0, 6.0, 6.0])) - 0.5) * 7 + np.sin(np.arctan2(ns @ np.cross(A, e1), ns @ e1) * 5) * 1.2
        ramp = np.array([next(r for top, r in spec["bands"] if la < top) for la in np.clip(lat, -89, 89)], object)
        step = _shade(ns @ LV) + _ring_shadow(ns * RB) * 2
        if spec["storm"]:
            la, lo, size = spec["storm"]
            c = math.radians(la)
            d = math.cos(c) * (math.cos(lo) * NV + math.sin(lo) * e1) + math.sin(c) * A     # longitude 0 faces the camera
            ang = np.arccos(np.clip(ns @ (d / np.linalg.norm(d)), -1, 1))
            ramp = np.where(ang < size * 0.6, "rust", np.where(ang < size, "cream", ramp))
        return [flat(RAMP[r][min(int(s), 4)]) for r, s in zip(ramp, step)]
    body = core.Mesh("giant")
    sphere(body, Vector(), RB, paint, axis=AXIS)
    ring = core.Mesh("ring")
    for r0, r1, col in RING:
        def rpaint(f, a, c, col=col):
            c = np.asarray(c)
            b = c @ LV
            shadow = (b < 0) & (b * b > (c * c).sum(1) - RB * RB)
            return [flat(RAMP["cream"][3] if s else col) for s in shadow]
        annulus(ring, Vector(), AXIS, RB * r0, RB * r1, rpaint, segs=160)
    return [body.build(), ring.build()], []


# ---- black hole -------------------------------------------------------------------------------------------------------
HOLE = (dict(tilt=-8, twist=1.4), dict(tilt=6, twist=-1.2), dict(tilt=-15, twist=1.8))
DISC_RAMP = ("fxW", "fxY", "fxO", "fxR", "fxD")


def black_hole(seed, spec):
    noise = Noise(seed)
    rc = RB * 0.62
    tilt = math.radians(spec["tilt"])
    axis = Vector((0, 0, 1))
    axis.rotate(Matrix.Rotation(tilt, 3, N))
    core_m = core.Mesh("core")
    sphere(core_m, Vector(), rc, lambda ns: [flat("gK")] * len(ns), segs=64, rings=40)
    rings = core.Mesh("rings")
    annulus(rings, Vector(), N, rc * 0.98, rc * 1.12, lambda f, a, c: [selflit("fxW", 0.6)] * len(f), segs=128)
    annulus(rings, Vector(), N, rc * 1.12, rc * 1.5,
            lambda f, a, c: [selflit("fxY" if fr < 0.35 else "fxO" if fr < 0.75 else "fxR", 0.5) for fr in f],
            segs=96, rings=6, a0=math.radians(12), a1=math.radians(168), e=R)
    annulus(rings, Vector(), N, rc * 1.12, rc * 1.24, lambda f, a, c: [selflit("fxO", 0.7)] * len(f), segs=64,
            a0=math.radians(200), a1=math.radians(340), e=R)
    disc = core.Mesh("disc")
    twist = spec["twist"]

    def dpaint(f, a, c):
        x = np.asarray(c) @ np.array(R)
        streaks = noise.fbm(np.stack([np.cos(a) * 2, np.sin(a) * 2, f * 5 + a * twist], 1))
        v = f * 1.05 + (streaks - 0.5) * 0.55 - np.clip(-x / (RB * 1.5), -1, 1) * 0.12
        out = []
        for vv in v:
            if vv > 1.02:
                out.append(None)
            else:
                out.append(selflit(DISC_RAMP[min(4, int(max(vv, 0) * 5))], 0.4))
        return out
    annulus(disc, Vector(), axis, rc * 1.3, EDGE * 0.94, dpaint, segs=192, rings=14)
    return [core_m.build(), rings.build(), disc.build()], []


# ---- nebula -----------------------------------------------------------------------------------------------------------
NEBULAE = (dict(base="rvG", knot="magenta"), dict(base="fxI1", knot="fxH1"), dict(base="magenta", knot="rvG"))
NEB_STEPS = (0.2, 0.3, 0.4, 0.5)                # density thresholds of the four strengths
NEB_GLOW = (0.045, 0.075, 0.12, 0.19)           # glow strength (linear) per step


def nebula(seed, spec):
    """Flat puffs on a jittered grid, each as strong as a noise density at its centre (four steps, denser puffs in front), so
    the cloud has scalloped, stepped contours and dark lanes where the density drops."""
    rng = np.random.default_rng(seed)
    noise = Noise(seed + 7)
    m = core.Mesh("cloud")
    step = px(4)
    k = int(EDGE / step)
    for gy in range(-k, k + 1):
        for gx in range(-k, k + 1):
            u, v = (gx + rng.uniform(-0.4, 0.4)) * step, (gy + rng.uniform(-0.4, 0.4)) * step
            fall = (u / (1.45 * RB)) ** 2 + (v / (1.05 * RB)) ** 2
            d = float(noise.fbm(np.array([u / RB * 1.4, v / RB * 1.4, 0.37]), 4)) - 0.42 * fall
            level = sum(d > t for t in NEB_STEPS)
            r = step * rng.uniform(0.8, 1.15)
            if level == 0 or math.hypot(u, v) + r > EDGE:
                continue
            col = spec["knot"] if level == len(NEB_STEPS) else spec["base"]
            look = glow_only(hue(col, NEB_GLOW[level - 1]))
            sphere(m, P(u, v, level * px(3) + rng.uniform(0, px(1))), r, lambda ns, look=look: [look] * len(ns), segs=12, rings=8)
    for _ in range(3):                                            # young stars inside it
        u, v = rng.uniform(-0.6, 0.6) * RB, rng.uniform(-0.4, 0.4) * RB
        sphere(m, P(u, v, RB * 3), px(1.4), lambda ns: [glow_only(hue("arc", 0.9))] * len(ns), segs=10, rings=6)
    return [], [m.build()]


def body_items(kind, v):
    """The variant v of a body kind (plus the plain id for v0)."""
    start()
    seed = 9001 + 37 * KINDS.index(kind) + v
    if kind in STARS:
        objs, halo = star(kind, seed)
    elif kind == "gas_giant":
        objs, halo = gas_giant(seed, GIANTS[v])
    elif kind == "black_hole":
        objs, halo = black_hole(seed, HOLE[v])
    else:
        objs, halo = nebula(seed, NEBULAE[v])
    it = frame_item(f"starmap.body.{kind}.v{v}", FRAME, halo=halo, outline=kind == "gas_giant")
    return [it, {**it, "id": f"starmap.body.{kind}"}] if v == 0 else [it]


def jobs():
    return [lambda kind=kind, v=v: body_items(kind, v) for kind in KINDS for v in range(VARIANTS)]
