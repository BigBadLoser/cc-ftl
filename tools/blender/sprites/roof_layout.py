"""Roof plating layout (pure Python, no bpy): armour modules of 4x4 tiles.

Sprite rule (deterministic, local): for roof tile (x, y) of a ship,
    module (mx, my) = (x // 4, y // 4), position (u, v) = (x % 4, y % 4)
    layout L = module_layout(mx, my) (hash, 4 layouts), colour c = module_colour(mx, my) (module columns alternate)
    base sprite  = roof.p<L><c>.<u><v>      4 layouts x 2 colours x 16 positions = 128
    overlays     = roof.edge.<n|e|s|w>.<c>  one per OPEN side (mask bit clear; N1 E2 S4 W8) = 8
Plates are tile-aligned and a module has one colour, so a tile's overlays always match its plate.

Look (lit like the walls: +y faces lit, +x faces shaded):
  - frame rail: each module's N / W side is a 2-cell groove plus a dark riveted girder band (the large-scale rhythm);
  - 2-3 raised plates per module: 1-cell groove on N / W, lit lip on S, shade lip on E, alternating two tones;
  - every plate carries one feature: a recessed pocket (lit N wall, shaded W wall, dark S / E line) with four corner
    bolts, or a riveted strap across its middle;
  - bolts are 2x2 lit heads with a 1-cell dark foot on S / E; nothing is scattered.
Cells are 1/32 tile; a cell is a 2x1 px diamond at 1x, so a bolt head is 4x2 px.
"""
M = 4                  # module size (tiles)
GN = 32                # cells per tile side
MC = M * GN

# colour family roles -> palette names (palette_extra.json)
FAM = {
    "o": dict(top="rO1", t2="rO2", lit="rOL", shd="rOS", rl="rOR", k="rOK", fs="rOD", fe="rOE"),
    "b": dict(top="rB1", t2="rB2", lit="rBL", shd="rBS", rl="rBR", k="rBK", fs="rBD", fe="rBE"),
}

# plates per layout, in tile units: (x0, y0, w, h, tone, feature); features: P pocket, X strap along x, Y strap along y
LAYOUTS = (
    ((0, 0, 4, 2, 0, "P"), (0, 2, 2, 2, 1, "Y"), (2, 2, 2, 2, 0, "P")),
    ((0, 0, 2, 4, 0, "P"), (2, 0, 2, 2, 1, "P"), (2, 2, 2, 2, 0, "X")),
    ((0, 0, 2, 2, 1, "P"), (2, 0, 2, 2, 0, "Y"), (0, 2, 4, 2, 0, "P")),
    ((0, 0, 2, 2, 0, "X"), (2, 0, 2, 4, 1, "P"), (0, 2, 2, 2, 1, "P")),
)
RAIL = 9               # frame rail width (cells) along each module's N and W edge, incl. its 2-cell groove
RIV = 8                # rivet pitch on rails and straps (cells)


def _h(*v):
    x = 0x9E3779B1
    for a in v:
        x = ((x ^ (a & 0xFFFFFFFF)) * 0x85EBCA6B) & 0xFFFFFFFF
        x ^= x >> 15
    return x


def module_layout(mx, my):
    return _h(mx, my, 7) % len(LAYOUTS)


def module_colour(mx, my):
    """Colour courses across the ship: whole module columns alternate blue-grey / ochre."""
    return "b" if mx % 2 == 0 else "o"


def plate_at(layout, u, v):
    for p in LAYOUTS[layout]:
        if p[0] <= u < p[0] + p[2] and p[1] <= v < p[1] + p[3]:
            return p
    raise ValueError((layout, u, v))


def plate_family(layout, prim, u, v):
    """Colour family of the plate under (u, v): modules are single-coloured, so the module colour."""
    return prim


class _Canvas:
    def __init__(self, f):
        self.g = [[None] * MC for _ in range(MC)]
        self.f = f
        self.flat = set()          # cells that are plain plate top (bolts may go there)

    def put(self, X, Y, role, flat=False):
        self.g[Y][X] = self.f[role]
        (self.flat.add if flat else self.flat.discard)((X, Y))

    def bolt(self, X, Y):
        """2x2 lit head with a 1-cell dark foot on its S / E side (reads raised at 1x)."""
        head = [(X + a, Y + b) for a in (0, 1) for b in (0, 1)]
        if not all(c in self.flat for c in head):
            return
        for c in head:
            self.put(*c, "lit")
        for c in ((X + 2, Y), (X + 2, Y + 1), (X, Y + 2), (X + 1, Y + 2), (X + 2, Y + 2)):
            if c in self.flat:
                self.put(*c, "k")


def _raised(cv, X0, Y0, X1, Y1, body):
    """Raised slab: body, lit lip on its S edge, shade lip on its E edge (grooves are drawn by the caller)."""
    for Y in range(Y0, Y1):
        for X in range(X0, X1):
            if Y == Y1 - 1:
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


def module_cells(layout, prim):
    """128x128 palette names for the module (rows Y, columns X)."""
    cv = _Canvas(FAM[prim])
    for x0, y0, w, h, tone, feat in LAYOUTS[layout]:
        body, other = ("t2", "top") if tone else ("top", "t2")
        X0, Y0, X1, Y1 = x0 * GN, y0 * GN, (x0 + w) * GN, (y0 + h) * GN
        _raised(cv, X0, Y0, X1, Y1, body)
        for Y in range(Y0, Y1):                                  # grooves on the plate's N / W sides
            for X in range(X0, X1):
                if (Y == Y0 and y0) or (X == X0 and x0):
                    cv.put(X, Y, "k")
        # inner area (inside grooves / rails / lips)
        ix0, iy0 = X0 + (RAIL if x0 == 0 else 1), Y0 + (RAIL if y0 == 0 else 1)
        ix1, iy1 = X1 - 1, Y1 - 1
        if feat == "P":
            m = 7
            _pocket(cv, ix0 + m, iy0 + m, ix1 - m, iy1 - m, other)
            for bx, by in ((ix0 + 3, iy0 + 3), (ix1 - 5, iy0 + 3), (ix0 + 3, iy1 - 5), (ix1 - 5, iy1 - 5)):
                cv.bolt(bx, by)
        elif feat in "XY":                                       # riveted strap across the plate's middle
            along_x = feat == "X"
            c0 = ((iy0 + iy1) // 2 - 4) if along_x else ((ix0 + ix1) // 2 - 4)
            sx0, sy0, sx1, sy1 = (ix0, c0, ix1, c0 + 9) if along_x else (c0, iy0, c0 + 9, iy1)
            for Y in range(sy0, sy1):
                for X in range(sx0, sx1):
                    if (along_x and Y == sy0) or (not along_x and X == sx0):
                        cv.put(X, Y, "k")
                    elif (along_x and Y == sy1 - 1) or (not along_x and X == sx1 - 1):
                        cv.put(X, Y, "lit" if along_x else "shd")
                    else:
                        cv.put(X, Y, other, True)
            span = range(sx0 + 4, sx1 - 4, RIV) if along_x else range(sy0 + 4, sy1 - 4, RIV)
            for p in span:
                cv.bolt(*((p, sy0 + 3) if along_x else (sx0 + 3, p)))
    # module frame: 2-cell groove + rail band along N and W, rivet row on the rail
    for Y in range(MC):
        for X in range(MC):
            if X < 2 or Y < 2:
                cv.put(X, Y, "k")
            elif (X < RAIL - 1 and Y >= 2) or (Y < RAIL - 1 and X >= 2):
                cv.put(X, Y, "rl", True)
            elif (X == RAIL - 1 and Y >= RAIL - 1) or (Y == RAIL - 1 and X >= RAIL - 1):
                cv.put(X, Y, "k")
    for p in range(RAIL + 1, MC - 2, RIV):
        for X, Y in ((p, 4), (4, p)):
            if (X, Y) in cv.flat and (X + 1, Y + 1) in cv.flat:
                for c in ((X, Y), (X + 1, Y), (X, Y + 1), (X + 1, Y + 1)):
                    cv.put(*c, "lit")
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
    """Top-surface cells an open side overrides: {(i, j): name}. N / W: dark rim; S: lit lip; E: shade lip."""
    f = FAM[fam]
    out = {}
    for k in range(GN):
        if side == "n":
            out[(k, 0)] = out[(k, 1)] = f["k"]
        elif side == "w":
            out[(0, k)] = out[(1, k)] = f["k"]
        elif side == "s":
            out[(k, GN - 1)] = f["lit"]
        elif side == "e":
            out[(GN - 1, k)] = f["shd"]
    return out


def tile_id(x, y):
    mx, my, u, v = x // M, y // M, x % M, y % M
    return f"roof.p{module_layout(mx, my)}{module_colour(mx, my)}.{u}{v}"
