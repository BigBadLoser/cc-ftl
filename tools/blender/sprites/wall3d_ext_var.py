"""The exterior hull's other top designs (after hull 46 T3-1, T3-2, T3-3): grey blockouts of their shapes, each the
base section (wall3d_ext_geom) with parts added or taken away, built through the same face builder."""
import math

from . import wall3d as T
from .wall3d_ext_geom import D, TOP, Face, Section

SLOT = 7 / 32                       # T3-1: the slot cut into the top's front edge (45 degrees, this deep), from
SLOT_IN = 7 / 32                    # this far in from each tile edge
FLOOR = (0.38, 0.57)                # T3-1: its cut's floor height at the outline, at the block's face
STRUTS = [(0.24, 0.05), (-0.29, 0.05)]  # T3-1: struts from the floor by the back wall, half way up (from each
FRAME = 0.08                        # tile edge: start, width); the lean left as a frame this wide on the left
SIDE = 6 / 32                       # T3-2: the base's lean this far in from each tile edge, T3-3's box between
ROUND, DROP = 0.14, 1 / 32          # T3-3: its box's top edge rounded this much, its top this far under the top's


def _arc(H, r, n=6):
    """A front rolled back onto the top through a quarter circle of radius r."""
    q = [math.pi / 2 * i / n for i in range(n + 1)]
    return [(D - r + r * math.cos(t), H - r + r * math.sin(t)) for t in q]


def build(k, ax, plane, a, b, ends, H, t):
    s = Section(H)

    def tone(prof, role="face"):                        # (its flat tops in the top's tone)
        cols = s.cols(prof, role)
        return [TOP if abs(p[1] - q[1]) < 1e-9 and p[1] > 1.0 else c for p, q, c in zip(prof, prof[1:] + prof[:1],
                                                                                       cols)]
    f = Face(k, ax, plane, a, b, ends, s)
    base = [(0.0, 0.0), (D, 0.0)] + s.lean() + [(0.0, H)]

    def box(q):                                         # T3-3's box: the base filled out upright, its edge rounded
        return [(0.0, 0.0), (D, 0.0)] + [(d, z - q) for d, z in _arc(H, ROUND)] + \
            (s.lean(H - q) if q else []) + [(0.0, H)]   # (q: its top that far under the top's)
    if t == 3:
        f.part(a, b, box(DROP), tone(box(DROP)))
    elif t == 2:
        for s0, s1 in T.spans(a, b):
            f.part(s0, s0 + SIDE, base, tone(base))
            f.part(s0 + SIDE, s1 - SIDE, box(0.0), tone(box(0.0)))                         # (flush)
            f.part(s1 - SIDE, s1, base, tone(base))
    elif t == 1:
        for s0, s1 in T.spans(a, b):                    # the top's front, built back out round the slot
            for u0, u1 in ((s0, s0 + SLOT_IN), (s1 - SLOT_IN, s1)):
                pf = [(0.0, 0.0), (SLOT, 0.0), (SLOT, H), (0.0, H)]
                f.part(u0, u1, pf, tone(pf))
            pf = [(0.0, 0.0), (SLOT, 0.0), (SLOT, H - SLOT), (0.0, H)]
            f.part(s0 + SLOT_IN, s1 - SLOT_IN, pf, tone(pf))
        f = Face(k, ax, plane + SLOT, a, b, ends, s)    # (the cut's back wall the block's face)
        zf, zw = FLOOR
        pf = [(0.0, 0.0), (D, 0.0), (D, zf), (0.0, zw)]
        f.part(a, b, pf, tone(pf))
        zm = (zw + H) / 2
        for s0, s1 in T.spans(a, b):
            pf = [(0.0, zw), (D, zf)] + s.lean() + [(0.0, H)]
            f.part(s0, s0 + FRAME, pf, tone(pf))
            for u, w in STRUTS:
                u = s0 + u if u >= 0 else s1 + u
                pf = [(0.14, zw - 0.06), (0.2, zw - 0.08), (0.06, zm), (0.0, zm)]
                f.part(u, u + w, pf, tone(pf, "plate"))
