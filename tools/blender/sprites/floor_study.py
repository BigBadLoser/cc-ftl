"""Floor look study (family `floor_study`, preview only, not in RENDERED): the court finishes and deck marks redone, one
piece a round, three variants each, reviewed as 3x3 patches (tools/blender/review/floor_preview.py).

Round 1, walkway (promenade paving), drawn on floors.py's 64x64 cell grid, seams on the low sides:
  w1 honed pavers: one pale composite slab a tile, fine aggregate, a dark joint and a chamfered corner
  w2 coin rubber: a charcoal mat with raised coin studs, framed by a steel seam
  w3 guide-lit deck: the plain steel panel with a pale inset frame line and a lamp where four tiles meet"""
from . import core
from .floors import N, _bolt, _hash, _panel, floor


def w1(i, j):
    if i < 2 or j < 2:
        return "c4F4"
    ci, cj = min(i, 63 - i), min(j, 63 - j)
    if ci + cj < 6:
        return "c4F4"
    if i < 4 or j < 4:
        return "c4W4"
    h = _hash(i // 2, j // 2, 11)
    return "c4W3" if h < 0.07 else ("c4W0" if h > 0.95 else "c4W1")


def w2(i, j):
    if i < 2 or j < 2:
        return "steelD"
    if i < 4 or j < 4:
        return "steel"
    u, v = (i - 4) % 10, (j - 4) % 10
    if 3 <= u <= 6 and 3 <= v <= 6:
        return "c4H2" if u + v < 9 else "c4H3"
    if 4 <= u <= 7 and 4 <= v <= 7:
        return "c4H6"
    return "c4H5"


def w3(i, j):
    ci, cj = min(i, 63 - i), min(j, 63 - j)
    if ci < 5 and cj < 5 and (i < 3 or i > 60 or j < 3 or j > 60) and ci + cj < 6:
        return "lampY"
    p = _panel(i, j)
    if p:
        return p
    if (8 <= ci <= 9 and cj >= 8) or (8 <= cj <= 9 and ci >= 8):
        return "lvWS"
    return "steel"


DESIGNS = {"w1": w1, "w2": w2, "w3": w3}


# Round 2 (round 1 all passed over):
#   w4 terrazzo: polished dark grey-green stone with scattered warm and pale chips, a thin brass divider strip
#   w5 boardwalk: four warm grey composite planks a tile, staggered butt joints, dark gaps
#   w5 brushed walkway: a lighter steel plate with a raised rim and a cross-hatch anti-slip field


def w4(i, j):
    if i < 2 or j < 2:
        return "ochM"
    h = _hash(i // 2, j // 2, 21)
    if h < 0.05:
        return "c4W1"
    if h < 0.09:
        return "c1T3"
    if h < 0.13:
        return "c4H1"
    return "c4H4" if _hash(i // 6, j // 6, 22) < 0.5 else "c4H5"


def w5(i, j):
    b = j // 16
    v = j % 16
    if v < 2:
        return "c1F5"
    off = (b * 23) % 64
    if (i + off) % 64 < 2:
        return "c1F5"
    if v < 3:
        return "c1H3"
    return "c1H4" if _hash((i + off) // 64, b, 31) < 0.5 else "c1H5"


def w6(i, j):
    if i < 2 or j < 2:
        return "steelD"
    ci, cj = min(i, 63 - i), min(j, 63 - j)
    if min(ci, cj) < 6:
        return "plate" if (i < 6 or j < 6) else "steelL"
    if min(ci, cj) < 8:
        return "steelD"
    return "plate" if ((i + j) % 8 < 2 or (i - j) % 8 < 2) else "steelL"


DESIGNS.update({"w4": w4, "w5": w5, "w6": w6})


# Round 3 (more space station, W6's lighter steel as the base):
#   w7 lit seams: chamfered pale steel panels, each seam a dim cyan light line
#   w8 vent-slot panel: a raised pale centre plate between two banks of dark grille slots, corner bolts
#   w9 marked plate: a clean pale plate with fine brushed lines and painted corner brackets


def _cham(i, j, c):
    ci, cj = min(i, 63 - i), min(j, 63 - j)
    return ci + cj < c


def w7(i, j):
    if i < 2 or j < 2:
        return "icG"
    if _cham(i, j, 10):
        return "steelD"
    if i < 4 or j < 4:
        return "plate"
    if i > 61 or j > 61:
        return "steel"
    return "steelL"


def w8(i, j):
    if i < 2 or j < 2:
        return "steelD"
    b = _bolt(i, j, ((6, 6), (6, 55), (55, 6), (55, 55)))
    if b:
        return b
    if 8 <= j <= 55 and (8 <= i <= 17 or 46 <= i <= 55):
        return "dark" if (j - 8) % 6 < 3 else "steelD"
    if 21 <= i <= 42 and 8 <= j <= 55:
        if i == 21 or j <= 9:
            return "plate"
        if i == 42 or j >= 54:
            return "steel"
        return "steelL"
    return "steel"


def w9(i, j):
    if i < 2 or j < 2:
        return "steelD"
    if i < 4 or j < 4:
        return "plate"
    ci, cj = min(i, 63 - i), min(j, 63 - j)
    if (4 <= ci <= 6 and 4 <= cj <= 14) or (4 <= cj <= 6 and 4 <= ci <= 14):
        return "lvW"
    return "plate" if (i + 2 * j) % 11 == 0 else "steelL"


DESIGNS.update({"w7": w7, "w8": w8, "w9": w9})


def _tile(name, fn):
    m = core.Mesh(f"floor_study_{name}")
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), N, N, fn)
    return [m.build()]


def jobs():
    out = [("tile.floor.deck", (1, 1), "floor", lambda: floor("a"))]
    out += [(f"tile.floor.{k}", (1, 1), "floor", lambda f=f, k=k: _tile(k, f)) for k, f in DESIGNS.items()]
    return out
