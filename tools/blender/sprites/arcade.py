"""Arcade cabinet (family `arcade`, palette set "arcade"): a retro upright, 1x1, idle, `.unpowered` and `.active`
(`.active.f1` .. `.f3`: the game on the screen moves), four rotations. Local frame and placement: modkit.K (front = +v);
the player stands on the tile in front of it, facing it.

A tall cabinet between two profiled side panels (side art: a magenta field with a teal flash), a kick plate and a coin
door at the foot, a control deck sloping toward the player (a stick and three buttons), the monitor set back and tilted
under a hood, a marquee on top. Powered and idle: the marquee is lit and the screen shows a dim attract frame.
`.active`: the screen is lit with the game and the buttons glow. `.unpowered`: everything dark."""
from .modkit import K

W = 0.66          # outer width across the side panels
SIDE = 0.05       # side panel thickness
FRONT = 0.26      # the foot's front face (v)
BACK = -0.3       # the back (v)
DECK = 0.86       # control deck height at its front edge

BODY, BODY_D, ART, ART2, TRIM = "acBody", "acBodyD", "acArt", "acArt2", "acTrim"


def _sides(k):
    for su in (-1, 1):
        u = su * (W - SIDE) / 2
        k.box(u, (FRONT + BACK) / 2, 0.0, SIDE, FRONT - BACK, DECK, ART, top=ART)            # foot: full depth
        k.box(u, (0.08 + BACK) / 2, DECK, SIDE, 0.08 - BACK, 0.62, ART, top=ART)            # upper: set back
        k.box(u, -0.05, 1.48, SIDE, 0.5, 0.1, ART, top=ART)                                  # under the marquee
        k.box(u + su * 0.004, 0.0, 0.36, SIDE, 0.32, 0.5, ART2, rx=0.5)                     # the flash on the side
        k.box(u + su * 0.004, BACK + 0.03, 0.0, SIDE, 0.06, 1.58, BODY_D)                   # back edge trim
        k.box(u + su * 0.004, FRONT - 0.02, 0.0, SIDE, 0.05, DECK, TRIM)                     # front edge trim (T-molding)


def arcade(state, rot, frame=0):
    on, lit = state != "unpowered", state == "active"
    k = K(f"arcade_{state}_{frame}_{rot}", (1, 1), rot)
    _sides(k)
    iw = W - 2 * SIDE
    k.box(0, (FRONT + BACK) / 2 - 0.01, 0.0, iw, FRONT - BACK - 0.04, DECK - 0.04, BODY, top=BODY_D)  # lower body
    k.box(0, FRONT - 0.03, 0.0, iw, 0.02, 0.08, BODY_D)                                       # kick plate
    k.box(0, FRONT - 0.03, 0.22, 0.26, 0.02, 0.3, TRIM, bevel=0.01)                          # coin door
    for du in (-0.06, 0.06):
        k.box(du, FRONT - 0.015, 0.4, 0.05, 0.012, 0.08, "orange" if on else "rustD")        # coin slots (lit)
    k.box(0, FRONT - 0.015, 0.28, 0.16, 0.012, 0.03, "steelD")
    k.box(0, 0.12, DECK - 0.06, iw + 0.02, 0.3, 0.08, BODY_D, top=BODY, rx=-0.28)          # control deck, sloping
    k.box(0, 0.13, DECK + 0.005, iw - 0.06, 0.24, 0.01, "acDeck", rx=-0.28)                 # its printed overlay
    k.cyl(-0.15, 0.14, DECK - 0.01, 0.045, 0.02, "steelD", sides=10)                         # stick: base,
    k.cyl(-0.15, 0.14, DECK, 0.012, 0.11, "steelL", sides=6)                                 # shaft,
    k.cyl(-0.15, 0.14, DECK + 0.1, 0.035, 0.05, "acBtnR", top="acBtnR", sides=10)            # ball top
    for i, col in enumerate(("acBtnR", "acBtnY", "acBtnB")):                                 # three buttons
        u, v = 0.02 + i * 0.09, 0.15 - (i % 2) * 0.03
        k.cyl(u, v, DECK - 0.005 - v * 0.0, 0.026, 0.025, (col + "L") if lit else col, sides=10)
    k.box(0, -0.12, DECK, iw, 0.36, 0.06, BODY_D)                                            # monitor shelf
    k.box(0, -0.06, DECK + 0.02, iw - 0.02, 0.06, 0.52, BODY_D, rx=0.22)                      # bezel, tilted back
    screen = ("acScr" if lit else "acScrDim") if on else "dark"
    k.box(0, -0.03, DECK + 0.08, iw - 0.12, 0.02, 0.4, screen, rx=0.22)                      # the screen
    if lit:                                                                                  # the game on it:
        k.box(-0.13 + 0.06 * (frame % 4), -0.012, DECK + 0.32, 0.06, 0.012, 0.05, "acPix", rx=0.22)     # invaders row,
        k.box(0.12 - 0.06 * (frame % 4), -0.012, DECK + 0.26, 0.06, 0.012, 0.05, "acPix2", rx=0.22)
        k.box(-0.12 + 0.08 * ((frame * 3) % 4), -0.05, DECK + 0.12, 0.07, 0.012, 0.04, "acPix3", rx=0.22)  # player ship
        k.box(-0.12 + 0.08 * ((frame * 3) % 4), -0.04, DECK + 0.16 + 0.04 * frame, 0.015, 0.012, 0.04, "acPix3", rx=0.22)
    k.box(0, -0.06, DECK + 0.5, iw + 0.02, 0.36, 0.06, BODY_D, top=BODY)                      # hood over the screen
    k.box(0, 0.02, 1.4, iw, 0.06, 0.16, ("acMarq" if on else "acMarqOff"))                   # marquee
    k.box(0, 0.03, 1.46, iw - 0.16, 0.012, 0.05, ("acMarq2" if on else "acMarqOff"))         # its title band
    k.box(0, -0.05, 1.58, W + 0.02, 0.5, 0.04, BODY_D, top=BODY)                             # top cap
    k.box(0, BACK + 0.02, 0.0, iw, 0.04, 1.58, BODY_D)                                       # back panel
    return k.build()


def jobs(rots=range(4)):
    """Every rotation: idle (powered), .unpowered, .active and .active.f1..f3; the plain id is r0 idle."""
    out = []
    for r in rots:
        base = f"module.arcade.r{r}"
        for state, f, aid in [("idle", 0, base), ("unpowered", 0, base + ".unpowered")] + \
                [("active", f, base + ".active" + (f".f{f}" if f else "")) for f in range(4)]:
            out.append((aid, (1, 1), "prop", lambda r=r, s=state, f=f: arcade(s, r, f)))
        if r == 0:
            out.append(("module.arcade", (1, 1), "prop", lambda: arcade("idle", 0)))
    return out
