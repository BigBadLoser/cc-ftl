"""REFINERY (module.refinery, 3x4, family `refinery`): raw ore in, metal and electronics out, in the machine kit's
language (machkit.py). Every design is one tall housing filling the footprint, its profile slotted where things go in
and out: a terminal niche at the access tile (beside the +u long side at v -0.5, sim access [3, 1]) and an output bay
behind it under a lintel. Three designs while we choose:

  A  spine     a raised spine of three crucible ports along the top, an ore intake stepped into the far end
  B  tower     a crucible tower rises out of the far end of the housing, lit through slit windows
  C  kiln      a rotary kiln lies half sunk in a trough along the top, between an intake hood and a discharge hood

Local frame: modkit.K, u across the 3-tile width, v along the 4."""
from mathutils import Vector

from . import machkit as M
from .modkit import K
from .steelkit import tube

FP = (3, 4)
U, V = 1.46, 1.96                    # the footprint's half extents, less a hair
S = U - 0.42                         # the back wall of the +u slots
TERM = (-0.95, -0.05)                # the terminal niche (v), at the access tile; its hood from TERM_Z up
OUT = (-1.82, -1.18)                 # the output bay (v); its lintel from OUT_Z up
TERM_Z, OUT_Z = 1.0, 0.72


def body(k, h, on, step=None):
    """The housing, h tall, its +u side slotted for the terminal and the output bay; step = v where the top steps down
    by 0.38 to the far (+v) end, for an intake."""
    vb = step if step else V
    M.hull(k, -U, S, -V, vb, 0, h, cv=(0.28, 0, 0, 0 if step else 0.28), ct=(0.12, 0, 0 if step else 0.12, 0.12))
    blocks = [(TERM[1], vb, 0, h, (0, 0.05, 0 if step else 0.28, 0), (0, 0.12, 0 if step else 0.12, 0)),
              (OUT[1], TERM[0], 0, h, (0, 0.05, 0.05, 0), (0, 0.12, 0, 0)),
              (-V, OUT[0], 0, h, (0, 0.28, 0.05, 0), (0.12, 0.12, 0, 0)),
              (TERM[0], TERM[1], TERM_Z, h, (0, 0, 0, 0), (0, 0.12, 0, 0)),                    # the hood over the terminal
              (OUT[0], OUT[1], OUT_Z, h, (0, 0, 0, 0), (0, 0.12, 0, 0))]                        # the lintel over the bay
    for v0, v1, z0, z1, cv, ct in blocks:
        M.hull(k, S, U, v0, v1, z0, z1, cv=cv, ct=ct)
    for v0, v1, z in ((TERM[0], TERM[1], TERM_Z), (OUT[0], OUT[1], OUT_Z)):                  # soffits, lit
        M.sbox(k, "+u", S, (v0 + v1) / 2, z - 0.03, v1 - v0, 0.4, 0.03, M.BODY_D)
        M.sbox(k, "+u", S, (v0 + v1) / 2, z - 0.05, v1 - v0 - 0.12, 0.06, 0.02, M.LIT if on else M.BODY_D, d0=0.3)
    if step:                                                                  # the stepped-down intake end
        M.hull(k, -U, U, step, V, 0, h - 0.38, cv=(0, 0, 0.28, 0.28), ct=(0, 0.12, 0.12, 0.12))
        grille(k, -0.85, 0.85, step + 0.12, V - 0.14, h - 0.38)
    terminal(k, on)
    output(k, on)


def terminal(k, on):
    """In the niche: a desk whose top slopes up toward the wall, the screen and buttons on the slope, a status lamp."""
    from .steelkit import face
    c, w = (TERM[0] + TERM[1]) / 2, 0.37
    M.sbox(k, "+u", S, c, 0, 2 * w, 0.34, 0.52, M.BODY, top=M.BODY_L)
    u0, u1, zb, zf = S, S + 0.36, 0.86, 0.56                                 # the slope: high at the wall, low in front
    for e, want in ((-1, (0, -1, 0)), (1, (0, 1, 0))):
        face(k, [(u0, c + e * w, 0.52), (u1, c + e * w, 0.52), (u1, c + e * w, zf), (u0, c + e * w, zb)], want, M.BODY)
    face(k, [(u1, c - w, 0.52), (u1, c + w, 0.52), (u1, c + w, zf), (u1, c - w, zf)], (1, 0, 0), M.TRIM)
    n = Vector((zb - zf, 0, u1 - u0)).normalized()
    face(k, [(u0, c - w, zb), (u1, c - w, zf), (u1, c + w, zf), (u0, c + w, zb)], n, M.BODY_D)

    def on_slope(t, sv, lift=0.008):                                      # t 0 at the wall .. 1 at the front edge
        p = Vector((u0 + (u1 - u0) * t, c + sv, zb + (zf - zb) * t)) + n * lift
        return tuple(p)
    face(k, [on_slope(0.08, -0.3), on_slope(0.62, -0.3), on_slope(0.62, 0.3), on_slope(0.08, 0.3)], n,
         M.SCREEN if on else M.DARK)
    for i, col in enumerate(("red", "flameY", "cyan", "green")):
        sv = -0.21 + i * 0.14
        face(k, [on_slope(0.72, sv - 0.04, 0.02), on_slope(0.88, sv - 0.04, 0.02), on_slope(0.88, sv + 0.04, 0.02),
                 on_slope(0.72, sv + 0.04, 0.02)], n, col if on else M.BODY_D)
    M.lamp(k, "+u", S, c + 0.3, TERM_Z - 0.12, on, w=0.06, h=0.05)


def output(k, on):
    """In the bay: a dark recess, ingots on the sill, boards on the shelf."""
    w, c = OUT[1] - OUT[0], (OUT[0] + OUT[1]) / 2
    M.sbox(k, "+u", S, c, 0.0, w, 0.004, OUT_Z, M.DARK)
    M.sbox(k, "+u", S, c, 0.0, w, 0.36, 0.12, M.BODY_D, top=M.BODY)
    M.sbox(k, "+u", S, c, 0.38, w, 0.26, 0.03, M.BODY_D, top=M.BODY)
    for i in range(3):
        hot = on and i == 0
        M.sbox(k, "+u", S, c + (i - 1) * 0.18, 0.12, 0.14, 0.08, 0.05, "orange" if hot else "steelL",
               top="orange" if hot else "plate", d0=0.2)
        M.sbox(k, "+u", S, c + (i - 1) * 0.18, 0.41, 0.14, 0.1, 0.015, "pcb", d0=0.1)


def grille(k, u0, u1, v0, v1, z):
    """An ore intake: a dark throat under bars, in a painted frame."""
    k.box((u0 + u1) / 2, (v0 + v1) / 2, z - 0.02, u1 - u0, v1 - v0, 0.03, M.DARK)
    n = max(3, round((u1 - u0) / 0.12))
    for i in range(1, n):
        k.box(u0 + (u1 - u0) * i / n, (v0 + v1) / 2, z, 0.025, v1 - v0, 0.03, M.BODY_D, top=M.BODY)
    for v in (v0, v1):
        k.box((u0 + u1) / 2, v, z, u1 - u0 + 0.06, 0.05, 0.05, M.TRIM, top=M.TRIM_L)
    for u in (u0, u1):
        k.box(u, (v0 + v1) / 2, z, 0.05, v1 - v0, 0.05, M.TRIM, top=M.TRIM_L)


def side_vents(k, on, z0, z1, vs=(-1.0, 0.75), w=1.1, near=True, front=True):
    """Vent bays round the housing: down the -u side, across both ends (near=False when the +v end is stepped), and
    on the +u side ahead of the terminal (front)."""
    for v in vs:
        M.vent(k, "-u", U, v, z0, z1, w, on)
    M.vent(k, "-v", V, 0.0, z0, z1, 1.7, on)
    if near:
        M.vent(k, "+v", V, 0.0, z0, z1, 1.7, on)
    if front:
        M.vent(k, "+u", U, 0.95, z0, z1, 1.3, on)


def variant_a(k, on):
    h = 1.2
    body(k, h, on, step=1.4)
    M.hull(k, -0.62, 0.62, -1.6, 1.25, h, h + 0.36, cv=0.14, ct=0.08, bevel=M.BODY)
    for v in (-0.98, 0.0, 0.98):
        M.port(k, 0.0, v, h + 0.36, 0.27, on)
    if on:
        for side in ("+u", "-u"):
            M.sbox(k, side, 0.62, -0.18, h + 0.14, 2.5, 0.01, 0.03, M.LIT)
    side_vents(k, on, 0.25, 0.95, near=False, front=False)
    M.vent(k, "+u", U, 0.62, 0.25, 0.95, 1.0, on)
    M.vent(k, "+v", V, 0.0, 0.18, 0.62, 1.7, on)


def variant_b(k, on):
    h = 1.05
    body(k, h, on)
    tu, tv, tw = 0.0, 1.05, 0.88                                              # the tower: centre, half width
    M.hull(k, tu - tw, tu + tw, tv - tw, tv + tw, h, 2.0, cv=0.32, ct=0.12)
    for side, pl, s in (("+u", tw, tv), ("-v", -(tv - tw), 0.0), ("-u", tw, tv)):
        for e in (-0.3, 0.0, 0.3):                                            # slit windows, lit within
            M.sbox(k, side, pl, s + e, 1.22, 0.1, 0.006, 0.55, M.DARK)
            M.sbox(k, side, pl, s + e, 1.27, 0.05, 0.01, 0.45, M.LIT if on else M.BODY_D)
            for z in (1.19, 1.77):
                M.sbox(k, side, pl, s + e, z, 0.16, 0.04, 0.03, M.TRIM_D, top=M.TRIM)
    k.cyl(tu, tv, 2.0, 0.5, 0.1, M.BODY_D, top=M.BODY, sides=20)                                # the cap
    M.port(k, tu, tv, 2.1, 0.3, False)                                                          # the ore intake
    k.cyl(-0.45, -1.4, h, 0.13, 0.75, M.BODY, top=M.DARK, sides=10)                              # the stack
    k.cyl(-0.45, -1.4, h + 0.6, 0.15, 0.07, M.TRIM, top=M.DARK, sides=10)
    for u, v in ((0.3, -0.55), (0.3, -1.3)):
        M.port(k, u, v, h, 0.2, on)
    side_vents(k, on, 0.22, 0.82, vs=(-1.0,), w=1.3)


def variant_c(k, on):
    h = 1.0
    body(k, h, on)
    a, b = Vector((0.0, -1.2, h + 0.05)), Vector((0.0, 1.2, h))               # the kiln's axis, falling to the discharge
    for e in (-1, 1):                                                         # the trough's walls
        M.hull(k, e * 0.62 - 0.17, e * 0.62 + 0.17, -1.25, 1.25, h, h + 0.2, cv=0.04, ct=0.05, bevel=M.TRIM_D,
               corner=None)
    tube(k, a, b, 0.46, M.BODY, sides=20, cap=M.DARK)
    for v in (-0.6, 0.6):                                                     # riding rings
        c = a.lerp(b, (v - a.y) / (b.y - a.y))
        tube(k, c - Vector((0, 0.06, 0)), c + Vector((0, 0.06, 0)), 0.52, M.TRIM, sides=20, cap=M.TRIM_D)
    for v in (-0.22, 0.18):                                                   # the hot seams
        c = a.lerp(b, (v - a.y) / (b.y - a.y))
        tube(k, c - Vector((0, 0.025, 0)), c + Vector((0, 0.025, 0)), 0.475, M.LIT if on else M.DARK, sides=20)
    M.hull(k, -0.9, 0.9, 1.2, V, h, 1.75, cv=(0, 0, 0.2, 0.2), ct=(0.08, 0.1, 0.1, 0.1))     # intake hood
    grille(k, -0.5, 0.5, 1.38, 1.8, 1.75)
    M.hull(k, -0.95, 0.95, -V, -1.2, h, 1.85, cv=(0.2, 0.2, 0, 0), ct=(0.1, 0.1, 0.08, 0.1))   # discharge hood
    k.cyl(-0.5, -1.6, 1.85, 0.13, 0.4, M.BODY, top=M.DARK, sides=10)
    k.cyl(-0.5, -1.6, 2.15, 0.15, 0.07, M.TRIM, top=M.DARK, sides=10)
    M.vent(k, "-v", V, 0.0, h + 0.15, h + 0.65, 1.2, on)
    side_vents(k, on, 0.22, 0.78)


VARIANTS = {"A": variant_a, "B": variant_b, "C": variant_c}


def refinery(variant, rot, on):
    k = K(f"refinery_{variant}_{rot}_{int(on)}", FP, rot)
    VARIANTS[variant](k, on)
    return k.build()
