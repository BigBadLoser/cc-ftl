"""Office desk look study, round 5 (family `desk`, palette set desk, preview only): blank desks. Every one keeps the
round projection post of round 3's navigator's desk on the right (a lit drum pedestal under a round end, the holo
well in it); the rest of the desk varies. No props, no holograms: the dressing comes later, per post.

Local frame modkit.K, footprint (2, 2): u across, v deep, the front +v toward the camera at r0. The desk stands on
the back row (v BACK..FRONT), the chair in the front-left tile facing it (the console sit pose: desktop height TOP).

  b1 ledge      the round-4 desk bare: the slab, an end panel, an instrument ledge along the back with a glass face
  b2 sled       a thin top, its front edge lit underneath; the free end on a graphite sled leg
  b3 capsule    round at both ends: the left end on a slim lit column at the back
  b4 spine      the slab on a graphite back spine with the drum's lit band running along it
  b5 screen     a tall privacy screen along the back, a glass band and a lit top edge, with a rounded end"""

from . import console_proto as C
from . import core
from .cmbkit import Frame
from .modkit import K
from .research_kit import PXG, Bench, bar, ring, zpx

PAL = "desk"
FP = (2, 2)
CHAIR = (-0.5, 0.5)                          # the chair tile (local u, v)
TOP = zpx(26)                                # desktop height (the sit pose's hands)
BACK, FRONT = -31 * PXG, -5 * PXG            # the desk's back and front planes, on the u/v grid
VM, D = (BACK + FRONT) / 2, FRONT - BACK     # its middle and depth
WU, WR = 0.5, D / 2                          # the round end: centre u (at VM), radius
SLAB = zpx(4)                                # the top's thickness
BAND = zpx(11)                               # the lit band's height on the drum


class _Chair(Frame):
    def poly(self, pts, color, flip=False):
        super().poly(pts, {"navy": "dkTeal"}.get(color, color), flip)


def chair(rot=0):
    m = core.Mesh(f"desk_chair_{rot}")
    C.chair(_Chair(m, rot, centre=K("desk_chair_xy", FP, rot).p(*CHAIR)), 0.0, 0.0, False)
    return m.build()


def post(k, slab=SLAB):
    """The round projection post: the drum pedestal with its lit band, the round end, the holo well."""
    k.cyl(WU, VM, 0.0, 0.26, zpx(2), "dkGraphD", sides=24)
    k.cyl(WU, VM, zpx(2), 0.3, TOP - slab - zpx(2), "lvW2", top="lvW", sides=24)
    k.cyl(WU, VM, BAND, 0.305, zpx(1), "dkSeam", sides=24)
    k.cyl(WU, VM, TOP - slab, WR, slab, "lvW2", top="lvW", sides=28)
    k.cyl(WU, VM, TOP, 0.24, zpx(1), "dkGraph", top="dkGlass", sides=24)
    ring(k, "z", WU, VM, TOP + zpx(1), 0.215, 24, 0.008, 0.03, "dkSeam")


def slab(k, u0=-0.98, u1=WU, t=SLAB):
    k.box((u0 + u1) / 2, VM, TOP - t, u1 - u0, D, t, "lvW2", top="lvW")


def end_panel(k, t=SLAB):
    k.box(-0.98 + 2 * PXG, VM, 0.0, 4 * PXG, D - 4 * PXG, TOP - t, "lvW2", top="lvW")


# ---- the variants -----------------------------------------------------------------------------------------------------
def b1(rot=0):
    k = Bench(f"desk_b1_{rot}", FP, rot)
    post(k)
    slab(k)
    end_panel(k)
    k.box(-0.48, BACK + 4 * PXG, zpx(10), 0.9, 2 * PXG, zpx(3), "dkGraph")                  # the back stretcher
    k.box(-0.42, BACK + 4 * PXG, TOP, 1.1, 8 * PXG, zpx(7), "lvW2", top="lvW")               # the ledge, its glass face
    k.box(-0.42, BACK + 8 * PXG + PXG / 2, TOP + zpx(1), 1.02, PXG, zpx(5), "dkGlass")
    return k


def b2(rot=0):
    k = Bench(f"desk_b2_{rot}", FP, rot)
    t = zpx(3)
    post(k, t)
    slab(k, t=t)
    k.box(-0.24, FRONT - 2 * PXG, TOP - t - zpx(1), 1.4, 2 * PXG, zpx(1), "dkSeam")          # the lit underside edge
    lu = -0.9                                                                            # the sled leg
    for v in (BACK + 0.1, FRONT - 0.1):
        k.box(lu, v, 0.0, 3 * PXG, 3 * PXG, TOP - t, "dkGraph", top="dkGraphD")
    k.box(lu, VM, 0.0, 4 * PXG, D - 0.08, zpx(2), "dkGraph", top="dkGraphD")
    k.box(lu, VM, TOP - t - zpx(2), 4 * PXG, D - 0.12, zpx(2), "dkGraph")
    bar(k, (lu, BACK + 0.12, zpx(14)), (WU - 0.3, BACK + 0.12, zpx(14)), 0.04, "dkGraph")      # a back rail to the post
    return k


def b3(rot=0):
    k = Bench(f"desk_b3_{rot}", FP, rot)
    post(k)
    cu = -0.98 + WR                                                                      # the left round end
    slab(k, cu, WU)
    k.cyl(cu, VM, TOP - SLAB, WR, SLAB, "lvW2", top="lvW", sides=28)
    cv = BACK + 0.16                                                                     # its column, at the back
    k.cyl(cu, cv, 0.0, 0.12, zpx(2), "dkGraphD", sides=16)
    k.cyl(cu, cv, zpx(2), 0.07, TOP - SLAB - zpx(2), "lvW2", top="lvW", sides=16)
    k.cyl(cu, cv, BAND, 0.075, zpx(1), "dkSeam", sides=16)
    k.cyl(cu, VM, TOP - SLAB - zpx(1), WR - 0.04, zpx(1), "dkGraph", sides=28)               # the reveals under the
    k.box((cu + WU) / 2, VM, TOP - SLAB - zpx(1), WU - cu, D - 0.08, zpx(1), "dkGraph")       # top
    return k


def b4(rot=0):
    k = Bench(f"desk_b4_{rot}", FP, rot)
    post(k)
    slab(k)
    su, sw, sd = (-0.98 + WU - 0.2) / 2, WU - 0.2 + 0.98, 10 * PXG                          # the back spine
    k.box(su, BACK + sd / 2, 0.0, sw, sd, TOP - SLAB, "dkGraph", top="dkGraphD")
    k.box(su, BACK + sd / 2, 0.0, sw - 0.04, sd - 0.02, zpx(2), "dkGraphD")
    k.box(su, BACK + sd + PXG / 2, BAND, sw, PXG, zpx(1), "dkSeam")                          # the band along it
    k.box(-0.98 + 2 * PXG, BACK + sd + PXG / 2, zpx(3), 4 * PXG, PXG, TOP - SLAB - zpx(6), "dkGraphD")
    return k


def b5(rot=0):
    k = Bench(f"desk_b5_{rot}", FP, rot)
    post(k)
    slab(k)
    end_panel(k)
    sh, sv, st = zpx(18), BACK + 2 * PXG, 4 * PXG                                           # the screen
    su0, su1 = -0.98, WU - 0.12
    k.box((su0 + su1) / 2, sv, TOP, su1 - su0, st, sh, "lvW2", top="lvW")
    k.box((su0 + su1) / 2, sv + st / 2 + PXG / 2, TOP + zpx(5), su1 - su0 - 0.08, PXG, zpx(8), "dkGlass")
    k.box((su0 + su1) / 2, sv, TOP + sh, su1 - su0, st, zpx(1), "dkSeam")
    k.cyl(su1, sv, TOP, st / 2 + PXG, sh + zpx(1), "lvW2", top="dkSeam", sides=12)           # its rounded end
    return k


DESIGNS = {"b1": b1, "b2": b2, "b3": b3, "b4": b4, "b5": b5}


def jobs():
    print("DESK chair from origin", K("desk_chair_xy", FP, 0).p(*CHAIR), flush=True)
    return [(f"module.desk.{v}" + (f".r{r}" if r else ""), FP, "prop", lambda f=f, r=r: f(r).build() + [chair(r)])
            for v, f in DESIGNS.items() for r in (0, 1, 2, 3)]
