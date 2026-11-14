"""Office desk look study, round 2 (family `desk`, palette set research, preview only): three 2x2 desks in the research
bench's style and kit (research_r6: the cream cabinetry on the px grid, drawer banks with label plates, the shelf hutch,
books, the console chair with its rust cushion), r0.

Local frame modkit.K, footprint (2, 2): u across, v deep, the front +v toward the camera at r0. The desk runs along the
back row (v from BACK to FRONT, as the research bench's cabinet), the chair sits in the front-left tile (u -0.5,
v +0.5) facing it, the front-right tile is open floor. A drawer bank fills the right half under the top, the left
half is the knee bay in front of the chair.

  e1 hutch desk     a two-shelf hutch over the back (books, binders, a plant, a clock), a terminal and keyboard
                    in front of the chair, a desk lamp and a stack of files on the drawer bank
  e2 drafting desk  a low back rail instead of the hutch; the research bench's tilted light table over the knee
                    bay with a plan on it, a terminal on the drawer bank, rolled charts in a bin
  e3 records desk   a tall pigeonhole hutch over the drawer bank (filed slates and folders), a low shelf over the
                    knee bay with a terminal, an in-tray and a slate on the desk"""
from . import console_proto as C
from . import core
from .cmbkit import Frame
from .modkit import K
from .research_kit import PXG, Bench, snap, zpx
from .research_r4 import keyboard, lamp, monitor, slate
from .research_r6 import BACK, FRONT, HUTCH_BACK, HUTCH_UPRIGHT, SHELF_FRONT, SHELVES, TOP, Table, books, drawers

FP = (2, 2)
CHAIR = (-0.5, 0.5)                          # the chair tile (local u, v)
BINDERS = ("navy", "rust", "pcb", "ochM")


class _Chair(Frame):
    """console_proto's chair with the research bench's rust cushion."""
    def poly(self, pts, color, flip=False):
        super().poly(pts, {"navy": "rust"}.get(color, color), flip)


def chair():
    m = core.Mesh("desk_chair")
    C.chair(_Chair(m, 0, centre=K("desk_chair_xy", FP, 0).p(*CHAIR)), 0.0, 0.0, False)
    return m.build()


def base(k):
    """The desk: the drawer bank (right half, three drawers), the top over the knee bay on the left, its end panel and
    a modesty panel at the back of the bay, all flush with the bank and on the px grid."""
    drawers(k, 0.49, n=3)
    v0, v1 = BACK, FRONT
    k.box(-0.5, (v0 + v1) / 2, TOP - zpx(2), 1.0, v1 - v0, zpx(2), "lvW2", top="lvW")          # the top over the bay
    k.box(-0.97, (v0 + v1) / 2, 0.0, 2 * PXG, v1 - v0, TOP - zpx(2), "lvW2", top="lvW")      # the left end panel
    k.box(-0.5, v0 + 2 * PXG, zpx(6), 0.92, 2 * PXG, TOP - zpx(8), "lvWS")                 # modesty panel


def binders(k, u0, z, n, c0=0):
    """Ring binders standing at z against the hutch back, from u0 along +u: 4 px wide, 7 deep, 14 tall, a label."""
    for i in range(n):
        u = u0 + (4 * i + 2) * PXG
        k.box(u, HUTCH_BACK + 3.5 * PXG, z, 4 * PXG, 7 * PXG, zpx(14), BINDERS[(c0 + i) % len(BINDERS)])
        k.box(u, HUTCH_BACK + 7 * PXG + 0.002, z + zpx(8), 2 * PXG, 0.004, zpx(3), "lvW")


def hutch(k, u0, u1, shelves=SHELVES):
    """Uprights at both ends and the middle, shelves at `shelves`, a back panel; u0..u1 on the grid."""
    b, uf, sf = HUTCH_BACK, HUTCH_UPRIGHT, SHELF_FRONT
    top = shelves[-1] + zpx(2)
    for u in (u0 + PXG, (u0 + u1) / 2, u1 - PXG):
        k.box(snap(u - PXG) + PXG, (b + uf) / 2, TOP, 2 * PXG, uf - b, top - TOP, "lvW2", top="lvW")
    for z in shelves:
        k.box((u0 + u1) / 2, (b + sf) / 2, z, u1 - u0, sf - b, zpx(2), "lvW2", top="lvW")
    k.box((u0 + u1) / 2, (BACK + b) / 2, TOP, u1 - u0, b - BACK, top - TOP, "lvW2", top="lvW")


def plant(k, u, v, z):
    k.cyl(u, v, z, 0.07, 0.1, "rust", top="dark", sides=10)
    for i, (du, dv, h) in enumerate(((0.0, 0.0, 0.2), (0.04, 0.02, 0.15), (-0.04, -0.01, 0.16))):
        k.box(u + du, v + dv, z + 0.1, 0.05, 0.05, h, ("pcb", "resLimeF", "pcb")[i])


def files(k, u, v, z, n=4):
    for i in range(n):
        k.box(u + 0.01 * (i % 2), v, z + zpx(i), 0.3, 0.22, zpx(1), ("ochM", "lvW", "navy", "lvW")[i % 4])


# ---- e1 hutch desk ------------------------------------------------------------------------------------------------
def e1():
    k = Bench("desk_e1", FP)
    base(k)
    hutch(k, -0.98, 0.98)
    s0, s1 = SHELVES[0] + zpx(2), SHELVES[1] + zpx(2)
    books(k, -0.94, TOP, (12, 14, 11, 13), 0)                         # under the shelves, at the left end
    binders(k, 0.4, TOP, 3)
    books(k, -0.9, s0, (11, 12, 10, 12, 11), 2)
    plant(k, 0.6, -0.86, s0)
    k.box(0.3, -0.84, s1, 0.16, 0.08, 0.16, "lvWS", top="lvW")                         # a clock
    k.box(0.3, -0.8 + 0.001, s1 + 0.04, 0.1, 0.004, 0.08, "resLamp")
    monitor(k, -0.5, -0.6, TOP, 0.42, 0.28, "resWork", ((0.0, 0.85, 0.2), (0.0, 0.5, 0.26), (0.0, 0.15, 0.14)))
    keyboard(k, -0.5, -0.28, TOP)
    lamp(k, 0.82, -0.36, TOP, "resLamp")
    files(k, 0.4, -0.3, TOP)
    slate(k, -0.1, -0.28, TOP, "resGold", rz=-0.2)
    return k.build() + [chair()]


# ---- e2 drafting desk ---------------------------------------------------------------------------------------------
def e2():
    k = Bench("desk_e2", FP)
    base(k)
    k.box(0.0, (BACK + HUTCH_BACK) / 2, TOP, 1.96, HUTCH_BACK - BACK, zpx(10), "lvW2", top="lvW")   # a low back rail
    T = Table(k, (-0.5, -0.3, 0.82), 0.45)
    T.build(w=0.9)
    T.put(0.0, 0.0, 0.002, 0.6, 0.4, 0.004, "resScanF")                               # a plan on the light table
    for a, b, w in ((-0.1, 0.1, 0.4), (0.12, -0.08, 0.3)):
        T.put(a, b, 0.006, w, 0.01, 0.004, "resGold")
    T.put(0.0, -0.02, 0.006, 0.01, 0.3, 0.004, "resGold")
    monitor(k, 0.55, -0.62, TOP, 0.36, 0.26, "resWork", ((0.0, 0.8, 0.18), (0.0, 0.3, 0.12)), rz=0.3)
    keyboard(k, 0.5, -0.3, TOP)
    k.cyl(0.85, -0.25, TOP, 0.08, 0.2, "gm", top="dark", sides=12)                     # a bin of rolled charts
    for du, dv, col in ((0.0, 0.0, "lvW"), (0.03, -0.02, "resScanF"), (-0.03, 0.02, "ochL")):
        k.cyl(0.85 + du, -0.25 + dv, TOP + 0.1, 0.02, 0.24, col, sides=8)
    return k.build() + [chair()]


# ---- e3 records desk ----------------------------------------------------------------------------------------------
def e3():
    k = Bench("desk_e3", FP)
    base(k)
    hi = (SHELVES[0] - zpx(8), SHELVES[0] + zpx(6), SHELVES[1] + zpx(6))
    hutch(k, 0.0, 0.98, hi)                                                          # pigeonholes over the bank
    for j, z in enumerate((TOP,) + tuple(s + zpx(2) for s in hi[:-1])):
        for i, u in enumerate((0.2, 0.5, 0.78)):
            k.box(u, -0.86, z, 0.2, 0.16, zpx(4 + 2 * (i % 2)), ("lvW", "ochM", "navy")[(i + j) % 3])
    hutch(k, -0.98, 0.0, (SHELVES[0],))                                             # a low shelf over the knee bay
    monitor(k, -0.5, -0.62, SHELVES[0] + zpx(2), 0.4, 0.26, "resWork", ((0.0, 0.8, 0.2), (0.0, 0.3, 0.14)))
    books(k, -0.92, TOP, (11, 12, 10), 3)
    keyboard(k, -0.5, -0.3, TOP)
    k.box(0.5, -0.3, TOP, 0.32, 0.24, zpx(3), "steelD", top="gm")                     # an in-tray of folders
    files(k, 0.5, -0.3, TOP + zpx(1), 2)
    slate(k, -0.1, -0.25, TOP, "resGold", rz=0.2)
    lamp(k, 0.86, -0.3, TOP, "resLamp")
    return k.build() + [chair()]


DESIGNS = {"e1": e1, "e2": e2, "e3": e3}


def jobs():
    print("DESK chair from origin", K("desk_chair_xy", FP, 0).p(*CHAIR), flush=True)
    return [(f"module.desk.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
