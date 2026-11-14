"""Office desk look study, round 3 (family `desk`, palette set desk, preview only): three 2x2 desks, each its own
piece of furniture with its own job, no flat-panel monitors: the screens are holograms, rendered as their own
translucent layer `.holo` (research_kit.holo_item: the desk as holdout) over the desk sprite.

Local frame modkit.K, footprint (2, 2): u across, v deep, the front +v toward the camera at r0. The desk stands on
the back row (v BACK..FRONT), the chair in the front-left tile facing it (the console sit pose: desktop height TOP).

  f1 purser's desk      a slab cantilevered off one cabinet, a slim strut at the free end; a holo triptych off an
                        emitter rail (manifest, deck plan, stock bars), a cargo crate in wireframe over the cartridge
                        reader, a touch inlay, the purser's seal, a mug
  f2 navigator's desk   a slab with a round end on a drum pedestal, a holo well in it: a globe with a plotted route;
                        an instrument ledge with dials and a brass orrery, a coordinate pane
  f3 executive desk     a heavy two-tone desk, a fluted teal pedestal front, a leather mat; a holo caller over a comm
                        dais, a projected keyboard, a model ship on a stand, a nameplate"""
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


def pane(k, cu, cv, z0, w, h, rz, marks=()):
    """An upright holo pane facing +v turned by rz: film, a lit frame, marks [(x centre, y bottom, w, h)] on it."""
    at = lambda x, d=0.0: rot(cu, cv, rz, x, d)          # noqa: E731
    k.box(*at(0.0), z0, w, 0.01, h, F, rz=rz)
    for z in (z0, z0 + h - 0.03):
        k.box(*at(0.0, 0.01), z, w, 0.012, 0.03, L, rz=rz)
    for x in (-w / 2 + 0.015, w / 2 - 0.015):
        k.box(*at(x, 0.01), z0, 0.03, 0.012, h, L, rz=rz)
    for x, y, bw, bh in marks:
        k.box(*at(x, 0.014), z0 + y, bw, 0.01, bh, L, rz=rz)


def rows(w, h, widths, top=0.07, step=0.06):
    """List rows down a pane, left aligned: (x, y, w, h) marks."""
    return [(-w / 2 + 0.06 + bw / 2, h - top - i * step, bw, 0.03) for i, bw in enumerate(widths)]


def wire_box(k, cu, cv, cz, s, rz, col):
    """A wireframe cube (12 bars) centred at (cu, cv, cz), turned by rz."""
    c = [(*rot(cu, cv, rz, a * s / 2, b * s / 2), cz + e * s / 2) for e in (-1, 1) for a, b in
         ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(4):
        bar(k, c[i], c[(i + 1) % 4], 0.025, col)
        bar(k, c[4 + i], c[4 + (i + 1) % 4], 0.025, col)
        bar(k, c[i], c[4 + i], 0.025, col)


def blob(k, cu, cv, z0, r, h, col, n=6):
    """An upright ellipsoid of stacked discs (a holo head, a globe)."""
    for i in range(n):
        t0 = -1 + 2 * i / n
        tm = t0 + 1 / n
        k.cyl(cu, cv, z0 + h / 2 * (1 + t0), r * math.sqrt(max(0.0, 1 - tm * tm)), h / n, col, sides=16)


# ---- f1 purser's desk -------------------------------------------------------------------------------------------------
P1 = (0.56, 0.8)                     # the cabinet: u centre, width


def f1():
    k = Bench("desk_f1", FP)
    pu, pw = P1
    k.box(pu, VM, 0.0, pw - 4 * PXG, D - 4 * PXG, zpx(2), "dkGraphD")                       # shadow-gap plinth
    k.box(pu, VM, zpx(2), pw, D, TOP - zpx(6), "lvW2", top="lvW")                          # the cabinet
    k.box(pu - pw / 2 + 4 * PXG, FRONT + PXG / 2, zpx(4), PXG, PXG, TOP - zpx(10), "dkSeam")  # its lit seam
    k.box(pu + 0.06, FRONT + PXG / 2, zpx(15), 0.42, PXG, zpx(1), "dkGraph")                # door split
    k.box(pu + 0.06, FRONT + PXG / 2, zpx(9), 0.42, PXG, zpx(1), "dkGraph")
    k.box(pu + 0.2, FRONT + PXG / 2, zpx(18), 0.14, PXG, zpx(2), "dkGlass")                 # the cartridge slot
    k.box(pu + 0.12, FRONT + PXG, zpx(18) + 0.01, 0.02, PXG, zpx(1), "dkSeam")
    k.box(0.0, VM + PXG, TOP - zpx(4), 2.0 - 2 * PXG, D + 2 * PXG, zpx(4), "lvW2", top="lvW", bevel=0.01)  # slab
    k.box(-0.1, FRONT + 2 * PXG + PXG / 2, TOP - zpx(3), 1.7, PXG, zpx(1), "dkSeam")        # its lit front inlay
    bar(k, (-0.9, BACK + 0.12, TOP - zpx(4)), (-0.62, BACK + 0.12, 0.02), 0.06, "dkGraph")  # the strut and its foot
    k.box(-0.62, BACK + 0.12, 0.0, 0.16, 0.12, zpx(1), "dkGraphD")
    k.box(-0.1, BACK + 3 * PXG, TOP, 1.5, 4 * PXG, zpx(2), "dkGraph", top="dkGraphD")          # the emitter rail
    for i in range(5):
        k.cyl(-0.7 + i * 0.3, BACK + 3 * PXG, TOP + zpx(2), 0.025, 0.01, "dkSeam", sides=8)
    k.box(-0.5, -0.42, TOP, 0.56, 0.28, 0.006, "dkGlass")                                  # the touch inlay
    for r in range(3):
        for c in range(7):
            k.box(-0.74 + c * 0.08, -0.5 + r * 0.075, TOP + 0.006, 0.045, 0.035, 0.004,
                  "dkSeam" if (r * 7 + c) % 4 else "dkTeal")
    k.box(0.6, -0.66, TOP, 0.4, 0.17, zpx(2), "dkGraph", top="dkGraphD")                   # the cartridge reader
    for i, tip in enumerate(("dkMug", "dkTeal", "ochM", "pcb", "dkTeal", "steelL")):
        u = 0.44 + i * 0.065
        k.box(u, -0.66, TOP + zpx(2), 0.04, 0.12, zpx(5), "steelL", top="plate")
        k.box(u, -0.66, TOP + zpx(7), 0.04, 0.12, zpx(1), tip)
    k.cyl(0.84, -0.36, TOP, 0.05, 0.02, "brass", top="ochM", sides=12)                      # the purser's seal
    k.cyl(0.84, -0.36, TOP + 0.02, 0.02, 0.07, "dark", sides=8)
    k.cyl(0.84, -0.36, TOP + 0.09, 0.035, 0.03, "brass", sides=10)
    k.cyl(0.24, -0.4, TOP, 0.045, 0.09, "dkMug", top="dark", sides=12)                     # a mug
    k.box(0.29, -0.4, TOP + 0.02, 0.03, 0.02, 0.05, "dkMug")
    return k


def f1_holo():
    k = K("desk_f1_holo", FP, 0)
    z0, v0 = TOP + 0.1, BACK + 0.12
    pane(k, -0.4, v0, z0, 0.62, 0.44, 0.0,                                                 # the deck plan
         [(0.0, 0.08, 0.5, 0.03), (0.0, 0.34, 0.5, 0.03), (-0.24, 0.08, 0.03, 0.29), (0.24, 0.08, 0.03, 0.29),
          (-0.06, 0.08, 0.03, 0.29), (0.1, 0.2, 0.25, 0.03), (0.15, 0.24, 0.12, 0.08)])
    pane(k, -0.86, v0 + 0.16, z0, 0.3, 0.38, 0.55, rows(0.3, 0.38, (0.18, 0.12, 0.16, 0.1, 0.14)))   # manifest
    pane(k, 0.07, v0 + 0.16, z0, 0.3, 0.38, -0.55,                                         # stock bars
         [(-0.09 + i * 0.06, 0.06, 0.035, h) for i, h in enumerate((0.22, 0.12, 0.26, 0.08))])
    wire_box(k, 0.6, -0.66, TOP + 0.42, 0.2, 0.5, L)                                       # the crate being read
    k.box(0.6, -0.66, TOP + 0.32, 0.18, 0.18, 0.2, F, rz=0.5)
    for i in range(3):                                                                    # its beam to the reader
        k.box(0.6, -0.66, TOP + 0.11 + i * 0.06, 0.03, 0.03, 0.03, L)
    return k


# ---- f2 navigator's desk ----------------------------------------------------------------------------------------------
W2 = (0.5, VM, 0.405)                # the round end: centre u, v, radius


def f2():
    k = Bench("desk_f2", FP)
    wu, wv, wr = W2
    k.cyl(wu, wv, 0.0, 0.26, zpx(2), "dkGraphD", sides=24)                                 # the drum pedestal
    k.cyl(wu, wv, zpx(2), 0.3, TOP - zpx(6), "lvW2", top="lvW", sides=24)
    k.cyl(wu, wv, zpx(11), 0.305, zpx(1), "dkSeam", sides=24)
    k.cyl(wu, wv, TOP - zpx(4), wr, zpx(4), "lvW2", top="lvW", sides=28)                    # the round end
    k.box((-0.98 + wu) / 2, wv, TOP - zpx(4), wu + 0.98, D, zpx(4), "lvW2", top="lvW")       # the slab
    k.box(-0.98 + 2 * PXG, wv, 0.0, 4 * PXG, D - 4 * PXG, TOP - zpx(4), "lvW2", top="lvW")    # the end panel
    k.box(-0.48, BACK + 4 * PXG, zpx(10), 0.9, 2 * PXG, zpx(3), "dkGraph")                  # the back stretcher
    k.cyl(wu, wv, TOP, 0.24, zpx(1), "dkGraph", top="dkGlass", sides=24)                     # the holo well
    ring(k, "z", wu, wv, TOP + zpx(1), 0.215, 24, 0.008, 0.03, "dkSeam")
    lu, lw = -0.42, 1.1                                                                    # the instrument ledge
    k.box(lu, BACK + 4 * PXG, TOP, lw, 8 * PXG, zpx(7), "lvW2", top="lvW")
    k.box(lu, BACK + 8 * PXG + PXG / 2, TOP + zpx(1), lw - 0.08, PXG, zpx(5), "dkGlass")
    for i, a in enumerate((0.6, -0.4, 1.2)):                                               # dials
        du = lu - 0.3 + i * 0.22
        k.cyl(du, BACK + 9 * PXG, TOP + zpx(3) - 0.04, 0.06, 0.012, "dkGraph", sides=12)
        k.box(du + 0.02 * math.cos(a), BACK + 9 * PXG + 0.01, TOP + zpx(3) + 0.005, 0.07, 0.01, 0.015, "dkSeam",
              ry=a)
    k.box(lu + 0.4, BACK + 9 * PXG, TOP + zpx(2), 0.18, 0.01, zpx(2), "dkSeam")             # a readout
    ou, ov, oz = -0.86, BACK + 4 * PXG, TOP + zpx(7)                                      # the brass orrery
    k.cyl(ou, ov, oz, 0.06, 0.02, "brass", top="ochM", sides=12)
    k.cyl(ou, ov, oz + 0.02, 0.012, 0.16, "brass", sides=6)
    k.cyl(ou, ov, oz + 0.15, 0.035, 0.06, "ochM", sides=10)
    ring(k, "z", ou, ov, oz + 0.17, 0.1, 16, 0.012, 0.012, "brass")
    k.cyl(ou + 0.1, ov, oz + 0.16, 0.018, 0.03, "dkTeal", sides=8)
    k.box(-0.5, -0.4, TOP, 0.48, 0.24, zpx(1), "dkGraph", top="dkGlass")                     # the plotting pad
    for i in range(4):
        k.box(-0.62 + i * 0.08, -0.33, TOP + zpx(1), 0.05, 0.035, 0.004, "dkSeam")
    bar(k, (-0.66, -0.47, TOP + zpx(1) + 0.003), (-0.36, -0.42, TOP + zpx(1) + 0.003), 0.012, "dkSeam")
    k.box(0.0, -0.42, TOP, 0.22, 0.16, 0.012, "gm", top="dark", rz=0.25)                    # a slate, a stylus
    k.box(0.12, -0.38, TOP + 0.012, 0.02, 0.15, 0.015, "steelL", rz=0.4)
    return k


def f2_holo():
    k = K("desk_f2_holo", FP, 0)
    wu, wv, _ = W2
    R, cz = 0.2, TOP + 0.44
    for a in (0.0, math.pi / 2, math.pi, 1.5 * math.pi):                                   # the projection cone
        bar(k, (wu + 0.2 * math.cos(a), wv + 0.2 * math.sin(a), TOP + zpx(1)),
            (wu + 0.06 * math.cos(a), wv + 0.06 * math.sin(a), cz - R + 0.02), 0.02, L)
    blob(k, wu, wv, cz - R, R, 2 * R, F, 8)                                                # the globe
    for f in (-0.6, 0.0, 0.6):
        ring(k, "z", wu, wv, cz + f * R, R * math.sqrt(1 - f * f) + 0.01, 20, 0.025, 0.02, L)
    ring(k, "u", wu, wv, cz, R + 0.01, 20, 0.025, 0.02, L)
    route = [(wu + 0.28 * math.cos(t), wv + 0.28 * math.sin(t), cz + 0.18 * math.sin(2 * t)) for t in
             [i * 0.35 - 0.6 for i in range(9)]]
    for a, b in zip(route, route[1:]):                                                     # the plotted route
        bar(k, a, b, 0.025, L)
    k.box(route[-1][0], route[-1][1], route[-1][2] - 0.03, 0.05, 0.05, 0.05, L, rz=0.785)  # its waypoint
    pane(k, -0.42, BACK + 0.2, TOP + zpx(7) + 0.06, 0.52, 0.3, 0.0,                         # coordinates
         rows(0.52, 0.3, (0.3, 0.2, 0.36)) + [(0.16, 0.05, 0.08, 0.08)])
    return k


# ---- f3 executive desk ------------------------------------------------------------------------------------------------
DAIS = (0.58, -0.64)


def f3():
    k = Bench("desk_f3", FP)
    pu, pw = 0.53, 0.86                                                                   # the pedestal
    body = TOP - zpx(6)
    k.box(pu, VM, 0.0, pw, D, body, "lvW2", top="lvW")
    k.box(pu, FRONT + PXG / 2, zpx(3), pw - 0.12, PXG, body - zpx(6), "dkTeal")             # its fluted front
    for i in range(7):
        k.box(pu - 0.3 + i * 0.1, FRONT + PXG, zpx(3), 2 * PXG, PXG, body - zpx(6), "dkTealD")
    k.box(-0.94, VM, 0.0, 4 * PXG, D, body, "lvW2", top="lvW")                              # the end panel
    k.box(-0.44, BACK + 2 * PXG, zpx(8), 0.9, 2 * PXG, body - zpx(8), "lvWS")                # modesty panel
    k.box(0.0, VM, body, 1.94, D - 2 * PXG, zpx(1), "dkGraphD")                             # the reveal
    k.box(0.0, VM + PXG, body + zpx(1), 2.0, D + 2 * PXG, zpx(5), "lvW2", top="lvW", bevel=0.012)  # the top
    k.box(-0.42, -0.5, TOP, 0.84, 0.5, 0.006, "dkTeal")                                    # the leather mat
    k.box(-0.42, -0.5, TOP + 0.006, 0.78, 0.44, 0.002, "dkTealD")
    k.box(-0.5, -0.74, TOP + 0.006, 0.1, 0.04, zpx(1), "dkGraph")                            # the keyboard emitter
    k.box(-0.5, -0.72, TOP + 0.006 + zpx(1), 0.06, 0.004, 0.01, "dkSeam")
    du, dv = DAIS                                                                         # the comm dais
    k.cyl(du, dv, TOP, 0.15, zpx(2), "dkGraph", top="dkGlass", sides=20)
    ring(k, "z", du, dv, TOP + zpx(2), 0.13, 20, 0.006, 0.025, "dkSeam")
    mu, mv = 0.08, -0.74                                                                  # the model ship
    k.cyl(mu, mv, TOP, 0.05, 0.02, "dkGraph", top="dkGraphD", sides=10)
    k.cyl(mu, mv, TOP + 0.02, 0.012, 0.16, "steelL", sides=6)
    sz = TOP + 0.18
    k.box(mu, mv, sz, 0.1, 0.38, 0.07, "steelL", top="plate", bevel=0.015, rz=0.6, rx=-0.15)
    k.box(mu, mv, sz + 0.06, 0.06, 0.12, 0.04, "dkTeal", rz=0.6)
    for s in (-1, 1):
        nu, nv = rot(mu, mv, 0.6, s * 0.1, 0.06)
        k.box(nu, nv, sz - 0.015, 0.05, 0.22, 0.05, "steel", top="steelL", rz=0.6)
        eu, ev = rot(mu, mv, 0.6, s * 0.1, -0.05)
        k.box(eu, ev, sz - 0.01, 0.04, 0.015, 0.035, "dkSeam", rz=0.6)
    k.box(0.6, -0.27, TOP, 0.28, 0.06, 0.05, "dkGraph", top="brass")                        # the nameplate
    k.box(0.6, -0.24, TOP + 0.02, 0.2, 0.004, 0.015, "brass")
    for i in range(3):                                                                    # datapads
        k.box(0.86, -0.46 + 0.01 * i, TOP + i * 0.012, 0.16, 0.22, 0.012, ("gm", "steelD", "gm")[i], top="dark",
              rz=0.12 * (i - 1))
    return k


def f3_holo():
    k = K("desk_f3_holo", FP, 0)
    du, dv = DAIS
    z0 = TOP + zpx(2)
    for a in (0.0, math.pi / 2, math.pi, 1.5 * math.pi):                                   # the beam
        bar(k, (du + 0.11 * math.cos(a), dv + 0.11 * math.sin(a), z0), (du + 0.17 * math.cos(a), dv, z0 + 0.12),
            0.018, L)
    pz, ph, pw = z0 + 0.12, 0.4, 0.38                                                      # the caller's pane:
    pane(k, du, dv, pz, pw, ph, 0.0, [(0.0, 0.04, 0.26, 0.03), (0.13, 0.31, 0.06, 0.03)])  # name bar, live dot
    k.box(du, dv + 0.016, pz + 0.08, 0.26, 0.01, 0.1, L, taper=0.55)                         # shoulders,
    k.box(du, dv + 0.016, pz + 0.17, 0.05, 0.01, 0.04, L)                                    # neck, head
    ring(k, "v", du, dv + 0.016, pz + 0.26, 0.06, 14, 0.01, 0.03, L)
    k.box(du, dv + 0.014, pz + 0.21, 0.1, 0.01, 0.1, F)
    k.box(-0.5, -0.46, TOP + 0.012, 0.52, 0.22, 0.004, F)                                    # the projected keyboard
    for r in range(4):
        k.box(-0.5, -0.54 + r * 0.055, TOP + 0.016, 0.48, 0.01, 0.003, L)
    for c in range(7):
        k.box(-0.74 + 0.04 + c * 0.07, -0.46, TOP + 0.016, 0.01, 0.2, 0.003, L)
    return k


DESIGNS = {"f1": (f1, f1_holo), "f2": (f2, f2_holo), "f3": (f3, f3_holo)}


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
