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
    """T1-3: on the bay's top half a frame right across it with three recessed slots side by side (mirror-symmetric: outer bars of 2 px,
    inner of 1, the slots the rest, the odd px to the middle one), the status light (green, yellow, red, one stack) installed
    in the middle slot; under it a block, two pipes
    stacked out of each side turning square into the bay's back."""
    _bay(k, ax, plane, u0, u1, z0, z1, F, F, 0)       # (the slots' backs the wall's darkest grey)
    a, b = (round(u * 32) for u in (u0, u1))            # (in px along the face)
    ob, ib = 2, 1                                       # (outer and inner bars)
    sw = (b - a - 2 * ob - 2 * ib) // 3
    mw = b - a - 2 * ob - 2 * ib - 2 * sw               # (the middle slot takes the odd px)
    edges = [a, a + ob]
    for w in (sw, ib, mw, ib, sw):
        edges.append(edges[-1] + w)
    edges.append(b)
    E = [e / 32 for e in edges]                         # bar, slot, bar, slot, bar, slot, bar
    za, zb = z0 + 0.04, z1 - 0.04                       # (sill to lintel)
    zf = zb - 10 * PZ                                   # the frame on the bay's top half (a px rail, a px, the
    D = PX / 2                                          # lights' 6 px, a px, a px rail); half a px deep
    for i in (0, 2, 4, 6):                                                               # the bars
        T.slab(k, ax, plane, E[i], E[i + 1], zf, zb, D, F, 3, ends=(False, False))
    for i in (1, 3, 5):                                                                  # rails above and below
        T.slab(k, ax, plane, E[i], E[i + 1], zb - PZ, zb, D, F, 3, ends=(False, False))         # each slot
        T.slab(k, ax, plane, E[i], E[i + 1], zf, zf + PZ, D, F, 3, ends=(False, False))
    uc = (E[3] + E[4]) / 2                              # the status light, in the middle slot on its dark back
    for i, col in enumerate(("green", "flameY", "red")):    # (one stack, 2 px each, 2 px wide: at this height the
        zl = zb - 2.5 * PZ - i * 2 * PZ                     # face's slant leaves each a clean 1 x 2 px)
        flat(k, ax, plane, uc - LINE, uc + LINE, zl - 2 * PZ, zl, 3 * PAINT, col)
    bl, br = E[3], E[4]                                 # under it a block the middle slot's width, proud
    zb0, zb1 = za + PZ, za + 8 * PZ
    T.slab(k, ax, plane, bl, br, zb0, zb1, 1.5 * PX, F, 2, ends=(True, True))
    fl = (T.RAMPS["rose"][0][4], T.RAMPS["rose"][0][2])                                   # and out of each side two
    for z in (za + 3 * PZ, za + 6 * PZ):                                                  # pipes stacked, each turning
        for u_in, u_out in ((bl, E[1] + LINE), (br, E[6] - LINE)):                       # square at the end into the
            pts = [T.P(ax, plane, u_in, z, PX), T.P(ax, plane, u_out, z, PX), T.P(ax, plane, u_out, z, 0.0)]   # back
            pipe(k, pts, 0.03, "rose", 2, n=4, flat=fl)


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
