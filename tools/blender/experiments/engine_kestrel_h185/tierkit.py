"""Kestrel Mk II / Mk III: the inboard fit-out of the deeper engine tiers (4x6, 4x7). Study stage (round 3).

The hull row, bulkhead and bell are the Mk I's. A tier cuts the cassette's inboard end off (`cut`: the Mk I faces
inboard of a u are dropped, the injector plate and pump crown armour with them) and grows its own machinery out of the
casing, down to the footprint's inboard edge at u = 2.5 - DEPTH. Built in final coordinates: the thrust axis at
model.THRUST_Z (read while the model is lowered for stage 8), the deck at z = 0, nothing above the 2.05 roof. Round
castings that continue the cassette go on `fs`, squashed about the axis like the cassette. Same family as Mk I: navy
and blue-grey castings, steel trim, brass gaskets and unions, the same fasteners. Tiers read by shape and equipment.

Concepts (round 3: each its own equipment vocabulary; the Mk I front is the family link):
  G  cryogenic feed: white insulated tanks with frost ribs, hi-vis bands, corrugated transfer hoses and a boil-off
     vent mast. Mk III: two upright dewars and a header, a heat-exchanger coil round the neck.
  H  magnetic injector: the casing's rear half gives way to a core in toroidal copper field rings on ceramic clamps,
     fed by a capacitor bank over catenary cables. Mk III: three rings, two banks, a plasma source box behind.
  I  electric drive: olive-drab drive motors with cooling fins, an exposed gear train behind a guard on a girder skid
     with hazard edges, a maintenance trolley beam. Mk III: twin motors, a flywheel and a longer skid.
"""
import math
import sys

from sprites import detail as D, greeble as G
from sprites.cmbkit import hazard_strip
from geometry import annulus, curved_pipe, sleeve, torus

CUT = -1.5              # the Mk I powerhead's faces inboard of this go (the injector plate, rear armour and clamps)
CUTS = {"H": {"powerhead": -0.75, "services": -0.75}}


def cut(variant, name):
    """u below which the Mk I's `name` mesh is dropped for this concept."""
    return CUTS.get(variant, {}).get(name, CUT if name == "powerhead" else -99)


def _m():
    return sys.modules["model"]


def sphere(f, u, v, z, r, mat, n=8, sides=16):
    """A sphere as stacked frustums along u."""
    for i in range(n):
        a, b = math.pi * i / n, math.pi * (i + 1) / n
        f.hcyl(u - r * math.cos(a), u - r * math.cos(b), v, z, max(r * math.sin(a), 0.01), mat,
               r1=max(r * math.sin(b), 0.01), sides=sides)


def lug(f, u, v):
    """A mounting lug bolted to the deck, as on the Mk I's cast supports."""
    f.box(u, v, 0, 0.34, 0.34, 0.16, "steel", top="plate")
    G.disc(f, "z", u, v, 0.16, 0.07, 0, 0.05, "steelD", sides=6)


def bolts(f, u, a, r, n=6, face="-u"):
    for k in range(n):
        t = k * math.tau / n + math.pi / n
        G.disc(f, face, r * math.cos(t), a + r * math.sin(t), u, 0.045, 0, 0.04, "plate", sides=6)


def neck(fs, a, u1, r1):
    """The casing, cut at CUT, closes down to radius r1 at u1, with a clamp ring and gasket over the joint."""
    sleeve(fs, [(CUT + 0.02, 0.93, a), (CUT - 0.2, 0.9, a), (CUT - 0.42, 0.8, a), (u1, r1, a)], "steelD", sides=32)
    annulus(fs, CUT - 0.1, CUT + 0.04, 0.8, 1.0, a, "steelD", "steelL", sides=16)
    annulus(fs, CUT - 0.14, CUT - 0.1, 0.82, 0.95, a, "brass", "gm", sides=24)
    for k in range(4):
        t = k * math.pi / 2 + math.pi / 4
        _m().petal(fs, [(CUT - 0.1, 0.99, a), (CUT + 0.2, 1.02, a)], t - 0.09, t + 0.09, "steelL", thick=0.13)


def drum(fs, a, u0, u1, r, rings=2):
    """A pre-burner drum on the axis (u0 its inboard end), domed, banded, its igniter boss on the dome."""
    fs.hcyl(u0, u1, 0, a, r, "navy", sides=32)
    sleeve(fs, [(u0 - 0.26, 0.2, a), (u0 - 0.18, r * 0.72, a), (u0 - 0.06, r * 0.96, a), (u0, r, a)], "steel", sides=32)
    for k in range(rings):
        u = u0 + (u1 - u0) * (k + 0.5) / rings
        annulus(fs, u - 0.06, u + 0.06, r - 0.02, r + 0.07, a, "blueGrey", "steelL", sides=32)
    fs.hcyl(u0 - 0.34, u0 - 0.26, 0, a, 0.13, "steelD", sides=10, capstart="brass")
    bolts(fs, u0 - 0.26, a, 0.17)


def pump(f, u0, u1, v, z, r, face):
    """A turbopump along u: suction bell at u0, barrel, volute at u1 (its discharge rising from the top)."""
    f.hcyl(u0 - 0.14, u0, v, z, r * 0.62, "steel", r1=r * 0.9, sides=16, capstart="dark")
    f.hcyl(u0, u1, v, z, r, "steelD", sides=16, cap="steelL")
    D.ribs(f, u0 + 0.12, u1 - 0.3, v, z, r, r, 3, thick=0.05, grow=0.03, mat="gm", sides=16)
    torus(f, u1 - 0.16, v, z, r * 1.02, r * 0.32, "navy", n=20, sides=8)
    f.hcyl(u1, u1 + 0.1, v, z, r * 0.7, "steel", sides=16, cap="blueGrey")           # turbine end cover
    G.hatch(f, face, (u0 + u1) / 2, z, v + math.copysign(r + 0.01, v), w=min(0.42, u1 - u0 - 0.3), h=r * 0.8)


def cradle(f, u0, u1, v, top, w=0.5):
    _m().prism(f, [(u0, 0), (u0, top - 0.1), (u0 + 0.12, top), (u1 - 0.12, top), (u1, top - 0.1), (u1, 0)],
               v - w / 2, v + w / 2, "navy", "blueGrey")
    for u in (u0 + 0.14, u1 - 0.14):
        lug(f, u, v + math.copysign(w / 2 + 0.12, v) if v else v)


def tank(f, u, v, z, r):
    """A spherical propellant tank on a ring cradle, a girth flange and a top fill boss."""
    f.vcyl(u, v, 0, r * 0.7, z - r * 0.7, "navy", top="blueGrey", sides=16)
    sphere(f, u, v, z, r, "steel", n=10, sides=20)
    f.vcyl(u, v, z - 0.03, r + 0.025, 0.06, "steelL", top="steelL", sides=20)
    f.vcyl(u, v, z + r - 0.05, 0.15, 0.1, "steelD", top="plate", sides=10)
    for k in (-1, 1):
        lug(f, u + k * (r * 0.7 + 0.1), v)




def capsule(f, u0, u1, v, z, r, mat, sides=24):
    """A horizontal tank along u with hemispherical ends."""
    f.hcyl(u0, u1, v, z, r, mat, sides=sides)
    n = 4
    for i in range(n):
        a, b = math.pi / 2 * i / n, math.pi / 2 * (i + 1) / n
        for end, sg in ((u0, -1), (u1, 1)):
            f.hcyl(end + sg * r * math.sin(a), end + sg * r * math.sin(b), v, z, r * math.cos(a), mat,
                   r1=max(r * math.cos(b), 0.02), sides=sides)


def helix(f, u0, u1, v, z, r, turns, rad=0.045, mat="steelL"):
    pts = []
    n = int(turns * 10)
    for i in range(n + 1):
        t = i / n
        a = t * turns * math.tau
        pts.append((u0 + (u1 - u0) * t, v + r * math.cos(a), z + r * math.sin(a)))
    curved_pipe(f, pts, rad, mat, steps=2, sides=8)


def gear(f, u0, u1, v, z, r, mat="steelL", teeth=16):
    """A spur gear in the v-z plane: a disc and its teeth."""
    f.hcyl(u0, u1, v, z, r, mat, sides=24, cap="steel", capstart="steel")
    f.hcyl(u0 - 0.02, u1 + 0.02, v, z, r * 0.3, "steelD", sides=12, cap="gm", capstart="gm")
    for k in range(teeth):
        t = k * math.tau / teeth
        f.box((u0 + u1) / 2, v + (r + 0.035) * math.cos(t), z + (r + 0.035) * math.sin(t), u1 - u0, 0.07, 0.07, mat,
              base=False)


# ---- G: cryogenic feed -----------------------------------------------------------------------------------------------

def _cryo_tank(f, u0, u1, z, r):
    capsule(f, u0, u1, 0, z, r, "medWhite")
    k = u0 + 0.15
    while k < u1 - 0.1:
        f.hcyl(k - 0.02, k + 0.02, 0, z, r + 0.02, "iceB", sides=24, cap="iceB", capstart="iceB")   # frost ribs
        k += 0.17
    for u in (u0 + 0.06, u1 - 0.06):
        f.hcyl(u - 0.05, u + 0.05, 0, z, r + 0.03, "hivis", sides=24, cap="hivis", capstart="hivis")
    for u in (u0 + 0.3, u1 - 0.3):                                                                # saddles
        f.box(u, 0, 0, 0.2, 1.0, z - r * 0.55, "steelD", top="steel")
        f.box(u, 0, z - r * 0.55, 0.22, r * 1.4, 0.08, "pocket", top="pocket")
        for side in (-1, 1):
            lug(f, u, side * 0.62)


def _hose(f, pts, r=0.075):
    curved_pipe(f, pts, r, "pocket", steps=6, sides=10)
    for p in (pts[0], pts[-1]):
        f.box(p[0], p[1], p[2], 0.12, 0.12, 0.12, "hivis", base=False)


def _vent(f, u, v, top, src):
    f.vcyl(u, v, 0, 0.12, 0.12, "steelD", top="steel", sides=10)
    f.vcyl(u, v, 0.12, 0.055, top - 0.12, "steelL", top="steelL", sides=8)
    f.box(u, v, 1.0, 0.16, 0.16, 0.2, "hivis", top="hivis")                          # relief valve
    D.seg(f, (u, v - 0.16, top), (u, v + 0.16, top), 0.05, "steelL", 8, cap="hivis", capstart="hivis")
    curved_pipe(f, [src, (src[0], src[1] + (v - src[1]) * 0.5, src[2] + 0.12), (u, v, top - 0.25)], 0.04, "steelL")


def cryo(f, fs, tier, a):
    neck(fs, a, -1.95, 0.45)
    fs.hcyl(-2.15, -1.95, 0, a, 0.45, "lvWS", sides=24, capstart="steelD")                      # insulated feed collar
    tz, tr = 1.02, 0.5
    _cryo_tank(f, -3.25 if tier == 2 else -3.1, -2.45, tz, tr)
    for side in (-1, 1):
        _hose(f, [(-2.6, side * 0.42, tz - 0.1), (-2.4, side * 0.66, 0.55), (-2.15, side * 0.7, 0.75),
                  (-2.05, side * 0.42, a - 0.12)])
    G.junction_box(f, "+v", -2.85, 0.45, 0.55, w=0.36, h=0.3, mat="lvW", lid="lens")
    if tier == 2:
        _vent(f, -3.3, 1.5, 1.92, (-2.9, 0.2, tz + tr))
        return
    helix(f, -2.75, -2.5, 0, tz, tr + 0.07, 2.5, mat="steelL")                                   # heat exchanger coil
    for side in (-1, 1):
        v = side * 0.95
        f.vcyl(-4.05, v, 0, 0.42, 1.2, "medWhite", top="medWhite", sides=20)                     # dewar
        f.vcyl(-4.05, v, 1.2, 0.42, 0.22, "medWhite", top="lvWL", rtop=0.2, sides=20)
        for z in (0.3, 0.55, 0.8):
            f.vcyl(-4.05, v, z, 0.44, 0.04, "iceB", top="iceB", sides=20)
        f.vcyl(-4.05, v, 1.02, 0.45, 0.08, "hivis", top="hivis", sides=20)
        f.vcyl(-4.05, v, 1.42, 0.08, 0.1, "steelD", top="steel", sides=8)
        f.box(-4.05, v, 0, 0.62, 0.62, 0.06, "steelD", top="steel")
    D.seg(f, (-4.05, -0.95, 1.6), (-4.05, 0.95, 1.6), 0.07, "steelL", 10, cap="steelL", capstart="steelL")   # header
    for vv in (-0.95, 0.95):
        D.seg(f, (-4.05, vv, 1.5), (-4.05, vv, 1.6), 0.07, "steelL", 10)
    _hose(f, [(-4.05, 0, 1.6), (-3.75, 0, 1.6), (-3.45, 0, tz + 0.2), (-3.25, 0, tz + 0.1)])
    _vent(f, -4.35, 0, 1.92, (-4.05, 0.3, 1.6))


# ---- H: magnetic injector --------------------------------------------------------------------------------------------

def _ring(f, u, a):
    torus(f, u, 0, a, 0.52, 0.17, "oM", n=32, sides=10)
    for k in range(8):
        t = k * math.tau / 8 + math.pi / 8
        f.box(u, 0.52 * math.cos(t), a + 0.52 * math.sin(t), 0.42, 0.13, 0.13, "lvW", top="lvWL", base=False)
    for side in (-1, 1):                                                                           # ceramic insulator legs
        v = side * 0.38
        for i in range(5):
            f.vcyl(u, v, 0.12 * i, 0.1 if i % 2 else 0.13, 0.12, "lvW" if i % 2 else "lvWS", top="lvWL", sides=10)
        f.box(u, v, 0.6, 0.22, 0.18, a - 0.6 - 0.36, "lvWS", top="lvW")


def _bank(f, v, u0, u1, rings):
    side = 1 if v > 0 else -1
    f.box((u0 + u1) / 2, v, 0, u1 - u0, 0.52, 0.16, "steelD", top="steel")
    hazard_strip(f, u0, u1, v + side * 0.23, 0.16)
    n = int((u1 - u0) / 0.38)
    for i in range(n):
        u = u0 + (u1 - u0) * (i + 0.5) / n
        f.vcyl(u, v, 0.16, 0.16, 0.7, "lvW", top="medRed", sides=12)
        f.vcyl(u, v, 0.4, 0.17, 0.05, "steelL", top="steelL", sides=12)
        f.vcyl(u, v, 0.86, 0.04, 0.06, "blueN", top="blueN", sides=6)                               # charge lamp
    for u in rings:
        curved_pipe(f, [(u, v, 0.92), (u, v - side * 0.28, 0.85), (u, side * 0.85, 0.9), (u, side * 0.6, a_hv(u))],
                    0.045, "hazK", steps=5, sides=8)


def a_hv(u):
    return _m().THRUST_Z - 0.1


def magnetic(f, fs, tier, a):
    j = CUTS["H"]["powerhead"]
    sleeve(fs, [(j + 0.02, 0.92, a), (j - 0.15, 0.82, a), (j - 0.3, 0.5, a), (j - 0.36, 0.34, a)], "steelD", sides=32)
    annulus(fs, j - 0.1, j + 0.05, 0.8, 1.0, a, "steelD", "steelL", sides=16)
    annulus(fs, j - 0.14, j - 0.1, 0.82, 0.95, a, "oL", "oD", sides=24)
    rings = [-1.45, -2.35] if tier == 2 else [-1.4, -2.2, -3.0]
    end = -2.85 if tier == 2 else -3.6
    f.hcyl(end, j - 0.3, 0, a, 0.3, "dark", sides=20)                                              # the core
    k = end + 0.2
    while k < j - 0.35:
        f.hcyl(k - 0.015, k + 0.015, 0, a, 0.32, "steelL", sides=20, cap="steelL", capstart="steelL")
        k += 0.12
    for u in rings:
        _ring(f, u, a)
    # Plasma source behind the core: a ceramic housing with a sight window.
    su = end - 0.3
    f.box(su, 0, 0, 0.55, 1.0, 0.3, "steelD", top="steel")
    f.box(su, 0, 0.3, 0.5, 0.86, a + 0.35 - 0.3, "lvW", top="lvWL")
    f.box(su - 0.26, 0, a - 0.1, 0.03, 0.4, 0.22, "lens", base=False)
    f.vcyl(su, 0, a + 0.35, 0.18, 0.08, "oM", top="oL", sides=12)
    banks = [1.5] if tier == 2 else [-1.5, 1.5]
    for v in banks:
        _bank(f, v, (-3.3 if tier == 2 else -4.3), -1.25, rings)
    if tier == 3:
        f.box(-4.05, 0, a + 0.45, 0.9, 1.0, 0.06, "steelD", top="steel")                          # cable tray
        for v in (-0.4, 0.4):
            f.box(-4.05, v, 0, 0.08, 0.08, a + 0.45, "steelD", top="steel")


# ---- I: electric drive -----------------------------------------------------------------------------------------------

def _motor(f, u0, u1, v, z, r):
    f.hcyl(u0, u1, v, z, r, "jacket", sides=20, cap="jacketD", capstart="jacketD")
    D.ribs(f, u0 + 0.08, u1 - 0.12, v, z, r, r, int((u1 - u0) / 0.09), thick=0.035, grow=0.045, mat="jacketD", sides=20)
    f.hcyl(u0 - 0.16, u0, v, z, r * 1.04, "jacketD", sides=20, capstart="dark")                     # fan cowl
    for k in range(3):
        f.hcyl(u0 - 0.17, u0 - 0.16, v, z, r * (0.3 + 0.25 * k), "steel", sides=20, capstart="steel")
    f.box((u0 + u1) / 2, v, z + r, 0.3, 0.26, 0.14, "jacketD", top="hazY")                          # terminal box
    for u in (u0 + 0.1, u1 - 0.1):
        f.box(u, v, 0, 0.16, r * 1.5, z - r * 0.6, "jacketD", top="jacket")


def _skid(f, u0, u1):
    for v in (-1.05, 1.05):
        f.box((u0 + u1) / 2, v, 0, u1 - u0, 0.2, 0.06, "jacketD", top="jacket")
        f.box((u0 + u1) / 2, v, 0.06, u1 - u0, 0.06, 0.16, "jacketD", top="jacketD")
        f.box((u0 + u1) / 2, v, 0.22, u1 - u0, 0.2, 0.05, "jacketD", top="jacket")
        hazard_strip(f, u0, u1, v + math.copysign(0.08, v), 0.27)
    n = max(2, int((u1 - u0) / 0.6))
    for i in range(n + 1):
        f.box(u0 + (u1 - u0) * i / n, 0, 0.06, 0.12, 2.0, 0.16, "jacketD", top="jacket")
    for u in (u0 + 0.1, u1 - 0.1):
        for v in (-1.32, 1.32):
            lug(f, u, v)


def _guard(f, u0, u1, z0, z1, w):
    for v in (-w, w):
        for z in (z0, z1):
            D.seg(f, (u0, v, z), (u1, v, z), 0.025, "hazY", 6)
        for u in (u0, u1, (u0 + u1) / 2):
            D.seg(f, (u, v, z0), (u, v, z1), 0.025, "hazY", 6)
    for u in (u0, u1):
        D.seg(f, (u, -w, z1), (u, w, z1), 0.025, "hazY", 6)


def _trolley(f, u0, u1):
    for u in (u0, u1):
        for v in (-1.7, 1.7):
            f.box(u, v, 0, 0.1, 0.1, 1.92, "hazY", top="hazY")
        f.box(u, 0, 1.86, 0.1, 3.5, 0.08, "jacketD", top="jacket")
    f.box((u0 + u1) / 2, 0, 1.92, u1 - u0 + 0.1, 0.12, 0.1, "jacketD", top="jacket")
    f.box(u0 + 0.35, 0, 1.72, 0.18, 0.18, 0.2, "hivis", top="hivis")                               # hoist block
    D.seg(f, (u0 + 0.35, 0, 1.72), (u0 + 0.35, 0, 1.45), 0.015, "steelL", 4)


def electric(f, fs, tier, a):
    neck(fs, a, -1.95, 0.42)
    f.hcyl(-2.1, -1.95, 0, a, 0.46, "steel", sides=20, capstart="steelD")                          # drive flange
    bolts(f, -2.1, a, 0.36, n=8)
    if tier == 2:
        _skid(f, -3.4, -1.9)
        _motor(f, -3.2, -2.55, 0, a, 0.46)
        f.hcyl(-2.55, -2.1, 0, a, 0.09, "steelL", sides=12)                                         # exposed shaft
        for u in (-2.45, -2.2):
            f.hcyl(u - 0.06, u + 0.06, 0, a, 0.2, "steel", sides=16, cap="steelD", capstart="steelD")
        _guard(f, -2.52, -2.12, a - 0.3, a + 0.3, 0.3)
        _trolley(f, -3.3, -2.3)
        return
    _skid(f, -4.4, -1.9)
    for side in (-1, 1):
        _motor(f, -4.3, -3.55, side * 0.62, 0.95, 0.38)
        f.hcyl(-3.55, -3.3, side * 0.62, 0.95, 0.07, "steelL", sides=10)
    # Gearbox: a cast case, open on top, two input pinions meshing with the output wheel on the axis.
    f.box(-3.0, 0, 0.3, 0.6, 2.05, 0.65, "jacket", top="jacketD")
    for side in (-1, 1):
        gear(f, -3.08, -2.92, side * 0.62, 0.95, 0.3)
    gear(f, -3.1, -2.9, 0, a, 0.4, mat="steelL", teeth=22)
    f.hcyl(-2.9, -2.1, 0, a, 0.09, "steelL", sides=12)
    # Flywheel on the output shaft, behind a guard.
    f.hcyl(-2.6, -2.45, 0, a, 0.66, "torn", sides=32, cap="steelD", capstart="steelD")
    f.hcyl(-2.62, -2.43, 0, a, 0.2, "steel", sides=16, cap="steelL", capstart="steelL")
    _guard(f, -2.75, -2.3, a - 0.72, a + 0.7, 0.75)
    _trolley(f, -4.2, -3.0)


VARIANTS = {"G": cryo, "H": magnetic, "I": electric}


def build(f, fs, tier, variant):
    """The tier's inboard fit-out on frame f (final coordinates); fs is a frame whose mesh the caller squashes about
    the thrust axis by model.CASSETTE_Z_FIT, as the cassette is, for castings that continue its round section."""
    VARIANTS[variant](f, fs, tier, _m().THRUST_Z)
