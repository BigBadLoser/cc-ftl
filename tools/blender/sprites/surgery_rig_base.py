"""The surgical rig's upright body and its operator console (surgery_rig.py builds the rest): a bolted plinth with a
hazard ring, a flared collar, two white armour shells over a gunmetal core with a lit waist band and a front panel, the
shoulder housing and the riser. Off the body's left side (-u) a projector on a bracket throws the surgeon's console: a
translucent pane facing -u (turned a little toward the viewer), where the operating surgeon stands, showing the patient lying on it, vitals and the tool rack.

The hologram is its own layer (`holo`): rendered alone with the rig as holdout and baked to partial alpha, as the
research bench's (research_kit.holo_item)."""
import math

from . import core

C = (0.0, -0.04)                                                  # the body's axis (local u, v)
LINE, FILM = "rgHolo", "rgHoloF"
LENS = (-0.42, 0.03, 0.82)                                        # the projector's lens
PANE = dict(u=-0.6, v=0.12, z=0.9, w=0.5, h=0.34, lean=0.3, yaw=0.5)   # the console pane: foot centre, width (along v), height


def at(r, a, z=0.0):
    return (C[0] + r * math.cos(a), C[1] + r * math.sin(a), z)


def body(R, on):
    k = R.k
    k.box(0, 0, 0.0, 0.62, 0.62, 0.05, "gmD", top="steel", bevel=0.03)                  # plinth
    n = 24
    for i in range(n):                                                                 # hazard ring on it
        a = (i + 0.5) * math.tau / n
        p = at(0.265, a)
        k.box(p[0], p[1], 0.05, math.tau * 0.265 / n * 1.06, 0.06, 0.008, "hazY" if i % 2 else "hazK", rz=a + math.pi / 2)
    for su in (-1, 1):                                                                 # corner bolts
        for sv in (-1, 1):
            k.cyl(su * 0.25, sv * 0.25, 0.05, 0.022, 0.014, "rgChrome", top="rgChrome", sides=8)
    k.cyl(*C, 0.05, 0.22, 0.15, "gm", top="gmD", sides=12, rtop=0.18)                  # flared collar
    k.cyl(*C, 0.2, 0.13, 1.22, "gm", sides=10)                                         # core
    k.cyl(*C, 0.22, 0.175, 0.5, "medWhite", top="plate", sides=12, rtop=0.168)          # lower shell
    k.box(C[0], C[1] + 0.165, 0.3, 0.11, 0.03, 0.26, "gmD", bevel=0.01)                # front panel and its lights
    for j, col in enumerate(("cyan", "green", "medRed")):
        k.box(C[0] - 0.025 + j * 0.025, C[1] + 0.18, 0.5, 0.016, 0.006, 0.016, col if on else "steelD")
    for j in range(3):                                                                 # vent slots
        k.box(C[0], C[1] + 0.179, 0.34 + j * 0.045, 0.07, 0.004, 0.018, "steelD")
    k.cyl(*C, 0.72, 0.185, 0.08, "gm", top="gmD", sides=12)                            # waist band
    k.cyl(*C, 0.75, 0.19, 0.02, "cyan" if on else "steelD", sides=12)                   # its light
    k.cyl(*C, 0.8, 0.172, 0.58, "medWhite", top="plate", sides=12, rtop=0.16)           # upper shell
    k.cyl(*C, 1.38, 0.2, 0.14, "steel", top="steelL", sides=12)                         # shoulder housing
    for i in range(8):
        p = at(0.17, (i + 0.5) * math.tau / 8)
        k.cyl(p[0], p[1], 1.52, 0.014, 0.012, "rgChrome", top="rgChrome", sides=6)
    k.cyl(*C, 1.52, 0.09, 0.36, "medWhite", top="plate", sides=10)                     # riser
    # the console projector, on a bracket off the waist band
    R.tube(at(0.17, math.pi, 0.76), (LENS[0] + 0.03, LENS[1] - 0.01, LENS[2] - 0.05), 0.024, "gm", sides=8)
    R.ball((LENS[0] + 0.02, LENS[1], LENS[2] - 0.02), 0.045, "gmD")
    R.tube((LENS[0] + 0.02, LENS[1], LENS[2] - 0.02), LENS, 0.03, "rgChromeD", sides=10)
    R.ball(LENS, 0.018, "cyan" if on else "steelD", seg=6)


def _q(R, pts, col):
    R.m.poly([core.G(*R.g(p)) for p in pts], col, flip=True)


def holo(R):
    """The console hologram (in surgery): the pane, turned a little toward the viewer, its light cone from the lens, the
    patient's outline lying on it with the incision marked, and a vitals trace. Few, bold strokes: it is a few dozen
    pixels across in game."""
    u0, v0, z0, w, h, ln, yaw = (PANE[k] for k in ("u", "v", "z", "w", "h", "lean", "yaw"))
    nu, nv = -math.cos(yaw), math.sin(yaw)                        # the pane's facing (toward the surgeon)
    au, av = math.sin(yaw), math.cos(yaw)                         # across it

    def P(x, t, off=0.0):                                         # x across (-0.5..0.5 of w), t up the pane (0..1)
        back = t * h * math.sin(ln) - off * math.cos(ln)
        return (u0 + au * x * w - nu * back, v0 + av * x * w - nv * back, z0 + t * h * math.cos(ln) + off * math.sin(ln))
    _q(R, [P(-0.5, 0), P(0.5, 0), P(0.5, 1), P(-0.5, 1)], FILM)
    edge = [P(-0.5, 0, 0.004), P(0.5, 0, 0.004), P(0.5, 1, 0.004), P(-0.5, 1, 0.004)]
    for a, b in zip(edge, edge[1:] + edge[:1]):
        R.tube(a, b, 0.007, LINE, sides=5)
    for c in (P(-0.5, 0), P(0.5, 0)):                                                  # the light cone
        R.tube(LENS, c, 0.008, FILM, sides=4)

    def line(pts, r=0.009):
        for a, b in zip(pts, pts[1:]):
            R.tube(P(*a, 0.006), P(*b, 0.006), r, LINE, sides=5)
    line([(-0.2, 0.6), (0.34, 0.6), (0.34, 0.84), (-0.2, 0.84), (-0.2, 0.6)])          # the patient: body,
    hc = [(-0.3 + 0.07 * math.cos(a), 0.72 + 0.13 * math.sin(a)) for a in (i * math.tau / 8 for i in range(9))]
    line(hc)                                                                           # head
    R.ball(P(0.0, 0.72, 0.01), 0.026, "red", seg=6)                                    # the incision
    line([(-0.4, 0.26), (-0.18, 0.26), (-0.1, 0.44), (0.0, 0.1), (0.08, 0.26), (0.4, 0.26)])   # vitals trace
