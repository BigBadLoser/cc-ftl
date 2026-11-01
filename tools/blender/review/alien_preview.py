"""Alien look preview (plain python3 + numpy + PIL): each creature on its own row (idle in SE, SW and NW, attack frames,
run, hurt, dead), next to a human crew member and a worker robot, in a walled room. Composited like the runtime (one
outline round the creature with the cool rim, additive glow).

  python3 -I tools/blender/review/alien_preview.py <alien assets dir> <out dir>           -> alien-1x.png / -3x.png
  python3 -I tools/blender/review/alien_preview.py <alien assets dir> <out dir> anim      -> alien-<kind>-anim.mp4 (needs
      the ALIEN_ANIM build: every clip facing SE, played in turn beside a crew member)"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import DIRS, Assets, Canvas, character, human, iso, mp4, robot  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
KINDS = ("hunter", "brute", "spitter")


def creature(A, kind, d, clip, i=0):
    return character(None, [A.frame(f"crew.alien.body.{kind}", d, clip, i)], {})


def room(cv, pub, ox, oy, nx, ny):
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))


def sheet(A, pub, out):
    """Rows by screen position (one per creature), on a floor patch in front of a wall."""
    kinds = [k for k in KINDS if f"crew.alien.body.{k}" in A.m["assets"]]
    row = [(0, "idle", 0, "SE idle"), (2, "idle", 0, "SW idle"), (4, "idle", 0, "NW idle"),
           (0, "attack", 1, "attack 1"), (0, "attack", 2, "attack 2"), (0, "attack", 3, "attack 3"),
           (0, "run", 1, "run"), (0, "hurt", 0, "hurt"), (0, "dead", 0, "dead")]
    W, H = 120 * (len(row) + 2) + 40, 150 * len(kinds) + 130
    cv = Canvas(W, H)
    ox, oy = W // 2, -H // 2
    room(cv, pub, ox, oy, 40, 40)
    for r, kind in enumerate(kinds):
        for k, (d, clip, i, lab) in enumerate(row):
            sx, sy = 70 + k * 120, 140 + r * 150
            cv.char(creature(A, kind, d, clip, i), sx, sy)
            cv.labels.append((sx - 34, sy + 12, f"{kind} {lab}" if k == 0 else lab))
    for k, (pair, lab) in enumerate(((human(pub, DIRS["SE"]), "crew"), (robot(pub, "worker", DIRS["SE"], "idle"), "robot"))):
        sx, sy = 70 + len(row) * 120 + k * 60, 140 + 150
        cv.char(pair, sx, sy)
        cv.labels.append((sx - 14, sy + 12, lab))
    for s in (1, 3):
        cv.save(out / f"alien-{s}x.png", s)


def anim(A, pub, out):
    clips = [("idle", 4, 4), ("run", 6, 12), ("attack", 5, 10), ("hurt", 2, 8), ("dead", 1, 1)]
    for kind in KINDS:
        aid = f"crew.alien.body.{kind}"
        if aid not in A.m["assets"]:
            continue
        frames = []
        for clip, n, fps in clips:
            reps = max(1, round(10 / fps * (12 if clip == "dead" else 2)))       # ~equal screen time per clip at 10 fps
            for loop in range(2 if clip != "dead" else 1):
                for i in range(n):
                    cv = Canvas(300, 170)
                    room(cv, pub, 150, 40, 4, 3)
                    sx, sy = iso(150, 40, 1.5, 1.6)
                    cv.char(creature(A, kind, 0, clip, i), int(sx), int(sy))
                    hx, hy = iso(150, 40, 3, 0.6)
                    cv.char(human(pub, DIRS["SW"]), int(hx), int(hy))
                    cv.labels.append((8, 6, f"{kind}: {clip}"))
                    im = Image.fromarray(cv.px[..., :3]).resize((900, 510), Image.NEAREST)
                    frames += [im] * max(1, round(10 / fps))
            del reps
        mp4(frames, out / f"alien-{kind}-anim.mp4", fps=10, loops=1)


def main():
    A, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets/1x")
    out.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) > 3 and sys.argv[3] == "anim":
        anim(A, pub, out)
    else:
        sheet(A, pub, out)
    print("wrote", out)


if __name__ == "__main__":
    main()
