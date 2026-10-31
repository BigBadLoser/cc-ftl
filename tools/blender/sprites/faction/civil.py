"""Civil (set 6): white drawers flush with the wall, only their seams cut in; a colour band under the cap and an upright
foot in it at the ramp's toe; its straight-run designs (shelves, doors)."""

import math

from .. import wall3d as T
from .base import Faction, _style
from .civil_designs import CIVIL_TOPS, MOUTH_T, SEAM, civil_drawers, civil_field, detail_top
from .drone import DRONE_FOOT
from .navy import PlateTones
from .parts import LINE, PAINT, PX, PZ, _slab, body, corner_piece
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
        risers = _risers(a, b, zs, zh) if full and not endf else []     # (a design's seams up through the band:
        cut = [(u - 1.5 * LINE, u + 3.5 * LINE) for u in risers]         # it is cut round each, a px of wall either
        for n, (z0, z1, d, fam, lvl) in enumerate(parts):              # side; the cut runs 2 px further along, as
            for p0, p1, ends in _pieces(a, b, pe, cut if n else []):   # the far piece's front overhangs it 2 px)
                T.run(k, ax, plane, p0, p1, ends, z0, z1, d, fam, lvl, 0)
            if cp:
                corner_piece(k, X, plane, C, _slab(z0, z1, d), fam, lvl)
        if cp:
            _ramp_chamfer(k, X, plane, C, zs, F)
        if endf:
            _end_section(k, ax, plane, a, b, zs, zh, F)
        if not full or endf:
            return
        _top_seam(k, ax, plane, a, b, pe, zs, zh, F, risers, top)
        for s0, s1 in T.spans(a, b):
            if s1 - s0 < 0.45:                          # (a short stretch, by a corner or a junction, stays plain:
                continue                                # its frame came out a cramped strip)
            f0, f1, g0, g1 = civil_field(s0, s1, zs, zh)
            T.fill("field", civil_drawers)(k, ax, plane, f0, f1, g0, g1, F)                 # (its design's)
    return face


CIVIL_OT = 0.015                                        # the ramp panel's top and bottom lines (one px, as its sides)


def _fields(a, b, zs, zh):
    """The face's fields (f0, f1), one a stretch long enough to carry one (civil_field)."""
    return [civil_field(s0, s1, zs, zh)[:2] for s0, s1 in T.spans(a, b) if s1 - s0 >= 0.45]


def _risers(a, b, zs, zh):
    """Where a design runs a seam from the top seam up through the band to the cap ("band_split": (f0, f1) -> [u])."""
    split = T.fill("band_split")
    return [u for f0, f1 in _fields(a, b, zs, zh) for u in split(f0, f1)] if split else []


def _pieces(a, b, pe, gaps):
    """A run along a..b broken at gaps [(u0, u1)]: (p0, p1, ends) each, its own ends where it is broken."""
    out, u = [], a
    for u0, u1 in sorted(gaps):
        out.append((u, u0))
        u = u1
    out.append((u, b))
    return [(p0, p1, (pe[0] if p0 == a else "end", pe[1] if p1 == b else "end")) for p0, p1 in out if p1 - p0 > 1e-6]


def _top_seam(k, ax, plane, a, b, pe, zs, zh, F, risers, top):
    """A seam across the whole face, between the face detail's top and the band (a px under midway). A design may
    open a gap in it over each field ("seam_gap": (f0, f1) -> (u0, u1)): there it turns up to the band at both
    sides; and run seams on up from it through the band to the cap (risers)."""
    _, _, g0, g1 = civil_field(a, b, zs, zh)
    zc, t, L = (detail_top(g0, g1) + zh) / 2 - PZ, MOUTH_T, LINE
    gap = T.fill("seam_gap")
    cuts = [gap(f0, f1) for f0, f1 in _fields(a, b, zs, zh)] if gap else []
    for u0, u1 in cuts:
        for uu in (u0, u1):                             # (up to the band from the gap's sides)
            T.paint(k, ax, plane, uu - L / 2, uu + L / 2, zc - t / 2, zh, 0.0, F, SEAM)
    for u in risers:
        T.paint(k, ax, plane, u - L / 2, u + L / 2, zc - t / 2, top - 0.02, 0.0, F, SEAM)
    for p0, p1, ends in _pieces(a, b, pe, [(u0 + L / 2, u1 - L / 2) for u0, u1 in cuts]):
        T.run(k, ax, plane, p0, p1, ends, zc - t / 2, zc + t / 2, PAINT, F, SEAM, 0)


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
                      outline_t=CIVIL_OT,
                      ramp_solid=True, shell=LookShell,
                      features=(FreeEnds(), RampHoles(), FloorDrop(), FootTone("ochre", 2), FaceHoles(),
                                PlateTones()))
