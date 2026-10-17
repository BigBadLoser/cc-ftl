"""Floor sprites: seamless plated deck variants (lit, diamond-masked by env_build). Only `a` plus subtle `c` and `h`
are picked by the renderer; the rest are kept for placed content later."""
from . import core


def floor(variant):
    m = core.Mesh(f"floor_{variant}")

    def seam(i, j):
        if i == 0 or j == 0:
            return "dark"
        if i == 1 or j == 1:
            return "steelL"
        return None

    def fn(i, j):
        s = seam(i, j)
        if s:
            return s
        if variant == "a":                        # 2x2 plates with corner bolts
            pi, pj = i % 16, j % 16
            if pi == 0 or pj == 0:
                return "dark"
            if pi == 1 or pj == 1:
                return "steelL"
            return "plate" if (pi, pj) in ((4, 4), (12, 4), (4, 12), (12, 12)) else "steel"
        if variant == "b":                        # checkered plates
            pi, pj = i % 16, j % 16
            if pi == 0 or pj == 0:
                return "dark"
            return "steelD" if (i // 16 + j // 16) % 2 else "steel"
        if variant == "c":                        # one plate, inset frame, corner bolts
            if i in (5, 26) and 5 <= j <= 26 or j in (5, 26) and 5 <= i <= 26:
                return "steelD"
            return "plate" if (i, j) in ((3, 3), (28, 3), (3, 28), (28, 28)) else "steel"
        if variant == "d":                        # grate: slits
            if 4 <= i <= 27 and 4 <= j <= 27:
                if j % 3 == 0:
                    return "dark"
                return "steelD" if j % 3 == 1 else "grime"
            return "steel"
        if variant == "e":                        # hatch with handle
            if 8 <= i <= 23 and 8 <= j <= 23:
                if i in (8, 23) or j in (8, 23):
                    return "dark"
                if 14 <= i <= 17 and 14 <= j <= 17:
                    return "steelL"
                return "steelD"
            return "plate" if (i, j) in ((4, 4), (27, 4), (4, 27), (27, 27)) else "steel"
        if variant == "f":                        # 4x4 small plates
            pi, pj = i % 8, j % 8
            if pi == 0 or pj == 0:
                return "steelD"
            return "steel"
        if variant == "g":                        # planks along y
            pi = i % 16
            if pi == 0:
                return "steelD"
            if pi == 1:
                return "steelL"
            return "plate" if pi == 4 and j % 16 == 8 else "steel"
        # h: plate with bolt rows along two edges and a light centre rail
        if j in (15, 16):
            return "steelL"
        if (j in (4, 27)) and i % 4 == 2 and 4 <= i <= 27:
            return "plate"
        return "steel"
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), 32, 32, fn)
    return [m.build()]
