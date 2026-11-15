"""2x1 desk look study, round 7 (family `desk2g`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): desks for a post where someone sits to monitor and check IDs and clearances (guard, customs), plain enough
for a solo office too. Unlike rounds 1-6 the officer sits BEHIND the desk (-v, upper right at r0) facing the camera, and
whoever is checked stands at the front (+v); the preview shows both, with the console chair (its own 1x1 piece).

  j1 reception counter: a raised ledge on the visitor's side over a lower work top; a screen and keyboard face the
     officer; the visitor's ID floats over the ledge from a puck on it
  j2 monitoring desk: a plain desk with a modesty panel on the visitor's side, three monitors facing the officer (the
     visitor sees their backs), a small radar hologram at the officer's elbow
  j3 open desk with a scanner: a light desk on two slab ends; a scan pad built into the visitor's corner, angled up at
     them, throws the ID up; a slim tablet stand faces the officer

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import console_proto as C
from . import core, post
from .cmbkit import Frame
from .desk2_r1 import BK, FP, FR, L, SLAB, TOP, emitter, figure, mug, pane, rows, span
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk+bar17+bar18+bar22+bar9"
CHAIR_RECOL = {"navy": "x7Oxide", "brass": "steelL", "steelD": "x7Gun"}


class _Chair(Frame):
    def poly(self, pts, color, flip=False):
        super().poly(pts, CHAIR_RECOL.get(color, color), flip)


def chair():
    """The console chair on its own 1x1 tile, facing +v (r0), the bar's oxide on its cushions."""
    m = core.Mesh("desk2_chair")
    C.chair(_Chair(m, 2, centre=K("desk2_chair_xy", (1, 1), 0).p(0.0, 0.0)), 0.0, 0.0, False)
    return [m.build()]


def monitor(k, u, v, w=0.34, h=zpx(11), z=TOP, rz=0.0):
    """A flat screen on a stand, facing -v (the officer): its back is what the camera sees."""
    k.box(u, v, z, 0.14, 0.1, zpx(1), "x7Black", rz=rz)
    k.box(u, v + 0.01, z + zpx(1), 0.03, 0.03, zpx(4), "x7Gun", rz=rz)
    k.box(u, v, z + zpx(4), w, 2.5 * PXG, h, "x7Gun", top="x7Black", rz=rz)
    k.box(u, v - 1.4 * PXG, z + zpx(5), w - 2 * PXG, 0.3 * PXG, h - zpx(2), "dkGlass", rz=rz)
    k.box(u + w / 2 - 0.04, v + 1.3 * PXG, z + zpx(5), 0.02, 0.3 * PXG, zpx(1), "dkGo", rz=rz)    # power light


def keyboard(k, u, v):
    k.box(u, v, TOP, 0.34, 0.12, zpx(1.5), "x7Black", top="x7Gun")


# ---- j1 reception counter ---------------------------------------------------------------------------------------------
LV, LZ = 0.16, TOP + zpx(10)                  # j1's ledge: its back edge (v) and height
PU = -0.5                                     # the ID puck


def j1(rot=0):
    k = Bench(f"desk2_j1_{rot}", FP, rot)
    span(k, -1 + PXG, 1 - PXG, FR - 4 * PXG, FR, zpx(2), LZ - zpx(3), "x7Bone", top="x7Bone")           # front panel
    span(k, -1 + 2 * PXG, 1 - 2 * PXG, FR - 4 * PXG, FR - PXG, 0, zpx(2), "x7Black")
    span(k, -1 + PXG, 1 - PXG, FR, FR + 0.5 * PXG, zpx(12), zpx(14), "dkTeal")                          # a teal band
    span(k, -1 + PXG, 1 - PXG, LV, FR + PXG, LZ - zpx(3), LZ, "x7Gun", top="r9GreyD")                   # the ledge
    for s in (-1, 1):                                                                                  # end panels
        span(k, *sorted((s * (1 - PXG), s * (1 - 4 * PXG))), BK + PXG, FR - 4 * PXG, 0, LZ - zpx(3), "x7Bone",
             top="x7Bone")
    span(k, -1 + 4 * PXG, 1 - 4 * PXG, BK + PXG, LV + PXG, TOP - SLAB, TOP, "x7Gun", top="r9GreyD")      # work top
    span(k, -1 + 4 * PXG, 1 - 4 * PXG, LV + PXG, LV + 2 * PXG, TOP, LZ - zpx(3), "x7Bone")              # ledge riser
    monitor(k, 0.38, -0.02)
    keyboard(k, 0.38, -0.3)
    k.box(-0.15, -0.28, TOP, 0.22, 0.16, 0.012, "steelD", top="dark", rz=0.3)                          # a slate
    mug(k, -0.75, -0.2)
    k.cyl(PU, 0.33, LZ, 0.07, zpx(2), "x7Black", top="x7Gun", sides=16)                                 # the ID puck
    emitter(k, PU, 0.33, LZ + zpx(2), 0.055)
    k.cyl(0.62, 0.34, LZ, 0.05, 0.02, "steelD", top="medRed", sides=12)                                # the stamp
    k.cyl(0.62, 0.34, LZ + 0.02, 0.02, 0.06, "dark", sides=8)
    return k


def j1_holo():
    k = K("desk2_j1_holo", FP, 0)
    z = LZ + zpx(3) + 0.04
    bar(k, (PU, 0.33, LZ + zpx(3)), (PU, 0.33, z), 0.015, L)
    pane(k, PU, 0.33, z, 0.4, 0.24, rows(0.4, 0.24, (0.12, 0.1, 0.14), x0=0.2) + [(0.12, 0.03, 0.1, 0.04, "dkGo")])
    figure(k, PU - 0.12, 0.344, z + 0.03, 0.6)
    return k


# ---- j2 monitoring desk -----------------------------------------------------------------------------------------------
RU, RV = -0.78, -0.24                         # j2's radar puck


def j2(rot=0):
    k = Bench(f"desk2_j2_{rot}", FP, rot)
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR, TOP - SLAB, TOP, "x7Bone", top="x7Bone")                  # the top
    span(k, -1 + 2 * PXG, 1 - 2 * PXG, FR - 4 * PXG, FR - 2 * PXG, zpx(4), TOP - SLAB, "x7Gun")          # modesty panel
    for s in (-1, 1):                                                                                  # end panels
        span(k, *sorted((s * (1 - 2 * PXG), s * (1 - 5 * PXG))), BK + 2 * PXG, FR - 2 * PXG, 0, TOP - SLAB, "x7Gun",
             top="x7Gun")
        span(k, *sorted((s * (1 - 2 * PXG), s * (1 - 5 * PXG))), FR - 2 * PXG, FR - 1.5 * PXG, zpx(14), zpx(16),
             "x7Oxide")
    for u, rz in ((-0.42, -0.25), (0.0, 0.0), (0.42, 0.25)):                                           # monitors
        monitor(k, u, 0.12 + abs(u) * 0.25, w=0.36, rz=rz)
    keyboard(k, 0.0, -0.22)
    mug(k, 0.72, -0.26)
    k.cyl(RU, RV, TOP, 0.09, zpx(2), "x7Black", top="x7Gun", sides=16)                                  # radar puck
    emitter(k, RU, RV, TOP + zpx(2), 0.07)
    return k


def j2_holo():
    k = K("desk2_j2_holo", FP, 0)
    z = TOP + 0.2
    bar(k, (RU, RV, TOP + zpx(3)), (RU, RV, z), 0.015, L)
    k.cyl(RU, RV, z, 0.15, 0.008, "dkHoloF", sides=24)                                                  # the disc
    for r in (0.14, 0.08):
        ring(k, "z", RU, RV, z + 0.008, r, 24, 0.01, 0.018, L)
    bar(k, (RU, RV, z + 0.01), (RU + 0.13, RV - 0.05, z + 0.01), 0.015, L)                             # the sweep
    for (du, dv), col in (((0.05, 0.08), L), ((-0.07, -0.04), "dkAlert")):
        k.box(RU + du, RV + dv, z + 0.01, 0.035, 0.035, 0.035, col, rz=0.785)
    return k


# ---- j3 open desk with a scanner --------------------------------------------------------------------------------------
SU, SV, SZ = 0.72, 0.3, TOP + zpx(5)          # j3's scan pad (its middle) and height


def j3(rot=0):
    k = Bench(f"desk2_j3_{rot}", FP, rot)
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR - 2 * PXG, TOP - SLAB, TOP, "x7Bone", top="x7Bone")         # the top
    for s in (-1, 1):                                                                                  # slab ends
        span(k, *sorted((s * (1 - 2 * PXG), s * (1 - 5 * PXG))), BK + 2 * PXG, FR - 3 * PXG, 0, TOP - SLAB, "x7Bone",
             top="x7Bone")
    span(k, -1 + 5 * PXG, 1 - 5 * PXG, FR - 6 * PXG, FR - 4 * PXG, zpx(10), TOP - SLAB, "x7Oxide")       # modesty band
    span(k, SU - 0.22, SU + 0.22, SV - 0.18, FR + 2 * PXG, TOP, TOP + zpx(2), "x7Gun", top="r9GreyD")    # the scanner
    k.box(SU, SV + 0.04, TOP + zpx(2), 0.4, 0.22, zpx(3), "x7Gun", top="x7Black", rx=-0.35)              # its wedge
    k.box(SU, SV + 0.05, TOP + zpx(4.2), 0.32, 0.15, zpx(0.6), "dkSeam", rx=-0.35)                      # the pad
    k.box(-0.3, -0.18, TOP, 0.1, 0.1, zpx(5), "x7Black")                                               # tablet stand
    k.box(-0.3, -0.2, TOP + zpx(4), 0.3, 1.5 * PXG, zpx(8), "x7Gun", top="x7Black", rx=0.25)
    keyboard(k, -0.3, -0.38)
    for i in range(3):                                                                                 # folders
        k.box(0.2, -0.22, TOP + i * 0.014, 0.16, 0.22, 0.014, ("ochM", "dkTeal", "medWhite")[i], rz=0.1 * (i - 1))
    mug(k, -0.78, 0.0)
    return k


def j3_holo():
    k = K("desk2_j3_holo", FP, 0)
    z = SZ + 0.1
    for du in (-0.14, 0.14):
        bar(k, (SU + du, SV + 0.05, SZ), (SU + du * 1.2, SV, z), 0.012, L)
    pane(k, SU, SV, z, 0.38, 0.24, rows(0.38, 0.24, (0.12, 0.1, 0.12), x0=0.19) + [(0.11, 0.03, 0.1, 0.04, "dkGo")])
    figure(k, SU - 0.11, SV + 0.014, z + 0.03, 0.6)
    return k


DESIGNS = {"j1": (j1, j1_holo), "j2": (j2, j2_holo), "j3": (j3, j3_holo)}


def _holo(v):
    def run(v=v):                            # (the default keys the render cache)
        core.clear_scene_meshes()
        post.select(PAL)
        mask = DESIGNS[v][0]().build()
        it = holo_item(f"module.desk2.{v}.holo", FP, mask, DESIGNS[v][1]().build())
        return [it] if it else []
    return run


def jobs():
    out = [("module.desk2.chair", (1, 1), "prop", chair)]
    for v in DESIGNS:
        out += [(f"module.desk2.{v}", FP, "prop", lambda v=v: DESIGNS[v][0]().build()), _holo(v)]
    return out
