"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): ten cassette slabs round a core on a
3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Parts in slab_kit.py; earlier rounds
in git history.

Round 11, after round 10's review (frames read as mechanisms in scaffolding, not finished modules; a round mechanism
forced into square frames; plain box beams look flat; a floor plate only where it makes sense; twelve slabs clipped,
so ten). The game's finished modules are housings with a face, so: a housed base drum (the drive seen through a
service window) and a housed top canopy over the bearing, the slabs on show in the open band between them, a control
panel set into the front; what joins base and canopy stands in the footprint's corners, outside the slabs' sweep:

  s31  twin towers (graphite, safety orange): corner towers left and right carry the canopy, vent panels on their faces
  s32  three columns (teal, white): columns in the left, back and right corners, on lugs of the base and the canopy
  s33  back tower (machine green, yellow): one heavy tower fills the back corner, the canopy cantilevered off it by a
       neck to its bearing housing, hazard stripes on its edges, a beacon"""
import math

from .slab_kit import (BACK, FRONT, angles, at, base_drum, canopy, cassette, console, corner_fill, frame, ring, sq,
                       tube)
from .slab_study import L, beam

ZB, Z0 = 0.42, 0.6                                  # the base's top, the slabs' feet
ZC = Z0 + L + 0.18                                  # the canopy's underside


def cup(k, s, col, lever="hazY"):
    """A bolted socket round the slab's foot cap."""
    s.box(k, -0.1, 0.12, -0.5, 0.5, -0.32, 0.1, col, face="steelL")
    for w in (-0.38, 0.38):
        s.box(k, -0.06, 0.0, w - 0.03, w + 0.03, 0.1, 0.12, "steel")
    s.box(k, -0.04, 0.08, -0.06, 0.06, 0.1, 0.125, lever)


def wheel(k, body, clamp):
    out = []
    for th in angles():
        s = cassette(k, frame(th, Z0))
        out.append(s)
        cup(k, s, body)
        s.box(k, L - 0.06, L + 0.12, -0.16, 0.16, -0.3, 0.09, clamp)          # the head clamp
        s.box(k, L - 0.02, L + 0.04, -0.05, 0.05, 0.09, 0.105, "steel")
    return out


def stripes(k, a, z0, z1, n=8):
    """Hazard stripes down a housing's edge at angle a (on the slabs' circle)."""
    for i in range(n):
        h = (z1 - z0) / n
        k.box(*at(1.505, a)[:2], z0 + i * h, 0.06, 0.03, h, "hazY" if i % 2 else "hazK", rz=a)


# ---- s31 twin towers ------------------------------------------------------------------------------------------------
def towers(k):
    """s31."""
    base_drum(k, "gm", "steelD", "steel", window=FRONT - 1.05)
    zt = ZC + 0.38
    for c in (FRONT + math.pi / 2, FRONT - math.pi / 2):
        a0, a1 = c - 0.55, c + 0.55
        corner_fill(k, a0, a1, 1.5, 0.0, zt, "gm", top="steelD")
        corner_fill(k, a0, a1, 1.5, zt, zt + 0.05, "hivis")
        for a in (a0, a1):                                                   # orange edge trim
            k.box(*at(1.52, a)[:2], 0.0, 0.07, 0.05, zt, "hivis", rz=a)
        x, y = sq(a0 if c > 0 else a1)                                       # the face toward the room
        e = sq(c)
        mu, mv = (x + e[0]) / 2, (y + e[1]) / 2
        horiz = abs(abs(mv) - 1.5) < 1e-6
        def panel(z, h, w, col, off=0.004):
            if horiz:
                k.box(mu, mv + off * (1 if mv > 0 else -1), z, w, 0.012, h, col)
            else:
                k.box(mu + off * (1 if mu > 0 else -1), mv, z, 0.012, w, h, col)
        panel(0.2, 0.06, 0.9, "dark")
        for j in range(6):                                                   # a vent panel
            panel(1.0 + j * 0.09, 0.04, 0.6, "dark")
        panel(1.7, 0.5, 0.5, "steelD", off=0.006)                           # a service door, a status light
        panel(2.25, 0.06, 0.12, "green", off=0.01)
    canopy(k, ZC, "gm", "hivis")
    console(k, FRONT, ZB, "gm", "hivis")
    return wheel(k, "gm", "hivis")


# ---- s32 three columns ----------------------------------------------------------------------------------------------
def columns(k):
    """s32."""
    base_drum(k, "slbTeal", "medWhite", "steel", window=FRONT + 1.05, wcol="medWhite")
    for c in (FRONT + math.pi / 2, BACK, FRONT - math.pi / 2):
        corner_fill(k, c - 0.3, c + 0.3, 1.44, 0.0, ZB, "slbTeal", top="medWhite")     # the base's lug
        corner_fill(k, c - 0.3, c + 0.3, 1.44, ZC, ZC + 0.32, "slbTeal", top="medWhite")   # the canopy's
        u, v, _ = at(1.8, c)
        k.cyl(u, v, ZB, 0.13, ZC - ZB, "medWhite", sides=14)                 # the column
        for z in (ZB, ZC - 0.1):
            k.cyl(u, v, z, 0.17, 0.1, "slbTeal", top="steelL", sides=14)
        p = at(1.62, c + 0.12)
        tube(k, (p[0], p[1], ZB), (p[0], p[1], ZC), 0.035, "steelD")        # its conduit
        k.cyl(*at(1.8, c)[:2], ZC - 0.32, 0.135, 0.04, "slbCy", sides=14)
    canopy(k, ZC, "slbTeal", "medWhite")
    console(k, FRONT, ZB, "slbTeal", "medWhite")
    return wheel(k, "slbTeal", "medWhite")


# ---- s33 back tower -------------------------------------------------------------------------------------------------
def tower(k):
    """s33."""
    base_drum(k, "slbMach", "steelD", "steel", window=FRONT - 1.05, wcol="hazY")
    zt = ZC + 0.8
    a0, a1 = BACK - 0.8, BACK + 0.8
    corner_fill(k, a0, a1, 1.5, 0.0, zt, "slbMach", top="steelD")
    for a in (a0 + 0.02, a1 - 0.02):
        stripes(k, a, 0.0, zt, n=12)
    canopy(k, ZC, "slbMach", "hazY")
    zn = ZC + 0.62
    k.cyl(0, 0, ZC + 0.42, 0.42, 0.34, "slbMach", top="steelL", sides=16)   # the bearing housing and its neck
    beam(k, at(1.75, BACK, zn), (0, 0, zn), 0.5, 0.26, "slbMach", top="steelD")
    for s_ in (-1, 1):
        o = (math.cos(BACK + math.pi / 2) * 0.27 * s_, math.sin(BACK + math.pi / 2) * 0.27 * s_)
        tube(k, (o[0], o[1], zn - 0.06), (1.6 * math.cos(BACK) + o[0], 1.6 * math.sin(BACK) + o[1], zn - 0.06),
             0.035, "hazY")                                                  # cable runs along it
    ring(k, 0.43, ZC + 0.6, 0.03, 0.012, "slbAmb", n=24, skip=lambda i: i % 3 == 0)
    bu, bv, _ = at(1.9, BACK)
    k.cyl(bu, bv, zt, 0.12, 0.08, "steelD", sides=10)                        # the beacon
    k.cyl(bu, bv, zt + 0.08, 0.08, 0.1, "slbAmb", sides=10)
    console(k, FRONT, ZB, "slbMach", "hazY")
    return wheel(k, "slbMach", "hazY")


DESIGNS = {"s31": (towers, (3, 3)), "s32": (columns, (3, 3)), "s33": (tower, (3, 3))}
OVERLAYS = {}
