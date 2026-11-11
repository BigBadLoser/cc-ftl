"""Recovery pod look study preview (plain python3 + numpy + PIL): each design on a 2x2 floor, a patient floating in
it (idle; no float clip for the plain crew), layered as the renderer would: the pod, the patient, the fluid's front at GLASS_A, the front parts.

  python3 -I tools/blender/review/pod_preview.py <pod dir> <out dir> [designs, default p1,p2,p3]
    -> pod-1x.png / -3x.png / -zoom.png"""
import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

ZPX = 64 / math.sqrt(2) * math.cos(math.radians(30))
GLASS_A = 0.45                                      # the fluid's front over the patient
LIFT = 0.1                                          # the patient floats this high
NAMES = {"p1": "P1  classic", "p2": "P2  egg", "p3": "P3  industrial"}


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "p1,p2,p3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(200 * len(names), 220)
    for i, v in enumerate(names):
        ox, oy = 100 + i * 200, 140
        for gx in (-1, 0, 1):
            for gy in (-1, 0, 1):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        sx, sy = iso(ox, oy, 0, 0)
        cv.static(G, f"module.pod.{v}", sx, sy)
        cv.char(human(pub, 2, "idle", 0), sx - 3, round(sy - LIFT * ZPX))
        img, g, an = G.static(f"module.pod.{v}.glass")
        img = img.copy()
        img[..., 3] = (img[..., 3] * GLASS_A).astype(img.dtype)
        cv.put(img, None, sx - an["x"], sy - an["y"])
        cv.static(G, f"module.pod.{v}.front", sx, sy)
        cv.labels.append((ox - 60, 205, NAMES.get(v, v)))
    for s in (1, 3):
        cv.save(out / f"pod-{s}x.png", s)
    im = Image.open(out / "pod-1x.png")
    z = Image.new("RGB", (len(names) * 400, 400), (12, 14, 20))
    for i in range(len(names)):
        ox = 100 + i * 200
        z.paste(im.crop((ox - 65, 25, ox + 65, 155)).resize((400, 400), Image.NEAREST), (i * 400, 0))
    z.save(out / "pod-zoom.png")
    print("wrote", out)


if __name__ == "__main__":
    main()
