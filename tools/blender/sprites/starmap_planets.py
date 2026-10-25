"""More sector bodies for the starmap, the planets (family `starmap`): starmap.body.<kind>.v0..v2 and the plain id (= v0),
in the frame and scale of starmap_bodies (a 96 px frame at 1x, the body radius RB = 30 px is the map's r). Lit from the
upper left like the gas giant and the ships, shaded in palette bands, outlined.

  ice_giant    the gas giant's cold cousin: cyan, teal or deep blue bands and thin dark rings; v1 has a dark storm, v2
               lies on its side (Uranus), its rings nearly upright
  lava_world   dark rock split by glowing molten cracks that also glow on the night side, in a faint heat haze; v2 has a
               molten sea
  ocean_world  blue seas, continents, ice caps, a cloud layer above the surface, city lights on the night side and an
               atmosphere glow at the rim: green lands, an arid world, and a water world with a cyclone"""
import math

import numpy as np
from mathutils import Vector

from . import core
from .starmap_bodies import LV, NV, RB, _shade, gas_giant, items
from .starmap_kit import N, R, U, Noise, P, annulus, flat, glow_only, hue, selflit, sphere, start

KINDS = ("ice_giant", "lava_world", "ocean_world")
VARIANTS = 3


def _haze(m, hue_name, levels, r0=1.0, step=0.06):
    """Glow-only bands just outside the limb (behind the planet): an atmosphere or a heat haze."""
    for k, lv in enumerate(levels):
        a, b = RB * (r0 + step * k), RB * (r0 + step * (k + 1))
        annulus(m, P(0, 0, -RB * (1.5 + 0.01 * k)), N, a, b, lambda f, aa, c, lv=lv: [glow_only(hue(hue_name, lv))] * len(f), segs=128)


# ---- ice giant --------------------------------------------------------------------------------------------------------
ICE_RAMP = {
    "ice": ("icL", "ic", "icM", "icD", "bD"),
    "teal": ("wH", "wL", "wS", "wM", "wD"),
    "blue": ("c3T1", "c3T2", "c3T4", "c3T5", "c3T6"),
    "deep": ("hbL", "hbM", "hbD", "hbK", "bXK"),
    "pale": ("c3T0", "c3T1", "c3T2", "c3T4", "c3T6"),
}
ICES = (
    dict(bands=((-62, "teal"), (-28, "ice"), (-12, "teal"), (16, "ice"), (42, "teal"), (90, "ice")), storm=None, turb=4,
         axis=(-0.22, 0.88, 0.42)),
    dict(bands=((-56, "deep"), (-22, "blue"), (-9, "deep"), (20, "blue"), (50, "deep"), (90, "blue")),
         storm=(-24, -0.45, 0.16, "deep", "pale"), turb=5, axis=(-0.18, 0.9, 0.4)),
    dict(bands=((-72, "ice"), (72, "pale"), (90, "ice")), storm=None, turb=3, axis=(0.9, 0.18, 0.4)),
)
ICE_RING = ((1.3, 1.34, "bD"), (1.42, 1.46, "bM"))


def ice_giant(seed, spec):
    axis = (R * spec["axis"][0] + U * spec["axis"][1] + N * spec["axis"][2]).normalized()
    return gas_giant(seed, spec, ramps=ICE_RAMP, axis=axis, ring=ICE_RING, shadow="bK")


# ---- lava world -------------------------------------------------------------------------------------------------------
LAVAS = (dict(freq=1.9, width=0.045, sea=None), dict(freq=2.7, width=0.036, sea=None), dict(freq=1.6, width=0.05, sea=0.64))
ROCK = ("rkL", "rk", "rkM", "rkD", "rkK")


def lava_world(seed, spec):
    cracks, seas = Noise(seed), Noise(seed + 5)
    w = spec["width"]

    def paint(ns):
        step = _shade(ns @ LV)
        rid = np.abs(cracks.fbm(ns * spec["freq"], 2) - 0.5)       # the 0.5 contour of smooth noise: a joined crack network
        sea = seas.fbm(ns * 1.5) if spec["sea"] else np.zeros(len(ns))
        out = []
        for s, r, q in zip(step, rid, sea):
            if spec["sea"] and q > spec["sea"]:
                out.append(selflit("fxO" if q > spec["sea"] + 0.05 else "fxR", 0.5) if r > w * 0.5 else flat(ROCK[min(4, s + 1)]))
            elif r < w * 0.35:
                out.append(selflit("fxY", 0.7))
            elif r < w * 0.7:
                out.append(selflit("fxO", 0.55))
            elif r < w:
                out.append(selflit("fxR", 0.35))
            else:
                out.append(flat(ROCK[s]))
        return out
    m = core.Mesh("lava")
    sphere(m, Vector(), RB, paint)
    haze = core.Mesh("haze")
    _haze(haze, "fxR", (0.06,), step=0.05)
    return [m.build()], [haze.build()]


# ---- ocean world ------------------------------------------------------------------------------------------------------
# land: share of the surface above sea level (higher = less land); desert: share of the land that is desert; caps: latitude
# the ice caps start at; clouds: cloud threshold (higher = fewer); cyclone: (latitude, longitude, size) or None
OCEANS = (dict(land=0.55, desert=0.0, caps=64, clouds=0.57, cyclone=None),
          dict(land=0.5, desert=0.65, caps=76, clouds=0.66, cyclone=None),
          dict(land=0.65, desert=0.0, caps=70, clouds=0.6, cyclone=(16, 0.35, 0.5)))
SEA = ("c3T2", "c3T3", "c3T4", "c3T5", "c3T6")
COAST = ("wH", "wL", "wS", "wM", "wD")
GREEN = ("xnFL", "jacket", "xnF", "jacketD", "xnFD")
SAND = ("c2T2", "c2T3", "c2T5", "c2T6", "oXK")
ICECAP = ("icL", "ic", "icM", "icD", "bD")
CLOUD = ("c3W0", "c3W2", "c3W4", "c3W6", "steel")
OCEAN_AXIS = (-0.15 * R + 0.95 * U + 0.25 * N).normalized()


def ocean_world(seed, spec):
    height, kinds, cloud, specks = Noise(seed), Noise(seed + 2), Noise(seed + 3), Noise(seed + 6)
    A = np.array(OCEAN_AXIS)

    def surface(ns):
        step = _shade(ns @ LV)
        lat = np.degrees(np.arcsin(np.clip(ns @ A, -1, 1)))
        h = height.fbm(ns * 1.8, 4)
        dry = kinds.fbm(ns * 2.2) < spec["desert"]
        city = specks(ns * 22.0) > 0.78
        out = []
        for s, la, hh, d, c in zip(step, lat, h, dry, city):
            if abs(la) > spec["caps"] + (hh - 0.5) * 20:
                out.append(flat(ICECAP[s]))
            elif hh > spec["land"]:
                out.append(selflit("lampY", 0.6) if s >= 3 and c else flat((SAND if d else GREEN)[s]))
            elif hh > spec["land"] - 0.035:
                out.append(flat(COAST[s]))
            else:
                out.append(flat(SEA[s]))
        return out

    def clouds(ns):
        step = _shade(ns @ LV)
        q = cloud.fbm(ns * np.array([2.6, 2.6, 2.6]) + np.sin(ns @ A * 9)[:, None] * 0.15, 4)
        if spec["cyclone"]:
            la, lo, size = spec["cyclone"]
            c = math.radians(la)
            e1 = np.cross(A, NV)
            e1 /= np.linalg.norm(e1)
            d = math.cos(c) * (math.cos(lo) * NV + math.sin(lo) * e1) + math.sin(c) * A
            d /= np.linalg.norm(d)
            t1 = np.cross(d, A)
            t1 /= np.linalg.norm(t1)
            t2 = np.cross(d, t1)
            ang = np.arccos(np.clip(ns @ d, -1, 1))
            phi = np.arctan2(ns @ t2, ns @ t1)
            arm = np.sin(2 * phi + ang / size * 9) > 0.1
            q = np.where(ang < size, np.where(ang < size * 0.08, 0.0, np.where(arm, 1.0, 0.0)), q)
        return [flat(CLOUD[s]) if qq > spec["clouds"] else None for s, qq in zip(step, q)]
    ground = core.Mesh("ocean")
    sphere(ground, Vector(), RB, surface, axis=OCEAN_AXIS)
    sky = core.Mesh("clouds")
    sphere(sky, Vector(), RB * 1.025, clouds, axis=OCEAN_AXIS)
    air = core.Mesh("air")
    _haze(air, "fxH1", (0.09, 0.04), r0=0.99, step=0.04)
    return [ground.build(), sky.build()], [air.build()]


BUILD = {"ice_giant": (ice_giant, ICES), "lava_world": (lava_world, LAVAS), "ocean_world": (ocean_world, OCEANS)}


def planet_items(kind, v):
    return items(kind, v, *scene(kind, v))


def scene(kind, v):
    """Build variant v of a planet kind in a fresh scene; -> (halo objects, outlined?)."""
    start()
    fn, specs = BUILD[kind]
    objs, halo = fn(14001 + 37 * KINDS.index(kind) + v, specs[v])
    return halo, True


def jobs():
    return [lambda kind=kind, v=v: planet_items(kind, v) for kind in KINDS for v in range(VARIANTS)]
