"""Arcade cabinet (family `arcade_cabinet`): `module.arcade`, the approved look study j2 (arcade_study.py: the round drum
with a recessed projector, a brick breaker on a near-upright hologram screen lit from behind by a fan of rays from the
lens) as a 1x1 module, four rotations, front = +v (the player stands on the tile in front).

Sprites per rotation r, ids `module.arcade.r<r>[.state]` (`module.arcade` is the r0 idle copy):
  (idle)       powered, nobody playing: the cabinet lit, the projector's lens on, no hologram
  .unpowered   every light dark
  .active      someone playing: the hologram composited over the cabinet (partial alpha baked in, as the research
  .active.f1.. bench's), FRAMES frames of play at the renderer's ANIM_FPS: the ball rises from the paddle, strikes a
               brick (it flashes white) and falls back, the paddle following it."""
import numpy as np

from . import core, env_build as E, post
from .arcade_study import BALL, FP, j, j2_holo
from .research_bench import over
from .research_kit import holo_item

PAL = "arcade"
PAD = 72                                            # canvas margin for the hologram (it stands well above the cabinet), px
FRAMES = len(BALL)


def sid(rot, tag=""):
    return f"module.arcade.r{rot}{tag}"


def onto(item, full, fp, aid):
    """`item` (straight alpha) put back on `full`'s canvas grid, cropped as a manifest item."""
    cv = np.zeros(full["rgba"].shape, np.uint8)
    gv = np.zeros(full["g"].shape, np.uint8)
    ox, oy = full["ax"], full["ay"]
    h, w = item["rgba"].shape[:2]
    x0, y0 = ox - item["ax"], oy - item["ay"]
    ys, xs = max(0, y0), max(0, x0)
    ye, xe = min(cv.shape[0], y0 + h), min(cv.shape[1], x0 + w)
    cv[ys:ye, xs:xe] = item["rgba"][ys - y0:ye - y0, xs - x0:xe - x0]
    gv[ys:ye, xs:xe] = item["g"][ys - y0:ye - y0, xs - x0:xe - x0]
    al = cv[..., 3]
    return E.crop_item(aid, fp, cv[..., :3], al > 0, gv, ox, oy, al)


def cabinet(rot, off=False):
    """The cabinet rendered, padded for the hologram: a {rgba, g, ax, ay} canvas."""
    core.clear_scene_meshes()
    post.select(PAL)
    c, op, g, ox, oy, _ = E.render_sprite("x", "prop", j(rot, off))
    pad = lambda a: np.pad(a, ((PAD, PAD), (PAD, PAD)) + ((0, 0),) * (a.ndim - 2))   # noqa: E731
    c, op, g = pad(c), pad(op), pad(g)
    return {"rgba": np.dstack([c, (op * 255).astype(np.uint8)]), "g": g, "ax": ox + PAD, "ay": oy + PAD, "fp": FP,
            "id": "x"}


def items(rot):
    out = []
    full = cabinet(rot)
    out.append(onto(full, full, FP, sid(rot)))
    if rot == 0:
        out.append(onto(full, full, FP, "module.arcade"))
    out.append(onto(cabinet(rot, off=True), full, FP, sid(rot, ".unpowered")))
    for f in range(FRAMES):
        core.clear_scene_meshes()
        post.select(PAL)
        holo = holo_item("holo", FP, j(rot), j2_holo(rot, f).build())
        act = over(full, holo) if holo else full
        out.append(onto(act, full, FP, sid(rot, ".active" + (f".f{f}" if f else ""))))
    return [it for it in out if it]


def job(rot):
    def run(rot=rot):
        return items(rot)
    return run


def jobs(rots=range(4)):
    return [job(r) for r in rots]
