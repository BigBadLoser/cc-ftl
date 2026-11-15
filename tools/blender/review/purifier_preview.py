"""Water purifier look study preview (plain python3 + numpy + PIL): each design at r0 on a floor, a crew member on the
access tile in front of the left tile, facing the machine.

  python3 -I tools/blender/review/purifier_preview.py <out dir of the purifier family> <out dir> [w1,w2,w3]
    -> purifier-3x.png
Grid coords are the sprite's: its tiles are (-1, 0) and (0, 0), front +y."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bench_module_preview import as_game  # noqa: E402
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

NAMES = {"b1": "B1  coil still", "b2": "B2  filter press", "b3": "B3  sphere",
         "a1": "A1  column and basin", "a2": "A2  twin drums", "a3": "A3  chute and still",
         "z1": "Z1  porthole", "z2": "Z2  drawer", "z3": "Z3  wedge",
         "y1": "Y1  twin bay", "y2": "Y2  low and tall", "y3": "Y3  cartridge bank",
         "x1": "X1  capsule", "x2": "X2  stepped", "x3": "X3  barrel", "w1": "W1  tower", "w2": "W2  skid", "w3": "W3  cabinet"}
ACCESS, FACE_BACK, CW, CH = (-1.0, 1.0), 6, 260, 200


def main():
    G, pub, out = Assets(sys.argv[1]), as_game(Assets(ROOT / "public/assets/1x")), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "w1,w2,w3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(CW * len(names), CH)
    for i, v in enumerate(names):
        ox, oy = 150 + i * CW, 110
        for gx in range(-3, 2):
            for gy in range(-2, 3):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        cv.static(G, f"module.water_purifier.{v}", *iso(ox, oy, 0, 0))
        cv.char(human(pub, FACE_BACK), *map(round, iso(ox, oy, *ACCESS)))
        cv.labels.append((ox - 60, oy + 80, NAMES.get(v, v)))
    cv.save(out / "purifier-3x.png", 3)
    print("wrote", out)


if __name__ == "__main__":
    main()
