"""2x1 desk look study, round 12 (family `desk2l`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): round 11's D reception desk (o2) with three new hologram treatments (user: the holograms need another try).
Earlier holograms were thin wire frames that break into specks at game scale; these are each one bold shape with
thick lit edges.

  p1 ribbon: one wide screen curving along the ledge (a lit groove in the ledge throws it), the officer's record on
     its left half, the visitor's portrait and lines on the right
  p2 columns: two columns of light from rings in the ledge, the visitor's with their ID card turning inside it, the
     officer's with three stacked data discs
  p3 mats: flat lit panels laid on the ledge (the camera sees tops best), the visitor's with a hand outline, and one
     big status icon floating over the visitor: a green ring with a tick

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .desk2_r1 import F, FP, L
from .desk2_r2 import prism
from .desk2_r11 import LZ, N2, VU, W, band, counter, front
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk+bar17+bar18+bar22+bar9"
T = 0.045                                      # a bold holo line (about 1.5 px)
OU = -0.5                                      # the officer's middle


def desk(name, rot):
    k = Bench(name, FP, rot)
    counter(k, N2, "x7Bone", "x7Bone", line="x7Oxide")
    prism(k, band(N2, -PXG, 2 * PXG), LZ - zpx(4), zpx(4.5), "x7Oxide", "k2OxideL")                      # ledge roll
    return k


def along(u0, u1, d, n):
    """n points evenly spaced in u along the plan grown in by d, each with its tangent angle."""
    out = []
    for i in range(n):
        u = u0 + (i + 0.5) * (u1 - u0) / n
        e = 0.01
        out.append((u, front(N2, d, u), math.atan2(front(N2, d, u + e) - front(N2, d, u - e), 2 * e)))
    return out


# ---- p1 ribbon --------------------------------------------------------------------------------------------------------
RD, RU0, RU1 = W / 2, -0.64, 0.64              # p1's ribbon: inset, ends


def p1(rot=0):
    k = desk(f"desk2_p1_{rot}", rot)
    pts = [(u, front(N2, RD - 0.6 * PXG, u)) for u in (RU0 + (RU1 - RU0) * i / 24 for i in range(25))]
    prism(k, pts + [(u, front(N2, RD + 0.6 * PXG, u)) for u in (RU1 - (RU1 - RU0) * i / 24 for i in range(25))],
          LZ, zpx(0.6), "dkSeam")                                                                       # the groove
    return k


def p1_holo():
    k = K("desk2_p1_holo", FP, 0)
    z0, h, n = LZ + 0.02, 0.3, 20
    pts = [(u, front(N2, RD, u)) for u in (RU0 + (RU1 - RU0) * i / n for i in range(n + 1))]
    for (u0, v0), (u1, v1) in zip(pts, pts[1:]):                                                         # segments
        u, v, a, sw = (u0 + u1) / 2, (v0 + v1) / 2, math.atan2(v1 - v0, u1 - u0), math.hypot(u1 - u0, v1 - v0)
        k.box(u, v, z0, sw * 1.04, 0.008, h, F, rz=a)
        k.box(u, v + 0.004, z0, sw * 1.04, 0.01, T, L, rz=a)
        k.box(u, v + 0.004, z0 + h - T, sw * 1.04, 0.01, T, L, rz=a)
    for u in (RU0, RU1):                                                                                  # its ends
        k.box(u, front(N2, RD, u) + 0.004, z0, T, 0.01, h, L)
    for u, w, y in ((-0.48, 0.22, 0.2), (-0.42, 0.3, 0.14), (-0.46, 0.24, 0.08), (-0.18, 0.2, 0.2), (-0.2, 0.16, 0.14)):
        v = front(N2, RD, u)                                                                             # record rows
        k.box(u, v + 0.008, z0 + y, w, 0.008, 0.03, L)
    pu = 0.42                                                                                             # portrait
    v = front(N2, RD, pu)
    k.box(pu, v + 0.008, z0 + 0.06, 0.16, 0.008, 0.07, L, taper=0.6)
    ring(k, "v", pu, v + 0.008, z0 + 0.17, 0.045, 14, 0.008, 0.03, L)
    for i, w in enumerate((0.16, 0.12, 0.18)):
        k.box(0.66, front(N2, RD, 0.66) + 0.008, z0 + 0.2 - i * 0.055, w, 0.008, 0.03, L)
    k.box(0.12, front(N2, RD, 0.12) + 0.008, z0 + 0.04, 0.02, 0.008, h - 0.08, L)                       # the split
    return k


# ---- p2 columns -------------------------------------------------------------------------------------------------------
def col_spots():
    return ((VU, front(N2, W / 2, VU), 0.1), (OU, front(N2, W / 2, OU), 0.12))


def p2(rot=0):
    k = desk(f"desk2_p2_{rot}", rot)
    for u, v, r in col_spots():                                                                         # emitter rings
        k.cyl(u, v, LZ, r + 0.01, zpx(0.6), "x7Black", top="dkGlass", sides=20)
        ring(k, "z", u, v, LZ + zpx(0.6), r - 0.01, 20, 0.008, 0.025, "dkSeam")
    return k


def p2_holo():
    k = K("desk2_p2_holo", FP, 0)
    for i, (u, v, r) in enumerate(col_spots()):
        z0, h = LZ + zpx(1), 0.34
        k.cyl(u, v, z0, r, h, F, sides=20)
        for z in (z0, z0 + h - 0.02):
            ring(k, "z", u, v, z, r + 0.004, 20, 0.02, T * 0.7, L)
        for a in (0.4, 2.0, 3.6, 5.2):                                                                   # its ribs
            k.box(u + r * math.cos(a), v + r * math.sin(a), z0, 0.02, 0.02, h, L)
        if i == 0:                                                                                       # the ID card
            cz = z0 + 0.1
            k.box(u, v, cz, 0.16, 0.012, 0.13, L, rz=0.5)
            k.box(u, v + 0.004, cz + 0.02, 0.11, 0.012, 0.09, F, rz=0.5)
        else:                                                                                            # data discs
            for j in range(3):
                z = z0 + 0.07 + j * 0.09
                k.cyl(u, v, z, r * 0.75, 0.012, L, sides=18)
                k.cyl(u, v, z + 0.012, r * 0.45, 0.02, F, sides=14)
    return k


# ---- p3 mats ----------------------------------------------------------------------------------------------------------
def p3(rot=0):
    return desk(f"desk2_p3_{rot}", rot)


def mat(k, u0, u1, d0, d1, z):
    """A flat lit panel on the ledge between u0..u1, inset d0..d1, with a bold rim along both long edges."""
    outer = [(u, front(N2, d0, u)) for u in (u0 + (u1 - u0) * i / 12 for i in range(13))]
    inner = [(u, front(N2, d1, u)) for u in (u0 + (u1 - u0) * i / 12 for i in range(13))]
    prism(k, outer + inner[::-1], z, 0.004, F)
    prism(k, outer + [(u, v - T * 1.2) for u, v in outer[::-1]], z + 0.004, 0.006, L)
    prism(k, inner + [(u, v + T * 1.2) for u, v in inner[::-1]], z + 0.004, 0.006, L)
    for u in (u0, u1):
        a, b = front(N2, d1, u), front(N2, d0, u)
        prism(k, [(u - T * 0.4, a), (u + T * 0.4, a), (u + T * 0.4, b), (u - T * 0.4, b)], z + 0.004, 0.004, L)


def p3_holo():
    k = K("desk2_p3_holo", FP, 0)
    z = LZ + 0.004
    mat(k, VU - 0.2, VU + 0.2, 0.02, W - 0.03, z)                                                          # visitor's
    hv = front(N2, W / 2, VU)
    for du in (-0.06, -0.02, 0.02, 0.06):                                                                # a hand
        k.box(VU + du, hv + 0.01, z + 0.006, 0.025, 0.07, 0.004, L)
    k.box(VU, hv - 0.04, z + 0.006, 0.14, 0.06, 0.004, L)
    mat(k, OU - 0.26, OU + 0.16, 0.02, W - 0.03, z)                                                         # officer's
    ov = front(N2, W / 2, OU)
    for i, w in enumerate((0.24, 0.16, 0.28)):
        k.box(OU - 0.05, ov - 0.05 + i * 0.05, z + 0.006, w, 0.025, 0.004, L)
    cz = LZ + 0.32                                                                                        # status icon
    bar(k, (VU, hv, LZ + 0.01), (VU, hv, cz - 0.1), 0.012, L)
    ring(k, "v", VU, hv, cz, 0.09, 20, 0.012, T, "dkGo")
    k.box(VU, hv, cz - 0.08, 0.17, 0.008, 0.17, F)
    bar(k, (VU - 0.05, hv + 0.006, cz), (VU - 0.012, hv + 0.006, cz - 0.04), T * 0.8, "dkGo")             # the tick
    bar(k, (VU - 0.012, hv + 0.006, cz - 0.04), (VU + 0.055, hv + 0.006, cz + 0.045), T * 0.8, "dkGo")
    return k


DESIGNS = {"p1": (p1, p1_holo), "p2": (p2, p2_holo), "p3": (p3, p3_holo)}


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
