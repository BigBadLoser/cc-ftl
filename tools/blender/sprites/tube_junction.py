"""The prefab base tube's junction, inboard (issue #508, study): where the tube (tube_study) comes through a module's wall,
the three wall tiles round its door (the door tile and one either side) are one piece in place of the room's walls: a
block a tile deep (no skirt ramp: the room's floor runs up to its face), the tube's own section through it (round,
flat at the floor), a raised frame round that opening on the room face, and the hatch: one leaf the opening's shape
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
FRAME = (0.12, 0.04)                     # the room face's frame round the opening: width, stand off
LEAF_T = 0.06                            # the hatch leaf's half thickness (in a slot mid-block)
LEAF_R = R + 0.05                        # its radius (its edge in the slot, past the opening)
N = 40


def _ends(r):
    """(t0, t1): the arc of a circle of radius r round the axis that is over the floor (ccw, over the top)."""
    t = math.asin(max(-1.0, -ZC / r))
    return t, math.pi - t


def _rect(c, s):
    """Where a ray from the axis at (c, s) leaves the room face's rectangle, as (r, z)."""
    t = min(W / abs(c) if abs(c) > 1e-9 else math.inf,
            (H - ZC) / s if s > 1e-9 else ZC / -s if s < -1e-9 else math.inf)
    return c * t, ZC + s * t


def _angles(r):
    t0, t1 = _ends(r)
    ts = {t0 + (t1 - t0) * i / N for i in range(N + 1)}
    for zc in (0.0, H):                                  # (the rectangle's corners, so its edges stay straight)
        for rc in (-W, W):
            a = math.atan2(zc - ZC, rc)
            while a < t0:
                a += math.tau
            if a <= t1:
                ts.add(a)
    return sorted(ts)


def _arc(r, t):
    return r * math.cos(t), ZC + r * math.sin(t)


def block(b):
    """The block: both faces round the opening, the opening's walls and floor, the top and the two ends."""
    ts = _angles(R)
    for d, n in ((-0.5, (-1, 0, 0)), (0.5, (1, 0, 0))):
        for t0, t1 in zip(ts, ts[1:]):
            (r0, z0), (r1, z1) = _rect(math.cos(t0), math.sin(t0)), _rect(math.cos(t1), math.sin(t1))
            b.face([(d, *_arc(R, t0)), (d, r0, z0), (d, r1, z1), (d, *_arc(R, t1))], n)
    for t0, t1 in zip(ts, ts[1:]):
        c, s = math.cos((t0 + t1) / 2), math.sin((t0 + t1) / 2)
        b.face([(-0.5, *_arc(R, t0)), (0.5, *_arc(R, t0)), (0.5, *_arc(R, t1)), (-0.5, *_arc(R, t1))], (0, -c, -s),
               P.RAMP[0])
    c = math.sqrt(R * R - ZC * ZC)
    b.face([(-0.5, -c, 0.002), (0.5, -c, 0.002), (0.5, c, 0.002), (-0.5, c, 0.002)], (0, 0, 1), "tbDeck")
    b.face([(-0.5, -W, H), (0.5, -W, H), (0.5, W, H), (-0.5, W, H)], (0, 0, 1))
    for r in (-W, W):
        b.face([(-0.5, r, 0.0), (0.5, r, 0.0), (0.5, r, H), (-0.5, r, H)], (0, r, 0))


def frame(b):
    """The raised frame round the opening on the room face (light face, dark outer lip), an amber band inside it, two
    lamps over it, bolts along it."""
    w, h = FRAME
    d = -0.5 - h
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
            b.face([(-0.5, *p0), (d, *p0), (d, *p1), (-0.5, *p1)], (0, c, s), "steelD")
        p0, p1 = _arc(R, a0), _arc(R, a1)
        b.face([(-0.5, *p0), (d, *p0), (d, *p1), (-0.5, *p1)], (0, -c, -s), "tbAmb")
    for s in (-1, 1):                                    # lamps either side over the frame
        t = math.pi / 2 - s * 0.55
        r, z = _arc(R + w + 0.12, t)
        b.face([(d - 0.005, r - 0.07, z - 0.03), (d - 0.005, r + 0.07, z - 0.03), (d - 0.005, r + 0.07, z + 0.03),
                (d - 0.005, r - 0.07, z + 0.03)], (-1, 0, 0), "tbLamp")
    for i in range(9):                                   # bolts along the frame
        t = t0 + (t1 - t0) * (i + 0.5) / 9
        r, z = _arc(R + w / 2 - 0.015, t)
        if z > 0.08:
            P.HE._box(b, d, r, z, -0.015)


def leaf(b, t):
    """The hatch leaf, `t` (0 closed .. 1 open) of its way down into the floor: a slab the opening's shape, its room face
    with a dark ring, a round viewport, a band across and hazard stripes along its foot."""
    dz = -t * (ZC + LEAF_R + 0.05)
    t0, t1 = _ends(LEAF_R)
    arc = [t0 + (t1 - t0) * i / N for i in range(N + 1)]
    pts = [_arc(LEAF_R, a) for a in arc]
    pts = [(r, z + dz) for r, z in pts]
    for d, n in ((-LEAF_T, (-1, 0, 0)), (LEAF_T, (1, 0, 0))):
        b.face([(d, r, z) for r, z in pts], n, "tbHull")
    for (ra, za), (rb, zb) in zip(pts, pts[1:] + pts[:1]):
        b.face([(-LEAF_T, ra, za), (LEAF_T, ra, za), (LEAF_T, rb, zb), (-LEAF_T, rb, zb)], (0, ra + rb, za + zb - 2 * (ZC + dz)),
               "tbHullD")
    f = -LEAF_T - 0.004
    for ra, rb, col in ((0.55, 0.62, "tbHullD"), (0.62, 0.66, "tbRibL")):     # the ring
        for a0, a1 in zip([math.tau * i / N for i in range(N)], [math.tau * (i + 1) / N for i in range(N)]):
            q = [_arc(ra, a0), _arc(rb, a0), _arc(rb, a1), _arc(ra, a1)]
            b.face([(f, r, z + dz) for r, z in q], (-1, 0, 0), col)
    vz = ZC + 0.18                                        # the viewport
    b.face([(f - 0.002, 0.16 * math.cos(a), vz + dz + 0.16 * math.sin(a)) for a in
            [math.tau * i / 16 for i in range(16)]], (-1, 0, 0), "tbGlass")
    for z0, z1 in ((ZC - 0.2, ZC - 0.12),):                                  # a band across
        b.face([(f, -0.55, z0 + dz), (f, 0.55, z0 + dz), (f, 0.55, z1 + dz), (f, -0.55, z1 + dz)], (-1, 0, 0), "tbAmb")
    c = math.sqrt(LEAF_R * LEAF_R - ZC * ZC)              # hazard stripes along its foot
    k, wd = 9, 2 * c / 9
    for i in range(k):
        r0 = -c + i * wd
        col = "tbAmb" if i % 2 == 0 else "tbIn"
        b.face([(f, r0, dz + 0.02), (f, r0 + wd, dz + 0.02), (f, r0 + wd + 0.08, dz + 0.16), (f, r0 + 0.08, dz + 0.16)],
               (-1, 0, 0), col)


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
