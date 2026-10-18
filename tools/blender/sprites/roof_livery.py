"""Roof livery system (v8 study, pure Python, no bpy): painted motifs as tile masks, recoloured per scheme.

Cost model (v10: 80 masks): every motif is a set of 1x1-tile masks (MASKS, 32x32 cells) in two key channels, P (primary) and
S (secondary). They are rendered once as overlay sprites (roofs.livery_mask). At runtime a scheme only picks the
masks per tile (plan) and the colour pair; the overlay is recoloured and shaded by the plating under it:
    out = colour * lum(plating) / lum(top tone of the tile's colour family)
so grooves, lips and bolts show through the paint. One mask set (len(MASKS)) serves every scheme and faction.

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
STENCIL = ("FX-", "407")                            # stern code block, one mask per tile


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


STAR = [((17 if k % 2 == 0 else 7) * math.cos(k * math.pi / 5), (17 if k % 2 == 0 else 7) * math.sin(k * math.pi / 5))
        for k in range(10)]


def _glyph(c):
    return DIGITS.get(c) or LETTERS[c]


def _big(c, k):
    def f(i, j):                                      # big hull number: 24 x 30 px a digit, two tiles wide
        I = k * GN + i
        a, b = (I - j - 5) // 8, (j - 1) // 6
        return "P" if 1 <= j < 31 and I - j - 5 >= 0 and 0 <= a < 3 and b < 5 and _glyph(c)[b][a] == "1" else None
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


def _emblem(kind, q):
    def f(i, j):
        X, Y = (q % 2) * GN + i + 0.5 - GN, (q // 2) * GN + j + 0.5 - GN
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
    **{f"em.{t}.{q}": _emblem(t, q) for t in ("dot", "delta", "cross", "star", "diamond") for q in range(4)},
    # v10
    "full.P": lambda i, j: "P",
    "half.n": lambda i, j: "P" if j < 26 else "S" if 27 <= j < 31 else None,
    "dbl.n": _dbl[0], "dbl.s": _dbl[1], "shaft.n": _shaft[0], "shaft.s": _shaft[1],
    "bar": lambda i, j: "P" if 9 <= i < 21 else None,
    **{f"arr.{qx}.{qy}": _arrow(qx, qy) for qx in range(2) for qy in range(4)},
    **{f"big.{c}.{k}": _big(c, k) for c in DIGITS for k in range(2)},
    **{f"sten.{k}": _stencil(t) for k, t in enumerate(STENCIL)},
}

MASKS = {k: f for k, f in MASKS.items() if any(f(i, j) for i in range(GN) for j in range(GN))}   # drop empty ones

# scheme: motifs (painted in this order), colours P / S (/ T), and per-motif channel remaps for 3-colour schemes
SCHEMES = {
    "crimson": dict(motifs=("stripe", "chev", "reg"), P="#b0443a", S="#e2ddd0"),
    "ivory": dict(motifs=("saddle", "pinp", "em.dot"), P="#dcd8cc", S="#25272d"),
    "tide": dict(motifs=("aft", "saddle", "em.delta", "reg"), P="#2f8f8a", S="#e2ddd0"),
    "sovereign": dict(motifs=("stripe", "em.cross", "reg"), P="#26282e", S="#e0b23e"),
    "orchid": dict(motifs=("aft", "pins", "chev", "reg"), P="#74509e", S="#c3c8d2"),
    "hornet": dict(motifs=("dbl", "nose", "big"), P="#d9822b", S="#25272d", remap={"big": ("S", "S")}),
    "glacier": dict(motifs=("split", "arrow", "sten"), P="#aebdcb", S="#1d2a44"),
    "verdant": dict(motifs=("bars", "arrow", "em.star", "sten"), P="#4f9a4a", S="#e2ddd0"),
    "ember": dict(motifs=("nose", "bars", "em.diamond", "big"), P="#26282e", S="#d9822b"),
    "tricolour": dict(motifs=("split", "dbl", "em.star", "big", "sten"), P="#24324f", S="#e2ddd0", T="#b0443a",
                      remap={"dbl": ("T", "S"), "em.star": ("T", "S"), "big": ("S", "S")}),
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
        if m == "aft":
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
