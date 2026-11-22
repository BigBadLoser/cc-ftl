"""Kestrel Mk II / Mk III: the inboard fit-out of the deeper engine tiers (4x6, 4x7). Study stage (round 4).

The hull row, bulkhead and bell are the Mk I's. A tier cuts the cassette's inboard end off (`cut`: the Mk I faces
inboard of a u are dropped, the injector plate and pump crown armour with them) and grows its own machinery out of the
casing, down to the footprint's inboard edge at u = 2.5 - DEPTH. Built in final coordinates: the thrust axis at
model.THRUST_Z (read while the model is lowered for stage 8), the deck at z = 0, nothing above the 2.05 roof. Round
castings that continue the cassette go on `fs`, squashed about the axis like the cassette. Same family as Mk I: navy
and blue-grey castings, steel trim, brass gaskets and unions, the same fasteners. Tiers read by shape and equipment.

Concepts (round 4: between round 2's Mk I vocabulary and round 3's new equipment; new systems are built in the house
castings (navy, blue-grey, steel, brass) with sparing new materials; each tier adds one clear step):
  J  magnetic injector: the rear half of the casing gives way to a core in copper-wound field rings in navy clamp
     shells, fed from capacitor cabinets over armoured cables. Mk II: two rings, one cabinet. Mk III: three rings,
     a cabinet each side, a plasma source housing behind.
  K  electric turbopumps: the casing necks into a pre-burner drum, two motor-driven turbopumps on cradles either side
     discharging into it. Mk III: bigger pumps and motors, a two-stage drum, a control cabinet and a hoist gantry.
  L  inline pump, cryogenic feed: a coaxial turbopump on the axis, a regenerative coil round its inducer, the turbine
     exhaust ducted along the deck to a dump. Mk III: a booster stage, an insulated saddle tank across the back and a
     boil-off vent.
"""
import math
import sys

from sprites import detail as D, greeble as G
from sprites.cmbkit import hazard_strip
from geometry import annulus, curved_pipe, sleeve, torus

CUT = -1.5              # the Mk I powerhead's faces inboard of this go (the injector plate, rear armour and clamps)
CUTS = {"J": {"powerhead": -0.75, "services": -0.75}, **{k: {"bed": 99} for k in ["Q", "R", "S", "T", "U", "V", "W", "X", "Y", "AA", "AB", "AC", "BA", "BB", "BC", "CA", "CB", "CD", "DA", "DB", "DC", "EA", "EB", "EC"]}, **{k: {"bed": 99, "services": -0.9} for k in ["FA", "FB", "FC", "GA", "GB", "GC", "HA", "HB", "HC", "IA", "IB", "IC", "JA", "JB", "JC", "KA"]}}


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




def hose(f, pts, r=0.075, mat="gm", end="brass"):
    curved_pipe(f, pts, r, mat, steps=6, sides=10)
    for p in (pts[0], pts[-1]):
        f.box(p[0], p[1], p[2], 0.13, 0.13, 0.13, end, base=False)


def gantry(f, u0, u1):
    """A maintenance hoist beam over the machine: navy posts with hazard-banded feet, a trolley and its block."""
    for u in (u0, u1):
        for v in (-1.75, 1.75):
            f.box(u, v, 0, 0.12, 0.12, 1.92, "navy", top="blueGrey")
            f.box(u, v, 0, 0.16, 0.16, 0.18, "hazY", top="hazK")
        f.box(u, 0, 1.84, 0.12, 3.6, 0.1, "navy", top="blueGrey")
    f.box((u0 + u1) / 2, 0, 1.93, u1 - u0 + 0.12, 0.14, 0.1, "steelD", top="steel")
    f.box(u0 + 0.3, 0, 1.74, 0.2, 0.2, 0.19, "steel", top="hazY")
    D.seg(f, (u0 + 0.3, 0, 1.74), (u0 + 0.3, 0, 1.48), 0.015, "steelL", 4)


# ---- J: magnetic injector --------------------------------------------------------------------------------------------

def field_ring(f, u, a):
    """Copper winding in eight navy clamp shells on a cast saddle, a small ceramic insulator under it."""
    torus(f, u, 0, a, 0.52, 0.16, "oM", n=32, sides=10)
    torus(f, u, 0, a, 0.52, 0.165, "oD", n=32, sides=4)          # (the winding's dark lay lines, through the copper)
    for k in range(8):
        t = k * math.tau / 8 + math.pi / 8
        f.box(u, 0.52 * math.cos(t), a + 0.52 * math.sin(t), 0.3, 0.17, 0.17, "navy", top="blueGrey", base=False)
        G.disc(f, "-u", 0.52 * math.cos(t), a + 0.52 * math.sin(t), u - 0.15, 0.035, 0, 0.03, "brass", sides=6)
    _m().prism(f, [(u - 0.2, 0), (u - 0.2, 0.35), (u - 0.12, 0.45), (u + 0.12, 0.45), (u + 0.2, 0.35), (u + 0.2, 0)],
               -0.55, 0.55, "navy", "blueGrey")
    f.vcyl(u, 0, 0.45, 0.12, 0.08, "lvW", top="lvWL", sides=10)
    f.vcyl(u, 0, 0.53, 0.09, a - 0.68 - 0.53, "steelD", top="steel", sides=10)


def cabinet(f, v, u0, u1, rings, a):
    """A navy capacitor cabinet on the deck: louvred front, charge lamps, brass terminals, armoured cables to the rings."""
    side = 1 if v > 0 else -1
    um = (u0 + u1) / 2
    f.box(um, v, 0, u1 - u0, 0.5, 0.95, "navy", top="blueGrey")
    D.slats(f, u0 + 0.12, u1 - 0.12, v + side * 0.25, 0.2, 0.6, 4, side)
    for i in range(3):
        u = u0 + 0.2 + i * 0.16
        f.box(u, v + side * 0.255, 0.8, 0.06, 0.02, 0.06, "blueN", base=False)
    for u in rings:
        f.vcyl(u, v - side * 0.12, 0.95, 0.06, 0.1, "brass", top="steelL", sides=8)
        hose(f, [(u, v - side * 0.12, 1.05), (u, v - side * 0.45, 1.1), (u, side * 0.75, a - 0.2), (u, side * 0.62, a - 0.08)],
             0.05, "gm", "brass")


def magnetic(f, fs, tier, a):
    j = CUTS["J"]["powerhead"]
    sleeve(fs, [(j + 0.02, 0.92, a), (j - 0.15, 0.82, a), (j - 0.3, 0.5, a), (j - 0.36, 0.34, a)], "steelD", sides=32)
    annulus(fs, j - 0.1, j + 0.05, 0.8, 1.0, a, "steelD", "steelL", sides=16)
    annulus(fs, j - 0.14, j - 0.1, 0.82, 0.95, a, "brass", "gm", sides=24)
    for k in range(4):
        t = k * math.pi / 2 + math.pi / 4
        _m().petal(fs, [(j - 0.1, 0.99, a), (j + 0.2, 1.02, a)], t - 0.09, t + 0.09, "steelL", thick=0.13)
    rings = [-1.4, -2.35] if tier == 2 else [-1.35, -2.1, -2.85]
    end = -2.85 if tier == 2 else -3.3
    f.hcyl(end, j - 0.3, 0, a, 0.3, "steelD", sides=20, capstart="steel")                         # the core
    k = end + 0.15
    while k < j - 0.35:
        f.hcyl(k - 0.015, k + 0.015, 0, a, 0.32, "blueGrey", sides=20, cap="blueGrey", capstart="blueGrey")
        k += 0.12
    for u in rings:
        field_ring(f, u, a)
    if tier == 2:
        bolts(f, end, a, 0.2)
        cabinet(f, 1.45, -3.3, -1.25, rings, a)
        return
    for v in (-1.45, 1.45):
        cabinet(f, v, -3.55, -1.25, rings, a)
    # Plasma source: a cast housing on the core's end, a sight window and a brass coupling.
    f.hcyl(end - 0.12, end, 0, a, 0.42, "brass", sides=20, capstart="steel")
    f.box(-3.85, 0, 0, 0.75, 1.05, 0.25, "steelD", top="steel")
    f.box(-3.85, 0, 0.25, 0.7, 0.95, 1.4, "navy", top="blueGrey")
    D.panel(f, -3.85, 0, 1.65, 0.5, 0.6, "blueGrey", t=0.02, ring=0.04, bolts=True)
    f.box(-4.2, 0, a - 0.1, 0.03, 0.42, 0.24, "lens", base=False)
    for v in (-0.3, 0.3):
        lug(f, -3.85, v * 2.2)


# ---- K: electric turbopumps ------------------------------------------------------------------------------------------

def motor(f, u0, u1, v, z, r, face):
    """A navy drive motor: ribbed frame, fan cowl and grille, terminal box, cast feet; brass coupling guard ahead."""
    f.hcyl(u0, u1, v, z, r, "navy", sides=20, cap="steelD")
    D.ribs(f, u0 + 0.06, u1 - 0.08, v, z, r, r, max(3, int((u1 - u0) / 0.09)), thick=0.035, grow=0.04, mat="blueGrey",
           sides=20)
    f.hcyl(u0 - 0.14, u0, v, z, r * 1.03, "steelD", sides=20, capstart="dark")
    for k in range(3):
        f.hcyl(u0 - 0.15, u0 - 0.14, v, z, r * (0.3 + 0.25 * k), "steel", sides=20, capstart="steel")
    G.junction_box(f, face, (u0 + u1) / 2, z + 0.05, v + math.copysign(r, v), w=0.26, h=0.22, mat="blueGrey", lid="steelL")
    for u in (u0 + 0.1, u1 - 0.1):
        f.box(u, v, 0, 0.14, r * 1.4, z - r * 0.6, "steelD", top="steel")
    f.hcyl(u1, u1 + 0.14, v, z, r * 0.55, "brass", sides=16, cap="brass")


def turbopumps(f, fs, tier, a):
    r = 0.66 if tier == 2 else 0.72
    neck(fs, a, -1.98, r)
    d0 = -2.9 if tier == 2 else -3.3
    drum(fs, a, d0, -1.98, r, rings=2 if tier == 2 else 3)
    if tier == 3:
        annulus(fs, -2.68, -2.6, r - 0.05, r + 0.12, a, "steelD", "steel", sides=32)
        annulus(fs, -2.6, -2.56, r - 0.02, r + 0.06, a, "brass", "gm", sides=32)
    pr, mr = (0.32, 0.28) if tier == 2 else (0.4, 0.36)
    pu0, pu1 = (-2.75, -2.05) if tier == 2 else (-2.95, -2.05)
    mu0 = -3.35 if tier == 2 else -4.0
    pz = 0.2 + pr + 0.06
    for side in (-1, 1):
        v = side * 1.3
        face = "+v" if side > 0 else "-v"
        cradle(f, mu0 + 0.05, pu1 - 0.1, v, pz - pr + 0.04)
        pump(f, pu0, pu1, v, pz, pr, face)
        motor(f, mu0, pu0 - 0.32, v, pz, mr, face)
        f.hcyl(pu0 - 0.18, pu0 - 0.14, v, pz, 0.08, "steelL", sides=10)
        curved_pipe(f, [(pu1 - 0.16, v, pz + pr + 0.1), (pu1 - 0.22, v, pz + pr + 0.42),
                        (pu1 - 0.45, side * (r + 0.42), a + 0.18), (pu1 - 0.55, side * (r - 0.05), a + 0.08)],
                    0.11, "steelL", steps=5, sides=12)
        D.flange(f, (pu1 - 0.53, side * (r + 0.08), a + 0.09), "v", 0.17, "brass", t=0.09)
    if tier == 3:
        # Control cabinet across the back, the motor feeds up into it, and a hoist gantry over the drive.
        f.box(-4.25, 0, 0, 0.4, 1.3, 1.25, "navy", top="blueGrey")
        D.panel(f, -4.45, 0, 0.75, 0.6, 0.9, "blueGrey", face="-u", t=0.02, ring=0.04, bolts=True)
        for v, z in ((-0.25, 1.0), (0.05, 1.0), (0.3, 0.9)):
            G.disc(f, "-u", v, z, -4.46, 0.06, 0, 0.03, "steelL", sides=10)
            G.disc(f, "-u", v, z, -4.49, 0.045, 0, 0.01, "lens", sides=10)
        for side in (-1, 1):
            hose(f, [(-4.05, side * 0.66, 0.9), (-4.0, side * 1.0, 0.95), (-3.7, side * 1.3, pz + mr + 0.06)], 0.045)
        gantry(f, -3.9, -2.4)


# ---- L: inline pump, cryogenic feed ----------------------------------------------------------------------------------

def inline(f, fs, tier, a):
    neck(fs, a, -1.95, 0.5)
    fs.hcyl(-2.25, -1.95, 0, a, 0.45, "steel", r1=0.5, sides=32)                                  # inducer housing
    helix(fs, -2.24, -1.97, 0, a, 0.56, 3, rad=0.05, mat="brass")                                  # regenerative coil
    torus(fs, -2.45, 0, a, 0.56, 0.26, "navy", n=28, sides=10)                                     # main volute
    fs.hcyl(-2.7, -2.25, 0, a, 0.5, "steelD", sides=32)
    stages, t0 = [(-2.45, 0.56)], -2.7
    if tier == 3:
        fs.hcyl(-3.15, -2.7, 0, a, 0.46, "steelD", sides=32)
        torus(fs, -2.95, 0, a, 0.5, 0.22, "navy", n=28, sides=10)                                  # booster volute
        annulus(fs, -2.76, -2.66, 0.44, 0.62, a, "steelD", "steelL", sides=16)
        stages.append((-2.95, 0.5))
        t0 = -3.15
    tu = t0 - 0.45
    fs.hcyl(tu, t0, 0, a, 0.6, "steelD", sides=32, capstart="steel")                               # turbine housing
    D.ribs(fs, tu + 0.08, t0 - 0.08, 0, a, 0.6, 0.6, 3, thick=0.05, grow=0.04, mat="blueGrey", sides=32)
    annulus(fs, t0 - 0.06, t0 + 0.04, 0.42, 0.68, a, "brass", "gm", sides=24)
    bolts(fs, tu, a, 0.42, n=8)
    for u, rr in stages:
        for side in (-1, 1):
            curved_pipe(f, [(u, side * (rr + 0.22), a + 0.05), (u + 0.25, side * (rr + 0.32), a + 0.25),
                            (CUT - 0.05, side * 0.8, a + 0.3)], 0.09, "steelL", steps=4, sides=10)
    ex = 1.62
    curved_pipe(f, [(tu + 0.25, 0.5, a - 0.1), (tu + 0.3, 1.15, a - 0.2), (tu + 0.45, ex, 0.7), (tu + 0.75, ex, 0.4)],
                0.17, "steel", steps=5, sides=12)
    f.hcyl(tu + 0.75, 0.85, ex, 0.4, 0.18, "steel", sides=12)
    for u in (tu + 0.95, -1.0, 0.2):
        D.flange(f, (u, ex, 0.4), "u", 0.24, "steelD", t=0.08)
        f.box(u, ex, 0, 0.14, 0.32, 0.22, "navy", top="blueGrey")
    f.box(1.05, ex, 0, 0.4, 0.5, 0.75, "navy", top="blueGrey")
    G.valve_wheel(f, "+v", 1.05, 0.5, ex + 0.25, r=0.11)
    cradle(f, tu + 0.05, -1.75, 0, a - 0.48, w=0.9)
    if tier == 2:
        for side in (-1, 1):
            hose(f, [(tu - 0.3, side * 0.55, 0.0), (tu - 0.3, side * 0.55, 0.5), (tu - 0.2, side * 0.3, a - 0.2),
                     (tu - 0.02, side * 0.2, a - 0.1)], 0.09, "gm", "steel")
        return
    # Insulated saddle tank across the back: navy jacket, frost ribs, a hi-vis relief valve on its boil-off vent.
    u, z, r = -4.05, 0.82, 0.46
    D.seg(f, (u, -1.25, z), (u, 1.25, z), r, "navy", 20)
    for side in (-1, 1):
        sphere(f, u, side * 1.25, z, r, "navy", n=8, sides=16)
        f.box(u, side * 0.85, 0, 0.6, 0.2, z - 0.2, "steelD", top="steel")
        lug(f, u + 0.4, side * 0.85)
    for vv in (-1.0, -0.55, -0.1, 0.35, 0.8):
        D.flange(f, (u, vv, z), "v", r + 0.03, "iceB", t=0.04)
    for vv in (-0.32, 0.58):
        D.flange(f, (u, vv, z), "v", r + 0.04, "blueGrey", t=0.08)
    for side in (-1, 1):
        hose(f, [(u + 0.38, side * 0.4, z - 0.1), (u + 0.5, side * 0.4, 0.45), (tu - 0.3, side * 0.3, a - 0.25),
                 (tu - 0.02, side * 0.2, a - 0.1)], 0.08, "gm", "brass")
    f.vcyl(u, 1.2, z + r - 0.05, 0.05, 1.9 - z - r + 0.05, "steelL", top="steelL", sides=8)       # boil-off vent
    f.box(u, 1.2, 1.55, 0.14, 0.14, 0.16, "hivis", top="hivis")
    D.seg(f, (u, 1.06, 1.9), (u, 1.34, 1.9), 0.045, "steelL", 8, cap="hivis", capstart="hivis")


VARIANTS = {"J": magnetic, "K": turbopumps, "L": inline}


def build(f, fs, tier, variant):
    """The tier's inboard fit-out on frame f (final coordinates); fs is a frame whose mesh the caller squashes about
    the thrust axis by model.CASSETTE_Z_FIT, as the cassette is, for castings that continue its round section."""
    if variant not in VARIANTS:
        import tier_r5
        import tier_r6
        import tier_r7
        import tier_r8
        import tier_r9
        import tier_r10
        import tier_r11
        import tier_r12
        import tier_r13
        import tier_r14
        import tier_r15
        import tier_r16
        import tier_r17
        import tier_r18
        import tier_r19
        VARIANTS.update({"M": tier_r5.bottle, "N": tier_r5.thermal, "P": tier_r5.turbo,
                         "Q": tier_r6.nested, "R": tier_r6.rings, "S": tier_r6.turbo,
                         "T": tier_r7.ring_drive, "U": tier_r7.pump_crown, "V": tier_r7.turbo_compound,
                         "W": tier_r8.ring_drive, "X": tier_r8.pump_crown, "Y": tier_r8.hybrid,
                         "AA": tier_r9.sponsons, "AB": tier_r9.bottle, "AC": tier_r9.everything,
                         "BA": tier_r10.twin, "BB": tier_r10.armoured, "BC": tier_r10.open_frame,
                         "CA": tier_r11.telescoping, "CB": tier_r11.radial, "CD": tier_r11.fin_stack,
                         "DA": tier_r12.sponsons_first, "DB": tier_r12.growing_bottle, "DC": tier_r12.flagship,
                         "EA": tier_r13.plenum, "EB": tier_r13.transverse, "EC": tier_r13.power_core,
                         "FA": tier_r14.plenum, "FB": tier_r14.transverse, "FC": tier_r14.power_core,
                         "GA": tier_r15.feed_station, "GB": tier_r15.pump_bay, "GC": tier_r15.operator_step,
                         "HA": tier_r16.yoke, "HB": tier_r16.terraces, "HC": tier_r16.prow,
                         "IA": tier_r17.keel, "IB": tier_r17.tank, "IC": tier_r17.vault,
                         "JA": tier_r18.sphere, "JB": tier_r18.bottle, "JC": tier_r18.standing,
                         "KA": tier_r19.bottle_plumbed})
    VARIANTS[variant](f, fs, tier, _m().THRUST_Z)
