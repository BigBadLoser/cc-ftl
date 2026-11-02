"""Salvage item art (family `salvage`): the scrap crates for derelict salvage and the cloth they refine into.

  item.<id>.unit   ONE crate (or one folded bolt) centred on the tile origin. The game stacks units itself on a fixed
                   slot grid (4 per level: back, right, left, front at 0.35 tile, a level per crate height), so a unit
                   must stack cleanly: flat top rim, nothing poking far above it.
  item.<id>.held   the small version a crew member carries.

The five scrap types share one crate body (open-topped dented steel, worn hazard edging along the rim, a type tag on
both faces the camera sees); the contents and the tag colour tell them apart. Grid frame as items.py: x, y on the deck,
z up, 1 unit = 1 tile, origin the tile centre at floor level. No randomness: placements are fixed tables."""
import math

from . import core

# ---- crate body --------------------------------------------------------------------------------------------------

S = 0.33          # crate footprint (square, tile units): the slot grid steps 0.35, so neighbours keep a hairline gap
H = 0.30          # crate height: 0.30 * ZPX ~ 12 px at 1x, one stack level
T = 0.022         # wall thickness
POST = 0.04       # corner post size
FILL = 0.17       # height of the interior floor the contents rest on

TAGS = {"hull": "hazK", "tech": "polyB", "energy": "hazY", "weapons": "medRed", "comfort": "pcb"}


def _hazard(m, x0, y0, x1, y1, z, n, worn):
    """A band of alternating yellow/black segments along a rim edge from (x0, y0) to (x1, y1) at height z; `worn`
    indexes the segments scuffed back to bare steel."""
    for i in range(n):
        if i in worn:
            col = "steelL"
        else:
            col = "hazY" if i % 2 == 0 else "hazK"
        a, b = i / n, (i + 1) / n
        xa, ya = x0 + (x1 - x0) * a, y0 + (y1 - y0) * a
        xb, yb = x0 + (x1 - x0) * b, y0 + (y1 - y0) * b
        cx, cy = (xa + xb) / 2, (ya + yb) / 2
        L = math.hypot(xb - xa, yb - ya)
        rz = math.atan2(yb - ya, xb - xa)
        m.box((cx, cy, z), (L, T + 0.006, 0.035), col, top=col, rz=rz, base=True)


def crate(m, tag, k=1.0):
    """The shared crate body, scaled by k, with its type tag colour `tag`."""
    s, h, t, p = S * k, H * k, T * k, POST * k
    e = s / 2
    m.box((0, 0, 0), (s - 0.03 * k, s - 0.03 * k, 0.03 * k), "dark", base=True)                # recessed skid
    m.box((0, 0, 0.03 * k), (s - t, s - t, FILL * k - 0.03 * k), "grime", top="dark", base=True)  # interior floor
    z0 = 0.03 * k
    wh = h - z0
    for (x, y, sx, sy) in ((e - t / 2, 0, t, s), (-e + t / 2, 0, t, s), (0, e - t / 2, s, t), (0, -e + t / 2, s, t)):
        m.box((x, y, z0), (sx, sy, wh), "plate", top="sole", base=True)
    for sx_, sy_ in ((1, 1), (1, -1), (-1, 1), (-1, -1)):                                         # corner posts
        m.box((sx_ * (e - p / 2 + 0.004 * k), sy_ * (e - p / 2 + 0.004 * k), 0), (p, p, h + 0.008 * k), "steelL",
              top="sole", base=True)
    # the faces the camera sees are +x and +y: a pressed rib and the type tag
    for axis in ("x", "y"):
        o = e + 0.004 * k
        def at(u, z, du, dz, col, d=0.006 * k):
            if axis == "x":
                m.box((o, u, z), (d, du, dz), col, base=True)
            else:
                m.box((u, o, z), (du, d, dz), col, base=True)
        at(0, z0 + wh * 0.12, s - 2 * p, 0.022 * k, "steelL")                                     # lower rib
        at(-0.045 * k, z0 + wh * 0.42, 0.11 * k, 0.085 * k, tag, 0.008 * k)                       # type tag
    # worn hazard edging along the rim of the two front faces
    zr = h - 0.035 * k
    _hazard(m, e - t / 2, -e + p, e - t / 2, e - p, zr, 6, {1, 4})
    _hazard(m, -e + p, e - t / 2, e - p, e - t / 2, zr, 6, {2})


# ---- contents ----------------------------------------------------------------------------------------------------


def hull_contents(m, k=1.0):
    """Bent hull plating and girder stubs: grey steel with rust, poking just over the rim."""
    z = FILL * k
    for (x, y, rz, rx, ry, w, d, col) in (
            (-0.05, -0.04, 0.4, 0.5, 0.15, 0.2, 0.12, "steelL"),
            (0.05, 0.04, -0.6, -0.4, 0.3, 0.18, 0.1, "rust"),
            (0.02, -0.06, 1.2, 0.2, -0.6, 0.16, 0.09, "plate")):
        m.box((x * k, y * k, z + 0.07 * k), (w * k, d * k, 0.012 * k), col, top=col, rz=rz, rx=rx, ry=ry)
    for (x, y, rz, ry, L) in ((-0.06, 0.06, 0.9, 0.35, 0.2), (0.07, -0.05, -0.3, -0.5, 0.17)):   # I-beam stubs
        c = (x * k, y * k, z + 0.09 * k)
        m.box(c, (L * k, 0.04 * k, 0.008 * k), "steel", top="steelL", rz=rz, ry=ry)
        m.box(c, (L * k, 0.008 * k, 0.04 * k), "rustD", rz=rz, ry=ry)


CONTENTS = {"hull": hull_contents}


def unit(kind):
    def build():
        m = core.Mesh(f"scrap_{kind}_unit")
        crate(m, TAGS[kind])
        CONTENTS[kind](m)
        ob = m.build()
        return [ob]
    return build


def jobs():
    return [(f"item.scrap_{kind}.unit", (1, 1), "prop", unit(kind)) for kind in CONTENTS]
