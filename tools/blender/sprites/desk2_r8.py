"""2x1 desk look study, round 8 (family `desk2h`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): round 7's J1 reception counter (user: good conceptually) with the officer's screen and keyboard replaced by
holograms (user: they read as present-day). The officer sits behind the left tile, so their side is projected over the
left half; the visitor stands at the right tile, where their ID floats over the ledge from a puck (as J1).

  k1 holo screen: a slot in the work top throws an upright pane at the officer, a key field is projected flat on the
     top in front of them (the emitter strip along the top's back edge)
  k2 holo wrap: three panes in a shallow arc round the officer's seat, each from its own small emitter on the top; no
     keys (they work the panes by hand)
  k3 holo table: the officer's half of the top is a dark glass well with a lit rim; a record and a head-and-shoulders of
     whoever is being checked float over it on light columns, high enough to show over the visitor's ledge

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""

from . import core, post
from .desk2_r1 import BK, FP, FR, F, L, SLAB, TOP, emitter, figure, mug, pane, rows, span
from .desk2_r4 import _pane_turned
from .desk2_r7 import LV, LZ
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk+bar17+bar18+bar22+bar9"
PU, PV = 0.5, 0.33                            # the visitor's ID puck (right half, on the ledge)
OU = -0.5                                     # the officer's middle (left half)


def counter(name, rot):
    """J1's body: the visitor's panel and ledge, the end panels, the officer's lower work top; the ID puck, a stamp."""
    k = Bench(name, FP, rot)
    span(k, -1 + PXG, 1 - PXG, FR - 4 * PXG, FR, zpx(2), LZ - zpx(3), "x7Bone", top="x7Bone")           # front panel
    span(k, -1 + 2 * PXG, 1 - 2 * PXG, FR - 4 * PXG, FR - PXG, 0, zpx(2), "x7Black")
    span(k, -1 + PXG, 1 - PXG, FR, FR + 0.5 * PXG, zpx(12), zpx(14), "dkTeal")                          # a teal band
    span(k, -1 + PXG, 1 - PXG, LV, FR + PXG, LZ - zpx(3), LZ, "x7Gun", top="r9GreyD")                   # the ledge
    for s in (-1, 1):                                                                                  # end panels
        span(k, *sorted((s * (1 - PXG), s * (1 - 4 * PXG))), BK + PXG, FR - 4 * PXG, 0, LZ - zpx(3), "x7Bone",
             top="x7Bone")
    span(k, -1 + 4 * PXG, 1 - 4 * PXG, BK + PXG, LV + PXG, TOP - SLAB, TOP, "x7Gun", top="r9GreyD")      # work top
    span(k, -1 + 4 * PXG, 1 - 4 * PXG, LV + PXG, LV + 2 * PXG, TOP, LZ - zpx(3), "x7Bone")              # ledge riser
    k.cyl(PU, PV, LZ, 0.07, zpx(2), "x7Black", top="x7Gun", sides=16)                                   # the ID puck
    emitter(k, PU, PV, LZ + zpx(2), 0.055)
    k.cyl(-0.2, 0.34, LZ, 0.05, 0.02, "steelD", top="medRed", sides=12)                                # the stamp
    k.cyl(-0.2, 0.34, LZ + 0.02, 0.02, 0.06, "dark", sides=8)
    mug(k, 0.66, -0.24)
    return k


def visitor_id(k):
    z = LZ + zpx(3) + 0.04
    bar(k, (PU, PV, LZ + zpx(3)), (PU, PV, z), 0.015, L)
    pane(k, PU, PV, z, 0.4, 0.24, rows(0.4, 0.24, (0.12, 0.1, 0.14), x0=0.2) + [(0.12, 0.03, 0.1, 0.04, "dkGo")])
    figure(k, PU - 0.12, PV + 0.014, z + 0.03, 0.6)


def slot(k, u0, u1, v):
    """An emitter slot in the work top: dark glass, a lit line."""
    span(k, u0, u1, v - 1.5 * PXG, v + 1.5 * PXG, TOP, TOP + zpx(0.5), "x7Black", top="dkGlass")
    span(k, u0 + PXG, u1 - PXG, v - 0.4 * PXG, v + 0.4 * PXG, TOP + zpx(0.5), TOP + zpx(1), "dkSeam")


# ---- k1 holo screen ---------------------------------------------------------------------------------------------------
SV = 0.06                                     # k1's screen slot


def k1(rot=0):
    k = counter(f"desk2_k1_{rot}", rot)
    slot(k, OU - 0.28, OU + 0.28, SV)
    slot(k, OU - 0.24, OU + 0.24, BK + 4 * PXG)                                                         # key emitter
    return k


def k1_holo():
    k = K("desk2_k1_holo", FP, 0)
    pane(k, OU, SV, TOP + zpx(1), 0.52, 0.3, rows(0.52, 0.3, (0.3, 0.2, 0.36, 0.24)) + [(0.16, 0.05, 0.1, 0.08)])
    ku, kv, w, d, z = OU, -0.2, 0.44, 0.16, TOP + 0.006                                                  # the key field
    k.box(ku, kv, z, w, d, 0.004, F)
    for x in (-w / 2, w / 2 - 0.02):
        k.box(ku + x + 0.01, kv, z, 0.02, d, 0.006, L)
    for y in (-d / 2, d / 2 - 0.02):
        k.box(ku, kv + y + 0.01, z, w, 0.02, 0.006, L)
    for i in range(6):
        for j in range(2):
            k.box(ku - 0.17 + i * 0.068, kv - 0.035 + j * 0.07, z, 0.04, 0.04, 0.006, L)
    visitor_id(k)
    return k


# ---- k2 holo wrap -----------------------------------------------------------------------------------------------------
WRAP = ((-0.88, -0.12, 0.9), (OU, 0.04, 0.0), (-0.12, -0.12, -0.9))    # k2's panes: u, v, turn


def k2(rot=0):
    k = counter(f"desk2_k2_{rot}", rot)
    for u, v, rz in WRAP:
        k.cyl(u, v, TOP, 0.045, zpx(1.5), "x7Black", top="x7Gun", sides=12)
        emitter(k, u, v, TOP + zpx(1.5), 0.035)
    return k


def k2_holo():
    k = K("desk2_k2_holo", FP, 0)
    for i, (u, v, rz) in enumerate(WRAP):
        z = TOP + zpx(3) + 0.03
        bar(k, (u, v, TOP + zpx(2.5)), (u, v, z), 0.012, L)
        w = 0.4 if i == 1 else 0.3
        marks = rows(w, 0.26, (0.22, 0.14, 0.26)) if i != 1 else [(0.0, 0.12, 0.3, 0.02), (0.06, 0.06, 0.02, 0.14),
                                                                  (-0.1, 0.17, 0.04, 0.04, "dkAmber")]
        _pane_turned(k, u, v + 0.02, z, w, 0.26, rz, marks)
    visitor_id(k)
    return k


# ---- k3 holo table ----------------------------------------------------------------------------------------------------
WU0, WU1, WV0, WV1 = -0.92, -0.1, BK + 3 * PXG, LV - 2 * PXG    # k3's glass well


def k3(rot=0):
    k = counter(f"desk2_k3_{rot}", rot)
    span(k, WU0, WU1, WV0, WV1, TOP, TOP + zpx(0.5), "x7Black", top="dkGlass")                          # the glass
    for a0, a1, b0, b1 in ((WU0, WU1, WV0, WV0 + 0.5 * PXG), (WU0, WU1, WV1 - 0.5 * PXG, WV1),
                           (WU0, WU0 + 0.5 * PXG, WV0, WV1), (WU1 - 0.5 * PXG, WU1, WV0, WV1)):
        span(k, a0, a1, b0, b1, TOP + zpx(0.5), TOP + zpx(1), "dkSeam")                                  # its rim
    return k


def k3_holo():
    """The record and the bust float high enough to show over the visitor's ledge, on light columns from the well."""
    k = K("desk2_k3_holo", FP, 0)
    cu, cv = (WU0 + WU1) / 2, (WV0 + WV1) / 2
    pu, bu, bv = cu - 0.16, cu + 0.24, cv - 0.04
    lift = LZ - TOP + 0.02
    for u, v in ((pu - 0.15, cv + 0.02), (pu + 0.15, cv + 0.02), (bu, bv)):
        bar(k, (u, v, TOP + zpx(1)), (u, v, TOP + lift), 0.012, L)
    pane(k, pu, cv + 0.02, TOP + lift, 0.4, 0.28, rows(0.4, 0.28, (0.24, 0.16, 0.28, 0.2)))           # the record
    bz = TOP + lift                                                                                      # the bust
    k.cyl(bu, bv, bz, 0.08, 0.06, F, rtop=0.05, sides=12)
    ring(k, "z", bu, bv, bz, 0.08, 14, 0.01, 0.018, L)
    k.cyl(bu, bv, bz + 0.06, 0.02, 0.03, F, sides=8)
    k.cyl(bu, bv, bz + 0.09, 0.045, 0.09, F, rtop=0.035, sides=12)
    ring(k, "z", bu, bv, bz + 0.14, 0.05, 14, 0.01, 0.015, L)
    ring(k, "z", bu, bv, bz - 0.03, 0.1, 18, 0.008, 0.02, L)                                            # its scan ring
    visitor_id(k)
    return k


DESIGNS = {"k1": (k1, k1_holo), "k2": (k2, k2_holo), "k3": (k3, k3_holo)}


def _holo(v):
    def run(v=v):                            # (the default keys the render cache)
        core.clear_scene_meshes()
        post.select(PAL)
        mask = DESIGNS[v][0]().build()
        it = holo_item(f"module.desk2.{v}.holo", FP, mask, DESIGNS[v][1]().build())
        return [it] if it else []
    return run


def jobs():
    from .desk2_r7 import chair
    out = [("module.desk2.chair", (1, 1), "prop", chair)]
    for v in DESIGNS:
        out += [(f"module.desk2.{v}", FP, "prop", lambda v=v: DESIGNS[v][0]().build()), _holo(v)]
    return out
