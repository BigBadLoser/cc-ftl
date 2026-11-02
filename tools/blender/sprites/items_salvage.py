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

SX, SY = 0.28, 0.38  # crate footprint (tile units), as the reference: the long +x face (lower right on screen) runs along y.
                     # The slot grid steps 0.35, so neighbours butt tight along y and keep a gap along x
H = 0.22            # crate height: ~9 px at 1x, one stack level
BAND = 0.035        # the dark bottom band that separates stacked levels
T = 0.035           # wall thickness: thinner breaks the back rim into dots at 1x
R = 0.05            # corner radius: the vertical edges are rounded
FILL = 0.15         # height of the interior floor the contents rest on

Q = math.pi / 2       # a quarter turn: content tables are written long side along x and turned onto the long y

TAGS = {"hull": "hazK", "tech": "polyB", "energy": "hazY", "weapons": "medRed", "comfort": "pcb"}


def _profile(ex, ey, r, n=6):
    """A rounded rectangle (half extents ex, ey, corner radius r) as points counter-clockwise seen from above."""
    pts = []
    for cx, cy, a0 in ((ex - r, ey - r, 0.0), (-ex + r, ey - r, 0.5), (-ex + r, -ey + r, 1.0), (ex - r, -ey + r, 1.5)):
        for i in range(n + 1):
            a = (a0 + 0.5 * i / n) * math.pi
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def _ring(m, lo, hi, z0, z1, col, outward):
    """Side wall between two heights along a closed profile, facing out (outer skin) or in (inner skin)."""
    for i in range(len(lo)):
        a, b = lo[i], lo[(i + 1) % len(lo)]
        q = [core.G(a[0], a[1], z0), core.G(b[0], b[1], z0), core.G(b[0], b[1], z1), core.G(a[0], a[1], z1)]
        m.poly(q if outward else q[::-1], col, flip=True)


def crate(m, tag, k=1.0):
    """The shared crate body, scaled by k, with its type tag colour `tag`: one hollow shell with rounded vertical corners
    (outer radius R, inner R - T), a flat closed bottom, a dark bottom band that separates stacked levels and a pale rim."""
    sx, sy, h, t, r, b = SX * k, SY * k, H * k, T * k, R * k, BAND * k
    ex, ey = sx / 2, sy / 2
    out, inn = _profile(ex, ey, r), _profile(ex - t, ey - t, r - t)
    _ring(m, out, None, 0, b, "steelD", True)                                                    # dark bottom band
    _ring(m, out, None, b, h, "plate", True)
    _ring(m, inn, None, FILL * k, h, "plate", False)                                             # inner skin
    for i in range(len(out)):                                                                    # rim
        j = (i + 1) % len(out)
        m.poly([core.G(*out[i], h), core.G(*out[j], h), core.G(*inn[j], h), core.G(*inn[i], h)], "sole", flip=True)
    m.poly([core.G(*p, FILL * k) for p in inn], "dark", flip=True)                              # interior floor
    m.poly([core.G(*p, 0) for p in out][::-1], "dark", flip=True)                               # flat bottom
    # the faces the camera sees are +x (long, lower right) and +y (short, lower left): the type tag, centred
    for axis, o, span in (("x", ex, sy), ("y", ey, sx)):
        def at(u, z, du, dz, col, d):
            if axis == "x":
                m.box((o + d / 2, u, z), (d, du, dz), col, base=True)
            else:
                m.box((u, o + d / 2, z), (du, d, dz), col, base=True)
        at(0, h * 0.42, span * 0.42, 0.065 * k, tag, 0.005 * k)                       # type tag


def inside(m, start, k=1.0, slack=0.004):
    """Raise if any vertex built after index `start` (the contents) leaves the crate's inside column: through a wall, out
    of the bottom, or higher than a crate stacked on top would hide (its interior floor, H + FILL over this one's base).
    Pieces up there show only on the top layer of a stack. Dipping under the interior floor is fine: it is hidden."""
    ix, iy = (SX / 2 - T + slack) * k, (SY / 2 - T + slack) * k
    bad = [(x, -y, z) for x, y, z in m.v[start:] if abs(x) > ix or abs(y) > iy or z < 0 or z > (H + FILL - 0.01) * k]
    if bad:
        raise ValueError(f"{m.name}: {len(bad)} contents vertices outside the crate, e.g. "
                         + ", ".join(f"({x:.3f}, {y:.3f}, {z:.3f})" for x, y, z in bad[:4]))


# ---- contents ----------------------------------------------------------------------------------------------------
# Content tables are written long side along x (u) and turned onto the crate's long y: (u, v) -> grid (-v, u).


def _plate(m, u, v, z, rz, rx, ry, w, d, col, k, th=0.012):
    m.box((-v * k, u * k, z * k), (w * k, d * k, th * k), col, top=col, rz=rz + Q, rx=rx, ry=ry)


def _beam(m, u, v, z, rz, ry, L, k, web="rustD", flange="steel", top="steelL", s=0.035):
    """An I-beam stub: a flange plate and a web, centred at (u, v, z), tilted up by ry about its width."""
    c = (-v * k, u * k, z * k)
    m.box(c, (L * k, s * k, 0.008 * k), flange, top=top, rz=rz + Q, ry=ry)
    m.box(c, (L * k, 0.008 * k, s * k), web, rz=rz + Q, ry=ry)


def hull_contents(m, k=1.0):
    """Bent hull plating and girder stubs (grey steel with rust) heaped to the rim, and two character pieces standing
    up out of the heap to catch the eye: a girder stub raised at a steep angle and a torn panel on edge."""
    f = FILL
    for u, v, z, rz, rx, ry, w, d, col in (                        # the heap: plates leaning on each other
            (-0.07, -0.03, f + 0.03, 0.1, 0.35, 0.0, 0.15, 0.1, "steel"),
            (0.07, 0.03, f + 0.03, -0.2, -0.35, 0.2, 0.14, 0.09, "steelD"),
            (0.0, 0.0, f + 0.045, 0.5, 0.0, -0.3, 0.13, 0.08, "rust"),
            (0.09, -0.05, f + 0.02, 0.3, 0.2, 0.0, 0.09, 0.06, "steelD"),
            (-0.08, 0.05, f + 0.025, -0.4, 0.0, 0.25, 0.1, 0.06, "rustD")):
        _plate(m, u, v, z, rz, rx, ry, w, d, col, k)
    _beam(m, 0.03, -0.04, f + 0.05, 0.3, 0.2, 0.15, k)                 # a girder lying in the heap
    # character pieces
    _beam(m, -0.07, 0.02, f + 0.1, 0.15, -0.95, 0.19, k, web="rust")  # girder stub raised steeply at the back
    m.box((0.06 * k, 0.07 * k, (f + 0.02) * k), (0.012 * k, 0.11 * k, 0.12 * k), "steel", top="rust",  # torn panel on edge
          rz=0.25, rx=0.2, base=True)


CONTENTS = {"hull": hull_contents}


def unit(kind):
    def build():
        m = core.Mesh(f"scrap_{kind}_unit")
        crate(m, TAGS[kind])
        n = len(m.v)
        CONTENTS[kind](m)
        inside(m, n)
        ob = m.build()
        return [ob]
    return build


def jobs():
    return [(f"item.scrap_{kind}.unit", (1, 1), "prop", unit(kind)) for kind in CONTENTS]
