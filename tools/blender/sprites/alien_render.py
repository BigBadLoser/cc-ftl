"""Aliens: clips (poses on the alien rigs), rendering and packing into one sheet per creature, in the crew layer format
(8 direction rows x all clip frames, feet anchor, glow twin sheet): `crew.alien.body.<kind>`, species `alien`.

Clips: idle 4 (breathing, mandibles working, head sweeping), run 6 (tripod gait, low and leaning in), attack 5 (rear up
with the scythes raised, lunge, slash down, recover), hurt 2 (recoil), dead 1 (flipped on its back, legs curled, glow
out: a corpse that stays on the floor)."""
import math
import os
import numpy as np
from . import core, post
from . import human_render as hr
from . import alien

CLIPS = [("idle", 4, 4, True), ("run", 6, 12, True), ("attack", 5, 10, False), ("hurt", 2, 8, False), ("dead", 1, 1, False)]
W, H, ORIGIN = 132, 124, (66, 84)
TAU = math.tau
TRIPOD = {("0", "R"): 0, ("1", "L"): 0, ("2", "R"): 0, ("0", "L"): 1, ("1", "R"): 1, ("2", "L"): 1}


def _legs(rig, swing=0.0, lift=0.0, phase=0.0, curl=0.0):
    """Every leg: `swing` (deg, forward), `lift` (deg) on the tripod in the air; phase 0..1 picks which tripod."""
    for i in "012":
        for side, sx in (("R", 1), ("L", -1)):
            t = TAU * phase + (math.pi if TRIPOD[(i, side)] else 0.0)
            s = swing * math.sin(t)
            up = lift * max(0.0, math.cos(t))
            rig.rot(f"leg{i}_{side}", roll=sx * up + curl * sx, yaw=sx * s)
            rig.rot(f"knee{i}_{side}", roll=sx * (curl * 1.6 - up * 0.4))


def _scythes(rig, raise_=0.0, blade=0.0, spread=0.0):
    for side, sx in (("R", 1), ("L", -1)):
        rig.rot(f"claw_{side}", pitch=-raise_, roll=-sx * spread)
        rig.rot(f"blade_{side}", pitch=blade)


def _mand(rig, open_):
    rig.rot("mand_R", yaw=-open_)
    rig.rot("mand_L", yaw=open_)


def pose(rig, clip, i):
    rig.rest()
    alive = clip != "dead"
    rig.show("glow", alive)
    rig.show("glowoff", not alive)
    r = rig.rot
    if clip == "idle":
        t = TAU * i / 4
        rig.shift("body", dz=0.012 * math.sin(t))
        r("abdomen", pitch=3 * math.sin(t))
        r("head", yaw=(0, 10, 0, -10)[i], pitch=-4)
        _mand(rig, 6 + 8 * max(0.0, math.sin(t * 2)))
        _scythes(rig, raise_=4 * math.sin(t), blade=0)
        _legs(rig, swing=3, lift=0, phase=i / 4)
    elif clip == "run":
        t = TAU * i / 6
        rig.shift("body", dz=-0.04 + 0.015 * abs(math.sin(t)), df=0.02)
        r("body", pitch=8, roll=3 * math.sin(t))
        r("abdomen", pitch=-6 + 3 * math.sin(2 * t))
        r("head", pitch=-8)
        _mand(rig, 10)
        _scythes(rig, raise_=-10, blade=15)
        _legs(rig, swing=24, lift=22, phase=i / 6)
    elif clip == "attack":
        raise_, blade, pitch, df, dz, mand = ((55, -50, -16, -0.06, 0.05, 22), (95, -80, -26, -0.1, 0.1, 32),
                                              (10, 20, 14, 0.22, -0.02, 30), (-30, 60, 22, 0.3, -0.05, 14),
                                              (15, -5, 4, 0.08, 0.0, 8))[i]
        rig.shift("body", df=df, dz=dz)
        r("body", pitch=pitch)
        r("abdomen", pitch=-pitch * 0.6)
        r("head", pitch=-pitch * 0.5)
        _mand(rig, mand)
        _scythes(rig, raise_=raise_, blade=blade, spread=8 if i < 2 else 0)
        _legs(rig, swing=10 if i in (2, 3) else 4, lift=0, phase=0.25)
    elif clip == "hurt":
        k = (1.0, 0.5)[i]
        rig.shift("body", df=-0.08 * k, dz=0.03 * k)
        r("body", pitch=-14 * k, roll=6 * k)
        r("head", pitch=-18 * k, yaw=12 * k)
        r("abdomen", pitch=10 * k)
        _mand(rig, 28 * k)
        _scythes(rig, raise_=30 * k, blade=-20 * k, spread=14 * k)
        _legs(rig, swing=6, lift=10 * k, phase=0.0)
    elif clip == "dead":
        r("body", roll=172, pitch=6)
        r("abdomen", pitch=12)
        r("head", pitch=20)
        _mand(rig, 4)
        _scythes(rig, raise_=-20, blade=60, spread=-10)
        _legs(rig, curl=-28)
    rig.ground_attached()


def render_frame():
    rgb, a = core.render(W, H, "color", ORIGIN)
    c, op = hr._opaque(rgb, a)
    c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
    grgb, _ = core.render(W, H, "glow", ORIGIN)
    g = np.pad(post.glow_down(grgb, core.SS), ((1, 1), (1, 1), (0, 0)))
    return post.to_rgba(c, op), g


def render_kind(kind, dirs=range(8), frames=None, log=print):
    core.setup_scene()
    post.select(True)
    rig = alien.BUILD[kind]()
    cols = [(c, i) for c, n, _, _ in CLIPS for i in range(n)]
    res = {}
    for d in dirs:
        rig.root.rotation_euler = (0, 0, math.radians(hr.THETA[d]))
        for col, (clip, i) in enumerate(cols):
            if frames and (clip, i) not in frames:
                continue
            pose(rig, clip, i)
            res[(d, col)] = render_frame()
        log(f"{kind} dir {d} done", flush=True)
    return res, cols


def pack(kind, res, cols, outdir, log=print):
    from .crew_pack import union_box
    aid = f"crew.alien.body.{kind}"
    x0, y0, x1, y1 = union_box({0: res})
    cw, ch = int(x1 - x0), int(y1 - y0)
    sheet = np.zeros((8 * ch, len(cols) * cw, 4), np.uint8)
    glow = np.zeros_like(sheet)
    for (d, col), (rgba, g) in res.items():
        sl = (slice(d * ch, (d + 1) * ch), slice(col * cw, (col + 1) * cw))
        sheet[sl], glow[sl] = rgba[y0:y1, x0:x1], g[y0:y1, x0:x1]
    clips, start = {}, 0
    for clip, n, fps, loop in CLIPS:
        clips[clip] = {"start": start, "frames": n, "fps": fps, "loop": loop}
        start += n
    (outdir / "sprites").mkdir(parents=True, exist_ok=True)
    post.write_png(outdir / f"sprites/{aid}.png", sheet)
    post.write_png(outdir / f"sprites/{aid}.glow.png", glow)
    sheets = {aid: {"image": f"sprites/{aid}.png", "glow": f"sprites/{aid}.glow.png"}}
    assets = {aid: {"kind": "crew.layer", "species": "alien", "slot": "body", "order": 0, "sheet": aid, "frameW": cw,
                    "frameH": ch, "anchor": {"x": int(ORIGIN[0] + 1 - x0), "y": int(ORIGIN[1] + 1 - y0)},
                    "clips": clips, "glow": True}}
    log(f"ALIEN {aid} cell {cw}x{ch} sheet {sheet.shape[1]}x{sheet.shape[0]}")
    return sheets, assets


QUICK = {("idle", 0), ("run", 1), ("attack", 1), ("attack", 3), ("hurt", 0), ("dead", 0)}


def build(outdir, kinds=None):
    """ALIEN_QUICK=1: preview frames only, in SE, S, SW, NW (look iteration; never for commits)."""
    quick = os.environ.get("ALIEN_QUICK")
    sheets, assets = {}, {}
    for k in kinds or list(alien.BUILD):
        res, cols = render_kind(k, dirs=(0, 1, 2, 4) if quick else range(8), frames=QUICK if quick else None)
        s, a = pack(k, res, cols, outdir)
        sheets.update(s)
        assets.update(a)
    return sheets, assets
