"""Booth look study preview (plain python3 + numpy + PIL): each 2x2 booth on a floor patch with a crew member beside it
for scale, as the game would place the module (anchored on its front-most tile).

  python3 -I tools/blender/review/booth_preview.py <booth assets dir> <out dir> e1,e2,e3 -> booth-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

NAMES = {"e1": "E1  curved", "e2": "E2  facing benches", "e3": "E3  corner L"}
CW, CH = 240, 200


def main():
    A, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    ids = sys.argv[3].split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(CW * len(ids), CH)
    for i, b in enumerate(ids):
        ox, oy = 120 + i * CW, 110                                                   # the booth's front-most tile
        for gx in range(-2, 3):
            for gy in range(-2, 2):
                floor(cv, pub, *iso(ox, oy, gx, gy), 1, 1)
        cv.static(A, f"module.booth.{b}", ox, oy)
        cv.char(human(pub, 6), *iso(ox, oy, 1, -1))
        cv.labels.append((ox - 70, oy + 60, NAMES.get(b, b)))
    for sc in (1, 3):
        cv.save(out / f"booth-{sc}x.png", sc)
    print("wrote", out)


if __name__ == "__main__":
    main()
