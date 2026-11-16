"""The hull window's end pieces' frame details (wall3d_ext_window: W1, and W3 mirrored through its _Mirror), after the
reference's ends (the user's picks): the jamb's front recessed inside a 1 px border, and a dark strip down the outer
frame's side (facing the glass) with a column of small studs standing in it. Coordinates as the window module's: u
along the face (W1's), d out from the block's face, z up."""
from . import core
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import YS

INSET_BORDER = 1        # px: the jamb's front's border round its recessed panel (both sides and its top)
INSET_FOOT = 1          # px: the panel's foot over the jamb's seam
INSET_TONE = YS[3]      # the panel, REC back (a step under the jamb's front)
INSET_STEP = YS[5]      # the recess's lit lower edge
INSET_WALL = "hsXL"     # its side wall facing the glass (the frame's sides' tone)
STRIP_D = (1, 5)        # px out from the jamb's front: the outer frame's side's dark strip (the side narrows up
                        # the lean: 10 px deep at the sill, 3 at the header's foot)
STRIP_Z = (1, 2)        # px: from this far over the jamb's seam to this far under the header's foot, or lower: to
STRIP_MARGIN = 1        # where the side's front is still this many px past the strip
STRIP_TONE = "hsXS"
STUD = 2                # px: a stud, square (out and up), centred across the strip
STUD_GAP = 3            # px between studs (the column centred up the strip)
STUD_OUT = 1            # px proud of the side
STUD_FACE, STUD_FRONT, STUD_TOP = "hsXL", YS[3], YS[5]


def jamb(fm, u0, u1, db, dv, zl, zh, front, side):
    """The jamb over [u0, u1] (W1's u), its front at dv (in `front`), from the floor up to the header's foot zh, its
    end facing the glass in `side`; zl: its seam's foot. Its front recessed REC inside INSET_BORDER, from INSET_FOOT
    over the seam."""
    px, pz, R = T3.px(1), 1 / core.ZPX, T3.REC
    p0, p1 = zl + (1 + INSET_FOOT) * pz, zh - INSET_BORDER * pz
    a, b = u0 + INSET_BORDER * px, u1 - INSET_BORDER * px

    def full(z0, z1, top=None):
        return [(db, z0), (dv, z0), (dv, z1), (db, z1)], [None, front, top, None]
    pf, c = full(0.0, zh)
    fm.part(u0, a, pf, c, (None, INSET_WALL), end=False)               # the border's sides (the recess's wall)
    fm.part(b, u1, pf, c, (False, side), end=False)
    pf, c = full(0.0, p0, INSET_STEP)                                   # under the panel (its lit step)
    fm.part(a, b, pf, c, False, end=False)
    fm.part(a, b, [(db, p0), (dv - R, p0), (dv - R, p1), (db, p1)], [None, INSET_TONE, None, None], False,
            end=False)                                                  # the panel
    pf, c = full(p1, zh)                                                # over it
    fm.part(a, b, pf, c, False, end=False)


def studs(fm, s, u, dv, zl, zh):
    """The outer frame's side at u (facing the glass; s: the section): a dark strip down it, studs standing in it."""
    px, pz = T3.px(1), 1 / core.ZPX
    d0, d1 = dv + STRIP_D[0] * px, dv + STRIP_D[1] * px
    z0, z1 = zl + STRIP_Z[0] * pz, zh - STRIP_Z[1] * pz
    while z1 > s.zb and s.front(z1, z1)[0][0] < d1 + STRIP_MARGIN * px - 1e-6:
        z1 -= pz
    fm.part(u, u + 0.001, [(d0, z0), (d1, z0), (d1, z1), (d0, z1)], [False] * 4, (False, STRIP_TONE), end=False)
    h = round((z1 - z0) * core.ZPX)
    n = (h - STUD_GAP) // (STUD + STUD_GAP)
    za = z0 + (h - n * STUD - (n - 1) * STUD_GAP) // 2 * pz
    dm = (d0 + d1) / 2
    a, b = dm - STUD / 2 * px, dm + STUD / 2 * px
    for i in range(n):
        z = za + i * (STUD + STUD_GAP) * pz
        fm.part(u, u + STUD_OUT * px, [(a, z), (b, z), (b, z + STUD * pz), (a, z + STUD * pz)],
                [False, STUD_FRONT, STUD_TOP, False], (False, STUD_FACE), end=False)
