"""Escape pod sprite family (escape_pod.py). Preview phase: `escape_pod_variants` renders each cone variant's flying
headings d0, d2 and d5 as vehicle.escape_pod.<variant>.fly.d<d>, to pick a shape."""
import math

from . import core, post, vehicle_bay as VB, escape_pod as E

CRAFT = "vehicle.escape_pod"


def craft_item(name, heading, variant, state, beacon=False):
    core.clear_scene_meshes()
    post.select(True)
    return [VB._render(name, "prop", E.pod(heading, variant, state, beacon), [], (1, 1))]


def variant_jobs():
    return [lambda v=v, d=d: craft_item(f"{CRAFT}.{v}.fly.d{d}", d * math.pi / 4, v, "fly")
            for v in E.VARIANTS for d in (0, 2, 5)]
