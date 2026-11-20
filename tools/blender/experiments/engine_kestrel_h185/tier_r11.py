"""Kestrel tier fit-out study, round 11: three more body shapes on round 6's full-depth bed.

  CA telescoping: the casing steps down toward the rear in flanged stages, each with its staves, a bolted step flange
     and a stage valve on top. Mk II two stages, Mk III three.
  CB radial drum: a squat upright drum (a vertical-axis compressor) stands on the bed, its volute round its waist and
     spokes on its lid; the casing plugs into its side. Mk III: a bigger drum and a pump crown on a casing extension.
  CD fin stack: the tier section is an air-cooled stack of deep fins round a core, a fan cowl at the rear.
     Mk III: a longer stack under a top shroud, the fan bigger, blower ducts down the sides.
"""
import math

from sprites import detail as D, greeble as G
from geometry import annulus, curved_pipe
import tierkit as T
from tier_r5 import ring
from tier_r6 import STAVES, bed
from tier_r7 import _crown
from tier_r10 import _joint


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


# ---- CA: telescoping -------------------------------------------------------------------------------------------------

def telescoping(f, fs, tier, a):
    u0 = _u0()
    stages = [(0.84, 0.72), (0.68, 0.62)] if tier == 2 else [(0.86, 0.66), (0.72, 0.62), (0.58, 0.58)]
    _joint(fs, a, stages[0][0], T.CUT - 0.15)
    u = T.CUT - 0.15
    m = T._m()
    for r, length in stages:
        u1, u0s = u, u - length
        fs.hcyl(u0s, u1, 0, a, r, "steelD", sides=32)
        for t0, t1, mat in STAVES:
            m.sculpted_stave(fs, [(u0s + 0.08, r + 0.06, a), (u1 - 0.08, r + 0.06, a)], t0, t1, mat)
        # The step flange: a thick bolted ring at the stage's rear, a brass gasket.
        annulus(fs, u0s - 0.08, u0s + 0.04, r * 0.7, r + 0.12, a, "steel", "steelL", sides=24)
        annulus(fs, u0s + 0.04, u0s + 0.08, r, r + 0.08, a, "brass", "gm", sides=24)
        for k in range(8):
            t = k * math.tau / 8 + math.pi / 8
            G.disc(fs, "-u", (r + 0.05) * math.cos(t), a + (r + 0.05) * math.sin(t), u0s - 0.08, 0.035, 0, 0.03, "plate",
                   sides=6)
        # Stage valve on top, its feed down the side.
        fs.box(u1 - length / 2, 0, a + r + 0.04, 0.3, 0.3, 0.12, "navy", top="blueGrey")
        u = u0s - 0.08
    fs.hcyl(u - 0.1, u, 0, a, stages[-1][0] * 0.5, "navy", sides=12, capstart="brass")
    T.bolts(fs, u - 0.1, a, stages[-1][0] * 0.35)
    bed(f, u0, a)


# ---- CB: radial drum -------------------------------------------------------------------------------------------------

def _drum(f, cu, a, r, z0=0.55, z1=1.75):
    f.vcyl(cu, 0, z0, r, z1 - z0, "navy", top="blueGrey", sides=32)
    for z in (z0 + 0.12, z1 - 0.12):
        f.vcyl(cu, 0, z - 0.03, r + 0.04, 0.06, "steelL", top="steelL", sides=32)
    ring(f, (cu, 0, (z0 + z1) / 2 - 0.05), "z", r + 0.1, 0.15, "steel", n=36, sides=8)          # the volute
    f.vcyl(cu, 0, z1, r * 0.3, 0.12, "brass", top="steel", sides=16)                             # hub
    for k in range(12):
        t = k * math.tau / 12
        D.seg(f, (cu + r * 0.3 * math.cos(t), r * 0.3 * math.sin(t), z1 + 0.04),
              (cu + (r - 0.05) * math.cos(t), (r - 0.05) * math.sin(t), z1 + 0.04), 0.03, "steelL", 6)
    for k in range(6):
        t = k * math.tau / 6 + math.pi / 6
        G.disc(f, "z", cu + (r - 0.12) * math.cos(t), (r - 0.12) * math.sin(t), z1, 0.04, 0, 0.03, "plate", sides=6)


def radial(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    _joint(fs, a, 0.6, -1.75)
    if not big:
        cu, r = -2.62, 0.74
        fs.hcyl(cu + r - 0.1, -1.7, 0, a, 0.42, "steel", sides=20)
        _drum(f, cu, a, r)
    else:
        fs.hcyl(-2.3, -1.7, 0, a, 0.62, "steelD", sides=24)
        _crown(fs, -2.1, a, 0.6)
        cu, r = -3.4, 0.92
        fs.hcyl(cu + r - 0.1, -2.3, 0, a, 0.42, "steel", sides=20)
        _drum(f, cu, a, r)
    annulus(fs, cu + r - 0.05, cu + r + 0.06, 0.4, 0.58, a, "brass", "gm", sides=20)
    # Two discharges off the volute into the casing's flanks.
    for side in (-1, 1):
        curved_pipe(f, [(cu, side * (r + 0.15), 1.1), (cu + r * 0.7, side * (r + 0.1), 1.2), (-1.75, side * 0.85, a)],
                    0.09, "steelL", steps=5)
    bed(f, u0, a)


# ---- CD: fin stack ---------------------------------------------------------------------------------------------------

def fin_stack(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    _joint(fs, a, 0.6, -1.75)
    ue = -2.95 if not big else -3.65
    fs.hcyl(ue, -1.75, 0, a, 0.55, "steelD", sides=24)
    u = -1.82
    while u > ue + 0.05:
        annulus(fs, u - 0.018, u + 0.018, 0.55, 0.98 if big else 0.92, a, "steelL", "plate", sides=28)
        u -= 0.075
    for t in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2):              # tie bars through the fins
        D.seg(fs, (ue, 0.75 * math.cos(t), a + 0.75 * math.sin(t)), (-1.8, 0.75 * math.cos(t), a + 0.75 * math.sin(t)),
              0.04, "navy", 6)
    # The fan cowl: a short drum at the rear with a grille and a hub.
    rr = 0.88 if not big else 0.98
    fs.hcyl(ue - 0.35, ue, 0, a, rr, "navy", sides=32)
    fs.hcyl(ue - 0.37, ue - 0.35, 0, a, rr, "dark", sides=32, capstart="dark")
    for k in range(3):
        annulus(fs, ue - 0.38, ue - 0.36, rr * (0.3 + 0.25 * k), rr * (0.34 + 0.25 * k), a, "steel", "steel", sides=32)
    fs.hcyl(ue - 0.45, ue - 0.36, 0, a, 0.18, "brass", sides=12, capstart="steel")
    if big:
        fs.box((ue - 1.75) / 2, 0, a + 0.9, -1.75 - ue, 1.4, 0.06, "navy", top="blueGrey")       # top shroud
        for side in (-1, 1):
            curved_pipe(f, [(ue - 0.2, side * 0.9, a - 0.3), (ue + 0.2, side * 1.2, 0.95), (-2.2, side * 1.2, 0.95),
                            (-1.9, side * 0.95, a - 0.2)], 0.12, "navy", steps=4, sides=12)
    bed(f, u0, a)
