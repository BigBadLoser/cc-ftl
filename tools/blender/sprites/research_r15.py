"""Research companions, round 15 (x10, y10): between round 13 (every detail a block, the outline lumpy) and round 14
(a clean outline, but too plain). A handful of real shape moves (a sloped boom, consoles whose screens sit on a slope,
chamfered edges on the body and the housing), and every face carrying flush detail so nothing is a blank field.

  x10 dissection table: the sunk glass bed in one deck; two sloped consoles and a gauge block at the front edge; a
      column and a boom that angles down over the bed to an emitter head; an instrument rack at the foot
  y10 sample analyzer: a chamfered housing with a framed chamber window and a vented cap; the turntable deck with a
      sloped console; an angled pipette boom off the housing"""
import math

from .core import G as GV
from .modkit import K
from .research_kit import Bench
from .research_r13 import BROWN, CREAM, DARK, FP2, GL, NAVY, P, Z, blk, flat, glass
from .research_r14 import CRK, deck, dial, screen, side, top


def prism(k, axis, a0, a1, prof, ramp, slope=None):
    """A prism: prof swept a0..a1 along axis (axis 'u': prof in (v, z); 'v': prof in (u, z)). Each face takes the
    ramp colour for the way it turns: up -> top, toward the camera along v -> front, along u -> side; a face sloping up
    toward the camera takes `slope` (default the top colour)."""
    tc, fc, sc = ramp
    slope = slope or tc
    area = sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1]
               for i in range(len(prof)))
    if area < 0:
        prof = prof[::-1]

    def pt(a, p):
        u, v = (a, p[0]) if axis == "u" else (p[0], a)
        return GV(*k.p(u, v), p[1])
    cap0, cap1 = [pt(a0, p) for p in prof], [pt(a1, p) for p in prof]
    if axis == "u":
        k.m.poly(cap1, sc, flip=True)
        k.m.poly(cap0[::-1], sc, flip=True)
    else:
        k.m.poly(cap0, sc, flip=True)
        k.m.poly(cap1[::-1], fc, flip=True)
    n = len(prof)
    for i in range(n):
        p, q = prof[i], prof[(i + 1) % n]
        d0, d1 = q[0] - p[0], q[1] - p[1]
        L = math.hypot(d0, d1) or 1.0
        nz, na = -d0 / L, d1 / L
        if nz > 0.85:
            col = tc
        elif nz > 0.25 and na > 0:
            col = slope
        elif na > 0:
            col = fc if axis == "u" else sc
        else:
            col = sc
        a, b, c, d = pt(a0, p), pt(a1, p), pt(a1, q), pt(a0, q)
        k.m.poly([a, d, c, b] if axis == "u" else [a, b, c, d], col, flip=True)


def on_slope(k, u0, u1, A, B, t0, t1, col, off=0.004, t=0.004):
    """A flush strip on the slope A-B (a (v, z) line swept along u), from t0 to t1 along it."""
    a = (A[0] + (B[0] - A[0]) * t0, A[1] + (B[1] - A[1]) * t0)
    b = (A[0] + (B[0] - A[0]) * t1, A[1] + (B[1] - A[1]) * t1)
    dv, dz = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dv, dz)
    nv, nz = dz / L, -dv / L
    if nz < 0:
        nv, nz = -nv, -nz
    a = (a[0] + nv * off, a[1] + nz * off)
    b = (b[0] + nv * off, b[1] + nz * off)
    prism(k, "u", u0, u1, [a, b, (b[0] + nv * t, b[1] + nz * t), (a[0] + nv * t, a[1] + nz * t)], (col,) * 3)


def console(k, u0, u1, vb=P(9), vf=P(17), z0=Z(12), z1=Z(17), z2=Z(21), glyphs=((0.3, 0.45, 0.2, 0.5),
                                                                                 (0.55, 0.65, 0.2, 0.75))):
    """A console breaking the deck's front edge: its top slopes from z2 at the back down to z1 at vf; a framed dark
    screen on the slope with gold glyph rows (t0, t1 along the slope, a0, a1 across it)."""
    A, B = (vf, z1), (vb + P(1), z2)
    prism(k, "u", u0, u1, [(vb, z0), (vf, z0), A, B, (vb, z2)], CREAM, "resCrL")
    on_slope(k, u0 + P(1), u1 - P(1), A, B, 0.12, 0.88, "resCrD")
    on_slope(k, u0 + P(2), u1 - P(2), A, B, 0.2, 0.8, "resNvyD", off=0.008)
    w = u1 - u0
    for t0, t1, a0, a1 in glyphs:
        on_slope(k, u0 + P(2) + (w - P(4)) * a0, u0 + P(2) + (w - P(4)) * a1, A, B, t0, t1, GL, off=0.012)
    flat(k, u0 + P(1), u1 - P(1), vf, z0 + Z(1), z0 + Z(2), CRK)                         # a seam low on its front
    flat(k, u0 + P(1), u0 + P(3), vf, z0 + Z(3), z0 + Z(4), "resGold")                    # and a status light


def body(k):
    """The plinth, then a navy body whose top front edge is chamfered, its faces seamed and panelled flush."""
    blk(k, P(-29), P(29), P(-14), P(14), 0, Z(1), DARK)
    blk(k, P(-30), P(30), P(-15), P(15), Z(1), Z(5), BROWN)
    flat(k, P(-30), P(30), P(15), Z(4), Z(4) + Z(1) - 0.002, "resBrnL")
    for u in range(-26, 30, 8):
        flat(k, P(u), P(u + 1), P(15), Z(2), Z(4), "resBrnD")                             # plinth joints
    prism(k, "u", P(-28), P(28), [(P(-13), Z(5)), (P(14), Z(5)), (P(14), Z(10)), (P(12), Z(12)), (P(-13), Z(12))],
          NAVY, "resNvyL")
    for u in range(-24, 26, 12):
        flat(k, P(u), P(u + 9), P(14), Z(6), Z(9), "resNvyL")                             # panels, a lighter field
        flat(k, P(u + 1), P(u + 8), P(14) + 0.002, Z(7), Z(8), "resNvy")                  # with a groove,
        flat(k, P(u + 10), P(u + 11), P(14), Z(5), Z(10), "resNvyD")                      # a seam between them
    side(k, P(28), P(-11), P(-3), Z(6), Z(9), "resNvyL")
    side(k, P(28), P(1), P(9), Z(6), Z(9), "resNvyL")


# ---- x10: dissection table ------------------------------------------------------------------------------------------

def x10(layer):
    k = Bench(f"research_x10_{layer}", FP2)
    body(k)
    deck(k, P(-30), P(30), P(-18), P(23))
    glass(k, P(-18), P(23), P(-9), P(8), Z(17))
    for cu, cv in ((P(-18), P(-9)), (P(23), P(-9)), (P(-18), P(8)), (P(23), P(8))):
        top(k, cu - P(1), cu + P(1), cv - P(1), cv + P(1), Z(18), "resGold")             # clips at the bed's corners
    console(k, P(-12), P(-2))
    console(k, P(8), P(18), glyphs=((0.3, 0.42, 0.1, 0.4), (0.3, 0.42, 0.55, 0.9), (0.55, 0.68, 0.1, 0.65)))
    blk(k, P(0), P(6), P(10), P(16), Z(12), Z(19), CREAM)                                 # the gauge block
    flat(k, P(1), P(5), P(16), Z(13), Z(18), "resCrD")                                     # its gauge: a frame,
    flat(k, P(2), P(4), P(16) + 0.004, Z(14), Z(17), "resNvyD")                            # a dark face,
    k.box(P(3), P(16) + 0.01, Z(15), 0.012, 0.003, Z(2), GL, ry=0.6)                       # a lit needle
    top(k, P(1), P(5), P(12), P(13), Z(19), CRK)
    # the instrument rack at the foot: a low block, slots in its top, a lit tab
    blk(k, P(24), P(30), P(-8), P(7), Z(18), Z(21), CREAM)
    for v in (P(-6), P(-3), P(0), P(3)):
        top(k, P(25), P(29), v, v + P(1), Z(21), "resNvyD")
    side(k, P(30), P(-7), P(6), Z(19), Z(20), CRK)
    flat(k, P(25), P(27), P(7), Z(19), Z(20), "resGold")
    # the column and the boom: the boom rises off the column, runs right, and angles down over the bed to its head
    blk(k, P(-29), P(-19), P(-14), P(-4), Z(18), Z(32), CREAM)
    flat(k, P(-28), P(-20), P(-4), Z(19), Z(20), CRK)
    screen(k, P(-27), P(-21), P(-4), Z(22), Z(29), rows=((1, 2, 5), (1, 3, 3), (1, 2, 1)))
    side(k, P(-19), P(-12), P(-6), Z(20), Z(30), "resCrD")                                 # a recessed panel on its end
    side(k, P(-19), P(-11), P(-7), Z(21), Z(29), CRK)
    boom = [(P(-29), Z(31)), (P(-29), Z(38)), (P(-8), Z(38)), (P(2), Z(33)), (P(2), Z(29)), (P(-6), Z(29)),
            (P(-13), Z(33)), (P(-19), Z(33)), (P(-19), Z(31))]
    prism(k, "v", P(-9), P(-1), boom, CREAM, "resCrL")
    top(k, P(-28), P(-9), P(-6), P(-4), Z(38), "resCrL")                                   # a lit ridge,
    flat(k, P(-28), P(-9), P(-1), Z(35), Z(36), CRK)                                       # seams and lights on its face,
    flat(k, P(-3), P(1), P(-1), Z(30), Z(31), CRK)
    for u in (P(-24), P(-20), P(-16)):
        flat(k, u, u + P(2), P(-1), Z(36) + Z(0.5), Z(37), GL)
    blk(k, P(-4), P(2), P(-8), P(-2), Z(26), Z(29), ("steelL", "steel", "steelD"))       # the head under its end,
    top(k, P(-3), P(1), P(-7), P(-3), Z(26) - 0.006, "resGold")                          # the emitter
    return k.build()


def x10_holo():
    k = K("research_x10_holo", FP2, 0)
    k.box(P(-1), P(-0.5), Z(17), 0.012, P(16), Z(9), "resGoldF")                          # the scan plane, faint
    k.box(P(-1), P(-0.5), Z(17), 0.03, P(16), 0.012, "resGold")
    return k


# ---- y10: sample analyzer -------------------------------------------------------------------------------------------

def y10(layer):
    k = Bench(f"research_y10_{layer}", FP2)
    body(k)
    deck(k, P(-8), P(30), P(-2), P(24))
    tu = P(11)
    k.cyl(tu, 0.0, Z(14), 0.3, 0.006, "resCrD", sides=28)
    k.cyl(tu, 0.0, Z(14) + 0.006, 0.26, 0.004, "resCrM", sides=28)
    k.cyl(tu, 0.0, Z(14) + 0.01, 0.06, 0.004, CRK, sides=12)
    for i in range(10):
        a = i * math.tau / 10
        k.cyl(tu + 0.2 * math.cos(a), 0.2 * math.sin(a), Z(14) + 0.01, 0.03, 0.004, "resNvyD", sides=8)
    glass(k, P(-2), P(24), P(-9), P(8), Z(17))
    console(k, P(4), P(20), glyphs=((0.3, 0.42, 0.05, 0.3), (0.3, 0.42, 0.4, 0.95), (0.55, 0.68, 0.05, 0.6),
                                    (0.55, 0.68, 0.7, 0.85)))
    blk(k, P(24), P(30), P(9), P(14), Z(18), Z(20), CREAM)                                 # a lip at the deck's corner,
    flat(k, P(25), P(27), P(14), Z(18) + Z(0.5), Z(19.5), "resGold")
    # the housing: chamfered at its top front edge, a vented cap set back on it
    prism(k, "u", P(-30), P(-8), [(P(-15), Z(12)), (P(14), Z(12)), (P(14), Z(31)), (P(11), Z(34)), (P(-15), Z(34))],
          CREAM, "resCrL")
    flat(k, P(-27), P(-11), P(14), Z(14), Z(30), "resCrD")                                 # the window's frame,
    flat(k, P(-26), P(-12), P(14) + 0.004, Z(15), Z(29), "resNvyD")                       # the dark chamber,
    k.part("glass").box(P(-19), P(14) + 0.01, Z(15), P(14), 0.004, Z(14), "glassL")
    for u in (P(-24), P(-22)):
        k.box(u, P(14) + 0.014, Z(16), 0.02, 0.003, Z(11), "resCrL", ry=0.4)
    for z in (Z(16), Z(27)):
        flat(k, P(-25), P(-13), P(14) + 0.008, z, z + Z(1) - 0.002, "resGold")
    for u in (P(-29), P(-10)):
        flat(k, u, u + P(1), P(14), Z(13), Z(31), CRK)                                     # its corner seams,
    flat(k, P(-29), P(-9), P(14), Z(13), Z(14), CRK)
    for v in (P(-12), P(-8), P(-4)):
        side(k, P(-8), v, v + P(2), Z(22), Z(30), CRK)                                      # vents on its end,
    side(k, P(-8), P(1), P(9), Z(20), Z(28), "resCrD")                                       # a hatch,
    side(k, P(-8), P(2), P(8), Z(21), Z(27), "resCr")
    side(k, P(-8), P(4), P(6), Z(23), Z(25), "resGold")
    blk(k, P(-28), P(-12), P(-13), P(6), Z(34), Z(39), CREAM)                               # the cap,
    for u in range(-26, -13, 3):
        flat(k, P(u), P(u + 2), P(6), Z(35), Z(38), CRK)                                    # its vents,
    side(k, P(-12), P(-11), P(5), Z(37), Z(38), CRK)
    top(k, P(-27), P(-13), P(-12), P(-11), Z(39), "resCrL")
    dial(k, P(-20), P(-4), Z(39))
    top(k, P(-27), P(-11), P(9), P(10), Z(34), CRK)                                        # a seam on the ledge before it
    # the pipette boom: off the housing's end, out over the turntable, angling down to the tip
    boom = [(P(-8), Z(27)), (P(-8), Z(32)), (P(6), Z(32)), (P(13), Z(27)), (P(13), Z(23)), (P(9), Z(23)),
            (P(5), Z(27))]
    prism(k, "v", P(-4), P(2), boom, CREAM, "resCrL")
    flat(k, P(-7), P(5), P(2), Z(29), Z(30), CRK)
    flat(k, P(-6), P(-4), P(2), Z(30) + Z(0.5), Z(31), GL)
    blk(k, P(10), P(12), P(-2), P(1), Z(19), Z(23), ("steelL", "steel", "steelD"))
    top(k, P(10), P(12), P(-2), P(1), Z(19) - 0.006, "resGold")
    return k.build()


def y10_holo():
    k = K("research_y10_holo", FP2, 0)
    for z, r in ((Z(20), 0.2),):
        for i in range(18):
            a = i * math.tau / 18
            k.box(P(11) + r * math.cos(a), r * math.sin(a), z, 0.03, 0.012, 0.012, "resGold", rz=a + math.pi / 2)
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x10", "y10")}
