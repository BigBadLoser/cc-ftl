"""2x1 desk look study, round 3 (family `desk2c`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): three more desks, each a different kind of object with its own holo projector and a post's dressing. The
operator works from the tile in front (+v, lower left at r0); the dressing goes on any body.

  f1 flight cases, guard: a plate laid over two olive flight cases (corner caps, a rib, latches), a rugged projector
     puck set on top throwing the deck plan and a camera feed; a baton, a beacon, a radio, a mug
  f2 glass top, office: a bone frame on four slim legs under a dark glass top whose lit inlay is the projector; the
     globe and route rise from the glass with a notes pane; a slate, folders, a mug
  f3 twin fins, customs: a slate-blue desk with a knee well and two tall fins rising from its ends, emitter strips on
     their inner faces throwing one wide pane between them (the scanned crate and the ID); the stamp, permits, a tray

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .desk2_r1 import BK, FP, FR, F, L, SLAB, TOP, emitter, figure, mug, pane, rot2, rows, span
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk+bar17+bar18+bar22+bar9"


def crate(k, s, c, z):
    """A scanned crate (wireframe, film, one flagged item) of size s centred at c = (u, v), its middle at z."""
    u, v = c
    pts = [(*rot2(u, v, 0.4, a * s / 2, b * s / 2), z + e * s / 2) for e in (-1, 1) for a, b in
           ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(4):
        bar(k, pts[i], pts[(i + 1) % 4], 0.022, L)
        bar(k, pts[4 + i], pts[4 + (i + 1) % 4], 0.022, L)
        bar(k, pts[i], pts[4 + i], 0.022, L)
    k.box(u, v, z - s / 2, s - 0.02, s - 0.02, s, F, rz=0.4)
    k.cyl(u + 0.05, v + 0.02, z - 0.08, 0.025, 0.12, "dkAlert", sides=8)


def plan_marks(blips=True):
    out = [(0.0, 0.2, 0.56, 0.02), (0.0, 0.07, 0.56, 0.02), (-0.28, 0.07, 0.02, 0.15), (0.28, 0.07, 0.02, 0.15),
           (-0.06, 0.07, 0.02, 0.15), (0.12, 0.07, 0.02, 0.15)]
    return out + ([(-0.18, 0.12, 0.04, 0.04), (0.02, 0.12, 0.04, 0.04), (0.2, 0.12, 0.04, 0.04, "dkAlert")]
                  if blips else [])


# ---- f1 flight cases, guard -------------------------------------------------------------------------------------------
CW, CD = 0.56, 0.84                           # a case's width and depth
PU, PV = -0.1, -0.22                          # the puck


def case(k, cu, h):
    u0, u1, v0, v1 = cu - CW / 2, cu + CW / 2, -CD / 2, CD / 2
    span(k, u0, u1, v0, v1, 0, h, "x7Olive", top="x7OliveL")
    span(k, u0 - 0.5 * PXG, u1 + 0.5 * PXG, v0 - 0.5 * PXG, v1 + 0.5 * PXG, h * 0.55, h * 0.55 + zpx(2), "x7OliveD")
    for a in (u0, u1):                                                                                 # corner caps
        for b in (v0, v1):
            for z0 in (0, h - zpx(3)):
                span(k, a - PXG, a + PXG, b - PXG, b + PXG, z0, z0 + zpx(3), "x7Black")
    for du in (-0.14, 0.14):                                                                           # latches
        span(k, cu + du - 0.03, cu + du + 0.03, v1, v1 + 0.6 * PXG, h * 0.55 + zpx(2), h * 0.55 + zpx(5), "steelL")
    span(k, cu - 0.08, cu + 0.08, v1, v1 + 0.4 * PXG, h * 0.25, h * 0.25 + zpx(3), "x7Khaki")           # a label


def f1(rot=0):
    k = Bench(f"desk2_f1_{rot}", FP, rot)
    h = TOP - SLAB
    for cu in (-0.68, 0.68):
        case(k, cu, h)
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR, h, TOP, "x7Gun", top="r9GreyD")                           # the plate
    k.cyl(PU, PV, TOP, 0.11, zpx(3), "x7Black", top="x7OliveD", sides=20)                             # the puck
    for a in range(4):
        k.box(PU + 0.11 * math.cos(a * math.pi / 2 + 0.4), PV + 0.11 * math.sin(a * math.pi / 2 + 0.4), TOP,
              0.04, 0.04, zpx(3), "x7Black", rz=a * math.pi / 2 + 0.4)
    emitter(k, PU, PV, TOP + zpx(3), 0.08)
    k.box(0.42, 0.2, TOP, 0.4, 0.1, zpx(2), "steelD", top="dark", rz=0.12)                            # baton cradle
    k.box(0.42, 0.2, TOP + zpx(2), 0.36, 0.04, 0.04, "dark", top="gm", rz=0.12)
    k.box(-0.62, 0.16, TOP, 0.1, 0.06, 0.16, "x7Black", top="x7Gun", rz=0.3)                          # a radio
    k.cyl(0.84, -0.22, TOP, 0.06, 0.03, "steelD", top="dark", sides=12)                               # the beacon
    k.cyl(0.84, -0.22, TOP + 0.03, 0.045, 0.07, "hivis", rtop=0.02, sides=12)
    mug(k, -0.36, 0.22)
    return k


def f1_holo():
    k = K("desk2_f1_holo", FP, 0)
    z0, z1 = TOP + zpx(4), TOP + 0.2
    for a in (0.0, math.pi / 2, math.pi, 1.5 * math.pi):                                              # the throw
        bar(k, (PU + 0.06 * math.cos(a), PV + 0.06 * math.sin(a), z0),
            (PU + 0.2 * math.cos(a), PV + 0.2 * math.sin(a) * 0.3, z1), 0.015, L)
    pane(k, PU, PV, z1, 0.66, 0.32, plan_marks())
    pane(k, 0.46, PV + 0.04, z1 + 0.06, 0.24, 0.2, [(0.07, 0.14, 0.05, 0.03, "dkAlert")])
    figure(k, 0.47, PV + 0.054, z1 + 0.08, 0.55)
    return k


# ---- f2 glass top, office ---------------------------------------------------------------------------------------------
GU, GV = 0.36, 0.0                            # the globe over the glass


def f2(rot=0):
    k = Bench(f"desk2_f2_{rot}", FP, rot)
    lu, lv, h = 1 - 4 * PXG, 0.5 - 4 * PXG, TOP - SLAB
    for su in (-1, 1):                                                                                 # four legs
        for sv in (-1, 1):
            span(k, su * lu - 1.5 * PXG, su * lu + 1.5 * PXG, sv * lv - 1.5 * PXG, sv * lv + 1.5 * PXG, 0, h,
                 "x7Bone", top="x7Bone")
            span(k, su * lu - 2 * PXG, su * lu + 2 * PXG, sv * lv - 2 * PXG, sv * lv + 2 * PXG, 0, zpx(1), "x7Black")
    for a0, a1, b0, b1 in ((-lu, lu, -lv - 1.5 * PXG, -lv + 1.5 * PXG), (-lu, lu, lv - 1.5 * PXG, lv + 1.5 * PXG),
                           (-lu - 1.5 * PXG, -lu + 1.5 * PXG, -lv, lv), (lu - 1.5 * PXG, lu + 1.5 * PXG, -lv, lv)):
        span(k, a0, a1, b0, b1, h - zpx(4), h, "x7Bone", top="x7Bone")                                  # the rail
    span(k, -lu + 2 * PXG, -0.3, -lv + 2 * PXG, lv - 2 * PXG, h - zpx(9), h - zpx(4), "x7Bone")         # hung drawer
    span(k, -0.8, -0.56, lv - 2 * PXG, lv - 1.5 * PXG, h - zpx(7), h - zpx(6), "x7Oxide")
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR, h, TOP, "x7Black", top="dkGlass")                          # the glass
    for a0, a1, b0, b1 in ((-0.92, 0.92, -0.4, -0.38), (-0.92, 0.92, 0.38, 0.4), (-0.92, -0.9, -0.4, 0.4),
                           (0.9, 0.92, -0.4, 0.4)):
        span(k, a0, a1, b0, b1, TOP, TOP + zpx(0.5), "dkSeam")                                          # its inlay
    ring(k, "z", GU, GV, TOP, 0.13, 24, 0.008, 0.025, "dkSeam")
    k.box(-0.44, 0.14, TOP, 0.22, 0.16, 0.012, "steelD", top="dark", rz=0.4)                           # a slate
    for i in range(3):                                                                                 # folders
        k.box(-0.72, -0.16, TOP + i * 0.014, 0.16, 0.22, 0.014, ("ochM", "dkTeal", "medWhite")[i], rz=0.1 * (i - 1))
    mug(k, 0.82, 0.24)
    return k


def f2_holo():
    k = K("desk2_f2_holo", FP, 0)
    R, cz = 0.15, TOP + 0.3
    for i in range(8):                                                                                 # the globe
        t = -1 + (2 * i + 1) / 8
        k.cyl(GU, GV, cz - R + 2 * R * i / 8, R * math.sqrt(1 - t * t), 2 * R / 8, F, sides=16)
    for f in (-0.6, 0.0, 0.6):
        ring(k, "z", GU, GV, cz + f * R, R * math.sqrt(1 - f * f) + 0.01, 20, 0.025, 0.02, L)
    bar(k, (GU, GV, TOP), (GU, GV, cz - R), 0.02, L)
    route = [(GU + 0.22 * math.cos(t), GV + 0.22 * math.sin(t), cz + 0.12 * math.sin(2 * t)) for t in
             [i * 0.35 - 0.6 for i in range(9)]]
    for a, b in zip(route, route[1:]):
        bar(k, a, b, 0.022, L)
    pane(k, -0.3, BK + 0.1, TOP + 0.06, 0.46, 0.26, rows(0.46, 0.26, (0.28, 0.2, 0.32)))
    return k


# ---- f3 twin fins, customs --------------------------------------------------------------------------------------------
FU, FH = 1 - 3 * PXG, 0.6                     # the fins' u and height over the top
SU, SV = 0.0, -0.1                            # the scan pad


def f3(rot=0):
    k = Bench(f"desk2_f3_{rot}", FP, rot)
    h = TOP - SLAB
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR, h, TOP, "z8SlateL", top="z8Grey")                        # the top
    span(k, -1 + PXG, 1 - PXG, BK + PXG, -0.04, zpx(2), h, "z8Slate", top="z8SlateL")                   # the body
    for s in (-1, 1):                                                                                  # end panels
        span(k, *sorted((s * (1 - PXG), s * (1 - 6 * PXG))), -0.04, FR, zpx(2), h, "z8Slate", top="z8SlateL")
    span(k, -1 + 2 * PXG, 1 - 2 * PXG, BK + 2 * PXG, FR - PXG, 0, zpx(2), "z8Char")
    span(k, -1 + PXG, 1 - PXG, FR, FR + 0.5 * PXG, h - zpx(2), h - zpx(1), "z8Mustard")              # a mustard line
    for s in (-1, 1):                                                                                  # the fins
        k.box(s * FU, -0.08, TOP, 4 * PXG, 0.66, FH, "z8SlateD", top="z8Slate", taper=0.55)
        k.box(s * (FU - 2.5 * PXG), -0.08, TOP + 0.04, 0.6 * PXG, 0.3, FH - 0.16, "dkSeam", taper=0.6)
    span(k, SU - 0.2, SU + 0.2, SV - 0.12, SV + 0.12, TOP, TOP + zpx(1), "z8Char", top="dkGlass")      # scan pad
    for dv in (-0.1, 0.1):
        span(k, SU - 0.18, SU + 0.18, SV + dv - 0.012, SV + dv + 0.012, TOP + zpx(1), TOP + zpx(1.5), "dkSeam")
    for i in range(4):                                                                                 # permits
        k.box(-0.6, 0.22, TOP + i * 0.012, 0.16, 0.2, 0.012, ("medWhite", "ochM", "medWhite", "plate")[i],
              rz=0.08 * (i - 1))
    k.cyl(-0.3, 0.26, TOP, 0.06, 0.025, "steelD", top="medRed", sides=12)                              # the stamp
    k.cyl(-0.3, 0.26, TOP + 0.025, 0.022, 0.08, "dark", sides=8)
    k.cyl(-0.3, 0.26, TOP + 0.1, 0.04, 0.035, "steelL", sides=10)
    k.box(0.5, 0.22, TOP, 0.26, 0.18, 0.03, "steelD", top="dark")                                     # the tray
    k.box(0.52, 0.23, TOP + 0.03, 0.08, 0.06, 0.05, "medRed", top="rust", rz=0.3)
    return k


def f3_holo():
    k = K("desk2_f3_holo", FP, 0)
    z0, w, hh = TOP + 0.24, 2 * FU - 0.14, 0.3
    for s in (-1, 1):                                                                                  # the throws
        for z in (TOP + 0.12, TOP + 0.48):
            bar(k, (s * (FU - 3 * PXG), -0.08, z), (s * w / 2, -0.32, z0 + (hh if z > TOP + 0.3 else 0)), 0.012, L)
    pane(k, 0.0, -0.32, z0, w, hh, rows(w, hh, (0.18, 0.12, 0.2), x0=0.5 + 0.16)
         + [(-w / 2 + 0.3, 0.03, 0.12, 0.05, "dkGo")])
    figure(k, -w / 2 + 0.2, -0.306, z0 + 0.03, 0.7)
    crate(k, 0.2, (SU, SV), TOP + 0.16)
    ring(k, "z", SU, SV, TOP + 0.18, 0.18, 24, 0.02, 0.02, L)
    return k


DESIGNS = {"f1": (f1, f1_holo), "f2": (f2, f2_holo), "f3": (f3, f3_holo)}


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
