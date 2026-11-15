"""2x1 desk look study, round 5 (family `desk2e`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): three more desks, each a different kind of object with its own holo projector and a post's dressing. The
operator works from the tile in front (+v, lower left at r0); the dressing goes on any body.

  h1 scanner arch, customs: a plain slate desk with a half-ring arch standing over its middle, an emitter strip lining
     the arch's inside; whatever sits on the pad under it is scanned (the crate), the ID pane beside it
  h2 hover, office: a rounded bone top floating a few px over a dark rounded plinth, a lit gap between them; the
     projector disc set in the top (globe and route, a notes pane)
  h3 retro, guard: a chunky cream desk (cassette-futurism): bullnose front, an orange band, two rounded pedestals, a
     sloped dark-glass console bezel along the back that the deck plan and camera feeds rise from

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .desk2_r1 import BK, FP, FR, F, L, SLAB, TOP, emitter, figure, mug, pane, rows, span
from .desk2_r2 import prism
from .desk2_r3 import crate, plan_marks
from .desk2_r4 import extrude, quarter
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk+bar17+bar18+bar22+bar9"


def stadium(cu, cv, lu, rv, n=10):
    """A rounded oblong outline: straight sides lu long along u, round ends of radius rv."""
    a = [(cu + lu / 2 + rv * math.cos(t), cv + rv * math.sin(t)) for t in
         (-math.pi / 2 + math.pi * i / n for i in range(n + 1))]
    b = [(cu - lu / 2 + rv * math.cos(t), cv + rv * math.sin(t)) for t in
         (math.pi / 2 + math.pi * i / n for i in range(n + 1))]
    return a + b


# ---- h1 scanner arch, customs -----------------------------------------------------------------------------------------
AV, AR, AT, AW = -0.06, 0.46, 0.07, 0.14        # the arch's v, radius, radial thickness, depth along v


def half_ring(k, cu, cv, cz, r, w, t, col, n=14):
    seg = math.pi * r / n * 1.12
    for i in range(n):
        a = (i + 0.5) * math.pi / n
        k.box(cu + r * math.cos(a), cv, cz + r * math.sin(a) - t / 2, seg, w, t, col, ry=-a - math.pi / 2)


def h1(rot=0):
    k = Bench(f"desk2_h1_{rot}", FP, rot)
    h = TOP - SLAB
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR, h, TOP, "z8SlateL", top="z8Grey")                       # the top
    for s in (-1, 1):                                                                                  # pedestals
        span(k, *sorted((s * (1 - 2 * PXG), s * 0.6)), BK + 2 * PXG, FR - PXG, zpx(2), h, "z8Slate", top="z8SlateL")
        span(k, *sorted((s * (1 - 3 * PXG), s * 0.61)), BK + 3 * PXG, FR - 2 * PXG, 0, zpx(2), "z8Char")
        span(k, *sorted((s * (1 - 3 * PXG), s * 0.62)), FR - PXG, FR - 0.5 * PXG, zpx(12), zpx(13), "z8Mustard")
    span(k, -0.6, 0.6, BK + 2 * PXG, BK + 4 * PXG, zpx(8), h, "z8Slate")                                 # modesty panel
    cz = TOP + zpx(2)
    for s in (-1, 1):                                                                                  # arch feet
        span(k, s * AR - 0.07, s * AR + 0.07, AV - AW / 2 - PXG, AV + AW / 2 + PXG, TOP, cz, "z8Char", top="z8SlateD")
    half_ring(k, 0.0, AV, cz, AR, AW, AT, "z8SlateD")                                                  # the arch
    half_ring(k, 0.0, AV, cz, AR - AT / 2 - 0.006, AW * 0.4, 0.012, "dkSeam")                          # its emitter
    half_ring(k, 0.0, AV - AW / 2 - 0.004, cz, AR, 0.008, 0.02, "z8Mustard")                           # (a front line)
    span(k, -0.22, 0.22, AV - 0.12, AV + 0.12, TOP, TOP + zpx(1), "z8Char", top="dkGlass")              # the pad
    for i in range(4):                                                                                 # permits
        k.box(-0.78, 0.22, TOP + i * 0.012, 0.16, 0.2, 0.012, ("medWhite", "ochM", "medWhite", "plate")[i],
              rz=0.08 * (i - 1))
    k.cyl(-0.4, 0.28, TOP, 0.06, 0.025, "steelD", top="medRed", sides=12)                              # the stamp
    k.cyl(-0.4, 0.28, TOP + 0.025, 0.022, 0.08, "dark", sides=8)
    k.cyl(-0.4, 0.28, TOP + 0.1, 0.04, 0.035, "steelL", sides=10)
    k.box(0.74, 0.2, TOP, 0.26, 0.18, 0.03, "steelD", top="dark")                                     # the tray
    k.box(0.76, 0.21, TOP + 0.03, 0.08, 0.06, 0.05, "medRed", top="rust", rz=0.3)
    return k


def h1_holo():
    k = K("desk2_h1_holo", FP, 0)
    crate(k, 0.2, (0.0, AV), TOP + 0.16)
    for dz in (0.08, 0.24):                                                                            # scan rings
        ring(k, "z", 0.0, AV, TOP + dz, 0.17, 24, 0.012, 0.02, L)
    pane(k, -0.74, BK + 0.1, TOP + 0.08, 0.4, 0.28, rows(0.4, 0.28, (0.12, 0.1, 0.14), x0=0.18)
         + [(0.12, 0.03, 0.1, 0.05, "dkGo")])
    figure(k, -0.86, BK + 0.114, TOP + 0.11, 0.65)
    return k


# ---- h2 hover, office -------------------------------------------------------------------------------------------------
PZ = TOP - SLAB - zpx(4)                      # h2's plinth top
EU, EV = 0.5, 0.0                             # its projector


def h2(rot=0):
    k = Bench(f"desk2_h2_{rot}", FP, rot)
    prism(k, stadium(0.0, -0.04, 0.7, 0.24), zpx(1), PZ - zpx(1), "x7Gun", "x7Black")                  # the plinth
    prism(k, stadium(0.0, -0.04, 0.82, 0.29), 0, zpx(1), "x7Black")
    prism(k, stadium(0.0, -0.04, 0.7, 0.2), PZ, zpx(1), "dkSeam")                                       # the lit gap
    prism(k, stadium(0.0, 0.0, 1.46, 0.24), TOP - SLAB, SLAB, "x7Bone", "x7White")                      # the top
    prism(k, stadium(0.0, 0.0, 1.46, 0.245), TOP - SLAB + zpx(1), zpx(1), "x7Oxide")                   # its band
    emitter(k, EU, EV, TOP, 0.13)
    k.box(-0.2, 0.12, TOP, 0.22, 0.16, 0.012, "steelD", top="dark", rz=0.35)                          # a slate
    for i in range(3):                                                                                 # folders
        k.box(-0.66, -0.06, TOP + i * 0.014, 0.16, 0.22, 0.014, ("ochM", "dkTeal", "medWhite")[i], rz=0.1 * (i - 1))
    mug(k, 0.08, -0.14)
    return k


def h2_holo():
    k = K("desk2_h2_holo", FP, 0)
    R, cz = 0.15, TOP + 0.36
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
    pane(k, -0.3, -0.16, TOP + 0.1, 0.46, 0.26, rows(0.46, 0.26, (0.28, 0.2, 0.32)))
    return k


# ---- h3 retro, guard --------------------------------------------------------------------------------------------------
BV0, BV1, BZ = -0.08, BK + 0.1, TOP + zpx(12)  # h3's bezel: foot v, top v, top height


def h3(rot=0):
    k = Bench(f"desk2_h3_{rot}", FP, rot)
    r = 4
    ru, rz = r * PXG, zpx(r)
    top = ([(FR, TOP - SLAB - zpx(2))] + quarter(FR - ru, TOP - rz, ru, rz, 0.0, math.pi / 2)            # bullnose,
           + [(BV0, TOP), (BV1, BZ), (BK, BZ), (BK, TOP - SLAB - zpx(2))])                                # top, bezel
    extrude(k, top, "u", -1 + PXG, 1 - PXG, "x7White", top="x7White")
    extrude(k, [(FR + 0.5 * PXG, TOP - SLAB - zpx(1)), (FR + 0.5 * PXG, TOP - SLAB + zpx(1)),
                (FR, TOP - SLAB + zpx(1)), (FR, TOP - SLAB - zpx(1))], "u", -1 + PXG, 1 - PXG, "z8Orange")   # the band
    d = 0.6 * PXG                                                                                       # the glass,
    extrude(k, [(BV0 - 0.04 + d, TOP + zpx(2)), (BV1 + 0.03 + d, BZ - zpx(2)), (BV1 + 0.03, BZ - zpx(2)),  # proud of
                (BV0 - 0.04, TOP + zpx(2))], "u", -0.8, 0.8, "dkGlass")                                   # the slope
    for s in (-1, 1):                                                                                  # pedestals
        u0, u1 = sorted((s * (1 - 2 * PXG), s * 0.62))
        hp = TOP - SLAB - zpx(2)
        ped = ([(FR - 2 * PXG, 0.0)] + quarter(FR - 2 * PXG - ru, hp - rz, ru, rz, 0.0, math.pi / 2)
               + [(BK + 2 * PXG, hp), (BK + 2 * PXG, 0.0)])
        extrude(k, ped, "u", u0, u1, "x7White", top="x7White")
        span(k, u0 + 2 * PXG, u1 - 2 * PXG, FR - 2 * PXG, FR - 1.5 * PXG, zpx(4), zpx(6), "z8Orange")      # a stripe
        span(k, u0 + PXG, u1 - PXG, BK + 3 * PXG, FR - 3 * PXG, 0, zpx(1), "x7Black")                    # a kick shadow
    k.box(0.0, 0.16, TOP, 0.5, 0.16, zpx(2), "x7Khaki", top="x7White")                                # keyboard
    for i in range(6):
        k.box(-0.2 + i * 0.08, 0.16, TOP + zpx(2), 0.05, 0.1, zpx(0.6), "z8Char")
    k.box(-0.7, 0.12, TOP, 0.12, 0.26, zpx(2), "x7Black", top="x7Gun")                                # the handset
    k.box(-0.7, 0.12, TOP + zpx(2), 0.06, 0.24, zpx(2), "z8Orange", top="z8OrangeL")
    k.cyl(0.84, 0.0, TOP, 0.06, 0.03, "steelD", top="dark", sides=12)                                 # the beacon
    k.cyl(0.84, 0.0, TOP + 0.03, 0.045, 0.07, "hivis", rtop=0.02, sides=12)
    mug(k, 0.6, 0.24)
    return k


def h3_holo():
    k = K("desk2_h3_holo", FP, 0)
    pv, pz = BK + 0.08, BZ + zpx(1)
    pane(k, 0.0, pv, pz, 0.66, 0.3, plan_marks())
    for i, u in enumerate((-0.64, 0.64)):
        pane(k, u, pv, pz, 0.26, 0.22, [(0.08, 0.16, 0.05, 0.03, "dkAlert" if i else L)])
        figure(k, u - 0.03 + 0.05 * i, pv + 0.014, pz + 0.03, 0.6)
    return k


DESIGNS = {"h1": (h1, h1_holo), "h2": (h2, h2_holo), "h3": (h3, h3_holo)}


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
