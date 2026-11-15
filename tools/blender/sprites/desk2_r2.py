"""2x1 desk look study, round 2 (family `desk2b`, palette sets desk + bar17 + bar22 + bar9, preview only; issue #485): three
more desks, each a different kind of object, each with its own holo projector and a post's dressing. As in round 1 the
operator works from the tile in front (+v, lower left at r0), and the dressing goes on any body.

  e1 arc, office: a curved desk in the bar's bone and oxide. Its top wraps round the operator (a concave front with a
     padded oxide roll, wings to the front edge), a curved bone back wall, a round emitter at the back; globe and route
  e2 trestle, guard: a thick gunmetal plate on two splayed trestles, hazard stripes on its front edge, a cable tray, and
     a projector on a jointed arm clamped to the back corner, throwing the deck plan and a camera feed
  e3 cantilever, customs: a graphite wall along the back carries the top (no front legs) and a canopy; the emitter
     strip under the canopy throws the scan down onto a pad set in the top; an ID pane hangs under the canopy

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .desk2_r1 import BK, FP, FR, F, L, SLAB, TOP, emitter, figure, mug, pane, rot2, rows, span
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk+bar17+bar22+bar9"


def prism(k, pts, z, h, col, top=None):
    """A vertical prism over the outline pts (local (u, v), either winding), z..z + h, as one closed mesh."""
    if sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1])) < 0:
        pts = pts[::-1]
    g = [k.p(u, v) for u, v in pts]
    bot = [core.G(x, y, z) for x, y in g]
    tp = [core.G(x, y, z + h) for x, y in g]
    n = len(g)
    for i in range(n):
        j = (i + 1) % n
        k.m.poly([bot[i], bot[j], tp[j], tp[i]], col, flip=True)
    k.m.poly(tp[::-1], top or col, flip=True)
    k.m.poly(bot, col, flip=True)


# ---- e1 arc, office ---------------------------------------------------------------------------------------------------
AC, RO, RI, UE = 0.9, 1.36, 0.76, 0.96        # the arcs' centre (v, in front of the desk), outer and inner radii, ends


def arc_v(r, u):
    return AC - math.sqrt(r * r - u * u)


def arc_top(ro=RO, ri=RI, ue=UE, fr=FR, n=20):
    """The top's outline: the convex back, the ends down to the front edge, the concave front between them."""
    back = [(u, arc_v(ro, u)) for u in (-ue + 2 * ue * i / n for i in range(n + 1))]
    ui = math.sqrt(ri * ri - (AC - fr) ** 2)
    front = [(u, arc_v(ri, u)) for u in (ui - 2 * ui * i / n for i in range(n + 1))]
    return back + [(ue, fr)] + front + [(-ue, fr)]


def band(ro, ri, ue, n=20):
    """A strip between two arcs, cut at u = ±ue."""
    a = [(u, arc_v(ro, u)) for u in (-ue + 2 * ue * i / n for i in range(n + 1))]
    b = [(u, arc_v(ri, u)) for u in (ue - 2 * ue * i / n for i in range(n + 1))]
    return a + b


EU, EV = 0.0, -0.27                           # e1's emitter


def e1(rot=0):
    k = Bench(f"desk2_e1_{rot}", FP, rot)
    prism(k, arc_top(), TOP - SLAB, SLAB, "x7Gun", "r9GreyD")                                          # the top
    prism(k, arc_top(RO - 2 * PXG, RI + 2 * PXG, UE - 2 * PXG, FR - 2 * PXG), TOP - SLAB - zpx(1), zpx(1), "x7Black")
    ui = math.sqrt(RI * RI - (AC - FR) ** 2) - PXG                                                    # the front roll,
    roll = [(u, arc_v(RI - 0.5 * PXG, u)) for u in (-ui + 2 * ui * i / 20 for i in range(21))]          # proud of the
    prism(k, roll + [(u, v - 3 * PXG) for u, v in roll[::-1]], TOP - SLAB - zpx(1), SLAB + zpx(2), "x7Oxide",  # top's
          "k2OxideL")                                                                                   # edge
    prism(k, band(RO - 2 * PXG, RO - 0.2, UE - 3 * PXG), zpx(2), TOP - SLAB - zpx(3), "x7Bone", "x7Bone")  # back wall
    prism(k, band(RO - 3 * PXG, RO - 0.19, UE - 4 * PXG), 0, zpx(2), "x7Black")
    prism(k, band(RO - 0.2, RO - 0.2 - 0.5 * PXG, UE - 3 * PXG), zpx(10), zpx(1), "x7Oxide")              # its stripe
    for s in (-1, 1):                                                                                   # the wings
        u0, u1 = sorted((s * (UE - 3 * PXG), s * (UE - 0.2)))
        span(k, u0, u1, arc_v(RO - 0.2, abs(u1) if s > 0 else abs(u0)), FR - 2 * PXG, zpx(2), TOP - SLAB - zpx(1),
             "x7Bone", top="x7Bone")
        span(k, u0 + PXG, u1 - PXG, arc_v(RO - 0.2, 0.8), FR - 3 * PXG, 0, zpx(2), "x7Black")
    emitter(k, EU, EV, TOP, 0.13)
    k.box(-0.62, 0.16, TOP, 0.22, 0.16, 0.012, "steelD", top="dark", rz=0.5)                          # a slate
    for i in range(3):                                                                                 # folders
        k.box(0.7, 0.22, TOP + i * 0.014, 0.16, 0.22, 0.014, ("ochM", "dkTeal", "medWhite")[i], rz=0.1 * (i - 1))
    mug(k, -0.4, -0.12)
    return k


def e1_holo():
    k = K("desk2_e1_holo", FP, 0)
    R, cz = 0.15, TOP + 0.38
    for a in (0.0, math.pi / 2, math.pi, 1.5 * math.pi):
        bar(k, (EU + 0.11 * math.cos(a), EV + 0.11 * math.sin(a), TOP + zpx(1)),
            (EU + 0.05 * math.cos(a), EV + 0.05 * math.sin(a), cz - R), 0.02, L)
    for i in range(8):                                                                                 # the globe
        t = -1 + (2 * i + 1) / 8
        k.cyl(EU, EV, cz - R + 2 * R * i / 8, R * math.sqrt(1 - t * t), 2 * R / 8, F, sides=16)
    for f in (-0.6, 0.0, 0.6):
        ring(k, "z", EU, EV, cz + f * R, R * math.sqrt(1 - f * f) + 0.01, 20, 0.025, 0.02, L)
    route = [(EU + 0.22 * math.cos(t), EV + 0.22 * math.sin(t), cz + 0.12 * math.sin(2 * t)) for t in
             [i * 0.35 - 0.6 for i in range(9)]]
    for a, b in zip(route, route[1:]):
        bar(k, a, b, 0.022, L)
    for u in (-0.5, 0.5):                                                                              # side panes
        pane(k, u, arc_v(RO, abs(u)) + 0.08, TOP + 0.08, 0.3, 0.22, rows(0.3, 0.22, (0.16, 0.12)))
    return k


# ---- e2 trestle, guard ------------------------------------------------------------------------------------------------
TH = zpx(4)                                   # e2's plate
AU, AV = -0.86, BK + 0.06                     # its arm's clamp
HU, HV, HZ = -0.3, -0.14, TOP + 0.62           # the projector head


def e2(rot=0):
    k = Bench(f"desk2_e2_{rot}", FP, rot)
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR, TOP - TH, TOP, "x7Gun", top="r9GreyD")                  # the plate
    n = 14
    for i in range(n):                                                                                 # hazard edge
        u0 = -1 + PXG + i * (2 - 2 * PXG) / n
        span(k, u0, u0 + (2 - 2 * PXG) / n, FR, FR + 0.5 * PXG, TOP - TH + zpx(1), TOP - zpx(1),
             "x7Yellow" if i % 2 == 0 else "x7Black")
    for tu in (-0.7, 0.7):                                                                             # trestles
        for s in (-1, 1):
            bar(k, (tu, s * 0.4, 0.0), (tu, s * 0.16, TOP - TH), 0.07, "steelD")
        span(k, tu - 0.035, tu + 0.035, -0.3, 0.3, zpx(6), zpx(8), "steelD")
        for s in (-1, 1):
            span(k, tu - 0.05, tu + 0.05, s * 0.4 - 0.05, s * 0.4 + 0.05, 0, zpx(1), "x7Black")
    span(k, -0.62, 0.62, BK + 2 * PXG, BK + 6 * PXG, TOP - TH - zpx(4), TOP - TH, "x7Black")           # cable tray
    for u in (-0.3, 0.25):                                                                             # a cable loop
        bar(k, (u, BK + 4 * PXG, TOP - TH - zpx(4)), (u + 0.12, BK + 4 * PXG, TOP - TH - zpx(10)), 0.03, "x7Oxide")
        bar(k, (u + 0.12, BK + 4 * PXG, TOP - TH - zpx(10)), (u + 0.24, BK + 4 * PXG, TOP - TH - zpx(4)), 0.03,
            "x7Oxide")
    span(k, AU - 0.06, AU + 0.06, AV - 0.06, AV + 0.06, TOP, TOP + zpx(3), "x7Black")                  # the clamp
    j1 = (AU, AV, TOP + 0.42)
    j2 = (HU - 0.12, HV - 0.06, HZ + 0.06)
    bar(k, (AU, AV, TOP + zpx(3)), j1, 0.035, "x7Yellow")                                              # the arm
    bar(k, j1, j2, 0.03, "x7Yellow")
    for j in (j1, j2):
        k.cyl(j[0], j[1], j[2] - 0.03, 0.04, 0.06, "x7Black", sides=10)
    k.box(HU, HV, HZ - 0.05, 0.14, 0.1, 0.08, "x7Gun", top="r9GreyD", rz=0.4)                         # the head
    k.cyl(HU, HV, HZ - 0.06, 0.04, 0.012, "dkSeam", sides=10)
    k.box(0.4, 0.2, TOP, 0.4, 0.1, zpx(2), "steelD", top="dark", rz=0.12)                            # baton cradle
    k.box(0.4, 0.2, TOP + zpx(2), 0.36, 0.04, 0.04, "dark", top="gm", rz=0.12)
    k.box(-0.62, 0.16, TOP, 0.1, 0.06, 0.16, "x7Black", top="x7Gun", rz=0.3)                          # a radio
    k.cyl(0.84, -0.2, TOP, 0.06, 0.03, "steelD", top="dark", sides=12)                                # the beacon
    k.cyl(0.84, -0.2, TOP + 0.03, 0.045, 0.07, "hivis", rtop=0.02, sides=12)
    mug(k, 0.82, 0.18)
    return k


def e2_holo():
    k = K("desk2_e2_holo", FP, 0)
    pu, pv, pz, w, h = 0.12, -0.2, TOP + 0.1, 0.66, 0.32
    for du in (-w / 2, w / 2):                                                                         # the throw
        bar(k, (HU, HV, HZ - 0.06), (pu + du, pv, pz + h), 0.015, L)
    plan = [(0.0, 0.2, 0.56, 0.02), (0.0, 0.07, 0.56, 0.02), (-0.28, 0.07, 0.02, 0.15), (0.28, 0.07, 0.02, 0.15),
            (-0.06, 0.07, 0.02, 0.15), (0.12, 0.07, 0.02, 0.15)]
    pane(k, pu, pv, pz, w, h, plan + [(-0.18, 0.12, 0.04, 0.04), (0.02, 0.12, 0.04, 0.04),
                                      (0.2, 0.12, 0.04, 0.04, "dkAlert")])
    pane(k, 0.62, pv, pz + 0.04, 0.24, 0.2, [(0.07, 0.14, 0.05, 0.03, "dkAlert")])
    figure(k, 0.63, pv + 0.014, pz + 0.06, 0.55)
    return k


# ---- e3 cantilever, customs -------------------------------------------------------------------------------------------
WV = BK + 0.12                                # e3's wall front
CZ = TOP + zpx(22)                            # the canopy's underside
SU, SV = 0.42, -0.06                          # the scan pad


def e3(rot=0):
    k = Bench(f"desk2_e3_{rot}", FP, rot)
    span(k, -1 + PXG, 1 - PXG, BK, WV, zpx(2), CZ, "dkGraph", top="dkGraphD")                          # the wall
    span(k, -1 + 2 * PXG, 1 - 2 * PXG, BK + PXG, WV - PXG, 0, zpx(2), "x7Black")
    for u in (-0.34, 0.34):                                                                            # its seams
        span(k, u - 0.5 * PXG, u + 0.5 * PXG, WV, WV + 0.3 * PXG, zpx(3), CZ - zpx(1), "dkGraphD")
    span(k, -1 + PXG, 1 - PXG, BK, 0.06, CZ, CZ + zpx(3), "dkGraph", top="dkGraphD")                    # the canopy
    span(k, -1 + PXG, 1 - PXG, 0.06, 0.06 + 0.5 * PXG, CZ + zpx(1), CZ + zpx(2), "dkTeal")
    span(k, -0.9, 0.9, -0.02, 0.02, CZ - zpx(0.5), CZ, "dkSeam")                                        # emitter strip
    span(k, -1 + PXG, 1 - PXG, WV, FR, TOP - SLAB, TOP, "dkGraph", top="r9GreyD")                     # the top
    span(k, -1 + PXG, 1 - PXG, FR, FR + 0.5 * PXG, TOP - SLAB + zpx(1), TOP - zpx(1), "dkTeal")
    for s in (-1, 1):                                                                                  # brackets
        bar(k, (s * 0.8, WV, TOP - SLAB - zpx(9)), (s * 0.8, 0.3, TOP - SLAB), 0.04, "dkGraphD")
    span(k, -0.72, -0.2, WV, 0.34, TOP - SLAB - zpx(7), TOP - SLAB, "dkGraphD", top="dkGraph")         # hung drawer
    span(k, -0.52, -0.4, 0.34, 0.34 + 0.5 * PXG, TOP - SLAB - zpx(4), TOP - SLAB - zpx(3), "steelL")
    span(k, SU - 0.18, SU + 0.18, SV - 0.12, SV + 0.12, TOP, TOP + zpx(1), "dkGraphD", top="dkGlass")   # scan pad
    for dv in (-0.1, 0.1):
        span(k, SU - 0.16, SU + 0.16, SV + dv - 0.012, SV + dv + 0.012, TOP + zpx(1), TOP + zpx(1.5), "dkSeam")
    for i in range(4):                                                                                 # permits
        k.box(-0.74, 0.2, TOP + i * 0.012, 0.16, 0.2, 0.012, ("medWhite", "ochM", "medWhite", "plate")[i],
              rz=0.08 * (i - 1))
    k.cyl(-0.44, 0.24, TOP, 0.06, 0.025, "steelD", top="medRed", sides=12)                             # the stamp
    k.cyl(-0.44, 0.24, TOP + 0.025, 0.022, 0.08, "dark", sides=8)
    k.cyl(-0.44, 0.24, TOP + 0.1, 0.04, 0.035, "steelL", sides=10)
    k.box(-0.1, 0.24, TOP, 0.26, 0.18, 0.03, "steelD", top="dark")                                    # the tray
    k.box(-0.08, 0.25, TOP + 0.03, 0.08, 0.06, 0.05, "medRed", top="rust", rz=0.3)
    return k


def e3_holo():
    k = K("desk2_e3_holo", FP, 0)
    for du in (-0.16, 0.16):                                                                           # the curtain
        bar(k, (SU + du, 0.0, CZ - zpx(0.5)), (SU + du, SV, TOP + zpx(2)), 0.012, L)
    s, cz = 0.22, TOP + 0.22
    c = [(*rot2(SU, SV, 0.4, a * s / 2, b * s / 2), cz + e * s / 2) for e in (-1, 1) for a, b in
         ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(4):                                                                                 # the crate
        bar(k, c[i], c[(i + 1) % 4], 0.022, L)
        bar(k, c[4 + i], c[4 + (i + 1) % 4], 0.022, L)
        bar(k, c[i], c[4 + i], 0.022, L)
    k.box(SU, SV, cz - s / 2, s - 0.02, s - 0.02, s, F, rz=0.4)
    k.cyl(SU + 0.05, SV + 0.02, cz - 0.08, 0.025, 0.12, "dkAlert", sides=8)
    ring(k, "z", SU, SV, cz + 0.02, 0.19, 24, 0.02, 0.02, L)                                          # the scan ring
    pane(k, -0.38, WV + 0.04, TOP + 0.1, 0.44, 0.3, rows(0.44, 0.3, (0.16, 0.12, 0.18), x0=0.2)
         + [(0.13, 0.03, 0.12, 0.05, "dkGo")])                                                        # the ID pane
    figure(k, -0.5, WV + 0.054, TOP + 0.13, 0.7)
    return k


DESIGNS = {"e1": (e1, e1_holo), "e2": (e2, e2_holo), "e3": (e3, e3_holo)}


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
