"""What lies under the roof plating (roofs.py), for battle damage on a roofed ship: the slab's structure seen through a
tear in the armour. Per roof tile by its place (u, v) in its 4x4 armour module (roof_layout), so it lines up with the
plating: module girders under the frame rails on each module's N / W side, a joist at every other tile edge, light
purlins between them just under the plate, a duct and a cable tray, all over the dark inner pressure deck (roof holes
rarely go through: the deck holds).

piece(u, v, only=..., skip=...) renders subsets as wall3d_ext_stripped's: the frame alone (FRAME), its main members
(MAIN), or everything but the struts (STRUTS), which a tear snaps."""
from mathutils import Vector

from . import roof_layout as rl
from . import walls
from . import wall3d as T
from .wall3d_ext_diag import UP, _solid
from .wall3d_ext_stripped import FOG, RAMPS

ZB = walls.HF                       # the slab's underside (on the interior walls)
ZR = ZB + walls.ROOF_T              # the roof top: the plating
P = 1 / 32
PLATE = 1.5 * P                     # the armour plate's thickness (the structure stays under it)
DECK = 1 * P                        # the inner pressure deck's thickness
SEAM, SEAM_D = 1.6 * P, 0.5 * P     # its plates' gaps; the underlayer showing through them, this far down
GIRDER = (3 * P, 1 * P, 4 * P)      # a module girder: web half width, flange thickness, flange half width
JOIST = (1.5 * P, 3 * P)            # a joist: half width, its top this far under the plate
PURLIN = (1 * P, 2 * P)             # a purlin (a strut): half width, height (just under the plate)
DUCT = (0.12, 0.34, 3.5 * P)        # a duct along x: its y range (tile units), height over the deck
TRAY = (0.22, 0.36, 1.5 * P)        # a cable tray along y: its x range, its rim's height; cables in it
TONES = {"deck": ("grey", 2), "deck2": ("grey", 3), "seam": ("grey", 0), "rivet": ("grey", 4),
         "girder": ("grey", 5), "flange": ("grey", 6), "joist": ("grey", 6), "purlin": ("grey", 6),
         "duct": ("coolant", 6), "band": ("hazard", 6), "tray": ("grey", 3),
         "cable": ("grey", 4), "box": ("grey", 6), "light_c": None, "light_r": None}
LIGHTS = {"light_c": "fxC2", "light_r": "fxR"}
MAIN = frozenset(("girder", "flange", "joist"))
STRUTS = frozenset(("purlin",))
FRAME = MAIN | STRUTS
E = 0.5 + 1 / 64                    # a member runs this far each way (just past the tile edge: no seam)


def _tone(part, m, depth):
    if part in LIGHTS:
        return LIGHTS[part]
    ramp, i = TONES[part]
    RAMP = RAMPS[ramp]
    i += 1 if m.z > 0.6 else 0 if m.z > 0.15 else -1 if m.z > -0.4 else -3
    i -= 1 if m.x > m.y + 1e-6 else 0                      # (the side away from the light)
    i -= int(max(0.0, depth) / FOG)
    return RAMP[max(0, min(len(RAMP) - 1, i))]


def _box(x0, x1, y0, y1, z0, z1):
    return [(Vector((1, 0, 0)), x1), (Vector((-1, 0, 0)), -x0), (Vector((0, 1, 0)), y1), (Vector((0, -1, 0)), -y0),
            (UP, z1), (-UP, -z0)]


def _parts(u, v):
    """The tile's parts: [(planes, its top's depth under the plate, kind)]."""
    top = ZR - PLATE
    out = [(_box(-E, E, -E, E, ZB - SEAM_D, ZB), top - ZB, "seam")]   # (the deck: plates over a darker underlayer,
    cuts = (-0.5, 0.0, 0.5) if v % 2 == 0 else (-0.5, -0.25, 0.25, 0.5)  # their gaps its seams; staggered rows)
    for k, (a, b) in enumerate(zip(cuts, cuts[1:])):
        g = SEAM / 2
        kind = "deck" if (u * 3 + v + k) % 3 else "deck2"
        out.append((_box(a + g, b - g, -0.5 + g, 0.5 - g, ZB, ZB + DECK), top - ZB - DECK, kind))
        if kind == "deck2":                                     # (rivets at a plate's corners)
            for x_, y_ in ((a + 2 * P, -0.5 + 2 * P), (b - 2 * P, 0.5 - 2 * P)):
                rivet = _box(x_ - 0.5 * P, x_ + 0.5 * P, y_ - 0.5 * P, y_ + 0.5 * P, ZB + DECK, ZB + DECK + 0.4 * P)
                out.append((rivet, top - ZB - DECK, "rivet"))
    w, ft, fw = GIRDER
    for on, along in ((v == 0, "x"), (u == 0, "y")):        # (the module girders: under its N / W frame rails)
        if not on:
            continue
        a, b = -0.5, -0.5 + 2 * fw                          # (across the member: at the tile's N / W edge)
        web = (-E, E, a + fw - w, a + fw + w) if along == "x" else (a + fw - w, a + fw + w, -E, E)
        flange = (-E, E, a, b) if along == "x" else (a, b, -E, E)
        out.append((_box(*web, ZB, top - ft), ft, "girder"))
        out.append((_box(*flange, top - ft, top), 0.0, "flange"))
    jw, jd = JOIST
    if v % 2 == 1:                                          # (a joist at every other tile edge, along x)
        out.append((_box(-E, E, -0.5 - jw, -0.5 + jw, ZB, top - jd), jd, "joist"))
    if u % 2 == 1:                                          # (and along y)
        out.append((_box(-0.5 - jw, -0.5 + jw, -E, E, ZB, top - jd), jd, "joist"))
    pw, ph = PURLIN
    for c in (-0.25, 0.25):                                 # (purlins along y, just under the plate)
        out.append((_box(c - pw, c + pw, -E, E, top - ph, top), 0.0, "purlin"))
    if v == 2:                                              # (a duct along x, banded at each tile)
        y0, y1, dh = DUCT
        out.append((_box(-E, E, y0, y1, ZB + DECK, ZB + DECK + dh), top - ZB - DECK - dh, "duct"))
        out.append((_box(-0.06, 0.06, y0 - P, y1 + P, ZB + DECK, ZB + DECK + dh + P), top - ZB - DECK - dh - P,
                    "band"))
    if u == 1:                                              # (a cable tray along y, three cables in it)
        x0, x1, rh = TRAY
        z = ZB + DECK
        out.append((_box(x0, x1, -E, E, z, z + 0.5 * P), top - z, "tray"))
        for xr in (x0, x1 - P):
            out.append((_box(xr, xr + P, -E, E, z, z + rh), top - z - rh, "tray"))
        for k in range(3):
            cx = x0 + (1.5 + 2.5 * k) * P
            out.append((_box(cx, cx + 2 * P, -E, E, z + 0.5 * P, z + 2 * P), top - z - 2 * P, "cable"))
    if (u, v) in ((3, 1), (0, 3)):                          # (a junction box with its status light)
        out.append((_box(-0.1, 0.1, -0.08, 0.08, ZB + DECK, ZB + DECK + 3 * P), top - ZB - DECK - 3 * P, "box"))
        out.append((_box(-0.03, 0.0, 0.08, 0.08 + P, ZB + DECK + P, ZB + DECK + 2 * P), 0.0,
                    "light_c" if u == 3 else "light_r"))
    return out


def piece(u, v, only=None, skip=frozenset()):
    """The structure under roof tile (u, v) of its module; only / skip: as wall3d_ext_stripped.piece."""
    tag = ("_" + "_".join(sorted(only)) if only else "") + ("_no_" + "_".join(sorted(skip)) if skip else "")
    rel = T.Relief(f"roof_struct_{u}{v}{tag}")
    for planes, depth, kind in _parts(u, v):
        if (only is None or kind in only) and kind not in skip:
            for pts, m, _ in _solid(planes):
                rel.poly(pts, "steel", 3, m, fixed=_tone(kind, m, depth))
    return rel.build()


SPRITES = {f"roof.struct.{c}.{u}{v}": (lambda u=u, v=v, kw=kw: piece(u, v, **kw))
           for c, kw in (("s", {}), ("n", {"skip": STRUTS}), ("f", {"only": FRAME}), ("m", {"only": MAIN}))
           for u in range(rl.M) for v in range(rl.M)}
