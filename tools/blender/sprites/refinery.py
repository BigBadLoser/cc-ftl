"""REFINERY (module.refinery, 3x4, family `refinery`): raw ore in, metal and electronics out, in the machine kit's
language (machkit.py). Three designs while we choose:

  A  spine     a low armoured housing with a raised spine of three crucible ports, vent bays down its sides, an ore
               hatch at the far end
  B  crucible  a tall crucible drum banded in orange stands in a cradle at the far end, ducted into a processing block
  C  kiln      a rotary kiln on riding rings runs the length of a deck, between an intake hood and a discharge hood

Shared: the control console at the access tile (beside the +u long side at v -0.5, sim access [3, 1]) and the output
alcove next to it (ingots on the sill, boards on the shelf). The main housing stops short of the +u edge so these stand
flush with the footprint. Local frame: modkit.K, u across the 3-tile width, v along the 4."""
import math

from mathutils import Vector

from . import machkit as M
from .modkit import K
from .steelkit import tube

FP = (3, 4)
U, V = 1.46, 1.96                    # the footprint's half extents, less a hair
P = U - 0.16                         # the main housing's +u face: console and alcove stand in front of it
AV = -0.5                            # the access tile's v


def console(k, on, top=0.95):
    M.sbox(k, "+u", P, AV, 0.0, 0.66, 0.16, top, M.BODY, top=M.BODY_L)
    M.sbox(k, "+u", P, AV, top, 0.72, 0.18, 0.05, M.TRIM, top=M.TRIM_L, d0=-0.01)
    M.screen(k, "+u", U, AV + 0.04, top - 0.4, 0.46, 0.3, on)
    for i, c in enumerate(("red", "flameY", "cyan")):
        M.lamp(k, "+u", U, AV - 0.15 + i * 0.12, top - 0.52, on, col=c, w=0.07, h=0.05)
    M.sbox(k, "+u", P, AV, 0.0, 0.7, 0.18, 0.08, M.BODY_D, top=M.BODY)                     # kick plate


def output(k, on, s0=-1.6, s1=-0.95):
    """The output alcove: cheeks and a lintel framing a dark recess, ingots on the sill, boards on the shelf."""
    w, c = s1 - s0, (s0 + s1) / 2
    M.sbox(k, "+u", P, c, 0.08, w, 0.004, 0.5, M.DARK)
    for e in (s0, s1):
        M.sbox(k, "+u", P, e, 0.0, 0.05, 0.16, 0.6, M.TRIM_D, top=M.TRIM)
    M.sbox(k, "+u", P, c, 0.0, w, 0.16, 0.09, M.BODY_D, top=M.BODY)
    M.sbox(k, "+u", P, c, 0.32, w, 0.15, 0.03, M.BODY_D, top=M.BODY)
    M.sbox(k, "+u", P, c, 0.58, w + 0.06, 0.17, 0.06, M.TRIM, top=M.TRIM_L)
    for i in range(3):
        hot = on and i == 0
        M.sbox(k, "+u", P, c + (i - 1) * 0.17, 0.09, 0.13, 0.07, 0.05, "orange" if hot else "steelL",
               top="orange" if hot else "plate", d0=0.04)
        M.sbox(k, "+u", P, c + (i - 1) * 0.17, 0.35, 0.13, 0.09, 0.015, "pcb", d0=0.03)


def grille(k, u0, u1, v0, v1, z):
    """An ore hatch: a dark throat under bars, in a painted frame."""
    k.box((u0 + u1) / 2, (v0 + v1) / 2, z - 0.02, u1 - u0, v1 - v0, 0.03, M.DARK)
    n = max(3, round((u1 - u0) / 0.12))
    for i in range(1, n):
        k.box(u0 + (u1 - u0) * i / n, (v0 + v1) / 2, z, 0.025, v1 - v0, 0.03, M.BODY_D, top=M.BODY)
    for v in (v0, v1):
        k.box((u0 + u1) / 2, v, z, u1 - u0 + 0.06, 0.05, 0.05, M.TRIM, top=M.TRIM_L)
    for u in (u0, u1):
        k.box(u, (v0 + v1) / 2, z, 0.05, v1 - v0, 0.05, M.TRIM, top=M.TRIM_L)


def variant_a(k, on):
    M.hull(k, -U, P, -V, V, 0.0, 0.62, cv=0.26, ct=0.12)
    M.hull(k, -0.6, 0.6, -1.55, 1.25, 0.62, 1.2, cv=0.14, ct=0.08, bevel=M.BODY, top=M.BODY_L)
    for v in (-0.95, 0.0, 0.95):
        M.port(k, 0.0, v, 1.2, 0.27, on)
    if on:
        for side, pl in (("+u", 0.6), ("-u", 0.6)):
            M.sbox(k, side, pl, -0.15, 0.98, 2.4, 0.01, 0.03, M.LIT)
    for v in (-1.0, 0.95):
        M.vent(k, "-u", U, v, 0.14, 0.48, 1.2, on)
    M.vent(k, "+u", P, 1.0, 0.14, 0.48, 1.3, on)
    M.vent(k, "-v", V, 0.0, 0.14, 0.48, 1.6, on)
    grille(k, -0.55, 0.55, 1.42, 1.8, 0.62)
    console(k, on)
    output(k, on)


def variant_b(k, on):
    M.hull(k, -U, P, -V, V, 0.0, 0.3, cv=0.26, ct=0.08)
    cu, cv_, R = 0.0, 0.85, 0.8                                               # the crucible
    for a in range(4):                                                        # its cradle
        ang = math.pi / 4 + a * math.pi / 2
        u, v = cu + (R + 0.08) * math.cos(ang), cv_ + (R + 0.08) * math.sin(ang)
        M.hull(k, u - 0.12, u + 0.12, v - 0.12, v + 0.12, 0.3, 0.75, cv=0.04, ct=0.04, bevel=M.TRIM_D, corner=None)
    k.cyl(cu, cv_, 0.3, R, 1.15, M.BODY, top=M.BODY, sides=24)
    for z in (0.42, 1.22):
        k.cyl(cu, cv_, z, R + 0.035, 0.09, M.TRIM, top=M.TRIM_L, sides=24)
    k.cyl(cu, cv_, 0.76, R + 0.01, 0.08, M.LIT if on else M.DARK, sides=24)                   # the pour band
    k.cyl(cu, cv_, 1.45, R, 0.22, M.BODY_D, top=M.BODY_L, sides=24, rtop=R * 0.62)
    M.port(k, cu, cv_ + 0.1, 1.64, 0.26, False)                                               # the ore intake
    k.cyl(0.42, 1.3, 1.5, 0.12, 0.55, M.BODY, top=M.DARK, sides=10)                           # the stack
    k.cyl(0.42, 1.3, 1.9, 0.14, 0.07, M.TRIM, top=M.DARK, sides=10)
    M.hull(k, -U, P, -V, -0.08, 0.3, 0.98, cv=0.22, ct=0.1)                                  # the processing block
    M.hull(k, -0.32, 0.32, -0.3, 0.2, 0.55, 1.12, cv=0.06, ct=0.05, bevel=M.BODY)             # the duct between
    for u in (-0.55, 0.35):
        M.port(k, u, -1.05, 0.98, 0.2, on)
    M.vent(k, "-u", U, -1.0, 0.42, 0.8, 1.3, on)
    M.vent(k, "-v", V, 0.0, 0.42, 0.8, 1.9, on)
    console(k, on, top=1.05)
    output(k, on)


def variant_c(k, on):
    M.hull(k, -U, P, -V, V, 0.0, 0.3, cv=0.26, ct=0.08)
    a, b = Vector((0.0, -1.0, 1.02)), Vector((0.0, 1.1, 0.94))               # the kiln's axis (it falls to the discharge)
    for v, z in ((-0.55, 0.0), (0.55, 0.0)):                                  # piers and rollers under the riding rings
        M.hull(k, -0.5, 0.5, v - 0.13, v + 0.13, 0.3, 0.56, cv=0.05, ct=0.04, bevel=M.BODY, corner=M.TRIM_D)
        for u in (-0.3, 0.3):
            tube(k, (u, v - 0.09, 0.62), (u, v + 0.09, 0.62), 0.08, M.BODY_D, sides=10, cap=M.BODY)
    tube(k, a, b, 0.47, M.BODY, sides=20, cap=M.DARK)
    for v in (-0.55, 0.55):                                                   # riding rings
        t = (v - a.y) / (b.y - a.y)
        c = a.lerp(b, t)
        tube(k, c - Vector((0, 0.06, 0)), c + Vector((0, 0.06, 0)), 0.53, M.TRIM, sides=20, cap=M.TRIM_D)
    for v in (-0.2, 0.15):                                                    # the hot seams
        c = a.lerp(b, (v - a.y) / (b.y - a.y))
        tube(k, c - Vector((0, 0.025, 0)), c + Vector((0, 0.025, 0)), 0.485, M.LIT if on else M.DARK, sides=20)
    M.hull(k, -0.78, 0.78, 1.05, V, 0.3, 1.4, cv=0.14, ct=0.1)                              # intake hood
    grille(k, -0.42, 0.42, 1.3, 1.75, 1.4)
    M.hull(k, -0.9, 0.9, -V, -1.0, 0.3, 1.55, cv=0.16, ct=0.1)                              # discharge hood
    M.vent(k, "-v", V, 0.0, 0.5, 1.1, 1.2, on)
    k.cyl(-0.45, -1.55, 1.55, 0.13, 0.5, M.BODY, top=M.DARK, sides=10)                      # its stack
    k.cyl(-0.45, -1.55, 1.95, 0.15, 0.07, M.TRIM, top=M.DARK, sides=10)
    M.vent(k, "-u", U, 0.0, 0.08, 0.26, 1.6, on, n=12)
    console(k, on)
    output(k, on)


VARIANTS = {"A": variant_a, "B": variant_b, "C": variant_c}


def refinery(variant, rot, on):
    k = K(f"refinery_{variant}_{rot}_{int(on)}", FP, rot)
    VARIANTS[variant](k, on)
    return k.build()
