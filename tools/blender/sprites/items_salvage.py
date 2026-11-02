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

SX, SY = 0.38, 0.28  # crate footprint (tile units), as the reference: the long +y face (lower right on screen) runs along x.
                     # The slot grid steps 0.35, so neighbours butt tight along x and keep a gap along y
H = 0.255           # crate height: ~10 px at 1x; the 12 px stack level leaves a dark seam between levels
T = 0.022           # wall thickness
POST = 0.036        # corner post size
FILL = 0.15         # height of the interior floor the contents rest on
SKID = 0.025        # recessed dark base

TAGS = {"hull": "hazK", "tech": "polyB", "energy": "hazY", "weapons": "medRed", "comfort": "pcb"}


def _hazard(m, x0, y0, x1, y1, z, n, worn, k):
    """A band of alternating yellow/black segments along a rim edge from (x0, y0) to (x1, y1) at height z; `worn`
    indexes the segments scuffed back to bare steel."""
    for i in range(n):
        col = "steelL" if i in worn else ("hazY" if i % 2 == 0 else "hazK")
        a, b = i / n, (i + 1) / n
        xa, ya = x0 + (x1 - x0) * a, y0 + (y1 - y0) * a
        xb, yb = x0 + (x1 - x0) * b, y0 + (y1 - y0) * b
        L = math.hypot(xb - xa, yb - ya)
        rz = math.atan2(yb - ya, xb - xa)
        m.box(((xa + xb) / 2, (ya + yb) / 2, z), (L, (T + 0.006) * k, 0.03 * k), col, top=col, rz=rz, base=True)


def crate(m, tag, k=1.0):
    """The shared crate body, scaled by k, with its type tag colour `tag`."""
    sx, sy, h, t, p, sk = SX * k, SY * k, H * k, T * k, POST * k, SKID * k
    ex, ey = sx / 2, sy / 2
    m.box((0, 0, 0), (sx - 0.03 * k, sy - 0.03 * k, sk), "dark", base=True)                     # recessed skid
    m.box((0, 0, sk), (sx - t, sy - t, FILL * k - sk), "grime", top="dark", base=True)          # interior floor
    wh = h - sk
    for (x, y, bx, by) in ((ex - t / 2, 0, t, sy), (-ex + t / 2, 0, t, sy), (0, ey - t / 2, sx, t), (0, -ey + t / 2, sx, t)):
        m.box((x, y, sk), (bx, by, wh), "plate", top="sole", base=True)
    for cx, cy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):                                            # corner posts
        m.box((cx * (ex - p / 2 + 0.004 * k), cy * (ey - p / 2 + 0.004 * k), 0), (p, p, h + 0.008 * k), "steelL",
              top="sole", base=True)
    # the faces the camera sees are +y (long, lower right) and +x (short, lower left): a pressed rib and the type tag
    for axis, o, span in (("x", ex + 0.004 * k, sy), ("y", ey + 0.004 * k, sx)):
        def at(u, z, du, dz, col, d=0.006 * k):
            if axis == "x":
                m.box((o, u, z), (d, du, dz), col, base=True)
            else:
                m.box((u, o, z), (du, d, dz), col, base=True)
        at(0, sk + wh * 0.1, span - 2 * p, 0.02 * k, "steelL")                                    # lower rib
        tw = span * 0.42
        at(-span * 0.16, sk + wh * 0.38, tw, 0.075 * k, tag, 0.008 * k)                           # type tag
    # worn hazard edging along the rim of the two front faces
    zr = h - 0.03 * k
    _hazard(m, ex - t / 2, -ey + p, ex - t / 2, ey - p, zr, 6, {3}, k)
    _hazard(m, -ex + p, ey - t / 2, ex - p, ey - t / 2, zr, 8, {2, 5}, k)


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
