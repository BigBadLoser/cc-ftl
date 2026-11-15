"""2x1 desk look study, round 1 (family `desk2`, palette set desk, preview only; issue #485): three new desks, two tiles
wide and one deep, each built round its own holo projector and dressed for a different post. The operator works from
the tile in front (+v, toward the camera at r0); a chair, if any, is its own piece. The dressing (hologram and props) is
per post and can go on any of the three bodies. Nothing glows but the projector and the hologram, which is its own
translucent layer `.holo` (research_kit.holo_item: the desk as holdout).

  d1 slab, office: a thin top on a drawer pedestal (left) and the projector post (right), whose emitter is set in the
     top; a globe with a plotted route, a notes pane; a slate, folders, a mug
  d2 console, guard: end panels to the floor, a knee well, a screen riser along the back with an emitter slot on the
     top; a wall of panes from the slot: the deck plan with patrol blips and one red contact, two camera feeds; a stun baton, a beacon, a mug
  d3 counter, customs: a work top at the front and a raised transaction ledge behind it for whoever stands at the back,
     a scan pad set in the ledge; a scanned crate with one flagged item, an ID pane; the stamp, permits, a tray

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk"
FP = (2, 1)
TOP = zpx(26)                                # desktop height (the sit pose's hands)
SLAB = zpx(3)
FR, BK = 0.5 - PXG, -0.5 + PXG               # the front and back planes
L, F = "dkHolo", "dkHoloF"                   # hologram lines (lit) and film


def rot2(u, v, rz, du, dv):
    c, s = math.cos(rz), math.sin(rz)
    return u + c * du - s * dv, v + s * du + c * dv


def span(k, u0, u1, v0, v1, z0, z1, col, top=None):
    """A box by its extents."""
    k.box((u0 + u1) / 2, (v0 + v1) / 2, z0, u1 - u0, v1 - v0, z1 - z0, col, top=top)


def emitter(k, u, v, z, r):
    """A round projector well set in a top at height z: dark glass, a lit ring."""
    k.cyl(u, v, z, r, zpx(1), "dkGraph", top="dkGlass", sides=24)
    ring(k, "z", u, v, z + zpx(1), r - 0.025, 24, 0.008, 0.03, "dkSeam")


def cone(k, u, v, z0, r0, z1, r1):
    """A projection: four lit bars from the emitter's rim up and out."""
    for a in (0.0, math.pi / 2, math.pi, 1.5 * math.pi):
        bar(k, (u + r0 * math.cos(a), v + r0 * math.sin(a), z0), (u + r1 * math.cos(a), v + r1 * math.sin(a), z1),
            0.02, L)


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


def mug(k, u, v, z=TOP):
    k.cyl(u, v, z, 0.045, 0.09, "dkMug", top="dark", sides=12)
    k.box(u + 0.05, v, z + 0.02, 0.03, 0.02, 0.05, "dkMug")


# ---- d1 slab, office --------------------------------------------------------------------------------------------------
PU, PV = 0.66, 0.0                           # d1's projector post


def d1(rot=0):
    k = Bench(f"desk2_d1_{rot}", FP, rot)
    span(k, -1 + PXG, 1 - PXG, BK + 2 * PXG, FR, TOP - SLAB, TOP, "steelL", top="plate")             # the top
    span(k, -1 + 3 * PXG, 1 - 3 * PXG, BK + 4 * PXG, FR - 2 * PXG, TOP - SLAB - zpx(1), TOP - SLAB, "steelD")
    span(k, -0.96, -0.42, BK + 4 * PXG, FR - 3 * PXG, zpx(2), TOP - SLAB - zpx(1), "gm", top="plate")  # the pedestal
    span(k, -0.94, -0.44, BK + 6 * PXG, FR - 5 * PXG, 0, zpx(2), "steelD")
    for i in range(3):                                                                                 # its drawers
        z0 = zpx(3) + i * zpx(7)
        span(k, -0.93, -0.45, FR - 3 * PXG, FR - 2.5 * PXG, z0, z0 + zpx(6), "dkGraph")
        span(k, -0.75, -0.63, FR - 2.5 * PXG, FR - 2 * PXG, z0 + zpx(4), z0 + zpx(5), "steelL")
    k.cyl(PU, PV, zpx(2), 0.17, TOP - SLAB - zpx(3), "gm", top="plate", sides=24)                      # the post
    k.cyl(PU, PV, 0, 0.2, zpx(2), "steelD", sides=24)
    k.cyl(PU, PV, zpx(9), 0.175, zpx(1), "dkTeal", sides=24)
    span(k, -0.42, PU - 0.12, BK + 4 * PXG, BK + 6 * PXG, zpx(8), TOP - SLAB - zpx(1), "gm", top="plate")  # modesty
    emitter(k, PU, PV, TOP, 0.17)
    k.box(-0.1, 0.12, TOP, 0.22, 0.16, 0.012, "steelD", top="dark", rz=0.25)                          # a slate
    su, sv = rot2(-0.1, 0.12, 0.25, 0.13, 0.0)
    k.box(su, sv, TOP, 0.02, 0.15, 0.015, "steelL", rz=0.4)
    for i in range(3):                                                                                 # folders
        k.box(-0.68, -0.18, TOP + i * 0.014, 0.2, 0.26, 0.014, ("ochM", "dkTeal", "medWhite")[i], rz=0.1 * (i - 1))
    mug(k, -0.36, 0.2)
    return k


def d1_holo():
    k = K("desk2_d1_holo", FP, 0)
    R, cz = 0.17, TOP + 0.4
    cone(k, PU, PV, TOP + zpx(1), 0.15, cz - R + 0.02, 0.06)
    for i in range(8):                                                                                 # the globe
        t = -1 + (2 * i + 1) / 8
        k.cyl(PU, PV, cz - R + 2 * R * i / 8, R * math.sqrt(1 - t * t), 2 * R / 8, F, sides=16)
    for f in (-0.6, 0.0, 0.6):
        ring(k, "z", PU, PV, cz + f * R, R * math.sqrt(1 - f * f) + 0.01, 20, 0.025, 0.02, L)
    ring(k, "u", PU, PV, cz, R + 0.01, 20, 0.025, 0.02, L)
    route = [(PU + 0.24 * math.cos(t), PV + 0.24 * math.sin(t), cz + 0.15 * math.sin(2 * t)) for t in
             [i * 0.35 - 0.6 for i in range(9)]]
    for a, b in zip(route, route[1:]):                                                                 # the route
        bar(k, a, b, 0.025, L)
    pane(k, -0.22, BK + 0.1, TOP + 0.14, 0.48, 0.28, rows(0.48, 0.28, (0.28, 0.2, 0.34)) + [(0.15, 0.05, 0.08, 0.08)])
    return k


# ---- d2 console, guard ------------------------------------------------------------------------------------------------
RV = BK + 0.17                               # d2's riser front


def d2(rot=0):
    k = Bench(f"desk2_d2_{rot}", FP, rot)
    for u0, u1 in ((-1 + PXG, -1 + 5 * PXG), (1 - 5 * PXG, 1 - PXG)):                                  # end panels
        span(k, u0, u1, BK, FR, 0, TOP, "gm", top="plate")
        span(k, u0, u1, FR, FR + 0.5 * PXG, zpx(3), zpx(4), "dkTeal")
    span(k, -1 + 5 * PXG, 1 - 5 * PXG, BK, FR, TOP - SLAB, TOP, "steelL", top="plate")                # the top
    span(k, -1 + 5 * PXG, 1 - 5 * PXG, BK, -0.02, zpx(2), TOP - SLAB, "gm")                          # the knee well's
    span(k, -1 + 6 * PXG, 1 - 6 * PXG, BK + PXG, -0.04, 0, zpx(2), "steelD")                          # back wall
    span(k, -1 + 5 * PXG, 1 - 5 * PXG, -0.02, 0.0, zpx(4), TOP - SLAB - zpx(1), "dkGraph")
    span(k, -1 + 5 * PXG, 1 - 5 * PXG, BK, RV, TOP, TOP + zpx(9), "gm", top="plate")                   # the riser
    span(k, -1 + 7 * PXG, 1 - 7 * PXG, RV, RV + 0.5 * PXG, TOP + zpx(2), TOP + zpx(7), "dkGlass")
    span(k, -0.5, 0.5, BK + 2 * PXG, RV - 2 * PXG, TOP + zpx(9), TOP + zpx(10), "dkGraph")              # the slot
    span(k, -0.46, 0.46, BK + 3 * PXG, RV - 3 * PXG, TOP + zpx(10), TOP + zpx(10.5), "dkSeam")
    k.box(0.38, 0.16, TOP, 0.4, 0.1, zpx(2), "steelD", top="dark", rz=0.12)                          # baton cradle
    k.box(0.38, 0.16, TOP + zpx(2), 0.36, 0.04, 0.04, "dark", top="gm", rz=0.12)
    k.box(-0.3, 0.14, TOP, 0.42, 0.14, zpx(1), "dkGraphD", top="dkGraph")                            # keyboard
    bu, bv = -0.82, 0.02                                                                                # the beacon
    k.cyl(bu, bv, TOP, 0.06, 0.03, "steelD", top="dark", sides=12)
    k.cyl(bu, bv, TOP + 0.03, 0.045, 0.07, "hivis", rtop=0.02, sides=12)
    mug(k, 0.8, 0.12)
    return k


def d2_holo():
    """A wall of panes rising from the riser's slot: the deck plan (rooms, patrol blips, one red contact) between two
    camera feeds. A flat plan over the desk read as a thin smear at this angle."""
    k = K("desk2_d2_holo", FP, 0)
    cz, sv = TOP + zpx(10.5), (BK + RV) / 2
    pz, w, h = TOP + zpx(12), 0.74, 0.34
    for u in (-0.3, 0.3):                                                                              # the slot's fan
        bar(k, (u, sv, cz), (u * 1.15, sv, pz), 0.015, L)
    plan = [(0.0, 0.16, 0.62, 0.02), (0.0, 0.05, 0.62, 0.02), (-0.31, 0.05, 0.02, 0.13), (0.31, 0.05, 0.02, 0.13),
            (-0.08, 0.05, 0.02, 0.13), (0.14, 0.05, 0.02, 0.13), (0.0, 0.24, 0.3, 0.02), (0.0, 0.18, 0.02, 0.07)]
    blips = [(-0.2, 0.1, 0.04, 0.04), (0.04, 0.1, 0.04, 0.04), (0.23, 0.1, 0.04, 0.04, "dkAlert")]
    pane(k, 0.0, sv, pz, w, h, plan + blips)
    for i, u in enumerate((-0.66, 0.66)):                                                              # two feeds
        pane(k, u, sv, pz, 0.26, 0.22, [(0.08, 0.16, 0.05, 0.03, "dkAlert" if i else L)])
        figure(k, u - 0.03 + 0.05 * i, sv + 0.014, pz + 0.03, 0.6)
    return k


# ---- d3 counter, customs ----------------------------------------------------------------------------------------------
LV, LZ = -0.08, TOP + zpx(12)                # d3's ledge front and height
SU, SV = 0.45, (BK + LV) / 2                 # its scan pad


def d3(rot=0):
    k = Bench(f"desk2_d3_{rot}", FP, rot)
    span(k, -1 + PXG, 1 - PXG, BK, LV, zpx(2), LZ - SLAB, "gm", top="plate")                          # the ledge body
    span(k, -1 + 2 * PXG, 1 - 2 * PXG, BK + PXG, LV - PXG, 0, zpx(2), "steelD")
    span(k, -1 + PXG, 1 - PXG, BK - PXG, LV + PXG, LZ - SLAB, LZ, "steelL", top="plate")              # the ledge
    span(k, -1 + PXG, 1 - PXG, BK - 1.5 * PXG, BK - PXG, zpx(14), zpx(16), "dkTeal")                 # (its back band)
    span(k, -1 + PXG, 1 - PXG, LV, FR, TOP - SLAB, TOP, "steelL", top="plate")                        # the work top
    span(k, 1 - 5 * PXG, 1 - PXG, LV, FR, 0, TOP - SLAB, "gm", top="plate")                           # its end panel
    span(k, -1 + PXG, 1 - 5 * PXG, LV + PXG, FR - 2 * PXG, TOP - SLAB - zpx(1), TOP - SLAB, "steelD")
    span(k, -1 + 3 * PXG, -1 + 5 * PXG, LV, FR - 3 * PXG, 0, TOP - SLAB - zpx(1), "gm")               # a leg
    span(k, SU - 0.2, SU + 0.2, SV - 0.1, SV + 0.1, LZ, LZ + zpx(1), "dkGraph", top="dkGlass")          # the scan pad
    for dv in (-0.08, 0.08):
        span(k, SU - 0.18, SU + 0.18, SV + dv - 0.012, SV + dv + 0.012, LZ + zpx(1), LZ + zpx(1.5), "dkSeam")
    for i in range(4):                                                                                 # permits
        k.box(-0.7, 0.18, TOP + i * 0.012, 0.16, 0.2, 0.012, ("medWhite", "ochM", "medWhite", "plate")[i],
              rz=0.08 * (i - 1))
    k.cyl(-0.38, 0.22, TOP, 0.06, 0.025, "steelD", top="medRed", sides=12)                             # the stamp
    k.cyl(-0.38, 0.22, TOP + 0.025, 0.022, 0.08, "dark", sides=8)
    k.cyl(-0.38, 0.22, TOP + 0.1, 0.04, 0.035, "steelL", sides=10)
    k.box(0.36, 0.2, TOP, 0.3, 0.2, 0.03, "steelD", top="dark")                                       # the tray
    k.cyl(0.3, 0.18, TOP + 0.03, 0.03, 0.1, "pcb", top="steelL", sides=8)
    k.box(0.42, 0.22, TOP + 0.03, 0.08, 0.06, 0.05, "medRed", top="rust", rz=0.3)
    k.box(-0.3, SV, LZ, 0.1, 0.26, zpx(2), "steelD", top="dark", rz=-0.15)                            # scanner wand
    return k


def d3_holo():
    k = K("desk2_d3_holo", FP, 0)
    s, cz = 0.24, LZ + 0.26
    cone(k, SU, SV, LZ + zpx(1.5), 0.16, cz - s / 2, 0.12)
    c = [(*rot2(SU, SV, 0.4, a * s / 2, b * s / 2), cz + e * s / 2) for e in (-1, 1) for a, b in
         ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(4):                                                                                 # the crate
        bar(k, c[i], c[(i + 1) % 4], 0.022, L)
        bar(k, c[4 + i], c[4 + (i + 1) % 4], 0.022, L)
        bar(k, c[i], c[4 + i], 0.022, L)
    k.box(SU, SV, cz - s / 2, s - 0.02, s - 0.02, s, F, rz=0.4)
    k.box(SU - 0.03, SV, cz - 0.08, 0.07, 0.08, 0.1, L, rz=0.4)
    k.cyl(SU + 0.05, SV + 0.02, cz - 0.08, 0.025, 0.12, "dkAlert", sides=8)
    ring(k, "z", SU, SV, cz + 0.02, 0.2, 24, 0.02, 0.02, L)                                           # the scan ring
    pane(k, -0.4, LV - 0.02, LZ + 0.06, 0.46, 0.28, rows(0.46, 0.28, (0.16, 0.12, 0.18), x0=0.2)
         + [(0.14, 0.03, 0.12, 0.05, "dkGo")])
    figure(k, -0.53, LV - 0.006, LZ + 0.09, 0.7)
    return k


DESIGNS = {"d1": (d1, d1_holo), "d2": (d2, d2_holo), "d3": (d3, d3_holo)}


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
