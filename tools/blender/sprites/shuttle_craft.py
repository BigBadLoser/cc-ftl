"""The SHUTTLE: the small craft crew ride between ships (vehicle art only; the bay it parks in is a separate module).

Local frame (cmbkit style): u along the length (+u = nose), v across, z up, origin at the centre of the footprint on the
PAD surface (z = 0). `Spin(heading)` turns the model to any heading in grid space; `rot_heading` gives the four parked
bay rotations (r0 nose -y, r1 +x, r2 +y, r3 -x, like the modules) and `fly_heading` the eight sim facings (d0 = +x,
counter-clockwise in grid space, d2 = +y; the crew sheet convention).

Shape: a wide chamfered lower hull with a raised cabin on top, a bubble canopy set low on the starboard (+v) side of
the nose with a blunt sensor block beside it, one big round main nozzle in a rear engine block, twin fins, a sliding
door on each side opening onto the lower hull's ledge. Footprint 3.8 (u -2.05..1.75) by 2.5 tiles. Heights (pad = 0):
belly BELLY, lower hull to 1.0, roofline ROOF, fin tips TOP. Legs down = parked. The bay's pit must be at least
TOP - roofs.ZR deep for the roof slab; PIT_SUGGESTED sinks most of the body below the deck.

Livery: flat panels in the roof-livery key colours mkP (primary) / mkS (secondary), rendered unlit so the renderer
can match them exactly; the base hull is light grey (gW1). Curved parts (canopy, nozzle) use smooth custom normals
(`smooth`) so they shade as bands, not facets. Every detail is >= 0.05 tiles (2 px at game scale)."""
import math
import numpy as np
from mathutils import Vector
from . import core, detail as D, cmbkit
from .cmbkit import Frame

ROOF = 1.85            # roofline (cabin top)
TOP = 2.15             # highest point (fin tips)
BELLY = 0.40           # ground clearance on the legs
PIT_SUGGESTED = 1.1    # pit depth for the bay: roof at 0.75 and fins at 1.05 above the deck, under the roof slab (2.05)
LW, CW = 1.2, 0.95     # lower hull / cabin half widths
U0, U1 = -1.75, 1.3    # lower hull slab along u (rear face .. nose taper start)
NOSE = 1.75            # nose tip
CU0, CU1 = -1.65, 0.9  # cabin along u
CV = 0.3               # canopy centre line (starboard offset)
NOZ_Z, NOZ_R = 1.05, 0.45
GLOW = "cyan"          # nozzle glow (the ship's drives glow cyan too)
SMOOTH_DEG = 35        # edges sharper than this stay hard


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


def tube(f, stations, mat):
    """Loft a hull section through stations (u, half width, z bottom, z top, v centre) along u."""
    for s0, s1 in zip(stations, stations[1:]):
        def corner(a, b, d, s0=s0, s1=s1):
            u, hw, zb, zt, v0 = s0 if a < 0 else s1
            return (u, v0 + b * hw, zb if d < 0 else zt)
        D.loft_box(f, corner, mat)


def smooth(ob, angle=SMOOTH_DEG):
    """Merge coincident vertices and set custom split normals: faces meeting at less than `angle` shade smoothly
    (cylinders, the canopy), sharper edges stay hard. The quantised bands then follow curves instead of facets."""
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


def body(f, legs, glow, damaged=False):
    hull = "gW1"
    _g("hull")                                                                    # lower hull: chamfered belly, slab, nose taper
    D.loft_box(f, lambda a, b, d: ((-1.5 if a < 0 else 1.1) if d < 0 else (U0 if a < 0 else U1), b * (0.9 if d < 0 else LW),
                                   BELLY if d < 0 else 0.6), "steel")
    tube(f, [(U0, LW, 0.6, 1.0, 0), (U1, LW, 0.6, 1.0, 0), (NOSE, 0.88, 0.72, 1.0, 0)], "plate")
    _g("cabin")
    f.box((CU0 + CU1) / 2, 0, 1.0, CU1 - CU0, 2 * CW, 0.65, hull)
    D.loft_box(f, lambda a, b, d: ((CU0 if a < 0 else CU1) if d < 0 else (-1.5 if a < 0 else 0.75), b * (CW if d < 0 else 0.75),
                                   1.65 if d < 0 else ROOF), hull)
    _g("canopy")                                                                  # bubble canopy on a framed sill
    st = [(CU1, 0.55, 1.62, CV), (1.2, 0.53, 1.52, CV), (1.4, 0.48, 1.4, CV), (1.55, 0.4, 1.3, CV), (1.72, 0.25, 1.2, CV)]
    tube(f, [(u, hw, 1.0, 1.15, v0) for u, hw, zt, v0 in st], "plate")
    tube(f, [(u, hw, 1.15, zt, v0) for u, hw, zt, v0 in st[:2]], "glassD")
    tube(f, [(u, hw, 1.15, zt, v0) for u, hw, zt, v0 in st[1:3]], "lens")         # one reflection band
    tube(f, [(u, hw, 1.15, zt, v0) for u, hw, zt, v0 in st[2:]], "glassD")
    _g("nose")                                                                    # blunt sensor block beside the canopy
    D.loft_box(f, lambda a, b, d: (CU1 if a < 0 else 1.55, -0.63 + b * 0.35, 1.0 if d < 0 else (1.38 if a < 0 else 1.22)), hull)
    D.seg(f, (1.54, -0.63, 1.12), (1.57, -0.63, 1.12), 0.1, "lens", 10, cap="lens")  # searchlight
    f.box(1.1, -0.63, 1.38, 0.2, 0.2, 0.06, "steelD", top="dark")                  # sensor
    _g("engine")                                                                  # rear block with the main nozzle
    f.box(-1.82, 0, 0.6, 0.3, 2 * 1.0, 0.95, "steelL", top="plate")
    f.hcyl(-1.97, -2.05, 0, NOZ_Z, NOZ_R, "steelD", r1=NOZ_R + 0.05, sides=16)       # lip
    f.hcyl(-1.9, -1.97, 0, NOZ_Z, NOZ_R, "gm", sides=16)                            # throat
    f.hcyl(-1.98, -2.0, 0, NOZ_Z, NOZ_R - 0.02, "dark", sides=16, cap="dark", capstart="dark")   # liner floor
    f.hcyl(-2.0, -2.01, 0, NOZ_Z, 0.26, glow, sides=12, cap="arc" if glow != "dark" else "dark")   # core
    for k in range(4):                                                            # vanes across the mouth
        ang = k * math.pi / 2 + math.pi / 4
        c, s_ = math.cos(ang), math.sin(ang)
        D.seg(f, (-2.03, 0, NOZ_Z), (-2.03, (NOZ_R + 0.02) * c, NOZ_Z + (NOZ_R + 0.02) * s_), 0.035, "steelL", 4)
    D.seg(f, (-2.0, 0, NOZ_Z), (-2.05, 0, NOZ_Z), 0.09, "steelD", 8, cap="steelL")     # hub
    for sv in (-1, 1):                                                            # rcs thruster blocks on the rear corners
        f.box(-1.75, sv * 1.1, 1.55, 0.2, 0.2, 0.14, "steelD", top="gm")
    _g("fins")                                                                    # twin swept fins
    for sv in (-1, 1):
        D.loft_box(f, lambda a, b, d, sv=sv: ((-1.5 if a < 0 else -0.95), sv * 0.55 + b * 0.035,
                                              ROOF if d < 0 else (TOP if a < 0 else 1.98)), "plate")
    _g("door")                                                                    # sliding doors (rose, like the ship's doors)
    for sv in (-1, 1):
        f.box(-0.55, sv * (CW + 0.01), 1.3, 0.72, 0.02, 0.56, "dark", base=False)
        f.box(-0.55, sv * (CW + 0.03), 1.3, 0.62, 0.03, 0.5, "rM", base=False)
        f.box(-0.55, sv * (CW + 0.05), 1.47, 0.62, 0.014, 0.07, "rH", base=False)
        f.box(-0.55, sv * (CW + 0.05), 1.3, 0.014, 0.014, 0.4, "rD", base=False)  # seam between the leaves
        f.box(-0.55, sv * (CW + 0.05), 1.25, 0.26, 0.014, 0.1, "glassD", base=False)
        f.box(-0.55, sv * (CW + 0.05), 1.08, 0.62, 0.014, 0.05, "hazY", base=False)
        for k in range(6):                                                        # hazard strip on the ledge
            f.box(-0.85 + k * 0.12, sv * 1.1, 1.0, 0.12, 0.14, 0.012, "hazY" if k % 2 == 0 else "hazK")
    _g("greeble")
    for sv in (-1, 1):                                                            # armour plates on the cabin sides
        f.box(0.35, sv * (CW + 0.015), 1.3, 0.8, 0.03, 0.4, "plate", base=False)
        f.box(-1.35, sv * (CW + 0.015), 1.3, 0.45, 0.03, 0.4, "plate", base=False)
        f.box(0.35, sv * (CW + 0.03), 1.18, 0.6, 0.012, 0.045, "steelD", base=False)   # seam lines
        f.box(1.15, sv * 1.05, 1.0, 0.2, 0.2, 0.14, "steelD", top="gm")             # front rcs blocks
    f.vcyl(-0.3, -0.5, ROOF, 0.22, 0.05, "plate", top="steelL", sides=12)         # dorsal hatch
    f.vcyl(-0.3, -0.5, ROOF + 0.05, 0.16, 0.04, "steelL", top="plate", sides=12)
    f.vcyl(0.45, -0.55, ROOF, 0.045, 0.18, "steelL", sides=6)                     # antenna
    f.box(0.45, -0.55, ROOF + 0.18, 0.09, 0.09, 0.07, "dark")
    f.box(-0.4, 0.45, ROOF, 0.9, 0.045, 0.008, "steelD")                          # roof seam
    if legs:
        _g("legs")
        for su in (-1.0, 1.0):
            for sv in (-0.75, 0.75):
                f.vcyl(su, sv, 0.0, 0.16, 0.05, "steelD", top="steel", sides=8)
                f.vcyl(su, sv, 0.05, 0.055, BELLY - 0.03, "steelL", sides=6)
                f.box(su, sv, 0.2, 0.14, 0.14, 0.12, "gm", top="plate")
    if damaged:
        _g("damage")
        f.box(0.5, CW + 0.04, 1.25, 0.5, 0.012, 0.32, "grime", base=False)       # scorch over a plate, a torn panel
        f.box(-0.9, 0, ROOF + 0.012, 0.5, 0.42, 0.012, "grime")
        f.box(0.3, -(LW + 0.006), 0.8, 0.35, 0.012, 0.25, "dark", base=False)
        f.box(-1.2, -0.56, TOP - 0.1, 0.3, 0.1, 0.012, "dark")                    # a chipped fin tip


def livery(f):
    """Flat key-colour panels (f over a flat Mesh): roof stripe (P) with S edges, lower hull bands (S), fin flashes (P)."""
    _g("livery")
    f.box(-0.4, 0, ROOF + 0.004, 2.1, 0.36, 0.012, "mkP")
    for sv in (-1, 1):
        f.box(-0.4, sv * 0.24, ROOF + 0.004, 2.1, 0.12, 0.012, "mkS")
        f.box(-0.2, sv * (LW + 0.006), 0.85, 2.6, 0.012, 0.14, "mkS", base=False)
        f.box(-1.22, sv * 0.595, 2.0, 0.5, 0.012, 0.09, "mkP", base=False)
    f.box(1.52, -0.63, 1.3, 0.012, 0.5, 0.06, "mkP", base=False)                  # nose block flash


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


ALLOW = [("cabin", "hull"), ("canopy", "hull"), ("canopy", "cabin"), ("nose", "hull"), ("nose", "cabin"), ("engine", "hull"),
         ("engine", "cabin"), ("fins", "cabin"), ("door", "cabin"), ("door", "hull"), ("legs", "hull"),
         ("greeble", "hull"), ("greeble", "cabin"), ("greeble", "nose"), ("greeble", "engine"), ("greeble", "canopy"),
         ("livery", "hull"), ("livery", "cabin"), ("livery", "fins"), ("livery", "nose"), ("livery", "greeble"), ("livery", "engine"),
         ("damage", "hull"), ("damage", "cabin"), ("damage", "livery"), ("damage", "greeble"), ("damage", "fins")]


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
