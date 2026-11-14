"""Office desk look study, round 6 (family `desk`, palette set desk, preview only): round 5's blank desks b1..b4 (the
user's "decent" round), cleaned up and tried in three materials. Every one keeps the round projection post (a lit
drum pedestal under a round end, the holo well in it). No props, no holograms: the dressing comes later, per post.

Clean-up: the top and its round end are one prism (no coplanar faces fighting where a slab met a disc), lit bands
stand a whole px proud (not a fraction, which broke into dots), no face shares a plane with another.

Local frame modkit.K, footprint (2, 2): u across, v deep, the front +v toward the camera at r0. The desk stands on
the back row (v BACK..FRONT), the chair in the front-left tile facing it (the console sit pose: desktop height TOP).

  b1 ledge      the slab, an end panel, an instrument ledge along the back with a glass face
  b2 sled       a thin top lit along the underside of its front edge, the free end on a sled leg
  b3 capsule    round at both ends, the left end on a slim lit column at the back
  b4 spine      the top on a solid back spine with the drum's lit band running along it

Materials (MATS): steel (the consoles' steel and blue-grey, a dark groove), brass (gunmetal with brass bands and
edge), white (cool white composite, grey body, hi-vis orange stripes). Nothing glows but the holo well."""
import math

from . import console_proto as C
from . import core
from .cmbkit import Frame
from .modkit import K
from .research_kit import PXG, Bench, ring, zpx

PAL = "desk"
FP = (2, 2)
CHAIR = (-0.5, 0.5)                          # the chair tile (local u, v)
TOP = zpx(26)                                # desktop height (the sit pose's hands)
BACK, FRONT = -31 * PXG, -5 * PXG            # the desk's back and front planes, on the u/v grid
VM, D = (BACK + FRONT) / 2, FRONT - BACK     # its middle and depth
WU, WR = 0.5, D / 2                          # the round end: centre u (at VM), radius
U0 = -0.98                                   # the free end
SLAB = zpx(4)                                # the top's thickness
BAND = zpx(11)                               # the lit band's height on the drum

# roles -> colours: top (the desktop), edge (the top's sides), body (pedestals, panels), cap (their tops), panel (an
# inset or second tone), dark (reveals, kicks, plinths), struct (legs, rails, the spine), band (lit bands), trim (a
# 1 px line along the top's front edge, or None), well (the holo well's ring)
MATS = {
    "steel": dict(top="plate", edge="steelL", body="gm", cap="plate", panel="blueGrey", dark="steelD",
                  struct="steel", band="steelD", trim=None, well="dkSeam",
                  chair={"navy": "blueGrey", "brass": "steelL"}),
    "brass": dict(top="gm", edge="steel", body="steelD", cap="steel", panel="steel", dark="dark", struct="steel",
                  band="brass", trim="brass", well="dkSeam"),
    "white": dict(top="medWhite", edge="sole", body="sole", cap="medWhite", panel="pocket", dark="steelD",
                  struct="pocket", band="hivis", trim="hivis", well="dkSeam"),
}
M = MATS["steel"]


class _Chair(Frame):
    def poly(self, pts, color, flip=False):
        super().poly(pts, M.get("chair", {}).get(color, color), flip)


def chair(rot=0):
    m = core.Mesh(f"desk_chair_{rot}")
    C.chair(_Chair(m, rot, centre=K("desk_chair_xy", FP, rot).p(*CHAIR)), 0.0, 0.0, False)
    return m.build()


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


def outline(left_round=False, inset=0.0):
    """The top's outline: straight from the free end to the round end's centre, then round; inset shrinks it."""
    r = WR - inset
    right = arc(WU, VM, r, -math.pi / 2, math.pi / 2, 14)
    if left_round:
        cu = U0 + WR
        left = arc(cu, VM, r, math.pi / 2, 1.5 * math.pi, 14)
        return right + left
    return [(U0 + inset, VM - r)] + right + [(U0 + inset, VM + r)]


def top(k, left_round=False, t=SLAB):
    """The desktop in one piece, its shadow line under it (inset 2 px), and the trim along its front edge."""
    prism(k, outline(left_round), TOP - t, t, M["edge"], M["top"])
    prism(k, outline(left_round, 2 * PXG), TOP - t - zpx(1), zpx(1), M["dark"])
    if M["trim"]:
        u0 = U0 + WR if left_round else U0
        k.box((u0 + WU) / 2, FRONT + PXG / 2, TOP - zpx(2), WU - u0, PXG, zpx(1), M["trim"])


def post(k, t=SLAB):
    """The round projection post: the drum pedestal with its lit band, the holo well (the round end is the top's)."""
    k.cyl(WU, VM, 0.0, 0.26, zpx(2), M["dark"], sides=24)
    k.cyl(WU, VM, zpx(2), 0.3, TOP - t - zpx(3), M["body"], top=M["cap"], sides=24)
    k.cyl(WU, VM, BAND, 0.3 + PXG, zpx(1), M["band"], sides=24)
    k.cyl(WU, VM, TOP, 0.24, zpx(1), "dkGraph", top="dkGlass", sides=24)
    ring(k, "z", WU, VM, TOP + zpx(1), 0.215, 24, 0.008, 0.03, M["well"])


def end_panel(k, t=SLAB):
    k.box(U0 + 2 * PXG, VM, 0.0, 4 * PXG, D - 4 * PXG, TOP - t - zpx(1), M["body"], top=M["cap"])


# ---- the variants -----------------------------------------------------------------------------------------------------
def b1(rot=0):
    k = Bench(f"desk_b1_{rot}", FP, rot)
    post(k)
    top(k)
    end_panel(k)
    k.box(-0.48, BACK + 5 * PXG, zpx(10), 0.9, 2 * PXG, zpx(3), M["struct"])               # the back stretcher
    lv0, lv1 = BACK + PXG, BACK + 8 * PXG                                               # the ledge, its glass face
    k.box(-0.42, (lv0 + lv1) / 2, TOP, 1.1, lv1 - lv0, zpx(7), M["body"], top=M["cap"])
    k.box(-0.42, lv1 + PXG / 2, TOP + zpx(1), 1.02, PXG, zpx(5), "dkGlass")
    return k


def b2(rot=0):
    k = Bench(f"desk_b2_{rot}", FP, rot)
    t = zpx(3)
    post(k, t)
    top(k, t=t)
    k.box(-0.24, FRONT - 3 * PXG, TOP - t - zpx(2), 1.4, 2 * PXG, zpx(1), M["band"])         # the lit underside edge
    lu = -0.9                                                                            # the sled leg
    for v in (BACK + 0.1, FRONT - 0.1):
        k.box(lu, v, zpx(2), 3 * PXG, 3 * PXG, TOP - t - zpx(5), M["struct"])
    k.box(lu, VM, 0.0, 4 * PXG, D - 0.08, zpx(2), M["struct"], top=M["dark"])
    k.box(lu, VM, TOP - t - zpx(3), 4 * PXG, D - 0.12, zpx(2), M["struct"])
    k.box((lu + WU - 0.28) / 2, BACK + 0.12, zpx(13), WU - 0.28 - lu, 2 * PXG, zpx(2), M["struct"])  # a rail to the post
    return k


def b3(rot=0):
    k = Bench(f"desk_b3_{rot}", FP, rot)
    post(k)
    top(k, left_round=True)
    cu, cv = U0 + WR, BACK + 0.16                                                        # the column, at the back
    k.cyl(cu, cv, 0.0, 0.12, zpx(2), M["dark"], sides=16)
    k.cyl(cu, cv, zpx(2), 0.07, TOP - SLAB - zpx(3), M["body"], top=M["cap"], sides=16)
    k.cyl(cu, cv, BAND, 0.07 + PXG, zpx(1), M["band"], sides=16)
    return k


def b4(rot=0):
    k = Bench(f"desk_b4_{rot}", FP, rot)
    post(k)
    top(k)
    su0, su1, sd = U0 + PXG, WU - 0.22, 10 * PXG                                           # the back spine
    sv = BACK + PXG + sd / 2
    k.box((su0 + su1) / 2, sv, zpx(2), su1 - su0, sd, TOP - SLAB - zpx(3), M["struct"], top=M["dark"])
    k.box((su0 + su1) / 2, sv, 0.0, su1 - su0 - 4 * PXG, sd - 4 * PXG, zpx(2), M["dark"])
    k.box((su0 + su1) / 2, sv + sd / 2 + PXG / 2, BAND, su1 - su0 - 4 * PXG, PXG, zpx(1), M["band"])
    return k


def flow_outline(r, thk, u0, grow=0.0):
    """The back and the drum as one outline: the back's back face on the drum's back tangent (so it runs into the
    drum without a step), round the drum, and back along the back's front face; grow pushes it out (a band)."""
    R, t = r + grow, thk + 2 * grow
    vb = VM - R
    a = math.pi + math.asin((R - t) / R)                     # where the back's front face meets the drum
    pts = [(u0, vb)] + arc(WU, VM, R, -math.pi / 2, a, 24)
    return pts + [(u0, vb + t)]


def d1(rot=0):
    """Solid side, solid back flowing into the drum."""
    k = Bench(f"desk_d1_{rot}", FP, rot)
    r, thk, h = 0.3, 4 * PXG, TOP - SLAB - zpx(1)
    k.cyl(WU, VM, TOP, 0.24, zpx(1), "dkGraph", top="dkGlass", sides=24)                     # the holo well
    ring(k, "z", WU, VM, TOP + zpx(1), 0.215, 24, 0.008, 0.03, M["well"])
    top(k)
    su = U0 + 2 * PXG                                                                    # the solid side, flush
    sv0, sv1 = VM - r, FRONT                                                             # with the top's edges,
    k.box(su, (sv0 + sv1) / 2, zpx(2), 4 * PXG, sv1 - sv0, TOP - SLAB - zpx(2), M["body"], top=M["cap"])  # up to it
    k.box(su, (sv0 + sv1) / 2, 0.0, 2 * PXG, sv1 - sv0 - 2 * PXG, zpx(2), M["dark"])           # its kick
    u0 = su + 2 * PXG                                                                    # the back and the drum
    prism(k, flow_outline(r - 0.04, thk - 0.04, u0), 0.0, zpx(2), M["dark"])               # (a kick under them)
    prism(k, flow_outline(r, thk, u0), zpx(2), h - zpx(2), M["body"], M["cap"])
    prism(k, flow_outline(r, thk, U0 + 0.004, PXG / 2), BAND, zpx(1), M["band"])           # the band, to the side's edge
    return k


DESIGNS = {"d1": d1}


def build(v, mat, rot):
    global M
    M = MATS[mat]
    return DESIGNS[v](rot).build() + [chair(rot)]


def jobs():
    print("DESK chair from origin", K("desk_chair_xy", FP, 0).p(*CHAIR), flush=True)
    return [(f"module.desk.{v}.{mat}" + (f".r{r}" if r else ""), FP, "prop", lambda v=v, mat=mat, r=r: build(v, mat, r))
            for v in DESIGNS for mat in ("steel",) for r in (0, 1, 2, 3)]
