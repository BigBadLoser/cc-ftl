"""Bar look study preview (plain python3 + numpy + PIL): each design on its 3x1 tiles and the row in front, two crew
seated at it (the outer stools), facing the counter (-y).

  python3 -I tools/blender/review/bar_preview.py <bar dir> <out dir> [designs, default b1,b2,b3]
    -> bar-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

NAMES = {"b1": "B1  neon dive", "b2": "B2  warm lounge", "b3": "B3  white tech",
         "b4": "B4  island bar", "b5": "B5  the robot is the bar", "b6": "B6  tube bar",
         "b7": "B7  retro diner", "b8": "B8  the still", "b9": "B9  automat",
         "b10": "B10  halo globes", "b11": "B11  layer reactor", "b12": "B12  aquarium"}


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "b10,b11,b12").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(260 * len(names), 230)
    for i, v in enumerate(names):
        ox, oy = 160 + i * 260, 130
        for gx in (-2, -1, 0):
            for gy in (0, 1):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        cv.static(G, f"module.bar.{v}", *iso(ox, oy, 0, 0))
        for gx in (-2, 0):
            cv.char(human(pub, 6, "sit_idle"), *iso(ox, oy, gx, 1))
        cv.labels.append((ox - 90, 215, NAMES.get(v, v)))
    for s in (1, 3):
        cv.save(out / f"bar-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
