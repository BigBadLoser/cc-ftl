"""Medbay (family `medbay`): the med bed and the med console, idle and `.active`, four rotations. Local frame and
placement: modkit.K (front = +v).

  med_bed      1x2 like module.bed (head at the back, -v): the mattress top is at 0.22 (crew_clips.SLEEP_LIFT), so a
               patient is the sleep pose lying on it, as on a bed. A lift column, side rails, a vitals tower at the head
               (monitor, IV pole and bag). .active (a patient in it): a heartbeat trace on the monitor, a cyan strip
               under the mattress
  med_console  1x1 standing terminal: tilted screen, red cross, a scanner wand in its holster. .active: the patient
               readout lit"""
import math

from .modkit import K, sprites

MATTRESS = 0.22


def med_bed(state, rot):
    on = state == "active"
    k = K(f"med_bed_{state}_{rot}", (1, 2), rot)
    W, L = 0.84, 1.86
    k.box(0, 0, 0.0, 0.5, 1.2, 0.06, "gmD", top="gm")                                  # base skid
    k.box(0, 0, 0.06, 0.3, 0.7, 0.06, "steel", top="steelL")                            # lift column
    k.box(0, 0, 0.0, W, L, 0.08, "steelD", top="steel", bevel=0.01)                     # frame
    for su in (-1, 1):                                                                # castors
        for sv in (-1, 1):
            k.cyl(su * 0.34, sv * 0.82, 0.0, 0.05, 0.06, "dark", sides=8)
    k.box(0, 0, 0.08, W, L, 0.06, "medWhite", top="plate", bevel=0.01)                  # deck
    k.box(0, 0.06, 0.14, W - 0.06, L - 0.16, MATTRESS - 0.14, "plate", top="medWhite", bevel=0.03)   # mattress
    k.box(0, -0.7, MATTRESS, 0.56, 0.32, 0.06, "medWhite", bevel=0.025)                  # pillow
    k.box(0, 0.22, MATTRESS, W - 0.08, 0.9, 0.03, "iceB")                                # sheet
    if on:
        k.box(0, 0.06, 0.1, W + 0.01, L - 0.3, 0.03, "cyan")                            # underglow strip
    for su in (-1, 1):                                                                # side rails
        k.box(su * (W / 2 + 0.01), 0.15, MATTRESS + 0.02, 0.03, 0.9, 0.04, "steelL")
        for v in (-0.25, 0.55):
            k.box(su * (W / 2 + 0.01), v, MATTRESS - 0.04, 0.03, 0.03, 0.08, "steelL")
    k.box(0, L / 2 - 0.02, 0.06, W, 0.05, 0.36, "medWhite", top="plate", bevel=0.01)     # footboard
    k.box(0, L / 2 + 0.005, 0.22, 0.14, 0.02, 0.04, "medRed")                            # red cross on it
    k.box(0, L / 2 + 0.005, 0.18, 0.04, 0.02, 0.12, "medRed")
    v0 = -L / 2 - 0.0                                                                 # vitals tower at the head
    k.box(0.22, v0 + 0.06, 0.0, 0.26, 0.14, 1.0, "medWhite", top="plate", bevel=0.015)
    k.box(0.22, v0 + 0.14, 0.62, 0.32, 0.06, 0.26, "gmD", bevel=0.01)                    # monitor bezel
    k.box(0.22, v0 + 0.175, 0.65, 0.26, 0.02, 0.2, "dark")                               # screen
    if on:                                                                            # a heartbeat trace
        pts = [(-0.1, 0.0), (-0.05, 0.0), (-0.03, 0.06), (-0.01, -0.06), (0.01, 0.08), (0.03, 0.0), (0.1, 0.0)]
        for (a0, b0), (a1, b1) in zip(pts, pts[1:]):
            n = max(1, int(math.hypot(a1 - a0, b1 - b0) / 0.012))
            for i in range(n + 1):
                t = i / n
                k.box(0.22 + a0 + (a1 - a0) * t, v0 + 0.19, 0.74 + b0 + (b1 - b0) * t, 0.016, 0.012, 0.016, "green")
        k.box(0.32, v0 + 0.19, 0.84, 0.03, 0.012, 0.03, "cyan")
    for j, col in enumerate(("green" if on else "dark", "cyan" if on else "dark")):   # status lights on the tower
        k.box(0.15 + j * 0.12, v0 + 0.135, 0.42, 0.05, 0.012, 0.04, col)
    k.cyl(-0.3, v0 + 0.08, 0.0, 0.03, 1.3, "steelL", sides=6)                           # IV pole
    k.box(-0.3, v0 + 0.08, 1.24, 0.16, 0.03, 0.03, "steelL")
    k.box(-0.36, v0 + 0.08, 1.02, 0.1, 0.05, 0.18, "glassL", bevel=0.02)                 # IV bag
    k.box(-0.36, v0 + 0.08, 1.0, 0.03, 0.03, 0.04, "medRed")
    return k.build()


def med_console(state, rot):
    on = state == "active"
    k = K(f"med_console_{state}_{rot}", (1, 1), rot)
    k.box(0, -0.12, 0.0, 0.5, 0.36, 0.08, "gmD", top="gm")                              # foot
    k.box(0, -0.14, 0.08, 0.3, 0.24, 0.52, "medWhite", top="plate", bevel=0.02)          # pedestal
    k.box(0, -0.14, 0.34, 0.31, 0.25, 0.12, "steel")                                     # waist band
    k.box(0, 0.02 - 0.14, 0.6, 0.62, 0.36, 0.1, "medWhite", top="plate", bevel=0.02)     # desk
    th = 0.55                                                                         # tilted screen
    k.box(0, -0.2, 0.72, 0.58, 0.07, 0.4, "gmD", rx=th, bevel=0.012)
    nrm = (0, math.cos(th), math.sin(th))
    up = (0, -math.sin(th), math.cos(th))
    c0 = (0, -0.2, 0.92)
    def on_screen(u, w, h, du, col):
        p = [c0[i] + nrm[i] * 0.04 + up[i] * du for i in range(3)]
        k.box(u, p[1], p[2] - h / 2, w, 0.02, h, col, rx=th)
    on_screen(0, 0.5, 0.32, 0.0, "dark")
    if on:                                                                            # the patient readout: a body
        for u, w, h, du in ((-0.13, 0.05, 0.05, 0.1), (-0.13, 0.09, 0.11, 0.025), (-0.15, 0.03, 0.11, -0.085),
                            (-0.11, 0.03, 0.11, -0.085)):                             # scan, a trace, vitals bars
            on_screen(u, w, h, du, "cyan")
        pts = [(0.0, 0.08), (0.04, 0.08), (0.06, 0.13), (0.08, 0.03), (0.1, 0.1), (0.12, 0.08), (0.19, 0.08)]
        for (a0, b0), (a1, b1) in zip(pts, pts[1:]):
            n = max(1, int(math.hypot(a1 - a0, b1 - b0) / 0.012))
            for i in range(n + 1):
                on_screen(a0 + (a1 - a0) * i / n, 0.016, 0.016, b0 + (b1 - b0) * i / n, "green")
        for j, w in enumerate((0.16, 0.1)):
            on_screen(0.02 + w / 2, w, 0.03, -0.04 - j * 0.06, "green" if j else "cyan")
    k.box(0, -0.015, 0.21, 0.14, 0.02, 0.04, "medRed")                                   # red cross on the pedestal
    k.box(0, -0.015, 0.16, 0.04, 0.02, 0.14, "medRed")
    k.box(-0.33, -0.05, 0.36, 0.06, 0.12, 0.22, "gm", top="steelL")                      # scanner wand holster
    k.box(-0.33, -0.05, 0.56, 0.04, 0.05, 0.12, "steelL")                                # the wand
    k.box(-0.33, -0.05, 0.68, 0.06, 0.06, 0.03, "cyan" if on else "steelD")
    return k.build()


def jobs(rots=range(4)):
    return (sprites("module.med_bed", (1, 2), ("idle", "active"), med_bed, rots)
            + sprites("module.med_console", (1, 1), ("idle", "active"), med_console, rots))
