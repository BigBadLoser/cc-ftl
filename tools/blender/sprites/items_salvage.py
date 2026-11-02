"""Salvage item art (family `salvage`): the scrap crates for derelict salvage and the cloth they refine into.

  item.<id>.unit   ONE crate (or one folded bolt) centred on the tile origin. The game stacks units itself on a fixed
                   slot grid (4 per level: back, right, left, front at 0.35 tile, a level per crate height), so a unit
                   must stack cleanly: flat top rim, nothing poking far above it.
  item.<id>.held   the small version a crew member carries: the unit at HELD (x HELD_K, as every item's .held).

Items: item.scrap_<kind>.unit/.held for kind in KEYS; item.cloth.unit/.held (white folded cloth with red stripes,
three folds to a bale the size of a crate, so it stacks on the same grid).

The five scrap types share one crate body (open-topped steel, flat bottom, rounded vertical corners, a type tag on both
faces the camera sees); the contents and the tag colour tell them apart. Grid frame as items.py: x, y on the deck,
z up, 1 unit = 1 tile, origin the tile centre at floor level. No randomness: placements are fixed tables."""
import math

from . import core
from .items import HELD_K, _fin
from .items_salvage_fill import CONTENTS

# ---- crate body --------------------------------------------------------------------------------------------------

SX, SY = 0.28, 0.38  # crate footprint (tile units), as the reference: the long +x face (lower right on screen) runs along y.
                     # The slot grid steps 0.35, so neighbours butt tight along y and keep a gap along x
H = 0.22            # crate height: ~9 px at 1x, one stack level
BAND = 0.035        # the dark bottom band that separates stacked levels
T = 0.035           # wall thickness: thinner breaks the back rim into dots at 1x
R = 0.05            # corner radius
SEG = 6             # arc segments per corner
FILL = 0.15         # height of the interior floor the contents rest on
LIP = 0.014         # the bright lip along the top of the outer wall


# Colours: each scrap type has its own crate ramp sv<K>S0 (light) .. sv<K>S4 and tag colour in its own palette set
# (palette_extra.json "salvage_<kind>"), sharing set "salvage": warm darks svP1 .. svP3 in place of black, bright steel
# svB0 .. svB3 for contents, rust svR1/svR2. A sprite renders on its type's set and the shared one only (`palette`).
KEYS = {"hull": "H", "tech": "T", "energy": "E", "weapons": "W", "comfort": "C"}


def palette(sid):
    """Palette selection of a sprite id: its scrap type's set plus the shared salvage set."""
    kind = sid.split(".")[1].removeprefix("scrap_")                 # hull .. comfort, or cloth
    return f"only:salvage+salvage_{kind}"


def _profile(ex, ey, r, n=None):
    """A rounded rectangle (half extents ex, ey, corner radius r) as points counter-clockwise seen from above; n arc
    segments per corner. Corner 0 (the first n + 1 points) is the front corner (+x, +y)."""
    n = n or SEG
    pts = []
    for cx, cy, a0 in ((ex - r, ey - r, 0.0), (-ex + r, ey - r, 0.5), (-ex + r, -ey + r, 1.0), (ex - r, -ey + r, 1.5)):
        for i in range(n + 1):
            a = (a0 + 0.5 * i / n) * math.pi
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def _ring(m, pts, z0, z1, col, outward):
    """Side wall between two heights along a closed profile, facing out (outer skin) or in (inner skin); col is a
    colour or a function of the segment index."""
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        q = [core.G(a[0], a[1], z0), core.G(b[0], b[1], z0), core.G(b[0], b[1], z1), core.G(a[0], a[1], z1)]
        m.poly(q if outward else q[::-1], col(i) if callable(col) else col, flip=True)


def crate(m, kind, k=1.0, band="svP2"):
    """The shared crate body, scaled by k, in the colours of scrap type `kind`: one hollow shell, flat closed bottom, a
    warm dark bottom band that separates stacked levels, mid-tone faces, a bright lip and rim, the camera-facing corner
    picked out bright, a dark inside, and the type's tag panel on both faces the camera sees."""
    K = KEYS[kind]
    c = lambda n: f"sv{K}S{n}"                                                                  # noqa: E731
    tag = f"sv{K}tag"
    sx, sy, h, t, r, b, lip = SX * k, SY * k, H * k, T * k, R * k, BAND * k, LIP * k
    ex, ey = sx / 2, sy / 2
    out, inn = _profile(ex, ey, r), _profile(ex - t, ey - t, r - t)
    front = lambda i: c(2) if i < SEG else c(3)                                           # noqa: E731
    _ring(m, out, 0, b, band or c(4), True)                                                   # dark bottom band
    _ring(m, out, b, h - lip, front, True)
    _ring(m, out, h - lip, h, c(0), True)                                                  # bright lip
    _ring(m, inn, FILL * k, h, "svP1", False)                                                # inner skin
    for i in range(len(out)):                                                                # rim
        j = (i + 1) % len(out)
        m.poly([core.G(*out[i], h), core.G(*out[j], h), core.G(*inn[j], h), core.G(*inn[i], h)], c(2), flip=True)
    m.poly([core.G(*p, FILL * k) for p in inn], "svP3", flip=True)                           # interior floor
    m.poly([core.G(*p, 0) for p in out][::-1], "svP3", flip=True)                            # flat bottom
    # the faces the camera sees are +x (long, lower right) and +y (short, lower left): the type tag, a centred panel
    # (a light frame around it breaks into dots at 1x)
    for axis, o, span in (("x", ex, sy), ("y", ey, sx)):
        def at(u, z, du, dz, col, d):
            if axis == "x":
                m.box((o + d / 2, u, z), (d, du, dz), col, base=True)
            else:
                m.box((u, o + d / 2, z), (du, d, dz), col, base=True)
        tw, th, z0 = span * 0.44, 0.07 * k, b + (h - lip - b) * 0.5 - 0.035 * k
        at(0, z0, tw, th, tag, 0.007 * k)                                                     # panel


def inside(m, start, k=1.0, slack=0.004):
    """Raise if any vertex built after index `start` (the contents) leaves the crate's inside column: through a wall, out
    of the bottom, or higher than a crate stacked on top would hide (its interior floor, H + FILL over this one's base).
    Pieces up there show only on the top layer of a stack. Dipping under the interior floor is fine: it is hidden."""
    ix, iy = (SX / 2 - T + slack) * k, (SY / 2 - T + slack) * k
    bad = [(x, -y, z) for x, y, z in m.v[start:] if abs(x) > ix or abs(y) > iy or z < 0 or z > (H + FILL - 0.01) * k]
    if bad:
        raise ValueError(f"{m.name}: {len(bad)} contents vertices outside the crate, e.g. "
                         + ", ".join(f"({x:.3f}, {y:.3f}, {z:.3f})" for x, y, z in bad[:4]))


HELD = 0.63          # .held: the unit scaled down to a crate a crew member carries in both arms (the held bale's size)


def unit(kind, k=1.0):
    def build():
        m = core.Mesh(f"scrap_{kind}_{'held' if k < 1 else 'unit'}")
        crate(m, kind, k, band="svP2" if k == 1.0 else None)   # carried: no dark band, which reads as a gap over the hands
        n = len(m.v)
        CONTENTS[kind](m, FILL, k)
        inside(m, n, k)
        return [m.build()] if k == 1.0 else [_fin(m, HELD_K)]
    return build


CREASE = 0.036       # the dark crease under each fold: thinner breaks into dots at 1x


def _slab(m, ex, ey, z0, z1, k):
    """One fold of cloth: an off-white soft-cornered slab with a crease along its underside."""
    out = _profile(ex, ey, 0.03 * k, 3)
    _ring(m, out, z0, z0 + CREASE * k, "svKS3", True)
    _ring(m, out, z0 + CREASE * k, z1, "svKS1", True)
    m.poly([core.G(*p, z1) for p in out], "svKS0", flip=True)
    m.poly([core.G(*p, z0) for p in out][::-1], "svKS3", flip=True)


def cloth(k=1.0, folds=3):
    """A bale of folded cloth the size of a crate (it stacks on the same grid): `folds` off-white folds, squared up,
    tied with one red strap over the top and down the short sides."""
    def build():
        m = core.Mesh(f"cloth_{'held' if k < 1 else 'unit'}")
        hz = H / folds
        ex, ey = (SX / 2 - 0.004) * k, (SY / 2 - 0.004) * k
        for i in range(folds):
            _slab(m, ex, ey, i * hz * k, (i + 1) * hz * k, k)
        w, t = 0.05 * k, 0.008 * k                                                              # the strap
        m.box((0, 0, H * k), (2 * ex + 2 * t, w, t), "svKredD", top="svKred", base=True)
        for sx in (1, -1):
            m.box((sx * (ex + t / 2), 0, 0), (t, w, H * k + t), "svKred", base=True)
        return [m.build()] if k == 1.0 else [_fin(m, HELD_K)]
    return build


def jobs():
    out = []
    for kind in KEYS:
        out += [(f"item.scrap_{kind}.unit", (1, 1), "prop", unit(kind)), (f"item.scrap_{kind}.held", (1, 1), "prop", unit(kind, HELD))]
    return out + [("item.cloth.unit", (1, 1), "prop", cloth()), ("item.cloth.held", (1, 1), "prop", cloth(0.6325, 2))]
