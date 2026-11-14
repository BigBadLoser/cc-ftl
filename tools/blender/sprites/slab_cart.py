"""The slab on its hover cart (family `stasis`; issue #116), apart from the wheel so the wheel's edits leave its cache alone:
  slab.cart.h<h>[.fN]   a slab on the hover cart turned h * 22.5 degrees (counterclockwise seen from above) from rotation 0,
                        ring loop frame N of HOVER_N (the first unsuffixed); the slab's foot toward the push bar, at the end
                        away from where it is pushed. Anchored on the cart's middle (the image's centre), so it turns in place.
Only the headings in RENDERED are drawn: the game mirrors the others (src/render/stasisArt.ts cartHeading).
CART_ALL=1 renders all 16 at frame 0 (the mirror check, preview only)."""
import math
import os

from . import core, post
from . import env_build as E
from .modkit import K
from .recovery_study import SAMPLES
from .slab_kit import cassette
from .slab_study import HOVER_N, PAL, hover_cart, level

CART_FP = (1, 2)


def named(it, aid, fp):
    it = dict(it)
    it["id"], it["fp"] = aid, fp
    return it


HEADINGS = 16
RENDERED = tuple(range(2, 11))          # h2..h10: the game draws h as h' = (4 - h) % 16 flipped (2 and 10 are their own mirrors)


def cart_items(h, frames):
    from mathutils import Matrix
    out = []
    for n in frames:
        core.clear_scene_meshes()
        post.select(PAL)
        k = K(f"stasis_cart_h{h}", CART_FP, 0)
        s = level()
        hover_cart(k, s, n)
        cassette(k, s)
        objs = k.build()
        for o in objs:                                   # its middle (built half a tile up +y by the footprint offset) to the origin, then turned
            o.data.transform(Matrix.Rotation(h * 2 * math.pi / HEADINGS, 4, "Z") @ Matrix.Translation((0.0, -0.5, 0.0)))
            o.data.update()
        c, op, g, ox, oy, _ = E.render_sprite("x", "prop", objs)
        out.append(named(E.crop_item("x", (2, 2), c, op, g, ox, oy), f"slab.cart.h{h}" + (f".f{n}" if n else ""), (2, 2)))
    return out


def job(h, frames):
    def run(h=h, frames=frames):
        import bpy
        bpy.context.scene.cycles.samples = SAMPLES          # as the study rendered it
        try:
            return cart_items(h, frames)
        finally:
            bpy.context.scene.cycles.samples = core.SAMPLES
    return run


def jobs(rots=None):
    if os.environ.get("CART_ALL"):
        return [job(h, (0,)) for h in range(HEADINGS)]
    return [job(h, tuple(range(HOVER_N))) for h in RENDERED]
