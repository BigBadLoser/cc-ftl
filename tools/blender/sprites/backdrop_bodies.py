"""Large backdrop bodies (family `backdrop`, sheet `backdrop`): backdrop.body.<kind>.v<n>, and backdrop.body.<kind> (= v0).

The node's central body drawn big and dim behind the main view. Each sprite is its starmap body (starmap.body.<kind>.v<n>,
same builder, seed and variant, so a node's backdrop matches its starmap icon) built at the starmap size, scaled up
SCALE times and rendered with DETAIL times the sphere and ring faces, so it stays smooth at the larger size:

  frame FRAME px (1x; 640 world px), anchor at the centre, body radius BODY px (200 world px); halos, rings and discs stay
  within 1.6 r. The game dims and tints the sprite itself, so it renders at full value; glow on the usual .glow twin.

  star, red_dwarf, blue_giant, black_hole           v0..v2    (starmap_bodies)
  gas_giant                                         v0..v5    v0..v2 ringed, v3..v5 without a ring
  binary_star, white_dwarf, pulsar, protostar       v0..v2    (starmap_stars; not spawned yet)
  ice_giant, lava_world, ocean_world                v0..v2    (starmap_planets; not spawned yet)

The nebula is left out: the backdrop draws its own."""
import bpy

from . import starmap_bodies, starmap_kit, starmap_planets, starmap_stars
from .starmap_kit import frame_item

FRAME = 320                     # frame side, 1x px (640 world px)
BODY = 100                      # body radius, 1x px (200 world px)
SCALE = BODY / starmap_bodies.BODY
DETAIL = 3                      # sphere / ring face multiplier at this size

SOURCES = {**{k: starmap_bodies for k in ("star", "red_dwarf", "blue_giant", "gas_giant", "black_hole")},
           **{k: starmap_stars for k in starmap_stars.KINDS}, **{k: starmap_planets for k in starmap_planets.KINDS}}


def variants(kind):
    return starmap_bodies.variants(kind) if SOURCES[kind] is starmap_bodies else SOURCES[kind].VARIANTS


def body_items(kind, v):
    """Variant v of a body kind, built by its starmap module at DETAIL and scaled up about the frame centre."""
    starmap_kit.DETAIL = DETAIL
    try:
        halo, outlined = SOURCES[kind].scene(kind, v)
    finally:
        starmap_kit.DETAIL = 1
    for ob in bpy.context.scene.objects:
        if ob.type == "MESH":
            ob.location = ob.location * SCALE
            ob.scale = ob.scale * SCALE
    bpy.context.view_layer.update()
    it = frame_item(f"backdrop.body.{kind}.v{v}", FRAME, halo=halo, outline=outlined)
    return [it, {**it, "id": f"backdrop.body.{kind}"}] if v == 0 else [it]


def jobs():
    return [lambda kind=kind, v=v: body_items(kind, v) for kind in SOURCES for v in range(variants(kind))]
