"""Salvage item art (family `salvage`): the scrap crates for derelict salvage and the cloth they refine into.

  item.<id>.unit   ONE crate (or one folded bolt) centred on the tile origin. The game stacks units itself on a fixed
                   slot grid (4 per level: back, right, left, front at 0.35 tile, a level per crate height), so a unit
                   must stack cleanly: flat top rim, nothing poking far above it.
  item.<id>.held   the small version a crew member carries.

The five scrap types share one crate body (open-topped steel, flat bottom, rounded vertical corners, a type tag on both
faces the camera sees); the contents and the tag colour tell them apart. Grid frame as items.py: x, y on the deck,
z up, 1 unit = 1 tile, origin the tile centre at floor level. No randomness: placements are fixed tables."""
import math

from . import core

# ---- crate body --------------------------------------------------------------------------------------------------

SX, SY = 0.38, 0.28  # crate footprint (tile units), as the reference: the long +y face (lower right on screen) runs along x.
                     # The slot grid steps 0.35, so neighbours butt tight along x and keep a gap along y
H = 0.255           # crate height: ~10 px at 1x; the 12 px stack level leaves a dark seam between levels
T = 0.022           # wall thickness
R = 0.03            # corner radius: the vertical edges are rounded
FILL = 0.15         # height of the interior floor the contents rest on

TAGS = {"hull": "hazK", "tech": "polyB", "energy": "hazY", "weapons": "medRed", "comfort": "pcb"}


def crate(m, tag, k=1.0):
    """The shared crate body, scaled by k, with its type tag colour `tag`: flat-bottomed, rounded vertical corners."""
    sx, sy, h, t, r = SX * k, SY * k, H * k, T * k, R * k
    ex, ey = sx / 2, sy / 2
    m.box((0, 0, 0), (sx - t, sy - t, FILL * k), "grime", top="dark", base=True)                # interior floor
    for (x, y, bx, by) in ((ex - t / 2, 0, t, sy - 2 * r), (-ex + t / 2, 0, t, sy - 2 * r),
                           (0, ey - t / 2, sx - 2 * r, t), (0, -ey + t / 2, sx - 2 * r, t)):
        m.box((x, y, 0), (bx, by, h), "plate", top="sole", base=True)
    for cx, cy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):                                            # rounded corners
        m.cyl((cx * (ex - r), cy * (ey - r), 0), r, h, "plate", sides=12, top="sole")
    # the faces the camera sees are +y (long, lower right) and +x (short, lower left): a pressed rib and the type tag
    for axis, o, span in (("x", ex + 0.004 * k, sy), ("y", ey + 0.004 * k, sx)):
        def at(u, z, du, dz, col, d=0.006 * k):
            if axis == "x":
                m.box((o, u, z), (d, du, dz), col, base=True)
            else:
                m.box((u, o, z), (du, d, dz), col, base=True)
        at(0, h * 0.12, span - 2 * r, 0.02 * k, "steelL")                                          # lower rib
        at(-span * 0.16, h * 0.4, span * 0.42, 0.075 * k, tag, 0.008 * k)                         # type tag


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
