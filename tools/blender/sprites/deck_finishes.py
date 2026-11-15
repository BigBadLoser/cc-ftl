"""Deck finishes (family `deck_finishes`): the floors a station or ship can be paved with instead of the plain deck, one
tile each (the sim's `floor` field, structure.py `Finish`; the renderer's floorChain picks the sibling). Picked in the
floor look study (floor_study.py docstring), drawn here on floors.py's 64x64 cell grid (a cell is about 2 px across
and 1 px down at the 128x64 tile), seams on the low sides so tiles join:

- tile.floor.heavy: the heavy plate, a dense checker of raised lozenges (the study's h13), faint seam.
- tile.floor.clean (+ .1 .2 .3): the clean tile, four pale ceramic quarters with a soft grout (c1u). The siblings are
  scattered like the deck's c and h, one tile in 20 each: .1 a newer lighter quarter, .2 a hairline crack, .3 a drain.
- tile.floor.carpet: ribbed carpet in greys (k2). The renderer paints it with the hull paint (src/render/carpetPaint.ts):
  the grey art's mid tone (palette c4H5) lands on the paint, shades darker and lighter keep the pile's detail.

No new palette entries: every key here is already in the shared extras (the c4 tones)."""
from . import core
from .floors import N, _hash

# ---- heavy plate: lens lozenges in a checker (long axes along the two grid axes), 16 cells apart


def _bump(a, b, half, width):
    """-> 'lit' | 'body' | 'shadow' | None for the point (a along the long axis, b across, + toward the light) of a lens
    lozenge: the lit rim on the light side, the cast shadow off the far side."""
    if abs(a) > half:
        return None
    w = width * (1 - (a / half) ** 2)
    if abs(b) <= w:
        return "lit" if b > 0 and b > w - 1.2 else "body"
    if -(w + 1.5) <= b < 0:
        return "shadow"
    return None


def heavy(i, j):
    if i < 2 or j < 2:
        return "plateB"
    pitch, half, width = 16, 6, 2.4
    ci, cj = i // pitch, j // pitch
    c = (pitch - 1) / 2
    u, v = i % pitch - c, j % pitch - c
    ax = ((1, 0), (0, 1))[(ci + cj) % 2]
    nx, ny = -ax[1], ax[0]
    if nx + ny > 0 or (nx + ny == 0 and nx > 0):
        nx, ny = -nx, -ny                    # across vector: positive b faces the light (grid -i, -j)
    k = _bump(u * ax[0] + v * ax[1], u * nx + v * ny, half, width)
    return {"lit": "plate", "body": "steelL", "shadow": "steelD"}.get(k, "steel")


# ---- clean tile: four ceramic quarters a tile, a thin soft-grey grout (the study's c1 a step brighter, c1u)

_UP = {"c4W4": "c4W3", "c4W3": "c4W2", "c4W2": "c4W1", "c4W1": "c4W0", "c4F2": "c4F1"}


def _quarters(i, j):
    return "c4W4" if i % 32 < 2 or j % 32 < 2 else "c4W2"


def _crack(i, j):
    pts = ((36, 41), (44, 45), (49, 44), (58, 52))
    for (a0, b0), (a1, b1) in zip(pts, pts[1:]):
        n = max(abs(a1 - a0), abs(b1 - b0))
        for t in range(n + 1):
            a, b = a0 + (a1 - a0) * t // n, b0 + (b1 - b0) * t // n
            if a <= i <= a + 1 and b <= j <= b + 1:
                return True
    return False


def clean(i, j, variant=0):
    """variant 0 the plain tile; 1 a replaced quarter a shade lighter; 2 a hairline crack; 3 a slotted drain."""
    g = _quarters(i, j)
    if variant == 1 and g == "c4W2" and i >= 32 and j < 32:
        g = "c4W1"
    elif variant == 2 and g == "c4W2" and 34 <= i <= 61 and 34 <= j <= 61 and _crack(i, j):
        g = "c4W3"
    elif variant == 3 and 41 <= i <= 54 and 41 <= j <= 54:
        if i <= 42 or j <= 42:
            g = "c4W4"
        elif i >= 53 or j >= 53:
            g = "c4W1"
        else:
            g = "c4F2" if (i - 43) % 4 < 2 else "c4W3"
    return _UP.get(g, g)


# ---- carpet: fine ribs, drawn in greys (recoloured by the hull paint, so only each grey's lightness matters)


def carpet(i, j):
    if i < 2 or j < 2:
        return "c4H6"
    h = _hash(i // 2, j // 2, 53)
    if j % 6 < 2:
        return "c4H6" if h < 0.6 else "c4H5"
    return "c4H4" if h > 0.9 else "c4H5"


def _tile(name, fn):
    m = core.Mesh(f"finish_{name}")
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), N, N, fn)
    return [m.build()]


SPRITES = [("tile.floor.heavy", (1, 1), "floor", lambda: _tile("heavy", heavy)),
           ("tile.floor.clean", (1, 1), "floor", lambda: _tile("clean", clean)),
           ("tile.floor.carpet", (1, 1), "floor", lambda: _tile("carpet", carpet))]
SPRITES += [(f"tile.floor.clean.{v}", (1, 1), "floor", lambda v=v: _tile(f"clean{v}", lambda i, j: clean(i, j, v)))
            for v in (1, 2, 3)]
