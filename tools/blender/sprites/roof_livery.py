"""Roof livery system (v8 study, pure Python, no bpy): painted motifs as tile masks, recoloured per scheme.

Cost model: every motif is a set of 1x1-tile masks (MASKS, 32x32 cells) in two key channels, P (primary) and
S (secondary). They are rendered once as overlay sprites (roofs.livery_mask). At runtime a scheme only picks the
masks per tile (plan) and the colour pair; the overlay is recoloured and shaded by the plating under it:
    out = colour * lum(plating) / lum(top tone of the tile's colour family)
so grooves, lips and bolts show through the paint. One mask set (len(MASKS)) serves every scheme and faction.

Ship frame: the ship's long axis is x (bow = +x). The spine line sits on the tile boundary yc between rows yc - 1 ("n"
tiles) and yc ("s" tiles). Motif positions are fixed fractions of the spine length, so the rule adapts to any outline.
"""
from .roof_layout import GN, _h

DIGITS = {"0": ("111", "101", "101", "101", "111"), "1": ("010", "110", "010", "010", "111"),
          "2": ("111", "001", "111", "100", "111"), "3": ("111", "001", "011", "001", "111"),
          "4": ("101", "101", "111", "001", "001"), "5": ("111", "100", "111", "001", "111"),
          "6": ("111", "100", "111", "101", "111"), "7": ("111", "001", "001", "010", "010"),
          "8": ("111", "101", "111", "101", "111"), "9": ("111", "101", "111", "001", "111")}
AFT = ((0, 44), (54, 72), (82, 92))                  # aft banding: painted runs (cells from the stern), thinning


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
    **{f"em.{t}.{q}": _emblem(t, q) for t in ("dot", "delta", "cross") for q in range(4)},
}

# scheme: motifs (painted in this order) and colour pair (P, S)
SCHEMES = {
    "crimson": dict(motifs=("stripe", "chev", "reg"), P="#b0443a", S="#e2ddd0"),
    "ivory": dict(motifs=("saddle", "pinp", "em.dot"), P="#dcd8cc", S="#25272d"),
    "tide": dict(motifs=("aft", "saddle", "em.delta", "reg"), P="#2f8f8a", S="#e2ddd0"),
    "sovereign": dict(motifs=("stripe", "em.cross", "reg"), P="#26282e", S="#e0b23e"),
    "orchid": dict(motifs=("aft", "pins", "chev", "reg"), P="#74509e", S="#c3c8d2"),
}


def plan(ship, scheme, seed=0, level=lambda x, y: 0):
    """{(x, y): [mask names, bottom first]} for a ship outline (list of strings, '#' = hull) and a scheme name.
    level(x, y): relief level of a tile (raised belts); the registry block is kept on one level."""
    H, W = len(ship), len(ship[0])
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and ship[y][x] == "#"  # noqa: E731
    rows = [y for y in range(H) if any(solid(x, y) for x in range(W))]
    yc = (rows[0] + rows[-1] + 1 + 1) // 2
    spine = [x for x in range(W) if solid(x, yc - 1) and solid(x, yc)]
    xs, xb = spine[0], spine[-1]
    L = xb - xs + 1
    out = {}

    def add(x, y, m):
        if solid(x, y):
            out.setdefault((x, y), []).append(m)
    mot = SCHEMES[scheme]["motifs"]
    for m in mot:
        if m == "aft":
            for k in range(3):
                for y in range(H):
                    add(xs + k, y, f"aft.{k}")
        elif m == "saddle":
            x0 = xs + round(0.38 * L)
            for y in range(H):
                add(x0, y, "saddle.w")
                add(x0 + 1, y, "saddle.e")
        elif m in ("stripe", "pins", "pinp"):
            end = xb - 2 if "chev" in mot else xb
            for x in range(xs, end + 1):
                add(x, yc - 1, f"{'pin' if m == 'pins' else m}.n")
                add(x, yc, f"{'pin' if m == 'pins' else m}.s")
        elif m == "chev":
            for x in (xb - 1, xb):
                add(x, yc - 1, "chev.n")
                add(x, yc, "chev.s")
        elif m.startswith("em."):
            ye, x0 = yc - 2, xs + round(0.62 * L)       # nearest spot to 0.62 L whose 2x2 tiles share one level
            quad = lambda xe: [(xe - 1 + q % 2, ye - 1 + q // 2) for q in range(4)]  # noqa: E731
            xe = next((x0 + d for d in (0, -1, 1, -2, 2, -3, 3) if all(solid(*t) for t in quad(x0 + d))
                       and len({level(*t) for t in quad(x0 + d)}) == 1), x0)
            for q in range(4):
                add(xe - 1 + q % 2, ye - 1 + q // 2, f"{m}.{q}")
        elif m == "reg":
            num = str(100 + _h(seed, len(scheme), 5) % 900)
            x0 = next((x for x in range(xb - 5, xs, -1) if all(solid(x + k, yc + 1) and level(x + k, yc + 1)
                                                               == level(x, yc + 1) for k in range(3))), xb - 5)
            for k, c in enumerate(num):
                add(x0 + k, yc + 1, f"reg.{c}")
    return out
