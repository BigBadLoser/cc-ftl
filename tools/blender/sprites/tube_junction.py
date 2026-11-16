"""The prefab base tube's junction, inboard (issue #508, study): where the tube (tube_study) comes through a module's wall,
the three wall tiles round its door (the door tile and one either side) are one piece in place of the room's walls: a
block a tile deep: two ribs at its ends where it meets the room's walls (their section the walls' own: the skirt's
ramp, then upright at the walls' face), the middle between them sunk to half a tile with a flat face and the floor
run in to it; the tube's own section through it (round, flat at the floor), a raised frame round that opening on the
sunk face, and the hatch: one leaf the opening's shape
that slides straight down into the floor (tube_hatch's look is retired; an iris needs a round opening).

Frame as tube_port's _builder (d out from the wall tiles' middle line toward the tube, r along the wall, z up); its
origin the door tile's centre. Only o 8 (a wall facing -x: the junction's room face toward the camera) for now. The
outboard block (tube_port) stands against its outer face."""
import math

from . import core
from . import tube_port as P

W = 1.5                                  # half width along the wall: three tiles
H = P.ZT                                 # its top: the outboard block's (so the two meet flush)
ZC, R = P.AXIS, P.RS                     # the opening: the tube's section (round, cut flat at the floor)
FRAME = (0.13, 0.09)                     # the room face's frame round the opening: width, stand off
LAMP = (0.86, 1.73)                      # the lamps' (r, z) on the sunk face: over the frame's shoulders
RIB = 0.25                               # the end ribs' width along the wall
WM = W - RIB                             # the sunk middle's half width
DM = 0.0                                 # the sunk middle's face (d; the room is at -d): half a tile deep
LEAF_T = 0.06                            # the hatch leaf's half thickness (in a slot behind the sunk face)
LEAF_D = (DM + 0.5) / 2                  # the slot's middle
LEAF_R = R + 0.05                        # its radius (its edge in the slot, past the opening)
N = 40


def _ends(r):
    """(t0, t1): the arc of a circle of radius r round the axis that is over the floor (ccw, over the top)."""
    t = math.asin(max(-1.0, -ZC / r))
    return t, math.pi - t


def _rect(c, s, w=W):
    """Where a ray from the axis at (c, s) leaves a face's rectangle (half width w), as (r, z)."""
    t = min(w / abs(c) if abs(c) > 1e-9 else math.inf,
            (H - ZC) / s if s > 1e-9 else ZC / -s if s < -1e-9 else math.inf)
    return c * t, ZC + s * t


def _angles(r, w=W):
    t0, t1 = _ends(r)
    ts = {t0 + (t1 - t0) * i / N for i in range(N + 1)}
    for zc in (0.0, H):                                  # (the rectangle's corners, so its edges stay straight)
        for rc in (-w, w):
            a = math.atan2(zc - ZC, rc)
            while a < t0:
                a += math.tau
            if a <= t1:
                ts.add(a)
    return sorted(ts)


def _arc(r, t):
    return r * math.cos(t), ZC + r * math.sin(t)


def _rib_profile():
    """The ribs' section (d, z): the outer face, then the room walls' own profile (walls: the skirt's foot and ramp from
    the tile's edge up to the walls' face, upright from there to the top)."""
    from . import doors as D, walls as WL
    vw = D.planes()[1]                                   # (the walls' face, from the tile's middle line)
    foot = WL.FOOT_PX / WL.ZART
    return [(0.5, 0.0), (-0.5, 0.0), (-0.5, foot), (-vw, WL.skirt_top()), (-vw, H), (0.5, H)]


def block(b):
    """The block: the two ribs, the sunk middle's face and the outer face round the opening, the opening's walls and
    floor, the middle's top, the floor run in to the sunk face."""
    for r0, r1 in ((-W, -WM), (WM, W)):
        b.prism(_rib_profile(), r0, r1)
    for d, n, w in ((DM, (-1, 0, 0), WM), (0.5, (1, 0, 0), W)):
        ts = _angles(R, w)
        for t0, t1 in zip(ts, ts[1:]):
            (r0, z0), (r1, z1) = _rect(math.cos(t0), math.sin(t0), w), _rect(math.cos(t1), math.sin(t1), w)
            b.face([(d, *_arc(R, t0)), (d, r0, z0), (d, r1, z1), (d, *_arc(R, t1))], n)
    ts = _angles(R, WM)
    for t0, t1 in zip(ts, ts[1:]):
        c, s = math.cos((t0 + t1) / 2), math.sin((t0 + t1) / 2)
        b.face([(DM, *_arc(R, t0)), (0.5, *_arc(R, t0)), (0.5, *_arc(R, t1)), (DM, *_arc(R, t1))], (0, -c, -s),
               P.RAMP[0])
    c = math.sqrt(R * R - ZC * ZC)
    b.face([(LEAF_D, -c, 0.002), (0.5, -c, 0.002), (0.5, c, 0.002), (LEAF_D, c, 0.002)], (0, 0, 1), "tbDeck")
    d0, d1 = DM - FRAME[1], LEAF_D                        # the threshold to the leaf, in hazard blocks
    b.face([(d0, -c, 0.003), (d1, -c, 0.003), (d1, c, 0.003), (d0, c, 0.003)], (0, 0, 1), "tbIn")
    k = 7                                                 # (blocks square to the grid: their edges draw clean)
    for i in range(0, k, 2):
        r0, r1 = -c + 2 * c * i / k, -c + 2 * c * (i + 1) / k
        q = [(d0, r0), (d0, r1), (d1, r1), (d1, r0)]
        b.face([(d, r, 0.004) for d, r in q], (0, 0, 1), "tbAmb")
    b.face([(-0.5, -WM, 0.002), (DM, -WM, 0.002), (DM, WM, 0.002), (-0.5, WM, 0.002)], (0, 0, 1), "tbDeckD")
    b.face([(DM, -WM, H), (0.5, -WM, H), (0.5, WM, H), (DM, WM, H)], (0, 0, 1))


def frame(b):
    """The raised frame round the opening on the room face (light face, dark outer lip), an amber band inside it, two
    lamps in hooded housings beside it, bolts along it."""
    w, h = FRAME
    d = DM - h
    t0, t1 = _ends(R)
    arc = [t0 + (t1 - t0) * i / N for i in range(N + 1)]
    for a0, a1 in zip(arc, arc[1:]):
        for ra, rb, col in ((R, R + w - 0.03, P.RAMP[5]), (R + w - 0.03, R + w, "steelD")):
            q0a, q0b = _arc(ra, a0), _arc(rb, a0)
            q1a, q1b = _arc(ra, a1), _arc(rb, a1)
            if min(q0a[1], q0b[1], q1a[1], q1b[1]) < 0:
                continue
            b.face([(d, *q0a), (d, *q0b), (d, *q1b), (d, *q1a)], (-1, 0, 0), col)
        c, s = math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2)
        p0, p1 = _arc(R + w, a0), _arc(R + w, a1)
        if min(p0[1], p1[1]) >= 0:
            b.face([(DM, *p0), (d, *p0), (d, *p1), (DM, *p1)], (0, c, s))           # (toned by facing: it stands off)
        p0, p1 = _arc(R, a0), _arc(R, a1)
        b.face([(DM, *p0), (d, *p0), (d, *p1), (DM, *p1)], (0, -c, -s), "tbAmb")
    for s in (-1, 1):                                    # lamps beside the frame's shoulders, in housings
        r, z = s * LAMP[0], LAMP[1]
        hw, hh = 0.1, 0.06
        _raise(b, [(r - hw, z - hh), (r + hw, z - hh), (r + hw, z + hh), (r - hw, z + hh)], DM, 0.05, "tbRib")
        _raise(b, [(r - hw + 0.025, z - hh + 0.02), (r + hw - 0.025, z - hh + 0.02), (r + hw - 0.025, z + hh - 0.025),
                   (r - hw + 0.025, z + hh - 0.025)], DM - 0.05, 0.01, "tbLamp")
        _raise(b, [(r - hw - 0.02, z + hh), (r + hw + 0.02, z + hh), (r + hw + 0.02, z + hh + 0.03),
                   (r - hw - 0.02, z + hh + 0.03)], DM, 0.09, "tbRib")       # (a hood over it)
    for i in range(9):                                   # bolts along the frame
        t = t0 + (t1 - t0) * (i + 0.5) / 9
        r, z = _arc(R + w / 2 - 0.015, t)
        if z > 0.08:
            P.HE._box(b, d, r, z, -0.015)


def _side(n):
    """A raised part's side tone by its outward normal (r, z): lit from above, dark under, mid at the sides."""
    r, z = n
    return "tbRibL" if z > 0.5 * abs(r) else "tbRib" if z < -0.5 * abs(r) else "tbHullD"


def _raise(b, poly, d, h, front, sides=None):
    """A part standing h proud (toward the room, -d) of a face at d: its front, and the side faces round `poly` ((r, z),
    ccw seen from the room) but those in `sides` (None: all), each toned by facing."""
    b.face([(d - h, r, z) for r, z in poly], (-1, 0, 0), front)
    n = len(poly)
    cr, cz = sum(r for r, _ in poly) / n, sum(z for _, z in poly) / n
    for i in range(n):
        if sides is not None and i not in sides:
            continue
        (r0, z0), (r1, z1) = poly[i], poly[(i + 1) % n]
        nr, nz = z1 - z0, -(r1 - r0)
        if nr * ((r0 + r1) / 2 - cr) + nz * ((z0 + z1) / 2 - cz) < 0:
            nr, nz = -nr, -nz
        b.face([(d, r0, z0), (d - h, r0, z0), (d - h, r1, z1), (d, r1, z1)], (0, nr, nz), _side((nr, nz)))


def _ring(b, d, h, ra, rb, zc, front, n=32, inner=True, outer=True):
    """A raised ring (radii ra..rb round (0, zc)) h proud of a face at d, with its inner and outer side faces."""
    a = [math.tau * i / n for i in range(n + 1)]
    for a0, a1 in zip(a, a[1:]):
        q = [(ra * math.cos(a0), zc + ra * math.sin(a0)), (rb * math.cos(a0), zc + rb * math.sin(a0)),
             (rb * math.cos(a1), zc + rb * math.sin(a1)), (ra * math.cos(a1), zc + ra * math.sin(a1))]
        b.face([(d - h, r, z) for r, z in q], (-1, 0, 0), front)
        c, s = math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2)
        for rr, sg, on in ((rb, 1, outer), (ra, -1, inner)):
            if on:
                p0, p1 = (rr * math.cos(a0), zc + rr * math.sin(a0)), (rr * math.cos(a1), zc + rr * math.sin(a1))
                b.face([(d, *p0), (d - h, *p0), (d - h, *p1), (d, *p1)], (0, sg * c, sg * s), _side((sg * c, sg * s)))


def leaf(b, t):
    """The hatch leaf, `t` (0 closed .. 1 open) of its way down into the floor: a slab the opening's shape with relief on
    its room face: a raised rim round its visible edge, a boss in the middle with the viewport sunk in it, locking bars
    out from the boss to the rim, a kick plate along its foot."""
    dz = -t * (ZC + LEAF_R + 0.05)
    t0, t1 = _ends(LEAF_R)
    arc = [t0 + (t1 - t0) * i / N for i in range(N + 1)]
    pts = [(r, z + dz) for r, z in (_arc(LEAF_R, a) for a in arc)]
    f = LEAF_D - LEAF_T
    for d, n in ((f, (-1, 0, 0)), (LEAF_D + LEAF_T, (1, 0, 0))):
        b.face([(d, r, z) for r, z in pts], n, "tbHull")
    for (ra, za), (rb, zb) in zip(pts, pts[1:] + pts[:1]):
        b.face([(f, ra, za), (LEAF_D + LEAF_T, ra, za), (LEAF_D + LEAF_T, rb, zb), (f, rb, zb)],
               (0, ra + rb, za + zb - 2 * (ZC + dz)), "tbHullD")
    zc = ZC + dz
    ri, ro = R - 0.13, R + 0.02                           # the rim (its outer edge in the slot)
    e0, e1 = _ends(ri)
    a = [e0 + (e1 - e0) * i / N for i in range(N + 1)]
    for a0, a1 in zip(a, a[1:]):
        q = [(ri * math.cos(a0), zc + ri * math.sin(a0)), (ro * math.cos(a0), zc + ro * math.sin(a0)),
             (ro * math.cos(a1), zc + ro * math.sin(a1)), (ri * math.cos(a1), zc + ri * math.sin(a1))]
        _raise(b, q, f, 0.03, "tbHullD", sides=(3,))       # (a step darker than the leaf: its edge reads)
    bz = zc + 0.06                                        # the boss (the lightest), the viewport sunk in it
    for s in (-1, 1):                                     # locking bars from the boss to the rim (under the boss)
        r0, r1 = s * 0.3, s * (ri + 0.01)
        q = [(min(r0, r1), bz - 0.07), (max(r0, r1), bz - 0.07), (max(r0, r1), bz + 0.07), (min(r0, r1), bz + 0.07)]
        _raise(b, q, f, 0.04, "tbRib")
    _ring(b, f, 0.075, 0.21, 0.44, bz, "tbSoft")
    _ring(b, f, 0.03, 0.0, 0.21, bz, "tbIn", outer=False, inner=False)      # (the sleeve's floor, under the glass)
    g = [math.tau * i / 24 for i in range(24)]
    b.face([(f - 0.035, 0.19 * math.cos(x), bz + 0.19 * math.sin(x)) for x in g], (-1, 0, 0), "tbGlass")
    b.face([(f - 0.036, -0.1 + 0.05 * math.cos(x), bz + 0.08 + 0.035 * math.sin(x)) for x in g], (-1, 0, 0),
           "tbGlassL")                                    # (a glint)
    w = lambda z: math.sqrt(max(0.0, ri * ri - (ZC - z) ** 2)) - 0.03   # noqa: E731 (the rim's inside at height z)
    z0, z1 = 0.02, 0.24                                   # the kick plate (its sides along the rim)
    _raise(b, [(-w(z0), dz + z0), (w(z0), dz + z0), (w(z1), dz + z1), (-w(z1), dz + z1)], f, 0.03, "tbIn")


def piece(o=8, t=0.0, at=(0.0, 0.0)):
    """The junction's objects, its door tile's centre at grid offset `at` from the sprite's origin."""
    out = []
    for name, fn in (("block", lambda b: (block(b), frame(b))), ("leaf", lambda b: leaf(b, t))):
        b = P._builder(o, f"tube_junction_{name}")
        fn(b)
        ob = P.clip_ground(b.m.build())
        ob.location = ob.location + core.G(at[0], at[1], 0.0)
        out.append(ob)
    return out
