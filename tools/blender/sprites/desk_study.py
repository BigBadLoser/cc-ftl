"""Office desk look study, round 8 (family `desk`, palette set desk, preview only): the approved steel desk (round 7:
solid side, a solid back flowing into the round projection post, the holo well in its round end) dressed for three
posts. The desk is the same in all three; each post changes only its hologram and a few props. Nothing glows but the
holo well and the hologram, which is its own translucent layer `.holo` (research_kit.holo_item: the desk as holdout).

Local frame modkit.K, footprint (2, 2): u across, v deep, the front +v toward the camera at r0. The desk stands on
the back row (v BACK..FRONT), the chair in the front-left tile facing it (the console sit pose: desktop height TOP).

  office   a globe with a plotted route over the well, a coordinates pane; a slate and stylus, a brass orrery, a mug
  guard    a deck plan over the well with patrol blips and one red contact, two camera feeds; a stun baton in its
           cradle, a hi-vis beacon, a mug
  customs  a scanned crate over the well (its contents, one flagged, the scan ring), an ID pane; the customs stamp,
           a scanner wand, a tray of confiscated goods, filed permits"""
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
WU, WR = 0.5, D / 2                          # the round end: centre u (at VM), radius
U0 = -0.98                                   # the free end
SLAB = zpx(4)                                # the top's thickness
BAND = zpx(11)                               # the band's height on the drum
L, F = "dkHolo", "dkHoloF"                    # hologram lines (lit) and film
# the steel material: top, edge (the top's sides), body, cap (body tops), dark (reveals, kicks), band, the chair's
# recolours (its cushions a light steel, so it stands off the floor; no brass)
M = dict(top="plate", edge="steelL", body="gm", cap="plate", dark="steelD", band="steelD", well="dkSeam",
         chair={"navy": "plate", "brass": "steelL", "steelD": "gm"})


class _Chair(Frame):
    def poly(self, pts, color, flip=False):
        super().poly(pts, M["chair"].get(color, color), flip)


def chair(rot=0):
    m = core.Mesh(f"desk_chair_{rot}")
    C.chair(_Chair(m, rot, centre=K("desk_chair_xy", FP, rot).p(*CHAIR)), 0.0, 0.0, False)
    return m.build()


# ---- the desk ---------------------------------------------------------------------------------------------------------
def prism(k, pts, z, h, col, top=None):
    """A vertical prism over the outline pts (local (u, v), counter-clockwise), z..z + h, as one closed mesh."""
    g = [k.p(u, v) for u, v in pts]
    bot = [core.G(x, y, z) for x, y in g]
    tp = [core.G(x, y, z + h) for x, y in g]
    n = len(g)
    for i in range(n):
        j = (i + 1) % n
        k.m.poly([bot[i], bot[j], tp[j], tp[i]], col, flip=True)
    k.m.poly(tp[::-1], top or col, flip=True)
    k.m.poly(bot, col, flip=True)


def arc(cu, cv, r, a0, a1, n):
    return [(cu + r * math.cos(a0 + (a1 - a0) * i / n), cv + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def outline(inset=0.0):
    """The top's outline: straight from the free end to the round end's centre, then round; inset shrinks it."""
    r = WR - inset
    return [(U0 + inset, VM - r)] + arc(WU, VM, r, -math.pi / 2, math.pi / 2, 14) + [(U0 + inset, VM + r)]


def flow_outline(r, thk, u0, grow=0.0):
    """The back and the drum as one outline: the back's back face on the drum's back tangent (so it runs into the
    drum without a step), round the drum, and back along the back's front face; grow pushes it out (a band)."""
    R, t = r + grow, thk + 2 * grow
    vb = VM - R
    a = math.pi + math.asin((R - t) / R)                     # where the back's front face meets the drum
    return [(u0, vb)] + arc(WU, VM, R, -math.pi / 2, a, 24) + [(u0, vb + t)]


def desk(name, rot=0):
    """Solid side, solid back flowing into the drum, the top in one piece, the holo well."""
    k = Bench(name, FP, rot)
    r, thk, h = 0.3, 4 * PXG, TOP - SLAB - zpx(1)
    prism(k, outline(), TOP - SLAB, SLAB, M["edge"], M["top"])                              # the top, its shadow line
    prism(k, outline(2 * PXG), TOP - SLAB - zpx(1), zpx(1), M["dark"])
    k.cyl(WU, VM, TOP, 0.24, zpx(1), "dkGraph", top="dkGlass", sides=24)                     # the holo well
    ring(k, "z", WU, VM, TOP + zpx(1), 0.215, 24, 0.008, 0.03, M["well"])
    su = U0 + 2 * PXG                                                                    # the solid side, flush
    sv0, sv1 = VM - r, FRONT                                                             # with the top's edges
    k.box(su, (sv0 + sv1) / 2, zpx(2), 4 * PXG, sv1 - sv0, TOP - SLAB - zpx(2), M["body"], top=M["cap"])
    k.box(su, (sv0 + sv1) / 2, 0.0, 2 * PXG, sv1 - sv0 - 2 * PXG, zpx(2), M["dark"])
    u0 = su + 2 * PXG                                                                    # the back and the drum
    prism(k, flow_outline(r - 0.04, thk - 0.04, u0), 0.0, zpx(2), M["dark"])
    prism(k, flow_outline(r, thk, u0), zpx(2), h - zpx(2), M["body"], M["cap"])
    prism(k, flow_outline(r, thk, U0 + 0.004, PXG / 2), BAND, zpx(1), M["band"])
    return k


# ---- hologram parts ---------------------------------------------------------------------------------------------------
def rot2(u, v, rz, du, dv):
    c, s = math.cos(rz), math.sin(rz)
    return u + c * du - s * dv, v + s * du + c * dv


def pane(k, cu, cv, z0, w, h, marks=()):
    """An upright holo pane facing +v: film, a lit frame, marks [(x centre, y bottom, w, h[, colour])] on it."""
    k.box(cu, cv, z0, w, 0.01, h, F)
    for z in (z0, z0 + h - 0.03):
        k.box(cu, cv + 0.01, z, w, 0.012, 0.03, L)
    for x in (-w / 2 + 0.015, w / 2 - 0.015):
        k.box(cu + x, cv + 0.01, z0, 0.03, 0.012, h, L)
    for m in marks:
        x, y, bw, bh = m[:4]
        k.box(cu + x, cv + 0.014, z0 + y, bw, 0.01, bh, m[4] if len(m) > 4 else L)


def rows(w, h, widths, top=0.07, step=0.06, x0=0.06):
    return [(-w / 2 + x0 + bw / 2, h - top - i * step, bw, 0.03) for i, bw in enumerate(widths)]


def figure(k, cu, cv, z0, s):
    """A head-and-shoulders on a pane (a portrait, a camera feed)."""
    k.box(cu, cv, z0, 0.26 * s, 0.01, 0.1 * s, L, taper=0.55)
    k.box(cu, cv, z0 + 0.09 * s, 0.05 * s, 0.01, 0.04 * s, L)
    ring(k, "v", cu, cv, z0 + 0.18 * s, 0.06 * s, 14, 0.01, 0.03, L)


def wire_box(k, cu, cv, cz, s, rz):
    c = [(*rot2(cu, cv, rz, a * s / 2, b * s / 2), cz + e * s / 2) for e in (-1, 1) for a, b in
         ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(4):
        bar(k, c[i], c[(i + 1) % 4], 0.025, L)
        bar(k, c[4 + i], c[4 + (i + 1) % 4], 0.025, L)
        bar(k, c[i], c[4 + i], 0.025, L)


def cone(k, top_z, r1):
    """The well's projection: four lit bars from its rim up to radius r1 at top_z."""
    for a in (0.0, math.pi / 2, math.pi, 1.5 * math.pi):
        bar(k, (WU + 0.2 * math.cos(a), VM + 0.2 * math.sin(a), TOP + zpx(1)),
            (WU + r1 * math.cos(a), VM + r1 * math.sin(a), top_z), 0.02, L)


PV, PZ = BACK + 0.12, TOP + 0.12              # the panes: over the desk's back edge


# ---- props ------------------------------------------------------------------------------------------------------------
def mug(k, u, v):
    k.cyl(u, v, TOP, 0.045, 0.09, "steelL", top="dark", sides=12)
    k.box(u + 0.05, v, TOP + 0.02, 0.03, 0.02, 0.05, "steelL")


def slate(k, u, v, rz):
    k.box(u, v, TOP, 0.22, 0.16, 0.012, "steelD", top="dark", rz=rz)
    su, sv = rot2(u, v, rz, 0.13, 0.0)
    k.box(su, sv, TOP, 0.02, 0.15, 0.015, "steelL", rz=rz + 0.15)


# ---- office -----------------------------------------------------------------------------------------------------------
def office(rot=0):
    k = desk(f"desk_o_{rot}", rot)
    slate(k, 0.02, -0.4, 0.25)
    ou, ov = -0.84, -0.72                                                                # a brass orrery
    k.cyl(ou, ov, TOP, 0.06, 0.02, "brass", top="steelL", sides=12)
    k.cyl(ou, ov, TOP + 0.02, 0.012, 0.16, "brass", sides=6)
    k.cyl(ou, ov, TOP + 0.15, 0.035, 0.06, "steelL", sides=10)
    ring(k, "z", ou, ov, TOP + 0.17, 0.1, 16, 0.012, 0.012, "brass")
    k.cyl(ou + 0.1, ov, TOP + 0.16, 0.018, 0.03, "rust", sides=8)
    mug(k, -0.84, -0.36)
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
    k.box(route[-1][0], route[-1][1], route[-1][2] - 0.03, 0.05, 0.05, 0.05, L, rz=0.785)
    pane(k, -0.4, PV, PZ, 0.52, 0.3, rows(0.52, 0.3, (0.3, 0.2, 0.36)) + [(0.16, 0.05, 0.08, 0.08)])
    return k


# ---- guard ------------------------------------------------------------------------------------------------------------
def guard(rot=0):
    k = desk(f"desk_g_{rot}", rot)
    k.box(0.0, -0.4, TOP, 0.4, 0.1, zpx(2), "steelD", top="dark", rz=0.12)                   # the baton's cradle,
    k.box(0.0, -0.4, TOP + zpx(2), 0.36, 0.04, 0.04, "dark", top="gm", rz=0.12)               # the stun baton
    tu, tv = rot2(0.0, -0.4, 0.12, 0.17, 0.0)
    k.box(tu, tv, TOP + zpx(2), 0.04, 0.045, 0.045, "steelL", rz=0.12)
    bu, bv = -0.86, -0.74                                                                # the beacon
    k.cyl(bu, bv, TOP, 0.06, 0.03, "steelD", top="dark", sides=12)
    k.cyl(bu, bv, TOP + 0.03, 0.045, 0.07, "hivis", rtop=0.02, sides=12)
    mug(k, -0.84, -0.36)
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
    for (du, dv), col in (((-0.12, 0.08), L), ((0.14, -0.15), L), ((0.1, 0.19), "dkAlert")):  # patrols, a contact
        k.box(WU + du, VM + dv, z + 0.01, 0.05, 0.05, 0.05, col, rz=0.785)
    for i, u in enumerate((-0.62, -0.22)):                                                 # two camera feeds
        pane(k, u, PV, PZ, 0.34, 0.26, [(0.12, 0.2, 0.05, 0.03, "dkAlert" if i else L)])
        figure(k, u - 0.04 + 0.06 * i, PV + 0.014, PZ + 0.03, 0.7)
    return k


# ---- customs ----------------------------------------------------------------------------------------------------------
def customs(rot=0):
    k = desk(f"desk_c_{rot}", rot)
    for i in range(4):                                                                    # permits, filed
        k.box(-0.84, -0.7, TOP + i * 0.012, 0.16, 0.2, 0.012, ("medWhite", "ochM", "medWhite", "plate")[i],
              rz=0.08 * (i - 1))
    k.cyl(0.08, -0.36, TOP, 0.06, 0.025, "steelD", top="medRed", sides=12)                   # the customs stamp
    k.cyl(0.08, -0.36, TOP + 0.025, 0.022, 0.08, "dark", sides=8)
    k.cyl(0.08, -0.36, TOP + 0.1, 0.04, 0.035, "steelL", sides=10)
    k.box(-0.14, -0.62, TOP, 0.12, 0.26, zpx(2), "steelD", top="dark", rz=-0.15)              # the scanner wand
    k.box(-0.14, -0.62, TOP + zpx(2), 0.05, 0.24, 0.04, "steelL", top="plate", rz=-0.15)
    k.box(-0.82, -0.36, TOP, 0.26, 0.2, 0.03, "steelD", top="dark")                         # the confiscated tray
    k.cyl(-0.88, -0.38, TOP + 0.03, 0.03, 0.1, "pcb", top="steelL", sides=8)
    k.box(-0.78, -0.33, TOP + 0.03, 0.08, 0.06, 0.05, "medRed", top="rust", rz=0.3)
    return k


def customs_holo():
    k = K("desk_c_holo", FP, 0)
    s, cz = 0.3, TOP + 0.36
    cone(k, cz - s / 2, 0.15)
    wire_box(k, WU, VM, cz, s, 0.4)                                                       # the scanned crate,
    k.box(WU, VM, cz - s / 2, s - 0.02, s - 0.02, s, F, rz=0.4)
    k.box(WU - 0.04, VM, cz - 0.1, 0.08, 0.1, 0.12, L, rz=0.4)                              # its contents
    k.cyl(WU + 0.06, VM + 0.02, cz - 0.1, 0.03, 0.14, "dkAlert", sides=8)                    # (one flagged)
    ring(k, "z", WU, VM, cz + 0.03, 0.25, 24, 0.02, 0.02, L)                                # the scan ring
    pane(k, -0.45, PV, PZ, 0.5, 0.3, rows(0.5, 0.3, (0.18, 0.14, 0.2), x0=0.22) + [(0.15, 0.03, 0.12, 0.05, "dkGo")])
    figure(k, -0.59, PV + 0.014, PZ + 0.03, 0.75)
    return k


DESIGNS = {"office": (office, office_holo), "guard": (guard, guard_holo), "customs": (customs, customs_holo)}


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
