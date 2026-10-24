"""Faction structure preview (plain python3 + numpy + PIL): one test room (outer hull corner, straight hull run, interior
wall with a door, concave step) in the default look and each faction look, cutaway and walls-up, with a crew member.
Tiles are picked like src/render/tiles.ts (wallPieces / floorChain, ported below) with the faction id first in each
chain and today's id as the fallback; scrap picks p1..p4 per tile by hash.

  python3 -I tools/blender/review/structure_preview.py ids                      -> the default ids the room uses
  python3 -I tools/blender/review/structure_preview.py <structure assets> <out> -> structure-<look>-1x.png / -3x.png"""
import re
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
ALT = re.compile(r"^tile\.(hull\.(full\.)?|wall\.full\.)m\d+$")      # structure.ALT
PRE = {"up": "full.", "cut": "", "low": "low."}
LOOKS = [("default", None), ("navy", "navy"), ("drone", "drone"), ("civil v1", "civil.v1"), ("civil v2", "civil.v2"), ("civil v3", "civil.v3"), ("civil v4", "civil.v4"),
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


def corners(x, y, m):
    """tiles.ts wallCorners: NE 1, SE 2, SW 4, NW 8 (both arms connected, the three tiles round the corner solid wall)."""
    w = lambda dx, dy: at(x + dx, y + dy) == "#"  # noqa: E731
    c = 0
    for bit, need, (dx, dy) in ((1, 3, (1, -1)), (2, 6, (1, 1)), (4, 12, (-1, 1)), (8, 9, (-1, -1))):
        if m & need == need and w(dx, 0) and w(0, dy) and w(dx, dy):
            c |= bit
    return c


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
    c = corners(x, y, m)                           # corner fills: default look only, so faction looks use c0 here
    base = f"tile.{fam}.{PRE[level]}m{m}"
    out = [(base + v, 0, False, (f"{base}c{c}{v}", f"{base}c{c}") if c else ())]
    if m & 4 and ghost_at(x, y + 1, level):
        out.append((f"tile.{fam}.{PRE[level]}end.s", 1, False, (f"tile.{fam}.{PRE[level]}end.s.c{c & 6}",) if c & 6 else ()))
    if m & 2 and ghost_at(x + 1, y, level):
        out.append((f"tile.{fam}.{PRE[level]}end.e", 1, False, (f"tile.{fam}.{PRE[level]}end.e.c{c & 3}",) if c & 3 else ()))
    return out


def floor_id(x, y):
    r = (tile_hash(x, y) >> 8) % 20
    return f"tile.floor.{'c' if r == 0 else 'h' if r == 1 else 'a'}"


def chain(did, seg, x, y):
    """Faction id first (scrap: p1..p4 by tile hash), then the default; `.v1` falls back to the plain id too. Alt
    pieces (`.a1`..`.a3`, by tile hash) go in front."""
    if seg == "scrap":
        seg = f"scrap.p{1 + (tile_hash(x, y) >> 4) % 4}"
    ids = []
    plain = did[:-3] if did.endswith(".v1") else did
    n = (tile_hash(x, y) >> 12) % 8
    if seg and 1 <= n <= 3 and ALT.match(plain):
        f, rest = plain.split(".", 2)[1], plain.split(".", 2)[2]
        ids.append(f"tile.{f}.{seg}.{rest}.a{n}")
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
    def put(did, x, y, first=()):
        for aid in (() if seg else first) + tuple(chain(did, seg, x, y)):
            for A in (S, pub):
                if aid in A.m["assets"]:
                    cv.static(A, aid, *iso(ox, oy, x, y))
                    return
    tiles = [(x, y) for y in range(len(ROOM)) for x in range(len(ROOM[0])) if at(x, y) != " "]
    for x, y in tiles:                                              # under-floor layer: bellies, drops
        if at(x, y) in "#D":
            for did, _, under, *_ in pieces(x, y, level):
                if under:
                    put(did, x, y)
    for x, y in tiles:
        if not (at(x, y) == "#" and outward(x, y)):
            put(floor_id(x, y), x, y)
    draw = []
    for x, y in tiles:
        if at(x, y) in "#D":
            for did, order, under, *first in pieces(x, y, level):
                if not under:
                    draw.append((x + y, order, did, x, y, first[0] if first else ()))
    draw.append((2 + 3 + 0.5, 0, "@crew", 2, 3, ()))
    for _, _, did, x, y, first in sorted(draw):
        if did == "@crew":
            cv.char(human(pub, DIRS["SE"]), *iso(ox, oy, x, y))
        else:
            put(did, x, y, first)


def alt_strip(S, pub, out):
    """Per look: a far hull run and an interior wall run, plain then a1..a3 (cutaway and walls up)."""
    W, H = 300, 230
    cv = Canvas(W * 2, H * (len(LOOKS) - 2))
    for k, (label, seg) in enumerate(LOOKS[1:-1]):
        for j, level in enumerate(("cut", "up")):
            ox, oy = j * W + 150, k * H + 70
            pre = "full." if level == "up" else ""
            for y in range(5):
                for x in range(4):
                    if y:
                        cv.static(S, f"tile.floor.{seg}.a", *iso(ox, oy, x, y))
            draw = [(x, 0, f"tile.hull.{seg}.{pre}m10") for x in range(4)]
            draw += [(4, y, f"tile.wall.{seg}.{pre}m5") for y in range(1, 5)]
            for x, y, aid in sorted(draw, key=lambda d: d[0] + d[1]):
                n = x if y == 0 else y - 1
                aid = aid + (f".a{n}" if n else "")
                for A in (S, pub):
                    if aid in A.m["assets"]:
                        cv.static(A, aid, *iso(ox, oy, x, y))
                        break
                else:
                    cv.static(S, aid.rsplit(".a", 1)[0], *iso(ox, oy, x, y))
            cv.labels.append((j * W + 8, k * H + 6, f"{label} - {'cutaway' if level == 'cut' else 'walls up'}: plain, a1, a2, a3"))
    for s in (1, 3):
        cv.save(out / f"structure-alts-{s}x.png", s)


def main():
    if sys.argv[1] == "ids":
        print(",".join(used_ids()))
        return
    S, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets/2x")
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
    alt_strip(S, pub, out)
    print("wrote", out)


if __name__ == "__main__":
    main()
