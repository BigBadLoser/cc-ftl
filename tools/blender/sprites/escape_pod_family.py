"""Escape pod sprite family (escape_pod.py). Preview phase: `escape_pod_variants` renders each cone variant's flying
headings d0, d2 and d5 as vehicle.escape_pod.<variant>.fly.d<d>, and drifting (upright, beacon on in f0, off in f1) as
.drift.d<d>.f<k>, to pick a shape."""
import math

from . import core, post, vehicle_bay as VB, escape_pod as E

CRAFT = "vehicle.escape_pod"


def craft_item(name, heading, variant, state, beacon=False):
    core.clear_scene_meshes()
    post.select(True)
    return [VB._render(name, "prop", E.pod(heading, variant, state, beacon), [], (1, 1))]


def variant_jobs():
    return [lambda v=v, d=d: craft_item(f"{CRAFT}.{v}.fly.d{d}", d * math.pi / 4, v, "fly")
            for v in E.VARIANTS for d in (0, 2, 5)] + \
        [lambda v=v, d=d, k=k: craft_item(f"{CRAFT}.{v}.drift.d{d}.f{k}", d * math.pi / 4, v, "drift", k == 0)
         for v in E.VARIANTS for d in (0, 2, 5) for k in (0, 1)] + \
        [lambda v=v, d=d: craft_item(f"{CRAFT}.{v}.docked.d{d}", d * math.pi / 4, v, "docked")
         for v in E.VARIANTS for d in (0, 2, 5)]
