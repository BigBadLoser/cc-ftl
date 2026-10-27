"""The exterior hull's T3-2 top design (after hull 46's variant 02): the base's lean strips either side of an upright
box a px proud, its top edge rounded onto the top; doors across its middle, seams, a railed recess up over its top, a
vent, marks on the strips. Built through the face builder (wall3d_ext_geom); T3-3 shares its rounded edge (arc)."""
import math

from . import core
from . import wall3d as T
from .wall3d_ext_geom import LINE, PAINT, YS, D

SIDE = 6 / 32                       # the base's lean this far in from each tile edge, the box between
ROUND = 0.14                        # T3-3's box's top edge rounded this much (T3-2's a px less)
T2_OUT = 1                          # the box this many px proud of the base (front, rounded edge and top)
T2_DOORS = (2, 2, 22, 42, 2)        # two doors in the box: px in from its sides, px apart, their top and foot px under
                                    # its front's top, px deep
T2_DOOR_SHADE = (5, "hsD", "hsXD")  # a shadow this many px down the doors from their top (the cutout's edge
                                    # hides the first), in this tone (the cutouts' left walls too); a px of this one
                                    # along the cutout's top on the front
T2_SIDE = "hsD"                     # the box's outer side's tone
T2_HANDLE = (1, 5, 6)               # a handle on each: px wide, tall, over the door's foot (painted)
T2_SEAMS = (17, 46, 2)              # px under the box's front's top: where the recess starts (its lip's top edge lit,
                                    # a seam on down its middle); a seam across it and on across the strips, this many
                                    # px lower on them
T2_FOOT = (2, 3, 1)                 # the box's foot this many px under the floor, a flange round it this many px wider
                                    # either side up to this many over the vent's top (an upside down T)
T2_RAILS = (2, 2, 1)                # the box's sides left as rails this many px wide, all between them recessed from
                                    # the upper seam up (this many px on the front, rounding over to this many on the
                                    # top, back to the face); their outer edges lit along the top in this tone
T2_RAIL_EDGE = YS[5]
T2_TOP = (6, 4, "hsXS")             # the box's top plate ends this many px behind the lean's top (its back edge a px
                                    # of this tone); a seam (the same) right across
                                    # the top this many px in from its back edge (where T3-1's runs)
T2_SEAM_COLS = (YS[1], YS[4])       # the seams' dark core, the lit px under it
T2_VENT = (3, 10, 3, 3)             # a vent near the box's foot: slots, px long, the lowest px over the foot, px apart
T2_LEAN = (4, 7, (5, 7), (5, 3, 12))  # the right lean strip's marks, px: a seam across it under its top; this far under
                                    # that an open box from its outer edge, this many in and down; a plate a px proud
                                    # this far over its foot (the bend), against the box, this wide and tall


def arc(H, r, n=6, d=D):
    """A front at d rolled back onto the top (H) through a quarter circle of radius r."""
    q = [math.pi / 2 * i / n for i in range(n + 1)]
    return [(d - r + r * math.cos(t), H - r + r * math.sin(t)) for t in q]


def build(f, s, a, b, H, tone):
    """T3-2 over [a, b] of the face f (section s; tone: a section's tones, its flat tops the top's)."""
    base = [(0.0, 0.0), (D, 0.0)] + s.lean() + [(0.0, H)]
    for s0, s1 in T.spans(a, b):
        f.part(s0, s0 + SIDE, base, tone(base))
        f.part(s1 - SIDE, s1, base, tone(base))
        _box(f, s0 + SIDE, s1 - SIDE, H, tone)
        _strips(f, s, s0, s1, H)
        dt = -0.5 - f.plane + T2_TOP[1] * LINE                          # (the tile's back edge at -0.5)
        f.top_line(s0, s1, dt, dt + LINE, T2_TOP[2])


def _box(f, u0, u1, H, tone):
    """The upright box over [u0, u1], T2_OUT px proud (its front, its rounded top edge and its top back to the tile's
    back edge): two doors a px deep across its middle (T2_DOORS) with a handle each, seams across it (T2_SEAMS, a dark
    px over a lit one), a recess between rails (T2_RAILS) from the upper seam up and over its top, a seam down its
    middle there, a vent near its foot."""
    m, gap, top, foot, sunk_in = T2_DOORS
    out, e = T2_OUT * LINE, T2_OUT / core.ZPX
    Df, Ht = D + out, H + e                                             # (its front, its top)
    r = ROUND - LINE
    rw, deep, top_deep = T2_RAILS
    rim = arc(H + e, r, d=Df)                                           # (its rounded edge; the recess's about the
    cd, cz, rx, rz = Df - r, Ht - r, r - deep * LINE, r - top_deep / core.ZPX   # same centre, from deep on the
    sunk = [(cd + rx * math.cos(t), cz + rz * math.sin(t)) for t in (math.pi / 2 * i / 6 for i in range(7))]

    zt, db = rim[0][1], -T2_TOP[0] * LINE                               # (its front's top; its top's back edge)

    def at(n):                                                          # (n px under its front's top)
        return zt - n / core.ZPX
    zh, zf, zs = at(top), at(foot), at(T2_SEAMS[0])
    front = tone([(0.0, 0.0), (Df, 0.0), (Df, zf), (0.0, zf)])[1]      # (its front the upright's tone throughout:

    def part(v0, v1, pf, side=None):                                    # a part's by its height would take the
        cols = tone(pf)                                                 # lean's over the bend)
        cols[1] = front
        f.part(v0, v1, pf, cols, (None, T2_SIDE if v1 > u1 - 1e-6 else side), end=False)
    rail, dr = rw * LINE, sunk[0][0]                                    # front to top_deep on the top)
    sink, wide, over = T2_FOOT
    n, ln, up, pitch = T2_VENT
    z0, z1 = -sink / core.ZPX, (up + pitch * (n - 1) + 1 + over) / core.ZPX                  # its foot's flange (from
    part(u0 - wide * LINE, u1 + wide * LINE, [(0.0, z0), (Df, z0), (Df, z1), (0.0, z1)])    # under the floor),
    part(u0, u1, [(0.0, z1), (Df, z1), (Df, zf), (0.0, zf)])                            # on up to the doors,
    part(u0, u1, [(0.0, zh), (Df, zh), (Df, zs), (0.0, zs)])                            # over them to the seam,
    for v0, v1 in ((u0, u0 + rail), (u1 - rail, u1)):                                   # the rails on up (the
        part(v0, v1, [(0.0, zs), (Df, zs)] + rim + [(0.0, Ht)], T2_DOOR_SHADE[1])       # recess's wall in the
                                                                                        # doors' shadow's tone),
    zr = sunk[0][1]
    part(u0 + rail, u1 - rail, [(0.0, zs), (dr, zs), (dr, zr), (0.0, zr)])              # the recess between,
    part(u0 + rail, u1 - rail, [(0.0, zr)] + sunk + [(0.0, sunk[-1][1])])              # rounding on to the top,
    part(u0, u1, [(db, H), (0.0, H), (0.0, Ht), (db, Ht)])                              # its top on back
    w = (u1 - u0 - (2 * m + gap) * LINE) / 2
    doors = [(u0 + m * LINE, u0 + m * LINE + w), (u1 - m * LINE - w, u1 - m * LINE)]
    full = [(u0, doors[0][0]), (doors[0][1], doors[1][0]), (doors[1][1], u1)]
    for (v0, v1), dd in [(v, Df) for v in full] + [(v, Df - sunk_in * LINE) for v in doors]:
        part(v0, v1, [(0.0, zf), (dd, zf), (dd, zh), (0.0, zh)], T2_DOOR_SHADE[1])     # (the doors' left walls
                                                                                        # in the shadow's tone)

    def paint(v0, v1, z0, z1, col, d=Df):                               # (a painted band on a front)
        f.part(v0, v1, [(d, z0), (d + PAINT, z0), (d + PAINT, z1), (d, z1)], [col] * 4, col, end=False)
    dark, lit = T2_SEAM_COLS
    for v0, v1, d0, d1, col in ((u0, u0 + LINE, db + LINE, rim[-1][0], T2_RAIL_EDGE),     # (the rails' outer
                                (u1 - LINE, u1, db + LINE, rim[-1][0], T2_RAIL_EDGE),     # edges lit along the top,
                                (u0, u1, db, db + LINE, T2_TOP[2])):                      # its back edge dark)
        f.part(v0, v1, [(d0, Ht), (d1, Ht), (d1, Ht + PAINT), (d0, Ht + PAINT)], [col] * 4, col, end=False)
    hw, ht, hup = T2_HANDLE
    for v0, v1 in doors:                                                # (their handles, at their middles; a
        paint(v0, v1, zh - T2_DOOR_SHADE[0] / core.ZPX, zh, T2_DOOR_SHADE[1], Df - sunk_in * LINE)  # shadow
        paint(v0, v1, zh, zh + 1 / core.ZPX, T2_DOOR_SHADE[2])                                                # under
        c = (v0 + v1) / 2                                                                             # their top)
        paint(c - hw * LINE / 2, c + hw * LINE / 2, zf + hup / core.ZPX, zf + (hup + ht) / core.ZPX, dark,
              Df - sunk_in * LINE)
    n = T2_SEAMS[1]                                                     # (the lower seam across: a dark px, a lit
    paint(u0, u1, at(n + 1), at(n), dark)                               # one under; the lip under the recess lit
    paint(u0, u1, at(n + 2), at(n + 1), lit)                            # along its top between the rails)
    paint(u0 + rail, u1 - rail, at(T2_SEAMS[0] + 1), zs, lit)
    c = (u0 + u1) / 2                                                   # (down the recess's middle, over its
    paint(c - LINE / 2, c + LINE / 2, zs, zr, dark, dr)                 # rounded edge and on to its end on the top)
    for (d0, z0), (d1, z1) in zip(sunk, sunk[1:]):
        nd, nz = z1 - z0, d0 - d1
        k = PAINT / max(1e-9, (nd * nd + nz * nz) ** 0.5)
        f.part(c - LINE / 2, c + LINE / 2, [(d0, z0), (d1, z1), (d1 + nd * k, z1 + nz * k), (d0 + nd * k, z0 + nz * k)],
               [dark] * 4, dark, end=False)
    d0, d1, z = 0.0, sunk[-1][0], sunk[-1][1]
    f.part(c - LINE / 2, c + LINE / 2, [(d0, z), (d1, z), (d1, z + PAINT), (d0, z + PAINT)], [dark] * 4, dark,
           end=False)
    n, ln, up, pitch = T2_VENT                                          # (a vent: slots near its foot)
    for i in range(n):
        z = (up + pitch * i) / core.ZPX
        paint(c - ln * LINE / 2, c + ln * LINE / 2, z, z + 1 / core.ZPX, dark)


def _strips(f, s, s0, s1, H):
    """The lean strips' marks: the box's lower seam on across them; on the right one a seam across it, an open box from
    its outer edge and a plate low on it against the box (T2_LEAN); on the left one a notch level with the upper seam
    (painted, as the run's lines)."""
    dark, lit = T2_SEAM_COLS
    zt = H + T2_OUT / core.ZPX - ROUND
    z = zt - (T2_SEAMS[1] + T2_SEAMS[2]) / core.ZPX                     # (the lower seam, on the upright part)
    for v0, v1 in ((s0, s0 + SIDE), (s1 - SIDE, s1)):
        d = s.front(z - 2 / core.ZPX, z)[0][0]
        for z0, z1, col in ((z - 1 / core.ZPX, z, dark), (z - 2 / core.ZPX, z - 1 / core.ZPX, lit)):
            f.part(v0, v1, [(d, z0), (d + PAINT, z0), (d + PAINT, z1), (d, z1)], [col] * 4, col, end=False)
    seam, gap, (bx, by), (up, pw, ph) = T2_LEAN
    z = s.z_at(H, seam)
    f.line(s1 - SIDE, s1, s.z_at(z, 1), z, dark, end=False)
    zt0 = s.z_at(z, gap)                                                # (the box: its top, its foot, its inner side)
    zb0 = s.z_at(zt0, by)
    f.line(s1 - bx * LINE, s1, s.z_at(zt0, 1), zt0, dark, end=False, bevel=False)
    f.line(s1 - bx * LINE, s1, zb0, s.z_at(zb0, -1), dark, end=False, bevel=False)
    f.line(s1 - bx * LINE, s1 - (bx - 1) * LINE, zb0, zt0, dark, end=False, bevel=False)
    v0, z0 = s1 - SIDE, s.z_at(s.zb, -up)                               # (the plate, shaded as the run's strip
    z1 = s.z_at(z0, -ph)                                                # plates)
    f.shade(v0, v0 + pw * LINE, z0, z1, YS[2], side=1.3)
    f.raised(v0, v0 + pw * LINE, z0, z1, -0.01, LINE, cap=YS[3])
    z = zt - T2_SEAMS[0] / core.ZPX
    f.line(s0 + 2 * LINE, s0 + SIDE, z - 1 / core.ZPX, z, dark, end=False, bevel=False)
