"""Recovery pod look study preview (plain python3 + numpy + PIL): each design on a floor, a patient in it, layered as
the renderer would: the pod, the patient, the fluid (`.glass`) at GLASS_A, the front parts (`.front`). Round 1 (1x1)
stands the patient (idle; the plain crew has no float clip), round 2 (2x2) lays them down (sleep, head to -u).

  python3 -I tools/blender/review/pod_preview.py <pod dir> <out dir> [designs, default q1,q2,q3]
    -> pod-1x.png / -3x.png / -zoom.png"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

GLASS_A = 0.45                                      # the fluid over the patient
# name -> label, footprint, patient (u, v, facing, clip, lift px)
D = {"p1": ("P1  classic", 1, (0.0, 0.0, 2, "idle", 4)),
     "p2": ("P2  egg", 1, (0.0, 0.0, 2, "idle", 4)),
     "p3": ("P3  industrial", 1, (0.0, 0.0, 2, "idle", 4)),
     "q1": ("Q1  egg", 2, (0.0, 0.12, 0, "sleep", 16)),
     "q2": ("Q2  bath", 2, (0.0, 0.12, 0, "sleep", 6)),
     "q3": ("Q3  scan tube", 2, (0.0, 0.12, 0, "sleep", 12)),
     "r1": ("R1  egg", 2, (0.0, 0.0, 2, "idle", 24)),
     "r2": ("R2  dais", 2, (0.0, 0.0, 2, "idle", 24)),
     "r3": ("R3  hex", 2, (0.0, 0.0, 2, "idle", 20)),
     "s1": ("S1  shell egg", 2, (0.0, 0.0, 2, "idle", 24)),
     "s2": ("S2  med column", 2, (0.0, 0.0, 2, "idle", 24)),
     "s3": ("S3  capsule", 2, (0.0, 0.0, 2, "idle", 20)),
     "s2b": ("S2  med column, refined", 2, (0.0, 0.0, 2, "idle", 24)),
     "t1": ("T1  lotus", 2, (0.0, 0.0, 2, "idle", 20)),
     "t2": ("T2  hanging tank", 2, (0.0, 0.0, 2, "idle", 31)),
     "u1": ("U1  plinth", 2, (0.0, 0.0, 2, "idle", 24)),
     "u2": ("U2  ribbed", 2, (0.0, 0.0, 2, "idle", 24)),
     "u3": ("U3  octagon", 2, (0.0, 0.0, 2, "idle", 24))}


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "u1,u2,u3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(240 * len(names), 280)
    for i, v in enumerate(names):
        label, n, (u, vv, dr, clip, lift) = D[v]
        ox, oy = 120 + i * 240, 190
        for gx in range(-1, n + 1):
            for gy in range(-1, n + 1):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        sx, sy = iso(ox, oy, 0, 0)
        cv.static(G, f"module.pod.{v}", sx, sy)
        h = (n - 1) / 2
        px, py = iso(ox, oy, u - h, vv - h)
        cv.char(human(pub, dr, clip, 0), round(px) - (3 if dr == 2 else 0), round(py) - lift)
        img, g, an = G.static(f"module.pod.{v}.glass")
        img = img.copy()
        img[..., 3] = (img[..., 3] * GLASS_A).astype(img.dtype)
        cv.put(img, None, sx - an["x"], sy - an["y"])
        cv.static(G, f"module.pod.{v}.front", sx, sy)
        cv.labels.append((ox - 60, 265, label))
    for s in (1, 3):
        cv.save(out / f"pod-{s}x.png", s)
    im = Image.open(out / "pod-1x.png")
    z = Image.new("RGB", (len(names) * 400, 400), (12, 14, 20))
    for i in range(len(names)):
        ox = 120 + i * 240
        z.paste(im.crop((ox - 95, 25, ox + 95, 215)).resize((400, 400), Image.NEAREST), (i * 400, 0))
    z.save(out / "pod-zoom.png")
    print("wrote", out)


if __name__ == "__main__":
    main()
