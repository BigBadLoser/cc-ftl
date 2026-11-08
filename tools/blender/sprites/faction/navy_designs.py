"""Navy's straight-run designs (set 4): its tops fill the face's middle (each in a dark recess) or its band, its ramps
the ramp's panel. The face (navy.py) asks for its slots: "middle" (k, ax, plane, u0, u1, z0, z1, F: inside the recess),
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


def navy_recess(k, ax, plane, u0, u1, z0, z1, F, fill):
    """A navy face's middle (u0..u1 x z0..z1, from over its foot strip to under its header): a dark recess, a top
    design's fill inside it."""
    T.paint(k, ax, plane, u0, u1, z0, z1, 3 * PAINT, "rose", 1)                                      # the recess
    fill(k, ax, plane, u0 + 0.04, u1 - 0.04, z0 + 0.04, z1 - 0.04, F)                                # inside it


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
    """Two red lockers (T1-3), chamfered, a lid notch on the upper."""
    uc, zm = (a + b) / 2, (c + e) / 2
    for q0, q1 in ((c, zm - 0.015), (zm + 0.015, e)):
        _box(k, ax, plane, a, b, q0, q1, 2 * PX, ("lvR2", "lvR", "drM"), ch=PX)
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


def _steel(k, q, n, up):
    k.poly(q, "wall", 0, n, fixed="fSH0" if n.normalized().dot(up) > 0.5 else "fSH2")      # neutral steel


def _collar(k, P, u, d, z, r, hw, up, n=8):
    """A steel collar round a pipe (centre (d, z), radius r) from u - hw to u + hw."""
    ring = [(d + r * math.cos(2 * math.pi * i / n + math.pi / n), z + r * math.sin(2 * math.pi * i / n + math.pi / n))
            for i in range(n)]
    c = P(u, z, d)
    for i in range(n):
        (da, za), (db, zb_) = ring[i], ring[(i + 1) % n]
        q = [P(u - hw, za, da), P(u + hw, za, da), P(u + hw, zb_, db), P(u - hw, zb_, db)]
        _steel(k, q, sum(q, Vector()) / 4 - c, up)
    for s_ in (-1, 1):
        q = [P(u + s_ * hw, zz, dd) for dd, zz in ring]
        _steel(k, q, P(1, 0, 0) - P(0, 0, 0) if s_ > 0 else P(0, 0, 0) - P(1, 0, 0), up)


def _bar(k, P, u, d0, d1, zf, hw, ht, up):
    """A steel bar from d0 to d1 along the pipes' centre line (zf(d) its height), hw wide, ht thick each way."""
    out_, along = P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
    for zs_, n in ((ht, up), (-ht, -up)):
        _steel(k, [P(u - hw, zf(d0) + zs_, d0), P(u + hw, zf(d0) + zs_, d0), P(u + hw, zf(d1) + zs_, d1),
                   P(u - hw, zf(d1) + zs_, d1)], n + out_ * 0.3 * (1 if zs_ > 0 else -1), up)
    for s_ in (-1, 1):
        _steel(k, [P(u + s_ * hw, zf(d0) - ht, d0), P(u + s_ * hw, zf(d0) + ht, d0), P(u + s_ * hw, zf(d1) + ht, d1),
                   P(u + s_ * hw, zf(d1) - ht, d1)], along * s_, up)


def navy_pipes(plate, u0, u1, run_, k=None, pt=None, P=None, zs=0.0, hole=None, ax=0, plane=0.0, **_):
    """B1-2: the ramp's cover off over the hole the shell leaves (its "ramp_hole"): a dark navy recess, its bottom
    parallel to the ramp, two pipes across it in the header tube's orange (the top one up under the lip), a thin
    silver one behind and above the lower, steel brackets tying them. (A ramp fill's arguments, wall3d.skirt:
    plate lays a plate on the slope, pt(u, d, rise) is a point on it, P(u, z, d) any point, d out from the wall.)"""
    if hole:
        o0, o1, d0, d1 = hole
        sh = getattr(T.SHELL, "_zsurf", None) if T.ramp_fall() else None
        zat = sh or (lambda d: zs * (1 - d / run_))     # noqa: E731   the ramp's height d out (a look's own fall:
        fall = T.ramp_fall() or zs / run_               # the shell's, over the shelf flat) and its slope's fall
        f = 0.02
        up, out_, along = Vector((0, 0, 1)), P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
        db = d0 + 0.012                                 # (a hair in front of the shell's own hole back: on it they
                                                        # fought, specks of its tone through ours)
        h = 0.17                                        # its bottom parallel to the ramp, h under it (on the floor
        zb = lambda d: max(f, zat(d) - h)               # noqa: E731   where that would go under it)
        dk = next((db + (d1 - db) * i / 200 for i in range(201) if zat(db + (d1 - db) * i / 200) - h <= f), d1)
        #   (where the bottom meets the floor)
        prof = [(db, zat(db)), (db, zb(db)), (dk, zb(dk)), (d1, zb(d1))]   # its section: a short back, the bottom
        for (da, za), (dbb, zbb) in zip(prof, prof[1:]):
            if dbb - da < 1e-6 and abs(zbb - za) < 1e-6:
                continue
            n = out_ if dbb - da < 1e-6 else up * (dbb - da) + out_ * (za - zbb)
            k.poly([P(o0, za, da), P(o1, za, da), P(o1, zbb, dbb), P(o0, zbb, dbb)], "wall", 0, n,
                   fixed=CAV[1] if dbb - da < 1e-6 else CAV[0])
        for u, sg in ((o0, 1), (o1, -1)):                                                                # and sides
            side = [P(u, z_, d_) for d_, z_ in prof] + [P(u, zat(d1), d1)] + [P(u, zat(dd_), dd_) for dd_ in (dk, db)]
            k.poly(side, "rose", 2, along * sg, fixed=CAV[2])
        rp, rs = 0.06, 0.03
        dz = (rp + 0.025) / math.cos(math.atan(fall))                # sunk a radius and a bit under the slope
        rows = [d0 + fr * (d1 - d0) for fr in (0.12, 0.6)]
        zp = [zat(rows[0]) - rp - 0.005, zat(rows[1]) - dz]          # (the top one up under the lip)
        for dd, zc in zip(rows, zp):                                        # the pipes, lit like the header tube
            tube(k, ax, plane, o0 - 0.005, o1 + 0.005, dd, zc, rp)           # (ends in the side walls)
        ds = rows[1] - 0.06                                                 # a thin silver pipe behind and above
        prof, cols = tube_prof(ds, zp[1] + rp + 0.055, rs)                 # the lower one, clear of it
        prism(k, ax, plane, o0 - 0.005, o1 + 0.005, prof, "wall", 0, [SILVER[c] for c in cols], "fNW4")
        zf = lambda d: zp[0] + (zp[1] - zp[0]) * (d - rows[0]) / (rows[1] - rows[0])   # noqa: E731
        w = o1 - o0
        for u in (o0 + w / 3, o0 + 2 * w / 3):         # steel brackets: a collar round each pipe, a bar between them
            for dd, zc in zip(rows, zp):
                _collar(k, P, u, dd, zc, rp + 0.015, 0.03, up)
            _bar(k, P, u, rows[0], rows[1], zf, 0.02, 0.015, up)


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
NAVY_RAMPS = (Design("plates"), Design("pipes", ramp=navy_pipes, ramp_hole=(0.06, 0.9, 0.12)),
              Design("split plates", ramp=navy_split))
