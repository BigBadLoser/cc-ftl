"""2x1 desk look study, round 11 (family `desk2k`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): round 10's N1 and N2 (user: "aren't bad", but the shape is sloppy and the holograms unloved), rebuilt on one
rule: the counter is a single band of constant width from the floor to the ledge, its top is the ledge, its ends are
flat and flush; the officer's work top sits inside it at desk height; nothing else stands up. Both plans come from one
superellipse (n = 2 is N2's half-ellipse, a higher n squares it off into N1's U). Three hologram treatments, one each:

  o1 U, padded (N1): a squared U, the bar's padded oxide panels across its front; holograms as a small ID card over
     the visitor's puck (portrait, lines, a code) and one display tilted back over the ledge's inner edge
  o2 D, bone (N2): the half-ellipse, bone with one oxide line; holograms kept small: a turning head-and-shoulders over
     the visitor's puck and a flat ring of readouts floating over the officer's side
  o3 D, bone, scan: as o2; the visitor's emitter throws a fan of light up at them with scan lines across it, and three
     small glyph tiles float over the officer's side

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .desk2_r1 import BK, FP, FR, F, L, SLAB, TOP, emitter, figure, mug, span
from .desk2_r2 import prism
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk+bar17+bar18+bar22+bar9"
LZ = TOP + zpx(11)                             # the ledge
W = 0.24                                       # the band's width (its ledge's depth)
A, B, V0 = 1 - PXG, FR - BK - PXG, BK + PXG    # the outer plan's half-width, depth and back line
VU, VD = 0.5, 0.0                              # the visitor's puck (u) and the officer's middle (u: -0.5)


def sup(a, b, n, steps=40):
    """The half-superellipse |u/a|^n + |(v - V0)/b|^n = 1, v >= V0, from (+a, V0) round to (-a, V0)."""
    out = []
    for i in range(steps + 1):
        t = math.pi * i / steps
        c, s = math.cos(t), math.sin(t)
        out.append((a * math.copysign(abs(c) ** (2 / n), c), V0 + b * abs(s) ** (2 / n)))
    return out


def band(n, d0, d1):
    """The strip between the plan grown in by d0 and by d1 (d0 < d1), closed by flat ends on the back line."""
    return sup(A - d0, B - d0, n) + sup(A - d1, B - d1, n)[::-1]


def front(n, d, u):
    """v of the plan grown in by d, at u."""
    a, b = A - d, B - d
    return V0 + b * max(0.0, 1 - abs(u / a) ** n) ** (1 / n)


def counter(k, n, face, face_top, line=None):
    """The band from the floor to the ledge (a dark kick under it), the ledge on it, the work top inside."""
    prism(k, band(n, 2 * PXG, W - PXG), 0, zpx(2), "x7Black")                                            # kick
    prism(k, band(n, 0.0, W), zpx(2), LZ - zpx(5), face, face_top)                                       # the band
    prism(k, band(n, -0.5 * PXG, W), LZ - zpx(3), zpx(3), "x7Gun", "r9GreyD")                             # the ledge
    if line:
        prism(k, band(n, -0.5 * PXG, 0.0), zpx(12), zpx(1), line)
    prism(k, sup(A - W, B - W, n), TOP - SLAB, SLAB, "x7Gun", "r9GreyD")                                 # work top
    pv = front(n, W / 2, VU)
    k.cyl(VU, pv, LZ, 0.055, zpx(1.5), "x7Black", top="x7Gun", sides=16)                                # ID puck
    emitter(k, VU, pv, LZ + zpx(1.5), 0.04)
    mug(k, -0.1, -0.3)
    return pv


# ---- o1 U, padded -----------------------------------------------------------------------------------------------------
N1 = 5.0


def o1(rot=0):
    k = Bench(f"desk2_o1_{rot}", FP, rot)
    counter(k, N1, "x7Gun", "x7Gun")
    prism(k, band(N1, -PXG, 2 * PXG), LZ - zpx(4), zpx(4.5), "x7Oxide", "k2OxideL")                      # ledge roll
    cols, z0, z1 = 6, zpx(4), LZ - zpx(6)
    h = (z1 - z0 - zpx(1)) / 2
    span_u = 0.74                                                                                       # the panels,
    for i in range(cols):                                                                               # on the flat
        u = -span_u + (i + 0.5) * 2 * span_u / cols                                                     # front only
        w = 2 * span_u / cols - 2 * PXG
        v = front(N1, 0.0, u)
        du = 0.01
        rz = math.atan2(front(N1, 0.0, u + du) - front(N1, 0.0, u - du), 2 * du)
        for j in range(2):
            a = z0 + j * (h + zpx(1))
            k.box(u, v + 0.5 * PXG, a, w, PXG, h - zpx(1), "x7Oxide", rz=rz)
            k.box(u, v + 0.5 * PXG, a + h - zpx(1), w, PXG, zpx(1), "k2OxideL", rz=rz)
    return k


def tilted(k, cu, cv, z0, w, h, lean, marks):
    """A holo display leaning back (top toward -v) by `lean`: film, a lit frame, marks [(x, y, w, h)] on it."""
    c, s = math.cos(lean), math.sin(lean)

    def at(y):
        return cv - y * s, z0 + y * c
    for y0, hh, ww, x, col in [(0.0, h, w, 0.0, F)] + [(y, hh, ww, x, L) for x, y, ww, hh in marks]:
        v, z = at(y0)
        k.box(cu + x, v, z, ww, 0.008, hh, col, rx=lean)
    for y in (0.0, h - 0.025):
        v, z = at(y)
        k.box(cu, v + 0.004, z, w, 0.01, 0.025, L, rx=lean)
    for x in (-w / 2 + 0.012, w / 2 - 0.012):
        v, z = at(0.0)
        k.box(cu + x, v + 0.004, z, 0.025, 0.01, h, L, rx=lean)


def o1_holo():
    k = K("desk2_o1_holo", FP, 0)
    pv = front(N1, W / 2, VU)
    z = LZ + zpx(2) + 0.08                                                                               # ID card
    bar(k, (VU, pv, LZ + zpx(2)), (VU, pv, z), 0.012, L)
    cw, ch = 0.3, 0.18
    k.box(VU, pv, z, cw, 0.008, ch, F)
    for x in (-cw / 2 + 0.012, cw / 2 - 0.012):
        k.box(VU + x, pv + 0.006, z + 0.02, 0.022, 0.008, ch - 0.04, L)
    for y in (0.0, ch - 0.022):
        k.box(VU, pv + 0.006, z + y, cw - 0.04, 0.008, 0.022, L)
    figure(k, VU - 0.08, pv + 0.01, z + 0.03, 0.45)
    for i, w in enumerate((0.1, 0.08, 0.11)):
        k.box(VU + 0.02 + w / 2, pv + 0.01, z + ch - 0.06 - i * 0.035, w, 0.008, 0.018, L)
    for i in range(6):                                                                                   # a code
        k.box(VU + 0.02 + i * 0.018, pv + 0.01, z + 0.025, 0.008 + 0.006 * (i % 2), 0.008, 0.03, L)
    iv = front(N1, W, -0.5) + 0.02                                                                      # the display
    tilted(k, -0.5, iv, LZ + 0.01, 0.46, 0.22, 0.6, [(-0.08, 0.15, 0.24, 0.02), (-0.1, 0.1, 0.2, 0.02),
                                                     (-0.06, 0.05, 0.28, 0.02), (0.15, 0.05, 0.08, 0.12)])
    return k


# ---- o2 / o3 D, bone --------------------------------------------------------------------------------------------------
N2 = 2.0


def o2(rot=0, name="o2"):
    k = Bench(f"desk2_{name}_{rot}", FP, rot)
    counter(k, N2, "x7Bone", "x7Bone", line="x7Oxide")
    prism(k, band(N2, -PXG, 2 * PXG), LZ - zpx(4), zpx(4.5), "x7Oxide", "k2OxideL")                      # ledge roll
    return k


def o3(rot=0):
    return o2(rot, "o3")


def bust(k, u, v, z):
    k.cyl(u, v, z, 0.07, 0.05, F, rtop=0.045, sides=12)
    ring(k, "z", u, v, z, 0.07, 14, 0.01, 0.016, L)
    k.cyl(u, v, z + 0.05, 0.018, 0.025, F, sides=8)
    k.cyl(u, v, z + 0.075, 0.04, 0.08, F, rtop=0.03, sides=12)
    ring(k, "z", u, v, z + 0.12, 0.045, 14, 0.008, 0.014, L)


def o2_holo():
    k = K("desk2_o2_holo", FP, 0)
    pv = front(N2, W / 2, VU)
    bar(k, (VU, pv, LZ + zpx(2)), (VU, pv, LZ + 0.06), 0.012, L)
    bust(k, VU, pv, LZ + 0.06)
    ring(k, "z", VU, pv, LZ + 0.04, 0.09, 18, 0.008, 0.02, L)
    cu, cv, z = -0.5, front(N2, W, -0.5) - 0.12, LZ + 0.04                                             # readout ring
    k.cyl(cu, cv, z, 0.2, 0.006, F, sides=28)
    ring(k, "z", cu, cv, z + 0.006, 0.19, 28, 0.008, 0.02, L)
    ring(k, "z", cu, cv, z + 0.006, 0.11, 20, 0.008, 0.015, L)
    for a in (0.3, 1.4, 2.6, 4.0, 5.2):
        k.box(cu + 0.15 * math.cos(a), cv + 0.15 * math.sin(a), z + 0.006, 0.05, 0.025, 0.008, L, rz=a)
    k.box(cu + 0.15, cv - 0.02, z + 0.006, 0.04, 0.04, 0.03, "dkAmber", rz=0.785)
    return k


def o3_holo():
    k = K("desk2_o3_holo", FP, 0)
    pv = front(N2, W / 2, VU)
    z0, z1, hw, lean = LZ + zpx(2), LZ + 0.34, 0.14, 0.2                                               # the fan
    tip = (VU, pv + 0.1, z1)
    k.box(VU, pv + 0.05, z0, 0.04, 0.008, z1 - z0, F, rx=-lean, taper=6.0)
    for du in (-hw, hw):
        bar(k, (VU, pv, z0), (VU + du, tip[1], z1), 0.012, L)
    for i in range(3):                                                                                   # scan lines
        t = 0.35 + i * 0.25
        k.box(VU, pv + 0.1 * t, z0 + (z1 - z0) * t, 2 * hw * t, 0.01, 0.014, L)
    cv = front(N2, W, -0.5) - 0.06                                                                      # glyph tiles
    for i, u in enumerate((-0.72, -0.5, -0.28)):
        z = LZ + 0.06 + 0.02 * (i == 1)
        k.box(u, cv, z, 0.14, 0.008, 0.14, F)
        for x in (-0.06, 0.06):
            k.box(u + x, cv + 0.006, z, 0.016, 0.008, 0.14, L)
        k.box(u, cv + 0.006, z + 0.045, 0.06, 0.008, 0.05, ("dkGo", "dkAmber", L)[i])
    return k


DESIGNS = {"o1": (o1, o1_holo), "o2": (o2, o2_holo), "o3": (o3, o3_holo)}


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
