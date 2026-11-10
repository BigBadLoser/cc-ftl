"""Exercise machine look study preview (plain python3 + numpy + PIL): each design on a 2x2 floor with a crew member
on it in the nearest existing pose (walk, sit_work, idle), lifted by the deck height.

  python3 -I tools/blender/review/exercise_preview.py <exercise dir> <out dir> [designs, default e1,e2,e3,e4]
    -> exercise-1x.png / -3x.png"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

ZPX = 64 / math.sqrt(2) * math.cos(math.radians(30))
# name -> label, footprint, crew (u, v, dir, clip, frame, lift)
D = {"e1": ("E1  treadmill", (2, 1), (-0.15, 0.0, 0, "walk", 1, 0.12)),
     "e2": ("E2  spin bike", (1, 1), (-0.15, 0.0, 0, "sit_work", 0, 0.0)),
     "e3": ("E3  cable tower", (1, 1), (0.0, 0.18, 2, "idle", 0, 0.03)),
     "e4": ("E4  run wheel", (2, 1), (0.0, 0.0, 0, "walk", 1, 0.08))}


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "e1,e2,e3,e4").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(220 * len(names), 220)
    for i, v in enumerate(names):
        label, (w, d), (u, vv, dr, clip, fr, lift) = D[v]
        ox, oy = 125 + i * 220, 120
        for gx in (-1, 0):
            for gy in (0, 1):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        cv.static(G, f"module.exercise.{v}", *iso(ox, oy, 0, 0))
        sx, sy = iso(ox, oy, u - (w - 1) / 2, vv - (d - 1) / 2)
        cv.char(human(pub, dr, clip, fr), round(sx), round(sy - lift * ZPX))
        if v != "e3":
            cv.static(G, f"module.exercise.{v}.front", *iso(ox, oy, 0, 0))
        cv.labels.append((ox - 80, 205, label))
    for s in (1, 3):
        cv.save(out / f"exercise-{s}x.png", s)
    from PIL import Image
    im = Image.open(out / "exercise-1x.png")
    z = Image.new("RGB", (len(names) * 400, 400), (12, 14, 20))
    for i in range(len(names)):
        ox = 125 + i * 220
        z.paste(im.crop((ox - 80, 15, ox + 80, 175)).resize((400, 400), Image.NEAREST), (i * 400, 0))
    z.save(out / "exercise-zoom.png")
    print("wrote", out)


if __name__ == "__main__":
    main()
