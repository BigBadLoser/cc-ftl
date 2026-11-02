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
R = 0.05            # corner radius
SEG = 6             # arc segments per corner
FILL = 0.15         # height of the interior floor the contents rest on
LIP = 0.014         # the bright lip along the top of the outer wall

Q = math.pi / 2       # a quarter turn: content tables are written long side along x and turned onto the long y

# Colours: each scrap type has its own crate ramp sv<K>S0 (light) .. sv<K>S4 and tag colour in its own palette set
# (palette_extra.json "salvage_<kind>"), sharing set "salvage": warm darks svP1 .. svP3 in place of black, bright steel
# svB0 .. svB3 for contents, rust svR1/svR2. A sprite renders on its type's set and the shared one only (`palette`).
KEYS = {"hull": "H", "tech": "T", "energy": "E", "weapons": "W", "comfort": "C"}
TAG = __import__("os").environ.get("SALVAGE_TAG", "B")      # review only: A = bright same-hue tag, B = contrast tag


def palette(sid):
    """Palette selection of a sprite id: its scrap type's set plus the shared salvage set."""
    kind = sid.split(".")[1].removeprefix("scrap_")
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


def crate(m, kind, k=1.0):
    """The shared crate body, scaled by k, in the colours of scrap type `kind`: one hollow shell, flat closed bottom, a
    warm dark bottom band that separates stacked levels, mid-tone faces, a bright lip and rim, the camera-facing corner
    picked out bright, a dark inside, and the type's tag panel on both faces the camera sees."""
    K = KEYS[kind]
    c = lambda n: f"sv{K}S{n}"                                                                  # noqa: E731
    tag = f"sv{K}tag{TAG}"
    sx, sy, h, t, r, b, lip = SX * k, SY * k, H * k, T * k, R * k, BAND * k, LIP * k
    ex, ey = sx / 2, sy / 2
    out, inn = _profile(ex, ey, r), _profile(ex - t, ey - t, r - t)
    front = lambda i: c(2) if i < SEG else c(3)                                           # noqa: E731
    _ring(m, out, 0, b, "svP2", True)                                                        # dark bottom band
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


# ---- contents ----------------------------------------------------------------------------------------------------
# Content tables are written long side along x (u) and turned onto the crate's long y: (u, v) -> grid (-v, u).


def _plate(m, u, v, z, rz, rx, ry, w, d, col, k, th=0.012, top=None):
    m.box((-v * k, u * k, z * k), (w * k, d * k, th * k), col, top=top or col, rz=rz + Q, rx=rx, ry=ry)


def _bar(m, u, v, z, rz, ry, L, k, col="svB2", top="svB1", s=0.026):
    """A square steel bar centred at (u, v, z), turned rz about z and raised ry about its width: bright on top."""
    m.box((-v * k, u * k, z * k), (L * k, s * k, s * k), col, top=top, rz=rz + Q, ry=ry)


def hull_contents(m, k=1.0):
    """Hull salvage: a bed of dark plating with a rusty sheet, and four bright girder bars fanning up out of it
    (the crate's read at 1x: bright bars against the dark inside). The tallest two stand over the rim."""
    f = FILL
    for u, v, z, rz, rx, ry, w, d, col in (                        # the bed: dark plates lying on the floor
            (-0.06, -0.02, f + 0.015, 0.1, 0.2, 0.0, 0.15, 0.1, "svP1"),
            (0.07, 0.03, f + 0.02, -0.2, -0.2, 0.1, 0.13, 0.09, "svB3"),
            (0.02, -0.04, f + 0.03, 0.5, 0.0, -0.2, 0.11, 0.07, "svR2")):
        _plate(m, u, v, z, rz, rx, ry, w, d, col, k)
    for u, v, z, rz, ry, L in (                                     # three bars fanning up the same way, one lying
            (-0.01, -0.072, f + 0.075, 0.08, 1.0, 0.26),
            (0.02, 0.0, f + 0.065, 0.0, 1.2, 0.27),
            (-0.01, 0.072, f + 0.075, -0.08, 0.9, 0.25),
            (0.02, -0.05, f + 0.03, 0.4, -0.15, 0.16)):
        _bar(m, u, v, z, rz, ry, L, k)


CONTENTS = {"hull": hull_contents}


def unit(kind):
    def build():
        m = core.Mesh(f"scrap_{kind}_unit")
        crate(m, kind)
        n = len(m.v)
        CONTENTS.get(kind, hull_contents)(m)          # review: types without their own contents yet show hull's
        inside(m, n)
        ob = m.build()
        return [ob]
    return build


def jobs():
    return [(f"item.scrap_{kind}.unit", (1, 1), "prop", unit(kind)) for kind in KEYS]
