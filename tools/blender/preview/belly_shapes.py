"""Test hulls for the belly mocks (gen_mock's shapes): name -> (tiles, NX, NY)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import hull_outline as HO  # noqa: E402


def shape(name):
    if name == "cross":                             # (a room with its four corners notched: concave corners every way)
        NX, NY = 12, 11
        return {(x, y) for x in range(NX) for y in range(NY)
                if not ((x < 3 or x >= NX - 3) and (y < 3 or y >= NY - 3))}, NX, NY
    if name[0] == "s" and name[1:].isdigit():       # (a catalog ship: hull_catalog's random outline of this seed)
        from sprites import hull_catalog as HC
        c = HC.outline(int(name[1:]))
        x0, y0 = min(x for x, _ in c), min(y for _, y in c)
        c = {(x - x0, y - y0) for x, y in c}
        return c, max(x for x, _ in c) + 1, max(y for _, y in c) + 1
    if name == "steps":                             # (lone steps and staircases of 2-tile treads, both ways, on the
        NX, NY = 19, 14                             # near sides: a 1-tile bump out and notch in on the +y side, a
        YM = {3: 13, 6: 11, 9: 11, 10: 11, 11: 10, 12: 10, 13: 9, 14: 9, 15: 7, 16: 5, 17: 5, 18: 1}  # step in on +x)
        XM = {0: 18, 1: 18}
        return {(x, y) for x in range(NX) for y in range(NY) if y <= YM.get(x, 12) and x <= XM.get(y, 17)}, NX, NY
    if name.startswith("oct"):                      # (a room, all four corners chamfered K steps)
        K, NX, NY = int(name[3:] or 2), 12, 11
        C, CR, CL, CF = (NX - 1) + (NY - 1) - K, (NX - 1) - K, (NY - 1) - K, K
        return {(x, y) for x in range(NX) for y in range(NY) if x + y <= C and x - y <= CR and y - x <= CL
                and x + y >= CF}, NX, NY
    K, NX, NY = int(name[5:] or 2), 15, 11          # taper: a body narrowing K steps each side to a nose
    return {(x, y) for x in range(NX) for y in range(NY) if min(K, max(0, x - 6)) <= y <= NY - 1 - min(K, max(0, x - 6))}, NX, NY


SHAPES = ("oct3", "taper2", "oct1", "cross", "steps")


def keys(name):
    tiles, _, _ = shape(name)
    loops = HO.outline(tiles)
    return {t: HO.key(loops, t) for t in tiles}
