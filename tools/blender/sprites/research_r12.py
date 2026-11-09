"""Research companions, round 12: the 1x2 dissection tables and analyzers with bodies shaped by what they do. The family
is a language, not a shared base: a brown plinth, a shadowed navy core, heavy cream masses with their chamfers built in
(extruded profiles, every corner on the px grid), overhangs that cast shadow, bezels breaking the rail edge, gold seams.
Local frame: footprint (2, 1), u -1..1, v -0.5..0.5, the work side at +v.

  x5  cradle: a narrow navy pedestal under heavy chamfered rails round a sunken bed; a raised head block at the left
      grows an arm out over the specimen, a gold scanner under its tip. Hologram: the scan cone and a label
  x6  cowl: a cream hood sweeping up from the back and out over a bed tilted to the worker; arms hang from under it, a
      gold light along its lip. Hologram: the anatomy traced over the bed
  x7  pod: a chamfered pod, the bed sunk in its top, its back shell hinged open with a navy lining. Hologram: the
      plates' outlines projected on the open shell, leaders down
  y5  stepped tower: a low sample bay steps up to a tall housing; the chamber stands in an alcove in it, the navy core
      climbing into the alcove. Hologram: the spectrum over the bay
  y6  drum: a round centrifuge body, a wedge console grown onto its side, an arm from the console over the dome.
      Hologram: readout rings over the dome
  y7  sample library: a wedge whose sloped face is a lit grid of sample cells behind glass, framed by cheeks, a tray
      pulled out at its foot with a sample on it. Hologram: a chart over the library"""
import math

from .core import G as GV
from .modkit import K
from .research_kit import PXG, Bench, bar, ring, zpx
from .research_r3 import _pane
from .research_r6 import Table, _creature

FP2 = (2, 1)
G, F, GL = "resGold", "resGoldF", "resGlyph"


def P(n):
    return n * PXG


Z = zpx
CREAM, CTOP = "lvW2", "lvW"


# ---- the kit: extruded profiles -------------------------------------------------------------------------------------

def extrude(k, axis, a0, a1, prof, col, top=None):
    """A prism: the polygon prof swept from a0 to a1 along axis. axis 'u': prof in (v, z); axis 'v': prof in (u, z).
    Faces facing up (normal z > 0.7) take `top`."""
    area = sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1]
               for i in range(len(prof)))
    if area < 0:
        prof = prof[::-1]                                                               # counter-clockwise

    def pt(a, p):
        u, v = (a, p[0]) if axis == "u" else (p[0], a)
        return GV(*k.p(u, v), p[1])

    def face(pts, nz):
        k.m.poly(pts, top if (top and nz > 0.7) else col, flip=True)
    cap0, cap1 = [pt(a0, p) for p in prof], [pt(a1, p) for p in prof]
    if axis == "u":                                     # CCW in (v, z) faces +u
        face(cap1, 0.0)
        face(cap0[::-1], 0.0)
    else:                                               # CCW in (u, z) faces -v
        face(cap0, 0.0)
        face(cap1[::-1], 0.0)
    n = len(prof)
    for i in range(n):
        p, q = prof[i], prof[(i + 1) % n]
        d0, d1 = q[0] - p[0], q[1] - p[1]
        L = math.hypot(d0, d1) or 1.0
        a, b, c, d = pt(a0, p), pt(a1, p), pt(a1, q), pt(a0, q)
        face([a, d, c, b] if axis == "u" else [a, b, c, d], -d0 / L)


def slab_on(k, u0, u1, A, B, t, col, off=0.0):
    """A thin slab on the line A-B of a (v, z) profile (swept u0..u1), on its upper side, off out from it, t thick."""
    dv, dz = B[0] - A[0], B[1] - A[1]
    L = math.hypot(dv, dz)
    nv, nz = -dz / L, dv / L
    if nz < 0:
        nv, nz = -nv, -nz
    a = (A[0] + nv * off, A[1] + nz * off)
    b = (B[0] + nv * off, B[1] + nz * off)
    extrude(k, "u", u0, u1, [a, b, (b[0] + nv * t, b[1] + nz * t), (a[0] + nv * t, a[1] + nz * t)], col)


def on_line(A, B, t):
    return (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t)


def patch(k, face, c, p, w, z, h, col):
    if face == "v":
        k.box(c, p + 0.002, z, w, 0.004, h, col)
    else:
        k.box(p + 0.002, c, z, 0.004, w, h, col)


def plinth(k, u, v, w, d, h=3):
    k.box(u, v, 0.0, w, d, Z(h), "resBrn", top="resBrnL")


def core(k, u, v, w, d, z0, z1, seams=()):
    k.box(u, v, z0, w, d, z1 - z0, "resNvy", top="resNvyD")
    for su in seams:
        patch(k, "v", su, v + d / 2, PXG, z0, z1 - z0, "resNvyD")


def bezel(k, u, w, vb, vf, z0, z1, z2):
    """A bezel breaking a rail's front edge: a block from vb out to vf, its top sloping from z2 at the back down to z1 at
    the front over a z0 base; a dark screen on the slope with gold glyphs."""
    A, B = (vf, z1), (vb + P(1), z2)
    extrude(k, "u", u - w / 2, u + w / 2, [(vb, z0), (vf, z0), A, B, (vb, z2)], CREAM, CTOP)
    slab_on(k, u - w / 2 + P(1), u + w / 2 - P(1), on_line(A, B, 0.15), on_line(A, B, 0.85), 0.006, "resNvyD")
    for j, (t0, t1) in enumerate(((0.3, 0.45), (0.55, 0.65))):
        for gu in (-w * 0.18, w * 0.12):
            slab_on(k, u + gu - P(1), u + gu + P(1) * (1 + j), on_line(A, B, t0), on_line(A, B, t1), 0.004, GL,
                    off=0.006)


def specimen(k, u, v, z, s=0.7):
    """The carapaced creature opened up (as round 11)."""
    k.cyl(u, v, z, 0.23 * s, Z(2), "resSpec", top="resSpecL", sides=16)
    k.cyl(u, v, z + Z(2), 0.18 * s, Z(1), "resWingL", top="resWingL", sides=16)
    for (du, dv, q, col) in ((-0.06, 0.04, 0.09, "medRed"), (0.06, -0.02, 0.07, "resBio"), (0.0, -0.09, 0.06, "hivis")):
        k.box(u + du * s, v + dv * s, z + Z(3), q * s, q * s, Z(1), col)
    for sg in (-1, 1):
        for a in (0.5, 0.0, -0.5):
            bar(k, (u + sg * 0.22 * s * math.cos(a), v + 0.22 * s * math.sin(a), z + 0.02),
                (u + sg * 0.36 * s * math.cos(a * 1.3), v + 0.36 * s * math.sin(a * 1.3), z + 0.02), 0.03, "resSpec")


def mk(name):
    return Bench(name, FP2)


# ---- x5: cradle -----------------------------------------------------------------------------------------------------

X5_TIP = (P(4), 0.0, Z(33))


def x5(layer):
    k = mk(f"research_x5_{layer}")
    plinth(k, P(2), 0.0, P(48), P(18))
    core(k, P(2), 0.0, P(44), P(14), Z(3), Z(12), seams=(P(-9), P(13)))
    rb, rf = Z(12), Z(14)                                                            # rail bottom, its chamfer
    extrude(k, "u", P(-20), P(30), [(P(-15), rf), (P(-13), rb), (P(-7), rb), (P(-7), Z(22)), (P(-9), Z(24)),
                                     (P(-13), Z(24)), (P(-15), Z(22))], CREAM, CTOP)           # the back rail,
    extrude(k, "u", P(-20), P(30), [(P(13), rf), (P(11), rb), (P(7), rb), (P(7), Z(21)), (P(9), Z(23)),
                                     (P(11), Z(23)), (P(13), Z(21))], CREAM, CTOP)             # the front rail,
    extrude(k, "v", P(-7), P(7), [(P(26), rb), (P(30), rb), (P(30), Z(21)), (P(28), Z(23)), (P(26), Z(23))],
            CREAM, CTOP)                                                             # the foot,
    k.box(P(3), 0.0, rb, P(46), P(14), Z(6), "resNvyD", top="gm")                     # the bed,
    k.box(P(3), P(6), Z(18), P(44), P(1), 0.004, G)                                   # a gold rim along it
    specimen(k, P(2), 0.0, Z(18))
    for u, v, rz in ((P(14), P(-3), 0.4), (P(20), P(3), -0.3)):
        k.box(u, v, Z(18), 0.12, 0.09, Z(1), "resSpec", top="resSpecL", rz=rz)
    for u in (P(16), P(24)):
        bezel(k, u, P(6), P(11), P(15), Z(15), Z(19), Z(22))
    # the head block at the left, high, its foot cut away underneath; the arm grows out of it over the bed
    extrude(k, "v", P(-15), P(15), [(P(-30), Z(14)), (P(-28), Z(12)), (P(-20), Z(12)), (P(-20), Z(28)),
                                     (P(-22), Z(30)), (P(-28), Z(30)), (P(-30), Z(28))], CREAM, CTOP)
    patch(k, "v", P(-25), P(15), P(1), Z(15), Z(12), G)
    extrude(k, "v", P(-4), P(4), [(P(-22), Z(28)), (P(-22), Z(34)), (P(-18), Z(38)), (P(4), Z(38)), (P(6), Z(36)),
                                   (P(6), Z(33)), (P(2), Z(32)), (P(-14), Z(32)), (P(-18), Z(28))], CREAM, CTOP)
    k.box(P(3), 0.0, Z(32) - Z(1), P(4), P(4), Z(1), "resNvyD")
    k.box(P(3), 0.0, Z(32) - Z(1) - 0.006, P(2), P(2), 0.006, G)                         # its scanner
    patch(k, "v", P(-6), P(4), P(16), Z(35), Z(1), G)
    return k.build()


def x5_holo():
    k = K("research_x5_holo", FP2, 0)
    for i, (z, r) in enumerate(((Z(29), 0.04), (Z(25), 0.08), (Z(21), 0.12))):
        ring(k, "z", P(3), 0.0, z, r, 14, 0.012, 0.012, G)                              # the scan cone
    _pane(k, P(16), P(-2), Z(30), 0.28, 0.14, 0.1, G, F, ((0, 1, 0.18), (0, 0.5, 0.12), (1, 0.0, 0.08)))
    bar(k, (P(5), 0.0, Z(22)), (P(12), P(-2), Z(30)), 0.012, G)
    return k


# ---- x6: cowl -------------------------------------------------------------------------------------------------------

X6_BED = ((P(-6), Z(22)), (P(10), Z(16)))      # the bed's slope: back, front


def x6(layer):
    k = mk(f"research_x6_{layer}")
    plinth(k, 0.0, 0.0, P(56), P(24))
    core(k, 0.0, 0.0, P(52), P(20), Z(3), Z(14), seams=(P(-13), 0.0, P(13)))
    # the hood: a back wall rising, sweeping out over the bed, a gold light under its lip
    hood = [(P(-14), Z(14)), (P(-6), Z(14)), (P(-6), Z(28)), (P(-2), Z(32)), (P(6), Z(33)), (P(6), Z(35)),
            (P(2), Z(38)), (P(-6), Z(38)), (P(-12), Z(36)), (P(-14), Z(32))]
    extrude(k, "u", P(-26), P(26), hood, CREAM, CTOP)
    k.box(0.0, P(5), Z(33) - 0.006, P(48), P(1), 0.006, G)
    # its cheeks at both ends, following its sweep down to the front lip
    cheek = [(P(-14), Z(14)), (P(13), Z(14)), (P(13), Z(19)), (P(10), Z(22)), (P(7), Z(33)), (P(5), Z(36)),
             (P(1), Z(39)), (P(-7), Z(39)), (P(-13), Z(37)), (P(-14), Z(33))]
    for u0, u1 in ((P(-30), P(-26)), (P(26), P(30))):
        extrude(k, "u", u0, u1, cheek, CREAM, CTOP)
    patch(k, "u", P(-1), P(30), P(10), Z(18), Z(1), G)
    # the tilted bed and its front lip, bezels breaking the lip
    (bv, bz), (fv, fz) = X6_BED
    extrude(k, "u", P(-26), P(26), [(bv, Z(14)), (fv, Z(14)), (fv, fz), (bv, bz)], "resNvyD", "gm")
    extrude(k, "u", P(-26), P(26), [(P(10), Z(14)), (P(13), Z(14)), (P(13), Z(19)), (P(11), Z(19)), (P(10), Z(17))],
            CREAM, CTOP)
    for u in (P(-18), P(18)):
        bezel(k, u, P(6), P(11), P(15), Z(14), Z(17), Z(20))
    tilt = math.atan2(bz - fz, fv - bv)
    T = Table(k, (0.0, (bv + fv) / 2, (bz + fz) / 2), tilt)
    _creature(T)
    # two arms hanging from under the hood, brass joints, gold tips
    for au, tu in ((P(-10), -0.06), (P(10), 0.08)):
        a, b, c = (au, P(1), Z(32)), (au * 1.2, P(5), Z(26)), (tu, P(3), Z(22))
        bar(k, a, b, 0.05, CREAM)
        bar(k, b, c, 0.035, "steelL")
        k.cyl(b[0], b[1], b[2] - 0.03, 0.035, 0.06, "brass", sides=10)
        k.box(c[0], c[1], c[2] - 0.04, 0.025, 0.025, 0.04, G)
    return k.build()


def x6_holo():
    k = K("research_x6_holo", FP2, 0)
    (bv, bz), (fv, fz) = X6_BED
    tilt = math.atan2(bz - fz, fv - bv)
    T = Table(k, (0.0, (bv + fv) / 2, (bz + fz) / 2), tilt)
    T.put(0.0, 0.0, 0.14, 0.5, 0.36, 0.01, F)                                          # the trace, over the bed
    for s in (-1, 1):
        u, v, z = T.at(s * 0.25, 0.0, 0.15)
        u2, v2, z2 = T.at(0.0, s * 0.18, 0.15)
        bar(k, (u, v, z), (u2, v2, z2), 0.012, G)
        u3, v3, z3 = T.at(s * 0.25, s * 0.18 * -1, 0.15)
        bar(k, (u, v, z), (u3, v3, z3), 0.012, G)
    return k


# ---- x7: pod --------------------------------------------------------------------------------------------------------

HINGE = (P(-13), Z(18))
LID_A = 1.15                     # how far the back shell is lifted


def _lift(p):
    dv, dz = p[0] - HINGE[0], p[1] - HINGE[1]
    c, s = math.cos(LID_A), math.sin(LID_A)
    return (HINGE[0] + dv * c - dz * s, HINGE[1] + dv * s + dz * c)


LID = [(P(-13), Z(18)), (P(-1), Z(18)), (P(-1), Z(21)), (P(-3), Z(23)), (P(-11), Z(23)), (P(-13), Z(21))]


def x7(layer):
    k = mk(f"research_x7_{layer}")
    plinth(k, 0.0, 0.0, P(48), P(16))
    core(k, 0.0, 0.0, P(44), P(12), Z(3), Z(8), seams=(P(-11), 0.0, P(11)))
    pod = [(P(-12), Z(6)), (P(12), Z(6)), (P(15), Z(10)), (P(15), Z(16)), (P(13), Z(18)), (P(7), Z(18)),
           (P(7), Z(14)), (P(-7), Z(14)), (P(-7), Z(18)), (P(-13), Z(18)), (P(-15), Z(16)), (P(-15), Z(10))]
    extrude(k, "u", P(-26), P(26), pod, CREAM, CTOP)
    for su in (-1, 1):                                                                 # chamfered end caps
        u0, u1 = (P(-29), P(-26)) if su < 0 else (P(26), P(29))
        extrude(k, "u", u0, u1, [(p[0] * 0.8, Z(6) + (p[1] - Z(6)) * 0.85) for p in pod if p[1] != Z(14)],
                CREAM, CTOP)
    k.box(0.0, 0.0, Z(14), P(52), P(14), 0.004, "gm")                                   # the bed's floor
    k.box(0.0, P(6), Z(14), P(50), P(1), 0.006, G)
    specimen(k, P(-4), 0.0, Z(14), s=0.75)
    for u, v, rz in ((P(14), P(-2), 0.4), (P(20), P(3), -0.3)):
        k.box(u, v, Z(14), 0.12, 0.09, Z(1), "resSpec", top="resSpecL", rz=rz)
    slab_on(k, P(-24), P(24), (P(13), Z(18)), (P(15), Z(16)), 0.004, G)                # a gold seam round its lip
    for u in (P(-18), P(18)):
        bezel(k, u, P(6), P(12), P(16), Z(10), Z(14), Z(17))
    # the back shell, lifted on its hinge: cream outside, a navy lining facing the worker
    lid = [_lift(p) for p in LID]
    extrude(k, "u", P(-26), P(26), lid, CREAM, CTOP)
    slab_on(k, P(-24), P(24), _lift((P(-12), Z(18))), _lift((P(-2), Z(18))), 0.004, "resNvyD", off=-0.008)
    for su in (-1, 1):
        k.cyl(su * P(27), HINGE[0], HINGE[1] - Z(2), 0.05, Z(4), "brass", sides=10)
    return k.build()


def x7_holo():
    k = K("research_x7_holo", FP2, 0)
    a, b = _lift((P(-11), Z(18))), _lift((P(-3), Z(18)))
    for i, u in enumerate((P(-14), P(0), P(14))):
        t = 0.3 + 0.2 * (i % 2)
        v, z = on_line(a, b, t)
        k.box(u, v + 0.03, z, 0.14, 0.01, 0.08, F)
        bar(k, (u, v + 0.03, z), (P(-4) + 0.05 * (i - 1), 0.0, Z(15)), 0.012, G)
    return k


# ---- y5: stepped tower ----------------------------------------------------------------------------------------------

CH_U, CH_V = P(20), P(5)


def y5(layer):
    k = mk(f"research_y5_{layer}")
    plinth(k, 0.0, 0.0, P(60), P(26))
    core(k, 0.0, 0.0, P(56), P(22), Z(3), Z(12), seams=(P(-16), P(-4), P(8)))
    # the low bay and the step, one stepped mass swept across the depth
    extrude(k, "v", P(-13), P(13), [(P(-30), Z(14)), (P(-28), Z(12)), (P(8), Z(12)), (P(8), Z(26)), (P(-6), Z(26)),
                                     (P(-8), Z(24)), (P(-8), Z(18)), (P(-28), Z(18)), (P(-30), Z(16))], CREAM, CTOP)
    k.box(P(-18), 0.0, Z(17), P(16), P(18), Z(1), "resNvyD")                             # the bay's sunken rack,
    for v in (P(-5), 0.0, P(5)):
        for i in range(5):
            k.cyl(P(-24) + i * P(3), v, Z(17), 0.03, 0.08, "lvW",
                  top=("resBio", "medRed", "hivis", "resVio")[(i + int(v / PXG)) % 4], sides=8)
    patch(k, "v", 0.0, P(13), P(14), Z(22), Z(1), G)
    bezel(k, P(0), P(6), P(11), P(15), Z(20), Z(23), Z(26))
    # the tower: a back block, cheeks, a cap with its front chamfered, the navy core rising into the alcove
    extrude(k, "v", P(-13), P(-1), [(P(8), Z(12)), (P(30), Z(12)), (P(30), Z(44)), (P(28), Z(46)), (P(10), Z(46)),
                                     (P(8), Z(44))], CREAM, CTOP)
    k.box(CH_U, P(-1), Z(12), P(14), P(1), Z(30), "resNvy")
    extrude(k, "u", P(8), P(12), [(P(-1), Z(12)), (P(13), Z(12)), (P(13), Z(42)), (P(11), Z(44)), (P(-1), Z(44))],
            CREAM, CTOP)                                                             # a cheek on the step's side,
    extrude(k, "u", P(12), P(30), [(P(-1), Z(40)), (P(11), Z(40)), (P(13), Z(42)), (P(13), Z(44)), (P(11), Z(46)),
                                    (P(-1), Z(46))], CREAM, CTOP)                    # the cap, cantilevered,
    extrude(k, "u", P(12), P(30), [(P(-1), Z(12)), (P(13), Z(12)), (P(13), Z(14)), (P(11), Z(15)), (P(-1), Z(15))],
            CREAM, CTOP)                                                             # the sill (the alcove opens
    patch(k, "v", P(21), P(13), P(16), Z(13), Z(1), G)                                 # front and right)
    cz0, ch = Z(15), Z(25)
    k.part("glass").cyl(CH_U, CH_V, cz0, 0.17, ch, "glassL", top="glassL", sides=20)
    k.part("fluid").cyl(CH_U, CH_V, cz0, 0.155, ch - Z(3), "resFluid", sides=20)
    k.cyl(CH_U, CH_V, cz0, 0.025, 0.18, "steelL", sides=8)
    sz = cz0 + 0.18
    k.cyl(CH_U, CH_V, sz, 0.08, 0.12, "resSpec", top="resSpecL", sides=12, rtop=0.05)
    for i in range(4):
        a = i * math.tau / 4 + 0.4
        bar(k, (CH_U + 0.07 * math.cos(a), CH_V + 0.07 * math.sin(a), sz + 0.06),
            (CH_U + 0.12 * math.cos(a + 0.5), CH_V + 0.12 * math.sin(a + 0.5), sz + 0.2), 0.022, "resFrond")
    for z in (cz0 + Z(1), Z(39)):
        ring(k, "z", CH_U, CH_V, z, 0.18, 20, Z(1), 0.012, G)
    return k.build()


def y5_holo():
    k = K("research_y5_holo", FP2, 0)
    _pane(k, P(-18), P(-4), Z(30), 0.4, 0.22, 0.1, G, F, ((0, 1, 0.26), (0, 0.66, 0.18), (0, 0.33, 0.3), (0, 0.0, 0.14)))
    bar(k, (P(-18), 0.0, Z(19)), (P(-18), P(-3), Z(30)), 0.012, G)
    return k


# ---- y6: drum -------------------------------------------------------------------------------------------------------

DU, DR = P(-14), 0.43


def y6(layer):
    k = mk(f"research_y6_{layer}")
    k.cyl(DU, 0.0, 0.0, DR, Z(3), "resBrn", top="resBrnL", sides=32)
    k.cyl(DU, 0.0, Z(3), DR - 0.04, Z(9), "resNvy", top="resNvyD", sides=32)
    k.cyl(DU, 0.0, Z(12), DR - 0.02, Z(2), CREAM, top=CTOP, sides=32, rtop=DR)          # the shroud flaring out,
    k.cyl(DU, 0.0, Z(14), DR, Z(6), CREAM, top=CTOP, sides=32)
    k.cyl(DU, 0.0, Z(20), DR, Z(2), CREAM, top=CTOP, sides=32, rtop=DR - 0.05)          # and in at the top,
    ring(k, "z", DU, 0.0, Z(17), DR + 0.004, 32, Z(1), 0.008, G)
    k.cyl(DU, 0.0, Z(22) - 0.004, 0.33, 0.004, "resNvyD", sides=28)                     # the well,
    for i in range(10):
        a = i * math.tau / 10
        k.cyl(DU + 0.22 * math.cos(a), 0.22 * math.sin(a), Z(22), 0.032, 0.08, "lvW",
              top=("resBio", "medRed", "hivis", "resVio")[i % 4], sides=8)
    k.cyl(DU, 0.0, Z(22), 0.07, Z(3), "steelL", top="steel", sides=12)
    k.part("glass").cyl(DU, 0.0, Z(22), 0.33, 0.2, "glassL", sides=24, rtop=0.22)        # the dome
    # the console grown onto its side: a wedge rising toward the drum, bezels on its slope
    plinth(k, P(14), 0.0, P(28), P(22))
    core(k, P(14), 0.0, P(26), P(18), Z(3), Z(10))
    extrude(k, "v", P(-12), P(12), [(P(2), Z(10)), (P(29), Z(10)), (P(29), Z(14)), (P(27), Z(16)), (P(6), Z(24)),
                                     (P(2), Z(24))], CREAM, CTOP)
    for v in (P(-6), P(1), P(8)):
        A, B = (P(27), Z(16)), (P(6), Z(24))
        extrude(k, "v", v - P(2), v + P(2), [on_line(A, B, 0.2), on_line(A, B, 0.5),
                                             (on_line(A, B, 0.5)[0], on_line(A, B, 0.5)[1] + Z(1)),
                                             (on_line(A, B, 0.2)[0], on_line(A, B, 0.2)[1] + Z(1))], "resNvyD")
        k.box(on_line(A, B, 0.35)[0], v, on_line(A, B, 0.35)[1] + Z(1), P(3), P(2), 0.006, GL)
    # the arm off the console over the dome, a sensor head
    extrude(k, "v", P(-3), P(3), [(P(4), Z(24)), (P(10), Z(24)), (P(10), Z(36)), (P(8), Z(38)), (P(-14), Z(38)),
                                   (P(-16), Z(36)), (P(-16), Z(33)), (P(-12), Z(32)), (P(4), Z(32))], CREAM, CTOP)
    k.box(DU, 0.0, Z(32) - 0.006, P(3), P(3), 0.006, G)
    patch(k, "v", P(-3), P(3), P(10), Z(35), Z(1), G)
    return k.build()


def y6_holo():
    k = K("research_y6_holo", FP2, 0)
    for z, r in ((Z(22) + 0.26, 0.2), (Z(22) + 0.32, 0.14)):
        ring(k, "z", DU, 0.0, z, r, 20, 0.012, 0.012, G)
    k.box(DU + 0.28, 0.0, Z(22) + 0.2, 0.2, 0.01, 0.12, F)
    for i, w in enumerate((0.12, 0.07, 0.16)):
        k.box(DU + 0.28 - 0.09 + w / 2, 0.006, Z(22) + 0.28 - i * 0.035, w, 0.01, 0.018, G)
    return k


# ---- y7: sample library ---------------------------------------------------------------------------------------------

SLOPE = ((P(8), Z(18)), (P(-6), Z(40)))     # the face: foot, head


def y7(layer):
    k = mk(f"research_y7_{layer}")
    plinth(k, 0.0, 0.0, P(56), P(24))
    core(k, 0.0, P(-1), P(52), P(20), Z(3), Z(12), seams=(P(-13), 0.0, P(13)))
    A, B = SLOPE
    wedge = [(P(-14), Z(12)), (P(12), Z(12)), (P(12), Z(16)), A, B, (P(-10), Z(42)), (P(-14), Z(40))]
    extrude(k, "u", P(-26), P(26), wedge, CREAM, CTOP)
    cheek = [(P(-15), Z(12)), (P(13), Z(12)), (P(13), Z(17)), (P(9), Z(20)), (P(-5), Z(42)), (P(-10), Z(44)),
             (P(-15), Z(42))]
    for u0, u1 in ((P(-30), P(-26)), (P(26), P(30))):
        extrude(k, "u", u0, u1, cheek, CREAM, CTOP)
    # the lit grid of sample cells, glass over it
    slab_on(k, P(-25), P(25), on_line(A, B, 0.06), on_line(A, B, 0.94), 0.006, "resNvyD", off=0.0)
    cols = ("resBio", "resGold", "resVio", "resBio", "hivis", "resGold", "medRed")
    for r in range(3):
        t0, t1 = 0.14 + r * 0.27, 0.14 + r * 0.27 + 0.16
        for c in range(8):
            u = P(-21) + c * P(6)
            col = cols[(r * 3 + c) % len(cols)]
            slab_on(k, u - P(2), u + P(2), on_line(A, B, t0), on_line(A, B, t1), 0.006,
                    col if (r + c) % 3 else "resNvy", off=0.006)
    slab_on(k.part("glass"), P(-25), P(25), on_line(A, B, 0.06), on_line(A, B, 0.94), 0.008, "glassL", off=0.016)
    # the tray pulled out at its foot, a sample on it; bezels either side
    k.box(0.0, P(13), Z(12), P(16), P(4), Z(3), CREAM, top=CTOP)
    k.box(0.0, P(13), Z(15), P(14), P(3), 0.004, "resNvyD")
    k.cyl(0.0, P(13), Z(15), 0.04, Z(3), "lvW", top="resBio", sides=10)
    patch(k, "v", 0.0, P(15), P(14), Z(13), Z(1), G)
    for u in (P(-18), P(18)):
        bezel(k, u, P(6), P(10), P(14), Z(12), Z(15), Z(18))
    return k.build()


def y7_holo():
    k = K("research_y7_holo", FP2, 0)
    _pane(k, P(10), P(-12), Z(48), 0.4, 0.2, 0.1, G, F, ((0, 1, 0.24), (0, 0.5, 0.3), (0, 0.0, 0.16)))
    A, B = SLOPE
    v, z = on_line(A, B, 0.55)
    bar(k, (P(9), v + 0.02, z), (P(10), P(-12), Z(48)), 0.012, G)
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x5", "x6", "x7", "y5", "y6", "y7")}
