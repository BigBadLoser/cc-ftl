"""Alien look preview (plain python3 + numpy + PIL): the hunter in SE, SW and NW (idle, attack wind-up and strike) plus
run, hurt and dead, next to a human crew member and a worker robot, in a walled room. Composited like the runtime (one
outline round the creature with the cool rim, additive glow).

  python3 -I tools/blender/review/alien_preview.py <alien assets dir> <out dir>  -> alien-1x.png / alien-3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import DIRS, Assets, Canvas, character, human, iso, robot  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]


def creature(A, kind, d, clip, i=0):
    return character(None, [A.frame(f"crew.alien.body.{kind}", d, clip, i)], {})


def main():
    A, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    nx, ny = 14, 6
    cv = Canvas(860, 420)
    ox, oy = 250, 70
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
    cells = []                                           # (gx, gy, pair, label)
    for k, (dn, d) in enumerate((("SE", 0), ("SW", 2), ("NW", 4))):
        for j, (clip, i, lab) in enumerate((("idle", 0, "idle"), ("attack", 1, "wind-up"), ("attack", 3, "strike"))):
            cells.append((1 + j * 2, 1 + k * 1.6, creature(A, "hunter", d, clip, i), f"{dn} {lab}"))
    cells += [(8, 1, creature(A, "hunter", 0, "run", 1), "run"), (8, 2.6, creature(A, "hunter", 0, "hurt", 0), "hurt"),
              (8, 4.2, creature(A, "hunter", 0, "dead", 0), "dead"),
              (11, 2, human(pub, DIRS["SE"]), "crew"), (11, 3.8, robot(pub, "worker", DIRS["SE"], "idle"), "robot")]
    for gx, gy, pair, lab in sorted(cells, key=lambda c: c[0] + c[1]):
        sx, sy = iso(ox, oy, gx, gy)
        cv.char(pair, int(sx), int(sy))
        cv.labels.append((int(sx) - 22, int(sy) + 12, lab))
    for s in (1, 3):
        cv.save(out / f"alien-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
