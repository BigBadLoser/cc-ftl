"""Arcade cabinet look study preview (plain python3 + numpy + PIL): each design on a floor tile, a crew member at its front
for scale (two tiles: the cabinet's and the one in front of it, +v).

  python3 -I tools/blender/review/arcade_preview.py <arcade assets dir> <out dir> [designs, default g2,h1,h2,h3]
    -> arcade-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

NAMES = {"a1": "A1  classic upright", "a2": "A2  hooded", "a3": "A3  fibreglass",
         "b1": "B1  holo cabinet", "b2": "B2  cocktail table", "b3": "B3  space-age orb",
         "c1": "C1  holo orrery", "c2": "C2  open-frame upright", "c3": "C3  holo pinball",
         "d1": "D1  white drum, cyan", "d2": "D2  brass arena", "d3": "D3  teal hourglass",
         "e1": "E1  paddle court (pong layout)", "e2": "E2  girder climber", "e3": "E3  tower shooter",
         "f1": "F1  brick breaker", "f2": "F2  3D snake", "f3": "F3  race loop",
         "g1": "G1  curved wall", "g2": "G2  tilted wall", "g3": "G3  deep wall",
         "h1": "H1  frustum", "h2": "H2  cone", "h3": "H3  light sheet"}


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "g2,h1,h2,h3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(170 * len(names), 200)
    for i, v in enumerate(names):
        ox, oy = 85 + i * 170, 105
        floor(cv, pub, ox, oy, 1, 2)
        cv.static(G, f"module.arcade.{v}", *iso(ox, oy, 0, 0))
        if f"module.arcade.{v}.holo" in G.m["assets"]:
            cv.static(G, f"module.arcade.{v}.holo", *iso(ox, oy, 0, 0))
        cv.char(human(pub, 6), *iso(ox, oy, 0, 1))                   # on the tile in front, facing the cabinet (-y)
        cv.labels.append((ox - 40, 185, NAMES.get(v, v)))
    for s in (1, 3):
        cv.save(out / f"arcade-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
