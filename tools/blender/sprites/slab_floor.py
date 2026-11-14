"""Stasis slabs off the wheel and the cart (family `stasis`; issue #116), in their own module so the wheel's and the cart's
render cache keys stay put:
  item.stasis_slab.l      an empty slab as a floor stack (stack size 1): face up across its tile on its end caps, along
                          the tile's left-right diagonal (1.6 long: a whole tile's width and a little over, as the cart's is)
  slab.floor.x / .y       a full slab set down on two floor tiles (a carry cut short) along x or y, its head (the status
                          strip's end) on the first tile, the foot on the next one up the axis, as the sim lays it
                          (stasis/place.ts floorTiles); the anchor is the front-most tile's centre like any module's
The same slab as the wheel's and the cart's (slab_study.cassette)."""
import math

from . import core, post
from . import env_build as E
from .modkit import K
from .recovery_study import SAMPLES
from .slab_study import PAL, L, T, Slab, cassette

REST = T + 0.04          # the end caps' underside below the face: lying face up, the slab rests on them
C = math.sqrt(0.5)


def named(it, aid, fp):
    it = dict(it)
    it["id"], it["fp"] = aid, fp
    return it


def render(k, aid, fp):
    c, op, g, ox, oy, _ = E.render_sprite("x", "prop", k.build())
    return named(E.crop_item("x", fp, c, op, g, ox, oy), aid, fp)


def item_items():
    core.clear_scene_meshes()
    post.select(PAL)
    k = K("stasis_item", (1, 1), 0)
    cassette(k, Slab((-C * L / 2, C * L / 2, REST), (C, -C, 0.0), (0.0, 0.0, 1.0)))
    return [render(k, "item.stasis_slab.l", (1, 1))]


def floor_items(axis):
    """Footprint (1, 2) turned so that the slab's head (local +v) points down the axis: rotation 1 puts +v at -x, 2 at -y."""
    core.clear_scene_meshes()
    post.select(PAL)
    k = K(f"stasis_floor_{axis}", (1, 2), 1 if axis == "x" else 2)
    cassette(k, Slab((0.0, -L / 2, REST), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)))
    return [render(k, f"slab.floor.{axis}", (1, 2))]


def job(part):
    """One job per sprite, told apart by its default (the render cache keys a callable by its code and defaults)."""
    def run(part=part):
        import bpy
        bpy.context.scene.cycles.samples = SAMPLES          # as the wheel and the cart (slab_game.job)
        try:
            return item_items() if part == "item" else floor_items(part)
        finally:
            bpy.context.scene.cycles.samples = core.SAMPLES
    return run


def jobs():
    return [job("item"), job("x"), job("y")]
