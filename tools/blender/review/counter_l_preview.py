"""Counter L preview (plain python3 + numpy + PIL): the round 21 pieces placed as the game would place modules. Left:
an L (a 3x1 straight, the 1x1 corner at its right end, the 1x2 arm going back from it) with stools along the front
and down the right side. Right: the straight alone with three stools. A crew member for scale.

  python3 -I tools/blender/review/counter_l_preview.py <counter assets> <stool assets> <out dir> [stool id] [piece prefix, default t1]
    -> counter-l-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402


def main():
    C, S, pub, out = Assets(sys.argv[1]), Assets(sys.argv[2]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[3])
    st = f"module.barstool.{sys.argv[4] if len(sys.argv) > 4 else 'u1'}"
    pc = sys.argv[5] if len(sys.argv) > 5 else "t1"
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(560, 230)
    ox, oy = 220, 120                                                                # the corner tile
    for gx in range(-4, 3):
        for gy in range(-3, 3):
            floor(cv, pub, *iso(ox, oy, gx, gy), 1, 1)
    ox2, oy2 = 470, 120
    for gx in range(-3, 1):
        for gy in range(0, 2):
            floor(cv, pub, *iso(ox2, oy2, gx, gy), 1, 1)
    # painter's order: back to front by the front-most tile's depth (gx + gy), as the game sorts
    items = [((0, -1), lambda p: cv.static(C, f"module.barcounter.{pc}a", *p)),
             ((-1, 0), lambda p: cv.static(C, f"module.barcounter.{pc}s", *p)),
             ((0, 0), lambda p: cv.static(C, f"module.barcounter.{pc}c", *p)),
             ((-1, -1), lambda p: cv.char(human(pub, 6), *p))]
    items += [((1, gy), lambda p: cv.static(S, st, *p)) for gy in (-2, -1, 0)]
    items += [((gx, 1), lambda p: cv.static(S, st, *p)) for gx in (-3, -2, -1, 0)]
    for (gx, gy), draw in sorted(items, key=lambda it: (it[0][0] + it[0][1], it[0][0])):
        draw(iso(ox, oy, gx, gy))
    cv.labels.append((ox - 150, oy + 96, f"{pc.upper()} L: straight 3x1 + corner 1x1 + arm 1x2"))
    cv.static(C, f"module.barcounter.{pc}s", ox2, oy2)
    for gx in (-2, -1, 0):
        cv.static(S, st, *iso(ox2, oy2, gx, 1))
    cv.labels.append((ox2 - 100, oy2 + 70, f"{pc.upper()} straight alone"))
    for s in (1, 3):
        cv.save(out / f"counter-l-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
