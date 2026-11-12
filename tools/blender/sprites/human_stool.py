"""The game-table stool as a sit-clip holdout (clip `sit_stool_work`; docs/ARCHITECTURE.md, seats).

The console clips (`sit_idle`, `sit_work`) cut the sitter wherever the console swivel chair's backrest, seat cushion and
armrests are nearer the camera (human_render.chair_holdout), and the cut pixels stay hidden at run time. A stool has no
armrests, a thinner back and a different seat, so seating a crew member on one with the console cut leaves holes in the
lap. `sit_stool_work` is the sit_work pose rendered against the stool itself: the module's own seat shape, chosen per module by
`ModuleDef.seat` (src/sim/registry.ts). Add another seat kind the same way: a holdout builder here, a `Pose(chair=<kind>)`
row in crew_clips, a clip row in crew_spec.CLIPS."""
from . import gametable_kit as GK
from .modkit import K

_STOOL = []


def stool_holdout():
    """The stool (gametable_kit.stool: disc foot, post, chrome-rimmed seat, back on the side away from the table) at the
    sprite origin, the sitter facing the azimuth-0 way (grid +y, K rot 2, face -v), as a hidden Cycles holdout turned
    with the character like the console chair."""
    if not _STOOL:
        k = K("sit_stool_holdout", (1, 1), 2)
        GK.stool(k, 0.0, 0.0, -1)
        ob = k.build()[0]
        ob.is_holdout, ob.hide_render = True, True
        _STOOL.append(ob)
    return _STOOL[0]
