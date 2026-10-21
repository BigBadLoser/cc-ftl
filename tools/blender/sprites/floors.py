"""Floor sprites: seamless plated deck variants (lit, diamond-masked by env_build). Only `a` plus subtle `c` and `h`
are picked by the renderer; the rest are kept for placed content later.

Drawn on a 64x64 cell grid (a cell is about 2 px across, 1 px down at the 128x64 tile, so every line and dot is at
least 2 cells: thinner ones vanish in the downsample): plates have a dark seam and a light lip, bolts carry a shadow,
and the detail is structured (recessed grip panels, inset hatches, a grooved rail): the floor is the backdrop, so no
noise. Colours are the deck keys structure_looks.FLOOR_STEP remaps per ship look."""
from . import core

N = 64


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


def _grip(a, c, lo=10, hi=23):
    """A recessed grip panel (shadow on its low sides, a light lip on the high) with short bars across it."""
    if not (lo <= a <= hi and lo <= c <= hi):
        return "steel"
    if a <= lo + 1 or c <= lo + 1:
        return "steelD"
    if a >= hi - 1 or c >= hi - 1:
        return "steelL"
    return "steelD" if (a - lo) % 4 in (0, 1) and lo + 4 <= c <= hi - 4 else "steel"


def _corners(k0, k1):
    return ((k0, k0), (k1, k0), (k0, k1), (k1, k1))


def floor(variant):
    m = core.Mesh(f"floor_{variant}")

    def fn(i, j):
        if variant == "a":                        # 2x2 plates, corner bolts, tread on one diagonal pair
            qi, qj = i // 32, j // 32
            li, lj = i % 32, j % 32
            b = _bolt(li, lj, _corners(6, 24))
            if b:
                return b

            def inside(a, c):
                if (qi + qj) % 2 == 0:
                    return _grip(a, c)
                return "steel"
            return _plate(li, lj, 0, 0, 31, 31, inside)
        if variant == "b":                        # checkered plates
            qi, qj = i // 32, j // 32
            return _plate(i % 32, j % 32, 0, 0, 31, 31, "steelD" if (qi + qj) % 2 else "steel")
        if variant == "c":                        # one plate, an inset access panel with four screws, corner bolts
            b = _bolt(i, j, _corners(5, 57))
            if b:
                return b

            def inside(a, c):
                if 14 <= a <= 50 and 14 <= c <= 50:                          # the inset panel: shadow on its low sides
                    if a <= 15 or c <= 15:
                        return "steelD"
                    if a >= 49 or c >= 49:
                        return "steelL"
                    if any(x <= a <= x + 1 and y <= c <= y + 1 for x, y in _corners(19, 44)):
                        return "dark"                                        # screws
                    return "steel"
                return "steel"
            return _plate(i, j, 0, 0, 63, 63, inside)
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
        # h: plate with bolt rows along two edges and a grooved light centre rail
        b = _bolt(i, j, [(k, 8) for k in range(8, 56, 8)] + [(k, 54) for k in range(8, 56, 8)])
        if b:
            return b

        def inside(a, c):
            if 26 <= c <= 27 or 36 <= c <= 37:
                return "dark"                                                # the rail's grooves
            if 28 <= c <= 35:
                return "steelL" if c < 32 else "plate"
            return "steel"
        return _plate(i, j, 0, 0, 63, 63, inside)
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), N, N, fn)
    return [m.build()]
