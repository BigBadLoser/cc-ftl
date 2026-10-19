"""Combat fx v2 preview (plain python3 + numpy + PIL): the new fx (family `fx`) over a roof patch with a burst laser
turret, frame strips beside today's fx, and a clip of a shot (muzzle flash, bolt, impact) and an explosion.

  python3 -I tools/blender/review/fx_preview.py <fx assets dir> <out dir>
    -> fx-1x.png, fx-3x.png, fx-clip.mp4

Fx are drawn like any sprite: colour over, glow added."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import Assets, Canvas, iso, mp4  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
TURRET = "turret.burst_laser.d2.charged"
ROOF_PX = 80                                            # roof plating height above the floor anchor (2.05 tiles)


def frames(A, name):
    out, k = [], 0
    while f"fx.{name}.{k}" in A.m["assets"]:
        out.append(f"fx.{name}.{k}")
        k += 1
    return out


def roof(cv, pub, ox, oy, nx, ny):
    for y in range(ny):
        for x in range(nx):
            cv.static(pub, f"roof.c0b.{y % 4}{x % 4}", *iso(ox, oy, x, y))


def tip(pub, aid):
    """Barrel tip of a turret sprite, relative to its anchor: the rightmost opaque column, mean row there."""
    img, _, an = pub.static(aid)
    cols = np.where(img[..., 3].max(0) > 0)[0]
    x = cols.max()
    ys = np.where(img[:, x, 3] > 0)[0]
    return x - an["x"], int(ys.mean()) - an["y"]


def scene(cv, A, pub, ox, oy, t=None):
    """Roof patch, turret; t: clip frame (None = a still with every fx at a readable frame)."""
    roof(cv, pub, ox, oy, 7, 4)
    tx, ty = iso(ox, oy, 1, 1)
    cv.static(pub, TURRET, tx, ty)
    mx, my = tip(pub, TURRET)
    mx, my = tx + mx - 4, ty + my
    hx, hy = iso(ox, oy, 5, 2)                          # the impact point (on the roof plate)
    ex, ey = iso(ox, oy, 4, 0)                          # the explosion
    hy, ey = hy - ROOF_PX, ey - ROOF_PX
    if t is None:
        cv.static(A, "fx.muzzle.laser.1", mx, my)
        cv.static(A, "fx.laser_bolt.0", mx + 70, my + 2)
        cv.static(A, "fx.impact.laser.1", hx, hy)
        cv.static(A, "fx.explosion.4", ex, ey)
        return
    if t < 3:
        cv.static(A, f"fx.muzzle.laser.{t}", mx, my)
    if 1 <= t <= 6:                                      # the bolt flies from the barrel to the impact point
        k = (t - 1) / 5
        bx, by = mx + 30 + (hx - mx - 30) * k, my + (hy - my) * k
        rot = np.degrees(np.arctan2(hy - my, hx - mx))
        img, g, an = A.static(f"fx.laser_bolt.{t % 2}")
        im = Image.fromarray(img).rotate(-rot, resample=Image.NEAREST, expand=True)
        gi = Image.fromarray(g).rotate(-rot, resample=Image.NEAREST, expand=True) if g is not None else None
        cv.put(np.array(im), np.array(gi) if gi else None, int(bx - im.width / 2), int(by - im.height / 2))
    if 7 <= t < 13:
        cv.static(A, f"fx.impact.laser.{t - 7}", hx, hy)
    if 4 <= t < 16:
        cv.static(A, f"fx.explosion.{t - 4}", ex, ey)


def strip(cv, A, ids, x, y, label):
    cv.labels.append((x, y, label))
    x0 = x
    for aid in ids:
        img, g, an = A.static(aid)
        cv.put(img, g, x, y + 14 + 50 - an["y"])
        x += max(img.shape[1], 24) + 6
    return x - x0


def main():
    A, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(1000, 620)
    scene(cv, A, pub, 300, 170)
    cv.labels.append((8, 6, "new fx over a roof patch: muzzle flash, bolt, impact, explosion (frame 4)"))
    y = 360
    x = 8
    x += strip(cv, A, frames(A, "laser_bolt"), x, y, "bolt") + 20
    x += strip(cv, A, frames(A, "muzzle.laser"), x, y, "muzzle") + 20
    strip(cv, A, frames(A, "impact.laser"), x, y, "impact")
    strip(cv, A, frames(A, "explosion"), 8, y + 90, "explosion, 12 frames")
    strip(cv, pub, frames(pub, "explosion_small") + ["fx.laser_bolt.0", "fx.muzzle.laser.1"], 8, y + 180, "today: explosion_small 0-4, laser bolt, muzzle")
    for s in (1, 3):
        cv.save(out / f"fx-{s}x.png", s)
    clip = []
    for t in range(18):
        c = Canvas(560, 300)
        scene(c, A, pub, 200, 150, t)
        im = Image.fromarray(c.px[..., :3])
        clip.append(im.resize((im.width * 3, im.height * 3), Image.NEAREST))
    mp4(clip, out / "fx-clip.mp4", fps=12, loops=4)
    print("wrote", out)


if __name__ == "__main__":
    main()
