"""Civil's straight-run designs (set 6): each fills a field (f0..f1 x g0..g1, between the foot strip and the colour
band; the face's "field" slot: k, ax, plane, f0, f1, g0, g1, F), the base with two drawers; one that opens shelves in
the face says where ("face_holes", relief_style.Style.fill)."""
from mathutils import Vector

from .. import wall3d as T
from ..relief_style import Design
from .parts import LINE, PAINT, prism

CIVIL_D = 3 / 32                                        # how deep a shelf is let into the wall


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
    """The base: two drawers, centred between the foot strip and the band, each its own outline with rounded corners,
    a handle recess under its top."""
    n = 2
    h, gap = (g1 - g0) / n, 0.035
    uc = (f0 + f1) / 2
    for i in range(n):
        z0, z1 = g0 + i * h + (gap / 2 if i else 0.0), g0 + (i + 1) * h - (gap / 2 if i < n - 1 else 0.0)
        rbox(k, ax, plane, f0, f1, z0, z1, F, 2)
        T.paint(k, ax, plane, uc - 0.08, uc + 0.08, z1 - 0.15, z1 - 0.09, 0.0, F, 2)     # a handle recess in the
        T.paint(k, ax, plane, uc - 0.08, uc + 0.08, z1 - 0.115, z1 - 0.09, PAINT, F, 1)  # seams' tone, its lip


def _shelf_h(g0, g1):
    return 0.42 * (g1 - g0) - 0.08


def two_shelves(g0, g1):
    """Two shelves (z0, z1), a thick board between, centred; the lower one let down."""
    h, gap = _shelf_h(g0, g1), 0.1
    z0 = (g0 + g1 - 2 * h - gap) / 2
    return [(z0 - 0.06, z0 + h - 0.06), (z0 + h + gap, z0 + 2 * h + gap)]


def one_shelf(g0, g1):
    """One shelf (z0, z1) at the field's foot."""
    return [(g0, g0 + _shelf_h(g0, g1))]


def _shelves(f0, f1, g0, g1, layout):
    """A layout's open shelves in a field, (u0, u1, z0, z1) each, their sides on the face's cell edges (the shell
    opens whole cells), a cell in from the field's: seen from the right a shelf's far side shows its depth past its
    mouth, and so stays inside the tile."""
    c = 1 / T.W.GN
    return [(T.snap(f0) + c, T.snap(f1) - c, z0, z1) for z0, z1 in layout(g0, g1)]


def shelf_holes(layout):
    """Where a civil face is open for a layout's shelves (the "face_holes" slot), as the face lays out its fields."""
    def holes(a, b, zs, top):
        if top <= T.W.skirt_top() + T.W.CUT + 0.05:
            return []
        return [h for s0, s1 in T.spans(a, b) if s1 - s0 >= 0.45
                for h in _shelves(*civil_field(s0, s1, zs, top - 0.13 * (top - zs)), layout)]
    return holes


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


def _shelf(k, ax, plane, u0, u1, z0, z1, F):
    """An open shelf let into the face (its opening, shelf_holes), a seam round its mouth."""
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


def civil_open(k, ax, plane, f0, f1, g0, g1, F):
    """Two open shelves."""
    for h in _shelves(f0, f1, g0, g1, two_shelves):
        _shelf(k, ax, plane, *h, F)


def civil_cupboard(k, ax, plane, f0, f1, g0, g1, F):
    """Two small doors over an open shelf."""
    for h in _shelves(f0, f1, g0, g1, one_shelf):
        _shelf(k, ax, plane, *h, F)
    zm = g0 + _shelf_h(g0, g1) + 0.06                                                               # over its shelf
    _doors(k, ax, plane, f0, f1, zm, g1, F, zm + 0.07)


def civil_table(k, ax, plane, f0, f1, g0, g1, F):
    """Tall double doors with a table dropped down in front of them."""
    _doors(k, ax, plane, f0, f1, g0 + 0.06, g1, F, g0 + 0.2)
    z, d = g0 + 0.03, 0.16                                                                          # the table,
    T.slab(k, ax, plane, f0 - 0.02, f1 + 0.02, z, z + 0.05, d, F, 3, ends=(True, True))
    for u in (f0 + 0.04, f1 - 0.04 - 2 * LINE):                                                     # its two stays
        prism(k, ax, plane, u, u + 2 * LINE, [(0.0, z - 0.12), (0.0, z), (d - 0.03, z)], F, 1)


CIVIL_TOPS = (Design("drawers", field=civil_drawers),
              Design("open shelves", field=civil_open, face_holes=shelf_holes(two_shelves)),
              Design("cupboard", field=civil_cupboard, face_holes=shelf_holes(one_shelf)),
              Design("table", field=civil_table))
