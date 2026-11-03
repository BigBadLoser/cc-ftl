"""Straight-wall variants for the default look: a top design per field and a ramp design per skirt panel, picked by
wall3d.VARIANT = (top, ramp), 0 the base. Partitions after Space Haven set 7 (T1-2 three labels over a slatted
opening, T1-3 two drawers with tags, T1-4 the panel split in two), the far hull's recess after set 8's consoles
(T1-2 an LED readout and buttons, T1-3 a screen and keypad, T1-4 an indicator board), the ramp after set 7's B1-2
(corner dashes and a split plate low in the middle)."""
from . import wall3d as T

PX, PAINT, LINE = T.PX, T.PAINT, T.LINE
PAIRS = [(0, 1), (1, 0), (1, 1), (2, 0), (2, 1), (3, 0), (3, 1)]    # .a1 .. .a7 (the base is the plain id)


def lamp(k, ax, plane, u0, u1, z0, z1, d, col):
    """A lit patch (palette name col) standing d proud."""
    k.poly([T.P(ax, plane, u, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], "wall", 0, T.OUT(ax),
           fixed=col)


def _label(k, ax, plane, u0, u1, z1, F, n=2):
    """Ochre bars on a dark backing, hanging from z1."""
    T.paint(k, ax, plane, u0 - LINE, u1 + LINE, z1 - 0.03 - n * 0.085, z1 + 0.02, 3 * PAINT, F, 0)
    for j in range(n):
        bz = z1 - j * 0.085
        T.paint(k, ax, plane, u0, u1, bz - 0.05, bz, 4 * PAINT, "ochre", 3)


def wall_top(k, ax, plane, p0, p1, q0, q1, F, t):
    """A partition field's panel (inside its outline, p0..p1 x q0..q1) for top design t."""
    uc, w = (p0 + p1) / 2, p1 - p0
    if t == 1:                                          # three labels; a dark opening with slats under the middle
        _label(k, ax, plane, uc - 0.2 * w, uc + 0.2 * w, q1 - 0.07, F)
        for u in (p0 + 0.04, p1 - 0.04 - 0.1):
            _label(k, ax, plane, u, u + 0.1, q1 - 0.07, F)
        o0, o1, z0, z1 = uc - 0.2 * w, uc + 0.2 * w, q0 + 0.1, q1 - 0.3
        T.paint(k, ax, plane, o0, o1, z0, z1, 3 * PAINT, F, 0)
        z = z1 - 0.05
        while z > z0 + 0.03:                            # (horizontal slats, a px apart)
            T.paint(k, ax, plane, o0 + LINE, o1 - LINE, z - 0.026, z, 4 * PAINT, F, 1)
            z -= 0.052
    elif t == 2:                                        # two drawers, a small tag on each
        zm = (q0 + q1) / 2
        T.paint(k, ax, plane, p0 + LINE, p1 - LINE, zm - 0.013, zm + 0.013, 3 * PAINT, F, 1)
        for z0, z1 in ((q0, zm), (zm, q1)):
            zc = (z0 + z1) / 2
            T.paint(k, ax, plane, uc - 0.08, uc + 0.08, zc - 0.05, zc + 0.05, 3 * PAINT, F, 0)
            T.paint(k, ax, plane, uc - 0.06, uc + 0.06, zc - 0.035, zc + 0.035, 4 * PAINT, "ochre", 3)
            T.paint(k, ax, plane, p0 + 0.05, p1 - 0.05, z0 + 0.04, z0 + 0.066, 3 * PAINT, F, 1)   # its pull
    elif t == 3:                                        # split in two, each half with its own label
        T.paint(k, ax, plane, uc - LINE / 2, uc + LINE / 2, q0, q1, 3 * PAINT, F, 1)
        for c in ((p0 + uc) / 2, (uc + p1) / 2):
            hw = 0.3 * (uc - p0)
            _label(k, ax, plane, c - hw, c + hw, q1 - 0.07, F)
            T.paint(k, ax, plane, c - hw, c + hw, q0 + 0.12, q0 + 0.146, 3 * PAINT, F, 1)


def hull_recess(k, ax, plane, f0, f1, z0, z1, B, t):
    """The far hull's recess over its locker (f0..f1 x z0..z1) for top design t: a console in a dark bezel."""
    uc, w = (f0 + f1) / 2, f1 - f0
    T.paint(k, ax, plane, f0, f1, z0, z1, PAINT, B, 1)                                            # the recess
    b0, b1, c0, c1 = uc - 0.36 * w, uc + 0.36 * w, z0 + 0.06, z1 - 0.06
    T.slab(k, ax, plane, b0 - LINE, b1 + LINE, c0 - 0.03, c1 + 0.03, PX, B, 3, ends=(False, False))   # bezel
    T.paint(k, ax, plane, b0, b1, c0, c1, PX + PAINT, B, 0)
    d = PX + 2 * PAINT
    if t == 1:                                          # an LED readout, buttons under it
        r0 = c1 - 0.2
        for i in range(5):
            u = b0 + 0.04 + i * (b1 - b0 - 0.08) / 5
            lamp(k, ax, plane, u + LINE, u + (b1 - b0 - 0.08) / 5 - LINE, r0, c1 - 0.06, d, "red")
        for i, col in enumerate(("flameY", "green", "red", "flameY")):
            u = b0 + 0.05 + i * (b1 - b0 - 0.1) / 4
            lamp(k, ax, plane, u, u + 2 * LINE, c0 + 0.06, c0 + 0.11, d, col)
    elif t == 2:                                        # a green screen, a side light column, a keypad under it
        lamp(k, ax, plane, b0 + 0.04, uc + 0.06, c1 - 0.3, c1 - 0.05, d, "green")
        for i, col in enumerate(("flameY", "red", "flameY")):
            z = c1 - 0.08 - i * 0.07
            lamp(k, ax, plane, uc + 0.12, uc + 0.12 + 2 * LINE, z - 0.04, z, d, col)
        for i in range(3):
            for j in range(2):
                u, z = b0 + 0.06 + i * 3 * LINE, c0 + 0.06 + j * 0.06
                T.paint(k, ax, plane, u, u + 2 * LINE, z, z + 0.03, d, B, 4)
    elif t == 3:                                        # an indicator board
        for i in range(3):
            z = c1 - 0.06 - i * 0.08
            lamp(k, ax, plane, b0 + 0.04, b0 + 0.04 + 2 * LINE, z - 0.05, z, d, "flameY" if i != 1 else "red")
        for i, col in enumerate(("flameY", "red", "flameY", "red")):
            u = uc - 0.02 + i * 3 * LINE
            lamp(k, ax, plane, u, u + 2 * LINE, c1 - 0.1, c1 - 0.06, d, col)
        lamp(k, ax, plane, uc - 0.02, uc + 0.1, c0 + 0.05, c0 + 0.12, d, "green")
        lamp(k, ax, plane, uc + 0.12, uc + 0.12 + 3 * LINE, c0 + 0.05, c0 + 0.12, d, "red")


def ramp_panel(k, plate, u0, u1, run_, r):
    """A skirt panel under a field for ramp design r (r 1: two dashes at its top corners and a split plate low in the
    middle). plate(poly, rise, lvl, base) lays a plate on the slope ((u, distance down it) points)."""
    uc = (u0 + u1) / 2
    for a, b in ((u0 + 0.1, u0 + 0.22), (u1 - 0.22, u1 - 0.1)):
        plate([(a, 0.2 * run_), (b, 0.2 * run_), (b, 0.26 * run_), (a, 0.26 * run_)], PAINT, 1, 0.0)
    d0, d1 = 0.42 * run_, 0.82 * run_
    plate([(uc - 0.26, d0), (uc + 0.26, d0), (uc + 0.26, d1), (uc - 0.26, d1)], PAINT, 1, 0.0)   # its outline
    for a, b in ((uc - 0.26 + LINE, uc - LINE / 2), (uc + LINE / 2, uc + 0.26 - LINE)):
        plate([(a, d0 + 0.03), (b, d0 + 0.03), (b, d1 - 0.03), (a, d1 - 0.03)], PX, 3, 0.0)
