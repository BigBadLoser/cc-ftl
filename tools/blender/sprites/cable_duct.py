"""Ground power cable, the picked look (issue #514): a graphite box duct with an orange power stripe along both sides, laid
across levelled asteroid ground between base modules that no hull joins. Palette set cable.

One 1x1 sprite per tile by its connections: a 4-neighbour mask (N1 E2 S4 W8, grid N = -y, E = +x) of the sides the duct
leaves by, to another duct tile or into a module or wall, and the subset of those sides that are walls (`.w<walls>`). A
wall side ends in the bolted socket plate on that edge, built into the same sprite: as a separate overlay its far side
would paint over the duct in front of it.

  cable.duct.m<mask>[.w<walls>][.v1|.v2][.off]
    mask    sides with a connection; walls (a subset of mask) the sides that are a module or wall, omitted when none
    .v1-.v4 straight runs (mask 5 or 10, no wall): a hatch, a recessed vent grille, a breaker box, anchor brackets
    .off    unpowered: lamps dark
Anchored at the tile centre, footprint [1, 1].

The duct: a body from each connected edge in to the middle; a joint frame straddling each duct-to-duct edge (each tile
draws its half); a junction box where more than two sides meet, at a corner (a mitred elbow) and at a dead end (a blind
end plate)."""
from . import core
from .cable_study import DIRS, PAL, _arms, _frame

assert PAL == "cable"
DW, DH = 0.16, 0.17                      # body half width and height
JW, JL = 0.02, 0.045                     # joint frame: how far it stands proud, how far it reaches in from the edge
BODY, TOP = "cbGraphD", "cbGraph"
FRAME, FRAME_TOP = "cbPipeD", "cbPipe"
STRIPE = "cbCabO"
CAP_TOP = TOP                            # tops of the vent rims and the breaker box
VARIANTS = (1, 2, 3, 4)
SZ0, SZH = 0.065, 0.045                  # stripe foot and height


def _lamp(lit):
    return "cbLit" if lit else "cbOff"


def _box(f, u, v, ax, length, w, z0, h, side, top):
    """A box centred at (u, v), `length` along the axis (ax 1: u, 0: v), `w` across."""
    f.box(u, v, z0, length if ax else w, w if ax else length, h, side, top=top)


def _at(ax, p, c):
    """Local (u, v) of position p along the duct's axis and c across it."""
    return (p, c) if ax else (c, p)


def _span(f, ax, p0, p1, length=None, across=0.0, w=2 * DW, z0=0.0, h=DH, side=BODY, top=TOP):
    """A box from p0 to p1 along the axis (or `length` centred on p0), `w` across centred on `across`."""
    lo, hi = (p0 - length / 2, p0 + length / 2) if length else (min(p0, p1), max(p0, p1))
    u, v = _at(ax, (lo + hi) / 2, across)
    _box(f, u, v, ax, hi - lo, w, z0, h, side, top)


def _section(f, ax, p0, p1):
    """Plain duct from p0 to p1 along the axis: the body (one flat top) and the stripe."""
    _span(f, ax, p0, p1)
    _span(f, ax, p0, p1, w=2 * DW + 0.008, z0=SZ0, h=SZH, side=STRIPE)


def _arm(f, d, wall, inner=0.0):
    """The duct from edge d in to `inner` from the middle, and the joint frame or the socket plate on that edge."""
    ax = 1 if d[0] else 0
    k = d[0] + d[1]
    _section(f, ax, k * inner, k * 0.5)
    if wall:                                                                    # the socket plate against the wall
        _box(f, d[0] * 0.415, d[1] * 0.415, ax, 0.05, 2 * DW + 0.06, 0.0, DH + 0.04, FRAME, FRAME_TOP)      # collar
        _box(f, d[0] * 0.47, d[1] * 0.47, ax, 0.06, 2 * DW + 0.14, 0.0, DH + 0.12, FRAME, FRAME_TOP)        # plate
        for s in (-1, 1):                                                       # bolts on the plate's face
            pu, pv = (-d[1] * s, d[0] * s)
            f.box(d[0] * 0.435 + pu * (DW + 0.04), d[1] * 0.435 + pv * (DW + 0.04), DH + 0.04, 0.04, 0.04, 0.04,
                  FRAME, top="cbBoxL")
    else:                                                                       # this tile's half of the joint frame
        e = 0.5 - JL / 2
        _box(f, d[0] * e, d[1] * e, ax, JL, 2 * DW + 2 * JW, 0.0, DH + JW, FRAME, FRAME_TOP)


def _socket_lamp(f, d, lit):
    f.box(d[0] * 0.47, d[1] * 0.47, DH + 0.12, 0.06, 0.06, 0.025, "cbClampD", top=_lamp(lit))


def _hub(f, lit, arms):
    """Junction box (three or four sides), mitred elbow (a corner) or blind end (one side): a box over the middle."""
    w = 2 * DW + 0.08
    _box(f, 0, 0, 1, w, w, 0.0, DH + 0.05, BODY, TOP)
    _box(f, 0, 0, 1, w + 0.008, w + 0.008, SZ0, SZH, STRIPE, TOP)
    _box(f, 0, 0, 1, w - 0.1, w - 0.1, DH + 0.05, 0.015, FRAME, FRAME_TOP)                             # lid
    f.box(0.07, 0.07, DH + 0.065, 0.06, 0.06, 0.025, "cbClampD", top=_lamp(lit))
    if len(arms) == 1:                                                          # a blind end plate on the far side
        d = arms[0]
        _box(f, -d[0] * (w / 2 + 0.015), -d[1] * (w / 2 + 0.015), 1 if d[0] else 0, 0.03, w - 0.04, 0.02,
             DH + 0.01, FRAME, FRAME_TOP)


MID = 0.17                                   # a straight run's middle section: -MID..MID along the axis


def _middle(f, ax, lit, var):
    """A straight run's middle section, by variant: 1 a hatch with a handle and a lamp, 2 a recessed vent grille,
    3 a breaker box on the side with a hazard label, 4 ground anchor brackets bolted down each side."""
    if var != 2:
        _section(f, ax, -MID, MID)
    if var == 1:
        _span(f, ax, 0, 0, length=0.28, w=2 * DW - 0.06, z0=DH, h=0.014, side=FRAME, top=FRAME_TOP)     # hatch
        _span(f, ax, -0.05, 0, length=0.04, w=0.12, z0=DH + 0.01, h=0.02, side=FRAME, top=FRAME_TOP)       # handle
        u, v = _at(ax, 0.08, 0)
        f.box(u, v, DH + 0.01, 0.06, 0.06, 0.025, "cbClampD", top=_lamp(lit))
    if var == 2:                                                                # floor, rims, slats
        _span(f, ax, -MID, MID, h=DH - 0.05, top="cbTrench")
        _span(f, ax, -MID, MID, w=2 * DW + 0.008, z0=SZ0, h=SZH, side=STRIPE)
        for c in (-1, 1):
            _span(f, ax, -MID, MID, across=c * (DW - 0.02), w=0.04, top=CAP_TOP)
        for p in (-MID + 0.02, MID - 0.02):
            _span(f, ax, p, 0, length=0.04, top=CAP_TOP)
        for p in (-0.09, -0.03, 0.03, 0.09):
            _span(f, ax, p, 0, length=0.03, w=2 * DW - 0.08, z0=DH - 0.05, h=0.035)
    if var == 3:                                                                # breaker box, label, lamp
        _span(f, ax, 0, 0, length=0.24, across=DW + 0.06, w=0.12, h=DH + 0.07, top=CAP_TOP)
        _span(f, ax, 0, 0, length=0.16, across=DW + 0.123, w=0.008, z0=0.06, h=0.12, side="cbBand", top="cbBand")
        _span(f, ax, 0, 0, length=0.06, across=DW + 0.128, w=0.008, z0=0.09, h=0.06, side="cbBandK", top="cbBandK")
        u, v = _at(ax, 0.06, DW + 0.06)
        f.box(u, v, DH + 0.07, 0.06, 0.06, 0.025, "cbClampD", top=_lamp(lit))
    if var == 4:                                                                # anchor brackets
        for p in (-0.1, 0.1):
            for c in (-1, 1):
                _span(f, ax, p, 0, length=0.1, across=c * (DW + 0.065), w=0.13, h=0.025, side=FRAME, top=FRAME_TOP)
                _span(f, ax, p, 0, length=0.1, across=c * (DW + 0.016), w=0.032, h=DH - 0.03, side=FRAME,
                      top=FRAME_TOP)
                _span(f, ax, p, 0, length=0.045, across=c * (DW + 0.09), w=0.045, z0=0.025, h=0.025, side=FRAME,
                      top="cbBoxL")                                              # the bolt into the rock


def tile(mask, walls, lit, var=0):
    m = core.Mesh(f"cable_duct_{mask}_{walls}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    inner = MID if var and mask in (5, 10) else 0.0
    for _, (bit, d) in DIRS.items():
        if mask & bit:
            _arm(f, d, bool(walls & bit), inner)
    if mask not in (5, 10) and mask:
        _hub(f, lit, arms)
    elif not mask:
        _hub(f, lit, [])
    elif var:
        _middle(f, abs(arms[0][0]), lit, var)
    for _, (bit, d) in DIRS.items():                                         # socket lamps last (on top)
        if walls & bit:
            _socket_lamp(f, d, lit)
    return [m.build()]


def _subsets(mask):
    s = mask
    while True:
        yield s
        if s == 0:
            return
        s = (s - 1) & mask


def sid(mask, walls=0, var=0, lit=True):
    return f"cable.duct.m{mask}{f'.w{walls}' if walls else ''}{f'.v{var}' if var else ''}{'' if lit else '.off'}"


def jobs():
    out = []
    for lit in (True, False):
        for mask in range(16):
            for walls in sorted(_subsets(mask)):
                out.append((sid(mask, walls, 0, lit), (1, 1), "block", lambda mk=mask, w=walls, li=lit: tile(mk, w, li)))
            if mask in (5, 10):
                for v in VARIANTS:
                    out.append((sid(mask, 0, v, lit), (1, 1), "block", lambda mk=mask, vv=v, li=lit: tile(mk, 0, li, vv)))
    return out
