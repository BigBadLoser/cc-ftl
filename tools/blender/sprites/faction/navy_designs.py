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


def _box(k, ax, plane, u0, u1, z0, z1, d, cols, ch=0.0):
    """A box standing d proud, its top and foot chamfered ch, its faces in fixed colours (cols: foot, front, top;
    its ends the foot's)."""
    prism(k, ax, plane, u0, u1, [(0.0, z0), (d, z0 + ch), (d, z1 - ch), (0.0, z1)], "wall", 0,
          cols=[cols[0], cols[1], cols[2], cols[0]], cap=cols[0])


def navy_boxes(k, ax, plane, a, b, c, e, F):
    """Two control boxes (T1-2): light bezels, dark windows packed with red and cream parts and small lights."""
    zm = (c + e) / 2
    a, b = a + 0.06, b - 0.06
    for q0, q1 in ((c + 0.02, zm - 0.02), (zm + 0.02, e - 0.02)):
        T.slab(k, ax, plane, a, b, q0, q1, PX, F, 3)                                                     # bezel
        w0, w1, v0, v1 = a + 0.04, b - 0.04, q0 + 0.04, q1 - 0.04
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


def navy_lockers(k, ax, plane, a, b, c, e, F):
    """T1-3: one tall red locker in the opening (the ref's), chamfered, a lid notch at its top."""
    uc = (a + b) / 2
    _box(k, ax, plane, a, b, c, e, 2 * PX, ("lvR2", "lvR", "drM"), ch=PX)
    flat(k, ax, plane, a + 0.04, uc - 0.04, e - 0.08, e - 0.055, 2 * PX + PAINT, "lvR2")


def navy_band(k, ax, plane, a, b, ends, zh, H):
    """The maroon band under the header (on a cover or strip: navy.py calls it for each)."""
    T.run(k, ax, plane, a, b, ends, zh - 0.33 * H, zh, BAND, "ochre", 3, 0)


def navy_thin_band(k, ax, plane, a, b, ends, zh, H):
    """T1-6: no recess; the maroon band thinner, a thin stripe under it."""
    T.run(k, ax, plane, a, b, ends, zh - 0.18 * H, zh, BAND, "ochre", 3, 0)
    T.run(k, ax, plane, a, b, ends, zh - 0.28 * H, zh - 0.25 * H, BAND, "ochre", 3, 0)


navy_band.reds = ((0.33, 0.0),)             # (its red, as fractions of H under the header: the panel line's lit px
navy_thin_band.reds = ((0.18, 0.0), (0.28, 0.25))   # in its tone over them, navy.py)


def navy_pipes(plate, u0, u1, run_, k=None, pt=None, P=None, zs=0.0, hole=None, ax=0, plane=0.0, **_):
    """B1-2: the ramp's cover off over the hole the shell leaves (its "ramp_hole"): a dark navy recess, its bottom
    parallel to the ramp, two pipes across it in the header tube's orange (a quarter and three down it), a thin
    silver one between them, flat steel straps over them. (A ramp fill's arguments, wall3d.skirt:
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
        w = o1 - o0
        lift = dp + 0.003                              # steel straps over the pipes, flat across (not dipping
        #   between them, over the silver pipe, no collars: the user)
        for u in (o0 + w / 3, o0 + 2 * w / 3):
            ub = round(u * 32) / 32                    # flat steel straps, 2 px wide and one tone (a bar's lit top and
            e = [(rows[i_] + sn * lift + g * cs * (rp + 0.005), zp[i_] + cs * lift - g * sn * (rp + 0.005))
                 for i_, g in ((0, -1), (1, 1))]       # dark side made them jagged; across the pipes, past them: the user)
            k.poly([P(ub - 1 / 32, e[0][1], e[0][0]), P(ub + 1 / 32, e[0][1], e[0][0]),
                    P(ub + 1 / 32, e[1][1], e[1][0]), P(ub - 1 / 32, e[1][1], e[1][0])], "wall", 0,
                   P(0, cs, sn) - P(0, 0, 0), fixed="fSH0")


SILVER = {"fxO": "fNW3", "orL": "fNW4", "orM": "fNW6"}  # the tube's tones in navy's steel greys
CAV = ("fNC0", "fNC1", "fNC0")                          # the open ramp's floor, back, sides: dark navy, flat (kept
                                                        # exact: edge AA blended them into a grey speckle)


def navy_split(plate, u0, u1, run_, ax="y", fam="wall", **_):
    """B1-3: two darker plates split down the middle, on the slope (a look's own fall: from its shelf's edge down to
    a px over the red band, a shade under the slope's plates (fNW3 / fNW4 on the y / x face), else 0.04 .. 0.66 of
    the run, a level under them)."""
    uc = (u0 + u1) / 2
    own = T.ramp_fall()
    d0, d1 = (T.style().shelf, T.style().toe_at * run_ - LINE) if own else (0.04, 0.66 * run_)
    fx = ("fNW4" if ax == "y" else "fNW5") if own and fam == "wall" else None
    for p0, p1 in ((u0 + 0.04, uc - LINE / 2), (uc + LINE / 2, u1 - 0.04)):
        plate([(p0, d0), (p1, d0), (p1, d1), (p0, d1)], PAINT, 1, 0.0, fixed=fx)


NAVY_TOPS = (Design("plain"), Design("control boxes", middle=navy_boxes), Design("lockers", middle=navy_lockers),
             Design("thin band", band=navy_thin_band))
NAVY_RAMPS = (Design("plates"), Design("pipes", ramp=navy_pipes, ramp_hole=(2 / 32, 1.0, 0.0)),
              Design("split plates", ramp=navy_split))
