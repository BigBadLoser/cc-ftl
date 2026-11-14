"""Counter and stool look study preview (plain python3 + numpy + PIL): each counter (3x1) with three of its paired
stools (1x1) placed in the row in front, as the game would place two modules; a crew member at the right for scale.

  python3 -I tools/blender/review/counter_preview.py <counter assets dir> <stool assets dir> <out dir> t1:u1,t2:u2,...
    -> counter-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

NAMES = {"t1": "T1  padded counter", "t2": "T2  plated counter", "t3": "T3  display counter",
         "u1": "U1 pedestal", "u2": "U2 square", "u3": "U3 drum",
         "v1": "V1  hull counter", "v2": "V2  cantilever counter", "v3": "V3  rack counter",
         "w1": "W1 saddle", "w2": "W2 tripod", "w3": "W3 backed",
         "x1": "X1  faceted counter", "x2": "X2  case counter", "x3": "X3  prow counter",
         "y1": "Y1 brass", "y2": "Y2 olive", "y3": "Y3 gunmetal"}
CW, CH = 280, 200


def main():
    C, S, pub, out = Assets(sys.argv[1]), Assets(sys.argv[2]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[3])
    pairs = [p.split(":") for p in sys.argv[4].split(",")]
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(CW * len(pairs), CH)
    for i, (c, s) in enumerate(pairs):
        ox, oy = 170 + i * CW, 110                                                   # the counter's front-most tile
        for gx in range(-3, 2):
            for gy in range(-1, 3):
                floor(cv, pub, *iso(ox, oy, gx, gy), 1, 1)
        cv.static(C, f"module.barcounter.{c}", ox, oy)
        for gx in (-2, -1, 0):
            cv.static(S, f"module.barstool.{s}", *iso(ox, oy, gx, 1))
        cv.char(human(pub, 6), *iso(ox, oy, 1, 0))
        cv.labels.append((ox - 110, oy + 70, f"{NAMES.get(c, c)}  +  {NAMES.get(s, s)}"))
    for sc in (1, 3):
        cv.save(out / f"counter-{sc}x.png", sc)
    print("wrote", out)


if __name__ == "__main__":
    main()
