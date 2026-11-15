"""2x1 desk look study, round 13 (family `desk2m`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): three more hologram treatments on round 11's D reception desk (user: another 3 holo variants). Bold lines
throughout (T, about 1.5 px), one main shape each.

  q1 ID wall: one tall screen standing on the ledge in front of the visitor, facing them: a big portrait, a name bar,
     lines and a green status strip along its foot (a lit groove in the ledge throws it)
  q2 orbit: a data core floating over the middle of the desk, a lit core inside two tilted rings and one level one,
     on a column of light from an emitter in the work top
  q3 open book: two panes leaning apart from one emitter strip on the ledge, the officer's leaning back toward them,
     the visitor's toward the visitor, each with a header bar

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .desk2_r1 import F, FP, L, TOP, emitter
from .desk2_r2 import prism
from .desk2_r11 import LZ, N2, W, front, tilted
from .desk2_r12 import T, desk
from .modkit import K
from .research_kit import PXG, bar, holo_item, ring, zpx

PAL = "desk+bar17+bar18+bar22+bar9"


def groove(k, u0, u1, d, n=12):
    """A lit groove in the ledge along the plan grown in by d, from u0 to u1."""
    a = [(u, front(N2, d - 0.6 * PXG, u)) for u in (u0 + (u1 - u0) * i / n for i in range(n + 1))]
    b = [(u, front(N2, d + 0.6 * PXG, u)) for u in (u1 - (u1 - u0) * i / n for i in range(n + 1))]
    prism(k, a + b, LZ, zpx(0.6), "dkSeam")


def frame(k, cu, cv, z0, w, h, rz=0.0):
    """An upright pane facing +v (turned rz): film and a bold lit frame."""
    c, s = math.cos(rz), math.sin(rz)
    k.box(cu, cv, z0, w, 0.008, h, F, rz=rz)
    for z in (z0, z0 + h - T):
        k.box(cu - s * 0.004, cv + c * 0.004, z, w, 0.01, T, L, rz=rz)
    for x in (-w / 2 + T / 2, w / 2 - T / 2):
        k.box(cu + c * x - s * 0.004, cv + s * x + c * 0.004, z0, T, 0.01, h, L, rz=rz)


def mark(k, cu, cv, rz, x, z, w, h, col=L):
    c, s = math.cos(rz), math.sin(rz)
    k.box(cu + c * x - s * 0.008, cv + s * x + c * 0.008, z, w, 0.008, h, col, rz=rz)


# ---- q1 ID wall -------------------------------------------------------------------------------------------------------
QU, QD = 0.36, 0.05                            # q1's wall: its middle (u) and inset from the ledge's front


def q1(rot=0):
    k = desk(f"desk2_q1_{rot}", rot)
    groove(k, QU - 0.24, QU + 0.24, QD)
    return k


def q1_holo():
    k = K("desk2_q1_holo", FP, 0)
    cv = front(N2, QD, QU)
    e = 0.01
    rz = math.atan2(front(N2, QD, QU + e) - front(N2, QD, QU - e), 2 * e)
    z0, w, h = LZ + zpx(1), 0.5, 0.42
    frame(k, QU, cv, z0, w, h, rz)
    mark(k, QU, cv, rz, -0.12, z0 + 0.1, 0.18, 0.09, L)                                                  # portrait:
    mark(k, QU, cv, rz, -0.12, z0 + 0.19, 0.05, 0.03, L)                                                 # shoulders,
    c, s = math.cos(rz), math.sin(rz)                                                                     # neck, head
    ring(k, "v", QU + c * -0.12 - s * 0.008, cv + s * -0.12 + c * 0.008, z0 + 0.27, 0.06, 16, 0.008, T * 0.7, L)
    mark(k, QU, cv, rz, 0.0, z0 + h - 0.1, w - 0.1, 0.04, L)                                             # name bar
    for i, ww in enumerate((0.14, 0.1, 0.16)):
        mark(k, QU, cv, rz, 0.08 + ww / 2 - 0.05, z0 + 0.22 - i * 0.055, ww, 0.025, L)
    mark(k, QU, cv, rz, 0.0, z0 + T + 0.01, w - 0.1, 0.035, "dkGo")                                       # status
    return k


# ---- q2 orbit ---------------------------------------------------------------------------------------------------------
def q2_spot():
    return 0.0, front(N2, W, 0.0) - 0.16


def q2(rot=0):
    k = desk(f"desk2_q2_{rot}", rot)
    u, v = q2_spot()
    k.cyl(u, v, TOP, 0.08, zpx(1.5), "x7Black", top="x7Gun", sides=16)                                  # the emitter
    emitter(k, u, v, TOP + zpx(1.5), 0.06)
    return k


def tilted_ring(k, cu, cv, cz, r, tilt, yaw, n=22):
    pts = []
    for i in range(n + 1):
        a = math.tau * i / n
        x, y, z = r * math.cos(a), r * math.sin(a) * math.cos(tilt), r * math.sin(a) * math.sin(tilt)
        pts.append((cu + x * math.cos(yaw) - y * math.sin(yaw), cv + x * math.sin(yaw) + y * math.cos(yaw), cz + z))
    for p, q in zip(pts, pts[1:]):
        bar(k, p, q, T * 0.6, L)


def q2_holo():
    k = K("desk2_q2_holo", FP, 0)
    u, v = q2_spot()
    cz, R = LZ + 0.2, 0.09
    k.cyl(u, v, TOP + zpx(2), 0.035, cz - R - TOP - zpx(2), F, sides=10)                                 # the column
    for i in range(6):                                                                                    # the core
        t = -1 + (2 * i + 1) / 6
        k.cyl(u, v, cz - R + 2 * R * i / 6, R * math.sqrt(1 - t * t), 2 * R / 6, F, sides=14)
    ring(k, "z", u, v, cz, R + 0.005, 16, 0.02, T * 0.6, L)
    tilted_ring(k, u, v, cz, 0.2, 1.1, 0.5)
    tilted_ring(k, u, v, cz, 0.2, 1.1, -0.9)
    ring(k, "z", u, v, cz - 0.02, 0.26, 26, 0.012, T * 0.6, L)
    for a in (0.6, 2.4, 4.3):                                                                             # satellites
        k.box(u + 0.26 * math.cos(a), v + 0.26 * math.sin(a), cz - 0.035, 0.045, 0.045, 0.045,
              "dkAmber" if a > 4 else L, rz=0.785)
    return k


# ---- q3 open book -----------------------------------------------------------------------------------------------------
BU, BD = 0.0, W / 2                            # q3's spine: its middle (u) and inset


def q3(rot=0):
    k = desk(f"desk2_q3_{rot}", rot)
    groove(k, BU - 0.26, BU + 0.26, BD)
    return k


def q3_holo():
    k = K("desk2_q3_holo", FP, 0)
    v = front(N2, BD, BU)
    z0, w, h = LZ + zpx(1), 0.5, 0.3
    for lean, sign in ((0.45, -1), (-0.45, 1)):                                                         # officer's,
        marks = [(0.0, h - 0.07, w - 0.12, 0.035)] + [(-0.06 + 0.02 * i, 0.16 - i * 0.05, 0.26 - 0.04 * i, 0.025)
                                                      for i in range(3)]                               # visitor's
        tilted(k, BU, v, z0, w, h, lean, marks)
        c = math.cos(lean)                                                                                # bold rims
        k.box(BU, v - (h - T) * math.sin(lean), z0 + (h - T) * c, w, 0.012, T, L, rx=lean)
        for x in (-w / 2 + T / 2, w / 2 - T / 2):
            k.box(BU + x, v, z0, T, 0.012, h, L, rx=lean)
    bar(k, (BU - w / 2, v, z0), (BU + w / 2, v, z0), T, L)                                              # the spine
    return k


DESIGNS = {"q1": (q1, q1_holo), "q2": (q2, q2_holo), "q3": (q3, q3_holo)}


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
