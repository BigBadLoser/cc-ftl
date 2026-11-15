"""2x1 desk look study, round 9 (family `desk2i`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): reception desks (user: the J1 concept, as full new designs, nothing reused). The visitor stands at the
front (+v) at a raised ledge, the officer sits behind (-v) at a lower work top; screens and keyboards are holograms.
Round 8 showed the raised ledge hiding the officer's side from the camera, so each design shows it another way.

  l1 curved pod: the visitor's face bows out in an arc, bone with three seams, an oxide-padded ledge following the
     curve; the officer's pane rises from the ledge's inner edge, so it stands above it
  l2 split level: gunmetal with ribs and a teal line; the ledge is a raised block on the visitor's half only, the
     officer's half stays low and open, so their projected work surface (a pane and a key field) shows
  l3 light curtain: a straight graphite counter with mustard trim; an emitter rail along the ledge's inner edge throws
     a curtain of light the whole length, with the visitor's ID on their side of it and the officer's record on theirs

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles. The
officer sits behind the left half (u < 0), the visitor stands at the right half."""
import math

from . import core, post
from .desk2_r1 import BK, FP, FR, F, L, SLAB, TOP, emitter, figure, mug, pane, rows, span
from .desk2_r2 import prism
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, zpx

PAL = "desk+bar17+bar18+bar22+bar9"
LZ = TOP + zpx(11)                            # a ledge's height (a standing visitor's counter)


def id_pane(k, u, v, z, w=0.36):
    pane(k, u, v, z, w, 0.22, rows(w, 0.22, (0.1, 0.08, 0.12), x0=0.18) + [(w / 2 - 0.08, 0.03, 0.09, 0.04, "dkGo")])
    figure(k, u - w / 2 + 0.08, v + 0.014, z + 0.03, 0.55)


def record(k, u, v, z, w=0.42, h=0.26):
    pane(k, u, v, z, w, h, rows(w, h, (0.26, 0.18, 0.3, 0.2)) + [(w / 2 - 0.08, 0.04, 0.08, 0.07)])


# ---- l1 curved pod ----------------------------------------------------------------------------------------------------
CC, CR, UE = -1.6, 2.1 - PXG, 1 - PXG          # l1's front arc: centre v, radius (its middle on the front edge), ends


def front_v(r, u):
    return CC + math.sqrt(r * r - u * u)


def arc_band(ro, ri, ue=UE, n=24):
    """The strip between two front arcs (radii ro outside, ri inside), cut at u = ±ue."""
    a = [(u, front_v(ro, u)) for u in (-ue + 2 * ue * i / n for i in range(n + 1))]
    return a + [(u, front_v(ri, u)) for u in (ue - 2 * ue * i / n for i in range(n + 1))]


def l1(rot=0):
    k = Bench(f"desk2_l1_{rot}", FP, rot)
    lw = 0.26                                                                                           # ledge depth
    prism(k, arc_band(CR - PXG, CR - 5 * PXG), zpx(2), LZ - zpx(3) - zpx(2), "x7Bone", "x7Bone")        # the face
    prism(k, arc_band(CR - 2 * PXG, CR - 5 * PXG, UE - PXG), 0, zpx(2), "x7Black")
    for u in (-0.34, 0.34):                                                                             # its seams
        v = front_v(CR - PXG, u)
        span(k, u - 0.5 * PXG, u + 0.5 * PXG, v - 0.5 * PXG, v + 0.3 * PXG, zpx(3), LZ - zpx(6), "x7Gun")
    prism(k, arc_band(CR, CR - lw), LZ - zpx(5), zpx(5), "x7Gun", "r9GreyD")                            # the ledge
    prism(k, arc_band(CR + 0.5 * PXG, CR - 2.5 * PXG), LZ - zpx(4), zpx(4.5), "x7Oxide", "k2OxideL")     # its padding
    for s in (-1, 1):                                                                                   # end panels
        span(k, *sorted((s * UE, s * (UE - 4 * PXG))), BK + PXG, front_v(CR - 5 * PXG, UE), 0, LZ - zpx(5), "x7Bone",
             top="x7Bone")
    vi = front_v(CR - lw, 0.0)
    span(k, -UE + 4 * PXG, UE - 4 * PXG, BK + PXG, vi - 0.06, TOP - SLAB, TOP, "x7Gun", top="r9GreyD")    # work top
    prism(k, arc_band(CR - lw, CR - lw - 0.08, UE - 4 * PXG), TOP - SLAB, LZ - zpx(5) - TOP + SLAB, "x7Bone",
          "x7Bone")                                                                                     # ledge riser
    span(k, -0.72, -0.18, vi - 0.1, vi - 0.06, LZ - zpx(5), LZ - zpx(4), "x7Black", top="dkGlass")       # pane slot
    span(k, -0.7, -0.2, vi - 0.085, vi - 0.075, LZ - zpx(4), LZ - zpx(3.5), "dkSeam")
    k.cyl(0.5, front_v(CR - lw / 2, 0.5), LZ, 0.06, zpx(1.5), "x7Black", top="x7Gun", sides=16)       # ID puck
    emitter(k, 0.5, front_v(CR - lw / 2, 0.5), LZ + zpx(1.5), 0.045)
    mug(k, 0.66, -0.26)
    return k


def l1_holo():
    k = K("desk2_l1_holo", FP, 0)
    vi = front_v(CR - 0.26, 0.0)
    record(k, -0.45, vi - 0.08, LZ - zpx(3), 0.5, 0.28)
    pv = front_v(CR - 0.13, 0.5)
    bar(k, (0.5, pv, LZ + zpx(2)), (0.5, pv, LZ + 0.06), 0.012, L)
    id_pane(k, 0.5, pv, LZ + 0.06)
    return k


# ---- l2 split level ---------------------------------------------------------------------------------------------------
BV = 0.08                                     # l2's raised block's back face (v)


def l2(rot=0):
    k = Bench(f"desk2_l2_{rot}", FP, rot)
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR, TOP - SLAB, TOP, "x7Gun", top="r9GreyD")                  # the low top
    span(k, -1 + PXG, 0.0, FR - 4 * PXG, FR - 2 * PXG, zpx(3), TOP - SLAB, "x7Gun")                     # its front
    span(k, -1 + PXG, -1 + 4 * PXG, BK + PXG, FR - 2 * PXG, 0, TOP - SLAB, "x7Gun", top="x7Gun")        # its end
    span(k, -1 + PXG, 0.0, FR - 2 * PXG, FR - 1.5 * PXG, zpx(14), zpx(15), "dkTeal")
    span(k, 0.0, 1 - PXG, BV, FR, 0, LZ - zpx(3), "x7Gun", top="x7Gun")                                # the block
    for i in range(7):                                                                                 # its ribs
        u = 0.07 + i * 0.13
        span(k, u - PXG, u + PXG, FR, FR + PXG, zpx(3), LZ - zpx(5), "x7Black")
    span(k, 0.0, 1 - PXG, FR, FR + 0.5 * PXG, zpx(14), zpx(15), "dkTeal")
    span(k, -PXG, 1, BV - PXG, FR + PXG, LZ - zpx(3), LZ, "x7Black", top="r9GreyD")                    # its ledge
    span(k, 1 - 4 * PXG, 1 - PXG, BK + PXG, BV, 0, TOP - SLAB, "x7Gun", top="x7Gun")                   # right end
    span(k, 0.34, 0.74, 0.18, 0.4, LZ, LZ + zpx(0.5), "x7Black", top="dkGlass")                          # scan pad
    for dv in (0.2, 0.38):
        span(k, 0.36, 0.72, dv - 0.008, dv + 0.008, LZ + zpx(0.5), LZ + zpx(1), "dkSeam")
    span(k, -0.86, -0.14, BK + 3 * PXG, BK + 5 * PXG, TOP, TOP + zpx(0.5), "x7Black", top="dkGlass")     # emitter
    span(k, -0.84, -0.16, BK + 3.6 * PXG, BK + 4.4 * PXG, TOP + zpx(0.5), TOP + zpx(1), "dkSeam")
    mug(k, -0.88, 0.28)
    return k


def l2_holo():
    k = K("desk2_l2_holo", FP, 0)
    ku, kv, w, d, z = -0.5, 0.1, 0.5, 0.2, TOP + 0.006                                                    # work field
    k.box(ku, kv, z, w, d, 0.004, F)
    for x in (-w / 2 + 0.01, w / 2 - 0.01):
        k.box(ku + x, kv, z, 0.02, d, 0.006, L)
    for y in (-d / 2 + 0.01, d / 2 - 0.01):
        k.box(ku, kv + y, z, w, 0.02, 0.006, L)
    for i in range(5):
        k.box(ku - 0.16 + i * 0.08, kv + 0.03, z, 0.05, 0.05, 0.006, L)
    k.box(ku + 0.1, kv - 0.04, z, 0.2, 0.04, 0.006, L)
    record(k, -0.5, BK + 4 * PXG, TOP + zpx(1), 0.5, 0.3)
    id_pane(k, 0.54, 0.29, LZ + 0.04)
    for du in (-0.15, 0.15):
        bar(k, (0.54 + du, 0.29, LZ + zpx(1)), (0.54 + du, 0.29, LZ + 0.04), 0.01, L)
    return k


# ---- l3 light curtain -------------------------------------------------------------------------------------------------
RV = 0.2                                      # l3's emitter rail (v)


def l3(rot=0):
    k = Bench(f"desk2_l3_{rot}", FP, rot)
    span(k, -1 + PXG, 1 - PXG, FR - 4 * PXG, FR, zpx(2), LZ - zpx(3), "dkGraph", top="dkGraph")         # the face
    span(k, -1 + 2 * PXG, 1 - 2 * PXG, FR - 4 * PXG, FR - PXG, 0, zpx(2), "x7Black")
    for z in (zpx(6), LZ - zpx(8)):                                                                    # trim
        span(k, -1 + PXG, 1 - PXG, FR, FR + 0.5 * PXG, z, z + zpx(1), "z8Mustard")
    span(k, -1 + PXG, 1 - PXG, RV + 2 * PXG, FR + PXG, LZ - zpx(3), LZ, "dkGraphD", top="dkGraph")      # the ledge
    for s in (-1, 1):                                                                                  # end panels
        span(k, *sorted((s * (1 - PXG), s * (1 - 4 * PXG))), BK + PXG, FR - 4 * PXG, 0, LZ - zpx(3), "dkGraph",
             top="dkGraph")
    span(k, -1 + 4 * PXG, 1 - 4 * PXG, BK + PXG, RV, TOP - SLAB, TOP, "dkGraphD", top="dkGraph")       # work top
    span(k, -1 + 4 * PXG, 1 - 4 * PXG, RV - 2 * PXG, RV + 2 * PXG, TOP, LZ + zpx(2), "x7Black",
         top="dkGraphD")                                                                               # the rail
    span(k, -0.9, 0.9, RV - 0.5 * PXG, RV + 0.5 * PXG, LZ + zpx(2), LZ + zpx(2.5), "dkSeam")
    span(k, 0.3, 0.62, 0.34, 0.46, LZ, LZ + zpx(0.5), "x7Black", top="dkGlass")                          # pass tray
    k.cyl(-0.3, 0.38, LZ, 0.05, 0.02, "steelD", top="medRed", sides=12)                                 # the stamp
    k.cyl(-0.3, 0.38, LZ + 0.02, 0.02, 0.06, "dark", sides=8)
    mug(k, -0.8, -0.26)
    return k


def l3_holo():
    k = K("desk2_l3_holo", FP, 0)
    z0, h = LZ + zpx(2.5), 0.3
    for u0, u1 in ((-0.9, 0.24), (0.68, 0.9)):                                                         # the curtain,
        k.box((u0 + u1) / 2, RV, z0, u1 - u0, 0.008, h, F)                                             # a gap at the
        k.box((u0 + u1) / 2, RV + 0.01, z0 + h - 0.02, u1 - u0, 0.01, 0.02, L)                          # pass tray
    for u in (0.24, 0.68):
        k.box(u, RV + 0.01, z0, 0.02, 0.01, h, L)
    for i, w in enumerate((0.3, 0.22, 0.36, 0.26)):                                                    # the record
        k.box(-0.62 + w / 2, RV + 0.012, z0 + h - 0.08 - i * 0.055, w, 0.01, 0.03, L)
    k.box(-0.1, RV + 0.012, z0 + 0.04, 0.1, 0.01, 0.1, "dkAmber")
    for i, w in enumerate((0.12, 0.1, 0.14)):                                                          # the ID
        k.box(0.81, RV + 0.012, z0 + h - 0.08 - i * 0.05, w * 0.6, 0.01, 0.025, L)
    figure(k, 0.78, RV + 0.014, z0 + 0.02, 0.45)
    return k


DESIGNS = {"l1": (l1, l1_holo), "l2": (l2, l2_holo), "l3": (l3, l3_holo)}


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
