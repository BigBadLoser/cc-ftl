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


# ---- New set (the user's list): deck plate, grating, heavy plate, clean tile, soft floor; markings later ----------
# Deck plate, round 1 (the base floor everywhere, so detail stays quiet; it repeats on every tile):
#   d1 chamfered panel: one mid-steel panel, chamfered corners, a lit lip on the near sides
#   d2 split panel: two long plates a tile, a fine seam between, a short recessed grip slot on each
#   d3 rivet border: one panel with a row of small rivets just inside its seam


def d1(i, j):
    if i < 2 or j < 2:
        return "seam"
    if _cham(i, j, 8):
        return "seam"
    if i < 4 or j < 4:
        return "steelL"
    if i > 61 or j > 61:
        return "steelD"
    return "blueGrey"


def d2(i, j):
    if i < 2 or j < 2:
        return "seam"
    if 31 <= j <= 32:
        return "steelD"
    if i < 4 or j < 4 or 33 <= j <= 34:
        return "steelL"
    jj = j % 32
    if 26 <= i <= 37 and 14 <= jj <= 17:
        return "dark" if jj <= 15 else "steelD"
    return "steel"


def d3(i, j):
    if i < 2 or j < 2:
        return "seam"
    if i < 4 or j < 4:
        return "steelL"
    ci, cj = min(i, 63 - i), min(j, 63 - j)
    for a, b in ((ci, cj), (cj, ci)):
        if 6 <= a <= 9 and b >= 6 and (b - 6) % 13 < 4:
            return "sole" if a <= 7 else "steelD"
    return "steel"


DESIGNS.update({"d1": d1, "d2": d2, "d3": d3})


# Grating, round 1 (deck plate skipped: it is the default floor):
#   g1 bar grating: bars along one axis over a dark void, a cross bar every quarter, a steel frame at the seam
#   g2 square mesh: a framed grid of square openings, open and light-weight
#   g3 underlit grating: g1's bars with a dim cyan glow from below through the gaps


def _frame(i, j):
    if i < 2 or j < 2:
        return "seam"
    if i < 5 or j < 5 or i > 60 or j > 60:
        return "plate" if (i < 5 or j < 5) else "steelD"
    return None


def _bars(i, j, gap):
    f = _frame(i, j)
    if f:
        return f
    if (j - 5) % 16 < 3:
        return "steelL" if (j - 5) % 16 == 0 else "steel"
    k = (i - 5) % 9
    if k < 4:
        return "plate" if k == 0 else ("steelL" if k < 3 else "steel")
    return gap(k) if callable(gap) else gap


def g1(i, j):
    return _bars(i, j, "dark")


def g2(i, j):
    f = _frame(i, j)
    if f:
        return f
    u, v = (i - 5) % 8, (j - 5) % 8
    if u < 3 or v < 3:
        return "plate" if (u == 0 or v == 0) else "steelL"
    return "dark"


def g3(i, j):
    return _bars(i, j, lambda k: "fxH2" if 5 <= k <= 7 and (j - 5) % 16 > 4 and (j - 5) % 16 < 15 else "dark")


DESIGNS.update({"g1": g1, "g2": g2, "g3": g3})


# Grating, round 2 (round 1 too busy over a big room: fewer, bolder shapes, less contrast):
#   g4 wide slots: four broad slots a tile, no cross bars, a plain frame
#   g5 grate panel: a solid plate with one inset grate window in its middle
#   g6 soft bars: g1's layout at twice the pitch, the gaps a deep steel rather than black


def g4(i, j):
    f = _frame(i, j)
    if f:
        return f
    k = (i - 5) % 14
    if k < 5:
        return "plate" if k == 0 else ("steelL" if k < 4 else "steel")
    return "dark" if 7 <= j <= 57 else "steel"


def g5(i, j):
    if i < 2 or j < 2:
        return "seam"
    if i < 4 or j < 4:
        return "steelL"
    if 14 <= i <= 49 and 14 <= j <= 49:
        if i <= 15 or j <= 15:
            return "dark"
        if i >= 48 or j >= 48:
            return "steelL"
        k = (i - 16) % 8
        return "steelL" if k < 3 else "dark"
    return "steel"


def g6(i, j):
    f = _frame(i, j)
    if f:
        return f
    if (j - 5) % 28 < 3:
        return "steelL" if (j - 5) % 28 == 0 else "steel"
    k = (i - 5) % 12
    if k < 6:
        return "plate" if k == 0 else ("steelL" if k < 4 else "steel")
    return "steelD" if k < 11 else "seam"


DESIGNS.update({"g4": g4, "g5": g5, "g6": g6})


# Grating, round 3 (G6 picked; tile it evenly: same frame on all four sides, a bar pitch that divides the field):
#   g7 framed soft bars: the same frame on all four sides (seam, steel band, dark line), four bars at pitch 13
#   g8 continuous bars: no frame, the bars run on through the tiles, a light cross bar at each tile line
#   g9 framed wide bars: g7's frame, two wide bars at pitch 26


def _soft(k, pitch, bar):
    if k < bar:
        return "plate" if k == 0 else ("steelL" if k < bar - 1 else "steel")
    return "steelD" if k < pitch - 1 else "seam"


def _ring(i, j):
    """The frame both ways alike: a dark seam, a steel band, a dark line before the field (field 6..57)."""
    if i < 2 or j < 2:
        return "seam"
    if i < 4 or j < 4 or i > 59 or j > 59:
        return "steel"
    if i < 6 or j < 6 or i > 57 or j > 57:
        return "seam"
    return None


def g7(i, j):
    return _ring(i, j) or _soft((i - 6) % 13, 13, 7)


def g8(i, j):
    if j < 2:
        return "steelD"
    if j < 5:
        return "steelL" if j < 4 else "steel"
    return _soft(i % 8, 8, 4)


def g9(i, j):
    return _ring(i, j) or _soft((i - 6) % 26, 26, 14)


DESIGNS.update({"g7": g7, "g8": g8, "g9": g9})


# Grating, round 4 (round 3 still busy: the busyness is contrast, so two close tones, no highlights, a quiet frame):
#   g10 quiet G7: G7's frame and four bars, bars steel on steelD gaps, the frame one plain band
#   g11 quiet G9: G9's two wide bars in the same two tones
#   g12 shadow slots: a plain deck panel whose field is cut by four soft slots, a step darker, nothing lit


def _quiet_ring(i, j):
    if i < 2 or j < 2:
        return "seam"
    if i < 6 or j < 6 or i > 57 or j > 57:
        return "steel"
    return None


def g10(i, j):
    return _quiet_ring(i, j) or ("steel" if (i - 6) % 13 < 7 else "steelD")


def g11(i, j):
    return _quiet_ring(i, j) or ("steel" if (i - 6) % 26 < 14 else "steelD")


def g12(i, j):
    p = _panel(i, j)
    if p:
        return p
    if 12 <= j <= 51 and 10 <= i <= 53 and (i - 10) % 12 < 8:
        return "steelD" if (i - 10) % 12 < 7 else "seam"
    return "steel"


DESIGNS.update({"g10": g10, "g11": g11, "g12": g12})


# Heavy plate (tread plate), round 1 (grating skipped; calm, low contrast, even tiling):
#   h1 diamond tread: raised lozenges two ways in a staggered grid, a step lighter than the plate, a soft shadow
#   h2 bolted slab: one thick plate a tile, a bevelled edge, a heavy bolt in each corner, nothing else
#   h3 dimple plate: rows of round raised studs, low and sparse, on a plate framed by its seam


def h1(i, j):
    if i < 2 or j < 2:
        return "seam"
    u, v = (i - 2) % 12, (j - 2) % 12
    flip = ((i - 2) // 12 + (j - 2) // 12) % 2
    a, b = (u - 6 + v - 6, u - v) if flip else (u - v, u - 6 + v - 6)
    if abs(a) <= 5 and abs(b) <= 1:
        return "steelL" if b <= 0 else "steel"
    if abs(a) <= 5 and b == 2:
        return "steelD"
    return "steel"


def h2(i, j):
    if i < 2 or j < 2:
        return "seam"
    b = _bolt(i, j, ((7, 7), (7, 54), (54, 7), (54, 54)))
    if b:
        return "steelL" if b == "plate" else b
    if i < 5 or j < 5:
        return "steelL"
    if i > 58 or j > 58:
        return "steelD"
    return "steel"


def h3(i, j):
    if i < 2 or j < 2:
        return "seam"
    if i < 4 or j < 4:
        return "steelL"
    u, v = (i - 4) % 10, (j - 4 + (5 if ((i - 4) // 10) % 2 else 0)) % 10
    d = (u - 4.5) ** 2 + (v - 4.5) ** 2
    if d <= 4:
        return "steelL" if u + v < 9 else "steel"
    if d <= 6.5 and u + v > 9:
        return "steelD"
    return "steel"


DESIGNS.update({"h1": h1, "h2": h2, "h3": h3})


# Diamond tread, round 2 (H1 picked), each changing one thing:
#   h4 big lozenges: H1 at pitch 16 (four a tile side), longer and bolder lozenges, fewer of them
#   h5 dark tread: H1's layout on a darker plate, the lozenges the old plate tone, a lit ridge
#   h6 panelled tread: H1's field inset in a plain border band, so every tile reads as one tread panel


def _tread(i, j, o, pitch, half, base, lit, mid, shade):
    u, v = (i - o) % pitch, (j - o) % pitch
    c = pitch / 2
    flip = ((i - o) // pitch + (j - o) // pitch) % 2
    a, b = (u - c + v - c, u - v) if flip else (u - v, u - c + v - c)
    if abs(a) <= half and abs(b) <= 1:
        return lit if b <= 0 else mid
    if abs(a) <= half and b == 2:
        return shade
    return base


def h4(i, j):
    if i < 2 or j < 2:
        return "seam"
    return _tread(i, j, 2, 16, 8, "steel", "steelL", "steel", "steelD")


def h5(i, j):
    if i < 2 or j < 2:
        return "seam"
    return _tread(i, j, 2, 12, 5, "steelD", "steelL", "steel", "seam")


def h6(i, j):
    if i < 2 or j < 2:
        return "seam"
    if i < 4 or j < 4:
        return "steelL"
    if i < 8 or j < 8 or i > 57 or j > 57:
        return "steelD" if (i > 59 or j > 59) else "steel"
    return _tread(i, j, 8, 10, 4, "steel", "steelL", "steel", "steelD")


DESIGNS.update({"h4": h4, "h5": h5, "h6": h6})


def _tile(name, fn):
    m = core.Mesh(f"floor_study_{name}")
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), N, N, fn)
    return [m.build()]


def jobs():
    out = [("tile.floor.deck", (1, 1), "floor", lambda: floor("a"))]
    out += [(f"tile.floor.{k}", (1, 1), "floor", lambda f=f, k=k: _tile(k, f)) for k, f in DESIGNS.items()]
    return out
