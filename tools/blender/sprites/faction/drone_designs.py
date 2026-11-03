"""Drone's straight-run designs (set 5). Its tops fill the face's block: "bay" (k, ax, plane, u0, u1, z0, z1, F)
opens it between proud columns and fills the opening; "middle" (k, ax, plane, u0, u1, z0, zt, f0, F: between its lit
strips, f0 its front's foot) the panel between the strips. Its ramps fill the shared "ramp" slot
(relief_style.Style.fill)."""
from .. import wall3d as T
from ..relief_style import Design
from .parts import LINE, PAINT, PX, PZ, flat, pipe, prism

DRONE_D = 2.5 * PX                  # the block's depth, and its slopes' run


def drone_middle(k, ax, plane, u0, u1, z0, zt, f0, F):
    """The base: the panel between the strips, darker, its front flush with theirs, its slopes 2 px in."""
    D = c = DRONE_D
    prism(k, ax, plane, u0, u1, [(0.0, z0 + 2 * PZ), (D, z0 + c + 2 * PZ), (D, zt - c - 2 * PZ), (0.0, zt - 2 * PZ)],
          F, 2)


def drone_red(k, ax, plane, u0, u1, z0, zt, f0, F):
    """T1-4: the red block there, set back a px, its slopes 2 px in, a seam across it."""
    D = c = DRONE_D
    Dr = D - 0.5 * PX
    red = [(0.0, z0 + 2 * PZ), (Dr, z0 + 2 * PZ + c * Dr / D), (Dr, zt - 2 * PZ - c * Dr / D), (0.0, zt - 2 * PZ)]
    prism(k, ax, plane, u0, u1, red, F, 2, cols=["fDM3", "fDM2", "fDM1", "fDM3"], cap="fDM3")   # (a muted maroon:
    flat(k, ax, plane, u0, u1, f0 + 0.14 + 3 * PZ, f0 + 0.166 + 3 * PZ, Dr + PAINT, "fDM3")      # its seam a step
                                                                                                 # under its front)


def _bay(k, ax, plane, u0, u1, z0, z1, F, fam, lvl):
    """The opened block's bay (u0..u1 x z0..z1): its back (fam, lvl), its lintel and sill."""
    T.paint(k, ax, plane, u0, u1, z0, z1, PAINT, fam, lvl)
    T.slab(k, ax, plane, u0, u1, z1 - 0.04, z1, PX, F, 2, ends=(False, False))
    T.slab(k, ax, plane, u0, u1, z0, z0 + 0.04, PX, F, 3, ends=(False, False))


def drone_rack(k, ax, plane, u0, u1, z0, z1, F):
    """T1-2: a dark bay behind a fine grid of dull red lines (set 5 T1-2's laser grid): rows 3 px apart right across
    it, columns 4 px apart, each line under a px thick (so it lands on one px row, not two)."""
    _bay(k, ax, plane, u0, u1, z0, z1, F, "rose", 0)
    a, b = T.snap(u0 + 0.04), T.snap(u1 - 0.04)
    za, zb = z0 + 0.06, z1 - 0.06
    th, tw = 0.6 * PZ, 0.6 * LINE
    nr = int((zb - za) / (3 * PZ))
    for i in range(nr + 1):                                 # its rows
        z = za + i * 3 * PZ
        flat(k, ax, plane, a, b, z, z + th, 3 * PAINT, "lvRS")
    nc = int((b - a) / (4 * LINE))
    for j in range(nc + 1):                                 # its columns
        u = a + j * 4 * LINE + 0.2 * LINE
        flat(k, ax, plane, u, u + tw, za, za + nr * 3 * PZ + th, 3 * PAINT, "lvRS")


def drone_machinery(k, ax, plane, u0, u1, z0, z1, F):
    """T1-3: machinery with a status light, a row of pipes under it, on a grey back."""
    _bay(k, ax, plane, u0, u1, z0, z1, F, F, 1)
    uc = (u0 + u1) / 2
    for a, b, za, zb_, lvl in ((u0 + 0.03, uc - 0.08, z1 - 0.24, z1 - 0.1, 4),           # parts in the bay
                               (uc + 0.08, u1 - 0.03, z1 - 0.3, z1 - 0.1, 3),
                               (u0 + 0.05, u1 - 0.05, z0 + 0.08, z0 + 0.13, 4)):
        T.slab(k, ax, plane, a, b, za, zb_, PX, F, lvl)
    for i, col in enumerate(("green", "flameY", "red")):                                        # the status light
        z = z1 - 0.12 - i * 0.06
        flat(k, ax, plane, uc - LINE, uc + LINE, z - 0.025, z + 0.025, PX, col)
    for z in (z0 + 0.19, z0 + 0.26, z0 + 0.33):                                         # a row of pipes under it
        pipe(k, [T.P(ax, plane, u, z, PX) for u in (u0 + 0.02, u1 - 0.02)], 0.03, "rose", 2, n=4,
             flat=(T.RAMPS["rose"][0][4], T.RAMPS["rose"][0][2]))


def drone_seams(plate, u0, u1, run_, **_):
    """B1-2: no outlined panel, two seams straight down it where the base design's panel has its sides
    (wall3d.skirt's outline, 0.08 in)."""
    for u in (u0 + 0.08 + LINE / 2, u1 - 0.08 - LINE / 2):
        plate([(u - LINE / 2, 0.02), (u + LINE / 2, 0.02), (u + LINE / 2, run_ - 0.05), (u - LINE / 2, run_ - 0.05)],
              PAINT, 0, 0.0)


DRONE_TOPS = (Design("block", middle=drone_middle), Design("rack", bay=drone_rack),
              Design("machinery", bay=drone_machinery), Design("red block", middle=drone_red))
DRONE_RAMPS = (Design("panel", slot_hole=(7.4 / 11, 9 / 11, 0.15, True)),   # (its handle slot cut into the ramp,
                                                                    # its top a px under a cell line (a cell shows as
                                                                    # 2.5 px), on the panel's bottom line: drone.DRONE_OD)
               Design("seams", ramp=drone_seams))
