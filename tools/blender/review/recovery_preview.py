"""Recovery pod look study preview (plain python3 + numpy + PIL): each design on its 2x2 floor, empty and with a patient
floating in the tank (the crew sprite drawn between the pod and its `.front` layer), a crew member beside it for scale.

  python3 -I tools/blender/review/recovery_preview.py <recovery assets dir> <out dir> [designs, default u1,u2]
    -> recovery-1x.png / -3x.png"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

NAMES = {"u2": "U2  spine lantern, fluid",
         "u1": "U1  spine lantern",
         "t1c": "T1  lantern (round 7)", "t2c": "T2  gem (round 7)",
         "t1b": "T1+  lantern, detailed", "t2b": "T2+  gem, detailed",
         "t1": "T1  lantern", "t2": "T2  gem", "t3": "T3  alcove slab",
         "s1": "S1  halo frame", "s2": "S2  tulip", "s3": "S3  clamshell",
         "r1": "R1  ribcage", "r2": "R2  medigel aquarium", "r3": "R3  field lift",
         "q1": "Q1  gantry capsule", "q2": "Q2  bio-vat", "q3": "Q3  scan prism",
         "p1": "P1  clinic tube", "p2": "P2  reservoir rig", "p3": "P3  alcove"}
FLOAT = 13                                          # recovery_study.FLOAT in px (0.32 x 39.2)
FLOATS = {"u": 8}                                   # recovery_study8.FLOAT (0.2) for round 8 on
CW, CH = 260, 250


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "u1,u2").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(CW * len(names), CH * 2)
    for i, v in enumerate(names):
        for row in range(2):
            ox, oy = 135 + i * CW, 165 + row * CH                    # the pod's anchor: its front tile
            for gx in range(-1, 2):
                for gy in range(-1, 2):
                    floor(cv, pub, *iso(ox, oy, gx, gy), 1, 1)
            cv.static(G, f"module.recovery.{v}", ox, oy)
            if row:
                cv.char(human(pub, 1), ox, oy - 16 - FLOATS.get(v[0], FLOAT))          # on the tank's axis, the footprint's middle
            cv.static(G, f"module.recovery.{v}.front", ox, oy)
            cv.char(human(pub, 6), *iso(ox, oy, -1, 2))
            cv.labels.append((ox - 60, oy + 62, NAMES.get(v, v) + ("  occupied" if row else "  empty")))
    for s in (1, 3):
        cv.save(out / f"recovery-{s}x.png", s)
    for v in names:                                                  # an animated sweep where it has frames
        n = sum(1 for k in G.m["assets"] if re.fullmatch(rf"module\.recovery\.{v}\.f\d+\.front", k))
        if n:
            sweep(G, pub, v, n, out)
    print("wrote", out)


def sweep(G, pub, v, n, out):
    from PIL import Image
    frames = []
    for f in range(n):
        c = Canvas(CW, CH)
        ox, oy = 115, 165
        for gx in range(-1, 2):
            for gy in range(-1, 2):
                floor(c, pub, *iso(ox, oy, gx, gy), 1, 1)
        c.static(G, f"module.recovery.{v}.f{f}", ox, oy)
        c.char(human(pub, 1), ox, oy - 16 - FLOATS.get(v[0], FLOAT))
        c.static(G, f"module.recovery.{v}.f{f}.front", ox, oy)
        frames.append(Image.fromarray(c.px[..., :3]).resize((CW * 3, CH * 3), Image.NEAREST))
    frames[0].save(out / f"recovery-{v}-sweep-3x.gif", save_all=True, append_images=frames[1:], duration=250, loop=0)


if __name__ == "__main__":
    main()
