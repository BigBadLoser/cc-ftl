"""Floor sprites: seamless plated deck variants (lit, diamond-masked by env_build). Only `a` plus subtle `c` and `h`
are picked by the renderer (a on ~90% of tiles, c and h on ~5% each); the rest are kept for placed content later.

Drawn on a 64x64 cell grid (a cell is about 2 px across, 1 px down at the 128x64 tile, so every line and dot is at
least 2 cells: thinner ones vanish in the downsample): a, c and h are one panel a tile with a soft seam, chamfered
corners and a light lip (the way RimWorld and Space Haven decks tile); a stays plain, since anything on it repeats on
every tile, and the occasional c and h carry the wear and detail. The unused variants keep their own plate style. Colours are the deck keys structure_looks.FLOOR_STEP remaps per ship look.

Court floors (family court_floors, `court`): finishes the station generator paints a court with, tile by tile (the sim's
`floor` field): walkway paving, garden soil, market tile, drill-hall tread plate."""
from . import core

N = 64


def _panel(i, j, ch=4):
    """One panel a tile, the RimWorld / Space Haven way: a soft seam (steelD, not black) on its low sides (the next
    tile's closes the others), chamfered corners (a small diamond where four tiles meet), a light lip along one side;
    None inside."""
    if i < 2 or j < 2:
        return "steelD"
    ci, cj = min(i, 63 - i), min(j, 63 - j)
    if ci + cj < ch + 2 and ci < ch + 2 and cj < ch + 2:
        return "steelD"
    if i < 4:
        return "boot"
    return None


def _scratches(i, j, lines):
    """Faint 2-cell scratches along the given cell segments."""
    for (a0, b0), (a1, b1) in lines:
        n = max(abs(a1 - a0), abs(b1 - b0))
        for t in range(n + 1):
            a, b = a0 + (a1 - a0) * t // n, b0 + (b1 - b0) * t // n
            if a <= i <= a + 1 and b <= j <= b + 1:
                return True
    return False


def _plate(i, j, i0, j0, i1, j1, fill="steel"):
    """Colour of cell (i, j) on a plate spanning i0..i1, j0..j1 (inclusive): a dark seam and a light lip on its low
    sides (the next plate's seam closes the high ones), `fill` inside (a callable gets the local cell)."""
    if i <= i0 + 1 or j <= j0 + 1:
        return "dark"
    if i <= i0 + 3 or j <= j0 + 3:
        return "steelL"
    return fill(i - i0, j - j0) if callable(fill) else fill


def _bolt(i, j, at):
    """Bolt heads (2x2, light) with a 2x2 shadow below-right; None off the bolts."""
    for bi, bj in at:
        if bi <= i <= bi + 1 and bj <= j <= bj + 1:
            return "plate"
        if bi + 1 <= i <= bi + 2 and bj + 1 <= j <= bj + 2:
            return "steelD"
    return None


def _corners(k0, k1):
    return ((k0, k0), (k1, k0), (k0, k1), (k1, k1))


def _hash(i, j, seed):
    """A stable 0..1 value per cell (for scattered detail that tiles: callers wrap i, j)."""
    h = (i * 73856093 ^ j * 19349663 ^ seed * 83492791) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535


def court(variant, i, j):
    """Court floors (family court_floors; the station generator paints them, not the hash): walk (promenade paving),
    soil (garden beds), market (plaza tiles), tread (drill-hall diamond plate). Each tiles seamlessly, its seams on the
    low sides as a's."""
    if variant == "walk":                         # pale composite pavers, two by two, with dark joints and a worn lip
        pi, pj = i % 32, j % 32
        if pi < 2 or pj < 2:
            return "c4F4"
        if pi < 4 or pj < 4:
            return "c4W5"
        return "c4F1" if _hash(i // 32, j // 32, 3) < 0.5 else "c4F0"
    if variant == "soil":                         # dark earth with moss tufts and a few pebbles
        r = _hash(i // 2, j // 2, 7)
        if r < 0.07:
            return "xnFL" if r < 0.025 else "xnF"
        if r < 0.10:
            return "alG"
        if r < 0.115:
            return "rkL"
        return "gdD" if _hash(i // 4, j // 4, 9) < 0.55 else "rkDM"
    if variant == "market":                       # small muted terracotta tiles, a darker one at random, dark grout
        ti, tj = i % 16, j % 16
        if ti < 2 or tj < 2:
            return "c1F4"
        return "c1T6" if _hash(i // 16, j // 16, 5) < 0.3 else "c1T5"
    # tread: diamond plate, raised bars two ways in a checker, a lit top and a shadow below, framed at the tile seam
    if i < 2 or j < 2:
        return "steelD"
    bi, bj = i // 16, j // 16
    u, v = i % 16 - 8, j % 16 - 8
    a, b = (u + v, u - v) if (bi + bj) % 2 == 0 else (u - v, u + v)
    if abs(a) <= 7 and -1 <= b <= 1:
        return "plate" if b < 0 else "steelL"
    if abs(a) <= 7 and b == 2:
        return "steelD"
    return "steel"


COURT = ("walk", "soil", "market", "tread")
SPRITES = [(f"tile.floor.{v}", (1, 1), "floor", lambda v=v: floor(v)) for v in COURT]


def floor(variant):
    m = core.Mesh(f"floor_{variant}")
    if variant in COURT:
        m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), N, N, lambda i, j: court(variant, i, j))
        return [m.build()]

    def fn(i, j):
        if variant == "a":                        # the deck everywhere: one plain panel (detail would repeat)
            return _panel(i, j) or "steel"
        if variant == "b":                        # checkered plates
            qi, qj = i // 32, j // 32
            return _plate(i % 32, j % 32, 0, 0, 31, 31, "steelD" if (qi + qj) % 2 else "steel")
        if variant == "c":                        # a sibling of a on ~5% of tiles: a few faint scratches
            p = _panel(i, j)
            if p:
                return p
            return "boot" if _scratches(i, j, (((14, 20), (24, 26)), ((40, 12), (47, 16)), ((30, 44), (44, 52)))) \
                else "steel"
        if variant == "d":                        # grate: slits in a framed well
            def inside(a, c):
                if 8 <= a <= 55 and 8 <= c <= 55:
                    if a <= 9 or c <= 9 or a >= 54 or c >= 54:
                        return "dark"
                    k = c % 8
                    return "dark" if k < 3 else ("steelL" if k < 5 else ("steelD" if k == 7 else "grime"))
                return "steel"
            return _plate(i, j, 0, 0, 63, 63, inside)
        if variant == "e":                        # hatch with a recessed handle
            b = _bolt(i, j, _corners(6, 55))
            if b:
                return b

            def inside(a, c):
                if 16 <= a <= 47 and 16 <= c <= 47:
                    if a <= 17 or c <= 17 or a >= 46 or c >= 46:
                        return "dark"
                    if a <= 19 or c <= 19:
                        return "steelL"
                    if 26 <= a <= 37 and 28 <= c <= 35:
                        return "dark" if c <= 29 or c >= 34 or a <= 27 or a >= 36 else "steelL"   # handle in a recess
                    return "steelD"
                return "steel"
            return _plate(i, j, 0, 0, 63, 63, inside)
        if variant == "f":                        # 4x4 small plates
            return _plate(i % 16, j % 16, 0, 0, 15, 15, "steel")
        if variant == "g":                        # planks along y, a bolt pair per plank
            pi = i % 32
            b = _bolt(pi, j % 32, ((15, 15),))
            if b:
                return b
            return _plate(pi, j, 0, -1, 31, 64, "steel")
        # h: a sibling of a on ~5% of tiles: a small bolted access plate in one corner
        p = _panel(i, j)
        if p:
            return p
        if 38 <= i <= 55 and 38 <= j <= 55:
            if i <= 39 or j <= 39:
                return "steelD"
            b = _bolt(i, j, ((42, 42), (50, 50)))
            if b:
                return b
            return "boot" if i <= 41 else "steel"
        return "steel"
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), N, N, fn)
    return [m.build()]
