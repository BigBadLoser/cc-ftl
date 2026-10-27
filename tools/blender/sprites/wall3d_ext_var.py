"""The exterior hull's other top designs (after hull 46 T3-1, T3-2, T3-3): grey blockouts of their shapes, each the
base section (wall3d_ext_geom) with parts added or taken away, built through the same face builder."""
import math

from mathutils import Euler, Vector

from . import core
from . import wall3d as T
from . import wall3d_ext_t32 as T32
from . import wall3d_ext_t33 as T33
from .wall3d_ext_geom import LINE, PAINT, SHADE, YS, D, TOP, Face, Section

SLOT = 7 / 32                       # T3-1: the slot cut into the top's front edge (this deep: its back wall), from
SLOT_IN = 7 / 32                    # this far in from each tile edge; the top's front edge over it chamfered 45
SLOT_CH = 4.6 / 32                  # degrees, this far
SHADOW = "steel"                    # T3-1's recess: its shadow and side walls (a step over the darkest steel)
BAY_SIDE = "hsXS"                   # T3-1's bay's side wall (the frame's end), a step under its back wall
EDGE = 1                            # T3-1: the slot's sides' top front edges lit this many px wide
OCTAGON = (2, 4, 4)                 # T3-1: an octagon recessed round the chamfer (its sides the chamfer's ends):
                                    # its sides run on this many px back over the top, down the front, then
                                    # close in on the diagonal this many px (on top: within OCT_D + SLOT - SLOT_CH)
OCT_D = 6 / 32                      # the block's face this much further in, to make room for it on the top
OCT_INNER = (2, 3, 1)               # a panel recessed further inside it, centred on the chamfer: reaching this many px
                                    # past it onto the top and down the front, this many px in from the octagon's
                                    # sides, its corners cut this many px
OCT_DEEP = (1, 2)                   # the octagon's depth, px, and the panel's under it
OCT_LIT = ("hsL", "hsH")            # their walls the camera sees: on the front (the feet), on top
OCT_CHAMFER = "hsXL"                # the chamfer outside the panel
OCT_PANEL = "hsH"                   # the panel's floor, all over (front, chamfer, top)
OCT_SUN = (0.8, 0.3, 0.4)           # T3-1's shadows' sun (towards it): along the face, out of it, up; what they
SHADE_RAMP = ("hsXK", "hsK", "hsXD", "hsD", "hsXM", "hsXS", "hsM", "hsXL", "hsS", "hsL", "hsH", "hsW")   # fall on
SHADE_STEPS = 2                     # this many steps down the hull's tones (dark to light), in bands this many px
SHADE_BAND = 1                      # wide along what casts them
FLOOR = (0.38, 0.57)                # T3-1: its cut's floor height at the outline, at the block's face
STRUTS = [(0.13, 0.05), (-0.10, 0.05)]  # T3-1: struts (rams) from the floor's front half up to the back wall,
STRUT_D = (0.26 - 2 / 32, 0.32 - 2 / 32)  # STRUT_DROP px under half way up (from each tile edge: start, width; out
STRUT_DROP = 2                      # from the wall at their feet)
STRUT_SEAM = (2, YS[1])             # a seam a px across each one this many px under its top (by its mount)
STRUT_FOOT = (1, 1, 2)              # a mounting foot round each one's foot: px out either side, along the floor, tall
STRUT_MOUNT = (2, 8, 0.42, 10, 70, 2)  # a cylinder in the back wall at each one's top, rising towards the middle from
                                    # it: px radius, px long, the share of it sunk, sides, degrees up (in px); cut in
                                    # two across its middle, this many px apart; on the right one (the camera's
STRUT_MOUNT_RIGHT = (YS[5], YS[1])  # side) its halves' upper long edges by the wall lit, the wall under its top half
                                    # shaded
FRAME = 0.08                        # the lean left as a frame this wide on the left
FLOOR_PANEL = (4, 0, 9)             # T3-1: an outline on the floor, px in from the bay's sides, out from the back
                                    # wall; on over its front edge and this many px down its front
FLOOR_KEYS = (5, 5, 2)              # T3-1: two keys over the floor outline's closing line on the front, centred on
                                    # the tile: px wide, px apart; px over and under the line (as the run's clamps)
FLOOR_INNER = (2, 2, 3)             # a panel inside it on the floor: px in from its sides, under its top, short of
                                    # the floor's front edge
RECESS = (0, 17, 3, 2)              # T3-1: a recess in the back wall over the floor: px in from the wall's sides,
                                    # tall, deep; its top a shallow arch, this many px higher in the middle,
ARCH = (1, 5)                       # a seam this many px over it, the recess shaded down to this many px under
                                    # its sides' tops
ARCH_PLATE = ((4, 3), 5, 2)         # T3-1: a plate a px proud, this many px in from the arch's (left, right) sides,
                                    # its top straight this many px under the octagon's foot, its foot this many over
                                    # the arch's seam;
                                    # a px groove cut across its middle and up from there to its top
ARCH_PLATE_EDGE = ("hsS", "hsXM")   # its pieces' top edges' paint, its ends the camera sees (the right)
TOP_SEAM = (4, 2, "hsXS")           # T3-1: a seam right across the top, this many px in from its back edge, stepping
                                    # back round the octagon to stay this many px clear of it
BAY_LINES = (8, 5, 5, 7, 6, 5)      # T3-1: panel lines on the bay's side (px, heights over all): a box from the lean
                                    # this many back, from this many under where the lean begins to this many over
                                    # it; this many over that another this tall, back over the corner this many onto
                                    # the back wall
BAY_LINE = YS[1]                    # their tone (as the floor outline's on its front)


def build(k, ax, plane, a, b, ends, H, t):
    s = Section(H)

    def tone(prof, role="face"):                        # (its flat tops in the top's tone)
        cols = s.cols(prof, role)
        return [TOP if abs(p[1] - q[1]) < 1e-9 and p[1] > 1.0 else c for p, q, c in zip(prof, prof[1:] + prof[:1],
                                                                                       cols)]
    f = Face(k, ax, plane, a, b, ends, s)
    if t == 3:
        T33.build(f, s, a, b, H, tone)
    elif t in (1, 2):                                   # (their recesses read by their shadows: the sun in the
        su, so, sz = OCT_SUN                            # face's terms)
        core.SHADOWS.update(on=True, L=tuple(core.G(*T.P(ax, 0.0, su, sz, so))), ramp=SHADE_RAMP, steps=SHADE_STEPS,
                            band=SHADE_BAND)
    if t == 2:
        T32.build(f, s, a, b, H, tone)
    elif t == 1:
        S = SLOT + OCT_D
        for s0, s1 in T.spans(a, b):                    # the top's front, built back out round the slot
            zs = H - SLOT_CH - (sum(OCTAGON[1:]) + 2) / core.ZPX               # (under the octagon: the recess's)
            zc = H - SLOT_CH
            c = tone([(0.0, 0.0), (S, 0.0), (S, H), (0.0, H)])[1]  # (its ends on the tile's edges in its front's
            lit, lit_top = OCT_LIT                                      # tone, its front's throughout; its end by
            for z0, z1, near in ((0.0, zs, SHADOW), (zs, zc, lit), (zc, H, lit_top)):   # the recesses their near
                pf = [(0.0, z0), (S, z0), (S, z1), (0.0, z1)]           # side: the arch's in shadow, the octagon's
                cols = tone(pf)                                         # lit, as its walls)
                cols[1] = c
                f.part(s0, s0 + SLOT_IN, pf, cols, (c, near))
                f.part(s1 - SLOT_IN, s1, pf, cols, (None, c))
            _top_seam(f, s0, s1, s0 + SLOT_IN, s1 - SLOT_IN, H, S)
            pf = [(S - EDGE * LINE, H), (S, H), (S, H + PAINT), (S - EDGE * LINE, H + PAINT)]   # (their top's front
            for u0, u1 in ((s0, s0 + SLOT_IN), (s1 - SLOT_IN, s1)):                          # edges lit)
                f.part(u0, u1, pf, [lit_top] * 4, lit_top)
            _back_wall(f, s0 + SLOT_IN, s1 - SLOT_IN, H, S, tone)
        f = Face(k, ax, plane + S, a, b, ends, s)       # (the cut's back wall the block's face)
        zf, zw = FLOOR
        pf = [(0.0, 0.0), (D, 0.0), (D, zf), (0.0, zw)]
        cols = tone(pf)
        cols[2] = YS[5]                                 # (its floor the lean's near white, as the base's)
        f.part(a, b, pf, cols)
        zm = (zw + H) / 2 - STRUT_DROP / core.ZPX
        for s0, s1 in T.spans(a, b):
            pf = [(0.0, zw), (D, zf)] + s.lean() + [(0.0, H)]
            f.part(s0, s0 + FRAME, pf, tone(pf), (None, BAY_SIDE))
            for u, w in STRUTS:
                u = s0 + u if u >= 0 else s1 + u
                (d0, d1), fz = STRUT_D, lambda d: zw - (zw - zf) * d / D        # (its foot on the floor)
                pf = [(d0, fz(d0)), (d1, fz(d1)), (0.06, zm), (0.0, zm)]
                f.k.no_shadow = True                                    # (casting no shadow)
                f.part(u, u + w, pf, tone(pf, "plate"))
                f.k.no_shadow = False
                _strut_seam(f, u, w, pf)
                _mount(f, u + w / 2, zm, 1 if u < (s0 + s1) / 2 else -1)
                side, along, tall = STRUT_FOOT                          # (its foot's mount, on the floor)
                da, db, h = d0 - along * LINE, d1 + along * LINE, tall / core.ZPX
                pf = [(da, fz(da)), (db, fz(db)), (db, fz(db) + h), (da, fz(da) + h)]
                f.part(u - side * LINE, u + w + side * LINE, pf, tone(pf, "plate"), end=False)
            _floor_panel(f, s0 + FRAME, s1, zw, zf, (s0 + s1) / 2)
            _bay_lines(f, s, s0 + FRAME, H)


def _back_wall(f, u0, u1, H, S, tone):
    """T3-1's back wall over [u0, u1] (the top's front between the slot's sides, S out from the block's face,
    chamfered under the top): in px-wide slices up to just under the octagon, the RECESS over the floor with its
    arch (each slice's profile a stack of convex parts); over them the OCTAGON (_octagon)."""
    _, tall, deep, arch = RECESS
    _, down, diag = OCTAGON
    zw, r, zc = FLOOR[1], deep * LINE, H - SLOT_CH
    zb = zc - (down + diag + 1) / core.ZPX                              # (a px under the octagon's foot)
    wall = tone([(0.0, 0.0), (S, 0.0), (S, zc), (0.0, zc)])[1]         # (the wall's front in its own tone
    n = max(1, round((u1 - u0) / LINE))                                 # throughout: a slice's tone by its
    vs = [u0 + (u1 - u0) * i / n for i in range(n + 1)]                 # height would take the lean's over it)
    dark = tone([(0.0, 0.0), (S, 0.0), (S, zw), (0.0, zw)], "dark")[1]
    gap, shade = ARCH
    zs = zw + (tall - shade) / core.ZPX                                 # (the arch's shadow's foot)
    assert zw + (tall + arch + gap + 1) / core.ZPX < zb, "T3-1: the arch runs into the octagon"
    (pl, pr), pclear, pover = ARCH_PLATE
    pa, pb, pm = u0 + pl * LINE, u1 - pr * LINE, (u0 + u1) / 2        # (the plate's sides, its middle, its top,
    zp = zb - (pclear - 1) / core.ZPX                                   # the groove's middle and half width)
    zg, g = (zp + zw + (tall + arch + gap + pover) / core.ZPX) / 2, 0.5 / core.ZPX

    pcols = tone([(S, 0.0), (S + LINE, 0.0), (S + LINE, zw), (S, zw)], "plate")   # (its tones the upright's
    pcols[1] = wall                                                                 # plate's, its front the wall's

    lit, end = ARCH_PLATE_EDGE

    def plate(v0, v1, z0, z1, under=1):                                 # throughout, as the wall's; its top edge
        cap = (pcols[1], end if v1 >= pb - 1e-9 else pcols[1])  # lit, a painted px, its seen end on the
        f.part(v0, v1, [(S, z0), (S + LINE, z0), (S + LINE, z1), (S, z1)], pcols, cap, end=False)   # right darker;
        e = S + LINE + PAINT                                            # painted shade a px beside its
        f.part(v0, v1, [(e, z1 - 2 * g), (e + PAINT, z1 - 2 * g), (e + PAINT, z1), (e, z1)], [lit] * 4, lit,
               end=False)                                               # unseen end and under it)
        z = z0 - under / core.ZPX
        f.part(v0 - LINE, v1, [(S, z), (S + SHADE, z), (S + SHADE, z1), (S, z1)], [YS[1]] * 4, YS[1], end=False)
    plate(pa, pm - LINE / 2, zg + g, zp)                                # (over the groove, either side of its
    plate(pm + LINE / 2, pb, zg + g, zp)                                # upright)
    for i in range(n):
        v0, v1 = vs[i], vs[i + 1]
        x = ((v0 + v1) / 2 - (u0 + u1) / 2) / ((u1 - u0) / 2)
        zt = zw + (tall + arch * (1 - x * x)) / core.ZPX
        if min(v1, pb) - max(v0, pa) > 1e-6:                            # (the plate under the groove, on the seam)
            plate(max(v0, pa), min(v1, pb), zt + (gap + pover) / core.ZPX, zg - g, 0)
        for pf, col in (([(0.0, 0.0), (S, 0.0), (S, zw), (0.0, zw)], wall),                  # under the recess,
                        ([(0.0, zw), (S - r, zw), (S - r, zt), (0.0, zt)], dark),            # the recess,
                        ([(0.0, zt), (S, zt), (S, zb), (0.0, zb)], wall)):                   # over it
            cols = tone(pf)
            cols[1] = col
            f.part(v0, v1, pf, cols, wall)
        for d, z0, z1, col in ((S, zt + gap / core.ZPX, zt + (gap + 1) / core.ZPX, YS[0]),   # (painted: the
                               (S - r, zs, zt, SHADOW)):                                    # arch's seam, its shadow)
            pf = [(d, z0), (d + PAINT, z0), (d + PAINT, z1), (d, z1)]
            f.part(v0, v1, pf, [col] * 4, col)
    _octagon(f, u0, u1, H, S, zb, wall)


def _strut_seam(f, u, w, pf):
    """T3-1's seam across a strut over [u, u + w] (STRUT_SEAM): a px band round it its px under its top (its section
    pf: foot back, foot front, top front, top back), painted just proud of it."""
    down, col = STRUT_SEAM
    (d0, z0), (d1, z1), (d2, zm), (d3, _) = pf

    def at(z):                                                          # (its back and front at height z)
        return d0 + (d3 - d0) * (z - z0) / (zm - z0) - PAINT, d1 + (d2 - d1) * (z - z1) / (zm - z1) + PAINT
    za, zb = zm - (down + 1) / core.ZPX, zm - down / core.ZPX
    (ba, fa), (bb, fb) = at(za), at(zb)
    f.part(u - PAINT, u + w + PAINT, [(ba, za), (fa, za), (fb, zb), (bb, zb)], [col] * 4, col, end=False)


def _mount(f, u, z, sg):
    """T3-1's strut mount (STRUT_MOUNT): a cylinder from (u, z) on the face's plane (the strut's top) rising towards
    sg (+1: +u), its share sunk into the wall, in two halves a gap apart; its faces toned by facing (as plates)."""
    r, ln, sunk, n, up, gap = STRUT_MOUNT
    ang = math.radians(up)                                              # (its axis, (u, z): in px, so on screen)
    dirn = Vector((sg * math.cos(ang) * LINE, math.sin(ang) / core.ZPX)).normalized()
    out, side = T.OUT(f.ax), Vector((-dirn.y, dirn.x))                  # (out of the wall; across it, on the wall)
    r *= LINE
    c0 = (u, z, r * (1 - 2 * sunk))                                     # (its near end's centre: (u, z, d))

    def at(t, a):                                                       # (t px along it, a round it from out)
        uu = c0[0] + dirn.x * t * LINE + side.x * r * math.sin(a)
        zz = c0[1] + dirn.y * t * LINE + side.y * r * math.sin(a)
        return T.P(f.ax, f.plane, uu, zz, c0[2] + r * math.cos(a))

    def col(nrm):
        return YS[4] if nrm.z > 0.6 else YS[3] if nrm.dot(out) > -0.2 else YS[2]
    angles = [2 * math.pi * i / n for i in range(n)]
    along = (at(1, 0.0) - at(0, 0.0)).normalized()
    lit, shade = STRUT_MOUNT_RIGHT
    for t0, t1 in ((0.0, (ln - gap) / 2), ((ln + gap) / 2, ln)):        # (each half)
        mid = (at(t0, 0.0) + at(t0, math.pi)) / 2                       # (its near end's centre)
        for a0, a1 in zip(angles, angles[1:] + angles[:1]):             # (its sides, faced out from its axis; on
            pts = [at(t0, a0), at(t1, a0), at(t1, a1), at(t0, a1)]      # the right one its upper side by the
            nrm = ((pts[0] + pts[3]) / 2 - mid).normalized()            # wall lit)
            edge = sg < 0 and 1.3 * math.pi <= (a0 + a1) / 2 <= 1.7 * math.pi
            f.k.poly(pts, "steel", 3, nrm, fixed=lit if edge else col(nrm))
        for t, sgn in ((t0, -1), (t1, 1)):                              # (its ends)
            f.k.poly([at(t, a) for a in angles], "steel", 3, along * sgn, fixed=col(along * sgn))
    if sg < 0:                                                          # (the right one: the wall under its top
        t0, t1 = (ln + gap) / 2 - 1, (ln + gap) / 2                     # half shaded, a px of the gap)
        pts = [T.P(f.ax, f.plane, c0[0] + dirn.x * t * LINE + side.x * r * k, c0[1] + dirn.y * t * LINE +
                   side.y * r * k, SHADE) for t, k in ((t0, -1), (t1, -1), (t1, 1), (t0, 1))]
        f.k.poly(pts, "steel", 3, out, fixed=shade)


def _top_seam(f, s0, s1, u0, u1, H, S):
    """T3-1's seam across the top over [s0, s1] (TOP_SEAM): a px band its px in from the top's back edge (the tile's),
    stepping back at 45 degrees round the octagon over [u0, u1] to keep its clearance from it (a painted band)."""
    back, clear, col = TOP_SEAM
    side, _, diag = OCTAGON
    dc, r2 = S - SLOT_CH, 2 ** 0.5
    df = -0.5 - f.plane + (back + 1) * LINE                             # (its front edge: the tile's back edge at -0.5)
    db = dc - (side + diag + clear) * LINE                              # (behind the octagon's back)
    run = dc - side * LINE - clear * r2 * LINE                          # (clear of its diagonals: d = run - (u - u0))
    ua, ub = u0 + run - df, u0 + run - db                               # (where it steps back and is behind it)
    pts = [(s0, df), (ua, df), (ub, db), (u0 + u1 - ub, db), (u0 + u1 - ua, df), (s1, df)] if db < df else \
        [(s0, df), (s1, df)]                                            # (straight if it clears it anyway)
    ring = [T.P(f.ax, f.plane, u, H + PAINT, d) for u, d in pts] + \
        [T.P(f.ax, f.plane, u, H + PAINT, d - LINE) for u, d in pts[::-1]]
    f.k.poly(ring, "steel", 3, Vector((0, 0, 1)), fixed=col)


def _bay_lines(f, s, u, H):
    """T3-1's panel lines (BAY_LINES) on the bay's side wall (u: the frame's end, facing on; s: the section), as
    painted bands: open boxes from the lean back, the upper one on round the corner onto the back wall."""
    back, below, tall, gap, tall2, onto = BAY_LINES
    wz, wd = 1 / core.ZPX, LINE                                         # (a px band: high, deep)

    def side(pf):                                                       # (on the side wall, (d, z))
        f.part(u, u + PAINT, pf, [BAY_LINE] * len(pf), BAY_LINE, end=False)

    def along(z0, z1, d0):                                              # (a band from d0 to the lean)
        side([(d0, z0), (s.lean_d(z0), z0), (s.lean_d(z1), z1), (d0, z1)])
    z0, z1 = s.zb - below * wz, s.zb + tall * wz
    along(z0, z0 + wz, D - back * wd)                                   # the lower box: its foot,
    side([(D - back * wd, z0), (D - (back - 1) * wd, z0), (D - (back - 1) * wd, z1), (D - back * wd, z1)])
    along(z1 - wz, z1, D - back * wd)                                   # its back, its top
    z2 = z1 + gap * wz
    z3 = z2 + tall2 * wz
    for za, zb in ((z2, z2 + wz), (z3 - wz, z3)):                       # the upper one: its foot and top to the
        along(za, zb, 0.0)                                              # corner, on onto the back wall
        f.part(u, u + onto * wd, [(0.0, za), (PAINT, za), (PAINT, zb), (0.0, zb)], [BAY_LINE] * 4, BAY_LINE,
               end=False)
    f.part(u + (onto - 1) * wd, u + onto * wd, [(0.0, z2), (PAINT, z2), (PAINT, z3), (0.0, z3)], [BAY_LINE] * 4,
           BAY_LINE, end=False)


def _octagon(f, u0, u1, H, S, zb, wall):
    """T3-1's top over [u0, u1] from zb up: its front, the chamfer and the top as flat polygons, the OCTAGON
    recessed round the chamfer (down the front, over the chamfer, back over the top) and the panel (OCT_INNER)
    recessed further inside it (a recessed chamfer: moved in square to itself). Their floors in their faces' tones
    (the panel's OCT_PANEL, the octagon's chamfer OCT_CHAMFER), the walls the camera sees lit (OCT_LIT), the others
    dark; the sun's shadows shade them (core.SHADOWS)."""
    side, down, diag = OCTAGON
    reach, ins, cut = OCT_INNER
    k, ax, pl = f.k, f.ax, f.plane
    zc, dc = H - SLOT_CH, S - SLOT_CH
    L1, L2 = OCT_DEEP[0] * LINE, sum(OCT_DEEP) * LINE
    o1, o2 = (2 ** 0.5 - 1) * L1, (2 ** 0.5 - 1) * L2                  # (the octagon's chamfer's ends, the
    zr, dr, zq, dq = zc - o1, dc - o1, zc - o2, dc - o2                 # panel's)
    lit, lit_top = OCT_LIT
    eye = Euler(core.CAM_ROT).to_matrix() @ Vector((0, 0, 1))
    eye.y = -eye.y                                                      # (towards the camera, in T's space)
    up, out = Vector((0, 0, 1)), T.OUT(ax)

    def front(u, z, h=0.0):
        return T.P(ax, pl, u, z, S - h)

    def top(u, d, h=0.0):
        return T.P(ax, pl, u, H - h, d)

    def poly(pts, n, col):                                              # (repeated points dropped)
        pts = [q for i, q in enumerate(pts) if (q - pts[i - 1]).length > 1e-9]
        if len(pts) >= 3:
            k.poly(pts, "steel", 3, n, fixed=col)

    def walls(outline, to3d, h0, h1, edges, lit_col):                   # (round edges of an outline from depth h0
        c = sum((to3d(*q, h1) for q in outline), Vector()) / len(outline)   # to h1, facing into it)
        for i in edges:
            (a0, b0), (a1, b1) = outline[i], outline[(i + 1) % len(outline)]
            pts = [to3d(a0, b0, h0), to3d(a1, b1, h0), to3d(a1, b1, h1), to3d(a0, b0, h1)]
            n = (pts[1] - pts[0]).cross(pts[3] - pts[0])
            n = n if n.dot(c - (pts[0] + pts[1]) / 2) > 0 else -n
            poly(pts, n, lit_col if n.dot(eye) > 1e-6 else YS[1])

    def octagon(a, b, g, run, zf):                                      # (the outline: sides `run` long from
        return [(a, zf), (a, zf - run), (a + g, zf - run - g), (b - g, zf - run - g), (b, zf - run), (b, zf)]
    pa, pb, gp = u0 + ins * LINE, u1 - ins * LINE, cut * LINE
    zx = 1 / core.ZPX / LINE                                            # (px down the front, in z per LINE)
    fo = [(u, zc - (zc - z) * zx) for u, z in octagon(u0, u1, diag * LINE, down * LINE, zc)]
    fp = [(u, min(zq, zc - (zc - z) * zx))                              # (the panel's: no nearer the chamfer than
          for u, z in octagon(pa, pb, gp, max(0, reach - cut) * LINE, zc)]      # its own)
    to = octagon(u0, u1, diag * LINE, side * LINE, dc)                  # (on top: (u, d))
    tp = [(u, min(dq, d)) for u, d in octagon(pa, pb, gp, max(0, reach - cut) * LINE, dc)]
    # the front: round the octagon, its floor round the panel, the panel's floor up to their chamfers
    poly([front(u0, zb), front(u1, zb)] + [front(u, z) for u, z in fo[4:0:-1]], out, wall)
    poly([front(u, zr if z == zc else z, L1) for u, z in fo + [(pb, zr)] + fp[::-1] + [(pa, zr)]], out, wall)
    poly([front(u, z, L2) for u, z in fp], out, OCT_PANEL)
    walls(fo, front, 0.0, L1, (1, 2, 3), lit)
    walls(fp, front, L1, L2, (1, 2, 3), lit)
    # the top: round the octagon, its floor round the panel, the panel's floor up to their chamfers
    poly([top(u0, 0.0), top(u1, 0.0)] + [top(u, d) for u, d in to[4:0:-1]], up, TOP)
    poly([top(u, dr if d == dc else d, L1) for u, d in to + [(pb, dr)] + tp[::-1] + [(pa, dr)]], up, TOP)
    poly([top(u, d, L2) for u, d in tp], up, OCT_PANEL)
    walls(to, top, 0.0, L1, (1, 2, 3), lit_top)
    walls(tp, top, L1, L2, (1, 2, 3), lit_top)
    # the chamfer: the octagon's beside the panel, the panel's, and the panel's sides
    slant = (out + up).normalized()
    for a, b in ((u0, pa), (pb, u1)):
        poly([front(a, zr, L1), front(b, zr, L1), top(b, dr, L1), top(a, dr, L1)], slant, OCT_CHAMFER)
    poly([front(pa, zq, L2), front(pb, zq, L2), top(pb, dq, L2), top(pa, dq, L2)], slant, OCT_PANEL)
    zlo, dlo = fp[1][1], tp[1][1]                                       # (the panel's sides' far ends)
    for u, sg in ((pa, 1), (pb, -1)):
        pts = [front(u, zlo, L1), front(u, zr, L1), top(u, dr, L1), top(u, dlo, L1), top(u, dlo, L2),
               top(u, dq, L2), front(u, zq, L2), front(u, zlo, L2)]
        n = (Vector((1, 0, 0)) if ax == "y" else Vector((0, 1, 0))) * sg
        poly(pts, n, lit if n.dot(eye) > 1e-6 else YS[1])


def _floor_panel(f, u0, u1, zw, zf, mid, col=YS[3], up=YS[1]):
    """T3-1's floor outline over [u0, u1] (the bay's sides): its back line FLOOR_PANEL px out from the back wall, its
    sides down the floor and on over its front edge, closed FLOOR_PANEL px down the front (painted bands just proud
    of the floor's top and its front: col on the floor, up on the front), FLOOR_KEYS over that about mid;
    FLOOR_INNER."""
    side, back, down = FLOOR_PANEL
    run = (zw - zf) * core.ZPX + D * core.TILE_H / 2                      # (the floor's length on screen, px)

    def at(t):                                                          # (t of the floor's length from the back)
        return D * t, zw - (zw - zf) * t
    e, w = 0.002, 1 / run                                               # (a band a px wide down the floor)

    def on_floor(t0, t1):
        (da, za), (db, zb) = at(t0), at(t1)
        return [(da, za), (db, zb), (db, zb + e), (da, za + e)]

    def on_front(z0, z1):
        return [(D, z0), (D + e, z0), (D + e, z1), (D, z1)]
    a, b = u0 + side * LINE, u1 - side * LINE
    t0 = back / run
    zd = f.sec.z_at(zf, down)
    f.part(a, b, on_floor(t0, t0 + w), [col] * 4, col, end=False)                     # its back line
    for u in (a, b - LINE):
        f.part(u, u + LINE, on_floor(t0, 1.0), [col] * 4, col, end=False)             # its sides, down the floor
        f.part(u, u + LINE, on_front(zd, zf), [up] * 4, up, end=False)                # and down the front
    f.part(a, b, on_front(zd, f.sec.z_at(zd, -1)), [up] * 4, up, end=False)          # closed across the front
    kw, kg, kh = FLOOR_KEYS                                             # keys over that line about mid (as the
    z0, z1 = f.sec.z_at(zd, kh), f.sec.z_at(zd, -1 - kh)               # run's clamps)
    for k0 in (mid - (kg / 2 + kw) * LINE, mid + kg / 2 * LINE):
        f.shade(k0, k0 + kw * LINE, z0, z1)
        f.raised(k0, k0 + kw * LINE, z0, z1, -0.01, 2 * LINE, cap=YS[1])
    side, top, short = FLOOR_INNER                                      # the panel inside it, on the floor
    a, b, t0, t1 = a + side * LINE, b - side * LINE, t0 + top / run, 1.0 - short / run
    for ta in (t0, t1 - w):
        f.part(a, b, on_floor(ta, ta + w), [col] * 4, col, end=False)
    for u in (a, b - LINE):
        f.part(u, u + LINE, on_floor(t0, t1), [col] * 4, col, end=False)
