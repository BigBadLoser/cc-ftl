"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): ten cassette slabs (1.6) round a core
on a 3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Parts in slab_kit.py; earlier
rounds in git history.

Round 14, after round 13's review (detail lost; the columns look stuck on; idea: sink into the floor). The wheel stands
in a pit (PIT: slab_study holds out a floor round its mouth so the game's floor shows): the race, a ring gear and the
pinion drives sit down in the well behind a striped lip, which frees the height (walls 1.85, roof top 2.05) for a
taller two-tier canopy with detail and the drive on its top. What holds the canopy up grows out of it: a lobe of the
canopy's own outline running down to the floor, the canopy's bands carried round it:

  s40  one lobe (machine green, yellow): on the left corner, a door and a screen on it
  s41  twin lobes (graphite, safety orange): left and right
  s42  ring canopy (teal, white): a canopy open in the middle, the rotor's hub and the belt drive seen through it, on
       one lobe at the right corner"""
import math

from .slab_kit import BACK, FRONT, R0, angles, at, cassette, frame, hazard, links, loop, prism, ring
from .slab_study import L

D = 0.55                                            # the pit's depth
RP = 1.47                                           # its mouth
Z0 = -0.34                                          # the slabs' feet (on the deck, down in the pit)
ZH = Z0 + L                                         # their heads
ZC = ZH + 0.06                                      # the canopy's underside
ZT = ZC + 0.55                                      # its top
LEFT, RIGHT = FRONT + math.pi / 2, FRONT - math.pi / 2
LR, LC = 0.32, 1.8                                  # a lobe's radius and its centre's distance out


def cup(k, s, col, lever="hazY"):
    """A bolted socket round the slab's foot cap."""
    s.box(k, -0.1, 0.12, -0.5, 0.5, -0.32, 0.1, col, face="steelL")
    for w in (-0.38, 0.38):
        s.box(k, -0.06, 0.0, w - 0.03, w + 0.03, 0.1, 0.12, "steel")
    s.box(k, -0.04, 0.08, -0.06, 0.06, 0.1, 0.125, lever)


def annulus(k, r0, r1, z0, z1, col, top=None, n=48):
    """A flat ring r0..r1 from z0 to z1, as n sector prisms."""
    for i in range(n):
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        prism(k, [at(r0, a0)[:2], at(r1, a0)[:2], at(r1, a1)[:2], at(r0, a1)[:2]], z0, z1, col, top=top)


# ---- the pit ------------------------------------------------------------------------------------------------------
def pit(k, deck, trim):
    """The well: a ribbed wall, the race and the rotor's deck with its ring gear, pinion drives at the back, a striped
    lip round the mouth."""
    k.cyl(0, 0, -D, RP, 0.02, "dark", sides=48)
    annulus(k, RP, RP + 0.06, -D, 0.0, "steelD", top="steel")
    for i in range(30):
        a = (i + 0.5) * math.tau / 30
        k.box(*at(RP - 0.012, a)[:2], -D, 0.05, 0.03, D - 0.04, "dark", rz=a + math.pi / 2)
    k.cyl(0, 0, -D + 0.02, 1.3, 0.06, "steelD", top="steel", sides=48)      # the race
    k.cyl(0, 0, -D + 0.08, 1.27, 0.015, "dark", sides=48)
    k.cyl(0, 0, Z0 - 0.13, 1.24, 0.11, deck, top="steelL", sides=48)       # the deck
    ring(k, 1.27, Z0 - 0.13, 0.1, 0.05, "steelL", n=72, skip=lambda i: i % 2)   # its ring gear
    ring(k, 1.2, Z0 - 0.02, 0.006, 0.05, "steelL", n=40, skip=lambda i: i % 2)  # index marks
    for a in (BACK, BACK + 1.1, BACK - 1.1):                                 # the pinion drives in the wall
        k.cyl(*at(1.36, a)[:2], Z0 - 0.15, 0.08, 0.14, "steelL", top="steel", sides=12)
        k.box(*at(1.44, a)[:2], -D + 0.02, 0.12, 0.36, 0.42, trim, rz=a)
        for dz in (0.1, 0.18, 0.26):
            k.box(*at(1.38, a)[:2], -D + 0.02 + dz, 0.012, 0.28, 0.03, "dark", rz=a)
    annulus(k, RP, RP + 0.11, 0.0, 0.05, "steelD", top="steel")             # the lip
    hazard(k, RP + 0.055, 0.05, w=0.08)


def wheel(k, body, trim):
    """The slabs on the deck, each in a foot socket and a head clamp to the canopy's head ring."""
    out = []
    for th in angles():
        s = cassette(k, frame(th, Z0))
        out.append(s)
        cup(k, s, body)
        s.box(k, L - 0.06, L + 0.08, -0.14, 0.14, -0.28, 0.08, body, face="steelD")   # the head clamp
        s.box(k, L - 0.03, L + 0.01, -0.14, 0.14, 0.08, 0.09, trim)
    ring(k, R0, ZH + 0.02, 0.06, 0.14, "steelD", top="steel")              # the head ring
    return out


# ---- the canopy and its lobes ---------------------------------------------------------------------------------------
TIERS = (  # (z from ZC, height, radius change, colour key, top key, radius change at the top)
    (0.0, 0.06, -0.18, "trim", None, 0.0),           # the chamfered underside
    (0.06, 0.22, 0.0, "body", None, None),           # the lower band
    (0.28, 0.05, 0.02, "trim", None, None),          # a proud trim band
    (0.33, 0.17, -0.04, "body", None, None),         # the upper band, set in
    (0.5, 0.05, -0.04, "trim", "body", -0.12),       # the chamfered top
)


def canopy(k, body, trim, lobes, hole=0.0):
    """The canopy tiers over the wheel (open to radius `hole` in the middle if set) and over each lobe at angle a,
    then the lobes' columns down to the floor."""
    col = {"body": body, "trim": trim}
    for z, h, dr, c, t, dtop in TIERS:
        z0 = ZC + z
        if hole:
            annulus(k, hole, 1.48 + dr, z0, z0 + h, col[c], top=col[t] if t else None)
        else:
            k.cyl(0, 0, z0, 1.48 + dr, h, col[c], top=col[t] if t else None, sides=48,
                  rtop=None if dtop is None else 1.48 + dr + dtop)
        for a in lobes:
            u, v, _ = at(LC, a)
            k.cyl(u, v, z0, LR + dr * 0.5, h, col[c], top=col[t] if t else None, sides=20,
                  rtop=None if dtop is None else LR + (dr + dtop) * 0.5)
            w = 2 * (LR + dr * 0.5) * 0.9                                    # the waist into the canopy: one outline
            m = at((1.2 + LC) / 2, a)
            k.box(m[0], m[1], z0, LC - 1.2, w, h if dtop is None else h * 0.5, col[c], top=col[t] if t else None,
                  rz=a)
    for a0, a1 in ((FRONT - 1.3, FRONT + 1.3),):                            # vents and lights on the lower band
        for i in range(16):
            a = a0 + (a1 - a0) * (i + 0.5) / 16
            for dz in (0.1, 0.16):
                k.box(*at(1.484, a)[:2], ZC + dz, 0.07, 0.012, 0.025, "dark", rz=a + math.pi / 2)
    ring(k, 1.485, ZC + 0.22, 0.025, 0.012, "slbCy", n=48, skip=lambda i: i % 3 == 0)
    for i in range(16):                                                      # seams on the upper band
        a = (i + 0.5) * math.tau / 16
        k.box(*at(1.444, a)[:2], ZC + 0.34, 0.022, 0.012, 0.15, "dark", rz=a + math.pi / 2)
    for a in lobes:                                                          # the lobes' columns
        u, v, _ = at(LC, a)
        k.cyl(u, v, 0.0, LR + 0.06, 0.08, "steelD", top="steel", sides=20)
        k.cyl(u, v, 0.08, LR - 0.03, ZC - 0.08, body, sides=20)
        k.cyl(u, v, 0.3, LR - 0.01, 0.06, trim, sides=20)
        for i in range(8):
            b = a + math.pi + (i - 3.5) * 0.35
            k.box(u + (LR - 0.026) * math.cos(b), v + (LR - 0.026) * math.sin(b), 0.4, 0.02, 0.012, ZC - 0.5, "dark",
                  rz=b + math.pi / 2)
        f = FRONT if abs(math.remainder(a - FRONT, math.tau)) > 0.1 else a  # the face toward the room
        fu, fv = u + (LR - 0.02) * math.cos(f), v + (LR - 0.02) * math.sin(f)
        k.box(fu, fv, 0.42, 0.26, 0.02, 0.62, "steelD", rz=f + math.pi / 2)   # a door
        k.box(fu + 0.012 * math.cos(f), fv + 0.012 * math.sin(f), 0.66, 0.06, 0.01, 0.1, trim, rz=f + math.pi / 2)
        k.box(fu + 0.01 * math.cos(f), fv + 0.01 * math.sin(f), 1.1, 0.2, 0.012, 0.12, "slbCy", rz=f + math.pi / 2)


def top_drive(k, body, trim, toward, zt=ZT):
    """On the canopy's top: a bolted inset ring, the rotor's pulley in a hatch, a motor pod and the belt."""
    ring(k, 1.1, zt, 0.006, 0.03, "dark", skip=lambda i: i % 6 == 0)
    for i in range(16):
        k.cyl(*at(1.24, i * math.tau / 16)[:2], zt, 0.025, 0.02, "steelL", sides=6)
    k.cyl(0, 0, zt, 0.5, 0.01, "dark", sides=24)
    k.cyl(0, 0, zt, 0.36, 0.08, "steelL", top="steel", sides=20)
    k.cyl(0, 0, zt + 0.08, 0.12, 0.03, trim, sides=12)
    mc = at(0.98, toward)
    k.cyl(mc[0], mc[1], zt, 0.28, 0.03, "steelD", top="steel", sides=16)
    k.cyl(mc[0], mc[1], zt + 0.03, 0.21, 0.1, trim, top=body, sides=16)
    for dz in (0.05, 0.08):
        k.cyl(mc[0], mc[1], zt + dz, 0.23, 0.012, "steelD", sides=16)
    links(k, loop((0, 0), 0.37, mc, 0.12), zt + 0.02, closed=True, cols=("black",), h=0.05, w=0.04, pitch=0.08)


# ---- the designs ----------------------------------------------------------------------------------------------------
def one_lobe(k):
    """s40."""
    pit(k, "slbMach", "hazY")
    out = wheel(k, "slbMach", "hazY")
    canopy(k, "slbMach", "hazY", [LEFT])
    top_drive(k, "slbMach", "hazY", LEFT)
    return out


def twin_lobes(k):
    """s41."""
    pit(k, "gm", "hivis")
    out = wheel(k, "gm", "hivis")
    canopy(k, "gm", "hivis", [LEFT, RIGHT])
    top_drive(k, "gm", "hivis", BACK)
    return out


def ring_canopy(k):
    """s42."""
    pit(k, "slbTeal", "medWhite")
    out = wheel(k, "slbTeal", "medWhite")
    canopy(k, "slbTeal", "medWhite", [RIGHT], hole=0.62)
    k.cyl(0, 0, ZH + 0.02, 0.6, ZC + 0.3 - ZH - 0.02, "steelD", top="steel", sides=24)   # the rotor's hub
    for i in range(10):                                                      # its spokes to the head ring
        a = (i + 0.5) * math.tau / 10
        k.box(*at(0.45, a)[:2], ZC + 0.3, 0.3, 0.06, 0.02, "dark", rz=a)
    k.cyl(0, 0, ZC + 0.3, 0.3, 0.08, "steelL", top="steel", sides=20)       # its pulley, the belt to a motor
    mc = at(0.95, RIGHT)
    k.cyl(mc[0], mc[1], ZT, 0.24, 0.04, "steelD", top="steel", sides=16)
    k.cyl(mc[0], mc[1], ZT + 0.04, 0.18, 0.1, "medWhite", top="slbTeal", sides=16)
    k.cyl(mc[0], mc[1], ZC + 0.3, 0.1, ZT - ZC - 0.3, "steelL", sides=12)
    links(k, loop((0, 0), 0.31, mc, 0.1), ZC + 0.32, closed=True, cols=("black",), h=0.05, w=0.04, pitch=0.08)
    return out


DESIGNS = {"s40": (one_lobe, (3, 3)), "s41": (twin_lobes, (3, 3)), "s42": (ring_canopy, (3, 3))}
OVERLAYS = {}
PIT = {v: RP for v in DESIGNS}
