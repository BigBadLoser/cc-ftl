"""Aliens: clips (poses on the alien rigs), rendering and packing into one sheet per creature, in the crew layer format
(8 direction rows x all clip frames, feet anchor, glow twin sheet): `crew.alien.body.<kind>`, species `alien`.

Clips: idle 4, run 6 (tripod gait for six legs, diagonal pairs for four), attack 5, hurt 2 (recoil), dead 1 (a corpse
that stays on the floor, glow out). Attacks: the hunter rears with its scythes raised, lunges and slashes down; the brute
raises its right claw, slams it down and crushes; the spitter pumps its sac, jerks its head forward and spits a glob."""
import math
import os
import numpy as np
from . import core, post
from . import human_render as hr
from . import alien

CLIPS = [("idle", 4, 4, True), ("run", 6, 12, True), ("attack", 5, 10, False), ("hurt", 2, 8, False), ("dead", 1, 1, False)]
W, H, ORIGIN = 132, 124, (66, 84)
TAU = math.tau


def _legs(rig, swing=0.0, lift=0.0, phase=0.0, curl=0.0):
    """Every leg: `swing` (deg, forward), `lift` (deg) on the leg set in the air (rig.gait); phase 0..1."""
    for i in rig.legs:
        for side, sx in (("R", 1), ("L", -1)):
            t = TAU * phase + (math.pi if rig.gait[(i, side)] else 0.0)
            s = swing * math.sin(t)
            up = lift * max(0.0, math.cos(t))
            rig.rot(f"leg{i}_{side}", roll=sx * up + curl * sx, yaw=sx * s)
            rig.rot(f"knee{i}_{side}", roll=sx * (curl * 1.6 - up * 0.4))


def _scythes(rig, raise_=0.0, blade=0.0, spread=0.0, sides=("R", "L")):
    for side, sx in (("R", 1), ("L", -1)):
        if side in sides:
            rig.rot(f"claw_{side}", pitch=-raise_, roll=-sx * spread)
            rig.rot(f"blade_{side}", pitch=blade)


def _mand(rig, open_):
    rig.rot("mand_R", yaw=-open_)
    rig.rot("mand_L", yaw=open_)


def _scale(rig, joint, k):
    rig.joints[joint][0].scale = (k, k, k)


def _hunter(rig, clip, i):
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


def _pincers(rig, open_, sides=("R", "L")):
    for side in sides:
        rig.rot(f"pincer_{side}", pitch=-open_)


def _brute(rig, clip, i):
    r = rig.rot
    if clip == "idle":
        t = TAU * i / 4
        rig.shift("body", dz=0.01 * math.sin(t))
        _scale(rig, "body", 1.0)
        r("head", yaw=(0, 6, 0, -6)[i])
        _mand(rig, 4 + 6 * max(0.0, math.sin(t)))
        _scythes(rig, raise_=3 * math.sin(t), blade=0)
        _pincers(rig, 6 + 10 * max(0.0, math.sin(t + 1)))
        _legs(rig, swing=2, phase=i / 4)
    elif clip == "run":
        t = TAU * i / 6
        rig.shift("body", dz=-0.02 + 0.02 * abs(math.sin(t)), df=0.02)
        r("body", pitch=5, roll=4 * math.sin(t))
        r("abdomen", pitch=-3 * math.sin(t))
        _scythes(rig, raise_=-8 + 4 * math.sin(t), blade=8)
        _pincers(rig, 4)
        _legs(rig, swing=18, lift=16, phase=i / 6)
    elif clip == "attack":
        raise_, blade, pitch, df, dz, pin = ((50, -30, -10, -0.04, 0.03, 30), (85, -55, -18, -0.06, 0.06, 40),
                                             (5, 20, 12, 0.16, -0.02, 30), (-25, 40, 16, 0.2, -0.04, 0),
                                             (10, 0, 4, 0.06, 0.0, 10))[i]
        rig.shift("body", df=df, dz=dz)
        r("body", pitch=pitch)
        r("abdomen", pitch=-pitch * 0.4)
        r("head", pitch=-pitch * 0.3)
        _mand(rig, 14)
        _scythes(rig, raise_=raise_, blade=blade, sides=("R",))                                 # the right claw strikes
        _scythes(rig, raise_=12, blade=-10, sides=("L",))
        _pincers(rig, pin, ("R",))
        _pincers(rig, 10, ("L",))
        _legs(rig, swing=6 if i in (2, 3) else 2, phase=0.25)
    elif clip == "hurt":
        k = (1.0, 0.5)[i]
        rig.shift("body", df=-0.05 * k, dz=0.02 * k)
        r("body", pitch=-9 * k, roll=-5 * k)
        r("head", pitch=-12 * k)
        _scythes(rig, raise_=24 * k, blade=-14 * k, spread=10 * k)
        _pincers(rig, 30 * k)
        _legs(rig, swing=4, lift=6 * k)
    elif clip == "dead":
        r("body", roll=165, pitch=4)
        r("head", pitch=16)
        _scythes(rig, raise_=-25, blade=30, spread=-14)
        _pincers(rig, 25)
        _legs(rig, curl=-24)


def _spitter(rig, clip, i):
    r = rig.rot
    rig.show("glob1", clip == "attack" and i == 2)
    rig.show("glob2", clip == "attack" and i == 3)
    if clip == "idle":
        t = TAU * i / 4
        rig.shift("body", dz=0.012 * math.sin(t))
        _scale(rig, "sac", 1.0 + 0.06 * math.sin(t))
        r("abdomen", pitch=3 * math.sin(t))
        r("tail", pitch=-4 * math.sin(t))
        r("head", yaw=(0, 12, 0, -12)[i])
        _mand(rig, 4 + 6 * max(0.0, math.sin(t * 2)))
        _legs(rig, swing=3, phase=i / 4)
    elif clip == "run":
        t = TAU * i / 6
        rig.shift("body", dz=-0.03 + 0.02 * abs(math.sin(t)), df=0.02)
        r("body", pitch=6, roll=3 * math.sin(t))
        r("abdomen", pitch=-5 + 4 * math.sin(2 * t))
        r("tail", pitch=4 * math.sin(2 * t))
        _legs(rig, swing=26, lift=24, phase=i / 6)
    elif clip == "attack":
        sac, pitch, tail, head, df = ((1.15, -10, -12, -14, -0.03), (1.25, -14, -18, -20, -0.05),
                                      (0.85, 8, 14, 16, 0.05), (0.9, 6, 10, 10, 0.04), (1.0, 2, 2, 2, 0.01))[i]
        _scale(rig, "sac", sac)
        rig.shift("body", df=df)
        r("body", pitch=pitch)
        r("tail", pitch=tail)
        r("head", pitch=head)
        _mand(rig, 20 if i in (2, 3) else 6)
        _legs(rig, swing=3, phase=0.25)
    elif clip == "hurt":
        k = (1.0, 0.5)[i]
        rig.shift("body", df=-0.06 * k, dz=0.02 * k)
        r("body", pitch=-12 * k, roll=7 * k)
        r("tail", pitch=-14 * k)
        r("head", pitch=-14 * k, yaw=10 * k)
        _mand(rig, 22 * k)
        _legs(rig, swing=5, lift=10 * k)
    elif clip == "dead":
        _scale(rig, "sac", 0.75)
        r("body", roll=95, pitch=4)
        r("abdomen", pitch=20)
        r("tail", pitch=30)
        r("head", pitch=18)
        _legs(rig, curl=-26)


POSE = {"hunter": _hunter, "brute": _brute, "spitter": _spitter}


def pose(rig, clip, i):
    rig.rest()
    for j in ("body", "sac"):
        if j in rig.joints:
            _scale(rig, j, 1.0)
    alive = clip != "dead"
    rig.show("glow", alive)
    rig.show("glowoff", not alive)
    POSE[rig.kind](rig, clip, i)
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


QUICK = {("idle", 0), ("run", 1), ("attack", 1), ("attack", 2), ("attack", 3), ("hurt", 0), ("dead", 0)}


def build(outdir, kinds=None):
    """Look iteration only (never for commits): ALIEN_QUICK=1 renders the preview frames in SE, S, SW, NW; ALIEN_ANIM=1
    every frame facing SE (the animation clips); ALIEN_KINDS=hunter,brute limits the creatures."""
    quick, anim = os.environ.get("ALIEN_QUICK"), os.environ.get("ALIEN_ANIM")
    if os.environ.get("ALIEN_KINDS"):
        kinds = os.environ["ALIEN_KINDS"].split(",")
    sheets, assets = {}, {}
    for k in kinds or list(alien.BUILD):
        dirs = (0,) if anim else (0, 1, 2, 4) if quick else range(8)
        res, cols = render_kind(k, dirs=dirs, frames=QUICK if quick else None)
        s, a = pack(k, res, cols, outdir)
        sheets.update(s)
        assets.update(a)
    return sheets, assets
