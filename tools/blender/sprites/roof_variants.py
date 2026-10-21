"""Roof v7 variant studies on top of the v6 module language (pure Python, no bpy). Preview only for now.

A  livery   painted spine stripe along the ship's length with forward-pointing chevrons in the bow module, a red
            registry block with a white hull number on the module behind the bow (S of the stripe), and red bars on
            open E (bow-facing) edges of the bow module column near the spine. Paint recolours plate surfaces by
            role (grooves stay dark), so it reads as painted plating. Rule: the module grid origin is chosen per ship
            so the spine lands on rows v = 1..2 of one module row.
            Cost: stripe 64 + bow chevrons 64 + edge bars 32 (u = 3 bases) + registry digits 20 (decals) = ~+180.
B  depth    ochre courses are raised armour belts (4 px higher in v9, 12 in v7: same base sprites, an anchor offset), with a
            bevelled step on their E side, tall slab faces on their open S / E ends and a recessed trench in the
            blue-grey plating along both sides of each belt. In modules fully inside the hull, layouts 0 and 2 swap
            their big pocket for a raised blister.
            Cost: step 1 + trench 2 + tall edges 2 = +5; blisters +64 (2 layouts x 2 colours x 16). v9: 4 px raise.
C  material stronger value range and saturation, cooler blue-grey and warmer ochre (own palette, replaces the v6
            one at no extra cost), one replacement plate in a slightly different tone in every third module
            ((mx + 2 my) % 3 == 0, plate fixed per layout), and a subtle ship-wide light gradient done as a runtime
            per-tile tint (0 sprites). Cost: patched plates 2 colours x 16 tiles = +32.
"""
from . import roof_layout as rl
from .scale import ART_SCALE
from .roof_layout import GN, MC, FAM, _Canvas, _raised, _feature, _girder, _corners

FAM_C = {
    "o": dict(top="cO1", t2="cO2", lit="cOL", shd="cOS", rl="cOR", k="cOS", fs="cOD", fe="cOE", pa="cOP", pa2="cOQ"),
    "b": dict(top="cB1", t2="cB2", lit="cBL", shd="cBS", rl="cBR", k="cBS", fs="cBD", fe="cBE", pa="cBP", pa2="cBQ"),
}
PATCH = (2, 1, 0, 1)          # patched plate index per layout (variant C)
INSET = (1, 2, 2, 0)          # inset plate index per layout (v10): never the patched plate
DI = 2.5 * ART_SCALE          # inset depth (px; 2.5 at the 64x32 baseline)


def inset_module(mx, my):
    """v10: about 2 in 3 modules recess their INSET plate (hashed per module, so never a whole course)."""
    return rl._h(mx, my, 13) % 3 != 0


def inset_plate(layout, u, v):
    """The INSET plate of a layout if tile (u, v) lies on it, else None (plates are tile-aligned)."""
    p = rl.LAYOUTS[layout][INSET[layout]]
    return p if p[0] <= u < p[0] + p[2] and p[1] <= v < p[1] + p[3] else None
LAYOUTS_B = tuple(tuple((p[:5] + ("B",)) if p[5] == "P" and p[2] * p[3] >= 6 else p for p in lay)
                  for lay in rl.LAYOUTS)
DZ_BLISTER = 0.16             # blister height (tiles), about 6 px
PAINT = {"top": "lvR", "t2": "lvR2", "lit": "lvRL", "shd": "lvRS", "rl": "lvRS"}
PAINT_W = {"top": "lvW", "t2": "lvW2", "lit": "lvWL", "shd": "lvWS", "rl": "lvWS"}


def module_cells(layout, prim, fam=FAM, layouts=rl.LAYOUTS, patch=False):
    """(names 128x128, raised set of (X, Y) cells for blisters)."""
    f0 = fam[prim]
    cv = _Canvas(f0)
    raised = set()
    for idx, (x0, y0, w, h, tone, feat) in enumerate(layouts[layout]):
        cv.f = dict(f0, top=f0["pa"], t2=f0["pa2"]) if patch and idx == PATCH[layout] else f0
        body, other = ("t2", "top") if tone else ("top", "t2")
        X0, Y0, X1, Y1 = x0 * GN, y0 * GN, (x0 + w) * GN, (y0 + h) * GN
        _raised(cv, X0, Y0, X1, Y1, body)
        if feat == "B":
            bx0, by0, bx1, by1 = X0 + rl.FM + 2, Y0 + rl.FM + 2, X1 - 9, Y1 - 9
            _raised(cv, bx0, by0, bx1, by1, other)
            raised |= {(X, Y) for X in range(bx0, bx1) for Y in range(by0, by1)}
            _corners(cv, bx0 - 6, by0 - 6, bx1 + 2, by1 + 2)
        else:
            _feature(cv, feat, X0, Y0, X1, Y1, other)
    cv.f = f0
    _girder(cv, "n", MC)
    _girder(cv, "w", MC)
    for d in range(2, rl.RAIL):
        for e in range(2, rl.RAIL):
            cv.put(d, e, "rl")
    return cv.g, raised


_CACHE = {}


def tile(layout, prim, u, v, variant="v6", patch=False, paint=None):
    """(32x32 names, raised cells {(i, j)}) of one base tile. paint: None, 'stripe' or 'chevron' (variant A, v 1..2)."""
    fam = FAM_C if variant == "C" else FAM
    lays = LAYOUTS_B if variant == "B" else rl.LAYOUTS
    key = (layout, prim, variant, patch)
    if key not in _CACHE:
        _CACHE[key] = module_cells(layout, prim, fam, lays, patch)
    g, raised = _CACHE[key]
    out = [list(row[u * GN:(u + 1) * GN]) for row in g[v * GN:(v + 1) * GN]]
    rs = {(X - u * GN, Y - v * GN) for X, Y in raised if u * GN <= X < (u + 1) * GN and v * GN <= Y < (v + 1) * GN}
    f = fam[prim]
    inv = {f[r]: r for r in ("top", "t2", "lit", "shd", "rl")}
    for layer in (paint or ()):
        for j in range(GN):
            for i in range(GN):
                r = inv.get(out[j][i])
                if r is None and not (layer.startswith("reg") and out[j][i] == f["k"]):
                    continue
                r = r or "shd"
                c = _paint(layer, u, v, i, j)
                if c:
                    out[j][i] = (PAINT_W if c == "w" else PAINT)[r]
    return out, rs


DIGITS = {"0": ("111", "101", "101", "101", "111"), "7": ("111", "001", "001", "010", "010"),
          "1": ("010", "110", "010", "010", "111"), "2": ("111", "001", "111", "100", "111"),
          "3": ("111", "001", "011", "001", "111"), "4": ("101", "101", "111", "001", "001"),
          "5": ("111", "100", "111", "001", "111"), "6": ("111", "100", "111", "101", "111"),
          "8": ("111", "101", "111", "101", "111"), "9": ("111", "101", "111", "001", "111")}


def _paint(layer, u, v, i, j):
    """'r' (faction red), 'w' (white) or None for cell (i, j) of tile (u, v) under one paint layer."""
    X, B = u * GN + i, (v - 1) * GN + j               # B: row inside the 64-cell spine band (v = 1..2)
    if layer in ("stripe", "chevron"):
        if 10 <= B < 14 or 50 <= B < 54:               # white pinstripes
            return "w"
        if 18 <= B < 46:                               # the faction band
            return "w" if layer == "chevron" and ((X + abs(B - 31.5)) // 10) % 2 == 0 else "r"
        return None
    if layer == "edge":                                # bow edge chevrons: red bars along an open E edge
        return "r" if i >= GN - 12 and ((i + j) // 6) % 2 == 0 else None
    if layer.startswith("reg"):                        # registry block: red panel with a white digit, 2 tiles wide
        side, d = layer[3], layer[4]                   # side 'l' / 'r' of the block
        if not (3 <= j < 29) or (side == "l" and i < 4) or (side == "r" and i >= GN - 4):
            return None
        x0 = 14 if side == "l" else 3                  # digit 3x5 at 5 cells a pixel
        a, b = (i - x0) // 5, (j - 4) // 5
        if 0 <= a < 3 and 0 <= b < 5 and DIGITS[d][b][a] == "1" and i - x0 >= 0 and j >= 4:
            return "w"
        return "r"
    return None
    return out, rs


def trench_cells(side, fam=FAM, col="b"):
    """Recessed channel along a tile's W or E edge, beside a raised belt (variant B): dark shadow at the belt's foot,
    channel floor in the girder tone, then the plate's own wall (hidden on W, a shaded face on E)."""
    f = fam[col]
    out = {}
    for k in range(GN):
        for d in range(6):                      # scaled to the 4 px belt: shadow, floor, far wall
            i = d if side == "w" else GN - 1 - d
            if d < 1:
                c = "k"
            elif d < 4:
                c = "rl"
            else:
                c = "k" if side == "w" or d == 5 else "shd"
            out[(i, k)] = f[c]
    return out
