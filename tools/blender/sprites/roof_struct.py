"""What lies under the roof plating (roofs.py), for battle damage on a roofed ship: the slab's structure seen through a
tear in the armour (the look: tools/damage_mock/roof_mock.py on art/walls-2x). Per roof tile by its place (u, v) in
its 4x4 armour module (roof_layout), so it lines up with the plating: module girders under the frame rails on each
module's N / W side, a joist at every other tile edge, light purlins just under the plate, a duct and a cable tray, all
over the inner pressure deck (seamed plates; roof holes do not go through: the deck holds).

Two layers per tile: `roof.struct.s.<u><v>` (all of it) and `roof.struct.n.<u><v>` (without the purlins: what shows
where a tear has snapped them)."""
from . import core
from . import roof_layout as rl
from . import walls

ZB = walls.HF                       # the slab's underside (on the interior walls)
ZR = ZB + walls.ROOF_T              # the roof top: the plating
P = 1 / 32
PLATE = 1.5 * P                     # the armour plate's thickness (the structure stays under it)
DECK = 1 * P                        # the inner deck's plates' thickness
SEAM, SEAM_D = 1.6 * P, 0.5 * P     # the gaps between them; the underlayer showing through, this far down
GIRDER = (3 * P, 1 * P, 4 * P)      # a module girder: web half width, flange thickness, flange half width
JOIST = (1.5 * P, 3 * P)            # a joist: half width, its top this far under the plate
PURLIN = (1 * P, 2 * P)             # a purlin (a strut): half width, height (just under the plate)
DUCT = (0.12, 0.34, 3.5 * P)        # a duct along x: its y range (tile units), height over the deck
TRAY = (0.22, 0.36, 1.5 * P)        # a cable tray along y: its x range, its rim's height; cables in it
E = 0.5 + 1 / 64                    # a member runs this far each way (just past the tile edge: no seam)
COLOURS = {"seam": "nvF6", "deck": "nvF5", "deck2": "nvF4", "rivet": "nvF2", "girder": "nvW5", "flange": "nvW4",
           "joist": "nvW5", "purlin": "nvW4", "duct": "gB3", "band": "c4T3", "tray": "nvF3", "cable": "nvF2",
           "box": "nvW5", "light_c": "fxC2", "light_r": "fxR"}   # (cool steel: the navy wall ramps)
STRUTS = frozenset(("purlin",))


def _box(x0, x1, y0, y1, z0, z1, kind):
    return (x0, x1, y0, y1, z0, z1), kind


def parts(u, v):
    """The tile's parts: [((x0, x1, y0, y1, z0, z1), kind)] (tile-local grid units, z up)."""
    top = ZR - PLATE
    out = [_box(-E, E, -E, E, ZB - SEAM_D, ZB, "seam")]
    cuts = (-0.5, 0.0, 0.5) if v % 2 == 0 else (-0.5, -0.25, 0.25, 0.5)   # (deck plates, staggered rows)
    for k, (a, b) in enumerate(zip(cuts, cuts[1:])):
        g = SEAM / 2
        kind = "deck" if (u * 3 + v + k) % 3 else "deck2"
        out.append(_box(a + g, b - g, -0.5 + g, 0.5 - g, ZB, ZB + DECK, kind))
        if kind == "deck2":                                                 # (rivets at a plate's corners)
            for x, y in ((a + 2 * P, -0.5 + 2 * P), (b - 2 * P, 0.5 - 2 * P)):
                out.append(_box(x - 0.5 * P, x + 0.5 * P, y - 0.5 * P, y + 0.5 * P, ZB + DECK, ZB + DECK + 0.4 * P,
                                "rivet"))
    w, ft, fw = GIRDER
    for on, along in ((v == 0, "x"), (u == 0, "y")):                        # (module girders under the N / W rails)
        if not on:
            continue
        a, b = -0.5, -0.5 + 2 * fw
        if along == "x":
            out.append(_box(-E, E, a + fw - w, a + fw + w, ZB, top - ft, "girder"))
            out.append(_box(-E, E, a, b, top - ft, top, "flange"))
        else:
            out.append(_box(a + fw - w, a + fw + w, -E, E, ZB, top - ft, "girder"))
            out.append(_box(a, b, -E, E, top - ft, top, "flange"))
    jw, jd = JOIST
    if v % 2 == 1:                                                          # (a joist at every other tile edge)
        out.append(_box(-E, E, -0.5 - jw, -0.5 + jw, ZB, top - jd, "joist"))
    if u % 2 == 1:
        out.append(_box(-0.5 - jw, -0.5 + jw, -E, E, ZB, top - jd, "joist"))
    pw, ph = PURLIN
    for c in (-0.25, 0.25):                                                 # (purlins along y, just under the plate)
        out.append(_box(c - pw, c + pw, -E, E, top - ph, top, "purlin"))
    z = ZB + DECK
    if v == 2:                                                              # (a duct along x, banded at each tile)
        y0, y1, dh = DUCT
        out.append(_box(-E, E, y0, y1, z, z + dh, "duct"))
        out.append(_box(-0.06, 0.06, y0 - P, y1 + P, z, z + dh + P, "band"))
    if u == 1:                                                              # (a cable tray along y, three cables)
        x0, x1, rh = TRAY
        out.append(_box(x0, x1, -E, E, z, z + 0.5 * P, "tray"))
        for xr in (x0, x1 - P):
            out.append(_box(xr, xr + P, -E, E, z, z + rh, "tray"))
        for k in range(3):
            cx = x0 + (1.5 + 2.5 * k) * P
            out.append(_box(cx, cx + 2 * P, -E, E, z + 0.5 * P, z + 2 * P, "cable"))
    if (u, v) in ((3, 1), (0, 3)):                                          # (a junction box with its status light)
        out.append(_box(-0.1, 0.1, -0.08, 0.08, z, z + 3 * P, "box"))
        out.append(_box(-0.03, 0.0, 0.08, 0.08 + P, z + P, z + 2 * P, "light_c" if u == 3 else "light_r"))
    return out


def piece(u, v, skip=frozenset()):
    """The structure under roof tile (u, v) of its module, without the kinds in `skip`."""
    m = core.Mesh(f"roof_struct_{u}{v}{'_n' if skip else ''}", flat=True)
    for (x0, x1, y0, y1, z0, z1), kind in parts(u, v):
        if kind not in skip:
            m.box(((x0 + x1) / 2, (y0 + y1) / 2, z0), (x1 - x0, y1 - y0, z1 - z0), COLOURS[kind], base=True)
    return [m.build()]


SPRITES = [(f"roof.struct.{c}.{u}{v}", (1, 1), "block", (lambda u=u, v=v, sk=sk: piece(u, v, sk)))
           for c, sk in (("s", frozenset()), ("n", STRUTS)) for v in range(rl.M) for u in range(rl.M)]
