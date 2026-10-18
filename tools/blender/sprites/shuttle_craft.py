"""The SHUTTLE: the small craft crew ride between ships (vehicle art only; the bay it parks in is a separate module).

Local frame (cmbkit style): u along the length (+u = nose), v across, z up, origin at the centre of the footprint on the
PAD surface (z = 0). `Spin(heading)` turns the model to any heading in grid space; `rot_heading` gives the four parked
bay rotations (r0 nose -y, r1 +x, r2 +y, r3 -x, like the modules) and `fly_heading` the eight sim facings (d0 = +x,
counter-clockwise in grid space, d2 = +y; the crew sheet convention).

Shape (v4): a fuselage swept from a rounded-rectangle cross-section (superellipse, `sweep`) with a separate, narrower
COCKPIT pod stepped down and forward of it under a wraparound canopy; it sits in a wide rounded skirt that carries the
landing legs; twin engine pods on the rear flanks; a single tail fin; and two large swept WINGS on hinge fairings that
spread in flight and fold up beside the hull when parked or docked. The rear face is a LOADING RAMP (rose, hazard
sill): the bay's airlock and another hull's door mate here. Footprint parked 4.0 (u -2.12..1.9) by 3.0 tiles (pods);
in flight the spread wings reach 4.3 across. Heights (pad = 0): belly BELLY, skirt to 1.0, roofline ROOF, fin tip
TOP_FLY, folded wing tips TOP. Legs down = parked. The bay's pit must be at least TOP - roofs.ZR deep for the roof
slab; PIT_SUGGESTED sinks most of the body below the deck.

Livery: flat panels in the roof-livery key colours mkP (primary) / mkS (secondary), rendered unlit so the renderer
can match them exactly; the base hull is light grey (gW1). Curved parts use smooth custom normals (`smooth`) so they
shade as bands, not facets. Every detail is >= 0.05 tiles (2 px at game scale)."""
import math
import numpy as np
from mathutils import Vector
from . import core, detail as D, cmbkit
from .cmbkit import Frame

ROOF = 1.8             # roofline (fuselage top)
TOP_FLY = 2.05         # tail fin tip
TOP = 2.35             # highest point parked: the folded wing tips
BELLY = 0.42           # ground clearance on the legs (skirt bottom)
PIT_SUGGESTED = 1.1    # pit depth for the bay: roof at 0.7 and folded wing tips at 1.25 above the deck (slab at 2.05)
POD_V, POD_Z, POD_R = 1.2, 1.05, 0.3   # engine pods
HINGE = (1.1, 1.36)    # wing hinge line (v, z) on the hull flank
FOLD = math.radians(82)                # wing fold angle when parked / docked
GLOW = "cyan"          # nozzle glow (the ship's drives glow cyan too)
SMOOTH_DEG = 35        # edges sharper than this stay hard
PROF_N, PROF_P = 20, 4 # cross-section sampling / superellipse power (4 = rounded rectangle; corners < 29 deg)

# swept bodies: stations (u, half width, half height, v centre, z centre)
FUSE = [(-1.75, 1.0, 0.6, 0, 1.1), (-1.2, 1.1, 0.68, 0, 1.12), (0.5, 1.1, 0.68, 0, 1.12), (0.95, 1.02, 0.6, 0, 1.1),
        (1.15, 0.8, 0.46, 0, 1.0)]
COCKPIT = [(0.6, 0.62, 0.42, 0, 1.06), (1.25, 0.62, 0.42, 0, 1.04), (1.65, 0.5, 0.32, 0, 0.98), (1.9, 0.3, 0.17, 0, 0.9)]
SKIRT = [(-1.8, 1.05, 0.28, 0, 0.72), (-1.4, 1.3, 0.3, 0, 0.72), (0.7, 1.3, 0.3, 0, 0.72), (1.5, 0.9, 0.26, 0, 0.74)]


def pod(sv):
    return [(-2.0, 0.27, 0.27, sv * POD_V, POD_Z), (-1.85, POD_R, POD_R, sv * POD_V, POD_Z), (-0.9, POD_R, POD_R, sv * POD_V, POD_Z),
            (-0.55, 0.17, 0.17, sv * POD_V, POD_Z)]


class Spin(Frame):
    """Frame turned to any heading (radians, grid space, 0 = nose +x; pi/2 = nose +y). Origin = footprint centre."""

    def __init__(self, m, heading):
        self.m, self.heading = m, heading
        q = round(heading / (math.pi / 2)) % 4
        self.rot = (1, 2, 3, 0)[q]           # cmbkit rotation with the same axes (for the overlap recorder)
        self.cx = self.cy = 0.0
        self.c, self.s = math.cos(heading), math.sin(heading)

    def xy(self, u, v):
        return u * self.c - v * self.s, u * self.s + v * self.c


def rot_heading(rot):
    """Parked bay rotation -> heading (r0 nose -y)."""
    return (-math.pi / 2, 0.0, math.pi / 2, math.pi)[rot]


def fly_heading(d):
    """Sim facing d (0 = +x, 2 = +y) -> heading."""
    return d * math.pi / 4


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


def profile(t0=None, t1=None, n=PROF_N, p=PROF_P):
    """Superellipse cross-section in unit half-sizes, counter-clockwise in the (v, z) plane (t = 90 deg is the top).
    Closed ring by default; with t0..t1 (degrees) an open arc of n points."""
    if t0 is None:
        ts = [(i + 0.5) * math.tau / n for i in range(n)]
    else:
        ts = [math.radians(t0 + (t1 - t0) * i / (n - 1)) for i in range(n)]
    out = []
    for t in ts:
        c, s = math.cos(t), math.sin(t)
        out.append((math.copysign(abs(c) ** (2 / p), c), math.copysign(abs(s) ** (2 / p), s)))
    return out


@cmbkit.prim
def sweep(f, stations, prof, mat, cap0=None, cap1=None, closed=True):
    """Loft the cross-section prof through stations (u, sv, sz, v0, z0) along increasing u (winding as Frame.hcyl)."""
    rings = [[f.pt(u, v0 + pv * sv, z0 + pz * sz) for pv, pz in prof] for u, sv, sz, v0, z0 in stations]
    n = len(prof)
    for A, B in zip(rings, rings[1:]):
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            f.poly([A[i], A[j], B[j], B[i]], mat, flip=True)
    if cap0:
        f.poly(rings[0], cap0, flip=True)
    if cap1:
        f.poly(rings[-1][::-1], cap1, flip=True)


def station(body, u, k=1.0):
    """Interpolated station of a swept body at u, with its half sizes scaled by k."""
    for a, b in zip(body, body[1:]):
        if a[0] <= u <= b[0]:
            t = (u - a[0]) / (b[0] - a[0])
            sv, sz, v0, z0 = (a[i] + (b[i] - a[i]) * t for i in range(1, 5))
            return (u, sv * k, sz * k, v0, z0)
    raise ValueError(u)


def patch(f, body, u0, u1, t0, t1, k, mat, n=9, steps=4):
    """A surface panel lying on a swept body: the arc t0..t1 of its cross-section, offset by factor k, over u0..u1."""
    us = [u0 + (u1 - u0) * i / steps for i in range(steps + 1)]
    sweep(f, [station(body, u, k) for u in us], profile(t0, t1, n), mat, closed=False)


def smooth(ob, angle=SMOOTH_DEG):
    """Merge coincident vertices and set custom split normals: faces meeting at less than `angle` shade smoothly
    (the swept bodies, cylinders), sharper edges stay hard. The quantised bands then follow curves, not facets."""
    import bmesh
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(me)
    bm.free()
    me.update()
    n = np.array([p.normal[:] for p in me.polygons])
    by_vert = {}
    for p in me.polygons:
        for vi in p.vertices:
            by_vert.setdefault(vi, []).append(p.index)
    cos_t = math.cos(math.radians(angle))
    out = []
    for p in me.polygons:
        for vi in p.vertices:
            near = [q for q in by_vert[vi] if np.dot(n[p.index], n[q]) > cos_t]
            v = n[near].sum(0)
            out.append(Vector(v / (np.linalg.norm(v) or 1.0)))
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.normals_split_custom_set(out)
    return ob


def wing(f, sv, fold, flash_only=False):
    """Swept tapered wing on the hull flank (sv = side), rotated about the hinge line by `fold` (0 = spread level,
    FOLD = standing up beside the hull). Root chord u -1.45..-0.15, tip chord -1.3..-0.7, span 0.95. flash_only builds
    just the livery flash on its top (for the flat livery mesh)."""
    hv, zh = HINGE
    cs, sn = math.cos(fold), math.sin(fold)

    def T(v, z):                                   # (outward from the hinge, height) -> (v, z) in the frame
        return sv * (hv + v * cs - (z - zh) * sn), zh + v * sn + (z - zh) * cs

    def plate(z_off, th, span, c_root, c_tip, mat, inset=0.0):
        def corner(a, b, d):
            tip = b * sv > 0
            u0, u1 = c_tip if tip else c_root
            u = u0 + inset if a < 0 else u1 - inset
            vv, zz = T((span if tip else 0.0) + (-inset if tip else inset), zh + z_off + (th / 2 if d > 0 else -th / 2))
            return (u, vv, zz)
        D.loft_box(f, corner, mat)
    if flash_only:
        plate(0.045, 0.012, 0.75, (-1.25, -0.5), (-1.2, -0.75), "mkP")             # top flash
        return
    plate(0.0, 0.08, 0.95, (-1.45, -0.15), (-1.3, -0.7), "plate")                  # the wing
    u0, u1 = -1.35, -0.6
    vv, zz = T(0.95, zh)
    f.box((u0 + u1) / 2, vv, zz, u1 - u0, 0.1, 0.1, "steelD", top="gm", base=False)   # tip pod
    f.box(-0.8, sv * (hv - 0.02), zh, 1.4, 0.2, 0.22, "steelL", top="plate", base=False)   # hinge fairing on the hull


def body(f, legs, glow, fold, damaged=False):
    hull = "gW1"
    _g("skirt")
    sweep(f, SKIRT, profile(), "plate", cap0="plate", cap1="plate")
    _g("hull")
    sweep(f, FUSE, profile(), hull, cap0=hull, cap1=hull)
    _g("cockpit")                                                                 # separate pod, lower and narrower
    sweep(f, COCKPIT, profile(), hull, cap1="steelL")
    patch(f, COCKPIT, 0.98, 1.85, 22, 158, 1.02, "plate", n=13, steps=5)          # canopy frame
    patch(f, COCKPIT, 1.03, 1.8, 30, 150, 1.04, "glassD", n=13, steps=5)
    patch(f, COCKPIT, 1.25, 1.4, 32, 148, 1.05, "lens", n=13, steps=2)            # one reflection band
    f.box(0.98, 0, 0.66, 0.05, 1.1, 0.1, "steelD", base=False)                    # neck seam under the cockpit
    _g("pods")
    for sv in (-1, 1):
        sweep(f, pod(sv), profile(n=16, p=2), "steelL", cap1="steelD")
        _g("nozzle")
        f.hcyl(-2.12, -2.0, sv * POD_V, POD_Z, 0.3, "steelD", r1=0.26, sides=16)        # flared lip
        f.hcyl(-2.06, -2.04, sv * POD_V, POD_Z, 0.24, "dark", sides=16, cap="dark", capstart="dark")   # liner floor
        f.hcyl(-2.07, -2.06, sv * POD_V, POD_Z, 0.16, glow, sides=12, capstart="arc" if glow != "dark" else "dark")
        _g("pods")
        f.box(-1.3, sv * (POD_V - 0.1), POD_Z - 0.3, 1.0, 0.3, 0.25, "steel", top="steelL")   # pod cradle on the skirt
    _g("wings")
    for sv in (-1, 1):
        wing(f, sv, fold)
    _g("fin")                                                                     # single tail fin
    D.loft_box(f, lambda a, b, d: ((-1.55 if a < 0 else -1.0), b * 0.035, 1.72 if d < 0 else (TOP_FLY if a < 0 else 1.92)), "plate")
    _g("ramp")                                                                    # rear loading ramp (rose, like the doors)
    u = -1.75
    f.box(u - 0.01, 0, 1.03, 0.02, 1.34, 0.96, "dark", base=False)                # seam frame
    f.box(u - 0.03, 0, 1.03, 0.03, 1.2, 0.86, "rM", base=False)                   # ramp leaf
    f.box(u - 0.04, 0, 1.36, 0.014, 1.2, 0.07, "rH", base=False)                  # lit band
    f.box(u - 0.04, 0, 1.15, 0.014, 0.4, 0.12, "rD", base=False)                  # window slot
    f.box(u - 0.04, 0, 1.15, 0.014, 0.3, 0.08, "glassD", base=False)
    for k in range(8):                                                            # hazard sill
        f.box(u - 0.04, -0.525 + k * 0.15, 0.66, 0.014, 0.15, 0.05, "hazY" if k % 2 == 0 else "hazK", base=False)
    _g("greeble")
    for sv in (-1, 1):                                                            # rcs blocks on the skirt's front corners
        f.box(1.1, sv * 1.1, 0.96, 0.2, 0.2, 0.14, "steelD", top="gm")
    f.vcyl(-0.3, 0.45, ROOF - 0.01, 0.2, 0.05, "plate", top="steelL", sides=12)   # dorsal hatch
    f.vcyl(-0.3, 0.45, ROOF + 0.04, 0.14, 0.04, "steelL", top="plate", sides=12)
    f.vcyl(0.55, -0.55, ROOF - 0.03, 0.045, 0.2, "steelL", sides=6)               # antenna
    f.box(0.55, -0.55, ROOF + 0.17, 0.09, 0.09, 0.07, "dark")
    f.box(0.1, -0.42, ROOF - 0.004, 1.0, 0.045, 0.008, "steelD")                  # roof seam
    if legs:
        _g("legs")
        for su in (-1.0, 1.0):
            for sv in (-0.85, 0.85):
                f.vcyl(su, sv, 0.0, 0.16, 0.05, "steelD", top="steel", sides=8)
                f.vcyl(su, sv, 0.05, 0.055, BELLY - 0.03, "steelL", sides=6)
                f.box(su, sv, 0.2, 0.14, 0.14, 0.12, "gm", top="plate")
    if damaged:
        _g("damage")
        patch(f, FUSE, 0.1, 0.6, 20, 70, 1.035, "grime", n=5, steps=2)            # scorch over the starboard shoulder
        patch(f, FUSE, -1.3, -0.9, 95, 130, 1.035, "grime", n=5, steps=2)
        f.box(0.3, -1.306, 0.75, 0.35, 0.012, 0.2, "dark", base=False)            # torn skirt panel
        f.box(-1.2, 0, TOP_FLY - 0.08, 0.3, 0.1, 0.012, "dark")                   # chipped fin tip


def livery(f, fold):
    """Flat key-colour panels (f over a flat Mesh): roof stripe (P) with S edges, skirt bands (S), wing, fin and pod
    flashes."""
    _g("livery")
    for sv in (-1, 1):
        wing(f, sv, fold, flash_only=True)
    f.box(-0.5, 0, ROOF - 0.004, 2.0, 0.36, 0.012, "mkP")
    for sv in (-1, 1):
        f.box(-0.5, sv * 0.24, ROOF - 0.004, 2.0, 0.12, 0.012, "mkS")
        f.box(-0.35, sv * 1.306, 0.72, 2.0, 0.012, 0.14, "mkS", base=False)
        f.box(-1.2, sv * (POD_V + POD_R - 0.004), POD_Z, 0.5, 0.012, 0.1, "mkS", base=False)
    f.box(-1.28, 0.04, 1.86, 0.4, 0.012, 0.06, "mkP", base=False)
    f.box(-1.28, -0.04, 1.86, 0.4, 0.012, 0.06, "mkP", base=False)


def shuttle(heading, state="parked", damaged=False, dz=0.0):
    """state: parked (legs down, wings folded, nozzles dark), fly (legs up, wings spread, nozzles glowing), docked
    (legs up, wings folded, nozzles dark). dz shifts the whole craft (a parked one sits at -pit depth)."""
    legs = state == "parked"
    glow = GLOW if state == "fly" else "dark"
    fold = 0.0 if state == "fly" else FOLD
    m = core.Mesh(f"shuttle_{state}")
    m.dz = dz
    body(Spin(m, heading), legs, glow, fold, damaged)
    lv = core.Mesh(f"shuttle_{state}_livery", flat=True)
    lv.dz = dz
    livery(Spin(lv, heading), fold)
    return [smooth(m.build()), lv.build()]


ALLOW = [("hull", "skirt"), ("cockpit", "hull"), ("cockpit", "skirt"), ("pods", "hull"), ("pods", "skirt"), ("nozzle", "pods"),
         ("wings", "hull"), ("wings", "pods"), ("fin", "hull"), ("ramp", "hull"), ("legs", "skirt"),
         ("greeble", "hull"), ("greeble", "skirt"), ("greeble", "cockpit"),
         ("livery", "hull"), ("livery", "skirt"), ("livery", "fin"), ("livery", "pods"), ("livery", "greeble"), ("livery", "wings"),
         ("damage", "hull"), ("damage", "skirt"), ("damage", "livery"), ("damage", "greeble"), ("damage", "fin")]


def pit(depth=PIT_SUGGESTED, w=4, l=5, rot=0):
    """Placeholder bay pit for scale (NOT the bay art): a sunken pad w x l tiles with plain inner walls and corner
    marks, plus a holdout deck around it (the deck hides what is behind its rim). Origin = pit centre at deck level."""
    m = core.Mesh("shuttle_pit", flat=True)
    sx, sy = (w, l) if rot % 2 == 0 else (l, w)
    z = -depth
    m.box((0, 0, z - 0.04), (sx, sy, 0.04), "plateC", top="plateA")
    for x, y in ((-1, -1), (1, -1), (-1, 1), (1, 1)):                              # corner marks on the pad
        m.box((x * (sx / 2 - 0.35), y * (sy / 2 - 0.35), z), (0.4, 0.06, 0.006), "hazY")
        m.box((x * (sx / 2 - 0.35), y * (sy / 2 - 0.35), z), (0.06, 0.4, 0.006), "hazY")
    for side, col in (((-1, 0), "steel"), ((1, 0), "steelD"), ((0, -1), "steelL"), ((0, 1), "steelD")):   # inner walls
        if side[0]:
            m.box((side[0] * (sx / 2 - 0.015), 0, z), (0.03, sy, depth), col)
        else:
            m.box((0, side[1] * (sy / 2 - 0.015), z), (sx, 0.03, depth), col)
    deck = core.Mesh("shuttle_deck_holdout")
    for cx, cy, w_, l_ in ((-(sx / 2 + 1.5), 0, 3, sy + 6), (sx / 2 + 1.5, 0, 3, sy + 6), (0, -(sy / 2 + 1.5), sx, 3), (0, sy / 2 + 1.5, sx, 3)):
        deck.box((cx, cy, z - 0.3), (w_, l_, depth + 0.3), "dark", base=True)
    ob = deck.build()
    ob.is_holdout = True
    return [m.build(), ob]


# Separate concept B: a broad utility lifter with full-chord folding wings.
# The earlier v4 model and its `shuttle()` entry point above are preserved.
TRANSPORT_HEIGHT = 2.64
TRANSPORT_PIT = 1.70
TRANSPORT_HATCH_HEIGHT = 1.6
from lib.transport_wings import (TRANSPORT_FOLD,TRANSPORT_WING_SPAN,
                                TRANSPORT_WING,TRANSPORT_OUTER_WING,transport_wing)


def transport_shuttle(heading,state="parked",dz=0,wing_fold=None):
    """Fresh concept B. Original v4 is unchanged. Origin is pad centre, feet at z=0.

    Parked/docked: broad outer wings fold 180 degrees flat over the aft hull.
    Flight span 7.2; each deployed wing covers 2.7 units of the hull length.
    Revision 4: full-chord wings, forward unobstructed hatch, detailed aft face.
    Height 2.64, suggested pit 1.70, leaving the highest point .94 above deck.
    No interior, pad, pit or bay geometry is part of this vehicle builder.
    """
    from lib.transport_forms import FlightFrame,loft,side_prism
    from lib.transport_details import cabin_details,rear_details
    fold=(0 if state=="fly" else TRANSPORT_FOLD) if wing_fold is None else wing_fold
    m=core.Mesh("transport_B_"+state)
    m.dz=dz
    f=FlightFrame(m,heading)
    # Fuller passenger/cargo cabin flows into a sloped, lower cockpit nose.
    loft(f,[(-2.15,.72,1.35,.75),(-1.70,.78,1.34,.66),
            (-.55,1.00,1.38,.92),(.86,1.05,1.31,.93,0,.90),
            (1.82,1.05,1.31,.93,0,.90),(2.18,.45,1.22,.20)],
         "gW1",omit=((3,6),))
    # Distinct dark lower keel, ending short of the wedge nose.
    loft(f,[(-1.9,.57,.65,.14),(-1.0,.83,.61,.16),
            (1.1,.70,.69,.18),(1.8,.34,.92,.12)],"steelD",upper="steelL")
    cabin_details(f,TRANSPORT_HATCH_HEIGHT)
    rear_details(f)
    for side in (-1,1):
        # A continuous shoulder/nacelle blends the wing root into the engine.
        shoulder=[(-2.04,.30,1.40,.62,side*1.36),(-1.45,.42,1.31,.50,side*1.24),
                (-.45,.46,1.30,.55,side*1.14),(.30,.25,1.42,.50,side*1.02),
                (.72,.14,1.48,.29,side*.96)]
        loft(f,shoulder[:-1] if side==-1 else shoulder,"gW1")
        v=side*1.38
        f.hcyl(-2.22,-2.05,v,1.31,.30,"steelD",r1=.28,sides=12)
        f.hcyl(-2.19,-2.17,v,1.31,.23,"dark",sides=12,capstart="dark")
        f.hcyl(-2.195,-2.185,v,1.31,.16,"cyan" if state=="fly" else "dark",
                sides=12,capstart="arc" if state=="fly" else "dark")
        # Full-length inner wings blend into the shoulder deck; outer wings fold over.
        side_prism(f,[(-1.72,1.45),(.35,1.55),(.30,2.30),(-1.62,2.30)],
                   side*.90,side*1.91,"gW1")
        f.box(-.68,side*1.89,2.26,1.86,.035,.08,"gW2",top="steelL")
        f.box(-.93,side*.94,2.26,1.18,.035,.08,"gW2",top="steelL")
        transport_wing(f,side,fold)
    if state=="parked":
        for u in (-1.45,1.24):
            for v in (-1.28,1.28):
                f.box(u,v,0,.40,.30,.07,"steelD",top="steelL")
                f.vcyl(u,v,.07,.06,.50,"steelL",sides=8)
                f.box(u,v,.42,.18,.18,.16,"gW2",top="gW1")
    # Retracted legs are entirely enclosed by the lower keel in flight/docking.
    lv=core.Mesh("transport_B_"+state+"_livery",flat=True)
    lv.dz=dz
    g=FlightFrame(lv,heading)
    for side in (-1,1):
        transport_wing(g,side,fold,True)
        for chain in (((-2.04,1.66),(-1.45,1.66),(-.45,1.60),(.30,1.27),(.72,1.10)),
                      ((.86,1.05),(1.82,1.05),(2.18,.45))):
            for (u0,v0),(u1,v1) in zip(chain,chain[1:]):
                if side==-1 and u0 in (.86,.30):
                    continue
                g.poly([g.pt(u0,side*(v0+.006),1.20),g.pt(u1,side*(v1+.006),1.20),
                        g.pt(u1,side*(v1+.006),1.30),g.pt(u0,side*(v0+.006),1.30)],"mkS",flip=True)
    g.box(1.335,-1.027,1.20,.72,.004,.10,"mkS")
    return [m.build(),lv.build()]
