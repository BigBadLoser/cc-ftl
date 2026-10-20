"""The ops consoles, comms and sensors: seated 2x2 stations in the console_proto style (same frame, desk, screen and chair
parts), registered into console_proto's tables on import, so consoles.py renders them with their desk-front overlays.

Both: the desk along the back row, the chair in one front tile, the station's signature piece in the other.
  comms   (orange)  spectrum and channel-list screens, a gooseneck mic; a radio rack with lit units, a dish and a whip
                    antenna in the side tile
  sensor  (magenta) contact and blip screens; a round radar plot table in the side tile: range rings, the sweep and
                    contacts when active"""
import math

from . import console_proto as C
from . import detail as D
from .console_proto import _g, desk, screen, strip, tdisc, tline, ybox


def _back(f, st, col, base):
    desk(f, 0.52, 0, 0, 1.94, 0.88, 0.55, st, col, nbtn=0, slab=False, base=base)
    _g("desk")
    ybox(f, 0.4, 0, 0.55, 0.36, 1.86, 0.1, "blueGrey", 0, top="plateB", lean=-0.1)
    strip(f, 0.4, -0.5, 0, 0.8, 0.65, 5, -0.12, st, col)
    strip(f, 0.4, 0.55, 0, 0.6, 0.65, 4, -0.12, st, col)


def comms(f, st):
    col = "orange"
    _back(f, st, col, "steel")
    wave = [(-0.5 + i / 27, 0.6 + 0.3 * math.sin(i * 0.47), 0.04, 0.05, "a") for i in range(28)]      # a waveform,
    ticks = [(-0.5 + i / 5, 0.0, 0.03, 0.05, "b") for i in range(6)]                                  # its scale
    screen(f, 0.62, -0.45, 0, 0.9, 0.58, 0.65, col, st, wave + ticks, lean=-0.14, d=0.1)
    chans = [(-0.15, 1.0 - i * 0.5, 0.65 - 0.2 * (i % 2), 0.035, "a") for i in range(3)]               # channel list,
    screen(f, 0.62, 0.5, 0, 0.62, 0.46, 0.65, col, st, chans + [(0.5, 1.0, 0.08, 0.035, "w")], lean=-0.14, d=0.1)
    _g("mic")                                                                      # gooseneck mic on the desk
    f.vcyl(0.2, -0.05, 0.65, 0.06, 0.03, "steelD", sides=8)
    D.seg(f, (0.2, -0.05, 0.68), (0.14, -0.1, 0.84), 0.018, "gm", 6)
    D.seg(f, (0.14, -0.1, 0.84), (0.02, -0.18, 0.9), 0.018, "gm", 6)
    ybox(f, 0.0, -0.19, 0.87, 0.07, 0.06, 0.06, "dark", top="gmD")
    _g("rack")                                                                     # radio rack in the side tile
    ru, rv = -0.45, 0.55
    ybox(f, ru, rv, 0.0, 0.62, 0.62, 1.0, "steelD", top="plate")
    for k in range(3):                                                             # rack units on the entry face
        z = 0.16 + k * 0.27
        ybox(f, ru - 0.31, rv, z, 0.02, 0.56, 0.22, "gm", top="gm")
        ybox(f, ru - 0.325, rv - 0.1, z + 0.07, 0.012, 0.26, 0.08, ("orange", "flameY", "orange")[k] if st else "dark")
        for j in range(2):
            ybox(f, ru - 0.33, rv + 0.12 + j * 0.1, z + 0.06, 0.03, 0.06, 0.06, "steelL" if j else "plate")
    for k in range(3):                                                             # and on the side the chair faces
        ybox(f, ru, rv - 0.31, 0.2 + k * 0.27, 0.5, 0.012, 0.06, ("lampY", "orange", "lampY")[k] if st else "gmD")
    _g("antenna")
    f.vcyl(ru + 0.1, rv + 0.1, 1.0, 0.04, 0.24, "gm", sides=6)                     # dish on a mast
    tdisc(f, ru + 0.1, rv + 0.1, 1.32, 0.6, 0.2, 0.04, "gmD", "steelL", 0.0)      # (a positive tilt: the face
                                                                                  # must point at the camera)
    tdisc(f, ru + 0.1, rv + 0.1, 1.32, 0.6, 0.04, 0.03, "orange" if st else "rustD", "orange" if st else "rustD",
          0.0, dz=0.06, sides=8)
    f.vcyl(ru - 0.18, rv - 0.18, 1.0, 0.012, 0.42, "steelL", sides=4)
    f.vcyl(ru - 0.18, rv - 0.18, 1.42, 0.025, 0.025, "orange" if st else "rustD", sides=6)
    C.chair(f, *C.CHAIR["comms"], st)


def sensor(f, st):
    col = "magenta"
    _back(f, st, col, "steelD")
    blips = [(-0.35, 0.7, 0.06, 0.06, "w"), (0.2, 0.4, 0.06, 0.06, "a"), (0.4, 0.85, 0.06, 0.06, "a"),
             (-0.1, 0.15, 0.06, 0.06, "b"), (0.0, 0.0, 0.9, 0.03, "a"), (0.0, 1.0, 0.9, 0.03, "a")]
    screen(f, 0.62, -0.45, 0, 0.9, 0.58, 0.65, col, st, blips, lean=-0.14, d=0.1)
    rows = [(-0.3, 1.0 - i * 0.3, 0.35, 0.045, "a") for i in range(4)] + [(0.4, 1.0 - i * 0.3, 0.2, 0.045, "b")
                                                                         for i in range(4)]
    screen(f, 0.62, 0.5, 0, 0.62, 0.46, 0.65, col, st, rows, lean=-0.14, d=0.1)
    _g("scope")                                                                    # radar plot table in the side tile
    pu, pv, pz, tl = -0.45, 0.5, 0.66, 0.35
    ybox(f, pu, pv, 0.0, 0.46, 0.46, 0.08, "gmD", top="gm")
    ybox(f, pu, pv, 0.08, 0.2, 0.2, pz - 0.14, "steel", top="steelL")
    tdisc(f, pu, pv, pz, tl, 0.4, 0.06, "steelD", "steelL", 0.33)                 # bezel
    tdisc(f, pu, pv, pz, tl, 0.34, 0.04, "dark", "navy" if st else "dark", 0.0, dz=0.008)
    ring = "magenta" if st else "navy"
    for r in (0.13, 0.25):                                                         # range rings
        tdisc(f, pu, pv, pz, tl, r, 0.012, ring, ring, r - 0.022, dz=0.03, sides=20)
    if st:
        a = 0.9                                                                    # the sweep and contacts
        tline(f, pu, pv, pz, tl, (0, 0), (0.31 * math.cos(a), 0.31 * math.sin(a)), 0.03, 0.02, 0.03, "magenta")
        for x, y in ((0.15, 0.17), (-0.18, 0.08), (0.05, -0.22)):
            tline(f, pu, pv, pz, tl, (x - 0.02, y), (x + 0.02, y), 0.045, 0.02, 0.032, "arc")
    for k in range(4):                                                             # bezel lamps
        a = k * math.tau / 4 + 0.4
        tline(f, pu, pv, pz, tl, (0.37 * math.cos(a) - 0.015, 0.37 * math.sin(a)),
              (0.37 * math.cos(a) + 0.015, 0.37 * math.sin(a)), 0.04, 0.02, 0.03, "magenta" if st and k % 2 else "gmD")
    C.chair(f, *C.CHAIR["sensor"], st)


C.FOOT.update(comms=(2, 2), sensor=(2, 2))
C.CHAIR.update(comms=(-0.5, -0.5), sensor=(-0.5, -0.5))
C.BUILD.update(comms=comms, sensor=sensor)
C.DIM.update(orange="ochD", magenta="navy")
C.BTN.update(orange=("orange", "flameY", "lampY"), magenta=("magenta", "arc", "blueN"))
