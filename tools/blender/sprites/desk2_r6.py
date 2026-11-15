"""2x1 desk look study, round 6 (family `desk2f`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): the user's shortlist of four (E1, G2, G3, H3), each refined once, to narrow down from. Holograms as before.

  i1 E1 arc, office: wider wings whose fronts carry the bar's padded oxide panels (gunmetal frame, lit tops)
  i2 G2 podium, customs: a slim waist the front leans out from, bone end caps on the same profile, the hazard
     stripes on the foot, an oxide line under the slant's edge
  i3 G3 salvage, guard: rivets only along the edges, at a wider pitch; shorter beam feet; a hazard-painted corner
  i4 H3 retro, guard: one cream with a white top (no speckle), a shorter bezel with an orange line along its top

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .desk2_r1 import BK, FP, FR, SLAB, TOP, emitter, mug, span
from .desk2_r2 import AC, EU, EV, RI, RO, UE, arc_top, arc_v, band, e1_holo, prism
from .desk2_r4 import HU, HV, LV, MU, ZB, ZF, ZL, extrude, g2_holo, g3_holo, ibeam, quarter
from .desk2_r5 import BV0, BV1, BZ, h3_holo
from .research_kit import PXG, Bench, holo_item, ring, zpx

PAL = "desk+bar17+bar18+bar22+bar9"


# ---- i1: E1 with padded wings -----------------------------------------------------------------------------------------
WW = 0.27                                     # a wing's width


def padded(k, u0, u1, d, z0, z1):
    """The bar's padded field on a +v face at depth d: a gunmetal frame, two rows of oxide panels lit along the top."""
    span(k, u0, u1, d, d + PXG, z0, z1, "x7Gun")
    h = (z1 - z0 - zpx(3)) / 2
    for j in range(2):
        a = z0 + zpx(1) + j * (h + zpx(1))
        span(k, u0 + PXG, u1 - PXG, d + PXG, d + 2 * PXG, a, a + h - zpx(1), "x7Oxide")
        span(k, u0 + PXG, u1 - PXG, d + PXG, d + 2 * PXG, a + h - zpx(1), a + h, "k2OxideL")


def i1(rot=0):
    k = Bench(f"desk2_i1_{rot}", FP, rot)
    prism(k, arc_top(), TOP - SLAB, SLAB, "x7Gun", "r9GreyD")                                          # the top
    prism(k, arc_top(RO - 2 * PXG, RI + 2 * PXG, UE - 2 * PXG, FR - 2 * PXG), TOP - SLAB - zpx(1), zpx(1), "x7Black")
    ui = math.sqrt(RI * RI - (AC - FR) ** 2) - PXG                                                    # the front roll
    roll = [(u, arc_v(RI - 0.5 * PXG, u)) for u in (-ui + 2 * ui * i / 20 for i in range(21))]
    prism(k, roll + [(u, v - 3 * PXG) for u, v in roll[::-1]], TOP - SLAB - zpx(1), SLAB + zpx(2), "x7Oxide",
          "k2OxideL")
    prism(k, band(RO - 2 * PXG, RO - 0.2, UE - 3 * PXG), zpx(2), TOP - SLAB - zpx(3), "x7Bone", "x7Bone")  # back wall
    prism(k, band(RO - 3 * PXG, RO - 0.19, UE - 4 * PXG), 0, zpx(2), "x7Black")
    prism(k, band(RO - 0.2, RO - 0.2 - 0.5 * PXG, UE - 3 * PXG), zpx(10), zpx(1), "x7Oxide")
    for s in (-1, 1):                                                                                  # the wings
        u0, u1 = sorted((s * (UE - 3 * PXG), s * (UE - WW)))
        vb = arc_v(RO - 0.2, UE - WW)
        f = FR - 4 * PXG
        span(k, u0, u1, vb, f, zpx(2), TOP - SLAB - zpx(1), "x7Bone", top="x7Bone")
        span(k, u0 + PXG, u1 - PXG, vb, f - PXG, 0, zpx(2), "x7Black")
        padded(k, u0 + PXG, u1 - PXG, f, zpx(4), TOP - SLAB - zpx(2))
    emitter(k, EU, EV, TOP, 0.13)
    k.box(-0.58, 0.14, TOP, 0.22, 0.16, 0.012, "steelD", top="dark", rz=0.5)                          # a slate
    for i in range(3):                                                                                 # folders
        k.box(0.68, 0.2, TOP + i * 0.014, 0.16, 0.22, 0.014, ("ochM", "dkTeal", "medWhite")[i], rz=0.1 * (i - 1))
    mug(k, -0.4, -0.12)
    return k


# ---- i2: G2 with a waist and end caps ---------------------------------------------------------------------------------
FB = FR - 0.26                                # the foot's front


def i2_profile():
    return [(FB, 0.0), (FB, zpx(14)), (FR, ZF - zpx(3)), (FR, ZF), (LV, ZB), (LV, ZL), (BK, ZL), (BK, 0.0)]


def i2(rot=0):
    k = Bench(f"desk2_i2_{rot}", FP, rot)
    cap = 3 * PXG
    extrude(k, i2_profile(), "u", -1 + PXG + cap, 1 - PXG - cap, "x7Gun", top="r9GreyD")                # the body
    for s in (-1, 1):                                                                                  # end caps
        a0, a1 = sorted((s * (1 - PXG), s * (1 - PXG - cap)))
        extrude(k, i2_profile(), "u", a0, a1, "x7Bone", top="x7White")
    n = 12
    for i in range(n):                                                                                 # hazard foot
        u0 = -1 + PXG + cap + i * (2 - 2 * PXG - 2 * cap) / n
        span(k, u0, u0 + (2 - 2 * PXG - 2 * cap) / n, FB, FB + 0.5 * PXG, zpx(0.5), zpx(3.5),
             "x7Yellow" if i % 2 == 0 else "x7Black")
    span(k, -1 + PXG + cap, 1 - PXG - cap, FR, FR + 0.5 * PXG, ZF - zpx(2), ZF - zpx(1), "x7Oxide")    # under the edge
    span(k, -1 + PXG, 1 - PXG, LV - 0.5 * PXG, LV, ZB + zpx(1), ZB + zpx(2), "x7Black")                 # the slant's lip
    k.cyl(MU, BK + 0.1, ZL, 0.03, 0.62, "x7Black", sides=8)                                             # the mast
    k.box(MU - 0.08, BK + 0.12, ZL + 0.56, 0.2, 0.08, 0.06, "x7Gun", top="r9GreyD")
    span(k, MU - 0.15, MU - 0.03, BK + 0.13, BK + 0.15, ZL + 0.555, ZL + 0.56, "dkSeam")
    t = math.atan2(ZB - ZF, FR - LV)                                                                    # on the slant
    for u, v, w, d, col in ((-0.5, 0.06, 0.2, 0.14, "steelD"), (0.1, 0.12, 0.16, 0.2, "medWhite")):
        z = ZF + (FR - v) * math.tan(t)
        k.box(u, v, z, w, d, 0.012, col, top="dark" if col == "steelD" else "medWhite", rx=t)
    k.cyl(-0.6, BK + 0.1, ZL, 0.06, 0.025, "steelD", top="medRed", sides=12)                           # the stamp
    k.cyl(-0.6, BK + 0.1, ZL + 0.025, 0.022, 0.08, "dark", sides=8)
    k.cyl(-0.6, BK + 0.1, ZL + 0.1, 0.04, 0.035, "steelL", sides=10)
    return k


# ---- i3: G3 cleaned up ------------------------------------------------------------------------------------------------
def i3(rot=0):
    k = Bench(f"desk2_i3_{rot}", FP, rot)
    h = TOP - zpx(4)
    for tu in (-0.72, 0.72):                                                                           # trestles
        ibeam(k, tu - 0.06, tu + 0.06, -0.32, 0.32, 0, zpx(5), "v", "x7Black")
        ibeam(k, tu - 0.06, tu + 0.06, -0.06, 0.06, zpx(5), h, "v", "x7Black")
        span(k, tu - 0.06, tu + 0.06, -0.38, 0.38, h - zpx(2), h, "x7Black")
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR, h, TOP, "x7Steel", top="r9Grey")                          # the plate
    span(k, -1 + 2 * PXG, -0.3, FR, FR + 0.4 * PXG, h + zpx(1), TOP - zpx(1), "rust")                   # a scuff
    for i in range(4):                                                                                 # hazard corner
        a = 0.62 + i * 0.09
        span(k, a, a + 0.045, FR, FR + 0.4 * PXG, h + zpx(1), TOP - zpx(1), "x7Yellow")
    for u in (-0.84, -0.42, 0.0, 0.42, 0.84):                                                          # rivets
        span(k, u - 0.5 * PXG, u + 0.5 * PXG, FR - 3 * PXG, FR - 2 * PXG, TOP, TOP + zpx(1), "steelL")
    span(k, -0.2, 0.4, -0.18, -0.02, TOP, TOP + zpx(0.5), "x7Gun")                                     # a weld patch
    span(k, HU - 0.1, HU + 0.1, HV - 0.08, HV + 0.08, TOP, TOP + zpx(2), "x7Black")                    # searchlight
    k.box(HU, HV, TOP + zpx(2), 0.05, 0.05, 0.16, "x7Black")
    k.cyl(HU, HV, TOP + 0.16, 0.1, 0.16, "x7OliveD", top="x7Olive", sides=16)
    ring(k, "z", HU, HV, TOP + 0.32, 0.09, 16, 0.01, 0.02, "steelL")
    k.cyl(HU, HV, TOP + 0.31, 0.08, 0.012, "dkSeam", sides=16)
    k.box(0.42, 0.2, TOP, 0.4, 0.1, zpx(2), "steelD", top="dark", rz=0.12)                            # baton cradle
    k.box(0.42, 0.2, TOP + zpx(2), 0.36, 0.04, 0.04, "dark", top="gm", rz=0.12)
    k.box(-0.3, 0.2, TOP, 0.1, 0.06, 0.16, "x7Black", top="x7Gun", rz=0.3)                            # a radio
    k.cyl(0.84, -0.22, TOP, 0.06, 0.03, "steelD", top="dark", sides=12)                               # the beacon
    k.cyl(0.84, -0.22, TOP + 0.03, 0.045, 0.07, "hivis", rtop=0.02, sides=12)
    mug(k, 0.0, 0.24)
    return k


# ---- i4: H3 cleaned up ------------------------------------------------------------------------------------------------
def i4(rot=0):
    k = Bench(f"desk2_i4_{rot}", FP, rot)
    r, body, lit = 4, "x7Bone", "x7White"
    ru, rz = r * PXG, zpx(r)
    top = ([(FR, TOP - SLAB - zpx(2))] + quarter(FR - ru, TOP - rz, ru, rz, 0.0, math.pi / 2)
           + [(BV0, TOP), (BV1, BZ), (BK, BZ), (BK, TOP - SLAB - zpx(2))])
    extrude(k, top, "u", -1 + PXG, 1 - PXG, body, top=lit)
    extrude(k, [(FR + 0.5 * PXG, TOP - SLAB - zpx(1)), (FR + 0.5 * PXG, TOP - SLAB + zpx(1)),
                (FR, TOP - SLAB + zpx(1)), (FR, TOP - SLAB - zpx(1))], "u", -1 + PXG, 1 - PXG, "z8Orange")
    d = 0.6 * PXG                                                                                       # the glass
    extrude(k, [(BV0 - 0.04 + d, TOP + zpx(2)), (BV1 + 0.03 + d, BZ - zpx(2)), (BV1 + 0.03, BZ - zpx(2)),
                (BV0 - 0.04, TOP + zpx(2))], "u", -0.66, 0.66, "dkGlass")
    span(k, -1 + PXG, 1 - PXG, BV1 - PXG, BV1, BZ, BZ + zpx(1), "z8Orange")                              # bezel line
    for s in (-1, 1):                                                                                  # pedestals
        u0, u1 = sorted((s * (1 - 2 * PXG), s * 0.62))
        hp = TOP - SLAB - zpx(2)
        ped = ([(FR - 2 * PXG, 0.0)] + quarter(FR - 2 * PXG - ru, hp - rz, ru, rz, 0.0, math.pi / 2)
               + [(BK + 2 * PXG, hp), (BK + 2 * PXG, 0.0)])
        extrude(k, ped, "u", u0, u1, body, top=lit)
        span(k, u0 + 2 * PXG, u1 - 2 * PXG, FR - 2 * PXG, FR - 1.5 * PXG, zpx(4), zpx(6), "z8Orange")
    k.box(0.0, 0.16, TOP, 0.5, 0.16, zpx(2), "x7Khaki", top=lit)                                        # keyboard
    for i in range(6):
        k.box(-0.2 + i * 0.08, 0.16, TOP + zpx(2), 0.05, 0.1, zpx(0.6), "z8Char")
    k.box(-0.7, 0.12, TOP, 0.12, 0.26, zpx(2), "x7Black", top="x7Gun")                                # the handset
    k.box(-0.7, 0.12, TOP + zpx(2), 0.06, 0.24, zpx(2), "z8Orange", top="z8OrangeL")
    k.cyl(0.84, 0.0, TOP, 0.06, 0.03, "steelD", top="dark", sides=12)                                 # the beacon
    k.cyl(0.84, 0.0, TOP + 0.03, 0.045, 0.07, "hivis", rtop=0.02, sides=12)
    mug(k, 0.6, 0.24)
    return k


DESIGNS = {"i1": (i1, e1_holo), "i2": (i2, g2_holo), "i3": (i3, g3_holo), "i4": (i4, h3_holo)}


def _holo(v):
    def run(v=v):                            # (the default keys the render cache)
        core.clear_scene_meshes()
        post.select(PAL)
        mask = DESIGNS[v][0]().build()
        it = holo_item(f"module.desk2.{v}.holo", FP, mask, DESIGNS[v][1]().build())
        return [it] if it else []
    return run


def jobs():
    out = []
    for v in DESIGNS:
        out += [(f"module.desk2.{v}", FP, "prop", lambda v=v: DESIGNS[v][0]().build()), _holo(v)]
    return out
