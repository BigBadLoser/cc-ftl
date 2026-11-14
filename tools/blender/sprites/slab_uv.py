"""The slab face's uv pass, prototype set (family `slabuv`, preview only; issue #481): the sprites the lab panel `slabuv` compares
the colour-keyed press with the uv press on, rendered through the same jobs as the shipped families (slab_cart, slab_game,
slab_floor, slab_loadanim: each already renders its uv pass beside its colour, so these are only a small selection of them):
  slab.cart.h2 / h6   the hover cart at two headings (rotation 0, ring frame 0)
               slot0  one wheel slot layer (rotation 0, the hatch corner), the wheel's own geometry hiding part of the face
  slab.floor.x        a full slab set down on the floor
  stasisload.<name>   the hatch frames of the hand-off (hh0, hh3, hh6: the slab flat) and of the tip and run-in (hc09..hc25)
Nothing here is in the game's build: `npm run sprites -- -- <scratch outdir> slabuv`."""
from . import core, post
from . import slab_cart, slab_floor, slab_game, slab_loadanim as LA
from .recovery_study import SAMPLES

HEADINGS = (2, 6)
PATCHES = ("hh0", "hh3", "hh6", "hc09", "hc12", "hc16", "hc20", "hc25")


def slot_job(rot, i):
    def run(rot=rot, i=i):
        import bpy
        bpy.context.scene.cycles.samples = SAMPLES
        try:
            core.clear_scene_meshes()
            post.select(slab_game.PAL)
            it = slab_game.slot_layer(slab_game.wheel_objs(rot), slab_game.slot_objs(rot, i))
            return [slab_game.named(it, f"{slab_game.A}.slot{i}.r{rot}", slab_game.FP)]
        finally:
            slab_game.W.VIEW[0] = 0
            bpy.context.scene.cycles.samples = core.SAMPLES
    return run


def jobs():
    names = [h[0] for h in LA.HATCH]
    return ([slab_cart.job(h, (0,)) for h in HEADINGS] + [slot_job(0, 0), slab_floor.job("x")]
            + [LA.job("h", names.index(n), 0) for n in PATCHES])
