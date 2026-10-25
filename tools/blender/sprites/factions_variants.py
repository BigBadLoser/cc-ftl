"""Straight-wall variants for the faction looks, after the Space Haven reference sheets: each look's PAIRS list
(top design, ramp design) names its .a1 .. variants (structure.jobs), and its face reads wall3d.VARIANT while one
builds. The designs here are drawn into the look's own face (factions_relief) where its base part would be."""
from . import wall3d as T

PX, PAINT, LINE = T.PX, T.PAINT, T.LINE

DRONE_PAIRS = [(0, 1), (1, 0), (1, 1), (2, 0), (2, 1), (3, 0), (3, 1)]  # set 5: four tops x two ramps


def flat(k, ax, plane, u0, u1, z0, z1, d, col):
    """A patch of one palette name (col: a fixed colour, lit or not) standing d proud."""
    k.poly([T.P(ax, plane, u, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], "wall", 0, T.OUT(ax),
           fixed=col)


def drone_open(k, ax, plane, u0, u1, z0, z1, F, t):
    """The drone block's place between its columns (u0..u1 x z0..z1), opened: t 1 a dark rack of red-lit bars
    (set 5 T1-2), t 2 machinery with a status light (T1-3)."""
    fam, lvl = ("rose", 0) if t == 1 else (F, 1)                                                     # its back: dark,
    T.paint(k, ax, plane, u0, u1, z0, z1, PAINT, fam, lvl)                                           # or grey
    T.slab(k, ax, plane, u0, u1, z1 - 0.04, z1, PX, F, 2, ends=(False, False))                     # its lintel and
    T.slab(k, ax, plane, u0, u1, z0, z0 + 0.04, PX, F, 3, ends=(False, False))                     # sill
    if t == 1:
        nr, nc = 5, 3
        w = (u1 - u0 - 0.08) / nc
        for i in range(nr):
            z = z0 + 0.1 + i * (z1 - z0 - 0.2) / (nr - 1)
            for j in range(nc):
                a = u0 + 0.04 + j * w
                flat(k, ax, plane, a + LINE, a + w - LINE, z - 0.013, z + 0.013, 2 * PAINT, "emR")
    elif t == 2:
        uc = (u0 + u1) / 2
        for a, b, za, zb_, lvl in ((u0 + 0.03, uc - 0.08, z1 - 0.24, z1 - 0.1, 4),       # parts in the bay
                                   (uc + 0.08, u1 - 0.03, z1 - 0.3, z1 - 0.1, 3),
                                   (u0 + 0.05, u1 - 0.05, z0 + 0.08, z0 + 0.13, 4)):
            T.slab(k, ax, plane, a, b, za, zb_, PX, F, lvl)
        for i, col in enumerate(("green", "flameY", "red")):                                    # the status light
            z = z1 - 0.12 - i * 0.06
            flat(k, ax, plane, uc - LINE, uc + LINE, z - 0.025, z + 0.025, PX, col)
        from .factions_relief import pipe                                                       # a row of pipes
        for z in (z0 + 0.19, z0 + 0.26, z0 + 0.33):                                             # under it
            pipe(k, [T.P(ax, plane, u, z, PX) for u in (u0 + 0.02, u1 - 0.02)], 0.03, "rose", 2, n=4,
                 flat=(T.RAMPS["rose"][0][4], T.RAMPS["rose"][0][2]))


def drone_ramp(plate, u0, u1, run_, r):
    """The drone ramp's second design (set 5 B1-2): no outlined panel, two seams straight down it."""
    w = u1 - u0
    for u in (u0 + 0.3 * w, u1 - 0.3 * w):
        plate([(u - LINE / 2, 0.02), (u + LINE / 2, 0.02), (u + LINE / 2, run_ - 0.05), (u - LINE / 2, run_ - 0.05)],
              PAINT, 0, 0.0)
