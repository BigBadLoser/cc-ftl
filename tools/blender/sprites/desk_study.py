"""Office desk look study (family `desk`, palette set `desk`, preview only): three generic desks, r0, in the console_proto
frame and parts, registered into its tables like console_ops, so consoles.console_items renders each with its chair and
the desk-front overlay over a seated operator.

Footprint 2x2 like the ops consoles: the desk along the back row (two tiles wide), the chair in the front-left tile facing
it, the front-right tile open floor. Each desk keeps a drawer pedestal under its right end (the end with no chair) and
knee room under the left. Frame: u depth (+u the desk's back, away from the operator), v across, z up, in tiles.

  d1 holo desk     a pale slab on one sculpted leg and the pedestal; an emitter bar along the back edge projects a
                   screen of light, and a key field glows on the bare top
  d2 workstation   a steel office desk: two monitors on a shared arm, a keyboard, a mug, a cable tray on the back
  d3 paper desk    a wooden top on a steel frame: a tilted drafting slate, stacked folders and tablets, a desk lamp,
                   a mug"""
from . import console_proto as C
from . import consoles
from .console_proto import _g, ybox

H = 0.5                                     # desktop height (the comms desk is 0.55; the chair's armrests top 0.59)
DU, DD, DW = 0.52, 0.8, 1.9                 # the desk's centre depth, its depth and width


def pedestal(f, body, face, handle, v=0.55, w=0.62):
    """A drawer pedestal under the right end: three drawers facing the operator side (-u), pull handles."""
    ybox(f, DU, v, 0.0, DD - 0.06, w, H - 0.04, body, top=body)
    for k in range(3):
        z = 0.04 + k * 0.145
        ybox(f, DU - (DD - 0.06) / 2 - 0.005, v, z, 0.02, w - 0.08, 0.125, face, top=face)
        ybox(f, DU - (DD - 0.06) / 2 - 0.02, v, z + 0.085, 0.02, 0.22, 0.02, handle, top=handle)


def mug(f, u, v, col):
    f.vcyl(u, v, H + 0.02, 0.05, 0.1, col, top="dkCoffee", sides=10)


# ---- d1 holo desk -------------------------------------------------------------------------------------------------
def d1(f, st):
    _g("desk")
    ybox(f, DU, 0, H - 0.05, DD, DW, 0.05, "dkWhiteD", top="dkWhite")                 # the slab
    ybox(f, DU - DD / 2 + 0.02, 0, H - 0.07, 0.04, DW - 0.04, 0.02, "dkTeal")         # a teal lip under the front edge
    ybox(f, DU + 0.1, -0.8, 0.0, 0.5, 0.12, H - 0.05, "dkWhiteD", top="dkWhite")       # the sculpted leg at the left end
    ybox(f, DU + 0.1, -0.8, 0.0, 0.6, 0.18, 0.04, "dkGrey")
    pedestal(f, "dkWhiteD", "dkWhite", "dkTeal")
    _g("holo")
    ybox(f, DU + 0.32, -0.3, H, 0.1, 1.2, 0.06, "dkGrey", top="dkGreyL")                  # the emitter bar
    ybox(f, DU + 0.3, -0.3, H + 0.03, 0.02, 1.1, 0.02, "dkHolo" if st else "dkTeal")      # its lens strip
    for dv in (-0.88, 0.28):                                                         # projector posts framing the screen
        ybox(f, DU + 0.32, dv, H, 0.06, 0.05, 0.68, "dkGrey", top="dkGreyL")
        ybox(f, DU + 0.29, dv, H + 0.6, 0.02, 0.03, 0.04, "dkHolo" if st else "dkTeal")
    if st:
        ybox(f, DU + 0.3, -0.3, H + 0.12, 0.01, 1.1, 0.45, "dkHoloD", lean=0.06)      # the projected screen
        for k, (dv, w, z) in enumerate(((-0.5, 0.5, 0.45), (-0.55, 0.4, 0.33), (0.0, 0.3, 0.45), (0.0, 0.3, 0.25))):
            ybox(f, DU + 0.29, dv, H + 0.12 + z * 0.9, 0.012, w, 0.03, "dkHolo")      # its lines of content
        ybox(f, DU + 0.29, 0.0, H + 0.18, 0.012, 0.3, 0.1, "dkHolo")
        ybox(f, DU - 0.18, -0.5, H, 0.24, 0.5, 0.008, "dkHoloD")                       # the key field on the top
        for k in range(3):
            ybox(f, DU - 0.26 + k * 0.08, -0.5, H + 0.004, 0.02, 0.44, 0.008, "dkHolo")
    else:
        ybox(f, DU - 0.18, -0.5, H, 0.24, 0.5, 0.004, "dkWhiteD")
    C.chair(f, *C.CHAIR["desk_d1"], st)


# ---- d2 workstation -----------------------------------------------------------------------------------------------
def monitor(f, u, v, st, glow):
    ybox(f, u, v, H + 0.24, 0.05, 0.5, 0.32, "dkCharcoal", top="dkCharcoal", lean=-0.04)
    ybox(f, u - 0.03, v, H + 0.27, 0.01, 0.44, 0.26, glow if st else "dkScreen", lean=-0.04)
    if st:
        for k in range(3):
            ybox(f, u - 0.038, v - 0.08 + 0.04 * (k % 2), H + 0.31 + k * 0.07, 0.005, 0.24 - 0.06 * k, 0.025, "dkScreenL")


def d2(f, st):
    _g("desk")
    ybox(f, DU, 0, H - 0.04, DD, DW, 0.04, "dkOliveD", top="dkOlive")                 # the top
    ybox(f, DU + DD / 2 - 0.04, -0.4, 0.06, 0.04, 1.0, H - 0.12, "dkSteelD")          # modesty panel at the back
    for dv in (-0.9,):                                                                # the left leg frame
        ybox(f, DU, dv, 0.0, DD - 0.08, 0.06, H - 0.04, "dkSteelD", top="dkSteel")
    pedestal(f, "dkSteelD", "dkSteel", "dkCharcoal")
    ybox(f, DU + 0.34, 0, H - 0.1, 0.1, 1.5, 0.06, "dkCharcoal")                      # cable tray under the back edge
    _g("screens")
    f.vcyl(DU + 0.25, -0.45, H, 0.09, 0.02, "dkCharcoal", sides=10)                        # the shared arm: a foot, a post,
    ybox(f, DU + 0.25, -0.45, H, 0.04, 0.04, 0.3, "dkSteel")                               # a cross bar
    ybox(f, DU + 0.24, -0.45, H + 0.3, 0.05, 1.0, 0.04, "dkSteel")
    monitor(f, DU + 0.2, -0.71, st, "dkScreenA")
    monitor(f, DU + 0.2, -0.19, st, "dkScreenB")
    _g("keys")
    ybox(f, DU - 0.2, -0.45, H, 0.16, 0.5, 0.025, "dkCharcoal", top="dkGreyL")         # keyboard
    ybox(f, DU - 0.2, -0.1, H, 0.1, 0.07, 0.025, "dkCharcoal", top="dkGreyL")         # mouse
    mug(f, DU - 0.1, 0.62, "dkRed")
    C.chair(f, *C.CHAIR["desk_d2"], st)


# ---- d3 paper desk ------------------------------------------------------------------------------------------------
def d3(f, st):
    _g("desk")
    ybox(f, DU, 0, H - 0.05, DD, DW, 0.05, "dkWoodD", top="dkWood")                   # the wooden top
    ybox(f, DU, -0.9, 0.0, DD - 0.1, 0.05, H - 0.05, "dkSteelD", top="dkSteel")      # a steel frame end
    ybox(f, DU, -0.9, 0.0, DD - 0.1, 0.12, 0.04, "dkSteelD")
    pedestal(f, "dkWoodD", "dkWood", "dkBrass")
    _g("slate")
    ybox(f, DU + 0.05, -0.35, H, 0.42, 0.62, 0.06, "dkCharcoal", top="dkCharcoal", lean=0.18)   # tilted drafting slate
    ybox(f, DU + 0.04, -0.35, H + 0.06, 0.36, 0.56, 0.01, "dkSlateL" if st else "dkScreen", lean=0.18)
    if st:
        for k in range(3):
            ybox(f, DU + 0.0 + 0.06 * k, -0.4 + 0.05 * k, H + 0.075, 0.015, 0.3, 0.008, "dkSlateLine", lean=0.18)
    _g("paper")
    for k, (z, col) in enumerate(((0.0, "dkFolderA"), (0.03, "dkPaper"), (0.045, "dkFolderB"), (0.075, "dkPaper"))):
        ybox(f, DU + 0.08, 0.35 + 0.02 * (k % 2), H + z, 0.28, 0.34, 0.03, col, top=col)   # a stack of folders
    ybox(f, DU - 0.22, 0.3, H, 0.16, 0.22, 0.015, "dkCharcoal", top="dkSlateL" if st else "dkScreen")  # a tablet
    _g("lamp")
    f.vcyl(DU + 0.3, 0.75, H, 0.08, 0.02, "dkBrass", sides=10)                         # desk lamp: base, stem, shade
    ybox(f, DU + 0.3, 0.75, H, 0.025, 0.025, 0.36, "dkBrass")
    ybox(f, DU + 0.22, 0.75, H + 0.3, 0.2, 0.06, 0.025, "dkBrass")
    f.vcyl(DU + 0.13, 0.75, H + 0.23, 0.07, 0.08, "dkGreen", top="dkGreen", rtop=0.04, sides=10)
    f.vcyl(DU + 0.13, 0.75, H + 0.21, 0.04, 0.02, "dkLamp" if st else "dkPaper", sides=8)
    mug(f, DU - 0.15, 0.68, "dkRed")
    C.chair(f, *C.CHAIR["desk_d3"], st)


NAMES = ("desk_d1", "desk_d2", "desk_d3")
C.FOOT.update({n: (2, 2) for n in NAMES})
C.CHAIR.update({n: (-0.5, -0.5) for n in NAMES})
C.EMPTY.update({n: [(-0.5, 0.5)] for n in NAMES})
C.BUILD.update(desk_d1=d1, desk_d2=d2, desk_d3=d3)
consoles.IDS.update({n: f"module.desk.{n[5:]}" for n in NAMES})
consoles.PAL.update({n: "desk" for n in NAMES})


def jobs():
    return consoles.jobs(NAMES, [0])
