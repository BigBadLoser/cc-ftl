"""Roof livery system (v8 study, pure Python, no bpy): painted motifs as tile masks, recoloured per scheme.

Cost model (109 masks): every motif is a set of 1x1-tile masks (MASKS, 32x32 cells) in two key channels, P (primary,
key colour mkP #ff0000) and S (secondary, mkS #00ff00). They are rendered once as overlay sprites
(roofs.livery_mask) at the plating height. At runtime a scheme only picks the masks per tile (plan) and its colours;
one mask set (len(MASKS)) serves every scheme and faction. A 3-colour scheme remaps a motif's P / S channels.

Recolour model (final, v12; the renderer shader must match): paint is OPAQUE. For a mask pixel of channel colour C
over a plating pixel B on a tile of colour family f (o / b, known per tile from the module rule):
    s   = lum(B) / lum(top tone of f)                     lum = 0.299 r + 0.587 g + 0.114 b
    h   = -RELIEF_K_DARK  if s < RELIEF_DARK              (grooves, bolt feet: paint one shade darker)
          +RELIEF_K_LIGHT if s > RELIEF_LIGHT             (lit lips, bolt heads, inset far rims: one shade lighter)
          0               otherwise                       (every plate tone, patch plates, girder bands)
    out = C * (1 + h) * tint                              tint = the ship-wide light gradient (same as the plating)
No plating colour is mixed in; only that faint relief hint survives.

Ship frame: the ship's long axis is x (bow = +x). The spine line sits on the tile boundary yc between rows yc - 1 ("n"
tiles) and yc ("s" tiles). Motif positions are fixed fractions of the spine length, so the rule adapts to any outline.
"""
import math

from .roof_layout import GN, _h

DIGITS = {"0": ("111", "101", "101", "101", "111"), "1": ("010", "110", "010", "010", "111"),
          "2": ("111", "001", "111", "100", "111"), "3": ("111", "001", "011", "001", "111"),
          "4": ("101", "101", "111", "001", "001"), "5": ("111", "100", "111", "001", "111"),
          "6": ("111", "100", "111", "101", "111"), "7": ("111", "001", "001", "010", "010"),
          "8": ("111", "101", "111", "101", "111"), "9": ("111", "101", "111", "001", "111")}
AFT = ((0, 44), (54, 72), (82, 92))                  # aft banding: painted runs (cells from the stern), thinning
LETTERS = {"-": ("000", "000", "111", "000", "000"), "F": ("111", "100", "110", "100", "100"),
           "X": ("101", "101", "010", "101", "101"), "K": ("101", "110", "100", "110", "101")}
STENCIL = ("FX-", "407")
RELIEF_DARK, RELIEF_LIGHT = 0.40, 1.20               # recolour model thresholds (see the module docstring)
RELIEF_K_DARK, RELIEF_K_LIGHT = 0.10, 0.08                            # stern code block, one mask per tile


def _stripe(n):
    return lambda i, j: ("P" if (j >= 18 if n else j < 14) else "S" if (13 <= j < 16 if n else 16 <= j < 19) else None)


def _chev(n):
    def f(i, j):
        d = (GN - 1 - j) if n else j                  # cells from the spine line
        if d < 14:
            return "S" if (i + d) % GN < 11 else "P"       # one bold chevron per tile, apex forward
        return "S" if 16 <= d < 19 else None
    return f


def _digit(c):
    def f(i, j):                                      # drawn for the iso view: verticals stay vertical on screen
        if not 3 <= j < 29:                           # (glyph column from i - j), baseline runs along +x
            return None
        a, b = (i - j + 5) // 4, (j - 6) // 4         # 4 cells a glyph pixel: 12 x 20 px at 1x
        return "S" if 0 <= a < 3 and 0 <= b < 5 and i - j + 5 >= 0 and j >= 6 and DIGITS[c][b][a] == "1" else "P"
    return f


def _in_poly(x, y, pts):
    c = False
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            c = not c
    return c


STAR = [((21 if k % 2 == 0 else 9) * math.cos(k * math.pi / 5), (21 if k % 2 == 0 else 9) * math.sin(k * math.pi / 5))
        for k in range(10)]


def _glyph(c):
    return DIGITS.get(c) or LETTERS[c]


def _big(c, k):
    def f(i, j):                                      # big hull number: the registry style (panel + digit painted
        I = k * GN + i                                # along the deck) at 6 cells a glyph pixel, 2 tiles a digit
        if not 1 <= j < 31:
            return None
        a, b = (I - j - 10) // 6, (j - 1) // 6
        return "S" if I - j - 10 >= 0 and 0 <= a < 3 and b < 5 and _glyph(c)[b][a] == "1" else "P"
    return f


def _stencil(text):
    def f(i, j):                                      # small stencil code: 6 x 10 px glyphs, 3 to a tile
        if 23 <= j < 25 and 8 <= i - j + 11 < 32:
            return "P"
        if not 11 <= j < 21:
            return None
        g, a, b = (i - j + 11) // 8, ((i - j + 11) % 8) // 2, (j - 11) // 2
        return "S" if 0 <= g < 3 and a < 3 and _glyph(text[g])[b][a] == "1" else None
    return f


def _arrow(qx, qy):
    def f(i, j):                                      # dorsal arrowhead, 2 tiles long, 4 rows wide, apex forward
        X, Y = qx * GN + i + 0.5, (qy - 2) * GN + j + 0.5
        lim = (64 - X) * 0.72
        return "P" if abs(Y) < lim else "S" if abs(Y) < lim + 4 and X > 2 else None
    return f


def _band(lo, hi, slo, shi):
    """Spine-parallel band mask pair: P for lo <= d < hi, S for slo <= d < shi (d = cells from the spine line)."""
    return [(lambda n: lambda i, j: "P" if lo <= (GN - 1 - j if n else j) < hi
             else "S" if slo <= (GN - 1 - j if n else j) < shi else None)(n) for n in (True, False)]


_dbl, _shaft = _band(4, 12, 14, 16), _band(0, 7, 7, 10)


def _fang(i, j):
    """The aft edge of a nose block cut into fangs pointing aft (raiders): P forward of a sawtooth, 2 teeth a tile,
    each nearly a tile long."""
    t = abs(j % 16 - 7.5) / 7.5                       # 0 at a tooth's point, 1 between teeth
    return "P" if i >= 2 + 28 * (1 - t) ** 1.4 else None


CLAW_W, CLAW_H = 4, 3                                 # claw block, tiles (x along the ship, y across)
CLAWS = ((-21, 0.86), (0, 1.0), (21, 0.8))            # three gashes: offset across the swipe (cells), relative length


def _claw(q):
    """Tile q of the raiders' claw swipe: three parallel gashes torn diagonally across the spine, each a curved sliver
    that tapers to a point at both ends, with a ragged edge."""
    def f(i, j):
        X = (q % CLAW_W) * GN + i + 0.5 - CLAW_W * GN / 2
        Y = (q // CLAW_W) * GN + j + 0.5 - CLAW_H * GN / 2
        ux, uy = 0.62, 0.785                              # swipe direction (from aft-port to fore-starboard)
        nx, ny = -uy, ux
        along, across = X * ux + Y * uy, X * nx + Y * ny
        for off, ln in CLAWS:
            half = 54 * ln
            t = (along + half) / (2 * half)
            if not 0 < t < 1:
                continue
            bow = 7 * math.sin(math.pi * t)               # the gash curves a little
            w = 9 * math.sin(math.pi * t) ** 0.8 + 1.5 * math.sin(along * 0.9 + off)   # tapered, ragged
            if abs(across - off - bow) < w / 2:
                return "P"
        return None
    return f


def _trace(n):
    def f(i, j):                                      # circuit traces along the spine (zealots): a bus line, a
        d = (GN - 1 - j) if n else j                  # branch off it and a node pad, offset on the two sides
        b = 6 if n else 20
        if 3 <= d < 6 or 26 <= d < 28:
            return "P"
        if b <= i < b + 3 and 6 <= d < 16:
            return "P"
        if b - 3 <= i < b + 6 and 16 <= d < 23:
            return "P" if not (b <= i < b + 3 and 18 <= d < 21) else None
        return None
    return f


def _emblem(kind, q, n=2):
    """Emblem tile q of an n x n block: the design is drawn for 2 x 2 tiles and scaled by n / 2."""
    k = n / 2

    def f(i, j):
        X = ((q % n) * GN + i + 0.5 - n * GN / 2) / k
        Y = ((q // n) * GN + j + 0.5 - n * GN / 2) / k
        r = (X * X + Y * Y) ** 0.5
        if r >= 27:
            return None
        if r >= 22:
            return "S"
        if kind == "dot":
            g = r < 9
        elif kind == "star":                          # five-point star, one point at the bow
            g = _in_poly(X, Y, STAR)
        elif kind == "diamond":                       # a deck square reads as a diamond on screen
            g = abs(X) < 11 and abs(Y) < 11 and not (abs(X) < 5 and abs(Y) < 5)
        elif kind == "delta":                         # arrowhead pointing at the bow
            g = -11 <= X <= 13 and abs(Y) < (13 - X) * 0.55
        elif kind == "skull":                         # raider skull, the jaw toward the bow, two dark eye holes
            eye = min((X + 1) ** 2 + (Y - s5) ** 2 for s5 in (-5.5, 5.5)) < 13
            g = ((X + 3) ** 2 + Y * Y < 125 or (3 <= X <= 13 and abs(Y) < 7 and not (X >= 9 and abs(Y) % 4 < 1.4))) \
                and not eye and not (5 <= X < 8 and abs(Y) < 1.6)
        elif kind == "eye":                           # zealot machine eye: an almond lid round a round iris
            w = 15 * (1 - (X / 19) ** 2) if abs(X) < 19 else -1
            g = (w - 4 <= abs(Y) < w) or X * X + Y * Y < 42
        else:                                         # cross
            g = r < 17 and (abs(X) < 4 or abs(Y) < 4)
        return "S" if g else "P"
    return f


MASKS = {
    "stripe.n": _stripe(True), "stripe.s": _stripe(False),
    "pin.n": lambda i, j: "S" if 19 <= j < 24 else None, "pin.s": lambda i, j: "S" if 8 <= j < 13 else None,
    "pinp.n": lambda i, j: "P" if 19 <= j < 24 else None, "pinp.s": lambda i, j: "P" if 8 <= j < 13 else None,
    "chev.n": _chev(True), "chev.s": _chev(False),
    "saddle.w": lambda i, j: "S" if 2 <= i < 6 else "P" if i >= 8 else None,
    "saddle.e": lambda i, j: "S" if 26 <= i < 30 else "P" if i < 24 else None,
    **{f"aft.{k}": (lambda k: lambda i, j: "P" if any(a <= k * GN + i < b for a, b in AFT) else None)(k)
       for k in range(3)},
    **{f"reg.{c}": _digit(c) for c in DIGITS},
    **{f"em.{t}.{q}": _emblem(t, q) for t in ("dot", "delta", "cross", "star", "diamond", "skull", "eye")
       for q in range(4)},
    **{f"emL.{t}.{q}": _emblem(t, q, 3) for t in ("skull", "eye") for q in range(9)},   # large: 3 x 3 tiles
    # v10
    "full.P": lambda i, j: "P",
    "half.n": lambda i, j: "P" if j < 26 else "S" if 27 <= j < 31 else None,
    "dbl.n": _dbl[0], "dbl.s": _dbl[1], "shaft.n": _shaft[0], "shaft.s": _shaft[1],
    "bar": lambda i, j: "P" if 9 <= i < 21 else None,
    **{f"arr.{qx}.{qy}": _arrow(qx, qy) for qx in range(2) for qy in range(4)},
    **{f"big.{c}.{k}": _big(c, k) for c in DIGITS for k in range(2)},
    **{f"sten.{k}": _stencil(t) for k, t in enumerate(STENCIL)},
    # v13 faction motifs
    "fang": _fang, "trace.n": _trace(True), "trace.s": _trace(False),
    **{f"claw.{q}": _claw(q) for q in range(CLAW_W * CLAW_H)},
}

MASKS = {k: f for k, f in MASKS.items() if any(f(i, j) for i in range(GN) for j in range(GN))}   # drop empty ones

# Bow at either end: a ship whose bow is at -x takes the plan of its x-mirror, with every direction-dependent mask
# mirrored (i -> GN - 1 - i, sprites roof.lv.<mask>.m) and text (registry digits, stencils) kept readable: only its
# placement mirrors (src/render/roofArt.ts liveryPlan, bowWest).
TEXT = ("reg.", "big.", "sten.")
MIRROR = [k for k, f in MASKS.items()
          if not k.startswith(TEXT) and any(f(i, j) != f(GN - 1 - i, j) for i in range(GN) for j in range(GN))]


def mirrored(name):
    fn = MASKS[name]
    return lambda i, j: fn(GN - 1 - i, j)


# scheme: motifs (painted in this order), colours P / S (/ T), and per-motif channel remaps for 3-colour schemes
SCHEMES = {
    "crimson": dict(motifs=("stripe", "chev", "reg"), P="#b0443a", S="#e2ddd0"),
    "ivory": dict(motifs=("saddle", "pinp", "em.dot"), P="#dcd8cc", S="#25272d"),
    "tide": dict(motifs=("aft", "saddle", "em.delta", "reg"), P="#2f8f8a", S="#e2ddd0"),
    "sovereign": dict(motifs=("stripe", "em.cross", "reg"), P="#26282e", S="#e0b23e"),
    "orchid": dict(motifs=("aft", "pins", "chev", "reg"), P="#74509e", S="#c3c8d2"),
    "hornet": dict(motifs=("dbl", "nose", "big"), P="#d9822b", S="#25272d"),
    "glacier": dict(motifs=("split", "arrow", "sten"), P="#aebdcb", S="#1d2a44", remap={"arrow": ("S", "P")}),
    "verdant": dict(motifs=("bars", "arrow", "em.star", "sten"), P="#4f9a4a", S="#e2ddd0"),
    "ember": dict(motifs=("nose", "bars", "em.diamond", "big"), P="#26282e", S="#d9822b"),
    "tricolour": dict(motifs=("split", "dbl", "em.star", "big", "sten"), P="#24324f", S="#e2ddd0", T="#b0443a",
                      remap={"dbl": ("T", "S"), "em.star": ("T", "S"), "big": ("T", "S")}),
    # v13 faction schemes: a coat over the whole roof carries the faction colour, its motifs the rest
    "gash": dict(motifs=("coat", "claw", "fangs", "em.skull"), P="#2a2d33", S="#c8402e", T="#e2dccb",
                 remap={"claw": ("S", "S"), "fangs": ("S", "S"), "em.skull": ("P", "T")}),
    "scorch": dict(motifs=("coat", "claw", "fangs", "em.skull"), P="#33302c", S="#e07a26", T="#e2dccb",
                   remap={"claw": ("S", "S"), "fangs": ("S", "S"), "em.skull": ("P", "T")}),
    "reaver": dict(motifs=("coat", "claw", "fangs", "emL.skull"), P="#2a2d33", S="#c8402e", T="#e2dccb",
                   remap={"claw": ("S", "S"), "fangs": ("S", "S"), "emL.skull": ("P", "T")}),
    "litany": dict(motifs=("coat", "trace", "em.eye"), P="#d6cfbd", S="#3fc4d4", T="#2b3440",
                   remap={"trace": ("S", "S"), "em.eye": ("T", "S")}),
    "relic": dict(motifs=("coat", "aft", "trace", "em.eye"), P="#c9ccd1", S="#5fd6c0", T="#3a2f4a",
                  remap={"aft": ("T", "T"), "trace": ("S", "S"), "em.eye": ("T", "S")}),
    "vigil": dict(motifs=("coat", "trace", "emL.eye"), P="#d6cfbd", S="#3fc4d4", T="#2b3440",
                  remap={"trace": ("S", "S"), "emL.eye": ("T", "S")}),
}

# A faction's livery (its art def's `livery` id) is the list of schemes its ships pick from by name (roofArt.liveryFor).
# The navy, civilian, scrapper and drone liveries keep the original ten; an unknown id falls back to them.
CLASSIC = ("crimson", "ivory", "tide", "sovereign", "orchid", "hornet", "glacier", "verdant", "ember", "tricolour")
LIVERIES = {
    "livery.navy": CLASSIC, "livery.scrapper": CLASSIC, "livery.drone": CLASSIC,
    "livery.raider": ("gash", "scorch", "reaver"),
    "livery.zealot": ("litany", "relic", "vigil"),
}


def plan(ship, scheme, seed=0, level=lambda x, y: 0):
    """{(x, y): [(mask, motif), bottom first]} for a ship outline (list of strings, '#' = hull) and a scheme name.
    level(x, y): relief level of a tile; the registry block and emblem keep to one level (all 0 since v10)."""
    H, W = len(ship), len(ship[0])
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and ship[y][x] == "#"  # noqa: E731
    rows = [y for y in range(H) if any(solid(x, y) for x in range(W))]
    yc = (rows[0] + rows[-1] + 1 + 1) // 2
    spine = [x for x in range(W) if solid(x, yc - 1) and solid(x, yc)]
    xs, xb = spine[0], spine[-1]
    L = xb - xs + 1
    out = {}
    mot = SCHEMES[scheme]["motifs"]
    for m in mot:
        def add(x, y, k):
            if solid(x, y) and k in MASKS:
                out.setdefault((x, y), []).append((k, m))
        if m == "coat":                               # the whole roof in P
            for y in range(H):
                for x in range(W):
                    add(x, y, "full.P")
        elif m == "fangs":                            # a toothed nose block: the last two spine columns and the bow
            for y in range(H):
                add(xb - 2, y, "fang")
                for x in range(xb - 1, W):
                    add(x, y, "full.P")
        elif m == "claw":                             # the claw swipe over the spine, a quarter of the way from the stern
            x0 = xs + round(0.25 * L)
            for q in range(CLAW_W * CLAW_H):
                add(x0 + q % CLAW_W, yc - 2 + q // CLAW_W, f"claw.{q}")
        elif m == "trace":                            # circuit traces the length of the spine
            for x in range(xs, xb + 1):
                add(x, yc - 1, "trace.n")
                add(x, yc, "trace.s")
        elif m == "aft":
            for k in range(3):
                for y in range(H):
                    add(xs + k, y, f"aft.{k}")
        elif m == "bars":                             # three even tail bars
            for k in range(3):
                for y in range(H):
                    add(xs + k, y, "bar")
        elif m == "saddle":
            x0 = xs + round(0.38 * L)
            for y in range(H):
                add(x0, y, "saddle.w")
                add(x0 + 1, y, "saddle.e")
        elif m == "nose":                             # bow block: last two columns, framed on the aft edge
            for y in range(H):
                add(xb - 1, y, "saddle.w")
                for x in range(xb, W):
                    add(x, y, "full.P")
        elif m == "split":                            # two-tone: the N half of the roof, edged along the spine
            for y in range(yc - 1):
                for x in range(W):
                    add(x, y, "full.P")
            for x in range(W):
                add(x, yc - 1, "half.n")
        elif m in ("stripe", "pins", "pinp", "dbl"):
            end = xb - 2 if "chev" in mot else xb
            for x in range(xs, end + 1):
                add(x, yc - 1, f"{'pin' if m == 'pins' else m}.n")
                add(x, yc, f"{'pin' if m == 'pins' else m}.s")
        elif m == "chev":
            for x in (xb - 1, xb):
                add(x, yc - 1, "chev.n")
                add(x, yc, "chev.s")
        elif m == "arrow":                            # dorsal arrow: shaft from the stern, head at 0.45 L
            xh = xs + round(0.45 * L)
            for x in range(xs + 2, xh):
                add(x, yc - 1, "shaft.n")
                add(x, yc, "shaft.s")
            for qx in range(2):
                for qy in range(4):
                    add(xh + qx, yc - 2 + qy, f"arr.{qx}.{qy}")
        elif m.startswith("emL."):                    # large emblem: 3 x 3 tiles over the spine at 0.62 L
            x0 = xs + round(0.62 * L)
            block = lambda xe: [(xe - 1 + q % 3, yc - 2 + q // 3) for q in range(9)]  # noqa: E731
            xe = next((x0 + d for d in (0, -1, 1, -2, 2, -3, 3) if all(solid(*t) for t in block(x0 + d))), x0)
            for q, (x, y) in enumerate(block(xe)):
                add(x, y, f"{m}.{q}")
        elif m.startswith("em."):
            ye, x0 = yc - 2, xs + round(0.62 * L)       # nearest spot to 0.62 L whose 2x2 tiles share one level
            quad = lambda xe: [(xe - 1 + q % 2, ye - 1 + q // 2) for q in range(4)]  # noqa: E731
            xe = next((x0 + d for d in (0, -1, 1, -2, 2, -3, 3) if all(solid(*t) for t in quad(x0 + d))
                       and len({level(*t) for t in quad(x0 + d)}) == 1), x0)
            for q in range(4):
                add(xe - 1 + q % 2, ye - 1 + q // 2, f"{m}.{q}")
        elif m in ("reg", "big"):
            num = str(100 + _h(seed, len(scheme), 5) % 900)
            n = 1 if m == "reg" else 2                # tiles per digit
            x0 = next((x for x in range(xb - 2 - 3 * n, xs, -1) if all(solid(x + k, yc + 1) and level(x + k, yc + 1)
                                                                       == level(x, yc + 1) for k in range(3 * n))),
                      xb - 2 - 3 * n)
            for k, c in enumerate(num):
                for t in range(n):
                    add(x0 + k * n + t, yc + 1, f"reg.{c}" if m == "reg" else f"big.{c}.{t}")
        elif m == "sten":                             # small stencil code block near the stern, S side
            for k in range(len(STENCIL)):
                add(xs + 1 + k, yc + 2, f"sten.{k}")
    return out
