"""The renderer's roof plating rule (roofArt.roofTile), ported."""


def rhash(*v):
    x = 0x9E3779B1
    for a in v:
        x = ((x ^ a) * 0x85EBCA6B) & 0xFFFFFFFF
        x = (x ^ (x >> 15)) & 0xFFFFFFFF
    return x


LAYOUTS = (((0, 0, 4, 2), (0, 2, 2, 2), (2, 2, 2, 2)), ((0, 0, 2, 4), (2, 0, 2, 2), (2, 2, 2, 2)),
           ((0, 0, 4, 1), (0, 1, 2, 3), (2, 1, 2, 3)), ((0, 0, 2, 2), (2, 0, 2, 2), (0, 2, 4, 2)))
PATCH, INSET = (2, 1, 0, 1), (1, 2, 2, 0)


def colour(mx):
    x0, k = 0, 0
    while True:
        col = "b" if k % 2 == 0 else "o"
        w = 1 + rhash(k, 11) % 3 if col == "b" else 1
        if mx < x0 + w:
            return col
        x0, k = x0 + w, k + 1


def roof_tile(x, y):
    """roofArt.roofTile: the plating sprite of roof tile (x, y)."""
    mx, my, u, v = x // 4, y // 4, x % 4, y % 4
    L = rhash(mx, my, 7) % 4
    base = f"roof.c{L}{colour(mx)}.{u}{v}"
    p = next((i for i, (a, b, w, h) in enumerate(LAYOUTS[L]) if a <= u < a + w and b <= v < b + h), -1)
    if rhash(mx, my, 13) % 3 != 0 and p == INSET[L]:
        return base + ".inset"
    if (mx + 2 * my) % 3 == 0 and p == PATCH[L]:
        return base + ".patch"
    return base
