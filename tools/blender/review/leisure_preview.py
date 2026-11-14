"""Leisure furniture preview (plain python3 + numpy + PIL): each module of the leisure families (sprites/leisure.py) at
its four rotations on floor tiles, one row per module, a crew member beside the r0 one for scale.

  python3 -I tools/blender/review/leisure_preview.py <assets dir> <out dir>
    -> leisure-rotations-3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

MODULES = ("module.bunk", "module.exercise", "module.bench", "module.planter", "module.vending", "module.vending_red")
CW, CH = 200, 170


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    rows = [m for m in MODULES if f"{m}.idle" in G.m["assets"]]
    cv = Canvas(CW * 4, CH * len(rows))
    for row, m in enumerate(rows):
        for r in range(4):
            aid = f"{m}.idle" if r == 0 else f"{m}.r{r}.idle"
            if aid not in G.m["assets"]:
                continue
            ox, oy = CW // 2 + r * CW, 105 + row * CH
            for gx in range(-1, 2):
                for gy in range(-1, 2):
                    cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
            cv.static(G, aid, *iso(ox, oy, 0, 0))
            if r == 0:
                cv.char(human(pub, 6), *iso(ox, oy, -1, 1))
            cv.labels.append((ox - 45, oy + 50, f"{m.split('.', 1)[1]} r{r}"))
    cv.save(out / "leisure-rotations-3x.png", 3)
    print("wrote", out, len(rows), "modules")


if __name__ == "__main__":
    main()
