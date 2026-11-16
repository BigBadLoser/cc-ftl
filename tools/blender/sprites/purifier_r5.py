"""Water purifier look study, round 5 (family `purifier5`, palette set purifier, preview only; issue #321). Round 4 read
as flat blocks with detail painted on (user). Here the form carries it, as on life support: parts stand up out of the
body and sink into it by several px, the silhouette breaks, doors sit deep in frames. Same colour language (pale
housing, dark lower band, blue-grey trims, amber marks, cyan lamp).

  a1 column and basin: a low chamfered basin at the left with a funnel hopper standing out of its top (ice heaped in
     it), a tall round melt column at the right with raised rings and a domed cap, a pipe from hopper to column, a
     sight tube standing proud of the column's front, the basin's door set deep in a frame
  a2 twin drums: two upright drums sunk into one low body: the ice drum at the left open, its lid standing up on a
     hinge, the water drum at the right domed, an arched crossover pipe with a hand wheel between them, a level gauge
     on stand-offs, the control panel recessed between the drums
  a3 chute and still: a sloped chute at the left (side walls, ice sliding down it) running up into a tall body at the
     right, a bank of cooling fins standing up from its top, a small basin jutting from its front under a spout

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .purifier_kit import prism
from .purifier_kit import extrude
from .purifier_r3 import BAND, V0, V1, chamfered, lamp
from .purifier_study import span
from .research_kit import PXG, Bench, ring, zpx

PAL = "purifier"
FP = (2, 1)
D = 3 * PXG                                    # how deep a recess goes


def body(k, u0, u1, h, v0=V0, v1=V1, c=4 * PXG):
    """A chamfered body on a dark band, standing on the floor (a px inset at the foot)."""
    prism(k, chamfered(u0 + PXG, u1 - PXG, v0 + PXG, v1 - PXG, c), 0, zpx(1), "pfRecess")
    prism(k, chamfered(u0, u1, v0, v1, c), zpx(1), BAND - zpx(1), "pfFrame", "pfFrame")
    prism(k, chamfered(u0, u1, v0, v1, c), BAND, h - BAND, "pfHull", "pfHull")


def skin(k, u0, u1, z0, z1, door):
    """The front skin, D thick, over a body built D shy of V1, with a hole for door (du0, du1, dz0, dz1)."""
    du0, du1, dz0, dz1 = door
    for a, b, c, d in ((u0, du0 - 0.04, z0, z1), (du1 + 0.04, u1, z0, z1), (du0 - 0.04, du1 + 0.04, dz1 + zpx(2), z1),
                       (du0 - 0.04, du1 + 0.04, z0, dz0 - zpx(1.5))):
        if b > a and d > c:
            span(k, a, b, V1 - D, V1, c, d, "pfHull", top="pfHull")


def deep_door(k, u0, u1, z0, z1, v=V1, marks=2):
    """A door sunk D into a +v face: its frame stands proud by a px, the recess dark with amber marks."""
    for a, b, c, d in ((u0 - 0.04, u0, z0, z1), (u1, u1 + 0.04, z0, z1), (u0 - 0.04, u1 + 0.04, z1, z1 + zpx(2)),
                       (u0 - 0.04, u1 + 0.04, z0 - zpx(1.5), z0)):
        span(k, a, b, v - D, v + PXG, c, d, "pfHullM", top="pfTrayL")
    span(k, u0, u1, v - D, v - D + 0.4 * PXG, z0, z1, "pfRecess")
    for i in range(marks):
        z = z0 + zpx(3) + i * zpx(4)
        span(k, (u0 + u1) / 2 - 0.05, (u0 + u1) / 2 + 0.05, v - D + 0.4 * PXG, v - D + 0.8 * PXG, z, z + zpx(1), "pfAmber")


def drum(k, u, v, r, z0, z1, rings=()):
    """An upright drum: a dark foot, a pale shell, raised blue-grey rings."""
    k.cyl(u, v, zpx(1), r, BAND - zpx(1), "pfFrame", top="pfFrame", sides=24)
    k.cyl(u, v, BAND, r - PXG, z1 - BAND, "pfHull", top="pfHull", sides=24)
    for z in rings:
        k.cyl(u, v, z, r + 0.5 * PXG, zpx(2), "pfTrayL", top="pfTrayL", sides=24)


def heap(k, u, v, z, w, d, n=10, s0=0.07):
    """Ice heaped in an opening: chunks of two shades and sizes, scattered on a jittered grid, the middle ones higher."""
    cols = max(2, round(math.sqrt(n * w / d)))
    rows = max(2, -(-n // cols))
    for i in range(cols * rows):
        h = (i * 2654435761) % 997 / 997
        g = (i * 40503 + 17) % 991 / 991
        x = ((i % cols) + 0.5 + 0.5 * (h - 0.5)) / cols - 0.5
        y = ((i // cols) + 0.5 + 0.5 * (g - 0.5)) / rows - 0.5
        s = s0 * (0.8 + 0.6 * g)
        lift = (1 - 2 * max(abs(x), abs(y))) * zpx(2.5)
        k.box(u + x * (w - s), v + y * (d - s), z - s * 0.4 + lift, s, s * (0.8 + 0.4 * h), s * (0.6 + 0.4 * h),
              "pfIceD" if (i * 5) % 3 == 0 else "pfIce", top="pfIce", rz=h * 3.1, rx=(g - 0.5) * 0.5)


def pipe(k, a, b, w, col):
    """An axis-aligned pipe (square) from a to b."""
    span(k, min(a[0], b[0]) - w / 2, max(a[0], b[0]) + w / 2, min(a[1], b[1]) - w / 2, max(a[1], b[1]) + w / 2,
         min(a[2], b[2]) - w / 2, max(a[2], b[2]) + w / 2, col, top="pfTrayL")


def spout(k, u, v, z, axis="u"):
    """A short outlet spout with a red hand wheel."""
    if axis == "u":
        k.box(u + 0.04, v, z, 0.08, 0.07, 0.06, "pfHullM", top="pfTrayL")
        k.box(u + 0.08, v, z - 0.05, 0.04, 0.04, 0.05, "pfHullM")
        ring(k, "u", u + 0.06, v, z + 0.1, 0.045, 10, 0.012, 0.014, "medRed")
    else:
        k.box(u, v + 0.04, z, 0.07, 0.08, 0.06, "pfHullM", top="pfTrayL")
        k.box(u, v + 0.08, z - 0.05, 0.04, 0.04, 0.05, "pfHullM")
        ring(k, "v", u + 0.09, v + 0.04, z + 0.03, 0.04, 10, 0.012, 0.014, "medRed")


# ---- a1 column and basin ----------------------------------------------------------------------------------------------
def a1():
    k = Bench("purifier_a1", FP)
    bh = zpx(18)
    body(k, -0.94, 0.16, bh, v1=V1 - D)                                                                  # the basin
    door = (-0.66, -0.16, BAND + zpx(3), bh - zpx(4))
    skin(k, -0.94 + 4 * PXG, 0.16 - 4 * PXG, BAND, bh, door)                                                # its front
    deep_door(k, *door, V1, 2)
    span(k, -0.94 + 4 * PXG, 0.16 - 4 * PXG, V1 - D, V1, zpx(1), BAND, "pfFrame", top="pfFrame")
    hu, hv = -0.42, -0.04                                                                                 # the hopper
    k.box(hu, hv, bh, 0.5, 0.48, zpx(3), "pfFrame", top="pfFrame")
    k.box(hu, hv, bh + zpx(3), 0.5, 0.48, zpx(9), "pfHullM", top="pfTrayL", taper=1.3)
    k.box(hu, hv, bh + zpx(12) - 0.01, 0.56, 0.54, 0.012, "pfRecess")
    heap(k, hu, hv, bh + zpx(12), 0.5, 0.46, 25, 0.06)
    cu, cv, r = 0.54, -0.04, 0.36                                                                         # the column
    drum(k, cu, cv, r, 0, zpx(36), (zpx(12), zpx(26)))
    k.cyl(cu, cv, zpx(36), r - PXG, zpx(5), "pfHullM", top="pfTrayL", sides=24, rtop=0.2)
    k.cyl(cu, cv, zpx(41), 0.1, zpx(2), "pfFrame", top="pfTray", sides=16)
    k.cyl(cu, cv, zpx(43), 0.04, zpx(2), "pfCyan", sides=10)
    tv = cv + r + 0.02                                                                                    # sight tube
    for z in (zpx(9), zpx(33)):
        k.box(cu, tv - 0.03, z, 0.04, 0.08, zpx(2), "pfFrame")
    k.box(cu, tv + 0.02, zpx(10), 0.09, 0.07, zpx(24), "pfFrame", top="pfFrame")
    k.box(cu, tv + 0.045, zpx(11), 0.05, 0.03, zpx(13), "pfWater", top="pfWaterL")
    k.part("glass").box(cu, tv + 0.06, zpx(11), 0.06, 0.012, zpx(22), "pfIce")
    pz = bh + zpx(9)                                                                                      # feed pipe
    pipe(k, (hu + 0.27, hv - 0.12, pz), (cu - r + 0.02, hv - 0.12, pz), 0.07, "pfHullM")
    ring(k, "u", cu - r - 0.02, hv - 0.12, pz + 0.035, 0.055, 12, 0.03, 0.02, "pfTrayL")
    lamp(k, 0.06, BAND + zpx(4), V1)
    spout(k, cu + r - 0.04, 0.12, zpx(8))
    return k.build()


# ---- a2 twin drums ----------------------------------------------------------------------------------------------------
def a2():
    k = Bench("purifier_a2", FP)
    lu, ru, dv, r = -0.5, 0.5, -0.03, 0.37
    bv1 = 0.26                                                                                            # the block
    body(k, -0.3, 0.3, zpx(22), v0=-0.3, v1=bv1)                                                          # between them
    span(k, -0.15, 0.15, bv1 - 0.5 * PXG, bv1 + 0.3 * PXG, BAND + zpx(2), zpx(19), "pfFrame")              # its panel
    span(k, -0.13, 0.13, bv1, bv1 + 0.5 * PXG, BAND + zpx(3), zpx(18), "pfRecess")
    for i, c in enumerate(("pfAmber", "pfCyan", "pfAmber")):
        span(k, -0.09 + i * 0.07, -0.05 + i * 0.07, bv1 + 0.5 * PXG, bv1 + 0.8 * PXG, zpx(12), zpx(14), c)
    drum(k, lu, dv, r, 0, zpx(32), (zpx(14), zpx(26)))                                                    # ice drum
    k.cyl(lu, dv, zpx(32), r + 0.5 * PXG, zpx(2), "pfTrayL", top="pfTrayL", sides=24)
    k.cyl(lu, dv, zpx(34) - 0.01, r - 3 * PXG, 0.012, "pfRecess", sides=24)
    heap(k, lu, dv, zpx(34), 0.52, 0.52, 25, 0.06)
    k.box(lu, dv - r + 0.04, zpx(34), 0.46, 0.025, 0.28, "pfHullM", top="pfTrayL", rx=-0.45)                 # its lid
    k.box(lu, dv - r + 0.02, zpx(33), 0.2, 0.06, zpx(3), "pfFrame")
    drum(k, ru, dv, r, 0, zpx(36), (zpx(14), zpx(30)))                                                    # water drum
    k.cyl(ru, dv, zpx(36), r - PXG, zpx(6), "pfHullM", top="pfTrayL", sides=24, rtop=0.14)
    k.cyl(ru, dv, zpx(42), 0.07, zpx(2), "pfFrame", top="pfCyan", sides=12)
    pz, pv = zpx(40), dv + 0.04                                                                           # crossover
    pipe(k, (lu + 0.31, pv, zpx(33)), (lu + 0.31, pv, pz + zpx(4)), 0.07, "pfHullM")
    pipe(k, (lu + 0.31 - 0.035, pv, pz + zpx(4)), (ru - 0.22 + 0.035, pv, pz + zpx(4)), 0.07, "pfHullM")
    pipe(k, (ru - 0.22, pv, pz + zpx(4)), (ru - 0.22, pv, zpx(38)), 0.07, "pfHullM")
    ring(k, "v", 0.0, pv + 0.05, pz + zpx(4) + 0.035, 0.06, 12, 0.014, 0.016, "medRed")
    k.box(0.0, pv + 0.03, pz + zpx(4) - 0.01, 0.03, 0.04, 0.05, "pfFrame")
    gu, gv = ru + 0.18, dv + r + 0.06                                                                     # level gauge
    for z in (zpx(10), zpx(30)):
        pipe(k, (gu, gv - 0.08, z), (gu, gv, z), 0.025, "pfFrame")
    k.box(gu, gv, zpx(9), 0.06, 0.06, zpx(23), "pfFrame", top="pfFrame")
    k.box(gu, gv + 0.02, zpx(10), 0.03, 0.03, zpx(14), "pfCyan")
    spout(k, ru - 0.24, dv + r - 0.06, zpx(6), "v")
    return k.build()


# ---- a3 chute and still -----------------------------------------------------------------------------------------------
CU0, CU1, CZ0, CZ1, CV = -0.94, -0.28, zpx(13), zpx(25), 0.32     # a3's chute: its foot and head (u, z), half-width


def a3():
    k = Bench("purifier_a3", FP)
    th = zpx(30)
    body(k, CU1 - 0.02, 0.94, th, v1=V1 - D)                                                             # the still
    span(k, CU1 - 0.02 + 4 * PXG, 0.94 - 4 * PXG, V1 - D, V1, zpx(1), BAND, "pfFrame", top="pfFrame")
    door = (-0.1, 0.3, BAND + zpx(3), th - zpx(5))
    skin(k, CU1 - 0.02 + 4 * PXG, 0.94 - 4 * PXG, BAND, th, door)
    extrude(k, [(CU0 + PXG, 0), (CU1, 0), (CU1, zpx(1)), (CU0 + PXG, zpx(1))], "v", -CV + PXG, CV - PXG, "pfRecess")
    extrude(k, [(CU0, zpx(1)), (CU1, zpx(1)), (CU1, BAND), (CU0, BAND)], "v", -CV, CV, "pfFrame", top="pfFrame")
    extrude(k, [(CU0, BAND), (CU1, BAND), (CU1, CZ1), (CU0, CZ0)], "v", -CV, CV, "pfHull", top="pfTray")   # chute
    for a0, a1 in ((-CV - 0.04, -CV + 0.02), (CV - 0.02, CV + 0.04)):                                    # its walls
        extrude(k, [(CU0, BAND), (CU1, BAND), (CU1, CZ1 + zpx(2)), (CU0, CZ0 + zpx(2))], "v", a0, a1, "pfHullM",
                top="pfTrayL")
    for i in range(9):                                                                                    # ice on it
        f = (i + 0.5) / 9
        u = CU0 + 0.06 + (CU1 - CU0 - 0.14) * f
        z = CZ0 + (CZ1 - CZ0) * (u - CU0) / (CU1 - CU0)
        v = (-0.14, 0.1, -0.02)[i % 3]
        s = 0.1 + 0.025 * (i % 2)
        k.box(u, v, z - 0.01, s, s, s * 0.8, "pfIce" if i % 2 else "pfIceD", top="pfIce", rz=i * 1.3, ry=-0.36)
    span(k, CU1 - 0.03, CU1 - 0.02, -CV + 0.04, CV - 0.04, CZ1, CZ1 + zpx(6), "pfRecess")                 # its mouth
    span(k, CU0 + 0.1, CU0 + 0.18, CV + 0.04, CV + 0.04 + 0.5 * PXG, BAND + zpx(2), BAND + zpx(3), "pfAmber")
    for i in range(6):                                                                                    # fins
        u = 0.0 + i * 0.15
        span(k, u, u + 0.04, -0.32, 0.28, th, th + zpx(9), "pfTrayL", top="pfTray")
    span(k, -0.04, 0.82, -0.08, -0.02, th, th + zpx(6), "pfFrame", top="pfFrame")
    deep_door(k, *door, V1, 3)
    bu, bz = 0.62, zpx(9)                                                                                 # the basin
    k.box(bu, V1 + 0.06, bz, 0.34, 0.14, zpx(5), "pfHullM", top="pfTrayL")
    k.box(bu, V1 + 0.03, bz - zpx(3), 0.2, 0.06, zpx(3), "pfFrame")
    k.box(bu, V1 + 0.06, bz + zpx(5) - 0.01, 0.28, 0.09, 0.012, "pfWater", top="pfWater")
    k.box(bu, V1 + 0.03, bz + zpx(11), 0.06, 0.1, zpx(2), "pfHullM", top="pfTrayL")                       # spout
    k.box(bu, V1 + 0.07, bz + zpx(9), 0.03, 0.03, zpx(2), "pfHullM")
    k.box(bu, V1 + 0.07, bz + zpx(5), 0.012, 0.012, zpx(4), "pfWaterL")
    ring(k, "v", bu + 0.12, V1 + 0.02, bz + zpx(14), 0.04, 10, 0.012, 0.014, "medRed")
    lamp(k, 0.44, th - zpx(9), V1)
    return k.build()


VARIANTS = {"a1": a1, "a2": a2, "a3": a3}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
