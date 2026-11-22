"""Kestrel tier fit-out study, round 10: the casing's own shape changes per tier (rounds 6-9 kept one round barrel).
All on round 6's full-depth bed; the Mk I front (cassette fore of the cut, bulkhead, bell) is the family link.

  BA twin barrel: behind a collector casting the casing splits into two parallel chambers, each with its own rear
     cap. Mk III: longer barrels, a turbopump in the valley between them and a crown bridging both rear caps.
  BB armoured housing: the tier section is an eight-sided armoured housing, bolted plates, hatches and louvres.
     Mk III: longer, with side skirts down to the bed, a dorsal vent spine and a heavy rear door.
  BC open frame: no casing; portal frames carry the exposed chamber, wrapped in brass regenerative tubes.
     Mk III: more frames, a turbine stage visible inside, and a tie-beam roof over the frames.
"""
import math

from sprites import detail as D, greeble as G
from geometry import annulus, curved_pipe, sleeve
import tierkit as T
from tier_r5 import ring
from tier_r6 import bed


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def _joint(fs, a, r_to, u1):
    """Clamp ring and gasket at the cut, the casing closing to r_to by u1."""
    sleeve(fs, [(T.CUT + 0.02, 0.93, a), (T.CUT - 0.12, 0.93, a), (u1, r_to, a)], "steelD", sides=32)
    annulus(fs, T.CUT - 0.1, T.CUT + 0.04, 0.8, 1.0, a, "steelD", "steelL", sides=16)
    annulus(fs, T.CUT - 0.14, T.CUT - 0.1, 0.82, 0.95, a, "brass", "gm", sides=24)


# ---- BA: twin barrel -------------------------------------------------------------------------------------------------

def _barrel(f, u0, u1, v, a, r):
    """One chamber: staved body, banded, its own rear cap and injector plate."""
    f.hcyl(u0, u1, v, a, r, "steelD", sides=24)
    for t0, t1, mat in ((0.3, 1.25, "steel"), (1.25, 1.9, "blueGrey"), (1.9, 2.85, "steel"), (3.6, 5.8, "navy")):
        n = 6
        for i in range(n):
            ta, tb = t0 + (t1 - t0) * i / n, t0 + (t1 - t0) * (i + 1) / n
            pts = lambda u, t: f.pt(u, v + (r + 0.04) * math.cos(t), a + (r + 0.04) * math.sin(t))  # noqa: E731
            f.poly([pts(u0 + 0.1, ta), pts(u0 + 0.1, tb), pts(u1, tb), pts(u1, ta)], mat, flip=True)
    for u in (u0 + 0.25, (u0 + u1) / 2):
        f.hcyl(u - 0.05, u + 0.05, v, a, r + 0.08, "blueGrey", sides=24, cap="steelL", capstart="steelL")
    f.hcyl(u0 - 0.14, u0, v, a, r * 0.75, "steel", r1=r, sides=24, capstart="steelD")
    f.hcyl(u0 - 0.2, u0 - 0.14, v, a, r * 0.42, "navy", sides=12, capstart="navy")
    for k in range(6):
        t = k * math.tau / 6
        G.disc(f, "-u", v + r * 0.6 * math.cos(t), a + r * 0.6 * math.sin(t), u0 - 0.14, 0.04, 0, 0.035, "plate", sides=6)


def twin(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    _joint(fs, a, 0.9, -1.75)
    # Collector: a cast block that the two barrels butt into, the round casing fore of it.
    T._m().prism(f, [(-2.05, a - 0.62), (-2.05, a + 0.5), (-1.85, a + 0.62), (-1.6, a + 0.62), (-1.6, a - 0.62)],
                 -1.3, 1.3, "navy", "blueGrey")
    D.panel(f, -1.82, 0, a + 0.62, 0.3, 2.2, "blueGrey", t=0.02, ring=0.04, bolts=True)
    ub = -3.0 if not big else -3.75
    r = 0.5
    for side in (-1, 1):
        _barrel(f, ub, -2.05, side * 0.66, a, r)
    bed(f, u0, a)
    if big:
        # Turbopump in the valley, the crown bridging both rear caps.
        T.pump(f, -3.3, -2.25, 0, a + 0.2, 0.26, "+v")
        for side in (-1, 1):
            curved_pipe(f, [(-2.4, 0, a + 0.48), (-2.3, side * 0.25, a + 0.6), (-2.12, side * 0.4, a + 0.58)], 0.07, "steelL")
        f.box(ub - 0.35, 0, a - 0.55, 0.3, 2.0, 1.0, "navy", top="blueGrey")
        for side in (-1, 1):
            ring(f, (ub - 0.3, side * 0.66, a), "u", 0.36, 0.13, "steel", n=24, sides=8)
        f.hcyl(ub - 0.55, ub - 0.5, 0, a, 0.25, "steelD", sides=12, capstart="brass")


# ---- BB: armoured housing --------------------------------------------------------------------------------------------

def _octa(fs, u0, u1, a, r, mat="navy"):
    fs.hcyl(u0, u1, 0, a, r, mat, sides=8, capstart="steelD")


def armoured(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    _joint(fs, a, 0.93, -1.6)
    ue = -3.0 if not big else -3.9
    rr = 1.02
    _octa(fs, ue, -1.6, a, rr)
    # Plate seams and bolt rows round each section, a raised armour band at the joint.
    k = -1.6
    while k > ue + 0.2:
        fs.hcyl(k - 0.03, k + 0.03, 0, a, rr + 0.015, "steelD", sides=8, cap="steelD", capstart="steelD")
        for i in range(8):
            t = i * math.tau / 8 + math.pi / 8 + math.pi / 8
            G.disc(fs, "-u", (rr - 0.08) * math.cos(t), a + (rr - 0.08) * math.sin(t), k - 0.03, 0.03, 0, 0.03, "plate", sides=6)
        k -= 0.55
    fs.hcyl(-1.72, -1.6, 0, a, rr + 0.06, "blueGrey", sides=8, cap="steelL", capstart="steelL")
    # Side hatches and louvres on the flats.
    for side in (-1, 1):
        face = "+v" if side > 0 else "-v"
        G.hatch(f, face, -2.35, a, side * rr, w=0.5, h=0.36)
        D.slats(f, ue + 0.25, ue + 0.7, side * rr, a - 0.25, a + 0.25, 4, side)
    # Rear face: a bolted plate with a service door.
    D.panel(f, ue - 0.01, 0, a, 1.1, 0.8, "blueGrey", face="-u", t=0.03, ring=0.05, bolts=True)
    f.box(ue - 0.06, 0.32, a, 0.05, 0.08, 0.3, "brass", base=False)
    bed(f, u0, a)
    if big:
        for side in (-1, 1):
            # Skirts down to the bed's castings, louvred.
            lo, hi = sorted((side * 1.0, side * 1.42))
            T._m().prism(f, [(ue, 0.5), (ue, 1.05), (-1.8, 1.05), (-1.6, 0.8), (-1.6, 0.5)], lo, hi, "navy", "blueGrey")
            D.slats(f, ue + 0.3, -2.0, side * (1.42 if side > 0 else 1.0) if side > 0 else -1.42, 0.6, 0.95, 3, side)
        # Dorsal vent spine: a raised louvred ridge along the top flat.
        f.box((ue - 1.7) / 2, 0, a + 0.62, -1.7 - ue, 0.42, 0.08, "steelD", top="steel")
        D.fins(f, ue + 0.1, -1.8, 0, a + 0.7, 0.36, 0.05, 14, thick=0.035, mat="steelL", top="plate")
        # Heavy rear door: a raised frame and wheel.
        f.box(ue - 0.08, 0, a - 0.45, 0.1, 0.7, 0.9, "steelD", top="steel")
        G.valve_wheel(f, "-u", 0, a, ue - 0.13, r=0.16)


# ---- BC: open frame --------------------------------------------------------------------------------------------------

def _portal(f, u, a, w=1.0, top=None):
    """A cast portal frame across the machine: two legs on the bed and a lintel, a ring clamp round the core."""
    top = top or a + 0.62
    for side in (-1, 1):
        f.box(u, side * w, 0.5, 0.18, 0.18, top - 0.5, "navy", top="blueGrey")
    f.box(u, 0, top, 0.2, 2 * w + 0.18, 0.14, "navy", top="blueGrey")
    for side in (-1, 1):
        D.seg(f, (u, side * w, a), (u, side * 0.55, a), 0.06, "steel", 8, cap="steelL")


def open_frame(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    _joint(fs, a, 0.58, -1.75)
    ue = -3.05 if not big else -4.0
    # The exposed chamber: a dark core, brass regenerative tubes laid along it, steel bands.
    f.hcyl(ue, -1.7, 0, a, 0.45, "dark", sides=20)
    for k in range(16):
        t = k * math.tau / 16
        v, z = 0.5 * math.cos(t), a + 0.5 * math.sin(t)
        D.seg(f, (ue + 0.05, v, z), (-1.75, v, z), 0.04, "brass" if k % 2 else "oD", 6)
    u = -1.95
    while u > ue + 0.1:
        f.hcyl(u - 0.04, u + 0.04, 0, a, 0.56, "steelD", sides=20, cap="steel", capstart="steel")
        u -= 0.3
    f.hcyl(ue - 0.15, ue, 0, a, 0.5, "steel", r1=0.56, sides=20, capstart="navy")
    T.bolts(f, ue - 0.15, a, 0.35, n=8)
    frames = [-2.25, -2.85] if not big else [-2.05, -2.6, -3.15, -3.7]
    for u in frames:
        _portal(f, u, a)
    bed(f, u0, a)
    if big:
        # Turbine stage on the core, between frames, and tie beams over the lintels.
        ring(f, (-2.88, 0, a), "u", 0.56, 0.16, "navy", n=28, sides=8)
        D.ribs(f, -3.0, -2.75, 0, a, 0.58, 0.58, 3, thick=0.04, grow=0.05, mat="blueGrey", sides=24)
        for side in (-1, 1):
            f.box((frames[0] + frames[-1]) / 2, side * 0.7, a + 0.76, frames[0] - frames[-1] + 0.2, 0.1, 0.08,
                  "steelD", top="steel")
            curved_pipe(f, [(frames[-1] - 0.1, side * 1.0, 0.6), (-3.4, side * 0.8, a - 0.35), (-3.0, side * 0.6, a - 0.3)],
                        0.08, "steelL")
