"""Test shapes for the edge-line look study (floor_study.py renders them, review/mark_preview.py lays them out): each map
row is a row of tiles along +y, each char a tile along +x: '#' wall, '.' floor, 'D' a door (a gap the line stops at).
Pure python (no bpy), so the preview can read it too."""

MAPS = {
    # a room, a corridor two wide with a T branch down to a door
    "run": [
        "############",
        "#....#######",
        "#....#######",
        "#..........#",
        "#..........#",
        "######..####",
        "######..####",
        "######D#####",
    ],
    # a corridor two wide stepping diagonally
    "stairs": [
        "########",
        "#..#####",
        "#...####",
        "##...###",
        "###...##",
        "####...#",
        "#####..#",
        "########",
    ],
}

N = 64          # cells a tile side (floors.py N)


def kind(rows, x, y):
    if y < 0 or y >= len(rows) or x < 0 or x >= len(rows[0]):
        return "#"
    return rows[y][x]


def wall_dist(rows, gx, gy, door_too=True):
    """Chebyshev distance in cells from global cell (gx, gy) to the nearest wall tile (and door tile), searching the
    tiles round it; returns (distance, nearest is a door)."""
    tx, ty = gx // N, gy // N
    best, door = 10 ** 9, False
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            k = kind(rows, tx + dx, ty + dy)
            if k == "#" or (k == "D" and door_too):
                x0, y0 = (tx + dx) * N, (ty + dy) * N
                ddx = max(x0 - gx, 0, gx - (x0 + N - 1))
                ddy = max(y0 - gy, 0, gy - (y0 + N - 1))
                d = max(ddx, ddy)
                if d < best or (d == best and k == "#"):
                    best, door = d, k == "D"
    return best, door
