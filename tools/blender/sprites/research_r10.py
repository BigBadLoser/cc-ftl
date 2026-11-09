"""Research companions, round 10: two 1x2 modules in the bench's family (cream body, brass, gold light, whole-px edges),
for the work the bench (c1) sends out. Local frame: footprint (2, 1), u -1..1, v -0.5..0.5, the work side at +v.

  x1  dissection table: a slab on a cream drawer cabinet, a carapaced specimen opened on its dark steel tray and the
      plates taken off it laid out in a row; a boom tower at the back right carries a surgical light out over it and a
      manipulator arm. Hologram: the
      exploded view, each plate floating where it came off, a leader down to where it lies now
  y1  sample analyzer: a cream cabinet; on it a glass chamber of fluid with a specimen held in it, lit gold, and a
      carousel of vials under a pipette gantry. Hologram: the sample's spectrum on a pane, and a molecule turning
      over the chamber"""
import math

from .research_kit import PXG, Bench, bar, body, ring, zpx
from .research_r3 import _pane
from .research_r6 import stack
from .modkit import K

FP2 = (2, 1)
G, F = "resGold", "resGoldF"


def _gold_line(k, u, v, z, w):
    """A 1 px gold light line along u on a +v face at v (drawn as colour, flush)."""
    k.box(u, v + 0.002, z, w, 0.004, zpx(1), G)


# ---- x1: the dissection table ---------------------------------------------------------------------------------------

SV = 12 * PXG                     # the slab: half depth (0.375)
SLAB, SZ = zpx(18), zpx(21)       # its bottom, its top (the tray's bottom)
SPEC = (-0.36, 0.02)              # the specimen on it
TU, TV = 26 * PXG, -8 * PXG       # the boom tower at the back right


def _specimen(k, u, v, z):
    """A carapaced creature opened up: the shell's rim, the soft body inside, its organs, legs splayed, pinned."""
    k.cyl(u, v, z, 0.23, zpx(2), "resSpec", top="resSpecL", sides=16)                 # the rim of the shell
    k.cyl(u, v, z + zpx(2), 0.18, zpx(1), "resWingL", top="resWingL", sides=16)       # the soft body, open
    for (du, dv, s, col) in ((-0.06, 0.04, 0.09, "medRed"), (0.06, -0.02, 0.07, "resBio"), (0.0, -0.09, 0.06, "hivis")):
        k.box(u + du, v + dv, z + zpx(3), s, s, zpx(1), col)                          # organs
    for s in (-1, 1):
        for a in (0.5, 0.0, -0.5):                                                    # six legs splayed
            bar(k, (u + s * 0.22 * math.cos(a), v + 0.22 * math.sin(a), z + 0.02),
                (u + s * 0.36 * math.cos(a * 1.3), v + 0.36 * math.sin(a * 1.3), z + 0.02), 0.035, "resSpec")
    for du, dv in ((-0.3, 0.14), (0.3, -0.14)):
        k.box(u + du, v + dv, z, 0.03, 0.03, zpx(3), "steelL", top="medRed")           # pins


PLATES = ((0.2, -0.12, 0.2, 0.3), (0.44, 0.08, 0.18, -0.4), (0.66, -0.1, 0.15, 0.9))   # (u, v, size, turn)


def x1(layer):
    k = Bench(f"research_x1_{layer}", FP2)
    # the base: a cream cabinet like the bench's, instrument drawers at the left, a service panel at the right
    body(k, 0.0, 0.0, 56 * PXG, 16 * PXG, SLAB, col="lvW2", top="lvW", panel="lvWS", faces=(0, 1), lip=None)
    stack(k, "v", -0.42, 8 * PXG, 24 * PXG, 2, 18)
    k.box(0.42, 8 * PXG + 0.002, zpx(5), 24 * PXG, 0.004, zpx(10), "lvWS")
    _gold_line(k, 0.42, 8 * PXG + 0.004, zpx(12), 14 * PXG)
    # the slab over it, a gold line along its lip, the dark steel tray
    k.box(0.0, 0.0, SLAB, 60 * PXG, 2 * SV, SZ - SLAB, "lvW2", top="lvW")
    _gold_line(k, 0.0, SV, SLAB + zpx(1), 56 * PXG)
    k.box(0.0, 0.0, SZ, 54 * PXG, 18 * PXG, zpx(1), "gm", top="steelD")
    _specimen(k, SPEC[0], SPEC[1], SZ + zpx(1))
    for u, v, s, rz in PLATES:                                                        # its shell plates, laid out,
        k.box(u, v, SZ + zpx(1), s, s * 0.75, zpx(2), "resSpec", top="resSpecL", rz=rz)
        k.box(u, v + s * 0.5 + 0.03, SZ + zpx(1), 0.06, 0.03, 0.006, "lvW")            # each tagged
    for i in range(3):                                                                # tools along the front edge
        k.box(-0.02 + i * 0.08, 0.27, SZ + zpx(1), 0.02, 0.14, zpx(1), ("steelL", "steelL", "brass")[i], rz=0.15)
    # the boom tower at the back right: a cream column, a gold seam, the boom out over the specimen
    k.box(TU, TV, SZ, 4 * PXG, 4 * PXG, zpx(34), "lvW2", top="lvW")
    k.box(TU, TV + 2 * PXG + 0.002, SZ + zpx(4), 0.004 + 2 * PXG, 0.004, zpx(20), G)   # (a gold seam down its face)
    bz = SZ + zpx(31)
    bu0 = SPEC[0] - 2 * PXG
    k.box((bu0 + TU) / 2, TV, bz, TU - bu0, 4 * PXG, zpx(3), "lvW2", top="lvW")        # the boom,
    _gold_line(k, (bu0 + TU) / 2, TV + 2 * PXG, bz + zpx(1), TU - bu0 - 6 * PXG)
    # the surgical light: a drop off the boom's end, a disc with a gold ring and a lit face
    lu, lv, lz = SPEC[0], SPEC[1] - 0.04, SZ + zpx(21)
    bar(k, (lu, TV, bz), (lu, lv, lz + zpx(3)), 0.05, "lvWS")
    k.cyl(lu, lv, lz + zpx(3), 0.04, zpx(1), "brass", sides=10)
    k.cyl(lu, lv, lz, 0.18, zpx(3), "lvW2", top="lvW", sides=20)
    ring(k, "z", lu, lv, lz + zpx(1), 0.18, 20, zpx(1), 0.012, G)
    k.cyl(lu, lv, lz - 0.006, 0.13, 0.006, "resLamp", sides=16)
    # the manipulator off the tower: brass joints, a steel forearm, a gold tool tip over the plates
    a, b, c = (TU - 0.04, TV + 0.04, SZ + zpx(20)), (0.6, 0.04, SZ + zpx(14)), (0.42, 0.06, SZ + 0.1)
    bar(k, a, b, 0.05, "lvW2")
    bar(k, b, c, 0.035, "steelL")
    for p in (a, b):
        k.cyl(p[0], p[1], p[2] - 0.03, 0.04, 0.06, "brass", sides=10)
    k.box(c[0], c[1], c[2] - 0.05, 0.03, 0.03, 0.05, G)
    return k.build()


def x1_holo():
    """The exploded view: each plate floating over the specimen where it came off, a leader down to where it lies."""
    k = K("research_x1_holo", FP2, 0)
    u0, v0 = SPEC
    for i, (u, v, s, rz) in enumerate(PLATES):
        a = (i - 1) * 0.7
        fu, fv, fz = u0 + 0.14 * math.sin(a), v0 + 0.06 * math.cos(a), SZ + 0.2 + i * 0.1
        k.box(fu, fv, fz, s, s * 0.75, 0.012, F, rz=rz)                               # the ghost plate,
        ca, sa = math.cos(rz), math.sin(rz)
        cs = [(fu + ca * x - sa * y, fv + sa * x + ca * y, fz + 0.012) for x, y in
              ((-s / 2, -s * 0.375), (s / 2, -s * 0.375), (s / 2, s * 0.375), (-s / 2, s * 0.375))]
        for p, q in zip(cs, cs[1:] + cs[:1]):                                          # outlined,
            bar(k, p, q, 0.015, G)
        bar(k, (fu, fv, fz), (u, v, SZ + 0.05), 0.015, G)                              # its leader
    for su in (-1, 1):                                                               # a bracket round the specimen
        for sv in (-1, 1):
            p = (u0 + su * 0.26, v0 + sv * 0.2, SZ + 0.06)
            bar(k, p, (p[0] - su * 0.08, p[1], p[2]), 0.015, G)
            bar(k, p, (p[0], p[1] - sv * 0.08, p[2]), 0.015, G)
    return k


# ---- y1: the sample analyzer ----------------------------------------------------------------------------------------

CB0, CB1, CH = -13 * PXG, 10 * PXG, zpx(22)    # the cabinet: back, front, height
CHAMBER = (-0.46, -0.06)
CAROUSEL = (0.46, -0.04)


def y1(layer):
    k = Bench(f"research_y1_{layer}", FP2)
    cv = (CB0 + CB1) / 2
    body(k, 0.0, cv, 60 * PXG, CB1 - CB0, CH, col="lvW2", top="lvW", panel="lvWS", faces=(0, 1), lip=None)
    stack(k, "v", -0.5, CB1, 24 * PXG, 2, 22)                                          # sample drawers (left)
    k.box(0.46, CB1 + 0.002, zpx(5), 24 * PXG, 0.004, zpx(13), "lvWS")                 # a service panel (right),
    _gold_line(k, 0.46, CB1 + 0.004, zpx(15), 16 * PXG)                               # its status light
    # the chamber: a cream base and cap, glass between, fluid, the specimen held on a post, gold rings
    u, v = CHAMBER
    k.cyl(u, v, CH, 0.28, zpx(4), "lvW2", top="lvW", sides=24)
    ring(k, "z", u, v, CH + zpx(2), 0.28, 24, zpx(1), 0.012, G)
    gz, gh = CH + zpx(4), 0.44
    k.part("glass").cyl(u, v, gz, 0.22, gh, "glassL", top="glassL", sides=20)
    k.part("fluid").cyl(u, v, gz, 0.205, gh - 0.06, "resFluid", sides=20)
    k.cyl(u, v, gz, 0.025, 0.14, "steelL", sides=8)                                   # the post,
    sz = gz + 0.14
    k.cyl(u, v, sz, 0.09, 0.12, "resSpec", top="resSpecL", sides=12, rtop=0.05)        # the specimen: a pod,
    for i in range(4):
        a = i * math.tau / 4 + 0.4
        bar(k, (u + 0.08 * math.cos(a), v + 0.08 * math.sin(a), sz + 0.06),
            (u + 0.15 * math.cos(a + 0.5), v + 0.15 * math.sin(a + 0.5), sz + 0.2), 0.025, "resFrond")   # fronds
    k.box(u, v + 0.07, sz + 0.05, 0.03, 0.02, 0.03, "resBio")
    cz = gz + gh
    k.cyl(u, v, cz, 0.28, zpx(5), "lvW2", top="lvW", sides=24)
    ring(k, "z", u, v, cz - zpx(1), 0.24, 24, zpx(1), 0.012, G)
    k.cyl(u, v, cz + zpx(5), 0.1, zpx(3), "brass", top="steelL", sides=12)
    # the carousel: a turntable of vials, a pipette gantry from the back
    u, v = CAROUSEL
    k.cyl(u, v, CH, 0.27, zpx(2), "gm", top="steelD", sides=24)
    k.cyl(u, v, CH + zpx(2), 0.08, zpx(3), "lvW2", top="lvW", sides=12)
    tops = ("resBio", "medRed", "hivis", "resBio", "resVio", "medRed", "resBio", "hivis", "resVio", "resBio")
    for i, col in enumerate(tops):
        a = i * math.tau / len(tops)
        vu, vv = u + 0.19 * math.cos(a), v + 0.19 * math.sin(a)
        k.part("glass").cyl(vu, vv, CH + zpx(2), 0.03, 0.15, "glassL", sides=8)
        k.cyl(vu, vv, CH + zpx(2), 0.022, 0.09, col, sides=8)
        k.cyl(vu, vv, CH + zpx(2) + 0.15, 0.033, zpx(1), "lvW", sides=8)
    pu, pv = u + 0.3, CB0 + 3 * PXG                                                     # the gantry's post,
    k.box(pu, pv, CH, 4 * PXG, 4 * PXG, zpx(22), "lvW2", top="lvW")
    tz = CH + zpx(20)
    k.box((pu + u) / 2 - 0.05, pv, tz, pu - u + 0.15, 4 * PXG, zpx(2), "lvW2", top="lvW")   # its rail,
    k.box(u + 0.19, pv + 0.06, tz - 0.02, 0.06, 0.12, 0.08, "brass")                   # the head on it,
    k.box(u + 0.19, pv + 0.1, CH + 0.24, 0.02, 0.02, tz - CH - 0.26, "steelL")         # its pipette,
    k.box(u + 0.19, pv + 0.1, CH + 0.2, 0.02, 0.02, 0.04, G)                           # lit at the tip
    return k.build()


def y1_holo():
    """The sample's spectrum on a pane between the units, and a molecule turning over the chamber."""
    k = K("research_y1_holo", FP2, 0)
    _pane(k, 0.02, -0.2, CH + 0.5, 0.4, 0.28, 0.1, G, F, ((0, 1, 0.3), (0, 0.66, 0.2), (0, 0.33, 0.34), (0, 0.0, 0.16)))
    u, v = CHAMBER
    mz = CH + 0.86
    atoms = [(0.0, 0.0, 0.0), (0.14, 0.04, 0.06), (-0.12, 0.06, 0.08), (0.04, -0.12, 0.1), (0.2, -0.08, -0.06),
             (-0.18, -0.06, -0.04)]
    for i, (a, b, c) in enumerate(atoms):
        k.box(u + a, v + b, mz + c, 0.06, 0.06, 0.06, G if i % 2 == 0 else F, rz=0.785)
    for i, j in ((0, 1), (0, 2), (0, 3), (1, 4), (2, 5)):
        p, q = atoms[i], atoms[j]
        bar(k, (u + p[0], v + p[1], mz + p[2] + 0.03), (u + q[0], v + q[1], mz + q[2] + 0.03), 0.015, G)
    bar(k, (u, v, CH + 0.76), (u, v, mz - 0.03), 0.02, G)                             # a beam up from the cap
    ring(k, "z", u, v, CH + 0.3, 0.3, 24, 0.012, 0.012, G)                           # a scan ring round the chamber
    return k


BUILD = {"x1": (x1, x1_holo, FP2), "y1": (y1, y1_holo, FP2)}
