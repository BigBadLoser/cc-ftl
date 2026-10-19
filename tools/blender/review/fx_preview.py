"""Combat fx v2 preview (plain python3 + numpy + PIL): every weapon's fx (family `fx`) over a roof patch with its
turret, frame strips with today's fx for comparison, and a clip of each weapon firing in turn.

  python3 -I tools/blender/review/fx_preview.py <fx assets dir> <out dir>
    -> fx-scenes-1x/3x.png (one panel per weapon), fx-strips-1x/3x.png (every frame), fx-clip.mp4, fx-shots.mp4,
       fx-env-1x/3x.png and fx-env.mp4 (tile fire, shield hits, debris, a ship breaking up),
       fx-hand-1x/3x.png and fx-hand.mp4 (crew fights: shots, hits, a miss, a blade swing; shield edge, decals)

Fx are drawn like any sprite: colour over, glow added."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import DIRS, Assets, Canvas, human, iso, mp4  # noqa: E402

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


def env(A, pub, out):
    """Tile fire on a floor patch, shield hits, debris and the huge explosion: a still and a clip."""
    cv = Canvas(1200, 560)
    strip(cv, A, frames(A, "fire"), 8, 6, "fire on a tile (8-frame loop)", base=70)
    y = 110
    strip(cv, A, frames(A, "shield_hit"), 8, y, "shield hit", base=40)
    y += 90
    for v in "abc":
        strip(cv, A, frames(A, f"debris.{v}"), 8 + "abc".index(v) * 300, y, f"debris {v} (tumble)", base=20)
    y += 60
    strip(cv, A, frames(A, "explosion_huge"), 8, y, "explosion_huge", base=150)
    y += 220
    strip(cv, pub, frames(pub, "fire"), 8, y, "today: fire", base=30)
    cv.px = cv.px[:y + 70]
    for s in (1, 3):
        cv.save(out / f"fx-env-{s}x.png", s)
    clip = []
    burning = [(1, 1, 0), (2, 1, 3), (1, 2, 5), (2, 2, 2)]
    for t in range(24):                                     # a burning room
        c = Canvas(400, 230)
        for y in range(4):
            for x in range(4):
                c.static(pub, "tile.floor.a", *iso(200, 60, x, y))
        for x, y, o in sorted(burning, key=lambda b: b[0] + b[1]):
            c.static(A, f"fx.fire.{(t + o) % 8}", *iso(200, 60, x, y))
        c.labels.append((6, 4, "fire on tiles"))
        clip.append(c)
    for t in range(14):                                     # a bolt hitting the shield
        c = Canvas(400, 230)
        if t < 4:
            rotated(c, A, f"fx.laser_bolt.{t % 6}", 60 + t * 35, 140 - t * 6, -10)
        elif t - 4 < 6:
            c.static(A, f"fx.shield_hit.{t - 4}", 200, 115)
        c.labels.append((6, 4, "shield hit"))
        clip.append(c)
    rng = np.random.default_rng(4)
    bits = [(rng.uniform(-1, 1) * 9, rng.uniform(-2.5, -0.5) * 4, "abc"[i % 3], int(rng.integers(0, 8))) for i in range(9)]
    for t in range(30):                                     # a ship breaking up
        c = Canvas(400, 230)
        roof(c, pub, 200, 110, 5, 4)
        for (dx, dy), t0, name in (((0, 0), 0, "explosion_huge"), ((-60, 10), 4, "explosion"), ((55, 18), 8, "explosion_large"),
                                   ((10, 30), 13, "explosion")):
            if 0 <= t - t0 < 12:
                c.static(A, f"fx.{name}.{t - t0}", 216 + dx, 95 + dy)
        for vx, vy, v, r0 in bits:
            if 2 <= t < 26:
                s = t - 2
                c.static(A, f"fx.debris.{v}.{(r0 + s) % 8}", int(216 + vx * s), int(85 + vy * s + 0.35 * s * s))
        c.labels.append((6, 4, "a ship breaking up"))
        clip.append(c)
    ims = []
    for c in clip:
        im = Image.fromarray(c.px[..., :3])
        ims.append(im.resize((im.width * 3, im.height * 3), Image.NEAREST))
    mp4(ims, out / "fx-env.mp4", fps=12, loops=1)


MUZZLE_PX, BODY_PX = 37, 29                             # gun and chest height above the feet (fightFx MUZZLE_Z, BODY_Z)
FIGHT = [("sidearm", "hand.muzzle.sidearm", "hand.tracer", "hand.hit"), ("rifle, a miss", "hand.muzzle.rifle", "hand.tracer", "hand.ricochet"),
         ("ion pistol", "hand.muzzle.ion", "hand.tracer.ion", "hand.hit_ion"), ("on a robot or cover", "hand.muzzle.rifle", "hand.tracer", "hand.hit_spark"),
         ("blade", None, None, "hand.hit")]


def hand(A, pub, out):
    """Two crew on a floor patch trading fire, each weapon in turn; strips of every hand fx, the shield edge and decals."""
    cv = Canvas(1100, 330)
    y, x = 6, 8
    for name in ("hand.muzzle.sidearm", "hand.muzzle.rifle", "hand.muzzle.ion", "hand.tracer", "hand.tracer.ion", "hand.hit",
                 "hand.hit_spark", "hand.hit_ion", "hand.ricochet", "hand.slash"):
        x += strip(cv, A, frames(A, name), x, y, name[5:], base=20) + 16
        if x > 900:
            x, y = 8, y + 60
    y += 70
    strip(cv, A, frames(A, "shield_edge"), 8, y, "shield edge (loop)", base=20)
    for i, name in enumerate(("decal.scorch.0", "decal.scorch.1", "decal.scorch.2", "decal.breach.0")):
        cv.static(pub, "tile.floor.a", 300 + i * 90, y + 50)
        cv.static(A, f"fx.{name}", 300 + i * 90, y + 50)
    cv.labels.append((300, y, "scorch 0-2, breach (on floor tiles)"))
    cv.px = cv.px[:y + 90]
    for s in (1, 3):
        cv.save(out / f"fx-hand-{s}x.png", s)
    ims = []
    for label, mz, tr, ht in FIGHT:
        for t in range(14):
            c = Canvas(360, 250)
            for gy in range(4):
                for gx in range(5):
                    c.static(pub, "tile.floor.a", *iso(140, 100, gx, gy))
            ax, ay = iso(140, 100, 0.5, 0.5)
            bx, by = iso(140, 100, 3.5, 1.5) if mz else iso(140, 100, 1.5, 0.5)
            ax, ay, bx, by = int(ax), int(ay), int(bx), int(by)
            c.char(human(pub, DIRS["SE"]), ax, ay)
            c.char(human(pub, DIRS["NW"]), bx, by)
            mx, my, hx, hy = ax + 8, ay - MUZZLE_PX, bx, by - BODY_PX
            if "miss" in label:
                hx, hy = bx + 26, by + 10                                    # the round strikes the floor behind
            deg = np.degrees(np.arctan2(hy - my, hx - mx))
            if mz and t < 3:
                rotated(c, A, f"fx.{mz}.{t}", mx, my, deg)
            if tr and 1 <= t <= 3:
                k = t / 3
                fr = frames(A, tr)
                rotated(c, A, fr[t % len(fr)], mx + (hx - mx) * k, my + (hy - my) * k, deg)
            if not mz and t < 4:
                rotated(c, A, f"fx.hand.slash.{t}", hx - 6, hy, deg)
            t0 = 4 if mz else 2
            if t0 <= t < t0 + 4:
                c.static(A, f"fx.{ht}.{t - t0}", hx, hy)
            c.labels.append((6, 4, label))
            im = Image.fromarray(c.px[..., :3])
            ims.append(im.resize((im.width * 3, im.height * 3), Image.NEAREST))
    mp4(ims, out / "fx-hand.mp4", fps=10, loops=1)


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
    env(A, pub, out)
    hand(A, pub, out)
    print("wrote", out)


if __name__ == "__main__":
    main()
