"""Faction structure preview (plain python3 + numpy + PIL): one test room (outer hull corner, straight hull run, interior
wall with a door, concave step) in the default look and each faction look, cutaway and walls-up, with a crew member.
Tiles are picked like src/render/tiles.ts (wallPieces / floorChain, ported below) with the faction id first in each
chain and today's id as the fallback; scrap picks p1..p4 per tile by hash.

  python3 -I tools/blender/review/structure_preview.py ids                      -> the default ids the room uses
  python3 -I tools/blender/review/structure_preview.py <structure assets> <out> -> structure-<look>-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import DIRS, Assets, Canvas, human, iso  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ROOM = ["##########",
        "#...#....#",
        "#...D....#",
        "#...#....#",
        "#...#.####",
        "#.....#   ",
        "#######   "]
PRE = {"up": "full.", "cut": "", "low": "low."}
LOOKS = [("default", None), ("navy", "navy"), ("drone", "drone"), ("civil v1", "civil.v1"), ("civil v2", "civil.v2"),
         ("scrap", "scrap")]


def at(x, y):
    return ROOM[y][x] if 0 <= y < len(ROOM) and 0 <= x < len(ROOM[0]) else " "


def solid(x, y):
    return at(x, y) in "#D"


def touches_space(x, y):
    return any(at(x + dx, y + dy) == " " for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)


def outward(x, y):
    if not touches_space(x, y):
        return 0
    o = (1 if at(x, y + 1) == " " else 0) | (2 if at(x + 1, y) == " " else 0)
    return o or (4 if at(x + 1, y + 1) == " " else 0)


def mask(x, y):
    return (solid(x, y - 1) and 1) | (solid(x + 1, y) and 2) | (solid(x, y + 1) and 4) | (solid(x - 1, y) and 8)


def tile_hash(x, y):
    h = ((x * 73856093) ^ (y * 19349663)) & 0xFFFFFFFF
    return (h ^ (h >> 15)) & 0xFFFFFFFF


def ghost_at(x, y, level):
    return at(x, y) == "#" and touches_space(x, y) and (outward(x, y) > 0 or level == "low")


def pieces(x, y, level):
    """tiles.ts wallPieces (ghosts on, no gaps): [(default id, order, under)]."""
    o = outward(x, y)
    if at(x, y) == "D":
        ax = "x" if solid(x - 1, y) and solid(x + 1, y) else "y"
        out = [(f"tile.door.{ax}", 0, False)]
        if o:
            out.append((f"tile.hull.drop.{'s' if o & 1 else 'e'}", 1, True))
        return out
    m = mask(x, y)
    hull = touches_space(x, y)
    v = ".v1" if hull and (x + y) % 3 == 0 else ""
    if hull and o:
        out = [(f"tile.hull.o{o}.m{m}", 0, False)]
        if o < 4:
            out.append((f"tile.hull.belly.o{o}.m{m}{v}", 1, True))
        return out
    fam = "hull" if hull else "wall"
    base = f"tile.{fam}.{PRE[level]}m{m}"
    out = [(base + v, 0, False)]
    if m & 4 and ghost_at(x, y + 1, level):
        out.append((f"tile.{fam}.{PRE[level]}end.s", 1, False))
    if m & 2 and ghost_at(x + 1, y, level):
        out.append((f"tile.{fam}.{PRE[level]}end.e", 1, False))
    return out


def floor_id(x, y):
    r = (tile_hash(x, y) >> 8) % 20
    return f"tile.floor.{'c' if r == 0 else 'h' if r == 1 else 'a'}"


def chain(did, seg, x, y):
    """Faction id first (scrap: p1..p4 by tile hash), then the default; `.v1` falls back to the plain id too."""
    if seg == "scrap":
        seg = f"scrap.p{1 + (tile_hash(x, y) >> 4) % 4}"
    ids = []
    for d in ([did, did[:-3]] if did.endswith(".v1") else [did]):
        if seg:
            f, rest = d.split(".", 2)[1], d.split(".", 2)[2]
            ids.append(f"tile.{f}.{seg}.{rest}")
    return ids + ([did, did[:-3]] if did.endswith(".v1") else [did])


def used_ids():
    ids = set()
    for level in ("cut", "up"):
        for y in range(len(ROOM)):
            for x in range(len(ROOM[0])):
                k = at(x, y)
                if k == " ":
                    continue
                ids.add(floor_id(x, y))
                if k in "#D":
                    ids.update(p[0] for p in pieces(x, y, level))
    return sorted(i for i in ids if not i.startswith("tile.door"))


def draw_room(cv, S, pub, ox, oy, seg, level):
    def put(did, x, y):
        for aid in chain(did, seg, x, y):
            for A in (S, pub):
                if aid in A.m["assets"]:
                    cv.static(A, aid, *iso(ox, oy, x, y))
                    return
    tiles = [(x, y) for y in range(len(ROOM)) for x in range(len(ROOM[0])) if at(x, y) != " "]
    for x, y in tiles:                                              # under-floor layer: bellies, drops
        if at(x, y) in "#D":
            for did, _, under in pieces(x, y, level):
                if under:
                    put(did, x, y)
    for x, y in tiles:
        if not (at(x, y) == "#" and outward(x, y)):
            put(floor_id(x, y), x, y)
    draw = []
    for x, y in tiles:
        if at(x, y) in "#D":
            for did, order, under in pieces(x, y, level):
                if not under:
                    draw.append((x + y, order, did, x, y))
    draw.append((2 + 3 + 0.5, 0, "@crew", 2, 3))
    for _, _, did, x, y in sorted(draw):
        if did == "@crew":
            cv.char(human(pub, DIRS["SE"]), *iso(ox, oy, x, y))
        else:
            put(did, x, y)


def main():
    if sys.argv[1] == "ids":
        print(",".join(used_ids()))
        return
    S, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    W, H = 460, 330
    for label, seg in LOOKS:
        cv = Canvas(W * 2, H)
        for k, level in enumerate(("cut", "up")):
            draw_room(cv, S, pub, k * W + 230, 110, seg, level)
            cv.labels.append((k * W + 8, 6, f"{label} - {'cutaway' if level == 'cut' else 'walls up'}"))
        name = label.replace(" ", "-")
        for s in (1, 3):
            cv.save(out / f"structure-{name}-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
