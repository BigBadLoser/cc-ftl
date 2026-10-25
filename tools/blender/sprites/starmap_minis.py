"""Mini bodies for the starmap's outer zoom (family `starmap`): starmap.mini.<kind>.v<n> and the plain id (= v0), one for
every body variant (starmap_bodies, starmap_stars, starmap_planets), for the Cluster view, which draws each sector's body
as a dot of about 6 screen px radius.

Each is that variant's own scene shrunk to a sixth, a 16 px frame at 1x, and rendered, not downscaled, so it
stays crisp at that size and matches its full body. Same layout as the big ones: anchor at the centre, body radius r = 5
px at 1x, frame = 3.2 r."""
import bpy

from . import starmap_bodies, starmap_planets, starmap_stars
from .starmap_bodies import FRAME
from .starmap_kit import frame_item

MINI = 16                       # frame, 1x px
SOURCES = ((starmap_bodies, starmap_bodies.variants), (starmap_stars, lambda kind: starmap_stars.VARIANTS),
           (starmap_planets, lambda kind: starmap_planets.VARIANTS))


def mini_items(kind, v):
    mod = next(m for m, _ in SOURCES if kind in m.KINDS)
    halo, outline = mod.scene(kind, v)
    k = MINI / FRAME
    for ob in bpy.context.scene.objects:
        if ob.type == "MESH":
            ob.scale = tuple(s * k for s in ob.scale)
            ob.location = ob.location * k
    it = frame_item(f"starmap.mini.{kind}.v{v}", MINI, halo=halo, outline=outline)
    return [it, {**it, "id": f"starmap.mini.{kind}"}] if v == 0 else [it]


def jobs():
    return [lambda kind=kind, v=v: mini_items(kind, v) for mod, count in SOURCES for kind in mod.KINDS for v in range(count(kind))]
