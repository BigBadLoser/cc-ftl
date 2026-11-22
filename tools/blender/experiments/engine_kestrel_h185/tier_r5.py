"""Kestrel tier fit-out study, round 5 (see tierkit.py for the frame, the cut and the shared parts).

  M  containment bottle: the casing necks into an injector stem fed from a magnetic bottle, a steel sphere banded in
     copper on a cast pedestal. Mk III: a bigger bottle in a gimbal cage on trunnions, two cryo-coolers on it.
  N  thermal loop: a cast heat-exchanger header behind the casing, a bank of U-tubes over it, a coolant pump.
     Mk III: a longer header with two tube banks and side fins, a pressuriser vessel and a second pump.
  P  turbo-compound: the pre-burner drum is boosted by a turbocharger on the deck, its turbine driven by hot gas bled
     along the engine's flank from the chamber. Mk III: a turbo each side, a two-stage drum and an intercooler.
"""
import math

from mathutils import Vector

from sprites import detail as D, greeble as G
from geometry import curved_pipe, annulus
import tierkit as T

AX = {"u": ((0, 1, 0), (0, 0, 1), (1, 0, 0)), "v": ((0, 0, 1), (1, 0, 0), (0, 1, 0)), "z": ((1, 0, 0), (0, 1, 0), (0, 0, 1))}


def ring(f, c, axis, R, r, mat, n=28, sides=8):
    """A torus centred on c (u, v, z) around a local axis."""
    e1, e2, ax = (Vector(x) for x in AX[axis])
    c = Vector(c)

    def p(t, s):
        q = c + (R + r * math.cos(s)) * (e1 * math.cos(t) + e2 * math.sin(t)) + ax * (r * math.sin(s))
        return f.pt(q.x, q.y, q.z)
    for i in range(n):
        t, a = i * math.tau / n, (i + 1) * math.tau / n
        for j in range(sides):
            s, b = j * math.tau / sides, (j + 1) * math.tau / sides
            f.poly([p(t, s), p(a, s), p(a, b), p(t, b)], mat, flip=True)


# ---- M: containment bottle -------------------------------------------------------------------------------------------

def bottle(f, fs, tier, a):
    T.neck(fs, a, -1.95, 0.38)
    big = tier == 3
    cu, cz, r = (-2.98, 1.12, 0.5) if not big else (-3.6, 1.15, 0.66)
    # Injector stem: from the bottle to the casing, a brass flange at the neck and a valve block on it.
    f.hcyl(cu + r - 0.05, -1.95, 0, a, 0.17, "steel", sides=16)
    f.hcyl(-2.08, -1.98, 0, a, 0.3, "brass", sides=16, cap="steelL", capstart="steelL")
    f.box(-2.35 if not big else -2.55, 0, a - 0.26, 0.3, 0.44, 0.48, "navy", top="blueGrey")
    G.valve_wheel(f, "+v", -2.35 if not big else -2.55, a, 0.23, r=0.1)
    # The bottle: steel sphere, copper bands, navy clamp blocks, a cast pedestal.
    f.vcyl(cu, 0, 0, 0.42, 0.25, "steelD", top="steel", sides=16)
    f.vcyl(cu, 0, 0.25, 0.28, cz - r - 0.2, "navy", top="blueGrey", sides=16)
    T.sphere(f, cu, 0, cz, r, "steel", n=12, sides=24)
    ring(f, (cu, 0, cz), "z", r + 0.02, 0.07, "oM", n=32)
    ring(f, (cu, 0, cz), "u", r + 0.02, 0.06, "oM", n=32)
    for k in range(6):
        t = k * math.tau / 6
        f.box(cu + (r + 0.04) * math.cos(t), (r + 0.04) * math.sin(t), cz, 0.14, 0.14, 0.2, "navy", top="blueGrey",
              base=False)
    for k in (-1, 1):
        T.lug(f, cu + k * 0.42, 0)
    if not big:
        return
    # Gimbal cage on trunnions, cryo-coolers either side.
    ring(f, (cu, 0, cz), "v", r + 0.12, 0.045, "steelL", n=32, sides=6)
    for side in (-1, 1):
        v = side * (r + 0.24)
        f.box(cu, v, 0, 0.26, 0.2, cz, "navy", top="blueGrey")
        f.hcyl(cu - 0.08, cu + 0.08, v - side * 0.08, cz, 0.12, "steel", sides=12, cap="brass", capstart="brass")
        D.seg(f, (cu, v - side * 0.1, cz), (cu, side * (r + 0.02), cz), 0.06, "steelL", 10)
        cv = side * 1.45
        f.vcyl(-4.1, cv, 0, 0.26, 0.9, "navy", top="steelD", sides=14)
        for z in (0.3, 0.45, 0.6, 0.75):
            f.vcyl(-4.1, cv, z, 0.3, 0.04, "steelL", top="steelL", sides=14)
        f.vcyl(-4.1, cv, 0.9, 0.1, 0.12, "brass", top="steel", sides=10)
        T.hose(f, [(-4.1, cv, 1.02), (-3.95, side * 1.2, 1.25), (cu - 0.2, side * 0.62, cz + 0.2)], 0.045, "gm", "brass")


# ---- N: thermal loop -------------------------------------------------------------------------------------------------

def _utubes(f, u0, u1, vs, z0, rise):
    for v in vs:
        um = (u0 + u1) / 2
        curved_pipe(f, [(u1, v, z0), (u1, v, z0 + rise * 0.7), (um, v, z0 + rise), (u0, v, z0 + rise * 0.7), (u0, v, z0)],
                    0.045, "steelL", steps=4, sides=8)
        for u in (u0, u1):
            f.vcyl(u, v, z0, 0.07, 0.05, "brass", top="brass", sides=8)


def thermal(f, fs, tier, a):
    T.neck(fs, a, -1.95, 0.5)
    f.hcyl(-2.15, -1.95, 0, a, 0.52, "steel", sides=24, capstart="steelD")
    f.hcyl(-2.25, -2.15, 0, a - 0.15, 0.36, "steelD", sides=16)
    u0 = -3.0 if tier == 2 else -3.45
    um, top = (u0 - 2.2) / 2, 1.15
    f.box(um, 0, 0, -2.2 - u0, 1.35, top, "navy", top="blueGrey")
    for u in (u0 + 0.08, -2.28):
        f.box(u, 0, top - 0.12, 0.08, 1.4, 0.14, "steelD", top="steel")
    D.panel(f, um, 0.68, 0.55, -2.2 - u0 - 0.3, 0.6, "blueGrey", face="+v", t=0.02, ring=0.04, bolts=True)
    vs = [-0.48, -0.24, 0, 0.24, 0.48]
    if tier == 2:
        _utubes(f, -2.85, -2.4, vs, top, 0.62)
    else:
        _utubes(f, -2.85, -2.4, vs, top, 0.62)
        _utubes(f, -3.35, -2.95, vs, top, 0.52)
        for side in (-1, 1):
            D.fins(f, u0 + 0.15, -2.35, side * 0.73, 0.15, 0.1, 0.8, 10, thick=0.04, mat="steelL", top="plate")
    for side in ((1,) if tier == 2 else (1, -1)):
        v = side * 1.35
        T.cradle(f, -2.95, -2.15, v, 0.32, w=0.45)
        T.pump(f, -2.9, -2.25, v, 0.62, 0.28, "+v" if side > 0 else "-v")
        T.hose(f, [(-2.41, v, 0.95), (-2.45, v, 1.05), (-2.6, side * 0.95, 0.85), (-2.6, side * 0.68, 0.8)], 0.06)
    if tier == 3:
        pv, pu = -1.0, -4.05
        f.vcyl(pu, pv, 0, 0.4, 0.15, "steelD", top="steel", sides=16)
        f.vcyl(pu, pv, 0.15, 0.36, 1.35, "navy", top="navy", sides=20)
        f.vcyl(pu, pv, 1.5, 0.36, 0.3, "navy", top="steel", rtop=0.15, sides=20)
        for z in (0.5, 1.1):
            f.vcyl(pu, pv, z, 0.39, 0.08, "blueGrey", top="blueGrey", sides=20)
        f.vcyl(pu, pv, 0.8, 0.385, 0.05, "brass", top="brass", sides=20)
        f.vcyl(pu, pv, 1.8, 0.07, 0.1, "hivis", top="hivis", sides=8)
        curved_pipe(f, [(pu + 0.3, pv + 0.1, 0.5), (pu + 0.55, -0.6, 0.45), (u0 - 0.02, -0.4, 0.5)], 0.07, "gm", steps=4)
        G.junction_box(f, "-u", 0.6, 0.6, u0, w=0.4, h=0.35, mat="blueGrey", lid="steelL")


# ---- P: turbo-compound -----------------------------------------------------------------------------------------------

def _turbo(f, u, side, a, r_drum):
    """Turbocharger on the deck at v = side * 1.35: compressor inboard, turbine outboard on one shaft across v."""
    z = 0.62
    vc, vt = side * 1.05, side * 1.6
    f.box(u, side * 1.32, 0, 0.5, 0.75, 0.25, "navy", top="blueGrey")
    for v, R, mat in ((vc, 0.24, "steel"), (vt, 0.22, "navy")):
        D.seg(f, (u, v - 0.1, z), (u, v + 0.1, z), R, "steelD", 16, cap=mat, capstart=mat)
        ring(f, (u, v, z), "v", R, 0.1, mat, n=24, sides=8)
    D.seg(f, (u, vc, z), (u, vt, z), 0.1, "brass", 12)
    # Compressor discharge up into the drum; turbine exhaust down to a deck grate.
    curved_pipe(f, [(u, vc, z + 0.3), (u, vc, z + 0.55), (u + 0.15, side * (r_drum + 0.3), a + 0.1),
                    (u + 0.2, side * (r_drum - 0.05), a + 0.05)], 0.1, "steelL", steps=5, sides=10)
    f.box(u - 0.35, vt, 0, 0.3, 0.3, 0.04, "dark", top="dark")
    curved_pipe(f, [(u - 0.15, vt, z), (u - 0.35, vt, z - 0.05), (u - 0.35, vt, 0.05)], 0.08, "steelD", steps=3)
    # Hot-gas bleed: off the chamber's flank near the bulkhead, along the side to the turbine.
    curved_pipe(f, [(1.05, side * 0.95, a - 0.05), (1.0, side * 1.6, 0.95), (0.4, side * 1.75, 0.9), (u + 0.6, side * 1.75, 0.9),
                    (u + 0.2, vt, z + 0.15)], 0.12, "steel", steps=5, sides=12)
    for uu in (0.4, -0.6, u + 0.6):
        D.flange(f, (uu, side * 1.75, 0.9), "u", 0.17, "brass", t=0.07)
        f.box(uu, side * 1.75, 0, 0.12, 0.2, 0.8, "navy", top="blueGrey")


def turbo(f, fs, tier, a):
    r = 0.64 if tier == 2 else 0.7
    T.neck(fs, a, -1.98, r)
    d0 = -2.95 if tier == 2 else -3.35
    T.drum(fs, a, d0, -1.98, r, rings=2 if tier == 2 else 3)
    if tier == 2:
        _turbo(f, -2.6, 1, a, r)
        return
    annulus(fs, -2.68, -2.6, r - 0.05, r + 0.12, a, "steelD", "steel", sides=32)
    annulus(fs, -2.6, -2.56, r - 0.02, r + 0.06, a, "brass", "gm", sides=32)
    for side in (-1, 1):
        _turbo(f, -2.75, side, a, r)
    # Intercooler across the back: a finned navy core, the charge air passing through it.
    f.box(-4.1, 0, 0, 0.55, 1.9, 0.3, "steelD", top="steel")
    f.box(-4.1, 0, 0.3, 0.5, 1.8, 0.8, "navy", top="blueGrey")
    D.fins(f, -4.3, -3.9, 0, 1.1, 1.7, 0.22, 7, thick=0.04, mat="steelL", top="plate")
    for side in (-1, 1):
        curved_pipe(f, [(-3.85, side * 0.6, 0.7), (-3.6, side * 0.9, 0.85), (-3.0, side * 1.05, 0.95)], 0.09, "steelL")
