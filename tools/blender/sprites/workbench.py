"""Workbench (family `workbench`): 2x1 at r0 (1x2 turned), idle and `.active`, four rotations. Local frame and
placement: modkit.K (front = +v); the crew member stands on the tile in front of it, facing it.

A steel bench with a rubber work mat, a lower shelf with a toolbox and parts bins, a pegboard along the back with
hanging tools, a task lamp on an arm and a small diagnostics screen, a vise at the +u end and an opened-up device on
the mat. `.active`: the lamp, the screen and an arc spark at the device light up."""
from .modkit import K, sprites

TOP = 0.56


def workbench(state, rot):
    on = state == "active"
    k = K(f"workbench_{state}_{rot}", (2, 1), rot)
    for su in (-1, 1):                                                                # legs, rails, lower shelf
        for sv in (-1, 1):
            k.box(su * 0.86, sv * 0.3, 0.0, 0.07, 0.07, TOP - 0.06, "steelD", top="steel")
        k.box(su * 0.86, 0, 0.12, 0.05, 0.6, 0.05, "steelD")
    k.box(0, 0, 0.16, 1.7, 0.62, 0.04, "gm", top="steel")
    k.box(-0.45, 0.0, 0.2, 0.5, 0.3, 0.2, "medRed", top="rust", bevel=0.015)             # toolbox
    k.box(-0.45, 0.0, 0.4, 0.3, 0.04, 0.04, "steelL")
    for i, col in enumerate(("polyB", "hivis", "polyB")):                             # parts bins
        k.box(0.2 + i * 0.22, 0.05, 0.2, 0.18, 0.26, 0.12, col, bevel=0.01)
    k.box(0, 0, TOP - 0.06, 1.9, 0.76, 0.06, "steel", top="steelL", bevel=0.01)       # bench top
    k.box(-0.2, 0.06, TOP, 1.2, 0.5, 0.012, "navy")                                   # work mat
    k.box(0, -0.4, TOP, 1.9, 0.06, 0.72, "ochM", top="ochL")                           # pegboard (hardboard)
    k.box(0, -0.38, TOP, 1.92, 0.08, 0.07, "gmD", top="gm")                             # rail at its foot
    k.box(0, -0.4, TOP + 0.72, 1.94, 0.08, 0.04, "gmD", top="gm")                       # and its cap
    for i in range(9):
        for j in range(3):
            k.box(-0.8 + i * 0.2, -0.366, TOP + 0.18 + j * 0.18, 0.025, 0.012, 0.025, "ochD")
    for u, h, col in ((-0.75, 0.26, "steelD"), (-0.62, 0.2, "gmD"), (-0.5, 0.3, "polyB"), (-0.36, 0.22, "steelD")):
        k.box(u, -0.355, TOP + 0.62 - h, 0.035, 0.02, h, col)                        # hanging tools: spanners,
        k.box(u, -0.355, TOP + 0.62 - h - 0.02, 0.07, 0.02, 0.05, col)                  # screwdrivers, a blue one
    k.box(-0.15, -0.355, TOP + 0.36, 0.14, 0.02, 0.06, "gmD")                          # hammer head
    k.box(-0.15, -0.355, TOP + 0.18, 0.03, 0.02, 0.2, "rustD")
    k.box(0.15, -0.36, TOP + 0.3, 0.3, 0.03, 0.22, "gmD", bevel=0.01)                  # diagnostics screen
    k.box(0.15, -0.343, TOP + 0.32, 0.25, 0.012, 0.17, "dark")
    if on:
        for j in range(3):
            k.box(0.1 + 0.04 * j, -0.335, TOP + 0.36 + j * 0.035, 0.14 - 0.03 * j, 0.012, 0.022, "green")
    k.box(0.75, -0.37, TOP + 0.6, 0.04, 0.04, 0.2, "steelD")                           # lamp arm: up, then
    k.box(0.75, -0.24, TOP + 0.76, 0.04, 0.3, 0.04, "steelD")                          # forward over the mat
    k.box(0.75, -0.06, TOP + 0.64, 0.24, 0.18, 0.13, "gm", top="steelL", taper=0.55)   # its shade
    k.box(0.75, -0.06, TOP + 0.63, 0.2, 0.15, 0.012, "lampY" if on else "steelL")
    k.box(0.75, 0.03, TOP + 0.63, 0.2, 0.012, 0.05, "lampY" if on else "steelL")       # its lit lip
    k.box(0.78, 0.1, TOP, 0.2, 0.16, 0.08, "steelD", top="steel")                      # vise
    k.box(0.78, 0.1, TOP + 0.08, 0.22, 0.04, 0.1, "steel")
    k.box(0.78, 0.2, TOP + 0.08, 0.22, 0.04, 0.1, "steel")
    k.box(0.78, 0.26, TOP + 0.12, 0.03, 0.12, 0.03, "steelL")
    k.box(-0.15, 0.06, TOP + 0.012, 0.36, 0.26, 0.1, "plate", top="medWhite", bevel=0.01)  # the device, opened up:
    k.box(-0.15, 0.06, TOP + 0.112, 0.28, 0.18, 0.012, "pcb")                          # its board, its lid
    k.box(-0.15, -0.12, TOP + 0.03, 0.36, 0.03, 0.22, "plate", rx=-0.4)
    for du in (-0.08, 0.04):
        k.box(-0.15 + du, 0.04, TOP + 0.124, 0.06, 0.05, 0.03, "dark")
    k.box(0.15, 0.12, TOP + 0.012, 0.04, 0.2, 0.03, "hivis", rz=0.5)                   # a probe, loose on the mat
    if on:                                                                            # the arc where it's worked
        k.box(-0.05, 0.08, TOP + 0.13, 0.04, 0.04, 0.04, "arc")
        for a, b in ((0.04, 0.03), (-0.03, 0.05), (0.02, -0.04)):
            k.box(-0.05 + a, 0.08 + b, TOP + 0.15, 0.02, 0.02, 0.02, "flameW")
    return k.build()


def jobs(rots=range(4)):
    return sprites("module.workbench", (2, 1), ("idle", "active"), workbench, rots)
