"""Arcade cabinet (family `arcade`, palette set "arcade"): a retro upright, 1x1, idle, `.unpowered` and `.active`
(`.active.f1` .. `.f3`: the game on the screen moves), four rotations. Local frame and placement: modkit.K (front = +v);
the player stands on the tile in front of it, facing it.

A tall cabinet between two profiled side panels (side art: a magenta field with a teal flash), a kick plate and a coin
door at the foot, a flat control deck (a stick and three buttons), the monitor set back in a bezel under a hood, a marquee on top. Powered and idle: the marquee is lit and the screen shows a dim attract frame.
`.active`: the screen is lit with the game and the buttons glow. `.unpowered`: everything dark.
Every box is snapped to the pixel grid (modkit.K snap) and nothing is tilted, so the edges draw clean."""
from .modkit import K

G = 1 / 16        # the snap grid across the floor (2 px across, 1 px down): sizes are whole steps of it
W = 11 * G        # outer width across the side panels
SIDE = G          # side panel thickness
FRONT = 4 * G     # the foot's front face (v)
BACK = -5 * G     # the back (v)
DECK = 0.86       # control deck height
TOP = 1.58        # top of the cabinet

BODY, BODY_D, ART, ART2, TRIM = "acBody", "acBodyD", "acArt", "acArt2", "acTrim"


def _sides(k):
    for su in (-1, 1):
        u = su * (W - SIDE) / 2
        k.box(u, (FRONT + BACK) / 2, 0.0, SIDE, FRONT - BACK, DECK, ART, top=ART)            # foot: full depth
        k.box(u, (G + BACK) / 2, DECK, SIDE, G - BACK, TOP - DECK, ART, top=ART)            # upper: set back
        uo = su * W / 2                                                                      # proud of the panel:
        for i in range(4):                                                                   # the flash, a stepped band
            k.box(uo, FRONT - 2 * G - i * 2 * G, 0.24 + i * 0.1, 2 * G * 0.5, 2 * G, 0.18, ART2)
        k.box(uo, BACK + G / 2, 0.0, G * 0.5, G, TOP, BODY_D)                               # back edge trim
        k.box(uo, FRONT - G / 2, 0.0, G * 0.5, G, DECK, TRIM)                               # front edge trim


def arcade(state, rot, frame=0):
    on, lit = state != "unpowered", state == "active"
    k = K(f"arcade_{state}_{frame}_{rot}", (1, 1), rot, snap=True)
    _sides(k)
    iw = W - 2 * SIDE
    k.box(0, (FRONT + BACK) / 2 - G / 2, 0.0, iw, FRONT - BACK - G, DECK - 0.06, BODY, top=BODY_D)  # lower body
    k.box(0, FRONT - G, 0.0, iw, G, 0.08, BODY_D)                                            # kick plate (proud)
    k.box(0, FRONT - G, 0.2, 4 * G, G, 0.32, TRIM)                                           # coin door (proud)
    for du in (-1.5 * G, 1.5 * G):
        k.box(du, FRONT, 0.4, G, G * 0.5, 0.08, "orange" if on else "rustD")                 # coin slots (lit)
    k.box(0, FRONT, 0.28, 2 * G, G * 0.5, 0.03, "steelD")
    k.box(0, FRONT - 2 * G, DECK - 0.06, iw, 5 * G, 0.06, BODY_D, top="acDeck")             # control deck, flat,
    k.box(0, FRONT + G / 2, DECK - 0.1, iw, G, 0.1, TRIM)                                    # its front lip
    k.box(-3 * G, FRONT - 2 * G, DECK, G, G, 0.1, "steelL")                                  # stick: shaft,
    k.box(-3 * G, FRONT - 2 * G, DECK + 0.1, 2 * G, 2 * G, 0.05, "acBtnR", top="acBtnR")     # ball top
    for i, col in enumerate(("acBtnR", "acBtnY", "acBtnB")):                                 # three buttons
        k.box((i * 2) * G, FRONT - 2 * G, DECK, G, G, 0.03, (col + "L") if lit else col)
    k.box(0, -G * 2, DECK, iw, 4 * G, 0.06, BODY_D)                                          # monitor shelf
    k.box(0, -2 * G, DECK + 0.06, iw, 2 * G, 0.5, BODY_D)                                    # bezel
    screen = ("acScr" if lit else "acScrDim") if on else "dark"
    k.box(0, -G / 2, DECK + 0.12, iw - 2 * G, G, 0.38, screen)                               # the screen (proud)
    if lit:                                                                                  # the game on it:
        k.box(-3 * G + G * (frame % 4), 0, DECK + 0.4, G, G * 0.5, 0.05, "acPix")            # invaders,
        k.box(2 * G - G * (frame % 4), 0, DECK + 0.33, G, G * 0.5, 0.05, "acPix2")
        k.box(-2 * G + G * ((frame * 3) % 4), 0, DECK + 0.15, 2 * G, G * 0.5, 0.04, "acPix3")   # the player's ship
    k.box(0, -G, DECK + 0.56, iw, 4 * G, 0.06, BODY_D, top=BODY)                              # hood over the screen
    k.box(0, G / 2, 1.4, iw, G, 0.15, ("acMarq" if on else "acMarqOff"))                     # marquee (proud)
    k.box(0, G, 1.45, iw - 4 * G, G * 0.5, 0.05, ("acMarq2" if on else "acMarqOff"))         # its title band
    k.box(0, (G + BACK) / 2, TOP, W + G, G - BACK + G, 0.04, BODY_D, top=BODY)               # top cap
    k.box(0, BACK + G / 2, 0.0, iw, G, TOP, BODY_D)                                          # back panel
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
