"""Civil's straight-run designs (set 6): each fills a field (f0..f1 x g0..g1, between the foot strip and the colour
band; the face's "field" slot: k, ax, plane, f0, f1, g0, g1, F), the base with two drawers; one that opens shelves in
the face says where ("face_holes", relief_style.Style.fill)."""
from mathutils import Vector

from .. import wall3d as T
from ..relief_style import Design
from .parts import LINE, PAINT, PZ, prism

CIVIL_D = 3 / 32                                        # how deep a shelf is let into the wall


SEAM = 1                                                # the seams' level on the face (outlines, shelf mouths,
                                                        # handle recesses; a handle's lip a step under)


def civil_field(s0, s1, zs, zh):
    """A civil stretch's field (f0, f1, g0, g1): its drawers' place, between the foot strip and the colour band."""
    return s0 + 0.07, s1 - 0.07, zs + 0.13, zh - 0.08


def rbox(k, ax, plane, u0, u1, z0, z1, fam, lvl):
    """A one-px seam outline round [u0, u1] x [z0, z1] on a face, its corners rounded (a two-px radius: each corner
    a single diagonal step)."""
    L, t = LINE, 0.026                                  # one art px along the face, and up it
    for q in ((u0 + 2 * L, u1 - 2 * L, z0, z0 + t), (u0 + 2 * L, u1 - 2 * L, z1 - t, z1),
              (u0, u0 + L, z0 + 2 * t, z1 - 2 * t), (u1 - L, u1, z0 + 2 * t, z1 - 2 * t),
              (u0 + L, u0 + 2 * L, z0 + t, z0 + 2 * t), (u1 - 2 * L, u1 - L, z0 + t, z0 + 2 * t),
              (u0 + L, u0 + 2 * L, z1 - 2 * t, z1 - t), (u1 - 2 * L, u1 - L, z1 - 2 * t, z1 - t)):
        T.paint(k, ax, plane, q[0], q[1], q[2], q[3], 0.0, fam, lvl)


def civil_drawers(k, ax, plane, f0, f1, g0, g1, F):
    """The base: two drawers in one outline with rounded corners (a seam across its middle parts them), from 2 px
    under the field's foot up to the face detail's top (detail_top), a handle recess under each drawer's top."""
    z0, z1 = g0 - 2 * PZ, detail_top(g0, g1)
    zm, t = (z0 + z1) / 2, 0.026                        # (the parting seam: one art px tall)
    uc = (f0 + f1) / 2
    rbox(k, ax, plane, f0, f1, z0, z1, F, SEAM)
    T.paint(k, ax, plane, f0 + LINE, f1 - LINE, zm - t / 2, zm + t / 2, 0.0, F, SEAM)
    for top in (z1, zm - t / 2):
        T.paint(k, ax, plane, uc - 0.08, uc + 0.08, top - 0.15, top - 0.09, 0.0, F, SEAM)       # a handle recess in
        T.paint(k, ax, plane, uc - 0.08, uc + 0.08, top - 0.115, top - 0.09, PAINT, F, SEAM - 1)  # the seams' tone,
                                                                                                    # its lip


def _shelf_h(g0, g1):
    return 0.42 * (g1 - g0) - 0.08


def two_shelves(g0, g1):
    """Two shelves (z0, z1), a thick board between, centred; the lower one let down, the upper a px."""
    h, gap = _shelf_h(g0, g1), 0.1
    z0 = (g0 + g1 - 2 * h - gap) / 2
    return [(z0 - 0.06, z0 + h - 0.06), (z0 + h + gap - PZ, z0 + 2 * h + gap - PZ)]   # (the upper one 1 px down)


def one_shelf(g0, g1):
    """One shelf (z0, z1) at the field's foot."""
    return [(g0, g0 + _shelf_h(g0, g1))]


MOUTH_T = 0.026                                         # the seam round a shelf's mouth: one art px tall
SHELF_TRIM = 2 * PZ                                     # a shelf's mouth this much shorter (its top let down)
SHELF_DROP = 2 * PZ                                     # ... and the whole of it this much lower, toward the ramp


def _mouth(z0, z1):
    """A shelf's mouth (z0, z1) as a layout gives it, trimmed and dropped (SHELF_TRIM, SHELF_DROP)."""
    return z0 - SHELF_DROP, z1 - SHELF_DROP - SHELF_TRIM


def detail_top(g0, g1):
    """Where every design's face detail tops out in a field: the top of the upper of two shelves (civil_open), its
    mouth's seam included."""
    return _mouth(*two_shelves(g0, g1)[-1])[1] + MOUTH_T


def _shelves(f0, f1, g0, g1, layout):
    """A layout's open shelves in a field, (u0, u1, z0, z1) each, their sides on the face's cell edges (the shell
    opens whole cells), a cell in from the field's: seen from the right a shelf's far side shows its depth past its
    mouth, and so stays inside the tile."""
    c = 1 / T.W.GN
    return [(T.snap(f0) + c, T.snap(f1) - c) + _mouth(z0, z1) for z0, z1 in layout(g0, g1)]


def shelf_holes(layout):
    """Where a civil face is open for a layout's shelves (the "face_holes" slot), as the face lays out its fields."""
    def holes(a, b, zs, top):
        if top <= T.W.skirt_top() + T.W.CUT + 0.05:
            return []
        return [h for s0, s1 in T.spans(a, b) if s1 - s0 >= 0.45
                for h in _shelves(*civil_field(s0, s1, zs, top - 0.13 * (top - zs)), layout)]
    return holes


def _cavity(k, ax, plane, u0, u1, z0, z1, D, F):
    """The inside of an opening in the face, D deep: its back, ceiling, floor and sides. Its floor lit as a ledge; its
    back a shade darker, its sides two darker again, whichever way they face (the face's own ramp: K, D)."""
    o, al, up = T.OUT(ax), T.P(ax, 0, 1, 0, 0) - T.P(ax, 0, 0, 0, 0), Vector((0, 0, 1))
    Q = lambda u, z, d: T.P(ax, plane, u, z, d)        # noqa: E731
    dark, back = T.RAMPS[F][0][0], T.RAMPS[F][0][1]
    k.poly([Q(u0, z0, -D), Q(u1, z0, -D), Q(u1, z1, -D), Q(u0, z1, -D)], F, 0, o, fixed=back)   # back
    k.poly([Q(u0, z1, 0), Q(u1, z1, 0), Q(u1, z1, -D), Q(u0, z1, -D)], F, 0, -up)               # ceiling
    k.poly([Q(u0, z0, 0), Q(u1, z0, 0), Q(u1, z0, -D), Q(u0, z0, -D)], F, 1, up)                # floor
    for u, sg in ((u0, 1), (u1, -1)):                                                            # sides
        k.poly([Q(u, z0, 0), Q(u, z1, 0), Q(u, z1, -D), Q(u, z0, -D)], F, 1, al * sg, fixed=dark)


def _shelf(k, ax, plane, u0, u1, z0, z1, F):
    """An open shelf let into the face (its opening, shelf_holes), a seam round its mouth with rounded corners (its
    corner steps cover the opening's corner pixels)."""
    _cavity(k, ax, plane, u0, u1, z0, z1, CIVIL_D, F)
    rbox(k, ax, plane, u0 - LINE, u1 + LINE, z0 - MOUTH_T, z1 + MOUTH_T, F, SEAM)


def _door_spans(u0, u1):
    """Two doors side by side over u0..u1: (a, b) each."""
    uc = (u0 + u1) / 2
    return (u0, uc - 0.01), (uc + 0.01, u1)


def cupboard_seam_gap(f0, f1):
    """Where the cupboard opens the face's top seam (the "seam_gap" slot: it turns up to the band at both sides): from
    2 px in from the left door's middle to 2 px in from the right door's."""
    (a0, b0), (a1, b1) = _door_spans(f0, f1)
    return (a0 + b0) / 2 + 2 * LINE, (a1 + b1) / 2 - 2 * LINE


def shelves_band_split(f0, f1):
    """The open shelves' seam up from the top seam through the band, at the field's middle (the "band_split" slot),
    on one px column (the middle is a px edge: centred on it, the seam came out two px wide)."""
    return [round((f0 + f1) / 2 / LINE) * LINE + LINE / 2]


def _doors(k, ax, plane, u0, u1, z0, z1, F, hz):
    """Two doors side by side, each a seam outline (rounded corners), a short handle recess by the middle at hz."""
    uc = (u0 + u1) / 2
    for (a, b), hu in zip(_door_spans(u0, u1), (uc - 0.1, uc + 0.1)):
        rbox(k, ax, plane, a, b, z0, z1, F, SEAM)
        T.paint(k, ax, plane, hu - 0.035, hu + 0.035, hz, hz + 0.026, 0.0, F, SEAM)


def civil_open(k, ax, plane, f0, f1, g0, g1, F):
    """Two open shelves."""
    for h in _shelves(f0, f1, g0, g1, two_shelves):
        _shelf(k, ax, plane, *h, F)


def civil_cupboard(k, ax, plane, f0, f1, g0, g1, F):
    """Two small doors over an open shelf, up to the face detail's top."""
    shelves = _shelves(f0, f1, g0, g1, one_shelf)
    for h in shelves:
        _shelf(k, ax, plane, *h, F)
    zm = shelves[-1][3] + 0.06                                                                      # over its shelf
    _doors(k, ax, plane, f0, f1, zm, detail_top(g0, g1), F, zm + 0.07)


def civil_table(k, ax, plane, f0, f1, g0, g1, F):
    """Tall double doors (up to the face detail's top) with a table dropped down in front of them."""
    _doors(k, ax, plane, f0, f1, g0 + 0.06, detail_top(g0, g1), F, g0 + 0.2)
    z, d = g0 + 0.03, 0.16                                                                          # the table,
    T.slab(k, ax, plane, f0 - 0.02, f1 + 0.02, z, z + 0.05, d, F, 3, ends=(True, True))
    for u in (f0 + 0.04, f1 - 0.04 - 2 * LINE):                                                     # its two stays
        prism(k, ax, plane, u, u + 2 * LINE, [(0.0, z - 0.12), (0.0, z), (d - 0.03, z)], F, 1)


CIVIL_TOPS = (Design("drawers", field=civil_drawers),
              Design("open shelves", field=civil_open, face_holes=shelf_holes(two_shelves),
                     band_split=shelves_band_split),
              Design("cupboard", field=civil_cupboard, face_holes=shelf_holes(one_shelf),
                     seam_gap=cupboard_seam_gap),
              Design("table", field=civil_table))
