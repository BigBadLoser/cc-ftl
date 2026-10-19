"""Galley and ration look preview (plain python3 + numpy + PIL): the galley at r0 idle and active in a walled room, a
crew member on its access tile and the fabricator beside it for contrast; the ration stacks and a crew member holding a
ration (held sprite at the runtime hand offset, crewView HAND / HAND_Y).

  python3 -I tools/blender/review/galley_preview.py <galley assets dir> <out dir> -> galley-1x.png / galley-3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import DIRS, Assets, Canvas, human, iso  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
HAND, HAND_Y = {0: (7, 3), 2: (-7, 3)}, -19


def room(cv, G, pub, ox, oy, active, label):
    nx, ny = 6, 4
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
    # galley footprint (0..1, 0), access tile (0, 1); the fabricator at (3..4, 0) for contrast
    cv.static(G, f"module.galley.r0{'.active' if active else ''}", *iso(ox, oy, 1, 0))
    cv.static(pub, f"module.fabricator{'.active' if active else ''}", *iso(ox, oy, 4, 0))
    cv.char(human(pub, 6), *iso(ox, oy, 0, 1))                       # facing NE, into the hatch
    cv.labels.append((ox - 150, oy - 100, label))
    cv.labels.append((iso(ox, oy, 4, 1)[0] - 20, iso(ox, oy, 4, 1)[1] + 6, "fabricator"))


def rations(cv, G, pub, ox, oy):
    for k, s in enumerate(("s", "m", "l")):
        x, y = ox + k * 80, oy
        cv.static(pub, "tile.floor.a", x, y)
        cv.static(G, f"item.ration.{s}", x, y)
        cv.labels.append((x - 20, y + 20, f"ration.{s}"))
    x, y = ox + 260, oy
    cv.static(pub, "tile.floor.a", x, y)
    cv.static(G, "item.ration.held", x, y)
    cv.labels.append((x - 20, y + 20, "held"))
    for k, d in enumerate((0, 2)):
        x, y = ox + 350 + k * 70, oy
        cv.static(pub, "tile.floor.a", x, y)
        cv.char(human(pub, d), x, y)
        img, g, an = G.static("item.ration.held")
        hx, hy = HAND[d]
        cv.put(img, g, x + hx - an["x"], y + HAND_Y + hy - an["y"])
    cv.labels.append((ox + 360, oy + 20, "carrying"))


def main():
    G, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(860, 420)
    room(cv, G, pub, 200, 110, False, "galley idle")
    room(cv, G, pub, 620, 110, True, "galley active")
    rations(cv, G, pub, 260, 360)
    for s in (1, 3):
        cv.save(out / f"galley-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
