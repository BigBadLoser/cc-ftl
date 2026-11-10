"""Arcade cabinet look study preview (plain python3 + numpy + PIL): each design on a floor tile, a crew member at its front
for scale (two tiles: the cabinet's and the one in front of it, +v).

  python3 -I tools/blender/review/arcade_preview.py <arcade assets dir> <out dir> [designs, default a1,a2,a3]
    -> arcade-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

NAMES = {"a1": "A1  classic upright", "a2": "A2  hooded", "a3": "A3  fibreglass"}


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "a1,a2,a3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(170 * len(names), 200)
    for i, v in enumerate(names):
        ox, oy = 85 + i * 170, 105
        floor(cv, pub, ox, oy, 1, 2)
        cv.static(G, f"module.arcade.{v}", *iso(ox, oy, 0, 0))
        cv.char(human(pub, 6), *iso(ox, oy, 0, 1))                   # on the tile in front, facing the cabinet (-y)
        cv.labels.append((ox - 40, 185, NAMES.get(v, v)))
    for s in (1, 3):
        cv.save(out / f"arcade-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
