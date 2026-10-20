"""Cryo pod (family `cryo`): 1x2, idle / `.active` / `.empty`, four rotations. Local frame and placement: modkit.K
(front = +v).

An upright capsule reclined back on a plinth, the long glass lid on its front, cyan lights down the lid frame, a vented
top unit, hoses out the back, a status panel on the front step.
  idle    closed, unpowered: dark glass
  active  occupied and frozen: the glass frosted over, a figure faintly behind it, the lights on
  empty   open: the glass retracted into the sides, the padded couch inside, the panel showing ready"""
import math

from .modkit import K, sprites

A = 0.3                       # recline from vertical
L = 1.62                      # capsule length
V0, Z0 = 0.42, 0.14           # bottom centre of the capsule front face


def _at(t, s):
    """(v, z) of a point t up the capsule axis and s out of its front face."""
    return V0 - t * math.sin(A) + s * math.cos(A), Z0 + t * math.cos(A) + s * math.sin(A)


def _part(k, u, t, s, su, sn, sl, col, top=None, bevel=0.0, taper=1.0):
    """A box centred t up the axis and s out, sized su across, sn along the face normal, sl along the axis."""
    v, z = _at(t, s)
    k.box(u, v, z - sl / 2, su, sn, sl, col, top=top, rx=A, bevel=bevel, taper=taper)


def _rod(k, u, p0, p1, r, col):
    """A square rod from (v, z) p0 to p1."""
    dv, dz = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dv, dz)
    k.box(u, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - n / 2, r, r, n + r, col, rx=math.atan2(-dv, dz))


def cryo(state, rot):
    on, empty = state == "active", state == "empty"
    k = K(f"cryo_{state}_{rot}", (1, 2), rot)
    k.box(0, -0.05, 0.0, 0.86, 1.5, 0.14, "gmD", top="gm", bevel=0.01)                   # plinth
    k.box(0, 0.78, 0.0, 0.7, 0.36, 0.08, "steel", top="steelL", bevel=0.01)              # front step
    k.box(0, 0.62, 0.14, 0.5, 0.12, 0.2, "steelD", top="steel", rx=-0.5)                  # status panel
    k.box(0, 0.67, 0.19, 0.36, 0.012, 0.1, ("cyan" if on else "green" if empty else "dark"), rx=-0.5)
    for su in (-1, 1):                                                                # hoses: from the back of the
        b = _at(1.05, -0.36)                                                          # shell, bending down into
        m = (b[0] - 0.12, b[1] - 0.35)                                                # the plinth
        _rod(k, su * 0.22, b, m, 0.07, "gm")
        _rod(k, su * 0.22, m, (m[0] - 0.02, 0.1), 0.07, "gm")
    _part(k, 0, L / 2, -0.17, 0.82, 0.34, L, "plate", top="medWhite", bevel=0.09)      # the shell, rounded
    _part(k, 0, L - 0.04, -0.14, 0.7, 0.3, 0.2, "gm", top="steelL", bevel=0.06, taper=0.8)   # top unit
    for i in range(3):                                                                # its vents
        _part(k, 0, L - 0.14 + i * 0.05, 0.035, 0.48, 0.012, 0.025, "gmD")
    _part(k, 0, 0.82, 0.03, 0.7, 0.05, 1.26, "steel", top="steelL")                     # lid frame
    if empty:                                                                         # open: the glass retracted
        _part(k, 0, 0.82, 0.04, 0.56, 0.05, 1.1, "steelL")                              # into the sides, the couch
        _part(k, 0, 0.74, 0.07, 0.4, 0.06, 0.9, "navy", top="navy", bevel=0.02)
        _part(k, 0, 1.28, 0.08, 0.28, 0.07, 0.16, "iceB", top="iceB", bevel=0.02)       # headrest
        for t in (0.45, 0.9):                                                         # restraint straps
            _part(k, 0, t, 0.105, 0.42, 0.012, 0.04, "steelD")
        for su in (-1, 1):
            _part(k, su * 0.26, 0.82, 0.06, 0.05, 0.03, 1.1, "glassD")
    else:
        _part(k, 0, 0.82, 0.06, 0.56, 0.02, 1.1, "iceB" if on else "glassD")            # the glass
        if on:                                                                        # frost and a figure behind it
            _part(k, 0, 1.12, 0.072, 0.18, 0.01, 0.2, "glassL")                         # head
            _part(k, 0, 0.82, 0.072, 0.34, 0.01, 0.4, "glassL")                         # shoulders, chest
            for u, t, w, h in ((-0.2, 0.4, 0.14, 0.3), (0.18, 1.3, 0.16, 0.2), (0.0, 0.32, 0.3, 0.1),
                               (-0.22, 1.25, 0.1, 0.24), (0.21, 0.7, 0.1, 0.3)):
                _part(k, u, t, 0.074, w, 0.01, h, "medWhite")
    for su in (-1, 1):                                                                # lights down the frame
        _part(k, su * 0.37, 0.82, 0.04, 0.04, 0.04, 1.1, "cyan" if on else "steelD")
    return k.build()


def jobs(rots=range(4)):
    return sprites("module.cryo_pod", (1, 2), ("idle", "active", "empty"), cryo, rots)
