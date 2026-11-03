"""Drone (set 5): a deep machine housing between flush lit strips, a sloped header, teal conduits; a ramp ending in an
upright foot with a handle slot cut into it; its shell and its straight-run designs."""
import math

from mathutils import Vector

from .. import wall3d as T
from .base import Faction, _style
from .drone_designs import DRONE_D, DRONE_TOPS, DRONE_RAMPS, drone_middle
from .parts import LINE, PAINT, PX, PZ, bezier, body, corner_piece, glow, pipe, prism
from .shell import NO, Feature, FloorDrop, FootTone, FreeEnds, LookShell, SlotHoles, _end_section, _ends


def handle(k, ax, plane, u0, u1, zc, d, r=0.045):
    """A pull handle: one smooth round bar out of the wall at u0, along d out, and back in at u1, its bends curved."""
    rr = min(d, 0.06)

    def W_(u, dd):
        return T.P(ax, plane, u, zc, dd)
    pts = bezier(W_(u0, -0.01), W_(u0, d), W_(u0 + rr, d), 6)
    pts += bezier(W_(u1 - rr, d), W_(u1, d), W_(u1, -0.01), 6)
    pipe(k, pts, r, "rose", 2, n=8)                     # (dark conduits, in their dark bands)


DRONE_S = 7 / 32                    # the outer corner is cut off this far along each axis (on the shell's grid)


DRONE_E = DRONE_S                   # the faces' parts stop where the cut starts


DRONE_H = 0.006                     # the corner panel sits on the cut (just proud of the shell's own face there)


DRONE_FOOT = 4 / 39                 # the drone ramp ends in an upright face this high at the floor (set 5)


DRONE_OT = 0.4 / 32                 # the ramp panel's top and bottom lines' depth down the slope: one art px on
                                    # screen (a cell down the slope shows 2.5)
DRONE_OD = (2 / 11, (9 + 0.4) / 11)  # its top and bottom (the top line on the ramp's 2nd of 11 cells; the bottom
                                     # line's top on its 9th, where the handle slot ends: drone_designs' DRONE_RAMPS)
DRONE_SW = 0.15 + 2 / 32            # the drone block's side strips (T1, T1-4)


DRONE_HD = 4 / 39                   # the header's foot this far under its old place (dropped 2 art px, then 2 px
                                    # deeper); the handle above the block and the block's top move down with it


class CornerCut(Feature):
    """An outer corner cut off at 45 degrees (DRONE_S along each axis), for a corner face set back into the wall (its
    status-light channel); the ramp keeps its square corner."""
    def setup(self, sp):
        for (x0, x1, y0, y1), fam, t, top in sp.rects:
            adj_x = any(abs(o[0][0] - x1) < 1e-9 and o[0][2] < y1 and o[0][3] > y0 for o in sp.rects)
            adj_y = any(abs(o[0][2] - y1) < 1e-9 and o[0][0] < x1 and o[0][1] > x0 for o in sp.rects)
            if any(sd[0] == "+" for sd, _ in sp.end_sides):
                break                                   # (a wall's free end is no corner)
            if not adj_x and not adj_y and x1 < 0.5 - 1e-9 and y1 < 0.5 - 1e-9 and sp.keep is None:   # (a
                # partition's outer corner or the far hull's)
                lim = T.snap(x1) + T.snap(y1) - DRONE_S + 1e-9     # (where the faces really stand)
                sp.keep = lambda ci, cj: ci / T.W.GN - 0.5 + cj / T.W.GN - 0.5 <= lim
                sp.diag = sp.skirt_halves = True
                sp.cut = (T.snap(x1), T.snap(y1), DRONE_S)


class DiagTone(Feature):
    """The cut corner's 45-degree face in the wall's plate tone."""
    def col_face(self, sp, face, x, y, z):
        return T.RAMPS["wall"][0][2] if face == "d" else NO


def chamfer(k, X, Y, e, h, zb, top, z1, F, D=0.0, zbox=None, black=True):
    """The corner channel: a 45-degree face from the y face's (X - e, Y + h) to the x face's (X + h, Y - e), set
    into the shell's cut corner (CornerCut), from the foot to the cap, its top the cap's black, carrying the status
    lights in a recessed terminal; zbox = (z0, z1, zband): a box standing out from it there, with two curved pipes
    from each of its sides to the blocks (D deep) that end beside the corner, and the faces' dark band below zband
    carried across it. t runs along it (-1 .. 1), d out of it."""
    r2 = 2 ** -0.5
    n, tang = Vector((r2, r2, 0)), Vector((r2, -r2, 0))
    cx, cy, wl = X + (h - e) / 2, Y + (h - e) / 2, (e + h) * r2

    def Q(t, z, d=0.0):
        return Vector((cx + t * wl * r2 + d * r2, cy - t * wl * r2 + d * r2, z))

    def box(t0, t1, z0_, z1_, d, fam, lvl, fixed=None):
        f = [Q(t0, z0_, d), Q(t1, z0_, d), Q(t1, z1_, d), Q(t0, z1_, d)]
        k.poly(f, fam, lvl, n, fixed=fixed)
        if d > 0.01:                                    # its top and foot; its ends face along the panel, edge
            bk = [Q(t0, z0_), Q(t1, z0_), Q(t1, z1_), Q(t0, z1_)]          # on to the camera, so they'd only alias
            for (i, j), o in (((3, 2), Vector((0, 0, 1))), ((0, 1), Vector((0, 0, -1)))):
                k.poly([f[i], f[j], bk[j], bk[i]], fam, lvl, o + n * 0.01, fixed=fixed)
    s_ = e - h
    pl = [(X - e, Y + h), (X + h, Y - e), (X, Y - e), (X, Y - s_), (X - s_, Y), (X - e, Y)]   # its body in plan
    if black:                                           # the cap's black, square over the cut like the rest of the
        k.poly([Vector((X - e, Y, top)), Vector((X, Y, top)), Vector((X, Y - e, top))], F, 3, Vector((0, 0, 1)),
               fixed="wK")                              # top (the far hull's armour plates already cover its cut)
    k.poly([Vector((x, y, zb)) for x, y in pl], F, 3, Vector((0, 0, -1)))
    zl = zb - 0.02 + PAINT                              # the skirt's flat top left in the cut, in the foot gap's dark
    k.poly([Vector((X - e, Y, zl)), Vector((X, Y, zl)), Vector((X, Y - e, zl))], "ochre", 1, Vector((0, 0, 1)))
    box(-1, 1, zb, top, 0.0, F, 2)                                                   # the channel's face
    box(-1, 1, top - 0.02, top, PAINT, F, 0)                     # the faces' dark line under the top, carried across
    if zbox:
        box(-1, 1, zb, zb + 0.05, PAINT, "ochre", 1)                                 # the faces' dark foot gap and
        box(-1, 1, zb + 0.05, zbox[2], PAINT, "rose", 2)                             # band, on round the corner
        bz0, bz1, bd = zbox[0], zbox[1], 3 * PX
        box(-0.5, 0.5, bz0, bz1, bd, F, 3)                                           # the box
        for z in (bz0 + 0.035, bz1 - 0.035):                                         # its pipes
            for sg in (-1, 1):
                p0, d1 = Q(0.5 * sg, z, bd * 0.5), tang * sg    # out of the box's side, along the panel ...
                if sg < 0:                                      # ... then one smooth bend into the block's end
                    p2, d2 = Vector((X - e - 0.02, Y + D * 0.55, z)), Vector((-1, 0, 0))
                else:
                    p2, d2 = Vector((X + D * 0.55, Y - e - 0.02, z)), Vector((0, -1, 0))
                a_ = ((p2 - p0).cross(d2)).z / d1.cross(d2).z   # the two runs' meeting point
                cn = p0 + d1 * a_
                rr = 0.6 * min(a_, (p2 - cn).length)
                pipe(k, [p0] + bezier(cn - d1 * rr, cn, cn + d2 * rr, 8) + [p2], 0.02, "rose", 2, n=4,
                     flat=(T.RAMPS["rose"][0][4], T.RAMPS["rose"][0][2]))
    t0, t1, p0_, p1_, fd = -0.45, 0.45, z1 - 0.24, z1 + 0.12, 0.75 * PX             # the terminal, in a recess: a
    for q in ((-0.64, t0, p0_ - 0.04, p1_ + 0.04), (t1, 0.64, p0_ - 0.04, p1_ + 0.04),        # frame standing round
              (t0, t1, p1_, p1_ + 0.04), (t0, t1, p0_ - 0.04, p0_)):                          # it, its floor dark
        box(q[0], q[1], q[2], q[3], fd, F, 3)
    box(t0, t1, p0_, p1_, PAINT, F, 1)
    for i, col in enumerate(("green", "green", "flameY", "red")):                    # its status lights
        zc = z1 + 0.05 - i * 0.065
        box(-0.22, 0.22, zc - 0.016, zc + 0.016, 2 * PAINT, F, 0, fixed=col)


def _column(k, ax, plane, u0, u1, z0, zt, D, c, F, mt, cp, gw):
    """A side column of the block: sloped top and foot, its front D proud, a groove half a PX deep down its front
    2 px in from either side, from the front's foot to 2 px under its top (cp: its ends' tones, mt: its mitres, gw:
    the groove's sides')."""
    g, dr = 2 * LINE, 0.5 * PX
    Dr = D - dr
    zu = zt - c - 2 * PZ                                # (the groove's top)
    prism(k, ax, plane, u0 + g, u1 - g, [(0.0, z0), (Dr, z0 + c * Dr / D), (Dr, zu), (0.0, zu)], F, 2,
          cap=False)                                    # between them the groove, its floor a shade darker,
    prism(k, ax, plane, u0 + g, u1 - g, [(0.0, zu), (D, zu), (D, zt - c), (0.0, zt)], F, 3, cap=False)   # shut over
    prism(k, ax, plane, u0, u0 + g, [(0.0, z0), (D, z0 + c), (D, zt - c), (0.0, zt)], F, 3, mitre=(mt[0], 0.0),
          cap=(cp[0], gw))                              # the groove's sides
    prism(k, ax, plane, u1 - g, u1, [(0.0, z0), (D, z0 + c), (D, zt - c), (0.0, zt)], F, 3, mitre=(0.0, mt[1]),
          cap=(gw, cp[1]))


def drone(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        zb = zs + 0.02
        endf, end1, corner, back = _ends(ax, plane, b, ends)    # (a free end stops square: no channel there; its
        corner = full and corner                                # end face shows the section, no block on it)
        D, c, e = DRONE_D, DRONE_D, DRONE_E                 # the block's depth, its slopes' run, the channel's reach
        # how each end's parts meet the next face: an outer corner on its diagonal (1), an inner corner on its own
        # diagonal (-1: a part runs short by its depth, so the two faces' blocks and rails meet in a clean mitre)
        mit = [{"out": 1.0, "in": -1.0}.get(x, 0.0) for x in ends]
        if corner:                                          # stop short of the corner channel
            b, ends, mit[1] = b - e, (ends[0], "in"), 1.0
        T.run(k, ax, plane, a, b, ends, zb, zb + 0.05, PAINT, "ochre", 1, 0)                    # dark gap at the foot
        if not full:
            return
        H = T.W.wall_top("wall", "up") - zs              # laid out on a partition's height, on every wall (the far
        z0, z1 = zs + 0.11 * H, zs + 0.68 * H - DRONE_HD    # hull's extra height goes to its band under the rail), so
                                                        # blocks, handles and bands line up where walls meet
        T.run(k, ax, plane, a, b, ends, zb + 0.05, z0, PAINT, "rose", 0, 0)                     # the short dark band
        rt = min(top, T.W.wall_top("wall", "up"))       # the rail at a partition's top on every wall; the far
        if top > rt + 0.03:                             # hull's extra height above it a plain plate
            T.run(k, ax, plane, a, b, ends, rt, top - 0.02, PAINT, F, 2, 0)
        RD = 0.5 * PX                                   # the rail's depth (the centre block's a PX more)
        rl, rh = rt - 0.12 - DRONE_HD, rt - 0.02 - 3 * PZ            # the rail's foot and front top; its top slopes
        T.run(k, ax, plane, a, b, ends, z1, rl, PAINT, "rose", 0, 0)  # up to the wall 2 art px under the cap (the
        rail = [(0.0, rl), (RD, rl), (RD, rh - PZ), (RD, rh), (0.0, rt - 2 * PZ)]    # machinery band under it)
        T.run(k, ax, plane, a, b, ends, rt - 2 * PZ - 0.01, rt, PAINT, F, 2, 0)   # the wall over it in its steel
        cl = rt - 0.15 - DRONE_HD - PZ                  # the centre block's foot
        RR = T.RAMPS[F][0 if ax == "y" else 1]          # the rail two steps darker than the wall (the shade face's
        dk = T.RAMPS[F][1][2 if ax == "y" else 1]       # mid tone; that face's own darkest), lit along its front's
        rcol = [RR[0], dk, RR[4], dk, RR[0]]            # top edge (per edge of its section)
        ra, rb, rm = a, b, list(mit)                    # the top rail; over a lower wall meeting an inner end (a
        for i, tt in enumerate(T.END_TOPS):             # partition at the far hull) it runs on over its top to meet
            if tt is not None and tt < rl - 1e-6 and not (i == 1 and corner):           # the rail from the other side
                rm[i] = 0.0
                if i == 0:
                    ra -= T.W.TW / 2
                else:
                    rb += T.W.TW / 2
        prism(k, ax, plane, ra, rb, rail, F, 1, cols=rcol, mitre=tuple(rm))
        if corner and ax == "y":                                                                 # (on round the cut)
            corner_piece(k, b + e, plane, e, [(-0.02, rl)] + rail[1:4] + [(-0.02, rail[4][1])], F, 1, cols=rcol)
        if endf:
            _end_section(k, ax, plane, a, b, zs, rl, F)
        for s0, s1 in ([] if endf else T.spans(a, b)):
            uc = (s0 + s1) / 2
            at0, at1 = abs(s0 - a) < 1e-6 and ends[0] != "cont", abs(s1 - b) < 1e-6 and ends[1] != "cont"
            in0, in1 = at0 and ends[0] == "in", at1 and ends[1] == "in" and not corner
            if s1 - s0 > 0.3:
                if not (in0 and uc - 0.1 < a + 0.25) and not (in1 and uc + 0.1 > b - 0.25):   # (clear of the
                    prism(k, ax, plane, uc - 0.1, uc + 0.1, [(0.0, cl), (RD + PX, cl),              # other face)
                          (RD + PX, rt - 0.01 - 3 * PZ), (0.0, rt - PZ)], F, 4)      # its centre block, its top
                                                                                 # sloping up to the wall 1 art px
                                                                                 # under the cap

            h0, h1 = s0 + (0.0 if at0 else 0.03), s1 - (0.0 if at1 else 0.03)
            if h1 - h0 < 0.25:
                continue
            hc = (h0 + h1) / 2
            m0, m1 = (mit[0] if at0 else 0.0), (mit[1] if at1 and not corner else 0.0)
            sides = T.RAMPS[F][1 if ax == "y" else 0]               # its ends a shade darker than they'd light
            f0 = z0 + c                                                                          # its front's foot
            bay = T.fill("bay")
            if bay:                                     # a design's bay opened in the block, between proud columns
                bay(k, ax, plane, h0 + 0.12, h1 - 0.12, z0, z1, F)                                  # (set back)
                Dc = D - PX
                lift = 0.5 * PX * math.hypot(c, D) / D      # (the columns stand proud of the bay's sloped top and
                col = [(0.0, z0 - lift), (Dc, z0 - lift + c * Dc / D),     # foot alike: raised strips carried up
                       (Dc, z1 + lift - c * Dc / D), (0.0, z1 + lift)]      # the slopes)
                o0, o1 = (Dc if m0 < 0 else 0.0), (Dc if m1 < 0 else 0.0)   # an inner mitre eats a part's depth: the
                for u0, u1, mt in ((h0, h0 + 0.12 + o0, (m0, 0.0)), (h1 - 0.12 - o1, h1, (0.0, m1))):   # columns widen
                    prism(k, ax, plane, u0, u1, col, F, 3, mitre=mt, cap=sides[1])               # its two columns
                q0, q1 = h0 + o0, h1 - o1                   # (the front clear of the other face there)
            else:                                       # the block (set 5 T1): a lighter strip either side, flush with
                Dc, sw = D, DRONE_SW                    # its front, and the middle between them (its design's)
                o0, o1 = (D if m0 < 0 else 0.0), (D if m1 < 0 else 0.0)
                q0, q1 = h0 + o0, h1 - o1
                zt = z1 + 4 * PZ                        # (the strips' top: 4 art px over the block's old top)
                fc = T.RAMPS[F][1][4] if ax == "y" else T.RAMPS[F][0][1]    # (their inner ends in their front's
                                                                            # tone: the other face's ramp's name
                                                                            # for it, as they face across)
                for u0, u1, mt, cp in ((s0 if not at0 else h0, q0 + sw, (m0, 0.0), (sides[1], fc)),   # (on to the
                                       (q1 - sw, s1 if not at1 else h1, (0.0, m1), (fc, sides[1]))):  # tile's edge)
                    _column(k, ax, plane, u0, u1, z0, zt, D, c, F, mt, cp, sides[1])
                T.fill("middle", drone_middle)(k, ax, plane, q0 + sw, q1 - sw, z0, zt, f0, F)
            hw = (h1 - h0) / 2 - 0.07
            g0 = max(hc - hw, a + Dc + 0.05) if at0 and ends[0] == "in" else hc - hw     # (clear of the other
            g1 = min(hc + hw, b - Dc - 0.05) if at1 and ends[1] == "in" and not corner else hc + hw   # face's block)
            if not (corner and abs(s1 - b) < 1e-6) and g1 - g0 > 0.15:  # (none on the corner's tile)
                handle(k, ax, plane, g0, g1, z1 + 0.12 + 2 * PZ, 2 * PX)                         # pull handles above
                handle(k, ax, plane, g0, g1, z0 - 0.065, 2 * PX)                                 # and below it
            if hull and variant:                                # the variant: a small recessed status panel
                pc, pw, r0, r1 = (q0 + q1) / 2, 0.13, f0 + 0.05, f0 + 0.19
                for v0, v1, w0, w1 in ((pc - pw - 0.03, pc - pw, r0 - 0.03, r1 + 0.03),
                                       (pc + pw, pc + pw + 0.03, r0 - 0.03, r1 + 0.03),
                                       (pc - pw, pc + pw, r1, r1 + 0.03), (pc - pw, pc + pw, r0 - 0.03, r0)):
                    T.slab(k, ax, plane, v0, v1, w0, w1, D + 0.5 * PX, F, 3)                     # its frame
                T.paint(k, ax, plane, pc - pw, pc + pw, r0, r1, D, "rose", 1)                    # its dark floor
                for i, col in enumerate(("green", "flameY", "red")):                             # its lights
                    uu = pc - 0.08 + i * 0.08
                    glow(k, ax, plane, uu - 0.022, uu + 0.022, r1 - 0.07, r1 - 0.035, col, D + PAINT)
        if corner and ax == "y":                            # the corner channel, once (the y face's end is the corner)
            chamfer(k, b + e, plane, e, DRONE_H, zb, top, z1, F, D + 0.5 * PX, (z0 + c, z0 + c + 0.14, z0),
                    black=not hull)
    return face


class Drone(Faction):
    pre = "fD"

    def relief(self, sprite):
        return _style(drone, skirt="outline", slot=True, seam=0, outline_d=DRONE_OD, outline_t=DRONE_OT,
                      tops=DRONE_TOPS, ramps=DRONE_RAMPS, foot=DRONE_FOOT, ramp_solid=True,
                      shell=LookShell,
                      features=(FreeEnds(), SlotHoles(), CornerCut(), FloorDrop(), DiagTone(),
                                FootTone("wall", 3)))
