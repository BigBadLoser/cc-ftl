"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): ten cassette slabs round a core on a
3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Parts in slab_kit.py; earlier rounds
in git history.

Round 13, after round 12's review (the plinth wastes height; the semi-enclosed canopy designs of round 11 felt the most
complete): within the roof (walls 1.85, roof top 2.05; crew 1.5) the floor gets only a thin race and the rotor's deck,
the slabs (1.6) stand on it, and a slim canopy over them holds their heads and carries the drive on its top (a motor
pod and a belt to the rotor's pulley, seen from above); what holds the canopy up is round:

  s37  one spine (machine green, yellow): a round spine on the left corner merging into the canopy's edge by a collar
       and a neck; a screen on it
  s38  twin spines (graphite, safety orange): round spines on the left and right corners, the canopy spanning between
  s39  back shroud (teal, white): a thin shell following the circle round the back from the floor to the canopy, framed
       by round pilasters at its ends, a screen on the left one"""
import math

from .slab_kit import BACK, FRONT, R0, angles, at, cassette, frame, links, loop, ring
from .slab_study import L, beam

Z0 = 0.16                                           # the slabs' feet (on the deck)
ZH = Z0 + L                                         # their heads
ZC = ZH + 0.06                                      # the canopy's underside
LEFT, RIGHT = FRONT + math.pi / 2, FRONT - math.pi / 2


def cup(k, s, col, lever="hazY"):
    """A bolted socket round the slab's foot cap."""
    s.box(k, -0.1, 0.12, -0.5, 0.5, -0.32, 0.1, col, face="steelL")
    for w in (-0.38, 0.38):
        s.box(k, -0.06, 0.0, w - 0.03, w + 0.03, 0.1, 0.12, "steel")
    s.box(k, -0.04, 0.08, -0.06, 0.06, 0.1, 0.125, lever)


def spine(k, a, z1, body, trim, r=0.28, rc=1.8):
    """A round spine at angle a: a stepped foot, a banded, seamed column, a cap."""
    u, v, _ = at(rc, a)
    k.cyl(u, v, 0.0, r + 0.08, 0.14, "steelD", top="steel", sides=20)
    k.cyl(u, v, 0.14, r, z1 - 0.14, body, sides=20)
    for i in range(8):
        b = (i + 0.5) * math.tau / 8
        k.box(u + (r + 0.004) * math.cos(b), v + (r + 0.004) * math.sin(b), 0.3, 0.02, 0.012, z1 - 0.6, "dark",
              rz=b + math.pi / 2)
    for z in (0.22, z1 - 0.34):
        k.cyl(u, v, z, r + 0.03, 0.07, trim, sides=20)
    k.cyl(u, v, z1, r + 0.02, 0.06, trim, sides=20)
    return u, v


def screen(k, u, v, a, z, r):
    """A screen on a round spine's face toward the room (angle a from the spine's centre)."""
    k.box(u + (r + 0.01) * math.cos(a), v + (r + 0.01) * math.sin(a), z, 0.3, 0.02, 0.22, "dark", rz=a + math.pi / 2)
    k.box(u + (r + 0.02) * math.cos(a), v + (r + 0.02) * math.sin(a), z + 0.06, 0.18, 0.01, 0.1, "slbCy",
          rz=a + math.pi / 2)


def race(k, deck):
    """The floor race (thin: height is for the slabs and the canopy) and the rotor's deck on it, index marks."""
    k.cyl(0, 0, 0.0, 1.44, 0.05, "steelD", top="steel", sides=48)
    k.cyl(0, 0, 0.05, 1.41, 0.015, "dark", sides=48)
    k.cyl(0, 0, 0.065, 1.38, 0.06, deck, top="steelL", sides=48)
    ring(k, 1.33, 0.125, 0.006, 0.05, "steelL", n=40, skip=lambda i: i % 2)


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


def canopy(k, body, trim, drive_a, light="slbCy"):
    """The slim canopy: a chamfered underside, a seamed band with lights, a chamfered top; on it the drive: the rotor's
    pulley in a hatch, a motor pod toward drive_a and the belt between, under a guard."""
    z = ZC
    k.cyl(0, 0, z, 1.3, 0.05, trim, sides=48, rtop=1.48)
    k.cyl(0, 0, z + 0.05, 1.48, 0.12, body, sides=48)
    for i in range(12):
        a = (i + 0.5) * math.tau / 12
        k.box(*at(1.484, a)[:2], z + 0.06, 0.022, 0.012, 0.1, "dark", rz=a + math.pi / 2)
    ring(k, 1.485, z + 0.08, 0.025, 0.012, light, n=48, skip=lambda i: i % 4 == 0)
    zt = z + 0.21
    k.cyl(0, 0, z + 0.17, 1.48, 0.04, trim, top=body, sides=48, rtop=1.4)
    ring(k, 1.15, zt, 0.006, 0.03, "dark", n=48, skip=lambda i: i % 6 == 0)
    for i in range(5):                                                       # panel lines and vents on the top
        a = drive_a + math.pi + (i - 2) * 0.45
        k.box(*at(1.0, a)[:2], zt, 0.34, 0.06, 0.008, "dark", rz=a + math.pi / 2)
    k.cyl(0, 0, zt, 0.5, 0.01, "dark", sides=24)                            # the hatch, the rotor's pulley
    k.cyl(0, 0, zt, 0.36, 0.08, "steelL", top="steel", sides=20)
    k.cyl(0, 0, zt + 0.08, 0.12, 0.03, trim, sides=12)
    mc = at(0.98, drive_a)
    k.cyl(mc[0], mc[1], zt, 0.28, 0.03, "steelD", top="steel", sides=16)    # the motor pod
    k.cyl(mc[0], mc[1], zt + 0.03, 0.21, 0.1, trim, top=body, sides=16)
    for dz in (0.05, 0.08):
        k.cyl(mc[0], mc[1], zt + dz, 0.23, 0.012, "steelD", sides=16)
    k.cyl(mc[0], mc[1], zt + 0.01, 0.09, 0.05, "steelL", sides=12)
    links(k, loop((0, 0), 0.37, mc, 0.12), zt + 0.02, closed=True, cols=("black",), h=0.05, w=0.04, pitch=0.08)


def neck(k, a, u, v, body, trim, r):
    """A collar round a spine at the canopy and a neck merging it into the canopy's edge."""
    k.cyl(u, v, ZC - 0.02, r + 0.05, 0.26, body, top=trim, sides=20)
    beam(k, (u, v, ZC + 0.11), at(1.3, a, ZC + 0.11), 0.34, 0.16, body, top=trim)


# ---- s37 one spine --------------------------------------------------------------------------------------------------
def one_spine(k):
    """s37."""
    race(k, "slbMach")
    out = wheel(k, "slbMach", "hazY")
    u, v = spine(k, LEFT, ZC + 0.24, "slbMach", "hazY", r=0.3)
    neck(k, LEFT, u, v, "slbMach", "hazY", 0.3)
    canopy(k, "slbMach", "hazY", LEFT)
    screen(k, u, v, FRONT, 0.8, 0.3)
    return out


# ---- s38 twin spines ------------------------------------------------------------------------------------------------
def twin_spines(k):
    """s38."""
    race(k, "gm")
    out = wheel(k, "gm", "hivis")
    for a in (LEFT, RIGHT):
        u, v = spine(k, a, ZC + 0.24, "gm", "hivis", r=0.26)
        neck(k, a, u, v, "gm", "hivis", 0.26)
        screen(k, u, v, FRONT, 0.8, 0.26)
    canopy(k, "gm", "hivis", BACK)
    return out


# ---- s39 back shroud ------------------------------------------------------------------------------------------------
def shroud(k):
    """s39."""
    race(k, "slbTeal")
    out = wheel(k, "slbTeal", "medWhite")
    back = lambda i: abs(math.remainder((i + 0.5) * math.tau / 64 - BACK, math.tau)) <= math.pi / 2   # noqa: E731
    ring(k, 1.48, 0.0, ZC + 0.05, 0.04, "slbTeal", n=64, skip=lambda i: not back(i))   # the shell
    for i in range(64):
        if back(i) and i % 4 == 0:
            a = (i + 0.5) * math.tau / 64
            k.box(*at(1.455, a)[:2], 0.1, 0.022, 0.012, ZC - 0.15, "dark", rz=a + math.pi / 2)
    for a in (LEFT, RIGHT):                                                  # the pilasters framing it
        u, v, _ = at(1.62, a)
        k.cyl(u, v, 0.0, 0.2, 0.08, "steelD", top="steel", sides=16)
        k.cyl(u, v, 0.08, 0.16, ZC + 0.13, "medWhite", sides=16)
        for z in (0.5, 1.2):
            k.cyl(u, v, z, 0.18, 0.05, "slbTeal", sides=16)
        k.cyl(u, v, ZC + 0.21, 0.18, 0.05, "slbTeal", sides=16)
    canopy(k, "slbTeal", "medWhite", BACK)
    u, v, _ = at(1.62, LEFT)
    screen(k, u, v, FRONT, 0.8, 0.16)
    return out


DESIGNS = {"s37": (one_spine, (3, 3)), "s38": (twin_spines, (3, 3)), "s39": (shroud, (3, 3))}
OVERLAYS = {}
