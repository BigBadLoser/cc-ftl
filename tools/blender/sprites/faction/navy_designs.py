"""Navy's straight-run designs (set 4): its tops take the face's cover off (the dark frame shows) and fill the opening,
or change its band; its ramps the ramp's cover. The face (navy.py) asks for its slots: "middle" (k, ax, plane, u0, u1,
z0, z1, F: inside the opening),
"band" (k, ax, plane, a, b, ends, zh, H) and the shared "ramp" and "ramp_hole" (relief_style.Style.fill)."""
import math

from mathutils import Vector

from .. import wall3d as T
from ..relief_style import Design
from .parts import LINE, PAINT, PX, flat, prism, tube, tube_prof

BAND = 1.5 * PAINT                  # a band design's red: on the face's covers (navy.COVER, PAINT)


def _box(k, ax, plane, u0, u1, z0, z1, d, cols, ch=0.0, ct=None):
    """A box standing d proud, its top and foot chamfered ch (its top ct, if given), its faces in fixed colours
    (cols: foot, front, top; its ends the foot's)."""
    ct = ch if ct is None else ct
    prism(k, ax, plane, u0, u1, [(0.0, z0), (d, z0 + ch), (d, z1 - ct), (0.0, z1)], "wall", 0,
          cols=[cols[0], cols[1], cols[2], cols[0]], cap=cols[0])


def navy_boxes(k, ax, plane, a, b, c, e, F, mouth=None, **_):
    """Two control boxes (T1-2): light bezels, dark windows packed with red and cream parts and small lights."""
    c, e = c - 1 / 39.19, e - 1 / 39.19                # (a px down: the user)
    zm = (c + e) / 2
    a = T._u(round(T._px(a + 0.06, PX)) + 1, PX)        # (each 3 px narrower, on the px grid: a px off its left, 2
    b = T._u(round(T._px(b - 0.06, PX)) - 2, PX)        # off its right; 2 px shorter, a px off its top and foot: the
    hz = 1 / 39.19                                      # user)
    if mouth:                                           # (centred in its recess's mouth as seen: the user)
        L, R = round(T._px(a, PX)), round(T._px(b, PX))
        n = mouth[0] + (mouth[1] - mouth[0] - (R - L)) // 2
        a, b = T._u(n, PX), T._u(n + R - L, PX)
    for q0, q1 in ((c + 0.02 + hz, zm - 0.02 - hz), (zm + 0.02 + hz, e - 0.02 - hz)):
        T.slab(k, ax, plane, a, b, q0, q1, PX, F, 3)                                                     # bezel
        w0, w1, v0, v1 = a + 2 / 32, b - 2 / 32, q0 + 2 / 39.19, q1 - 2 / 39.19    # (the bezel 2 px: chunkier, the
        #   ref's: the user)
        T.paint(k, ax, plane, w0, w1, v0, v1, PX, "rose", 1)                                             # window
        cw, ch = (w1 - w0) / 4, (v1 - v0) / 3
        for i in range(4):
            for j in range(3):
                x0, y0 = w0 + i * cw, v0 + j * ch
                if (i + j) % 3 == 1:                                                                     # cream parts
                    T.paint(k, ax, plane, x0 + LINE / 2, x0 + cw - LINE / 2, y0 + 0.01, y0 + ch - 0.01,
                            PX + PAINT, F, 5)
                else:                                                                                    # red parts
                    flat(k, ax, plane, x0 + LINE / 2, x0 + cw - LINE / 2, y0 + 0.01, y0 + ch - 0.01,
                         PX + 2 * PAINT, ("lvR", "drM", "lvR2")[(i + 2 * j) % 3])
        for fu, fz, col in ((0.3, 0.7, "green"), (0.65, 0.35, "green"), (0.8, 0.75, "flameY")):          # lights
            uu, zz = w0 + fu * (w1 - w0), v0 + fz * (v1 - v0)
            flat(k, ax, plane, uu - LINE, uu + LINE, zz - 0.025, zz + 0.025, PX + 3 * PAINT, col)


def navy_lockers(k, ax, plane, a, b, c, e, F, mouth=None, **_):
    """T1-3 (ref 07): one tall red locker in its recess, its front flush with the wall, a px clear of the recess's
    sides; a 4 px slope down to its front, its top edge lit and its foot's dark; a dark handle notch under its top, a
    seam across it (a dark line, a lit one under it). Its own flat reds, anti-aliased (fNL*: navy.locker)."""
    du, dz = 1 / 32, 1 / 39.19
    ct = None
    if mouth:                                           # (in its recess, a px clear each side: the user)
        a, b = T._u(mouth[0] + 1, PX), T._u(mouth[1] - 1, PX)
        d, ch, ct = PX, dz, 4 * dz                      # (its top 4 px down, a 4 px slope back to it: the user)
        e -= 4 * dz
    else:
        d, ch = 2 * PX, PX
    _box(k, ax, plane, a, b, c, e, d, ("fNL3", "fNL2", "fNL1"), ch=ch, ct=ct)
    ft = e - (ch if ct is None else ct)                 # (its front's top)
    uc = T._u(round(T._px((a + b) / 2, d)), d)          # (on the px grid at its front)
    flat(k, ax, plane, uc - 2 * du, uc + 2 * du, ft - 6 * dz, ft - 4 * dz, d + PAINT, "fNL4")            # handle
    flat(k, ax, plane, a, b, ft - dz, ft, d + PAINT, "fNL0")                     # its top front edge lit (the user)
    flat(k, ax, plane, a, b, c + ch, c + ch + dz, d + PAINT, "fNL4")             # its foot's edge in shadow (the user)
    zs = c + 0.5 * (ft - c)                             # the seam: halfway, full width (the user)
    flat(k, ax, plane, a, b, zs, zs + dz, d + PAINT, "fNL4")
    flat(k, ax, plane, a, b, zs - dz, zs, d + PAINT, "fNL1")


CAGE_D = (1 / 32, 3 / 32)            # the cage's frame 1 px behind the wall, the cage 3 px in (its back) (the user)


def _recess(k, ax, plane, u0, u1, z0, z1, d0, d1):
    """The walls of a recess from d0 back to d1 (< d0, depths off the face) round u0..u1 x z0..z1: its floor lit,
    its ceiling and sides in shade (the frame's dark navy)."""
    Q = lambda u, z, d: T.P(ax, plane, u, z, d)        # noqa: E731
    al, up = T.P(ax, 0, 1, 0, 0) - T.P(ax, 0, 0, 0, 0), Vector((0, 0, 1))
    k.poly([Q(u0, z0, d0), Q(u1, z0, d0), Q(u1, z0, d1), Q(u0, z0, d1)], "rose", 3, up)                 # floor
    k.poly([Q(u0, z1, d0), Q(u1, z1, d0), Q(u1, z1, d1), Q(u0, z1, d1)], "rose", 1, -up)                # ceiling
    for u, sg in ((u0, 1), (u1, -1)):                                                                    # sides
        k.poly([Q(u, z0, d0), Q(u, z1, d0), Q(u, z1, d1), Q(u, z0, d1)], "rose", 4, al * sg)


def cover_holes(a, b, zs, top, ends=None, span=None, ax=None, plane=None, sh=None, **_):
    """Where a top design opens the face (its "face_holes": the cage, the boxes): each cover's rect, on the shell's
    cells (inside it; down to the cell under the shelf, the recess's floor flush with the shelf: the user)."""
    from .navy import cover_rects
    if ends is None or top <= T.W.skirt_top() + T.W.CUT + 0.05:
        return []
    return [(math.ceil(u0 * 32 - 1e-6) / 32, math.floor(u1 * 32 + 1e-6) / 32, math.floor(z0 * 32 + 1e-6) / 32,
             math.floor(z1 * 32 + 1e-6) / 32) for u0, u1, z0, z1 in cover_rects(sh, ax, plane, *span, ends, zs, top)]


LIP = 2 / 32                        # a recess's wall on its tile-edge side (else paper thin there: the user)


def lipped_holes(*args, **kw):
    """cover_holes, LIP in from the tile's edge (the cover keeps that much: the recess's left wall)."""
    return [(u0 + LIP, u1, z0, z1) for u0, u1, z0, z1 in cover_holes(*args, **kw)]


def navy_cage(k, ax, plane, a, b, c, e, F, hole=None, **_):
    """T1-4 (refs 10-11): a cage with a light behind it, in the cover's opening (cage_holes): the frame round it 1 px
    behind the wall, the cage recessed into it, a dark back, a light (cream, dim at its edges) over its middle, navy
    rungs across every 4 px, three guard bars over them the only uprights."""
    du, dz = 1 / 32, 1 / 39.19
    f = 0.0
    if hole:                                            # the frame 1 px back, the cage in it (3 px in from the tile's
        h0, h1, v0, v1 = hole                           # edge, 1 px from the line, 4 px under the header and over the
        a, b, c, e = h0 + 3 * du, h1 - du, v0 + 4 * dz, v1 - 4 * dz      # foot: the ref's)
        f, bk = -CAGE_D[0], -CAGE_D[1]
        _recess(k, ax, plane, h0, h1, v0, v1, 0.0, f)
        for q in ((h0, a, v0, v1), (b, h1, v0, v1), (a, b, v0, c), (a, b, e, v1)):
            k.poly([T.P(ax, plane, u, z, f) for u, z in ((q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3]))],
                   "rose", 2, T.OUT(ax))
        _recess(k, ax, plane, a, b, c, e, f, bk)
    else:
        a, c, e = a - 0.04 + 3 * du, c - 0.04 + 4 * dz, e + 0.04 - 4 * dz
        bk = 0.6 * PAINT
    flat(k, ax, plane, a, b, c, e, bk, "fNS5")                                                         # the back
    uc = round((a + b) / 2 * 32) / 32
    l0, l1 = c + 0.2 * (e - c), c + 0.85 * (e - c)
    flat(k, ax, plane, uc - 5 * du, uc + 5 * du, l0 - 2 * dz, l1 + 2 * dz, bk + 0.1 * PAINT, "fSH1")   # the light's
    flat(k, ax, plane, uc - 3 * du, uc + 3 * du, l0, l1, bk + 0.2 * PAINT, "c2T1")                      # glow, its core
    z = math.ceil(c / dz) * dz                                                       # the cage: its rungs (the guard
    #   bars below its only uprights: the user), just behind the frame
    while z < e - 1e-6:
        flat(k, ax, plane, a, b, z, min(e, z + dz), f - PAINT if hole else 0.9 * PAINT, "fNX3")
        z += 4 * dz
    so, r = 0.08, 0.06                                  # three guard bars over it: out of the top frame, curving out
    zt, zb = e + 2 * dz, c - 2 * dz                     # so far, down, and back into the foot's (the ref's: the user)
    prof = [(zt, 0.0)] + [(zt - r * math.sin(t), so * (1 - math.cos(t))) for t in
                          (math.pi / 2 * i / 4 for i in range(1, 5))]
    prof += [(zb + (zt - z_), d_) for z_, d_ in reversed(prof)]
    d0 = f + PAINT                                      # (on the frame)
    ds = d0 + so                                        # (evenly spaced as seen: the opening's px edges, the bars
    L, R = round(T._px(a, f)), round(T._px(b, f)) - (1 if hole else 0)   # 2 px each, the gaps equal, the spare px to
    #   the middle ones (the mouth's far side hides its last px);
    g, x = divmod(R - L - 6, 4)                         # then where they stand out)
    gaps = [g, g + (x > 1), g + (x > 0), g + (x > 2)]
    n = L
    for gi, sp_ in zip(gaps[:3], (-3, 0, 3)):          # (the outer two 3 px further off the middle: the user)
        n += gi
        ub = T._u(n + 1 + sp_, ds)
        n += 2
        for (za, da), (zb_, db) in zip(prof, prof[1:]):
            col = "fNX1" if db > da + 1e-6 else "fNX4" if db < da - 1e-6 else "fNX2"   # (lit curving out at
            k.poly([T.P(ax, plane, ub - du, za, d0 + da), T.P(ax, plane, ub + du, za, d0 + da),   # the top,
                    T.P(ax, plane, ub + du, zb_, d0 + db), T.P(ax, plane, ub - du, zb_, d0 + db)],  # shaded in
                   "wall", 0, T.OUT(ax), fixed=col)                                                  # at the foot)


navy_cage.own_hole = True          # (it builds its own frame and recess in its opening)


RECESS = 2                          # the recessed cover: pushed back this many px (the user)


def navy_recessed(k, ax, plane, a, b, c, e, F, zh=None, H=None, back=None, **_):
    """T1-5 (refs 12-14): the cover panel, its band with it, pushed back RECESS px: in its recess (back: the face's
    plane, the hole, the shelf's foot), on the recess's back; else in the opening, the frame's dark showing that
    much more on its left and top, the panel a shade darker."""
    if back:                                            # (the real recess: the panel its back: the user)
        pl, (u0, u1, _, z1), zf = back
        d, dz = 0.5 * PAINT - RECESS / 32, 1 / 39.19
        sheet = lambda z0, z1_, dd, fam, lvl, fx=None: k.poly([T.P(ax, pl, u, z, dd) for u, z in (  # noqa: E731
            (u0, z0), (u1, z0), (u1, z1_), (u0, z1_))], fam, lvl, T.OUT(ax), fixed=fx)
        sheet(zf + 2 * dz, z1, d, F, 0)                 # (the panel 2 px off the recess's floor: its dark under it)
        if zh is not None:                              # (ref 12: the band its dark maroon, a dark line under it)
            zb = zh - 0.33 * H
            sheet(zb, z1, d + 0.25 * PAINT, "ochre", 1, "fNM0")
            sheet(zb - dz, zb, d + 0.25 * PAINT, "rose", 2, "fNS3")    # (a dark line under it: the user)
        return
    du, dz = RECESS / 32, RECESS / 39.19
    u0, u1 = (a + du, b) if ax == "y" else (a, b - du)
    T.paint(k, ax, plane, u0, u1, c, e - dz, 0.75 * PAINT, F, 0)                                       # the panel
    if zh is not None:
        T.paint(k, ax, plane, u0, u1, max(c, zh - 0.33 * H), e - dz, PAINT, "ochre", 1)                # its band


def navy_band(k, ax, plane, a, b, ends, zh, H):
    """The maroon band under the header (on a cover or strip: navy.py calls it for each)."""
    T.run(k, ax, plane, a, b, ends, zh - 0.33 * H, zh, BAND, "ochre", 3, 0)


def navy_thin_band(k, ax, plane, a, b, ends, zh, H):
    """T1-6: no recess; 3 px of the maroon band under the header, a 3 px stripe under it, its foot on the normal
    band's (the strip's red), grey between (the user)."""
    dz = 1 / 39.19
    T.run(k, ax, plane, a, b, ends, zh - 5 * dz, zh, BAND, "ochre", 3, 0)            # (3 px seen: the header's
    T.run(k, ax, plane, a, b, ends, zh - 0.33 * H, zh - 0.33 * H + 3 * dz, BAND, "ochre", 3, 0)   # overhang hides 2;
    #   the stripe 3 px: the user)


navy_band.reds = ((0.33, 0.0),)             # (its red, as fractions of H under the header: the panel line's lit px
navy_thin_band.reds = ((0.18, 0.0), (0.33, 0.30))   # in its tone over them, navy.py)


def navy_pipes(plate, u0, u1, run_, k=None, pt=None, P=None, zs=0.0, hole=None, ax=0, plane=0.0, **_):
    """B1-2: the ramp's cover off over the hole the shell leaves (its "ramp_hole"): a dark navy recess, its bottom
    parallel to the ramp, two pipes across it in the header tube's orange (a quarter and three down it), a thin
    silver one between them. (A ramp fill's arguments, wall3d.skirt:
    plate lays a plate on the slope, pt(u, d, rise) is a point on it, P(u, z, d) any point, d out from the wall.)"""
    if hole:
        o0, o1, d0, d1 = hole
        sh = getattr(T.SHELL, "_zsurf", None) if T.ramp_fall() else None
        zat = sh or (lambda d: zs * (1 - d / run_))     # noqa: E731   the ramp's height d out (a look's own fall:
        fall = T.ramp_fall() or zs / run_               # the shell's, over the shelf flat) and its slope's fall
        f = 0.02
        up, out_, along = Vector((0, 0, 1)), P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
        db = d0 + 0.006                                 # (a hair in front of the shell's own hole back: on it they
                                                        # fought, specks of its tone through ours)
        rp = 0.06
        cs = math.cos(math.atan(fall))                  # (depths into the slope: square to it, so straight down
        h = (2 * rp + 0.035) / cs                       # they're / cs; on a steep one a plain h buried the pipes)
        dr = (T.style().shelf + run_) / 2               # its back: a plane parallel to the slope's face, h under it
        A = zat(dr) + dr * fall                         # (the slope's line run on up under the shelf: z = A - fall d)
        zb = lambda d: A - fall * d - h                 # noqa: E731
        R, K = getattr(T.SHELL, "run", run_), 32 / 39.19   # (under the floor: cut along the line that lies behind
        zc = lambda d: -K * (R - d)                     # noqa: E731   the foot's bottom edge on screen, so none of it
        dk = min(d1, (A - h + K * R) / (fall + K))      # shows under the foot)
        prof = [(db, zat(db)), (db, zb(db)), (dk, zb(dk)), (d1, zc(d1))]   # its section: a short back, the plane
        for (da, za), (dbb, zbb) in zip(prof, prof[1:]):
            if dbb - da < 1e-6 and abs(zbb - za) < 1e-6:
                continue
            n = out_ if dbb - da < 1e-6 else up * (dbb - da) + out_ * (za - zbb)
            k.poly([P(o0, za, da), P(o1, za, da), P(o1, zbb, dbb), P(o0, zbb, dbb)], "wall", 0, n,
                   fixed=CAV[1])                        # (all in the dark back's tone: the user)
        for u, sg in ((o0, 1), (o1, -1)):                                                                # and sides
            side = [P(u, z_, d_) for d_, z_ in prof] + [P(u, zat(d1), d1)] + [P(u, zat(dd_), dd_) for dd_ in (dk, db)]
            k.poly(side, "rose", 2, along * sg, fixed=CAV[2])
        dp, sn = rp + 0.015, math.sin(math.atan(fall))              # sunk a radius and a bit into the slope,
        s0 = max(d0, T.style().shelf)                               # (on the slope: the opening cut back into
        dt = min(d1, run_ - 0.03)                                   # (over the slope, not the toe the slot opens)
        px = 1 / (16 + 39.19 * fall)                                # one screen px down the slope, in d
        f0 = s0 + 0.3 * (dt - s0)                                   # (the shelf is flat: rows on the slope,
        feet = [f0 - px, d1 - 0.015]                                # square to it; the top one up a px, the
        #   lower one down by the foot, room for the silver pipe between: the user)
        rows = [dd - sn * dp for dd in feet]                         # towards the toe, the lower one under it)
        zp = [zat(dd) - cs * dp for dd in feet]                      # (two rows down the opened cover)
        for dd, zc in zip(rows, zp):                                        # the pipes, lit like the header tube
            tube(k, ax, plane, o0 - 0.005, o1 + 0.005, dd, zc, rp)           # (ends in the side walls)
        rs = 0.03
        fs = (f0 + feet[1]) / 2 + px                                        # a thin silver pipe between them,
        ds, zs_ = fs - sn * (rs + 0.04), zat(fs) - cs * (rs + 0.04)         # a little deeper
        prof, cols = tube_prof(ds, zs_, rs)
        prism(k, ax, plane, o0 - 0.005, o1 + 0.005, prof, "wall", 0, [SILVER[c] for c in cols], "fNW4")
        w, rw = o1 - o0, rp + 0.006                    # steel straps, flat 2 px and one tone (jagged as lit bars),
        nd, nz, td, tz = sn, cs, cs, -sn               # over the pipes and the silver one, from past the lower pipe up
        for u in (o0 + w / 3, o0 + 2 * w / 3):         # and round the top of the upper one (wrapped: the user)
            ub = round(u * 32) / 32
            pts = [(rows[1] + nd * rw + td * (rp + 0.005), zp[1] + nz * rw + tz * (rp + 0.005))]
            for i_ in range(7):                         # from the front of the upper pipe round over its top (0..150°)
                a = math.radians(150 * i_ / 6)
                pts.append((rows[0] + rw * (nd * math.cos(a) - td * math.sin(a)),
                            zp[0] + rw * (nz * math.cos(a) - tz * math.sin(a))))
            for (da, za), (db_, zb_) in zip(pts, pts[1:]):
                k.poly([P(ub - 1 / 32, za, da), P(ub + 1 / 32, za, da), P(ub + 1 / 32, zb_, db_),
                        P(ub - 1 / 32, zb_, db_)], "wall", 0, P(0, cs, sn) - P(0, 0, 0), fixed="fSH0")


SILVER = {"fxO": "fNW3", "orL": "fNW4", "orM": "fNW6"}  # the tube's tones in navy's steel greys
CAV = ("fNC0", "fNC1", "fNC0")                          # the open ramp's floor, back, sides: dark navy, flat (kept
                                                        # exact: edge AA blended them into a grey speckle)


SPLIT_D = 1.2 / 39.19                # the split plates sunk a px into the slope (the user)
SPLIT_BACK = 0.1                     # their hole back over the shelf's top and on through the toe (the shelf's top and the
                                     # whole red band sunk with them: the user)


def navy_split(plate, u0, u1, run_, k=None, P=None, zs=0.0, ax="y", fam="wall", hole=None, **_):
    """B1-3 (ref 03): two darker plates split down the middle, sunk a px into the ramp over the hole the shell leaves
    (its "ramp_hole": the field from over the shelf down through the toe): the ramp's own profile a px lower, in thin
    strips (the shelf's flat top a shade lighter than the slope, the red band on them a level darker), walls round
    the cut up to the ramp. Without the hole (a plain slope): two plates on it, 0.04 .. 0.66 of the run."""
    g = LINE / 2
    if not hole:
        uc = (u0 + u1) / 2
        for p0, p1 in ((u0 + 0.04, uc - g), (uc + g, u1 - 0.04)):
            plate([(p0, 0.04), (p1, 0.04), (p1, 0.66 * run_), (p0, 0.66 * run_)], PAINT, 1, 0.0)
        return
    o0, o1, d0, d1 = hole
    uc, db, sh = (o0 + o1) / 2, T.style().toe_at * run_, T.style().shelf
    zat = (getattr(T.SHELL, "_zsurf", None) if T.ramp_fall() else None) or (lambda d: zs * (1 - d / run_))  # noqa
    up, out_, along = Vector((0, 0, 1)), P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
    n = 48
    ds = sorted({d0, d1, sh, db} | {d0 + (d1 - d0) * i / n for i in range(n + 1)})
    ds = [d for d in ds if d0 - 1e-9 <= d <= d1 + 1e-9]
    zf = lambda d: zat(d) - SPLIT_D                    # noqa: E731   the sunk floor: the ramp's profile a px down
    grey = ("fNW4", "fNW5") if ax == "y" else ("fNW5", "fNW6")         # (shelf top, slope: a shade darker: the user)
    for da, dbb in zip(ds, ds[1:]):
        za, zb = zf(da), zf(dbb)
        nrm = up * (dbb - da) + out_ * (za - zb)
        dm = (da + dbb) / 2
        for p0, p1 in ((o0, uc - g), (uc + g, o1)):
            quad = [P(p0, za, da), P(p1, za, da), P(p1, zb, dbb), P(p0, zb, dbb)]
            if dm >= db:
                k.poly(quad, "ochre", 1, nrm)
            else:
                k.poly(quad, fam, 0, nrm, fixed=grey[0] if dm < sh else grey[1])
        k.poly([P(uc - g, za, da), P(uc + g, za, da), P(uc + g, zb, dbb), P(uc - g, zb, dbb)], fam, 0, nrm,
               fixed="fNW7")                           # (the seam between them)
        for u, sg in ((o0, 1), (o1, -1)):              # the cut's side walls, up to the ramp
            k.poly([P(u, zat(da), da), P(u, zat(dbb), dbb), P(u, zb, dbb), P(u, za, da)], fam, 0, along * sg)
    k.poly([P(o0, zat(d0), d0), P(o1, zat(d0), d0), P(o1, zf(d0), d0), P(o0, zf(d0), d0)], fam, 0, out_)  # back


NAVY_TOPS = (Design("plain"), Design("control boxes", middle=navy_boxes, face_holes=lipped_holes), Design("lockers", middle=navy_lockers, face_holes=lipped_holes),
             # Design("cage", middle=navy_cage, face_holes=cover_holes),   # (refs 10-11: off for now, not working
             #   yet: the user; its code kept)
             Design("recessed", middle=navy_recessed, face_holes=lipped_holes), Design("thin band", band=navy_thin_band))
NAVY_RAMPS = (Design("plates"), Design("pipes", ramp=navy_pipes, ramp_hole=(2 / 32, 1.0, 0.0)),
              Design("split plates", ramp=navy_split, ramp_hole=(SPLIT_BACK, 1.0, 0.0)))
