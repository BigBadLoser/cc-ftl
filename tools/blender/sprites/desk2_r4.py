"""2x1 desk look study, round 4 (family `desk2d`, palette sets desk + bar17 + bar18 + bar22 + bar9, preview only;
issue #485): three more desks, each a different kind of object with its own holo projector and a post's dressing. The
operator works from the tile in front (+v, lower left at r0); the dressing goes on any body.

  g1 waterfall, office: one moulded bone band, the top running round soft corners down to the floor at both ends, a
     gunmetal back panel between them; a projector slot along the back edge throws three panes in a shallow arc
  g2 podium, customs: a standing checkpoint desk, a gunmetal body with a slanted top rising to a visitor's ledge at the
     back, its front leaning out over a hazard-striped foot; a mast at one end carries the projector over the slant (the scan and the ID)
  g3 salvage, guard: a riveted hull plate with a scuffed edge on two I-beam trestles, and an old searchlight housing
     bolted to the back corner as the projector (the deck plan and a camera feed)

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from . import core, post
from .desk2_r1 import BK, FP, FR, F, L, SLAB, TOP, emitter, figure, mug, pane, rows, span
from .desk2_r3 import crate, plan_marks
from .modkit import K
from .research_kit import PXG, Bench, bar, holo_item, ring, zpx

PAL = "desk+bar17+bar18+bar22+bar9"


def extrude(k, pts, axis, a0, a1, col, top=None):
    """A profile pts [(x, z)] (x is v when axis is "u", u when axis is "v"), extruded along axis from a0 to a1, as one
    closed mesh; `top` colours the faces that look up."""
    if sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(pts, pts[1:] + pts[:1])) < 0:
        pts = pts[::-1]

    def g(x, z, a):
        u, v = (a, x) if axis == "u" else (x, a)
        return core.G(*k.p(u, v), z)
    s0, s1 = [g(x, z, a0) for x, z in pts], [g(x, z, a1) for x, z in pts]
    n = len(pts)
    flip = axis == "u"
    for i in range(n):
        j = (i + 1) % n
        up = pts[j][0] < pts[i][0]                                       # (the outline runs counter-clockwise)
        k.m.poly([s0[i], s0[j], s1[j], s1[i]], (top if top and up else col), flip=not flip)
    k.m.poly(s0, col, flip=flip)
    k.m.poly(s1[::-1], col, flip=flip)


def quarter(cx, cz, rx, rz, a0, a1, n=6):
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n), cz + rz * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


# ---- g1 waterfall, office ---------------------------------------------------------------------------------------------
UE, RR, TT = 1 - PXG, 9, 3                    # g1's ends, corner radius and thickness (px)


def waterfall(ue=UE):
    ru, rz, tu, tz = RR * PXG, zpx(RR), TT * PXG, zpx(TT)
    out = ([(-ue, 0.0)] + quarter(-ue + ru, TOP - rz, ru, rz, math.pi, math.pi / 2)
           + quarter(ue - ru, TOP - rz, ru, rz, math.pi / 2, 0.0) + [(ue, 0.0)])
    inn = ([(ue - tu, 0.0)] + quarter(ue - ru, TOP - rz, ru - tu, rz - tz, 0.0, math.pi / 2)
           + quarter(-ue + ru, TOP - rz, ru - tu, rz - tz, math.pi / 2, math.pi) + [(-ue + tu, 0.0)])
    return out + inn


def g1(rot=0):
    k = Bench(f"desk2_g1_{rot}", FP, rot)
    extrude(k, waterfall(), "v", BK + PXG, FR, "x7Bone", top="x7White")                               # the band
    extrude(k, waterfall(UE - 0.5 * PXG), "v", FR, FR + 0.5 * PXG, "x7Oxide")                           # its edge line
    span(k, -UE + 3 * PXG, UE - 3 * PXG, BK + 3 * PXG, BK + 5 * PXG, zpx(6), TOP - zpx(TT), "x7Gun")   # back panel
    span(k, -0.6, 0.6, BK + 2 * PXG, BK + 5 * PXG, TOP, TOP + zpx(1), "x7Gun", top="dkGlass")           # the slot
    span(k, -0.56, 0.56, BK + 3 * PXG, BK + 4 * PXG, TOP + zpx(1), TOP + zpx(1.5), "dkSeam")
    k.box(-0.3, 0.16, TOP, 0.22, 0.16, 0.012, "steelD", top="dark", rz=0.35)                          # a slate
    for i in range(3):                                                                                 # folders
        k.box(0.58, 0.12, TOP + i * 0.014, 0.16, 0.22, 0.014, ("ochM", "dkTeal", "medWhite")[i], rz=0.1 * (i - 1))
    mug(k, -0.74, 0.2)
    return k


def g1_holo():
    k = K("desk2_g1_holo", FP, 0)
    sv, z = BK + 3.5 * PXG, TOP + zpx(2)
    for i, (u, rz) in enumerate(((-0.5, 0.35), (0.0, 0.0), (0.5, -0.35))):                            # three panes
        cu, cv = u, sv + 0.06 + abs(u) * 0.2
        bar(k, (u * 0.9, sv, TOP + zpx(1.5)), (cu, cv, z + 0.06), 0.012, L)
        marks = rows(0.4, 0.26, (0.24, 0.16, 0.28)) if i != 1 else [(0.0, 0.12, 0.3, 0.02), (0.06, 0.06, 0.02, 0.14),
                                                                    (-0.1, 0.16, 0.04, 0.04, "dkAmber")]
        _pane_turned(k, cu, cv, z + 0.06, 0.4, 0.26, rz, marks)
    return k


def _pane_turned(k, cu, cv, z0, w, h, rz, marks):
    """pane(), turned rz about its own upright axis."""
    c, s = math.cos(rz), math.sin(rz)
    k.box(cu, cv, z0, w, 0.01, h, F, rz=rz)
    for z in (z0, z0 + h - 0.03):
        k.box(cu - s * 0.01, cv + c * 0.01, z, w, 0.012, 0.03, L, rz=rz)
    for x in (-w / 2 + 0.015, w / 2 - 0.015):
        k.box(cu + c * x - s * 0.01, cv + s * x + c * 0.01, z0, 0.03, 0.012, h, L, rz=rz)
    for m in marks:
        x, y, bw, bh = m[:4]
        k.box(cu + c * x - s * 0.014, cv + s * x + c * 0.014, z0 + y, bw, 0.01, bh, m[4] if len(m) > 4 else L, rz=rz)


# ---- g2 podium, customs -----------------------------------------------------------------------------------------------
LV = BK + 0.22                                # g2's ledge front
ZF, ZB, ZL = zpx(30), zpx(36), zpx(40)        # the slant's front and back heights, the ledge
MU = 0.86                                     # the mast


def g2(rot=0):
    k = Bench(f"desk2_g2_{rot}", FP, rot)
    fb = FR - 0.2                                                                                      # the foot, set
    body = [(fb, 0.0), (fb, zpx(4)), (fb + 2 * PXG, zpx(4)), (FR, ZF - zpx(4)), (FR, ZF), (LV, ZB), (LV, ZL),  # back, the
            (BK, ZL), (BK, 0.0)]                                                                       # front leaning out
    extrude(k, body, "u", -1 + PXG, 1 - PXG, "x7Gun", top="r9GreyD")                                  # the body
    n = 12
    for i in range(n):                                                                                 # hazard kick
        u0 = -1 + 2 * PXG + i * (2 - 4 * PXG) / n
        span(k, u0, u0 + (2 - 4 * PXG) / n, fb, fb + 0.5 * PXG, zpx(0.5), zpx(3.5),
             "x7Yellow" if i % 2 == 0 else "x7Black")
    span(k, -1 + PXG, 1 - PXG, FR, FR + 0.5 * PXG, ZF - zpx(3), ZF - zpx(2), "x7Oxide")                  # a trim line
    span(k, -1 + PXG, 1 - PXG, LV - 0.5 * PXG, LV, ZB + zpx(1), ZB + zpx(2), "x7Black")                 # the slant's lip
    k.cyl(MU, BK + 0.1, ZL, 0.03, 0.62, "x7Black", sides=8)                                             # the mast
    k.box(MU - 0.08, BK + 0.12, ZL + 0.56, 0.2, 0.08, 0.06, "x7Gun", top="r9GreyD")                    # its head
    span(k, MU - 0.15, MU - 0.03, BK + 0.13, BK + 0.15, ZL + 0.555, ZL + 0.56, "dkSeam")
    t = math.atan2(ZB - ZF, FR - LV)                                                                    # on the slant
    for u, v, w, d, col in ((-0.5, 0.06, 0.2, 0.14, "steelD"), (0.1, 0.12, 0.16, 0.2, "medWhite")):
        z = ZF + (FR - v) * math.tan(t)
        k.box(u, v, z, w, d, 0.012, col, top="dark" if col == "steelD" else "medWhite", rx=t)
    k.cyl(-0.6, BK + 0.1, ZL, 0.06, 0.025, "steelD", top="medRed", sides=12)                           # the stamp
    k.cyl(-0.6, BK + 0.1, ZL + 0.025, 0.022, 0.08, "dark", sides=8)
    k.cyl(-0.6, BK + 0.1, ZL + 0.1, 0.04, 0.035, "steelL", sides=10)
    return k


def g2_holo():
    k = K("desk2_g2_holo", FP, 0)
    hu, hv, hz = MU - 0.09, BK + 0.14, ZL + 0.55
    cu, cv, cz = 0.32, 0.0, ZB + 0.18
    for du in (-0.12, 0.12):
        bar(k, (hu, hv, hz), (cu + du, cv, cz + 0.1), 0.012, L)
    crate(k, 0.2, (cu, cv), cz)
    ring(k, "z", cu, cv, cz - 0.1, 0.17, 24, 0.02, 0.02, L)
    pane(k, -0.3, BK + 0.12, ZL + 0.06, 0.46, 0.28, rows(0.46, 0.28, (0.16, 0.12, 0.18), x0=0.2)
         + [(0.14, 0.03, 0.12, 0.05, "dkGo")])
    figure(k, -0.43, BK + 0.134, ZL + 0.09, 0.7)
    return k


# ---- g3 salvage, guard ------------------------------------------------------------------------------------------------
HU, HV = -0.8, BK + 0.14                      # g3's searchlight


def ibeam(k, u0, u1, v0, v1, z0, z1, along, col):
    """An I-beam in the box, running along u or v (its flanges top and bottom)."""
    f = zpx(1.5)
    span(k, u0, u1, v0, v1, z0, z0 + f, col)
    span(k, u0, u1, v0, v1, z1 - f, z1, col)
    if along == "u":
        m = (v0 + v1) / 2
        span(k, u0, u1, m - PXG, m + PXG, z0 + f, z1 - f, col)
    else:
        m = (u0 + u1) / 2
        span(k, m - PXG, m + PXG, v0, v1, z0 + f, z1 - f, col)


def g3(rot=0):
    k = Bench(f"desk2_g3_{rot}", FP, rot)
    h = TOP - zpx(4)
    for tu in (-0.72, 0.72):                                                                           # trestles
        ibeam(k, tu - 0.06, tu + 0.06, -0.42, 0.42, 0, zpx(5), "v", "x7Black")
        ibeam(k, tu - 0.06, tu + 0.06, -0.06, 0.06, zpx(5), h, "v", "x7Black")
        span(k, tu - 0.06, tu + 0.06, -0.42, 0.42, h - zpx(2), h, "x7Black")
        span(k, tu - 0.065, tu + 0.065, 0.1, 0.3, zpx(1), zpx(4), "x7Yellow")                           # old paint
    span(k, -1 + PXG, 1 - PXG, BK + PXG, FR, h, TOP, "x7Steel", top="r9Grey")                          # the plate
    span(k, -1 + 2 * PXG, -0.3, FR, FR + 0.4 * PXG, h + zpx(1), TOP - zpx(1), "rust")                   # a scuff
    for u in [-0.9 + 0.2 * i for i in range(10)]:                                                      # rivets
        for v in (BK + 3 * PXG, FR - 3 * PXG):
            span(k, u - 0.5 * PXG, u + 0.5 * PXG, v - 0.5 * PXG, v + 0.5 * PXG, TOP, TOP + zpx(1), "steelL")
    span(k, -0.2, 0.4, -0.18, -0.02, TOP, TOP + zpx(0.5), "x7Gun")                                     # a weld patch
    span(k, HU - 0.1, HU + 0.1, HV - 0.08, HV + 0.08, TOP, TOP + zpx(2), "x7Black")                    # the light's
    k.box(HU, HV, TOP + zpx(2), 0.05, 0.05, 0.16, "x7Black")                                            # yoke
    k.cyl(HU, HV, TOP + 0.16, 0.1, 0.16, "x7OliveD", top="x7Olive", sides=16)                           # housing
    ring(k, "z", HU, HV, TOP + 0.32, 0.09, 16, 0.01, 0.02, "steelL")
    k.cyl(HU, HV, TOP + 0.31, 0.08, 0.012, "dkSeam", sides=16)
    k.box(0.42, 0.2, TOP, 0.4, 0.1, zpx(2), "steelD", top="dark", rz=0.12)                            # baton cradle
    k.box(0.42, 0.2, TOP + zpx(2), 0.36, 0.04, 0.04, "dark", top="gm", rz=0.12)
    k.box(-0.3, 0.2, TOP, 0.1, 0.06, 0.16, "x7Black", top="x7Gun", rz=0.3)                            # a radio
    k.cyl(0.84, -0.22, TOP, 0.06, 0.03, "steelD", top="dark", sides=12)                               # the beacon
    k.cyl(0.84, -0.22, TOP + 0.03, 0.045, 0.07, "hivis", rtop=0.02, sides=12)
    mug(k, 0.0, 0.24)
    return k


def g3_holo():
    k = K("desk2_g3_holo", FP, 0)
    z0, pu, pv, pz = TOP + 0.32, 0.0, -0.2, TOP + 0.16
    for dz in (0.0, 0.32):
        bar(k, (HU + 0.06, HV, z0), (pu - 0.33, pv, pz + dz), 0.015, L)
    pane(k, pu, pv, pz, 0.66, 0.32, plan_marks())
    pane(k, 0.56, pv + 0.04, pz + 0.06, 0.24, 0.2, [(0.07, 0.14, 0.05, 0.03, "dkAlert")])
    figure(k, 0.57, pv + 0.054, pz + 0.08, 0.55)
    return k


DESIGNS = {"g1": (g1, g1_holo), "g2": (g2, g2_holo), "g3": (g3, g3_holo)}


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
