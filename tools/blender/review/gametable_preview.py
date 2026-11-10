"""Holo game table look study preview (plain python3 + numpy + PIL): each design on its 2x1 tiles with the tiles in front
and behind, two crew seated at it (front left facing -y, back right facing +y).

  python3 -I tools/blender/review/gametable_preview.py <gametable dir> <out dir> [designs, default l1,l2,l3]
    -> gametable-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

NAMES = {"k1": "K1  strategy board", "k2": "K2  tabletop battle", "k3": "K3  card game",
         "l1": "L1  cards, K table", "l2": "L2  casino table", "l3": "L3  card dais"}
FRONT, BACK = 6, 2                                  # crew sheet rows facing -y and +y


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "k3,l1,l2,l3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(220 * len(names), 220)
    for i, v in enumerate(names):
        ox, oy = 130 + i * 220, 120
        for gx in (-1, 0):
            for gy in (-1, 0, 1):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        cv.char(human(pub, BACK, "sit_idle"), *iso(ox, oy, 0, -1))
        cv.static(G, f"module.gametable.{v}", *iso(ox, oy, 0, 0))
        if f"module.gametable.{v}.holo" in G.m["assets"]:
            cv.static(G, f"module.gametable.{v}.holo", *iso(ox, oy, 0, 0))
        cv.char(human(pub, FRONT, "sit_idle"), *iso(ox, oy, -1, 1))
        cv.labels.append((ox - 70, 205, NAMES.get(v, v)))
    for s in (1, 3):
        cv.save(out / f"gametable-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
