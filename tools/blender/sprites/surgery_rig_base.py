"""The surgical rig's upright body and its operator console (surgery_rig.py builds the rest): a floor flange bolted
down, a flared collar, two white armour shells over a gunmetal core with a lit waist band and a front panel, the
shoulder housing and the riser. A projector set flush into the body's left side (-u) throws the surgeon's console: a
translucent pane beside it facing +v, across the bed's foot to the open tile on its other long side, where the operating surgeon stands, showing a body scan of
the patient with the incision marked, and the tool rack.

The hologram is its own layer (`holo`): rendered alone with the rig as holdout and baked to partial alpha, as the
research bench's (research_kit.holo_item)."""
import math

from . import core

C = (0.0, -0.04)                                                  # the body's axis (local u, v)
LINE, FILM = "rgHolo", "rgHoloF"
LENS_A, LENS_Z = math.pi - 0.35, 0.92                             # the projector: its heading round the body, height
LENS = (C[0] + 0.182 * math.cos(LENS_A), C[1] + 0.182 * math.sin(LENS_A), LENS_Z)   # its lens
PANE = dict(u=-0.6, v=0.15, z=0.86, w=0.42, h=0.5, lean=0.25, yaw=1.88)  # the console pane: foot centre, width, height; facing the tile across the bed's foot (0, 2)


def at(r, a, z=0.0):
    return (C[0] + r * math.cos(a), C[1] + r * math.sin(a), z)


def body(R, on):
    k = R.k
    k.cyl(*C, 0.0, 0.3, 0.04, "gmD", top="steel", sides=24)                            # the floor flange,
    for i in range(12):                                                                # bolted down
        p = at(0.255, (i + 0.5) * math.tau / 12)
        k.cyl(p[0], p[1], 0.04, 0.02, 0.018, "rgChrome", top="rgChrome", sides=6)
    k.cyl(*C, 0.04, 0.22, 0.03, "gm", top="gmD", sides=20)                             # its raised boss
    k.cyl(*C, 0.07, 0.2, 0.13, "gm", top="gmD", sides=12, rtop=0.18)                   # flared collar
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
    # the console projector, set into the upper shell's left side: a dark bezel, the lens just proud of it
    out = (math.cos(LENS_A), math.sin(LENS_A), 0.0)
    rim = at(0.15, LENS_A, LENS_Z)
    face = at(0.176, LENS_A, LENS_Z)
    R.tube(rim, face, 0.045, "gmD", sides=12)
    R.tube(face, tuple(face[i] + out[i] * 0.006 for i in range(3)), 0.026, "cyan" if on else "steelD", sides=10)


def _q(R, pts, col):
    R.m.poly([core.G(*R.g(p)) for p in pts], col, flip=True)


def holo(R, scan=None):
    """The console hologram (in surgery): a tall pane, light lines from the lens to its corners, and a body
    scan on it: the patient's outline standing, the incision marked across the belly, the tool rack beside it and the halo
    with its arms in use lit (the bed's own monitor already shows the trace). Few, bold strokes: it is a few dozen pixels across in game."""
    u0, v0, z0, w, h, ln, yaw = (PANE[k] for k in ("u", "v", "z", "w", "h", "lean", "yaw"))
    nu, nv = -math.cos(yaw), math.sin(yaw)                        # the pane's facing (toward the surgeon)
    au, av = math.sin(yaw), math.cos(yaw)                         # across it

    def P(x, t, off=0.0):                                         # x across (-0.5..0.5 of w), t up the pane (0..1)
        back = t * h * math.sin(ln) - off * math.cos(ln)
        return (u0 + au * x * w - nu * back, v0 + av * x * w - nv * back, z0 + t * h * math.cos(ln) + off * math.sin(ln))
    _q(R, [P(-0.5, 0), P(0.5, 0), P(0.5, 1), P(-0.5, 1)], FILM)
    edge = [P(-0.5, 0, 0.004), P(0.5, 0, 0.004), P(0.5, 1, 0.004), P(-0.5, 1, 0.004)]
    for a, b in zip(edge, edge[1:] + edge[:1]):
        R.tube(a, b, 0.006, LINE, sides=5)
    for c in (P(-0.5, 0), P(0.5, 0), P(-0.5, 1), P(0.5, 1)):                           # projection lines
        R.tube(LENS, c, 0.005, LINE, sides=4)

    def line(pts, r=0.006, col=LINE):
        for a, b in zip(pts, pts[1:]):
            R.tube(P(*a, 0.006), P(*b, 0.006), r, col, sides=5)
    cx = -0.1                                                                          # the body scan
    half = [(0.03, 0.77), (0.17, 0.72), (0.22, 0.44), (0.18, 0.42), (0.13, 0.62), (0.11, 0.46), (0.13, 0.36),
            (0.1, 0.07), (0.03, 0.07), (0.0, 0.32)]
    line([(cx + x, t) for x, t in half] + [(cx - x, t) for x, t in half[::-1]])
    rx, rt = 0.036 / w, 0.036 / h
    line([(cx + rx * math.cos(a), 0.845 + rt * math.sin(a)) for a in (i * math.tau / 10 for i in range(11))])
    line([(cx - 0.06, 0.53), (cx + 0.06, 0.53)], r=0.008, col="red")                    # the incision
    if scan is not None:                                                               # the scan line sweeping down
        t = 0.88 - 0.82 * scan
        line([(cx - 0.2, t), (cx + 0.2, t)], r=0.004, col="green")
    for j, t in enumerate((0.74, 0.62, 0.5)):                                          # the tool rack
        line([(0.26, t), (0.42, t)], r=0.009 if j == 0 else 0.006)
    rx, rt = 0.05 / w, 0.05 / h                                                        # the halo: its arms in use lit
    line([(0.33 + rx * math.cos(a), 0.2 + rt * math.sin(a)) for a in (i * math.tau / 12 for i in range(13))], r=0.005)
    for i in range(5):
        a = math.pi / 2 + i * math.tau / 5
        R.ball(P(0.33 + rx * math.cos(a), 0.2 + rt * math.sin(a), 0.008), 0.014 if i < 3 else 0.008, LINE, seg=6)
