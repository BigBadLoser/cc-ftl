"""Civil (set 6): white drawers flush with the wall, only their seams cut in; a colour band under the cap and an upright
foot in it at the ramp's toe; its straight-run designs (shelves, doors)."""

import math

from .. import wall3d as T
from .base import Faction, _style
from .civil_designs import CIVIL_TOPS, SEAM, civil_drawers, civil_field
from .drone import DRONE_FOOT
from .navy import PlateTones
from .parts import PAINT, PX, _slab, body, corner_piece
from .shell import FaceHoles, FloorDrop, FootTone, FreeEnds, LookShell, RampHoles, _end_section, _ends, _ramp_chamfer


def civil(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        X, C = b, (T.style().chamfer or 0.0)  # (the wall ends as navy's; its corner chamfered only if the
        endf, end1, corner, back = _ends(ax, plane, b, ends)    # look says so)
        if corner and C:
            b -= C
        cp = corner and ax == "y" and C > 0
        pe = ("in" if back else ends[0], ends[1])
        zh = top - 0.13 * (top - zs) if full else top
        parts = [(zs - 0.03, zs + 0.05, PAINT, F, 4)]
        if full:
            parts += [(zh, top - 0.02, PX, "ochre", 2),                                         # the colour band ...
                      (top - 0.045, top - 0.02, PX + PAINT, "ochre", 3),                        # ... lit on top,
                      (zh, zh + 0.025, PX + PAINT, "ochre", 1)]                                 # ... dark below
        for z0, z1, d, fam, lvl in parts:
            T.run(k, ax, plane, a, b, pe, z0, z1, d, fam, lvl, 0)
            if cp:
                corner_piece(k, X, plane, C, _slab(z0, z1, d), fam, lvl)
        if cp:
            _ramp_chamfer(k, X, plane, C, zs, F)
        if endf:
            _end_section(k, ax, plane, a, b, zs, zh, F)
        if not full or endf:
            return
        for s0, s1 in T.spans(a, b):
            if s1 - s0 < 0.45:                          # (a short stretch, by a corner or a junction, stays plain:
                continue                                # its frame came out a cramped strip)
            f0, f1, g0, g1 = civil_field(s0, s1, zs, zh)
            T.fill("field", civil_drawers)(k, ax, plane, f0, f1, g0, g1, F)                 # (its design's)
    return face


def civil_panel(h=0.47):
    """The ramp's outlined panel (its top and bottom down the run, as fractions of it), h of the run tall, centred on
    the light slope: from the wall down to the foot's lit edge (0.03 above the toe; the shell's run, on its grid)."""
    run = math.ceil(T.W.skirt_run() * T.W.GN - 1e-6) / T.W.GN
    light = 1.0 - 0.03 / run
    return ((light - h) / 2, (light + h) / 2)


class Civil(Faction):
    def __init__(self, v):
        self.pre = f"fC{v}"
        super().__init__()

    def relief(self, sprite):
        return _style(civil, skirt="outline", toe="ochre", seam=0, toe_at=0.66, foot=DRONE_FOOT,
                      tops=CIVIL_TOPS, outline_lvl=SEAM - 1, outline_round=True, outline_d=civil_panel(),
                      ramp_solid=True, shell=LookShell,
                      features=(FreeEnds(), RampHoles(), FloorDrop(), FootTone("ochre", 2), FaceHoles(),
                                PlateTones()))
