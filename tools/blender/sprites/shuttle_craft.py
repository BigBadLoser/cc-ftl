"""The SHUTTLE: the small craft crew ride between ships (vehicle art only; the bay it parks in is a separate module).

Local frame (cmbkit style): u along the length (+u = nose), v across, z up, origin at the centre of the footprint on the
PAD surface (z = 0). `Spin(heading)` turns the model to any heading in grid space; `rot_heading` gives the four parked
bay rotations (r0 nose -y, r1 +x, r2 +y, r3 -x, like the modules) and `fly_heading` the eight sim facings (d0 = +x,
counter-clockwise in grid space, d2 = +y; the crew sheet convention).

Shape (v3, rounded): a fuselage swept from a rounded-rectangle cross-section (superellipse, `sweep`) that droops and
narrows into the nose, with a wraparound canopy; it sits in a wide rounded skirt that carries the landing legs; a rear
shroud holds one big vaned main nozzle; twin swept fins on top. Port (-v) side: a round AIRLOCK HATCH with a docking
collar (the bay / another hull mates here); starboard (+v) side: a rose sliding door. Footprint 4.0 (u -2.14..1.85) by
2.6 tiles. Heights (pad = 0): belly BELLY, skirt to 1.02, roofline ROOF, fin tips TOP. Legs down = parked. The bay's
pit must be at least TOP - roofs.ZR deep for the roof slab; PIT_SUGGESTED sinks most of the body below the deck.

Livery: flat panels in the roof-livery key colours mkP (primary) / mkS (secondary), rendered unlit so the renderer
can match them exactly; the base hull is light grey (gW1). Curved parts use smooth custom normals (`smooth`) so they
shade as bands, not facets. Every detail is >= 0.05 tiles (2 px at game scale)."""
import math
import numpy as np
from mathutils import Vector
from . import core, detail as D, cmbkit
from .cmbkit import Frame

ROOF = 1.8             # roofline (fuselage top)
TOP = 2.15             # highest point (fin tips)
BELLY = 0.42           # ground clearance on the legs (skirt bottom)
PIT_SUGGESTED = 1.1    # pit depth for the bay: roof at 0.7 and fins at 1.05 above the deck, under the roof slab (2.05)
NZ, NR = 1.1, 0.42     # main nozzle centre height / throat radius
HATCH = (-0.55, 1.32)  # airlock hatch centre (u, z) on the port side
GLOW = "cyan"          # nozzle glow (the ship's drives glow cyan too)
SMOOTH_DEG = 35        # edges sharper than this stay hard
PROF_N, PROF_P = 20, 4 # cross-section sampling / superellipse power (4 = rounded rectangle; corners < 29 deg)

# fuselage stations (u, half width, half height, v centre, z centre): flat amidships, drooping narrowing nose
FUSE = [(-1.75, 1.0, 0.6, 0, 1.1), (-1.2, 1.1, 0.68, 0, 1.12), (0.4, 1.1, 0.68, 0, 1.12), (1.1, 1.0, 0.58, 0, 1.02),
        (1.6, 0.75, 0.4, 0, 0.9), (1.85, 0.45, 0.22, 0, 0.82)]
SKIRT = [(-1.8, 1.05, 0.28, 0, 0.72), (-1.4, 1.3, 0.3, 0, 0.72), (0.7, 1.3, 0.3, 0, 0.72), (1.5, 0.95, 0.26, 0, 0.74)]
SHROUD = [(-2.05, 0.8, 0.62, 0, NZ), (-1.95, 0.84, 0.64, 0, NZ), (-1.7, 0.84, 0.64, 0, NZ)]


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


def airlock(f, u, z):
    """Round docking hatch on the port side: collar sunk into the hull, rim ring, door with a window, four lugs."""
    D.seg(f, (u, -0.85, z), (u, -1.2, z), 0.36, "steelL", 16, cap="plate")
    D.seg(f, (u, -1.2, z), (u, -1.23, z), 0.31, "plate", 16, cap="steelD")
    D.seg(f, (u, -1.2, z), (u, -1.25, z), 0.26, "steel", 16, cap="steelL")
    D.seg(f, (u, -1.25, z), (u, -1.265, z), 0.08, "glassD", 10, cap="glassD")
    f.box(u, -1.26, z - 0.17, 0.3, 0.02, 0.05, "hazY", base=False)
    for a in (45, 135, 225, 315):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        f.box(u + 0.3 * c, -1.24, z + 0.3 * s, 0.07, 0.03, 0.07, "plate", base=False)


def body(f, legs, glow, damaged=False):
    hull = "gW1"
    _g("skirt")
    sweep(f, SKIRT, profile(), "plate", cap0="plate", cap1="plate")
    _g("hull")
    sweep(f, FUSE, profile(), hull, cap0=hull, cap1=hull)
    _g("shroud")
    sweep(f, SHROUD, profile(), "steelL", cap0="steel")
    _g("nozzle")
    f.hcyl(-2.14, -2.04, 0, NZ, NR + 0.05, "steelD", r1=NR, sides=16)              # flared lip
    f.hcyl(-2.04, -1.98, 0, NZ, NR, "gm", sides=16)                                 # throat
    f.hcyl(-2.08, -2.06, 0, NZ, NR - 0.02, "dark", sides=16, cap="dark", capstart="dark")   # liner floor
    f.hcyl(-2.09, -2.08, 0, NZ, 0.26, glow, sides=12, capstart="arc" if glow != "dark" else "dark")   # core
    for k in range(4):                                                            # vanes across the mouth
        a = k * math.pi / 2 + math.pi / 4
        D.seg(f, (-2.11, 0, NZ), (-2.11, (NR + 0.03) * math.cos(a), NZ + (NR + 0.03) * math.sin(a)), 0.035, "steelL", 4)
    D.seg(f, (-2.08, 0, NZ), (-2.13, 0, NZ), 0.09, "steelD", 8, cap="steelL")      # hub
    _g("canopy")                                                                  # wraparound windscreen on the nose
    patch(f, FUSE, 1.1, 1.75, 30, 150, 1.015, "plate", n=11, steps=5)
    patch(f, FUSE, 1.15, 1.7, 38, 142, 1.03, "glassD", n=11, steps=5)
    patch(f, FUSE, 1.3, 1.42, 40, 140, 1.04, "lens", n=11, steps=2)               # one reflection band
    _g("fins")                                                                    # twin swept fins
    for sv in (-1, 1):
        D.loft_box(f, lambda a, b, d, sv=sv: ((-1.5 if a < 0 else -0.95), sv * 0.5 + b * 0.035,
                                              1.72 if d < 0 else (TOP if a < 0 else 2.0)), "plate")
    _g("hatch")
    airlock(f, *HATCH)
    _g("door")                                                                    # starboard sliding door (rose)
    u, z = HATCH[0], 1.25
    f.box(u, 1.1, z, 0.72, 0.04, 0.44, "dark", base=False)
    f.box(u, 1.135, z, 0.62, 0.03, 0.38, "rM", base=False)
    f.box(u, 1.155, z + 0.13, 0.62, 0.014, 0.06, "rH", base=False)
    f.box(u, 1.155, z, 0.045, 0.014, 0.3, "rD", base=False)                       # seam between the leaves
    f.box(u, 1.155, z - 0.03, 0.26, 0.014, 0.09, "glassD", base=False)
    f.box(u, 1.155, z - 0.16, 0.62, 0.014, 0.05, "hazY", base=False)
    _g("greeble")
    for sv, (t0, t1) in ((1, (-22, 22)), (-1, (158, 202))):                        # raised side panels ahead of the doors
        patch(f, FUSE, 0.05, 0.85, t0, t1, 1.02, "plate", n=7, steps=3)
        f.box(0.45, sv * 1.126, 1.12, 0.6, 0.012, 0.045, "steelD", base=False)    # seam line on the panel
    for sv in (-1, 1):                                                            # rcs blocks on the skirt corners
        f.box(1.1, sv * 1.1, 0.96, 0.2, 0.2, 0.14, "steelD", top="gm")
        f.box(-1.55, sv * 1.1, 0.96, 0.2, 0.2, 0.14, "steelD", top="gm")
    f.vcyl(-0.3, 0, ROOF - 0.01, 0.22, 0.05, "plate", top="steelL", sides=12)     # dorsal hatch
    f.vcyl(-0.3, 0, ROOF + 0.04, 0.16, 0.04, "steelL", top="plate", sides=12)
    f.vcyl(0.5, -0.55, ROOF - 0.03, 0.045, 0.2, "steelL", sides=6)                # antenna
    f.box(0.5, -0.55, ROOF + 0.17, 0.09, 0.09, 0.07, "dark")
    f.box(0.2, 0.42, ROOF - 0.004, 0.9, 0.045, 0.008, "steelD")                   # roof seam
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
        f.box(-1.2, -0.51, TOP - 0.1, 0.3, 0.1, 0.012, "dark")                    # chipped fin tip


def livery(f):
    """Flat key-colour panels (f over a flat Mesh): roof stripe (P) with S edges, skirt bands (S), fin + shroud flashes (P)."""
    _g("livery")
    f.box(-0.5, 0, ROOF - 0.004, 2.0, 0.36, 0.012, "mkP")
    for sv in (-1, 1):
        f.box(-0.5, sv * 0.24, ROOF - 0.004, 2.0, 0.12, 0.012, "mkS")
        f.box(-0.35, sv * 1.306, 0.72, 2.0, 0.012, 0.14, "mkS", base=False)
        f.box(-1.22, sv * 0.545, 1.93, 0.5, 0.012, 0.06, "mkP", base=False)
        f.box(-1.85, sv * 0.846, NZ, 0.25, 0.012, 0.08, "mkP", base=False)


def shuttle(heading, state="parked", damaged=False, dz=0.0):
    """state: parked (legs down, nozzle dark), fly (legs up, nozzle glowing), docked (legs up, nozzle dark).
    dz shifts the whole craft (a parked one sits at -pit depth)."""
    legs = state == "parked"
    glow = GLOW if state == "fly" else "dark"
    m = core.Mesh(f"shuttle_{state}")
    m.dz = dz
    body(Spin(m, heading), legs, glow, damaged)
    lv = core.Mesh(f"shuttle_{state}_livery", flat=True)
    lv.dz = dz
    livery(Spin(lv, heading))
    return [smooth(m.build()), lv.build()]


ALLOW = [("hull", "skirt"), ("shroud", "hull"), ("shroud", "skirt"), ("nozzle", "shroud"), ("canopy", "hull"), ("fins", "hull"),
         ("hatch", "hull"), ("hatch", "skirt"), ("door", "hull"), ("legs", "skirt"),
         ("greeble", "hull"), ("greeble", "skirt"), ("greeble", "canopy"),
         ("livery", "hull"), ("livery", "skirt"), ("livery", "fins"), ("livery", "shroud"), ("livery", "greeble"),
         ("damage", "hull"), ("damage", "skirt"), ("damage", "livery"), ("damage", "greeble"), ("damage", "fins")]


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
