"""Recovery pod look study preview (plain python3 + numpy + PIL): each design on its 2x2 floor, empty and with a patient
floating in the tank (the crew sprite drawn between the pod and its `.front` layer), a crew member beside it for scale.

  python3 -I tools/blender/review/recovery_preview.py <recovery assets dir> <out dir> [designs, default t1,t2,t3]
    -> recovery-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

NAMES = {"t1": "T1  lantern", "t2": "T2  gem", "t3": "T3  alcove slab",
         "s1": "S1  halo frame", "s2": "S2  tulip", "s3": "S3  clamshell",
         "r1": "R1  ribcage", "r2": "R2  medigel aquarium", "r3": "R3  field lift",
         "q1": "Q1  gantry capsule", "q2": "Q2  bio-vat", "q3": "Q3  scan prism",
         "p1": "P1  clinic tube", "p2": "P2  reservoir rig", "p3": "P3  alcove"}
FLOAT = 13                                          # recovery_study.FLOAT in px (0.32 x 39.2)
CW, CH = 230, 250


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "t1,t2,t3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(CW * len(names), CH * 2)
    for i, v in enumerate(names):
        for row in range(2):
            ox, oy = 115 + i * CW, 165 + row * CH                    # the pod's anchor: its front tile
            for gx in range(-1, 2):
                for gy in range(-1, 2):
                    floor(cv, pub, *iso(ox, oy, gx, gy), 1, 1)
            cv.static(G, f"module.recovery.{v}", ox, oy)
            if row:
                cv.char(human(pub, 1), ox, oy - 16 - FLOAT)          # on the tank's axis, the footprint's middle
            cv.static(G, f"module.recovery.{v}.front", ox, oy)
            cv.char(human(pub, 6), *iso(ox, oy, -1, 1))
            cv.labels.append((ox - 60, oy + 62, NAMES.get(v, v) + ("  occupied" if row else "  empty")))
    for s in (1, 3):
        cv.save(out / f"recovery-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
