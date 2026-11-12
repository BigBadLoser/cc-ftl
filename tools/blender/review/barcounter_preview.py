"""Bar counter look study preview (plain python3 + numpy + PIL): each design at r0 on its 3x2 floor, a crew member
standing at its right-hand end for scale.

  python3 -I tools/blender/review/barcounter_preview.py <barcounter assets dir> <out dir> [designs, default c1,c2,c3]
    -> barcounter-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

NAMES = {"c1": "C1  diner", "c2": "C2  lounge", "c3": "C3  neon",
         "d1": "D1  tap gantry", "d2": "D2  crate dive", "d3": "D3  cooler bar",
         "e1": "E1  synth bar", "e2": "E2  mag-rail bar", "e3": "E3  backlit wall bar"}
CW, CH = 280, 220


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "c1,c2,c3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(CW * len(names), CH)
    for i, v in enumerate(names):
        ox, oy = 170 + i * CW, 140                                   # the module's anchor: its front-most tile
        for gx in range(-3, 2):
            for gy in range(-2, 2):
                floor(cv, pub, *iso(ox, oy, gx, gy), 1, 1)
        cv.static(G, f"module.barcounter.{v}", ox, oy)
        cv.char(human(pub, 6), *iso(ox, oy, 1, -1))
        cv.labels.append((ox - 70, oy + 60, NAMES.get(v, v)))
    for s in (1, 3):
        cv.save(out / f"barcounter-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
