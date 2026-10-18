"""Roof plating layout (pure Python, no bpy): armour modules of 4x4 tiles.

Sprite rule (deterministic, local): for roof tile (x, y) of a ship,
    module (mx, my) = (x // 4, y // 4), position (u, v) = (x % 4, y % 4)
    layout L = module_layout(mx, my) (hash, 4 layouts), colour c = module_colour(mx) (colour courses, see below)
    base sprite  = roof.p<L><c>.<u><v>      4 layouts x 2 colours x 16 positions = 128
    overlays     = roof.edge.<n|e|s|w>.<c>  one per OPEN side (mask bit clear; N1 E2 S4 W8) = 8
Plates are tile-aligned and a module has one colour, so a tile's overlays always match its plate.

Look (lit like the walls: +y faces lit, +x faces shaded):
  - frame girder: each module's N / W side is a 2-cell groove plus a dark band with a pair of rivets per tile.
    An open N / W side gets the same girder from its overlay, so the ship outline is framed wherever it runs;
  - 2-3 raised plates per module: 1-cell groove on N / W, lit lip on S, shaded lip on E, two tones of the hue;
  - each plate has its own surfacing: recessed pocket with corner bolts, twin pockets, riveted strap, bolted lap seam,
    corner bolts only, or plain. Every layout mixes them differently;
  - colour courses: module columns are grouped into bands (blue-grey 1-3 modules wide, hashed by band index, between
    1-module ochre bands), so the ship reads as blue-grey armour with ochre bands, like the hull.
Bolts are 2x2-cell lit heads with a 1-cell dark foot on S / E. Cells are 1/32 tile (a 2x1 px diamond at 1x).
"""
M = 4                  # module size (tiles)
GN = 32                # cells per tile side
MC = M * GN

# colour family roles -> palette names (palette_extra.json)
FAM = {
    "o": dict(top="rO1", t2="rO2", lit="rOL", shd="rOS", rl="rOR", k="rOK", fs="rOD", fe="rOE"),
    "b": dict(top="rB1", t2="rB2", lit="rBL", shd="rBS", rl="rBR", k="rBK", fs="rBD", fe="rBE"),
}

# plates per layout, in tile units: (x0, y0, w, h, tone, feature)
# features: P pocket + corner bolts, PP twin pockets, X / Y riveted strap along x / y, LX / LY bolted lap seam
# across x / y, C corner bolts only, - plain
LAYOUTS = (
    ((0, 0, 4, 2, 0, "P"), (0, 2, 2, 2, 1, "LX"), (2, 2, 2, 2, 0, "-")),
    ((0, 0, 2, 4, 0, "Y"), (2, 0, 2, 2, 1, "C"), (2, 2, 2, 2, 0, "P")),
    ((0, 0, 4, 1, 1, "-"), (0, 1, 2, 3, 0, "P"), (2, 1, 2, 3, 1, "LY")),
    ((0, 0, 2, 2, 1, "-"), (2, 0, 2, 2, 0, "X"), (0, 2, 4, 2, 1, "PP")),
)
RAIL = 9               # girder width (cells): 2-cell groove, 6-cell band, 1-cell weld line
RIVETS = (12, 17)      # girder rivet pair, offsets along each tile (cells)
FM = RAIL + 2          # feature margin from a plate's N / W edge (clear of any girder)


def _h(*v):
    x = 0x9E3779B1
    for a in v:
        x = ((x ^ (a & 0xFFFFFFFF)) * 0x85EBCA6B) & 0xFFFFFFFF
        x ^= x >> 15
    return x


def module_layout(mx, my):
    return _h(mx, my, 7) % len(LAYOUTS)


def module_colour(mx, my=0):
    """Colour courses: bands of module columns, blue-grey (1-3 modules, hashed by band index) between ochre bands (1)."""
    x0, k = 0, 0
    while True:
        col = "b" if k % 2 == 0 else "o"
        w = 1 + _h(k, 11) % 3 if col == "b" else 1
        if mx < x0 + w:
            return col
        x0, k = x0 + w, k + 1


def plate_at(layout, u, v):
    for p in LAYOUTS[layout]:
        if p[0] <= u < p[0] + p[2] and p[1] <= v < p[1] + p[3]:
            return p
    raise ValueError((layout, u, v))


def plate_family(layout, prim, u, v):
    """Colour family of the plate under (u, v): modules are single-coloured, so the module colour."""
    return prim


class _Canvas:
    def __init__(self, f, n=MC):
        self.g = [[None] * n for _ in range(n)]
        self.f = f
        self.flat = set()          # cells that are plain plate / band surface (bolts may go there)

    def put(self, X, Y, role, flat=False):
        self.g[Y][X] = self.f[role]
        (self.flat.add if flat else self.flat.discard)((X, Y))

    def bolt(self, X, Y, foot=True):
        """2x2 lit head with a 1-cell dark foot on its S / E side (reads raised at 1x)."""
        head = [(X + a, Y + b) for a in (0, 1) for b in (0, 1)]
        if not all(c in self.flat for c in head):
            return
        for c in head:
            self.put(*c, "lit")
        if foot:
            for c in ((X + 2, Y), (X + 2, Y + 1), (X, Y + 2), (X + 1, Y + 2), (X + 2, Y + 2)):
                if c in self.flat:
                    self.put(*c, "k")


def _raised(cv, X0, Y0, X1, Y1, body):
    """Raised slab: body, lit lip on its S edge, shade lip on its E edge, 1-cell groove on its N / W edge."""
    for Y in range(Y0, Y1):
        for X in range(X0, X1):
            if Y == Y0 or X == X0:
                cv.put(X, Y, "k")
            elif Y == Y1 - 1:
                cv.put(X, Y, "lit")
            elif X == X1 - 1:
                cv.put(X, Y, "shd")
            else:
                cv.put(X, Y, body, True)


def _pocket(cv, X0, Y0, X1, Y1, floor):
    """Recessed panel: lit N wall, shaded W wall, dark S / E corner line, floor in the other tone."""
    for Y in range(Y0, Y1):
        for X in range(X0, X1):
            if Y == Y0:
                cv.put(X, Y, "lit")
            elif X == X0:
                cv.put(X, Y, "shd")
            elif Y == Y1 - 1 or X == X1 - 1:
                cv.put(X, Y, "k")
            else:
                cv.put(X, Y, floor)


def _corners(cv, X0, Y0, X1, Y1):
    for bx, by in ((X0 + FM, Y0 + FM), (X1 - 7, Y0 + FM), (X0 + FM, Y1 - 7), (X1 - 7, Y1 - 7)):
        cv.bolt(bx, by)


def _feature(cv, feat, X0, Y0, X1, Y1, other):
    w, h = X1 - X0, Y1 - Y0
    if feat == "P":
        _pocket(cv, X0 + FM + 5, Y0 + FM + 5, X1 - 10, Y1 - 10, other)
        _corners(cv, X0, Y0, X1, Y1)
    elif feat == "PP":                                   # twin pockets split along the plate's long axis
        if w >= h:
            mid = X0 + w // 2
            _pocket(cv, X0 + FM + 3, Y0 + FM + 3, mid - 3, Y1 - 9, other)
            _pocket(cv, mid + 3, Y0 + FM + 3, X1 - 9, Y1 - 9, other)
        else:
            mid = Y0 + h // 2
            _pocket(cv, X0 + FM + 3, Y0 + FM + 3, X1 - 9, mid - 3, other)
            _pocket(cv, X0 + FM + 3, mid + 3, X1 - 9, Y1 - 9, other)
    elif feat in ("X", "Y"):                             # riveted strap across the middle, rivet pairs per tile
        along_x = feat == "X"
        c0 = ((Y0 + Y1) // 2 - 5) if along_x else ((X0 + X1) // 2 - 5)
        sx0, sy0, sx1, sy1 = (X0 + 1, c0, X1 - 1, c0 + 11) if along_x else (c0, Y0 + 1, c0 + 11, Y1 - 1)
        for Y in range(sy0, sy1):
            for X in range(sx0, sx1):
                if (along_x and Y == sy0) or (not along_x and X == sx0):
                    cv.put(X, Y, "k")
                elif along_x and Y == sy1 - 1:
                    cv.put(X, Y, "lit")
                elif not along_x and X == sx1 - 1:
                    cv.put(X, Y, "shd")
                else:
                    cv.put(X, Y, other, True)
        a0, a1 = (sx0, sx1) if along_x else (sy0, sy1)
        for t in range(a0 // GN, (a1 - 1) // GN + 1):
            for q in RIVETS:
                p = t * GN + q
                if a0 + 4 <= p < a1 - 5:
                    cv.bolt(*((p, sy0 + 4) if along_x else (sx0 + 4, p)), foot=False)
    elif feat in ("LX", "LY"):                           # lap seam: the far sub-plate laps over the near one, bolted
        along_x = feat == "LX"
        if along_x:
            s = Y0 + (Y1 - Y0) * 2 // 5
            for X in range(X0 + 1, X1 - 1):
                cv.put(X, s, "lit")
                cv.put(X, s + 1, "k")
            for Y in range(s + 2, Y1 - 1):
                for X in range(X0 + 1, X1 - 1):
                    if cv.g[Y][X] == cv.f["top" if other == "t2" else "t2"]:
                        cv.put(X, Y, other, True)
            for p in range(X0 + FM, X1 - 8, 10):
                cv.bolt(p, s - 5)
        else:
            s = X0 + (X1 - X0) * 2 // 5
            for Y in range(Y0 + 1, Y1 - 1):
                cv.put(s, Y, "shd")
                cv.put(s + 1, Y, "k")
            for Y in range(Y0 + 1, Y1 - 1):
                for X in range(s + 2, X1 - 1):
                    if cv.g[Y][X] == cv.f["top" if other == "t2" else "t2"]:
                        cv.put(X, Y, other, True)
            for p in range(Y0 + FM, Y1 - 8, 10):
                cv.bolt(s - 5, p)
    elif feat == "C":
        _corners(cv, X0, Y0, X1, Y1)


def _girder(cv, side, n):
    """Groove + dark band + weld line along the N (side 'n') or W ('w') edge of an n-cell square, rivet pairs per tile."""
    for a in range(n):
        for d in range(RAIL):
            X, Y = (a, d) if side == "n" else (d, a)
            if d < 2:
                cv.put(X, Y, "k")
            elif d == RAIL - 1:
                if a >= RAIL - 1 or cv.g[Y][X] is None or (X, Y) in cv.flat:
                    cv.put(X, Y, "k")
            else:
                cv.put(X, Y, "rl", True)
    for t in range(n // GN):
        for q in RIVETS:
            p = t * GN + q
            cv.bolt(*((p, 4) if side == "n" else (4, p)), foot=False)


def module_cells(layout, prim):
    """128x128 palette names for the module (rows Y, columns X)."""
    cv = _Canvas(FAM[prim])
    for x0, y0, w, h, tone, feat in LAYOUTS[layout]:
        body, other = ("t2", "top") if tone else ("top", "t2")
        X0, Y0, X1, Y1 = x0 * GN, y0 * GN, (x0 + w) * GN, (y0 + h) * GN
        _raised(cv, X0, Y0, X1, Y1, body)
        _feature(cv, feat, X0, Y0, X1, Y1, other)
    _girder(cv, "n", MC)
    _girder(cv, "w", MC)
    for d in range(2, RAIL):                       # girder crossing: keep the band continuous under the N girder
        for e in range(2, RAIL):
            cv.put(d, e, "rl")
    return cv.g


_CACHE = {}


def tile_cells(layout, prim, u, v):
    """32x32 palette names of base tile (u, v) of a module (rows j, columns i)."""
    key = (layout, prim)
    if key not in _CACHE:
        _CACHE[key] = module_cells(layout, prim)
    g = _CACHE[key]
    return [row[u * GN:(u + 1) * GN] for row in g[v * GN:(v + 1) * GN]]


def edge_cells(side, fam):
    """Top-surface cells an open side overrides: {(i, j): name}. N / W: the frame girder (same as a module edge);
    S: lit lip; E: shade lip (the slab face below is geometry, see roofs.py)."""
    if side in ("n", "w"):
        cv = _Canvas(FAM[fam], GN)
        _girder(cv, side, GN)
        return {(i, j): c for j, row in enumerate(cv.g) for i, c in enumerate(row) if c}
    f = FAM[fam]
    if side == "s":
        return {(k, GN - 1): f["lit"] for k in range(GN)}
    return {(GN - 1, k): f["shd"] for k in range(GN)}


def tile_id(x, y):
    mx, my, u, v = x // M, y // M, x % M, y % M
    return f"roof.p{module_layout(mx, my)}{module_colour(mx, my)}.{u}{v}"
