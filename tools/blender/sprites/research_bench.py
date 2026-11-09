"""Research bench (family `research_bench`): `module.research`, the approved look study c1 (research_r9.py, built on
research_r6..r8; the kit is research_kit.py) as a 3x2 module, four rotations (modkit.K, front = +v; the chair is the
middle front tile). Sprites per rotation r (`.rN` from r1; r0 has no suffix): the bench idle, and `.active` (someone
works it): the same bench with its translucent hologram composited over it. Partial alpha survives the pipeline
(hydroponics glass already uses it), so the hologram is baked into `.active` rather than drawn as an overlay.
`.damaged`, `.damaged.flicker` and `.destroyed` come from damage.py (bases) off the idle build."""
import numpy as np

from . import core, post
from . import env_build as E
from .research_kit import FP, holo_item
from .research_r9 import BUILD

PAL = "research"
BENCH, HOLO = BUILD["c1"]


def footprint(rot):
    return FP if rot % 2 == 0 else (FP[1], FP[0])


def sprite_id(rot, active=False):
    return "module.research" + ("" if rot == 0 else f".r{rot}") + (".active" if active else "")


def build(rot=0):
    """The idle bench's objects."""
    return BENCH("on", rot)


def over(base, top):
    """Item `top` (straight alpha) alpha-composited over item `base`, anchors aligned; the blended px are snapped back
    to the palette and the glow layers are merged (per channel max)."""
    x0 = -max(base["ax"], top["ax"])
    y0 = -max(base["ay"], top["ay"])
    x1 = max(base["rgba"].shape[1] - base["ax"], top["rgba"].shape[1] - top["ax"])
    y1 = max(base["rgba"].shape[0] - base["ay"], top["rgba"].shape[0] - top["ay"])
    W, H = x1 - x0, y1 - y0

    def put(it, key, ch):
        out = np.zeros((H, W, ch), np.uint8)
        h, w = it[key].shape[:2]
        ox, oy = -it["ax"] - x0, -it["ay"] - y0
        out[oy:oy + h, ox:ox + w] = it[key]
        return out

    a, b = put(base, "rgba", 4).astype(np.float32), put(top, "rgba", 4).astype(np.float32)
    ab, bb = a[..., 3:] / 255, b[..., 3:] / 255
    oa = bb + ab * (1 - bb)
    rgb = np.where(oa > 0, (b[..., :3] * bb + a[..., :3] * ab * (1 - bb)) / np.maximum(oa, 1e-6), 0)
    mixed = (bb[..., 0] > 0) & (ab[..., 0] > 0)                    # a hologram px over a bench px: a new colour
    if mixed.any():
        rgb[mixed] = post.PALETTE[post.quantize(rgb[mixed])]
    rgba = np.concatenate([rgb, oa * 255], -1).round().astype(np.uint8)
    g = np.maximum(put(base, "g", 4), put(top, "g", 4))
    return {"id": top["id"], "fp": base["fp"], "rgba": rgba, "g": g, "ax": -x0, "ay": -y0}


def job(rot):
    """The idle and the `.active` sprite of one rotation."""
    def run(rot=rot):
        core.clear_scene_meshes()
        post.select(PAL)
        sid = sprite_id(rot)
        fp = footprint(rot)
        idle = E.crop_item(sid, fp, *E.render_sprite(sid, "prop", build(rot)))
        core.clear_scene_meshes()
        holo = holo_item(sid + ".holo", fp, build(rot), HOLO(rot).build())
        act = over(idle, holo) if holo else dict(idle)
        act["id"] = sprite_id(rot, True)
        return [idle, act]
    return run


def jobs(rots=range(4)):
    return [job(r) for r in rots]
