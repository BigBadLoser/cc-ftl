"""Robot crew: clips (poses on the robot_kit rigs), rendering and packing into crew layer sheets.

Same contract as the human layers (crew_pack.py): one sheet per layer, 8 direction rows x all clip frames, a shared
frame size and feet anchor per species, glow twin sheets, `team.*` keys for the faction livery. Each robot type is a
single body layer (`crew.robot.body.worker`, `crew.robot.body.repair`, `crew.robot_heavy.body.security`).

Clips: idle 4, walk 8, work 6, charge 4 (powered down in the bay; the charge bar fills cell by cell), wreck 1
(on the floor, visor dark). Robots never sleep or sit."""
import math
import os
import numpy as np
from . import core, post
from . import human_render as hr
from . import robots

CLIPS = [("idle", 4, 4, True), ("walk", 8, 10, True), ("work", 6, 8, True), ("charge", 4, 3, True), ("wreck", 1, 1, False)]
SPECIES = {"worker": "robot", "repair": "robot", "security": "robot_heavy"}
W, H, ORIGIN = hr.W, hr.H, hr.ORIGIN
TAU = math.tau


def _state(rig, clip, i):
    run = clip not in ("charge", "wreck")
    rig.show("eye", run)
    rig.show("jet", run)
    rig.show("jetoff", not run)
    rig.show("torch", clip == "work")
    rig.show("spark", clip == "work" and i % 2 == 1)
    for k in range(4):
        rig.show(f"bar{k}", clip == "charge" and k <= i)


def _stance(rig, a):
    """Standing: the right foot a little forward, knees soft, so the legs read apart in the side views."""
    for side, sg in (("R", 1), ("L", -1)):
        hip, knee = -10 * a * sg - 3, 7
        rig.rot(f"hip_{side}", pitch=hip)
        rig.rot(f"knee_{side}", pitch=knee)
        rig.rot(f"ankle_{side}", pitch=-(hip + knee))


def _biped(rig, clip, i):
    a = 0.8 if rig.name == "heavy" else 1.0
    r = rig.rot

    def util(pitch, el):                     # the worker's crane arm (util / util_el); other chassis have none
        if "util" in rig.joints:
            r("util", pitch=pitch)
            r("util_el", pitch=el)
    if clip == "idle":
        t = TAU * i / 4
        _stance(rig, a)
        r("head", yaw=(0, 8, 0, -8)[i])
        for s, sg in (("R", 1), ("L", -1)):
            r(f"arm_{s}", pitch=-5 + 2 * math.sin(t) * sg, roll=6 * sg)
            r(f"elbow_{s}", pitch=-16)
        rig.shift("torso", dz=0.006 * math.sin(t))
        util(2 * math.sin(t), 0)
    elif clip == "walk":
        t = TAU * i / 8
        s = 22 * a * math.sin(t)
        for side, sg in (("R", 1), ("L", -1)):
            hip = -s * sg
            knee = 34 * a * max(0.0, math.cos(t) * sg)
            r(f"hip_{side}", pitch=hip)
            r(f"knee_{side}", pitch=knee)
            r(f"ankle_{side}", pitch=-(hip + knee) + 4)
            r(f"arm_{side}", pitch=-4 + 18 * a * math.sin(t) * sg, roll=6 * sg)
            r(f"elbow_{side}", pitch=-18)
        r("body", pitch=4)
        r("torso", yaw=5 * a * math.sin(t))
        util(3 * math.sin(2 * t), -4 * math.sin(2 * t))
    elif clip == "work":
        t = TAU * i / 6
        r("body", pitch=6)
        r("torso", pitch=8)
        r("head", pitch=14)
        for side, sg in (("R", 1), ("L", -1)):
            r(f"arm_{side}", pitch=-52 + 9 * math.sin(t) * sg, roll=-6 * sg)
            r(f"elbow_{side}", pitch=-38 + 18 * math.sin(t) * sg)
            r(f"hip_{side}", pitch=-10)
            r(f"knee_{side}", pitch=18)
            r(f"ankle_{side}", pitch=-8)
        util(20 + 6 * math.sin(t), -48 + 14 * math.sin(t))         # reaches up and forward over the head, working
    elif clip == "charge":
        r("torso", pitch=12)
        r("head", pitch=30)
        for side, sg in (("R", 1), ("L", -1)):
            r(f"arm_{side}", pitch=4, roll=2 * sg)
            r(f"elbow_{side}", pitch=-10)
            r(f"hip_{side}", pitch=-16)
            r(f"knee_{side}", pitch=30)
            r(f"ankle_{side}", pitch=-14)
        util(-6, 8)
    elif clip == "wreck":
        r("body", pitch=-82, roll=8)
        r("hip_R", pitch=12, roll=6)
        r("hip_L", pitch=4, roll=-10)
        r("knee_R", pitch=40)
        r("ankle_R", pitch=-30)
        r("arm_R", pitch=-20, roll=55)
        r("arm_L", pitch=10, roll=-35)
        r("elbow_L", pitch=-50)
        util(-35, 40)
        rig.detach("head", (-0.55, 0.15, 0.0), (80, 0, 35))
        rig.ground_attached()
        rig.drop("head")
        return
    rig.ground_attached()


def _drone(rig, clip, i):
    r = rig.rot
    if clip == "idle":
        t = TAU * i / 4
        rig.shift("body", dz=0.02 * math.sin(t))
        r("body", roll=2 * math.sin(t))
        for side in ("R", "L"):
            r(f"arm_{side}", pitch=-4 + 3 * math.sin(t))
    elif clip == "walk":
        t = TAU * i / 8
        rig.shift("body", dz=0.015 * math.sin(2 * t))
        r("body", pitch=12, roll=2 * math.sin(t))
        for side, sg in (("R", 1), ("L", -1)):
            r(f"arm_{side}", pitch=16 + 6 * math.sin(t) * sg)
            r(f"elbow_{side}", pitch=12)
    elif clip == "work":
        t = TAU * i / 6
        r("body", pitch=8)
        for side, sg in (("R", 1), ("L", -1)):
            r(f"arm_{side}", pitch=-22 + 6 * math.sin(t) * sg)
            r(f"elbow_{side}", pitch=-8 + 14 * math.sin(t) * sg)
    elif clip == "charge":
        for side in ("R", "L"):
            r(f"arm_{side}", pitch=-75)          # landed: arms forward, forearms down as props
            r(f"elbow_{side}", pitch=45)
        rig.ground_attached()
    elif clip == "wreck":
        r("body", pitch=20, roll=-72)
        r("arm_R", pitch=-30, roll=20)
        r("elbow_R", pitch=50)
        rig.detach("arm_L", (0.45, 0.35, 0.0), (0, 85, 60))
        rig.ground_attached()
        rig.drop("arm_L")


REST = os.environ.get("ROBOT_REST")


def pose(rig, clip, i):
    rig.rest()
    _state(rig, clip, i)
    if REST:                                 # shape review: the neutral standing pose (idle frame 0)
        clip, i = "idle", 0
    (_drone if rig.kind == "drone" else _biped)(rig, clip, i)


def render_frame(rig):
    """-> (rgba uint8 (H+2,W+2,4), glow uint8 or None), no outline (the runtime draws one round the crew stack)."""
    rgb, a = core.render(W, H, "color", ORIGIN)
    c, op = hr._opaque(rgb, a)
    c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
    grgb, _ = core.render(W, H, "glow", ORIGIN)
    g = np.pad(post.glow_down(grgb, core.SS), ((1, 1), (1, 1), (0, 0)))
    return post.to_rgba(c, op), g


def render_type(kind, dirs=range(8), frames=None, log=print):
    """-> ({(d, col): (rgba, glow)}, cols) for one robot type."""
    core.setup_scene()
    post.select(True)                        # neon extras: the green charge bar
    rig = robots.BUILD[kind]()
    cols = [(c, i) for c, n, _, _ in CLIPS for i in range(n)]
    res = {}
    for d in dirs:
        rig.root.rotation_euler = (0, 0, math.radians(hr.THETA[d]))
        for col, (clip, i) in enumerate(cols):
            if frames and (clip, i) not in frames:
                continue
            pose(rig, clip, i)
            res[(d, col)] = render_frame(rig)
        log(f"{kind} dir {d} done", flush=True)
    return res, cols


def pack(kind, res, cols, outdir, log=print):
    """Writes sprites/<id>.png (+ .glow.png); returns (sheets, assets) manifest maps for this layer."""
    from .crew_pack import union_box
    sp = SPECIES[kind]
    aid = f"crew.{sp}.body.{kind}"
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
    assets = {aid: {"kind": "crew.layer", "species": sp, "slot": "body", "order": 0, "sheet": aid, "frameW": cw,
                    "frameH": ch, "anchor": {"x": int(ORIGIN[0] + 1 - x0), "y": int(ORIGIN[1] + 1 - y0)},
                    "clips": clips, "glow": True}}
    log(f"ROBOT {aid} cell {cw}x{ch} sheet {sheet.shape[1]}x{sheet.shape[0]}")
    return sheets, assets


QUICK = {("idle", 0), ("walk", 2), ("work", 3), ("charge", 3), ("wreck", 0)}


def build(outdir, kinds=("worker", "repair", "security")):
    """ROBOT_QUICK=1: only the preview frames in SE, SW, NW; ROBOT_REST=1: the rest pose (idle 0 cell) in all 8
    directions, for shape review; ROBOT_ANIM=1: every frame facing SE. All are for look iteration, never for commits."""
    quick = os.environ.get("ROBOT_QUICK")
    sheets, assets = {}, {}
    for k in kinds:
        if REST:
            res, cols = render_type(k, frames={("idle", 0)})
        elif os.environ.get("ROBOT_ANIM"):    # every frame, SE only: the animated preview
            res, cols = render_type(k, dirs=(0,))
        else:
            res, cols = render_type(k, dirs=(0, 2, 4) if quick else range(8), frames=QUICK if quick else None)
        s, a = pack(k, res, cols, outdir)
        sheets.update(s)
        assets.update(a)
    return sheets, assets
