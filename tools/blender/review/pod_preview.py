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

GLASS_A = 0.42                                      # the fluid over the patient
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
     "u3": ("U3  octagon", 2, (0.0, 0.0, 2, "idle", 24)),
     "v1": ("V1  plinth", 2, (0.0, 0.0, 2, "idle", 24)),
     "v2": ("V2  ribbed", 2, (0.0, 0.0, 2, "idle", 24)),
     "v3": ("V3  octagon", 2, (0.0, 0.0, 2, "idle", 24)),
     "w1": ("W1  plinth", 2, (0.0, 0.0, 2, "idle", 25)),
     "w2": ("W2  ribbed", 2, (0.0, 0.0, 2, "idle", 25)),
     "w3": ("W3  octagon", 2, (0.0, 0.0, 2, "idle", 25)),
     "x1": ("X1  plinth", 2, (0.0, 0.0, 2, "idle", 34)),
     "x2": ("X2  spine", 2, (0.0, 0.0, 2, "idle", 34)),
     "x3": ("X3  octagon", 2, (0.0, 0.0, 2, "idle", 34)),
     "y1": ("Y1  plinth", 2, (0.0, 0.0, 2, "idle", 36)),
     "y2": ("Y2  spine", 2, (0.0, 0.0, 2, "idle", 36)),
     "y3": ("Y3  octagon", 2, (0.0, 0.0, 2, "idle", 36)),
     "z1": ("Z1  plinth", 2, (0.0, 0.0, 2, "idle", 36)),
     "z2": ("Z2  spine", 2, (0.0, 0.0, 2, "idle", 36)),
     "z3": ("Z3  octagon", 2, (0.0, 0.0, 2, "idle", 36)),
     "k2": ("K2  spine", 2, (0.0, 0.0, 2, "idle", 36)),
     "k3": ("K3  octagon", 2, (0.0, 0.0, 2, "idle", 36)),
     "n1": ("N1  cage", 2, (0.0, 0.0, 2, "idle", 36)),
     "n2": ("N2  alcove", 2, (0.0, 0.0, 2, "idle", 36)),
     "n3": ("N3  monolith", 2, (0.0, 0.0, 2, "idle", 36))}


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "z1,z2,z3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(240 * len(names), 320)
    for i, v in enumerate(names):
        label, n, (u, vv, dr, clip, lift) = D[v]
        ox, oy = 120 + i * 240, 230
        for gx in range(-1, n + 1):
            for gy in range(-1, n + 1):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        sx, sy = iso(ox, oy, 0, 0)
        cv.static(G, f"module.pod.{v}", sx, sy)
        h = (n - 1) / 2
        px, py = iso(ox, oy, u - h, vv - h)
        cv.char(human(pub, dr, clip, 0), round(px) - (3 if dr == 2 and n == 1 else 0), round(py) - lift)
        img, g, an = G.static(f"module.pod.{v}.glass")
        img = img.copy()
        img[..., 3] = (img[..., 3] * GLASS_A).astype(img.dtype)
        cv.put(img, None, sx - an["x"], sy - an["y"])
        cv.static(G, f"module.pod.{v}.front", sx, sy)
        cv.labels.append((ox - 60, 305, label))
    for s in (1, 3):
        cv.save(out / f"pod-{s}x.png", s)
    im = Image.open(out / "pod-1x.png")
    z = Image.new("RGB", (len(names) * 400, 440), (12, 14, 20))
    for i in range(len(names)):
        ox = 120 + i * 240
        z.paste(im.crop((ox - 110, 40, ox + 110, 282)).resize((400, 440), Image.NEAREST), (i * 400, 0))
    z.save(out / "pod-zoom.png")
    print("wrote", out)


if __name__ == "__main__":
    main()
