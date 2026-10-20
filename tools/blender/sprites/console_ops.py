"""The ops consoles, comms and sensors: seated 2x2 stations in the console_proto style (same frame, desk, screen and chair
parts), registered into console_proto's tables on import, so consoles.py renders them with their desk-front overlays.

Both: the desk along the back row, the chair in one front tile, the station's signature piece in the other.
  comms   (orange)  spectrum and channel-list screens, a gooseneck mic; a radio rack with lit units, a dish and a whip
                    antenna in the side tile
  sensor  (magenta) contact and blip screens; a round radar plot table in the side tile: range rings, the sweep and
                    contacts when active"""
import math

from . import console_proto as C
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
    _g("mic")                                                                      # broadcast mic on a desk stand:
    f.vcyl(0.18, 0.08, 0.65, 0.1, 0.04, "steel", top="steelL", sides=10)           # base with an on-air light,
    ybox(f, 0.1, 0.08, 0.69, 0.04, 0.08, 0.025, "orange" if st else "rustD")        # stem, an upright capsule with a
    f.vcyl(0.18, 0.08, 0.69, 0.02, 0.1, "steelL", sides=6)                          # steel band and grille cap
    f.vcyl(0.18, 0.08, 0.79, 0.07, 0.17, "dark", rtop=0.07, sides=10)
    f.vcyl(0.18, 0.08, 0.86, 0.075, 0.03, "steelL", sides=10)
    f.vcyl(0.18, 0.08, 0.96, 0.07, 0.04, "steel", top="steelL", rtop=0.045, sides=10)
    _g("rack")                                                                     # radio rack in the side tile,
    ru, rv, rh = -0.45, 0.55, 0.62                                                 # about desk height
    ybox(f, ru, rv, 0.0, 0.62, 0.62, rh, "steelD", top="plate")
    for k in range(2):                                                             # rack units on the entry face
        z = 0.1 + k * 0.25
        ybox(f, ru - 0.31, rv, z, 0.02, 0.56, 0.21, "gm", top="gm")
        ybox(f, ru - 0.325, rv - 0.1, z + 0.065, 0.012, 0.26, 0.08, ("orange", "flameY")[k] if st else "dark")
        for j in range(2):
            ybox(f, ru - 0.33, rv + 0.12 + j * 0.1, z + 0.06, 0.03, 0.06, 0.06, "steelL" if j else "plate")
    for k in range(2):                                                             # and on the side the chair faces
        ybox(f, ru, rv - 0.31, 0.18 + k * 0.25, 0.5, 0.012, 0.06, ("lampY", "orange")[k] if st else "gmD")
    _g("antenna")
    du, dv = ru - 0.12, rv + 0.14                                                  # dish on a mast at the outer
    f.vcyl(du, dv, rh, 0.04, 0.14, "gm", sides=6)                                  # corner, clear of the desk
    tdisc(f, du, dv, rh + 0.22, 0.6, 0.18, 0.04, "gmD", "steelL", 0.0)             # (a positive tilt: the face
                                                                                  # must point at the camera)
    tdisc(f, du, dv, rh + 0.22, 0.6, 0.04, 0.03, "orange" if st else "rustD", "orange" if st else "rustD",
          0.0, dz=0.06, sides=8)
    f.vcyl(ru + 0.2, rv + 0.2, rh, 0.012, 0.4, "steelL", sides=4)                  # whip at the back corner
    f.vcyl(ru + 0.2, rv + 0.2, rh + 0.4, 0.025, 0.025, "orange" if st else "rustD", sides=6)
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
