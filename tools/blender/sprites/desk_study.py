"""Office desk look study, round 4 (family `desk`, palette set desk, preview only): the navigator's desk of round 3 as
one shared desk, dressed for three posts. The desk is the same in all three (a slab with a round end on a lit drum
pedestal, a holo well in it, an instrument ledge at the back); each post changes only its hologram, the ledge's face
and the props. No keyboards: work happens in the holograms. The hologram is its own translucent layer `.holo`
(research_kit.holo_item: the desk as holdout) over the desk sprite.

Local frame modkit.K, footprint (2, 2): u across, v deep, the front +v toward the camera at r0. The desk stands on
the back row (v BACK..FRONT), the chair in the front-left tile facing it (the console sit pose: desktop height TOP).

  o office    a globe with a plotted route over the well, a coordinates pane; dials, a brass orrery, a slate
  g guard     a deck plan over the well with patrol blips (one red), two camera feeds; a status light row, an amber
              beacon, a stun baton charging in its cradle, a mug
  c customs   a scanned crate over the well (wireframe, its contents, the scan ring), an ID pane; approve and deny
              lamps, the customs stamp, a scanner wand in its cradle, a tray of confiscated goods"""
import math

from . import console_proto as C
from . import core, post
from .cmbkit import Frame
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk"
FP = (2, 2)
CHAIR = (-0.5, 0.5)                          # the chair tile (local u, v)
TOP = zpx(26)                                # desktop height (the sit pose's hands)
BACK, FRONT = -31 * PXG, -5 * PXG            # the desk's back and front planes, on the u/v grid
VM, D = (BACK + FRONT) / 2, FRONT - BACK     # its middle and depth
WU, WR = 0.5, 0.405                          # the round end: centre u (at VM), radius
LU, LW = -0.42, 1.1                          # the ledge: centre u, width
LF = BACK + 8 * PXG                          # the ledge's front face
LZ = TOP + zpx(7)                            # the ledge's top
L, F = "dkHolo", "dkHoloF"                    # hologram lines (lit) and film


class _Chair(Frame):
    def poly(self, pts, color, flip=False):
        super().poly(pts, {"navy": "dkTeal"}.get(color, color), flip)


def chair():
    m = core.Mesh("desk_chair")
    C.chair(_Chair(m, 0, centre=K("desk_chair_xy", FP, 0).p(*CHAIR)), 0.0, 0.0, False)
    return m.build()


def rot(u, v, rz, du, dv):
    c, s = math.cos(rz), math.sin(rz)
    return u + c * du - s * dv, v + s * du + c * dv


def pane(k, cu, cv, z0, w, h, rz=0.0, marks=(), col=None):
    """An upright holo pane facing +v turned by rz: film, a lit frame, marks [(x centre, y bottom, w, h)] on it."""
    at = lambda x, d=0.0: rot(cu, cv, rz, x, d)          # noqa: E731
    k.box(*at(0.0), z0, w, 0.01, h, F, rz=rz)
    for z in (z0, z0 + h - 0.03):
        k.box(*at(0.0, 0.01), z, w, 0.012, 0.03, L, rz=rz)
    for x in (-w / 2 + 0.015, w / 2 - 0.015):
        k.box(*at(x, 0.01), z0, 0.03, 0.012, h, L, rz=rz)
    for m in marks:
        x, y, bw, bh = m[:4]
        k.box(*at(x, 0.014), z0 + y, bw, 0.01, bh, m[4] if len(m) > 4 else L, rz=rz)


def rows(w, h, widths, top=0.07, step=0.06, x0=0.06):
    """List rows down a pane, left aligned: (x, y, w, h) marks."""
    return [(-w / 2 + x0 + bw / 2, h - top - i * step, bw, 0.03) for i, bw in enumerate(widths)]


def figure(k, cu, cv, z0, s, col=L):
    """A head-and-shoulders on a pane facing +v (portrait, camera feed): shoulders, neck, head ring, at scale s."""
    k.box(cu, cv, z0, 0.26 * s, 0.01, 0.1 * s, col, taper=0.55)
    k.box(cu, cv, z0 + 0.09 * s, 0.05 * s, 0.01, 0.04 * s, col)
    ring(k, "v", cu, cv, z0 + 0.18 * s, 0.06 * s, 14, 0.01, 0.03, col)


def wire_box(k, cu, cv, cz, s, rz, col):
    """A wireframe cube (12 bars) centred at (cu, cv, cz), turned by rz."""
    c = [(*rot(cu, cv, rz, a * s / 2, b * s / 2), cz + e * s / 2) for e in (-1, 1) for a, b in
         ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(4):
        bar(k, c[i], c[(i + 1) % 4], 0.025, col)
        bar(k, c[4 + i], c[4 + (i + 1) % 4], 0.025, col)
        bar(k, c[i], c[4 + i], 0.025, col)


def cone(k, top_z, r1):
    """The well's projection cone: four lit bars from the well's rim up to radius r1 at top_z."""
    for a in (0.0, math.pi / 2, math.pi, 1.5 * math.pi):
        bar(k, (WU + 0.2 * math.cos(a), VM + 0.2 * math.sin(a), TOP + zpx(1)),
            (WU + r1 * math.cos(a), VM + r1 * math.sin(a), top_z), 0.02, L)


# ---- the desk (shared) ------------------------------------------------------------------------------------------------
def desk(name):
    k = Bench(name, FP)
    k.cyl(WU, VM, 0.0, 0.26, zpx(2), "dkGraphD", sides=24)                                 # the drum pedestal
    k.cyl(WU, VM, zpx(2), 0.3, TOP - zpx(6), "lvW2", top="lvW", sides=24)
    k.cyl(WU, VM, zpx(11), 0.305, zpx(1), "dkSeam", sides=24)
    k.cyl(WU, VM, TOP - zpx(4), WR, zpx(4), "lvW2", top="lvW", sides=28)                    # the round end
    k.box((-0.98 + WU) / 2, VM, TOP - zpx(4), WU + 0.98, D, zpx(4), "lvW2", top="lvW")       # the slab
    k.box(-0.98 + 2 * PXG, VM, 0.0, 4 * PXG, D - 4 * PXG, TOP - zpx(4), "lvW2", top="lvW")    # the end panel
    k.box(-0.48, BACK + 4 * PXG, zpx(10), 0.9, 2 * PXG, zpx(3), "dkGraph")                  # the back stretcher
    k.cyl(WU, VM, TOP, 0.24, zpx(1), "dkGraph", top="dkGlass", sides=24)                     # the holo well
    ring(k, "z", WU, VM, TOP + zpx(1), 0.215, 24, 0.008, 0.03, "dkSeam")
    k.box(LU, BACK + 4 * PXG, TOP, LW, 8 * PXG, zpx(7), "lvW2", top="lvW")                   # the ledge, its glass face
    k.box(LU, LF + PXG / 2, TOP + zpx(1), LW - 0.08, PXG, zpx(5), "dkGlass")
    return k


def face(k, u, col, w=0.05, h=zpx(2), z=TOP + zpx(3)):
    """A lit mark on the ledge's glass face, centred at u."""
    k.box(u, LF + PXG, z - h / 2, w, 0.01, h, col)


# ---- o office ---------------------------------------------------------------------------------------------------------
def office():
    k = desk("desk_o")
    for i, a in enumerate((0.6, -0.4, 1.2)):                                               # dials
        du = LU - 0.3 + i * 0.22
        k.cyl(du, LF + PXG, TOP + zpx(3) - 0.04, 0.06, 0.012, "dkGraph", sides=12)
        k.box(du + 0.02 * math.cos(a), LF + PXG + 0.01, TOP + zpx(3) + 0.005, 0.07, 0.01, 0.015, "dkSeam", ry=a)
    face(k, LU + 0.4, "dkSeam", w=0.18)                                                   # a readout
    ou, ov = -0.86, BACK + 4 * PXG                                                        # the brass orrery
    k.cyl(ou, ov, LZ, 0.06, 0.02, "brass", top="ochM", sides=12)
    k.cyl(ou, ov, LZ + 0.02, 0.012, 0.16, "brass", sides=6)
    k.cyl(ou, ov, LZ + 0.15, 0.035, 0.06, "ochM", sides=10)
    ring(k, "z", ou, ov, LZ + 0.17, 0.1, 16, 0.012, 0.012, "brass")
    k.cyl(ou + 0.1, ov, LZ + 0.16, 0.018, 0.03, "dkTeal", sides=8)
    k.box(-0.2, -0.42, TOP, 0.22, 0.16, 0.012, "gm", top="dark", rz=0.25)                   # a slate, a stylus
    k.box(-0.08, -0.38, TOP + 0.012, 0.02, 0.15, 0.015, "steelL", rz=0.4)
    return k


def office_holo():
    k = K("desk_o_holo", FP, 0)
    R, cz = 0.2, TOP + 0.44
    cone(k, cz - R + 0.02, 0.06)
    for i in range(8):                                                                    # the globe
        t = -1 + (2 * i + 1) / 8
        k.cyl(WU, VM, cz - R + 2 * R * i / 8, R * math.sqrt(1 - t * t), 2 * R / 8, F, sides=16)
    for f in (-0.6, 0.0, 0.6):
        ring(k, "z", WU, VM, cz + f * R, R * math.sqrt(1 - f * f) + 0.01, 20, 0.025, 0.02, L)
    ring(k, "u", WU, VM, cz, R + 0.01, 20, 0.025, 0.02, L)
    route = [(WU + 0.28 * math.cos(t), VM + 0.28 * math.sin(t), cz + 0.18 * math.sin(2 * t)) for t in
             [i * 0.35 - 0.6 for i in range(9)]]
    for a, b in zip(route, route[1:]):                                                     # the plotted route
        bar(k, a, b, 0.025, L)
    k.box(route[-1][0], route[-1][1], route[-1][2] - 0.03, 0.05, 0.05, 0.05, L, rz=0.785)  # its waypoint
    pane(k, -0.42, BACK + 0.2, LZ + 0.06, 0.52, 0.3, 0.0, rows(0.52, 0.3, (0.3, 0.2, 0.36)) + [(0.16, 0.05, 0.08, 0.08)])
    return k


# ---- g guard ----------------------------------------------------------------------------------------------------------
def guard():
    k = desk("desk_g")
    for i, col in enumerate(("dkGo", "dkGo", "dkAmber", "dkGo", "dkAlert", "dkGo")):         # zone status lights
        face(k, LU - 0.38 + i * 0.1, col, w=0.06)
    face(k, LU + 0.38, "dkSeam", w=0.12)
    bu, bv = -0.86, BACK + 4 * PXG                                                        # the beacon
    k.cyl(bu, bv, LZ, 0.06, 0.03, "dkGraph", top="dkGraphD", sides=12)
    k.cyl(bu, bv, LZ + 0.03, 0.045, 0.07, "dkAmber", rtop=0.02, sides=12)
    k.box(-0.18, -0.42, TOP, 0.4, 0.1, zpx(2), "dkGraph", top="dkGraphD", rz=0.12)            # the baton's cradle
    k.box(-0.18, -0.42, TOP + zpx(2), 0.36, 0.04, 0.04, "dark", top="gm", rz=0.12)            # the stun baton
    tu, tv = rot(-0.18, -0.42, 0.12, 0.17, 0.0)
    k.box(tu, tv, TOP + zpx(2), 0.04, 0.045, 0.045, "dkSeam", rz=0.12)
    k.box(-0.18, -0.36, TOP + zpx(1), 0.05, 0.01, 0.012, "dkGo", rz=0.12)                     # charged
    k.cyl(-0.72, -0.38, TOP, 0.045, 0.09, "dkMug", top="dark", sides=12)                     # a mug
    k.box(-0.67, -0.38, TOP + 0.02, 0.03, 0.02, 0.05, "dkMug")
    return k


def guard_holo():
    k = K("desk_g_holo", FP, 0)
    z = TOP + 0.24
    cone(k, z, 0.28)
    k.cyl(WU, VM, z, 0.32, 0.008, F, sides=24)                                             # the deck plan, flat
    ring(k, "z", WU, VM, z + 0.008, 0.31, 24, 0.01, 0.025, L)
    for a, b in (((-0.22, -0.05), (0.22, -0.05)), ((0.0, -0.05), (0.0, 0.24)), ((-0.12, -0.05), (-0.12, -0.2)),
                 ((0.0, 0.1), (0.2, 0.1))):
        bar(k, (WU + a[0], VM + a[1], z + 0.012), (WU + b[0], VM + b[1], z + 0.012), 0.02, L)
    for (du, dv), col in (((-0.12, 0.08), L), ((0.14, -0.15), L), ((0.1, 0.19), "dkAlert")):  # patrol blips, a contact
        k.box(WU + du, VM + dv, z + 0.01, 0.05, 0.05, 0.05, col, rz=0.785)
    for i, u in enumerate((-0.64, -0.24)):                                                 # two camera feeds
        pane(k, u, BACK + 0.2, LZ + 0.05, 0.34, 0.26, 0.0,
             [(0.12, 0.2, 0.05, 0.03, "dkAlert" if i else L)])
        figure(k, u - 0.04 + 0.06 * i, BACK + 0.214, LZ + 0.08, 0.7)
    return k


# ---- c customs --------------------------------------------------------------------------------------------------------
def customs():
    k = desk("desk_c")
    face(k, LU - 0.42, "dkGo", w=0.1, h=zpx(3))                                            # approve / deny lamps
    face(k, LU - 0.28, "dkAlert", w=0.1, h=zpx(3))
    face(k, LU + 0.2, "dkSeam", w=0.3)
    su, sv = -0.86, BACK + 4 * PXG                                                        # permits, filed
    for i in range(4):
        k.box(su, sv, LZ + i * 0.012, 0.16, 0.2, 0.012, ("lvW", "ochM", "lvW", "dkTeal")[i], rz=0.08 * (i - 1))
    k.cyl(-0.12, -0.36, TOP, 0.06, 0.025, "dkGraph", top="dkAlert", sides=12)                # the customs stamp
    k.cyl(-0.12, -0.36, TOP + 0.025, 0.022, 0.08, "dark", sides=8)
    k.cyl(-0.12, -0.36, TOP + 0.1, 0.04, 0.035, "brass", sides=10)
    k.box(-0.36, -0.44, TOP, 0.12, 0.26, zpx(2), "dkGraph", top="dkGraphD", rz=-0.15)        # the scanner wand
    k.box(-0.36, -0.44, TOP + zpx(2), 0.05, 0.24, 0.04, "steelL", top="plate", rz=-0.15)
    wu, wv = rot(-0.36, -0.44, -0.15, 0.0, -0.11)
    k.box(wu, wv, TOP + zpx(2), 0.07, 0.04, 0.045, "dkSeam", rz=-0.15)
    k.box(-0.74, -0.42, TOP, 0.34, 0.24, 0.03, "gm", top="gmD")                              # the confiscated tray
    k.cyl(-0.84, -0.44, TOP + 0.03, 0.03, 0.1, "pcb", top="steelL", sides=8)
    k.box(-0.7, -0.38, TOP + 0.03, 0.1, 0.07, 0.05, "medRed", top="rust", rz=0.3)
    k.box(-0.66, -0.48, TOP + 0.03, 0.05, 0.05, 0.03, "dkTeal", rz=0.785)
    return k


def customs_holo():
    k = K("desk_c_holo", FP, 0)
    s, cz = 0.3, TOP + 0.36
    cone(k, cz - s / 2, 0.15)
    wire_box(k, WU, VM, cz, s, 0.4, L)                                                    # the scanned crate,
    k.box(WU, VM, cz - s / 2, s - 0.02, s - 0.02, s, F, rz=0.4)
    k.box(WU - 0.04, VM, cz - 0.1, 0.08, 0.1, 0.12, L, rz=0.4)                              # its contents
    k.cyl(WU + 0.06, VM + 0.02, cz - 0.1, 0.03, 0.14, "dkAlert", sides=8)                    # (one flagged)
    ring(k, "z", WU, VM, cz + 0.03, 0.25, 24, 0.02, 0.02, L)                                # the scan ring
    pane(k, -0.52, BACK + 0.2, LZ + 0.05, 0.5, 0.3, 0.0,                                     # the ID pane
         rows(0.5, 0.3, (0.18, 0.14, 0.2), x0=0.22) + [(0.15, 0.03, 0.12, 0.05, "dkGo")])
    figure(k, -0.66, BACK + 0.214, LZ + 0.08, 0.75)
    return k


DESIGNS = {"o": (office, office_holo), "g": (guard, guard_holo), "c": (customs, customs_holo)}


def _desk(v):
    return DESIGNS[v][0]().build() + [chair()]


def _holo(v):
    def run(v=v):                            # (the default keys the render cache)
        core.clear_scene_meshes()
        post.select(PAL)
        mask = _desk(v)
        it = holo_item(f"module.desk.{v}.holo", FP, mask, DESIGNS[v][1]().build())
        return [it] if it else []
    return run


def jobs():
    print("DESK chair from origin", K("desk_chair_xy", FP, 0).p(*CHAIR), flush=True)
    out = []
    for v in DESIGNS:
        out += [(f"module.desk.{v}", FP, "prop", lambda v=v: _desk(v)), _holo(v)]
    return out
