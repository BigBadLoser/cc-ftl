"""Combat fx v2 preview (plain python3 + numpy + PIL): every weapon's fx (family `fx`) over a roof patch with its
turret, frame strips with today's fx for comparison, and a clip of each weapon firing in turn.

  python3 -I tools/blender/review/fx_preview.py <fx assets dir> <out dir>
    -> fx-scenes-1x/3x.png (one panel per weapon), fx-strips-1x/3x.png (every frame), fx-clip.mp4, fx-shots.mp4

Fx are drawn like any sprite: colour over, glow added."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import Assets, Canvas, iso, mp4  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ROOF_PX = 80                                            # roof plating height above the floor anchor (2.05 tiles)
# label, turret sprite, shot, muzzle, impact (the point-defence intercept bursts in the air)
WEAPONS = [("burst laser", "turret.burst_laser", "laser_bolt", "muzzle.laser", "impact.laser"),
           ("mass driver", "turret.mass_driver", "mass_slug", "muzzle.mass", "impact.mass"),
           ("missile", "turret.missile_launcher", "missile", "muzzle.missile", "explosion_large"),
           ("ion cannon", "turret.ion_cannon", "ion_bolt", "muzzle.ion", "impact.ion"),
           ("incendiary", "turret.incendiary_launcher", "fire_shell", "muzzle.fire", "impact.fire"),
           ("point defence", "turret.point_defense", "pd_shot", "muzzle.pd", "explosion_small")]


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
    x = np.where(img[..., 3].max(0) > 0)[0].max()
    ys = np.where(img[:, x, 3] > 0)[0]
    return x - an["x"], int(ys.mean()) - an["y"]


def aim_right(pub, base):
    """The turret's aim sprite that reaches furthest screen-right (its barrel points that way), charged if it has one."""
    def reach(aid):
        img, _, an = pub.static(aid)
        return np.where(img[..., 3].max(0) > 0)[0].max() - an["x"]
    best = max((f"{base}.d{d}" for d in range(8)), key=reach)
    return best + ".charged" if best + ".charged" in pub.m["assets"] else best


def rotated(cv, A, aid, x, y, deg):
    img, g, an = A.static(aid)
    im = Image.fromarray(img).rotate(-deg, resample=Image.NEAREST, expand=True)
    gi = Image.fromarray(g).rotate(-deg, resample=Image.NEAREST, expand=True) if g is not None else None
    cv.put(np.array(im), np.array(gi) if gi else None, int(x - im.width / 2), int(y - im.height / 2))


def scene(cv, A, pub, w, ox, oy, t=None):
    """A weapon's panel: roof patch, turret, fx. t: clip frame (None = a still with each fx at a readable frame)."""
    _, base, shot, muzzle, impact = w
    turret = aim_right(pub, base)
    roof(cv, pub, ox, oy, 7, 3)
    tx, ty = iso(ox, oy, 1, 1)
    cv.static(pub, turret, tx, ty)
    mx, my = tip(pub, turret)
    mx, my = tx + mx - 4, ty + my
    hx, hy = iso(ox, oy, 5, 1)
    hy -= ROOF_PX + (40 if impact == "explosion_small" else 0)
    deg = np.degrees(np.arctan2(hy - my, hx - mx))
    sh, mz, im = frames(A, shot), frames(A, muzzle), frames(A, impact)
    if t is None:
        cv.static(A, mz[1], mx, my)
        rotated(cv, A, sh[0], mx + (hx - mx) * 0.45, my + (hy - my) * 0.45, deg)
        cv.static(A, im[4 if impact.startswith("explosion") else 2], hx, hy)
        return
    if t < len(mz):
        cv.static(A, mz[t], mx, my)
    if 1 <= t <= 8:
        k = (t - 1) / 7
        rotated(cv, A, sh[t % len(sh)], mx + 20 + (hx - mx - 20) * k, my + (hy - my) * k, deg)
    if 9 <= t < 9 + len(im):
        cv.static(A, im[t - 9], hx, hy)


def strip(cv, A, ids, x, y, label, base=40):
    cv.labels.append((x, y, label))
    x0 = x
    for aid in ids:
        img, g, an = A.static(aid)
        cv.put(img, g, x, y + 12 + base - an["y"])
        x += max(img.shape[1], 16) + 4
    return x - x0


def main():
    A, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    PW, PH = 440, 250
    cv = Canvas(PW * 2, PH * 3)
    for i, w in enumerate(WEAPONS):
        x0, y0 = (i % 2) * PW, (i // 2) * PH
        scene(cv, A, pub, w, x0 + 120, y0 + 130)
        cv.labels.append((x0 + 6, y0 + 4, w[0]))
    for s in (1, 3):
        cv.save(out / f"fx-scenes-{s}x.png", s)

    cv = Canvas(1500, 1200)
    y = 6
    for label, _, shot, muzzle, impact in WEAPONS:
        x = 8
        x += strip(cv, A, frames(A, shot), x, y, f"{label}: shot") + 24
        x += strip(cv, A, frames(A, muzzle), x, y, "muzzle") + 24
        if not impact.startswith("explosion"):
            strip(cv, A, frames(A, impact), x, y, "impact", base=60)
        y += 100
    strip(cv, A, frames(A, "ion_disabled"), 8, y, "ion disabled (loop, on a module roof)", base=110)
    y += 130
    for name, h in (("explosion_small", 50), ("explosion", 70), ("explosion_large", 95)):
        strip(cv, A, frames(A, name), 8, y, name, base=h)
        y += h + 40
    strip(cv, pub, ["fx.laser_bolt.0", "fx.mass_slug.0", "fx.missile.0", "fx.ion_bolt.0", "fx.fire_shell.0", "fx.pd_shot.0",
                    "fx.explosion_small.2"], 8, y, "today: the old shots and the old explosion")
    cv.px = cv.px[:y + 90]
    for s in (1, 3):
        cv.save(out / f"fx-strips-{s}x.png", s)

    clip = []
    for w in WEAPONS:
        for t in range(22):
            c = Canvas(440, 230)
            scene(c, A, pub, w, 120, 125, t)
            c.labels.append((6, 4, w[0]))
            im = Image.fromarray(c.px[..., :3])
            clip.append(im.resize((im.width * 3, im.height * 3), Image.NEAREST))
    mp4(clip, out / "fx-clip.mp4", fps=12, loops=1)

    shots = []                                          # every shot's loop, close up
    for t in range(24):
        c = Canvas(300, 200)
        for i, w in enumerate(WEAPONS):
            sh = frames(A, w[2])
            c.static(A, sh[t % len(sh)], 70 + (i % 2) * 150, 40 + (i // 2) * 60)
        im = Image.fromarray(c.px[..., :3])
        shots.append(im.resize((im.width * 4, im.height * 4), Image.NEAREST))
    mp4(shots, out / "fx-shots.mp4", fps=12, loops=3)
    print("wrote", out)


if __name__ == "__main__":
    main()
