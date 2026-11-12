"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): twelve cassette slabs round a core on a
3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Parts in slab_kit.py; earlier rounds
in git history.

Round 10, after round 9's review (the ferris still a carnival; the tilt-out unreadable; the crane not liked; the tyre
and chain drives liked; all of them read as mechanisms, not as manufactured modules, too "open"): a module chassis
bounding the 3x3 (plinth, corner structure, a top frame holding the rotor's top bearing, so the rotor is held top and
bottom), still open so the slabs show:

  s28  robot cell (graphite, safety orange): a square plinth with louvred skirts and a striped access step at the
       front; four orange box posts (at the edge midpoints, a diamond) and a top frame whose X beams carry the bearing housing; the tyre drives in three
       corners; the rotor holds each slab's foot in a socket, its head through a slotted plate
  s29  lattice frame (machine green, yellow): lattice-truss corner posts and truss beams over the top; the chain drive
       from the left corner with its tensioner; the rotor a drum with a head ring, each slab clamped at foot and head
  s30  octagon frame, top belt (navy, white, red): a chamfered plinth, eight slim posts and an octagonal top frame; the
       rotor hangs from a top drum turned by a belt from a motor on the frame; the slabs' feet run on pins and rollers
       in a floor track"""
import math

from .slab_kit import (BACK, FRONT, R0, angles, at, bolts, cassette, frame, links, loop, motor, prism, ring, spring,
                       truss_beam, truss_post, tube, tyre_drive)
from .slab_study import L, beam

Q = 1.4                                             # the posts' centres: the edge midpoints (a diamond, so none
POSTS = [(Q, 0.0), (0.0, Q), (-Q, 0.0), (0.0, -Q)]  # stands in front of the front slab)
RIM = list(zip(POSTS, POSTS[1:] + POSTS[:1]))


def race(k, deck, z=0.12):
    """The slewing race on the plinth and the rotor's deck over it."""
    k.cyl(0, 0, z, 1.3, 0.06, "steelD", top="steel", sides=48)
    k.cyl(0, 0, z + 0.06, 1.27, 0.02, "dark", sides=48)
    k.cyl(0, 0, z + 0.08, 1.18, 0.12, deck, top="steelL", sides=48)


def cup(k, s, col, lever="hazY"):
    """A bolted socket round the slab's foot cap."""
    s.box(k, -0.1, 0.12, -0.5, 0.5, -0.32, 0.1, col, face="steelL")
    for w in (-0.38, 0.38):
        s.box(k, -0.06, 0.0, w - 0.03, w + 0.03, 0.1, 0.12, "steel")
    s.box(k, -0.04, 0.08, -0.06, 0.06, 0.1, 0.125, lever)


def edge_stripes(k, z, col0="hazY", col1="hazK"):
    """Hazard stripes along the plinth's two front edges."""
    for i in range(13):
        c = col0 if i % 2 else col1
        t = -1.2 + i * 0.2
        k.box(1.42, t, z, 0.08, 0.2, 0.012, c)
        k.box(t, 1.42, z, 0.2, 0.08, 0.012, c)


# ---- s28 robot cell -------------------------------------------------------------------------------------------------
def cell(k):
    """s28."""
    z0, zt = 0.42, 2.8
    zp = z0 + L - 0.14                                                       # the slotted plate
    k.box(0, 0, 0.0, 2.96, 2.96, 0.12, "steelD", top="steel")               # the plinth, louvred skirts
    for i in range(12):
        t = -1.1 + i * 0.2
        k.box(1.481, t, 0.025, 0.01, 0.12, 0.07, "dark")
        k.box(t, 1.481, 0.025, 0.12, 0.01, 0.07, "dark")
    race(k, "gm")
    ring(k, 1.2, 0.2, 0.14, 0.1, "gm", top="steelL")                        # the rim the tyres drive
    ring(k, 1.27, 0.22, 0.1, 0.035, "black")
    for a in (FRONT + math.pi / 2, BACK, FRONT - math.pi / 2):
        tyre_drive(k, a, "hivis", "steelD", rm=1.62)
    su, sv, _ = at(1.8, FRONT)                                               # the access step
    k.box(su, sv, 0.12, 0.6, 0.44, 0.05, "steel", top="steelL", rz=FRONT + math.pi / 2)
    for j in range(-2, 3):
        p = at(1.8, FRONT)
        o = (math.cos(FRONT + math.pi / 2) * j * 0.11, math.sin(FRONT + math.pi / 2) * j * 0.11)
        k.box(p[0] + o[0], p[1] + o[1], 0.17, 0.05, 0.4, 0.008, "hazY", rz=FRONT + math.pi / 2 + 0.6)
    for cu, cv in POSTS:                                                     # the posts and the top frame
        k.box(cu, cv, 0.12, 0.3, 0.3, 0.06, "steelD", top="steel", rz=FRONT)
        k.box(cu, cv, 0.18, 0.14, 0.14, zt - 0.18, "hivis", rz=FRONT)
        beam(k, (cu, cv, zt + 0.06), (0.25 * cu / Q, 0.25 * cv / Q, zt + 0.06), 0.12, 0.12, "gm", top="steelL")
    for a, b in RIM:
        beam(k, (*a, zt + 0.08), (*b, zt + 0.08), 0.16, 0.16, "hivis")
    k.cyl(0, 0, zt - 0.14, 0.3, 0.34, "gm", top="steelL", sides=16)        # the bearing housing
    bolts(k, 0.22, zt + 0.2, 8)
    k.cyl(0, 0, zt + 0.2, 0.1, 0.06, "hivis", sides=10)
    k.cyl(0, 0, 0.32, 0.3, zp - 0.32, "gm", top="steelL", sides=14)        # the rotor's core, its shaft
    k.cyl(0, 0, zp + 0.08, 0.12, zt - 0.14 - zp - 0.08, "steelL", sides=10)
    ring(k, 0.8, zp, 0.08, 0.72, "steelD", top="steel")                     # the slotted plate
    bolts(k, 0.5, zp + 0.08, 12)
    out = []
    for th in angles():
        s = cassette(k, frame(th, z0))
        out.append(s)
        cup(k, s, "gm")
    return out


# ---- s29 lattice frame ----------------------------------------------------------------------------------------------
def lattice(k):
    """s29."""
    z0, zt = 0.4, 2.95
    zh = z0 + L + 0.08                                                       # the head ring
    k.box(0, 0, 0.0, 2.96, 2.96, 0.12, "slbMach", top="steel")              # the plinth
    edge_stripes(k, 0.12)
    race(k, "slbMach")
    ring(k, 1.27, 0.2, 0.12, 0.05, "steelL", n=64, skip=lambda i: i % 2)   # the sprocket ring
    sa = FRONT + math.pi / 2                                                 # the chain drive, left corner
    C2, r1, r2 = at(1.55, sa), 1.31, 0.17
    links(k, loop((0, 0), r1, C2, r2), 0.21, closed=True)
    k.box(C2[0], C2[1], 0.0, 0.36, 0.36, 0.19, "steelD", top="steel", rz=sa)
    k.cyl(C2[0], C2[1], 0.19, r2, 0.1, "steelL", top="steel", sides=14)
    motor(k, C2[0], C2[1], 0.31, h=0.42, body="hazY")
    ta = sa + math.acos((r1 - r2) / 1.55)                                    # its tensioner, on the slack run
    d = (math.cos(ta), math.sin(ta))
    mid = ((r1 * d[0] + C2[0] + r2 * d[0]) / 2, (r1 * d[1] + C2[1] + r2 * d[1]) / 2)
    ip = (mid[0] + 0.1 * d[0], mid[1] + 0.1 * d[1])
    k.cyl(ip[0], ip[1], 0.19, 0.08, 0.12, "steel", top="steelL", sides=10)
    pv = (C2[0] + 0.16 * d[0], C2[1] + 0.16 * d[1])
    beam(k, (pv[0], pv[1], 0.3), (ip[0], ip[1], 0.3), 0.06, 0.05, "hazY")
    spring(k, (pv[0], pv[1], 0.25), (ip[0], ip[1], 0.25), r=0.03, n=3, col="hazY")
    for cu, cv in POSTS:                                                     # the lattice posts, truss top
        truss_post(k, cu, cv, 0.12, zt, "slbMach", w=0.18)
    for a, b in RIM:
        truss_beam(k, a, b, zt - 0.13, 0.24, "slbMach")
    for a in POSTS:
        truss_beam(k, a, (0.3 * a[0] / Q, 0.3 * a[1] / Q), zt - 0.13, 0.24, "slbMach", n=4)
    k.cyl(0, 0, zt - 0.3, 0.3, 0.36, "slbMach", top="steelL", sides=16)    # the bearing housing
    bolts(k, 0.22, zt + 0.06, 8, col="hazY")
    k.cyl(0, 0, 0.32, 0.36, zh + 0.1 - 0.32, "slbMach", top="steelL", sides=16)   # the rotor: drum, shaft
    for z in (0.8, 1.6):
        k.cyl(0, 0, z, 0.39, 0.08, "hazY", sides=16)
    k.cyl(0, 0, zh + 0.1, 0.13, zt - 0.3 - zh - 0.1, "steelL", sides=10)
    ring(k, R0, zh, 0.1, 0.12, "slbMach", top="steelL")                     # the head ring and its arms
    for a in (FRONT + 0.26, FRONT + 0.26 + math.tau / 3, FRONT + 0.26 - math.tau / 3):
        beam(k, at(0.34, a, zh + 0.05), at(0.96, a, zh + 0.05), 0.1, 0.1, "slbMach", top="steelL")
    out = []
    for th in angles():
        s = cassette(k, frame(th, z0))
        out.append(s)
        cup(k, s, "slbMach")
        s.box(k, L - 0.1, L + 0.1, -0.16, 0.16, -0.3, 0.09, "hazY")            # the head clamp
        s.box(k, L - 0.04, L + 0.04, -0.05, 0.05, 0.09, 0.11, "steel")
    return out


# ---- s30 octagon frame, top belt ------------------------------------------------------------------------------------
OCT = [(1.48, -0.9), (1.48, 0.9), (0.9, 1.48), (-0.9, 1.48), (-1.48, 0.9), (-1.48, -0.9), (-0.9, -1.48), (0.9, -1.48)]


def octagon(k):
    """s30."""
    z0, zt = 0.44, 3.2
    zd = zt - 0.52                                                           # the drum's foot
    zh = z0 + L + 0.18                                                       # the hanger arms
    prism(k, OCT, 0.0, 0.12, "navy", top="steel")                           # the plinth
    prism(k, [(u * 0.97, v * 0.97) for u, v in OCT], 0.12, 0.14, "steelD", top="steel")
    ring(k, R0, 0.14, 0.08, 0.16, "steelD", top="dark")                     # the floor track
    for r in (R0 - 0.09, R0 + 0.09):
        ring(k, r, 0.14, 0.1, 0.03, "steelL")
    ins = [(u * 0.95, v * 0.95) for u, v in OCT]
    for u, v in ins:                                                         # the posts
        k.box(u, v, 0.14, 0.12, 0.12, zt - 0.14, "navy")
    for (u0, v0), (u1, v1) in zip(ins, ins[1:] + ins[:1]):                   # the top frame, two cross beams
        beam(k, (u0, v0, zt + 0.07), (u1, v1, zt + 0.07), 0.14, 0.14, "navy")
    for a, b in (((-1.4, 0), (1.4, 0)), ((0, -1.4), (0, 1.4))):
        beam(k, (*a, zt + 0.06), (*b, zt + 0.06), 0.14, 0.12, "medWhite")
    k.cyl(0, 0, zt - 0.34, 0.26, 0.34, "navy", top="steelL", sides=16)     # the bearing housing
    k.cyl(0, 0, zd, 0.44, 0.18, "medWhite", top="steelL", sides=24)        # the drum, the belt, the motor
    mc = at(1.12, BACK)
    links(k, loop((0, 0), 0.46, mc, 0.12), zd + 0.03, closed=True, cols=("black",), h=0.12, w=0.03, pitch=0.1)
    k.cyl(mc[0], mc[1], zd, 0.12, 0.18, "steelL", top="steel", sides=12)
    motor(k, mc[0], mc[1], zd + 0.2, h=0.36, body="medRed")
    beam(k, (mc[0], mc[1], zt + 0.0), at(1.4, BACK, zt), 0.2, 0.06, "steelD", top="steel")
    tube(k, (mc[0], mc[1], zd + 0.62), (mc[0], mc[1], zt), 0.05, "steelD")
    k.cyl(0, 0, zd - 0.16, 0.62, 0.16, "navy", top="medWhite", sides=24)   # the rotor's hub
    out = []
    for th in angles():
        s = cassette(k, frame(th, z0))
        out.append(s)
        s.box(k, L, L + 0.14, -0.08, 0.08, -0.16, -0.04, "steelL")           # its hanger lug
        hp = s.p(L + 0.1, 0.0, -0.1)
        a = math.atan2(hp[1], hp[0])
        beam(k, at(0.58, a, zh), (hp[0], hp[1], zh), 0.08, 0.1, "navy", top="medWhite")   # its arm
        k.box(hp[0], hp[1], zh - 0.08, 0.12, 0.12, 0.14, "medRed", rz=a)
        s.box(k, -0.06, 0.0, -0.22, 0.22, -0.22, 0.0, "steelD", face="steel")   # its foot shoe, pin and roller
        f = s.p(0.0, 0.0, -0.1)
        tube(k, (f[0], f[1], z0 - 0.06), (f[0], f[1], 0.2), 0.03, "steelL")
        k.cyl(f[0], f[1], 0.16, 0.07, 0.06, "steel", top="steelL", sides=10)
    return out


DESIGNS = {"s28": (cell, (3, 3)), "s29": (lattice, (3, 3)), "s30": (octagon, (3, 3))}
OVERLAYS = {}
