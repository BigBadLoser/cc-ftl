"""Battery bank (family `battery`): 1x2, `.charge0` .. `.charge3`, four rotations. Local frame and placement:
modkit.K (front = +v).

Three heavy cells in a row along the bank, each with a charge window on both long sides (one of them faces the camera
in every rotation): the windows fill with cyan, one segment per charge step. A busbar along the tops, terminals, a
front panel with the three-bar gauge, a status lamp (red empty, orange low, green otherwise) and a breaker; the feed
cables leave from the back end."""
from .modkit import K, sprites

CHARGES = ("charge0", "charge1", "charge2", "charge3")
W, CELL, GAP, H = 0.78, 0.5, 0.06, 0.92


def battery(state, rot):
    n = CHARGES.index(state)
    k = K(f"battery_{state}_{rot}", (1, 2), rot)
    k.box(0, 0, 0.0, 0.9, 1.9, 0.08, "gmD", top="gm", bevel=0.01)                         # plinth
    for su in (-1, 1):                                                                # hazard edging
        k.box(su * 0.43, 0, 0.0, 0.04, 1.88, 0.081, "hazY")
    cv = [(-1 + i) * (CELL + GAP) - 0.06 for i in range(3)]                            # cell centres (front at +v)
    for v in cv:
        k.box(0, v, 0.08, W, CELL, H, "steel", top="steelL", bevel=0.02)               # the cell
        k.box(0, v, 0.08 + H - 0.1, W + 0.01, CELL + 0.01, 0.06, "navy")               # top band
        k.box(0, v, 0.12, W + 0.01, CELL + 0.01, 0.05, "gmD")                          # foot band
        for su in (-1, 1):                                                            # charge windows
            u = su * (W / 2 + 0.004)
            k.box(u, v, 0.27, 0.012, 0.25, 0.52, "gmD")                               # window frame
            k.box(u + su * 0.003, v, 0.29, 0.012, 0.2, 0.48, "dark")
            for j in range(3):
                k.box(u + su * 0.004, v, 0.31 + j * 0.155, 0.012, 0.16, 0.13, "cyan" if j < n else "blueGrey")
        for du, col in ((-0.17, "medRed"), (0.17, "dark")):                           # terminals
            k.cyl(du, v, 0.08 + H, 0.045, 0.07, col, sides=8)
            k.cyl(du, v, 0.08 + H + 0.07, 0.025, 0.04, "brass", sides=6)
    for du in (-0.17, 0.17):                                                          # busbars along the bank
        k.box(du, cv[1], 0.08 + H + 0.09, 0.05, 2 * (CELL + GAP) + 0.06, 0.03, "brass")
    vf = cv[2] + CELL / 2                                                             # front panel
    k.box(0, vf + 0.04, 0.08, 0.7, 0.08, 0.86, "gm", top="steelL", bevel=0.015)
    k.box(0, vf + 0.085, 0.55, 0.42, 0.012, 0.18, "dark")                              # gauge: three bars
    for j in range(3):
        on = j < n
        col = ("orange", "green", "green")[n - 1] if on else "blueGrey"
        k.box(-0.13 + j * 0.13, vf + 0.093, 0.58, 0.1, 0.012, 0.12, col)
    lamp_col = ("red", "orange", "green", "green")[n]
    k.box(0.24, vf + 0.09, 0.8, 0.07, 0.03, 0.06, lamp_col)                            # status lamp
    k.box(-0.18, vf + 0.09, 0.28, 0.16, 0.04, 0.16, "gmD")                             # breaker
    k.box(-0.18, vf + 0.12, 0.33, 0.04, 0.06, 0.12, "medRed" if n else "steelL")
    k.box(0.14, vf + 0.09, 0.2, 0.26, 0.012, 0.16, "hazY")                             # warning plate
    k.box(0.14, vf + 0.097, 0.24, 0.2, 0.012, 0.03, "hazK")
    vb = cv[0] - CELL / 2                                                             # feed cables out the back
    for du in (-0.17, 0.17):
        k.box(du, vb - 0.04, 0.08 + H - 0.2, 0.07, 0.08, 0.22, "dark")
        k.box(du, vb - 0.1, 0.0, 0.07, 0.07, 0.08 + H + 0.02, "dark")
    return k.build()


def jobs(rots=range(4)):
    return sprites("module.battery", (1, 2), CHARGES, battery, rots)
