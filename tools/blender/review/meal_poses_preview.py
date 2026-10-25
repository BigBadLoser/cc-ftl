"""Hauling and meal pose preview (plain python3 + numpy + PIL): the human crew in the carry, carry_idle, eat and sit_eat
clips (human_meal.py) next to idle, in 4 directions, the held item at the computed hand spots, the seated clip on the
mess chair (with its backrest overlay where it has one). Needs a crew build with those clips (CREW_FRAMES).

  python3 -I tools/blender/review/meal_poses_preview.py <crew assets dir> <galley assets dir> <out dir> [hands json]
    -> meal-poses-1x.png / -3x.png"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import Assets, Canvas, human  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
# human_meal.hands(): px right, px down from the feet, per direction
CARRY_HAND = [(10, -30), (0, -28), (-10, -31), (-14, -36), (-10, -40), (0, -42), (10, -40), (14, -35)]
EAT_HAND = [(16, -32), (10, -27), (-2, -25), (-13, -29), (-16, -35), (-10, -40), (2, -42), (13, -38)]
CHAIR_ROT = {6: 0, 0: 1, 2: 2, 4: 3}                 # mess.SEAT_DIR inverted: chair rotation that seats a direction
COLS = [("idle", 0, None), ("carry", 0, "carry"), ("carry", 2, "carry"), ("carry", 4, "carry"), ("carry", 6, "carry"),
        ("carry_idle", 0, "carry"), ("eat", 0, "eat"), ("eat", 1, "eat"), ("eat", 2, "eat"), ("eat", 3, "eat"),
        ("sit_eat", 0, None), ("sit_eat", 1, None), ("sit_eat", 2, None)]


def main():
    C, G, out = Assets(sys.argv[1]), Assets(sys.argv[2]), Path(sys.argv[3])
    pub = Assets(ROOT / "public/assets/1x")
    out.mkdir(parents=True, exist_ok=True)
    dirs = (0, 2, 4, 6)
    cv = Canvas(70 * len(COLS) + 20, 90 * len(dirs) + 30)
    for r, d in enumerate(dirs):
        for c, (clip, i, hold) in enumerate(COLS):
            x, y = 45 + c * 70, 85 + r * 90
            cv.static(pub, "tile.floor.a", x, y)
            if clip == "sit_eat":
                cv.static(G, f"module.chair.r{CHAIR_ROT[d]}", x, y)
            behind = 4 <= d <= 6
            spot = (CARRY_HAND if hold == "carry" else EAT_HAND)[d] if hold else None
            item = "item.ration.held"
            if spot and behind:
                img, g, an = G.static(item)
                cv.put(img, g, x + spot[0] - an["x"], y + spot[1] - an["y"])
            cv.char(human(C, d, clip, i), x, y)
            if spot and not behind:
                img, g, an = G.static(item)
                cv.put(img, g, x + spot[0] - an["x"], y + spot[1] - an["y"])
            front = f"module.chair.front.r{CHAIR_ROT[d]}"
            if clip == "sit_eat" and front in G.m["assets"]:
                cv.static(G, front, x, y)
            if r == 0:
                cv.labels.append((x - 30, 4, f"{clip} {i}"))
    for s in (1, 3):
        cv.save(out / f"meal-poses-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
