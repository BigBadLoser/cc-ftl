"""The hull from outside (roofed ships: enemy ships are seen so): tile.hull.ext.o{o}.m{mask}[.v1], o the side(s)
facing space as the near-hull ghosts' (1: +y, 2: +x, 3: both, the outer corner). The hull block runs right out to the
tile's space-facing edges (a cell short: its outer face is the ship's outline) and has no skirt: there is no room on
that side. Its outer faces carry armour instead of the interior's dressing (ext_face). A faction look dresses them
through its STYLE "ext" face; ext_face is the default's."""
import math

from . import wall3d as T

PX, PAINT, LINE = T.PX, T.PAINT, T.LINE
E = 0.5 - 1 / 32                    # the ship's outline (a cell short of the tile's edge)
D = E                               # the armour's depth: the block's face stands this far in from the outline (at
                                    # the tile's middle: its top is the cap, half a tile deep, as hull 46's)


EXT_PAIRS = [(1, 0), (2, 0), (3, 0)]    # straight runs' variants .a1 ..: (top design, bottom design)


def ext_shell(o):
    class ExtShell(T.Shell):
        no_skirt = True
        cap_fam = "steel"
        cap_band = 0.0                                  # (no cut band: the cap's plates run to its outer edge)

        def __init__(self, *args, **kw):
            super().__init__(*args, **kw)
            out = []
            f = E - D - (SLOT if T.VARIANT[0] == 1 else 0.0)  # (T3-1: the slot's depth further in; ext_face
            for (x0, x1, y0, y1), fam, t, top in self.rects:    # builds the cap's front back out round it)
                if fam == "hull":                       # (a cell short of the edge: a face on the tile's
                    x1 = f if o & 2 else x1             # own edge is the next tile's, so it is not built;
                    y1 = f if o & 1 else y1             # D in again: the armour's profile fills it)
                out.append(((x0, x1, y0, y1), fam, t, top))
            self.rects = out
            self.keep = None

        def skip_skirt(self, i, j):
            return True

        def skirtz(self, x, y):                         # (its faces run down to the floor)
            return 0.0

        def col_top(self, i, j, kind, x, y):
            return T.RAMPS["steel"][0][0]

        def col_face(self, face, x, y, z):
            return T.RAMPS["steel"][1 if face == "x" else 0][1]
    return ExtShell


F = "steel"
SLOT = 7 / 32                       # T3-1: the slot cut into the cap's front edge (45 degrees, this deep), and how
SLOT_IN = 7 / 32                    # far in from each side it starts
LEAN = [(0.0, 0.8), (0.094, 0.65), (0.219, 0.452), (0.344, 0.252), (0.439, 0.09), (D, 0.0)]
# hull 46 T3's front above its upright part, measured off its end: (how far back from the outline, how far down from
# the top); it leans back from the outline 0.8 down to the cap's front edge, half a tile in


def _lean(H, z0=0.0):
    """The leaning front as (d, z) points (d out from the block's face), from height z0 up."""
    pts = [(D - b, H - dz) for b, dz in LEAN]
    out = []
    for (d0, za), (d1, zb) in zip(pts, pts[1:]):
        if zb <= z0:
            continue
        if za < z0:
            d0, za = d0 + (d1 - d0) * (z0 - za) / (zb - za), z0
        out.append((d0, za))
    return out + [pts[-1]]


def _arc(H, r, n=4):
    """A front rolled back onto the cap through a quarter circle of radius r."""
    q = [math.pi / 2 * i / n for i in range(n + 1)]
    return [(D - r + r * math.cos(t), H - r + r * math.sin(t)) for t in q]


def ext_face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
    """The default look's outer face (after Space Haven's hull 46, D3), a grey blockout of each top design's shape
    for now; the base is T3, and the others add or take away parts of it: 0 upright from the outline, then leaning
    back to the cap (T3); 1 cut away to the block's face, down to a floor sloping up to it from the outline, the lean
    left as a frame on the left, two struts from the floor by the back wall half way up it, a slot cut into the
    cap's front at 45 degrees (T3-1); 2 the lean a few
    px in from each side, T3-3's box between (T3-2); 3 a box out to the outline, its top edge
    slightly rounded (T3-3)."""
    from .factions_relief import prism
    t = T.VARIANT[0]
    mt = tuple(1.0 if e == "out" else 0.0 for e in ends)
    H = top
    base = [(0.0, 0.0), (D, 0.0)] + _lean(H) + [(0.0, H)]
    def box(q, r=0.14):                                 # T3-3's box: the base filled out upright, its edge
        return [(0.0, 0.0), (D, 0.0)] + [(d, z - q) for d, z in _arc(H, r, 6)] + \
            (_lean(H, H - q) if q else []) + [(0.0, H)]  # rounded (q: its top that far under the cap's)
    if t == 3:
        prism(k, ax, plane, a, b, box(1 / 32), F, 3, mitre=mt)
    elif t == 2:                                        # the base's lean a few px in from each side, T3-3's box
        e = 6 / 32                                      # between
        for s0, s1 in T.spans(a, b):
            first, last = abs(s0 - a) < 1e-6, abs(s1 - b) < 1e-6
            prism(k, ax, plane, s0, s0 + e, base, F, 3, mitre=(mt[0] if first else 0.0, 0.0))
            prism(k, ax, plane, s0 + e, s1 - e, box(0.0), F, 3)                                   # (flush)
            prism(k, ax, plane, s1 - e, s1, base, F, 3, mitre=(0.0, mt[1] if last else 0.0))
    elif t == 1:                                        # (measured off hull 46 T3-1)
        hc = H + T.LIP                                  # the cap's front, built back out round the slot (its top
        for s0, s1 in T.spans(a, b):                    # level with the cap's plates, in their tone)
            for u0, u1 in ((s0, s0 + SLOT_IN), (s1 - SLOT_IN, s1)):
                prism(k, ax, plane, u0, u1, [(0.0, 0.0), (SLOT, 0.0), (SLOT, hc), (0.0, hc)], F, 2)
            prism(k, ax, plane, s0 + SLOT_IN, s1 - SLOT_IN, [(0.0, 0.0), (SLOT, 0.0), (SLOT, hc - SLOT), (0.0, hc)],
                  F, 2)
        plane += SLOT
        zf, zb = 0.38, 0.57                             # the cut's floor: at the outline, at the block's face; its
        prism(k, ax, plane, a, b, [(0.0, 0.0), (D, 0.0), (D, zf), (0.0, zb)], F, 3, mitre=mt)    # back wall the
        for s0, s1 in T.spans(a, b):                                                                 # block's face
            prism(k, ax, plane, s0, s0 + 0.08, [(0.0, zb), (D, zf)] + _lean(H) + [(0.0, H)], F, 3)  # a frame, left
            zm = (zb + H) / 2                                                                       # struts from the
            for u in (s0 + 0.24, s1 - 0.29):                                                        # floor by the back
                prism(k, ax, plane, u, u + 0.05, [(0.14, zb - 0.06), (0.2, zb - 0.08), (0.06, zm),      # wall, half way
                                                  (0.0, zm)], F, 4)                                  # up it
    else:
        prism(k, ax, plane, a, b, base, F, 3, mitre=mt)


def ext_block(mask, o, variant=0):
    st = T.STYLE or {}
    return T.block(mask, "hull", variant, level="up", shell=ext_shell(o), dress=st.get("ext", ext_face))
