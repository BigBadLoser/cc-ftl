"""2x1 desk look study, round 10 (family `desk2j`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): three takes on round 9's L1 curved pod (user: "isn't terrible"). The visitor stands at the front (+v) at a
raised curved ledge, the officer sits behind the left half; the officer's record rises from the ledge's inner edge,
the visitor's ID from a puck (or the glass) on the ledge.

  n1 padded: L1's shallow arc, its face covered in the bar's padded oxide panels (gunmetal frames, lit tops), bone
     end panels, a gunmetal ledge with an oxide roll
  n2 D pod: the face is a half-ellipse that wraps right round to the back corners (no square ends), bone, one
     oxide line; the ledge follows it all the way round
  n3 two-tone: L1's arc with a gunmetal lower band and a bone upper face, the ledge dark glass with a lit front edge;
     the visitor's ID rises out of the glass

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .desk2_r1 import BK, FP, FR, L, SLAB, TOP, emitter, mug, span
from .desk2_r2 import prism
from .desk2_r9 import LZ, id_pane, record
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, zpx

PAL = "desk+bar17+bar18+bar22+bar9"
UE = 1 - PXG
CC, CR = -1.6, 2.1 - PXG                       # n1 and n3's front arc: centre v, radius
LW = 0.26                                      # a ledge's depth


def fv(r, u):
    return CC + math.sqrt(r * r - u * u)


def arc_band(ro, ri, ue=UE, n=24):
    a = [(u, fv(ro, u)) for u in (-ue + 2 * ue * i / n for i in range(n + 1))]
    return a + [(u, fv(ri, u)) for u in (ue - 2 * ue * i / n for i in range(n + 1))]


def officer_slot(k, v):
    """The record's emitter slot along the ledge's inner edge, over the officer's half."""
    span(k, -0.72, -0.18, v - 0.04, v, LZ - zpx(5), LZ - zpx(4), "x7Black", top="dkGlass")
    span(k, -0.7, -0.2, v - 0.025, v - 0.015, LZ - zpx(4), LZ - zpx(3.5), "dkSeam")


def arc_body(k, face, face_top, ledge, ledge_top):
    """L1's arc: the face, its kick, the ledge, square end panels, the work top behind, the ledge's riser."""
    prism(k, arc_band(CR - PXG, CR - 5 * PXG), zpx(2), LZ - zpx(7), face, face_top)
    prism(k, arc_band(CR - 2 * PXG, CR - 5 * PXG, UE - PXG), 0, zpx(2), "x7Black")
    prism(k, arc_band(CR, CR - LW), LZ - zpx(5), zpx(5), ledge, ledge_top)
    for s in (-1, 1):
        span(k, *sorted((s * UE, s * (UE - 4 * PXG))), BK + PXG, fv(CR - 5 * PXG, UE), 0, LZ - zpx(5), "x7Bone",
             top="x7Bone")
    vi = fv(CR - LW, 0.0)
    span(k, -UE + 4 * PXG, UE - 4 * PXG, BK + PXG, vi - 0.06, TOP - SLAB, TOP, "x7Gun", top="r9GreyD")
    prism(k, arc_band(CR - LW, CR - LW - 0.08, UE - 4 * PXG), TOP - SLAB, LZ - zpx(5) - TOP + SLAB, "x7Bone", "x7Bone")
    officer_slot(k, vi - 0.06)
    return vi


# ---- n1 padded --------------------------------------------------------------------------------------------------------
def n1(rot=0):
    k = Bench(f"desk2_n1_{rot}", FP, rot)
    arc_body(k, "x7Gun", "x7Gun", "x7Gun", "r9GreyD")
    prism(k, arc_band(CR + 0.5 * PXG, CR - 2.5 * PXG), LZ - zpx(4), zpx(4.5), "x7Oxide", "k2OxideL")     # the roll
    n, z0, z1 = 6, zpx(4), LZ - zpx(8)
    h = (z1 - z0 - zpx(1)) / 2
    for i in range(n):                                                                                 # the panels
        u = -UE + 0.06 + (i + 0.5) * (2 * UE - 0.12) / n
        w = (2 * UE - 0.12) / n - 2 * PXG
        s = math.sqrt((CR - PXG) ** 2 - u * u)
        rz, v = math.atan2(-u, s), fv(CR - PXG, u) + 0.5 * PXG
        for j in range(2):
            a = z0 + j * (h + zpx(1))
            k.box(u, v, a, w, PXG, h - zpx(1), "x7Oxide", rz=rz)
            k.box(u, v, a + h - zpx(1), w, PXG, zpx(1), "k2OxideL", rz=rz)
    k.cyl(0.5, fv(CR - LW / 2, 0.5), LZ, 0.06, zpx(1.5), "x7Black", top="x7Gun", sides=16)            # ID puck
    emitter(k, 0.5, fv(CR - LW / 2, 0.5), LZ + zpx(1.5), 0.045)
    mug(k, 0.66, -0.26)
    return k


def n1_holo():
    k = K("desk2_n1_holo", FP, 0)
    record(k, -0.45, fv(CR - LW, 0.0) - 0.08, LZ - zpx(3), 0.5, 0.28)
    pv = fv(CR - LW / 2, 0.5)
    bar(k, (0.5, pv, LZ + zpx(2)), (0.5, pv, LZ + 0.06), 0.012, L)
    id_pane(k, 0.5, pv, LZ + 0.06)
    return k


# ---- n2 D pod ---------------------------------------------------------------------------------------------------------
EA, EB, EV = UE, FR - BK - PXG, BK + PXG       # n2's half-ellipse: semi-axes along u and v, its back line


def ell(a, b, n=28):
    return [(a * math.cos(t), EV + b * math.sin(t)) for t in (math.pi * i / n for i in range(n + 1))]


def ell_band(d0, d1):
    """The strip between the half-ellipse grown in by d0 and by d1 (d0 < d1)."""
    return ell(EA - d0, EB - d0) + ell(EA - d1, EB - d1)[::-1]


def ev(d, u):
    a, b = EA - d, EB - d
    return EV + b * math.sqrt(max(0.0, 1 - (u / a) ** 2))


def n2(rot=0):
    k = Bench(f"desk2_n2_{rot}", FP, rot)
    prism(k, ell_band(PXG, 5 * PXG), zpx(2), LZ - zpx(7), "x7Bone", "x7Bone")                           # the face
    prism(k, ell_band(2 * PXG, 5 * PXG), 0, zpx(2), "x7Black")
    prism(k, ell_band(0.5 * PXG, PXG), zpx(12), zpx(1), "x7Oxide")                                       # a line
    prism(k, ell_band(0.0, LW), LZ - zpx(5), zpx(5), "x7Gun", "r9GreyD")                                 # the ledge
    prism(k, ell_band(-0.5 * PXG, 2.5 * PXG), LZ - zpx(4), zpx(4.5), "x7Oxide", "k2OxideL")              # its roll
    prism(k, ell(EA - LW, EB - LW), TOP - SLAB, SLAB, "x7Gun", "r9GreyD")                               # work top
    prism(k, ell_band(LW, LW + 0.08), TOP, LZ - zpx(5) - TOP, "x7Bone", "x7Bone")                        # ledge riser
    vi = ev(LW, 0.0)
    officer_slot(k, vi)
    k.cyl(0.5, ev(LW / 2, 0.5), LZ, 0.06, zpx(1.5), "x7Black", top="x7Gun", sides=16)                  # ID puck
    emitter(k, 0.5, ev(LW / 2, 0.5), LZ + zpx(1.5), 0.045)
    mug(k, 0.4, -0.3)
    return k


def n2_holo():
    k = K("desk2_n2_holo", FP, 0)
    record(k, -0.45, ev(LW, 0.0) - 0.02, LZ - zpx(3), 0.5, 0.28)
    pv = ev(LW / 2, 0.5)
    bar(k, (0.5, pv, LZ + zpx(2)), (0.5, pv, LZ + 0.06), 0.012, L)
    id_pane(k, 0.5, pv, LZ + 0.06)
    return k


# ---- n3 two-tone ------------------------------------------------------------------------------------------------------
def n3(rot=0):
    k = Bench(f"desk2_n3_{rot}", FP, rot)
    arc_body(k, "x7Bone", "x7Bone", "x7Black", "dkGlass")
    prism(k, arc_band(CR - 0.5 * PXG, CR - 5 * PXG, UE - PXG), zpx(2), zpx(10), "x7Gun", "x7Gun")       # lower band
    prism(k, arc_band(CR + 0.5 * PXG, CR - 0.5 * PXG), LZ - zpx(1), zpx(0.6), "dkSeam")                  # lit edge
    return k


def n3_holo():
    k = K("desk2_n3_holo", FP, 0)
    record(k, -0.45, fv(CR - LW, 0.0) - 0.08, LZ - zpx(3), 0.5, 0.28)
    pv = fv(CR - LW / 2, 0.5)
    for du in (-0.14, 0.14):
        bar(k, (0.5 + du, pv, LZ), (0.5 + du, pv, LZ + 0.06), 0.01, L)
    id_pane(k, 0.5, pv, LZ + 0.06)
    return k


DESIGNS = {"n1": (n1, n1_holo), "n2": (n2, n2_holo), "n3": (n3, n3_holo)}


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
