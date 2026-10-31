"""Civil (set 6): white drawers flush with the wall, only their seams cut in; a colour band under the cap and an upright
foot in it at the ramp's toe; its straight-run designs (shelves, doors)."""
from mathutils import Vector

from .. import wall3d as T
from .base import Faction, _style
from .drone import DRONE_FOOT
from .navy import PlateTones
from .parts import LINE, PAINT, PX, _slab, body, corner_piece, prism
from .shell import FaceHoles, FloorDrop, FootTone, FreeEnds, LookShell, RampHoles, _end_section, _ends, _ramp_chamfer


def rbox(k, ax, plane, u0, u1, z0, z1, fam, lvl):
    """A one-px seam outline round [u0, u1] x [z0, z1] on a face, its corners rounded (a two-px radius: each corner
    a single diagonal step)."""
    L, t = LINE, 0.026                                  # one art px along the face, and up it
    for q in ((u0 + 2 * L, u1 - 2 * L, z0, z0 + t), (u0 + 2 * L, u1 - 2 * L, z1 - t, z1),
              (u0, u0 + L, z0 + 2 * t, z1 - 2 * t), (u1 - L, u1, z0 + 2 * t, z1 - 2 * t),
              (u0 + L, u0 + 2 * L, z0 + t, z0 + 2 * t), (u1 - 2 * L, u1 - L, z0 + t, z0 + 2 * t),
              (u0 + L, u0 + 2 * L, z1 - 2 * t, z1 - t), (u1 - 2 * L, u1 - L, z1 - 2 * t, z1 - t)):
        T.paint(k, ax, plane, q[0], q[1], q[2], q[3], 0.0, fam, lvl)


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
            f0, f1, g0, g1 = civil_field(s0, s1, zs, zh)                                     # the drawers centred
                                                                                                # between the foot strip
            n = 2                                                                               # and the band, each
            h, gap = (g1 - g0) / n, 0.035                                                       # its own outline with
            uc = (f0 + f1) / 2                                                                  # rounded corners
            if T.VARIANT[0]:
                civil_top(k, ax, plane, f0, f1, g0, g1, F, T.VARIANT[0])
                continue                                    # (a variant's own top)
            for i in range(n):
                z0, z1 = g0 + i * h + (gap / 2 if i else 0.0), g0 + (i + 1) * h - (gap / 2 if i < n - 1 else 0.0)
                rbox(k, ax, plane, f0, f1, z0, z1, F, 2)
                T.paint(k, ax, plane, uc - 0.08, uc + 0.08, z1 - 0.15, z1 - 0.09, 0.0, F, 2)     # a handle recess in the
                T.paint(k, ax, plane, uc - 0.08, uc + 0.08, z1 - 0.115, z1 - 0.09, PAINT, F, 1)  # seams' tone, its lip
    return face


CIVIL_PAIRS = [(1, 0), (2, 0), (3, 0)]                 # set 6: three more tops, the one ramp


CIVIL_D = 3 / 32                                        # how deep a shelf is let into the wall


def civil_field(s0, s1, zs, zh):
    """A civil stretch's field (f0, f1, g0, g1): its drawers' place, between the foot strip and the colour band."""
    return s0 + 0.07, s1 - 0.07, zs + 0.13, zh - 0.08


def _shelf_h(g0, g1):
    return 0.42 * (g1 - g0) - 0.08


def _shelves(f0, f1, g0, g1, t):
    """The open shelves of top design t in a field, (u0, u1, z0, z1) each, their sides on the face's cell edges (the
    shell opens whole cells), a cell in from the field's: seen from the right a shelf's far side shows its depth
    past its mouth, and so stays inside the tile."""
    h, gap = _shelf_h(g0, g1), 0.1                      # (design 2's one shelf; design 1 two of it, a thick board
    if t == 1:                                          # between, centred)
        z0 = (g0 + g1 - 2 * h - gap) / 2
        zz = [(z0 - 0.06, z0 + h - 0.06), (z0 + h + gap, z0 + 2 * h + gap)]          # (the lower one let down)
    elif t == 2:
        zz = [(g0, g0 + h)]
    else:
        return []
    c = 1 / T.W.GN
    return [(T.snap(f0) + c, T.snap(f1) - c, z0, z1) for z0, z1 in zz]


def civil_holes(a, b, zs, top, t):
    """Where a civil face is open for top design t's shelves (FaceHoles), as civil lays them out."""
    if top <= T.W.skirt_top() + T.W.CUT + 0.05:
        return []
    return [h for s0, s1 in T.spans(a, b) if s1 - s0 >= 0.45
            for h in _shelves(*civil_field(s0, s1, zs, top - 0.13 * (top - zs)), t)]


def _cavity(k, ax, plane, u0, u1, z0, z1, D, F):
    """The inside of an opening in the face, D deep: its back, ceiling, floor and sides."""
    o, al, up = T.OUT(ax), T.P(ax, 0, 1, 0, 0) - T.P(ax, 0, 0, 0, 0), Vector((0, 0, 1))
    Q = lambda u, z, d: T.P(ax, plane, u, z, d)        # noqa: E731
    k.poly([Q(u0, z0, -D), Q(u1, z0, -D), Q(u1, z1, -D), Q(u0, z1, -D)], F, 0, o)               # back
    k.poly([Q(u0, z1, 0), Q(u1, z1, 0), Q(u1, z1, -D), Q(u0, z1, -D)], F, 0, -up)               # ceiling
    k.poly([Q(u0, z0, 0), Q(u1, z0, 0), Q(u1, z0, -D), Q(u0, z0, -D)], F, 1, up)                # floor
    for u, sg in ((u0, 1), (u1, -1)):                                                            # sides
        k.poly([Q(u, z0, 0), Q(u, z1, 0), Q(u, z1, -D), Q(u, z0, -D)], F, 1, al * sg)


def _shelf(k, ax, plane, u0, u1, z0, z1, F):
    """An open shelf let into the face (its opening, civil_holes), a seam round its mouth."""
    _cavity(k, ax, plane, u0, u1, z0, z1, CIVIL_D, F)
    t = 0.026                                                                                    # its mouth's seam
    for q in ((u0 - LINE, u1 + LINE, z1, z1 + t), (u0 - LINE, u1 + LINE, z0 - t, z0), (u0 - LINE, u0, z0, z1),
              (u1, u1 + LINE, z0, z1)):
        T.paint(k, ax, plane, *q, 0.0, F, 2)


def _doors(k, ax, plane, u0, u1, z0, z1, F, hz):
    """Two doors side by side, each a seam outline (rounded corners), a short handle recess by the middle at hz."""
    uc = (u0 + u1) / 2
    for a, b, hu in ((u0, uc - 0.01, uc - 0.1), (uc + 0.01, u1, uc + 0.1)):
        rbox(k, ax, plane, a, b, z0, z1, F, 2)
        T.paint(k, ax, plane, hu - 0.035, hu + 0.035, hz, hz + 0.026, 0.0, F, 2)


def civil_top(k, ax, plane, f0, f1, g0, g1, F, t):
    """A civil field (f0..f1 x g0..g1, between the foot strip and the colour band) for top design t (set 6): 1 two
    open shelves; 2 two small doors over an open shelf; 3 tall double doors with a table dropped down in front of
    them."""
    for h in _shelves(f0, f1, g0, g1, t):
        _shelf(k, ax, plane, *h, F)
    if t == 2:
        zm = g0 + _shelf_h(g0, g1) + 0.06                                                           # over its shelf
        _doors(k, ax, plane, f0, f1, zm, g1, F, zm + 0.07)
    elif t == 3:
        _doors(k, ax, plane, f0, f1, g0 + 0.06, g1, F, g0 + 0.2)
        z, d = g0 + 0.03, 0.16                                                                      # the table,
        T.slab(k, ax, plane, f0 - 0.02, f1 + 0.02, z, z + 0.05, d, F, 3, ends=(True, True))
        for u in (f0 + 0.04, f1 - 0.04 - 2 * LINE):                                                 # its two stays
            prism(k, ax, plane, u, u + 2 * LINE, [(0.0, z - 0.12), (0.0, z), (d - 0.03, z)], F, 1)


class Civil(Faction):
    def __init__(self, v):
        self.pre = f"fC{v}"
        super().__init__()

    def relief(self, sprite):
        return _style(civil, skirt="outline", toe="ochre", seam=0, toe_at=0.66, foot=DRONE_FOOT,
                      face_holes=civil_holes, outline_lvl=1, outline_round=True, ramp_solid=True,
                      shell=LookShell,
                      features=(FreeEnds(), RampHoles(), FloorDrop(), FootTone("ochre", 2), FaceHoles(),
                                PlateTones()))

    pairs = CIVIL_PAIRS
